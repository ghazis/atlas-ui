#!/usr/bin/env python
from flask import Flask, request
from flask.ext.cors import CORS

import gtldap
import ldap
import yaml
import StringIO
import re
import json
import pymongo
import types
import logging
import datetime
app = Flask(__name__)
CORS(app)

config = yaml.load(open('config.yaml', 'r'))

lc = gtldap.ldap_client(config['user_dn'], config['user_pw'], server=config['ldap_server'])

client = pymongo.MongoClient(config['mongo_server'],int(config['mongo_port']))
client.assets.authenticate(config['mongo_user'], config['mongo_pw'])
client.salt.authenticate(config['mongo_user'], config['mongo_pw'])
db = client.assets
pillar_db = client.salt


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
    net_config = json.loads(open('networks.json', 'r').read())
    return json.dumps(net_config, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}


@app.route("/assets/")
def get_assets():
    assets = []
    pillars = {}
    serialize = request.args.get('serialize', False)
    output = request.args.get('output', 'json')
    if 'kv' in output:
        serialize=True
    results = db.hosts.find({})
    for host in pillar_db.pillar.find({}):
        pillars[host['_id']] = host

    for x in results:
        del x['_id']
        if x.get('minion', '') in pillars:
            x.update(pillars[x['minion']])

        if serialize:
            x=serialize_dict(x)
        assets.append(x)
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

@app.route("/pillars/", methods=['GET', 'POST'])
def get_pillars():
    if request.method == 'GET':
        pillars = {}
        for host in pillar_db.pillar.find({}):
            pillars[host['_id']] = host
        return json.dumps(pillars, indent=1), 200, {'Content-Type': 'application/json; charset=utf-8'}
    elif request.method == 'POST':
        params = request.form
        host = params['host']
        key = params['key']
        val = params['val']
        try:
            val = json.loads(params['val'])
        except ValueError:
            pass
        pillar_db.pillar.update(
            {'_id': host},
            {'$set': {key: val}},
            upsert=False)
        return str(params)


if __name__ == '__main__':
    logging.basicConfig()
    logger = logging.getLogger()
    app.run(debug=True,port=int(config['port']),host="0.0.0.0")

