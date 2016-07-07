#!/usr/bin/env python
from flask import Flask, request, g
from flask.ext.cors import CORS
from gtCommon import gtLogger
from bson import json_util

import gtldap
import ldap
import yaml
import StringIO
import re
import json
import pymongo
import types
import sys
import logging
import datetime
import itertools
import traceback
app = Flask(__name__)
CORS(app)

config = yaml.load(open('config.yaml', 'r'))

lc = gtldap.ldap_client(config['user_dn'], config['user_pw'], server=config['ldap_server'])

client = pymongo.MongoClient(config['mongo_server'],int(config['mongo_port']))
client[config['mongo_atlas_db']].authenticate(config['mongo_user'], config['mongo_pw'])
client[config['mongo_salt_db']].authenticate(config['mongo_user'], config['mongo_pw'])
db = client[config['mongo_atlas_db']]
pillar_db = client[config['mongo_salt_db']]
enable_debug_logging = False
if config.get('log_level', 'info').lower() == 'debug':
    enable_debug_logging = True
logger = gtLogger(config['log_file'], debug=enable_debug_logging).getLogger()


def _log_request():
    g.user = request.headers.get('gtuser', 'unknown-user')
    g.request_id = "{}_{}".format(g.user, datetime.datetime.now().strftime('%Y%m%dD%H%M%S'))
    logger.info('request_id="{}" user="{}" headers="{}" method="{}" request_url="{}"'.format(g.request_id, g.user, dict(request.headers), request.method, request.full_path))


@app.errorhandler(Exception)
def _handle_exception(e):
    exc_type, exc_value, exc_traceback = sys.exc_info()
    logger.error("exception='{}' stack_trace='{}'".format(e,
        ''.join([ x.replace('\\n', '\n') for x in traceback.format_list(traceback.extract_tb(exc_traceback, limit=10))]).strip()))
    return 'Error : {}'.format(e), 500



@app.route('/groups/<group>')
def get_group(group):
    groups = lc.find_groups(group)
    return json.dumps(groups, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route('/users/<username>')
def get_user(username):
    users = lc.find_users(username)
    return json.dumps(users, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}


def serialize_dict(data,key=""):
    key = (key+":").lstrip(':')

    if type(data) is types.DictType:
        new_data = {}
        for x in data:
            if type(data[x]) is types.DictType or type(data[x]) is types.ListType:
                new_data.update(serialize_dict(data[x],key=key+x))
            else:
                new_data[key+x] = data[x]

    elif type(data) is types.ListType:
        new_data = {}
        for x,e in enumerate(data):
            if type(e) is types.DictType or type(e) is types.ListType:
                new_data.update(serialize_dict(e,key=key+str(x)))
            else:
                new_data[key+str(x)] = e

    return new_data


@app.route("/assets/<asset>")
def get_asset(asset):
    serialize = request.args.get('serialize', False)
    output = request.args.get('output', 'json')
    if 'csv' in output:
        serialize=True
    rex = re.compile("^{}(\.geneva-*trading.com)?".format(asset))
    asset = db.hosts.find_one({'minion': rex})
    pillar = pillar_db.pillar.find_one({'minion': rex})

    if asset:
        del asset['_id']
        if pillar:
            asset.update(pillar)
        if serialize:
            asset=serialize_dict(asset)
    else:
        asset = {}

    for field in asset:
        if isinstance(asset[field], datetime.datetime):
            asset[field] = asset[field].strfrtime('%Y%m%dD%H:%M:%S')
        
        elif isinstance(asset[field], datetime.date):
            asset[field] = asset[field].strfrtime('%Y%m%d')

    if 'yaml' in output:
        return yaml.safe_dump(asset, default_flow_style=False), 200, {'Content-Type': 'application/x-yaml; charset=utf-8'}
    elif 'csv' in output:
        csv_asset = ""
        header = ""
        for k,v in asset.items():
            header += "{},".format(k)
            csv_asset += '{},'.format(v)
        csv_asset = header.rstrip(',')+"\n"+csv_asset.rstrip(',')
        return csv_asset

    return json.dumps(asset, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route("/networks/")
def get_networks():
    net_config = []
    for network in db.networks.find({}):
        del network['_id']
        net_config.append(network)
    return json.dumps(net_config, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route("/assets/")
def get_assets():
    test = db.profiles.find()
    for i in test:
        print i
    print request.headers.get('gtuser')
    assets = []
    pillars = {}
    serialize = request.args.get('serialize', False)
    output = request.args.get('output', 'json')
    if 'kv' in output:
        serialize=True
    results = db.hosts.find({})
    for host in pillar_db.pillar.find({}):
        pillars[host['_id']] = host

    for asset in results:
        del asset['_id']
        if asset.get('minion', '') in pillars:
            asset.update(pillars[asset['minion']])

        for field in asset:
            if isinstance(asset[field], datetime.datetime):
                asset[field] = asset[field].strfrtime('%Y%m%dD%H:%M:%S')

            elif isinstance(asset[field], datetime.date):
                asset[field] = asset[field].strfrtime('%Y%m%d')

        if serialize:
            asset = serialize_dict(asset)
        assets.append(asset)

    if 'yaml' in output:
        return yaml.safe_dump(assets, default_flow_style=False), 200, {'Content-Type': 'application/x-yaml; charset=utf-8'}
    elif 'kv' in output:
        ts = datetime.datetime.now().strftime('%Y%m%dT%H:%M:%S')
        kv_assets = ""
        for x in assets:
            for k,v in x.items():
                kv_assets+='{}="{}" '.format(k,v,)
            kv_assets+='timestamp="{}"\n'.format(ts)
        return kv_assets
    return json.dumps(assets, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route("/pillars/", methods=['GET'])
def get_pillars():
    pillars = {}
    for host in pillar_db.pillar.find({}):
        pillars[host['_id']] = host
    return json.dumps(pillars, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}

@app.route("/pillars/", methods=['POST'])
def set_pillars():
    params = request.form
    host = params['host']
    val = json.loads(params['val'])
    for k,v in val.iteritems():
        print k
        print v
        pillar_db.pillar.update(
            {'_id': host},
            {'$set': {k: v}},
            upsert=False)
        logger.info(host + "'s information has been modified and is now set as " + v)
    return str(params)


@app.route("/jobs/", methods=['GET'])
def get_jobs():
    if not request.args.get('id'):
        return "No minion ID specified"
    minion = request.args['id']
    jobs = []
    fun_filter = ['mine.update', 'saltutil.find_job', 'runner.jobs.lookup_jid', 'runner.jobs.list_job', 'grains.items', 'pillar.items', 'sys.list_functions']
    for jobresult in pillar_db.saltReturns.find({'minion': minion, "$and": [{"fun": {"$nin": fun_filter}}]}).sort("jid", direction=pymongo.DESCENDING).limit(20):
        jobs.append(jobresult)
    return json.dumps(jobs, indent=1, default=json_util.default), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route("/runs/", methods=['GET'])
def get_runs():
    try:
        jid = request.args['id']
    except:
        return "ID must be specified and be an integer"
    jobs = []
    for jobresult in pillar_db.saltReturns.find({'jid': jid}):
        jobs.append(jobresult)
    return json.dumps(jobs, indent=1, default=json_util.default), 200, {'Content-Type': 'application/json; charset=utf-8'}

@app.route("/profiles/", methods=['GET', 'POST'])
def get_profiles():
    if request.method =="GET":
        if request.headers.get('gtuser'):
            return 'True'
        else:
            return 'False'
    if request.method =="POST":
        params = request.form
        layout = params['layout']
        print layout
        return 'layout'
        #val = json.loads(params['val'])
##        for k,v in val.iteritems():
##            print k
##            print v
##            pillar_db.pillar.update(
##                {'_id': host},
##                {'$set': {k: v}},
##                upsert=False)
##            logger.info(host + "'s information has been modified and is now set as " + v)
##        return str(params)
        
    

if __name__ == '__main__':
    app.before_request(_log_request)
    app.run(debug=True,port=int(config['port']),host="0.0.0.0")

