#!/usr/bin/env python
from flask import Flask, request, g
from flask.ext.cors import CORS
from gtCommon import gtLogger
from bson import json_util

import gtldap
from datadiff import diff
import yaml
import re
import json
import pymongo
import types
import sys
import datetime
import traceback
app = Flask(__name__)
CORS(app)

config = yaml.load(open('config.yaml', 'r'))

lc = gtldap.ldap_client(config['user_dn'], config['user_pw'], server=config['ldap_server'])

client = pymongo.MongoClient(config['mongo_server'], int(config['mongo_port']))
client[config['mongo_atlas_db']].authenticate(config['mongo_user'], config['mongo_pw'])
client[config['mongo_salt_db']].authenticate(config['mongo_user'], config['mongo_pw'])
db = client[config['mongo_atlas_db']]
pillar_db = client[config['mongo_salt_db']]
enable_debug_logging = False
if config.get('log_level', 'info').lower() == 'debug':
    enable_debug_logging = True
logger = gtLogger(config['log_file'], debug=enable_debug_logging).getLogger()


def _log_request():
    g.user = request.headers.get('gtuser', 'anonymous_user')
    g.request_id = "{}_{}".format(g.user, datetime.datetime.now().strftime('%Y%m%dD%H%M%S'))
    logger.info('request_id="{}" user="{}" headers="{}" method="{}" request_url="{}"'
                .format(g.request_id, g.user, dict(request.headers), request.method, request.full_path))


@app.errorhandler(Exception)
def _handle_exception(e):
    exc_type, exc_value, exc_traceback = sys.exc_info()
    logger.error("exception='{}' stack_trace='{}'"
                 .format(e, ''.join([x.replace('\\n', '\n') for x in traceback.format_list(traceback.extract_tb(
                        exc_traceback, limit=10))]).strip()))
    return 'Error : {}'.format(e), 500


@app.route('/groups/<group>')
def get_group(group):
    groups = lc.find_groups(group)
    return json.dumps(groups, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route('/users/<username>')
def get_user(username):
    users = lc.find_users(username)
    return json.dumps(users, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}


def serialize_dict(data, key=""):
    key = (key+":").lstrip(':')
    new_data = {}
    if isinstance(data, types.DictType):
        for x in data:
            if isinstance(data[x], types.DictType) or isinstance(data[x], types.ListType):
                new_data.update(serialize_dict(data[x], key=key+x))
            else:
                new_data[key+x] = data[x]

    elif isinstance(data, types.ListType):
        for x, e in enumerate(data):
            if isinstance(e, types.DictType) or isinstance(e, types.ListType):
                new_data.update(serialize_dict(e, key=key+str(x)))
            else:
                new_data[key+str(x)] = e

    return new_data


@app.route("/assets/<asset>")
def get_asset(asset):
    serialize = request.args.get('serialize', False)
    output = request.args.get('output', 'json')
    if 'csv' in output:
        serialize = True
    rex = re.compile("^{}(\.geneva-*trading.com)?".format(asset))
    asset = db.hosts.find_one({'minion': rex})
    pillar = pillar_db.pillar.find_one({'minion': rex})

    if asset:
        del asset['_id']
        if pillar:
            asset.update(pillar)
        if serialize:
            asset = serialize_dict(asset)
    else:
        asset = {}

    for field in asset:
        if isinstance(asset[field], datetime.datetime):
            asset[field] = asset[field].strftime('%Y%m%dD%H:%M:%S')
        
        elif isinstance(asset[field], datetime.date):
            asset[field] = asset[field].strftime('%Y%m%d')
    # TODO: What is consuming these different media types?
    if 'yaml' in output:
        return yaml.safe_dump(asset, default_flow_style=False), 200, \
               {'Content-Type': 'application/x-yaml; charset=utf-8'}
    elif 'csv' in output:
        csv_asset = ""
        header = ""
        for k, v in asset.items():
            header += "{},".format(k)
            csv_asset += '{},'.format(v)
        csv_asset = header.rstrip(',')+"\n"+csv_asset.rstrip(',')
        return csv_asset

    return json.dumps(asset, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route("/networks/")
def get_networks():
    # TODO: Add network id to fetch specific network
    net_config = []
    for network in db.networks.find({}):
        del network['_id']
        net_config.append(network)
    return json.dumps(net_config, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route("/assets/")
def get_assets():
    assets = []
    pillars = {}
    serialize = request.args.get('serialize', False)
    output = request.args.get('output', 'json')
    if 'kv' in output:
        serialize = True
    results = db.hosts.find({})
    for host in pillar_db.pillar.find({}):
        pillars[host['_id']] = host

    for asset in results:
        del asset['_id']
        if asset.get('minion', '') in pillars:
            asset.update(pillars[asset['minion']])

        for field in asset:
            if isinstance(asset[field], datetime.datetime):
                asset[field] = asset[field].strftime('%Y%m%dD%H:%M:%S')

            elif isinstance(asset[field], datetime.date):
                asset[field] = asset[field].strftime('%Y%m%d')

        if serialize:
            asset = serialize_dict(asset)
        assets.append(asset)
    # TODO: Are these necessary? What is using these different data formats?
    if 'yaml' in output:
        return yaml.safe_dump(assets, default_flow_style=False), 200,\
               {'Content-Type': 'application/x-yaml; charset=utf-8'}
    elif 'kv' in output:
        ts = datetime.datetime.now().strftime('%Y%m%dT%H:%M:%S')
        kv_assets = ""
        for x in assets:
            for k, v in x.items():
                kv_assets += '{}="{}" '.format(k, v)
            kv_assets += 'timestamp="{}"\n'.format(ts)
        return kv_assets
    return json.dumps(assets, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route("/pillars/<pillar>", methods=['GET'])
def get_pillars(pillar):
    pillars = pillar_db.pillar.find_one({'minion' : pillar})
    return json.dumps(pillars, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route("/pillars/", methods=['POST'])
def set_pillars():
    params = request.form
    host = params.get('host', None)
    pillar = params.get('val', None)
    try:
        pillar_data = json.loads(pillar)
    except ValueError:
        logger.error('error="failed to parse JSON" request request_id="{}" pillar_data="{}"'
                     .format(g.request_id, pillar))
        return "failed to prase JSON paylod", 500
    for old_pillar in pillar_db.pillar.find({'_id': host}):
        del old_pillar['_id']
        new_pillar = old_pillar.copy()
        new_pillar.update(pillar_data)
        logger.info('action="update_pillar" request_id="{}" host="{}" old_pillar="{}", new_pillar="{}" diff="{}"'
                    .format(g.request_id, host, old_pillar, new_pillar, diff(old_pillar, new_pillar)))
        pillar_db.pillar.update({'_id': host}, new_pillar, upsert=True)

        return "OK", 200
    else:
        pillar_data['_id'] = host
        pillar_data['minion'] = host
        logger.info('action="create_pillar" request_id="{}" host="{}" new_pillar="{}"'
                    .format(g.request_id, host, pillar_data))
        pillar_db.pillar.insert(pillar_data)

        return "OK", 200

    return "Oh oh", 500

@app.route("/jobs/", methods=['GET'])
def get_jobs():
    minion = request.args.get('id', None)
    if not minion:
        return "No minion ID specified", 500

    jobs = []
    fun_filter = ['mine.update', 'saltutil.find_job', 'runner.jobs.lookup_jid',
                  'runner.jobs.list_job', 'grains.items', 'pillar.items', 'sys.list_functions']
    for jobresult in pillar_db.saltReturns.find(
            {'minion': minion, "$and": [{"fun": {"$nin": fun_filter}}]})\
            .sort("jid", direction=pymongo.DESCENDING).limit(20):
        jobs.append(jobresult)
    return json.dumps(jobs, indent=1,
                      default=json_util.default), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route("/runs/", methods=['GET'])
def get_runs():
    jid = request.args.get('id', None)
    if not jid:
        return "ID must be specified and be an integer", 500
    jobs = []
    for jobresult in pillar_db.saltReturns.find({'jid': jid}):
        jobs.append(jobresult)
    return json.dumps(jobs, indent=1,
                      default=json_util.default), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route("/profiles/", methods=['GET'])
def get_profiles():
    user_profile = {'_id': g.user, 'default_fields': ["host", "allowed_groups", "env_tag", "ilo_ip", "ipv4",
                                                      "osrelease", "productname", "roles", "serialnumber", "tags"]}
    for i in db.profiles.find({'_id': g.user}):
        user_profile = i
        break

    return json.dumps(user_profile)


@app.route("/profiles/", methods=['POST'])
def set_profiles():
    # TODO: Pass view name to support multiple views. Profile should be a one to many relationship with views
    params = request.form
    fields = params.get('fields', None)
    layout = params.get('layout', None)
    try:
        fields = json.loads(fields)
        layout = json.loads(layout)
    except ValueError:
        logger.error('error="failed to parse JSON" request request_id="{}" fields="{}" layout="{}"'
                     .format(g.request_id, fields, layout))
        return "failed to parse JSON paylod", 500

    logger.info('action=update_user_profile user={} fields="{}" layout="{}"'.format(g.user, fields, layout))
    db.profiles.update(
        {'_id': g.user}, {'$set': {"custom_fields": fields, "checkbox_list": layout}},
        upsert=True)

    return "OK", 200


@app.route("/config/", methods=['GET'])
def get_config():
    config = {}
    for i in db.config.find({}):
        config[i['name']] = i
    return json.dumps(config, indent=1, default=json_util.default)

@app.route("/config/", methods=['POST'])
def set_config():
    params = request.form
    field_name = params.get('field_name', None)
    new_vals = params.get('new_vals', None)
    try:
        field_name = json.loads(field_name)
        new_vals = json.loads(new_vals)
    except ValueError:
        logger.error('error="failed to parse JSON" request request_id="{}" field_name="{}" new_vals="{}"'
                     .format(g.request_id, new_vals))
        return "failed to parse JSON paylod", 500

    logger.info('action=update config field values field_name="{}" new_vals="{}"'.format(field_name, new_vals))
    db.config.update(
        {'name': field_name}, {'$set': {"values": new_vals}},
        upsert=False)

    return "OK", 200



if __name__ == '__main__':
    app.before_request(_log_request)
    app.run(debug=True, port=int(config['port']), host="0.0.0.0")
