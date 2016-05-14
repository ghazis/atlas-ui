#!/bin/bash
source /opt/gt/utils/common.sh

cp ${SCRIPT_DIR}/atlas-webservice.service.example /usr/lib/systemd/system/atlas-webservice.service

mkdir -p /var/log/atlas-webservice/
mkdir -p /opt/gt/hive
mkdir -p /home/atlassvc/
chown atlassvc:atlassvc_sg /home/atlassvc
chmod 700 /home/atlassvc

ln -s /home/atlassvc/atlas /opt/gt/hive/atlas

chown atlassvc /var/log/atlas-webservice/
chown atlassvc -R ${SCRIPT_DIR}/../ 

systemctl enable atlas-webservice
systemctl start atlas-webservice

[[ $? -ne 0 ]] && echo "Seems like we had a little issue starting the service" && exit 1

exit 0
