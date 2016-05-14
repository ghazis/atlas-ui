#!/bin/bash
source /opt/gt/utils/common.sh


systemctl stop atlas-webservice
systemctl disable atlas-webservice

rm -f /usr/lib/systemd/system/atlas-webservice.service
rm -f /opt/gt/hive/atlas
rm -rf /home/atlassvc
rm -rf /var/log/atlas-webservice

exit 0
