#!/usr/bin/env python

class ldap_client:
    import ldap
    ldap_conn = None
    ldap_scope = ldap.SCOPE_SUBTREE
    ldap_bind_dn = None
    ldap_bind_pw = None
    ldap_bind_server = None
    user_dn_map = {}
    group_dn_map = {}
    user_cache = {}
    group_cache = {}
    cache_ts = None


    def __init__(self, dn, pw, server='genevatrading.com'):
        self.ldap_bind_dn = dn
        self.ldap_bind_pw = pw
        self.ldap_bind_server = server
        self.do_bind()
        self.cache_results()
        

    def do_bind(self):
        self.ldap_conn = self.ldap.initialize('ldap://{}'.format(self.ldap_bind_server))
        self.ldap_conn.protocol_version = 3
        self.ldap.set_option(self.ldap.OPT_REFERRALS, 0)
        self.ldap.set_option(self.ldap.OPT_SIZELIMIT, 4000)
        self.ldap.set_option(self.ldap.OPT_X_TLS_REQUIRE_CERT, self.ldap.OPT_X_TLS_NEVER)
#        self.ldap_conn.start_tls_s()
        # grrr, bind doesn't seem to last. can fix?able
        r = self.ldap_conn.simple_bind_s(self.ldap_bind_dn, self.ldap_bind_pw)

        if r[0] == 97:
            return True
        return None


    def find_groups(self, sfilter=None):
        result = []
        for group in self.group_cache:
            if not sfilter or sfilter in group:
                result.append({'group': group, 'members': self.group_cache[group]})
        return result


    def find_users(self, sfilter=None):
        result = []
        for user in self.user_cache:
            if not sfilter or sfilter in user:
                result.append({'user': user, 'groups': self.user_cache[user]})
        return result


    def cache_results(self, sfilter=None):
        users = {}
        groups = {}

        for user in self.search('(&(objectclass=person)(sAMAccountName=*))', attrs=['mail', 'sAMAccountName'], base_dn="OU=AllUsers,OU=GENEVATRADING,DC=genevatrading,DC=com"):
            attrs = user.get_attributes()
            if 'sAMAccountName' in attrs:
                users[attrs['sAMAccountName'][0].lower()] = user.get_dn()

        for group in self.search('(&(objectclass=group)(name=*))', attrs=['member', 'displayname', 'name']):
            attrs = group.get_attributes()
            if 'member' in attrs and 'name' in attrs:
                if 'displayname' in attrs:
                    displayname = attrs['displayname'][0]
                else:
                    displayname = ''
                groups[attrs['name'][0].lower()] = {'members': attrs['member'], 'dn': group.get_dn(), 'displayname': displayname}
        
        self.user_dn_map = dict([(v,k) for k,v in users.iteritems()])
        for name, group in groups.items():
            self.group_dn_map[group['dn']] = name

        ldap_groups = {}
        for group, attrs in groups.items():
            ldap_groups[group] = attrs['members']

        self.group_cache = {}
        for group, attrs in groups.items():
            self.group_cache[group] = [x.lower() for x in self.resolve_members(attrs['members'], group, ldap_groups)]

        self.user_cache = {}
        for group, attrs in groups.items():
            for member in attrs['members']:
                if member not in self.user_dn_map:
                    continue
                member = self.user_dn_map[member]
                if not member in self.user_cache:
                    self.user_cache[member] = []
                self.user_cache[member].append(group)


    def resolve_members(self, members, group, ldap_groups):
        """ Resolve all members of group
            recursive method that will resolve all member groups into users
        """
        resolved_members = []
        for member in members:
            if member in self.user_dn_map:
                member = self.user_dn_map[member]
                resolved_members += [member]
            elif member in ldap_groups:
                resolved_members += self.resolve_members(ldap_groups[member]['members'], member, ldap_groups)
            #else do nothing, user must be out of scope
        return resolved_members


    def search(self, ldap_filter, base_dn="OU=GENEVATRADING,DC=genevatrading,DC=com",
            attrs=None, scope=None):
        """Execute a simple LDAP search"""

        if not self.do_bind():
            raise "Failed to bind"

        if not attrs:
            attrs = ['*']
        raw = self.ldap_conn.search_s(base_dn, self.ldap_scope, ldap_filter, attrs)
        result = self.parse_search_results(raw)
        return result

        
    def parse_search_results(self, results):
        """Given a set of results, return a list of LDAPSearchResult
        objects.
        """
        res = []

        if type(results) == tuple and len(results) == 2 :
            (code, arr) = results
        elif type(results) == list:
            arr = results

        if len(results) == 0:
            return res

        for item in arr:
            res.append( LDAPSearchResult(item) )

        return res


class LDAPSearchResult:
    from ldap.cidict import cidict
    import ldif
    from StringIO import StringIO

    dn = ''
    attrs = []

    def __init__(self, entry_tuple):
        """Create a new LDAPSearchResult object."""
        (dn, attrs) = entry_tuple
        if dn:
            self.dn = dn
        else:
            return

        self.attrs = self.cidict(attrs)

    def get_attributes(self):
        """Get a dictionary of all attributes.
        get_attributes()->{'name1':['value1','value2',...], 
                                'name2: [value1...]}
        """
        return self.attrs

    def set_attributes(self, attr_dict):
        """Set the list of attributes for this record.

        The format of the dictionary should be string key, list of
        string alues. e.g. {'cn': ['M Butcher','Matt Butcher']}

        set_attributes(attr_dictionary)
        """

        self.attrs = self.cidict(attr_dict)

    def has_attribute(self, attr_name):
        """Returns true if there is an attribute by this name in the
        record.

        has_attribute(string attr_name)->boolean
        """
        return self.attrs.has_key( attr_name )

    def get_attr_values(self, key):
        """Get a list of attribute values.
        get_attr_values(string key)->['value1','value2']
        """
        return self.attrs[key]

    def get_attr_names(self):
        """Get a list of attribute names.
        get_attr_names()->['name1','name2',...]
        """
        return self.attrs.keys()

    def get_dn(self):
        """Get the DN string for the record.
        get_dn()->string dn
        """
        return self.dn

                         
    def pretty_print(self):
        """Create a nice string representation of this object.

        pretty_print()->string
        """
        str = "DN: " + self.dn + "n"
        for a, v_list in self.attrs.iteritems():
            str = str + "Name: " + a + "n"
            for v in v_list:
                str = str + "  Value: " + v + "n"
        str = str + "========"
        return str

    def to_ldif(self):
        """Get an LDIF representation of this record.

        to_ldif()->string
        """
        out = self.StringIO()
        ldif_out = self.ldif.LDIFWriter(out)
        ldif_out.unparse(self.dn, self.attrs)
        return out.getvalue()
