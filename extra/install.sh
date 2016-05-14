#!/bin/bash
source /opt/gt/utils/common.sh

cd ${SCRIPT_DIR}
RC=0

NAME=atlas
USER=${NAME}svc
GROUP=${USER}_sg
REPO="ssh://git@code.genevatrading.com:7999/hive/atlas.git"

TARGET_DIR=$(realpath "${SCRIPT_DIR}/../")

mkdir -p /opt/gt/hive

mkdir -p /var/log/${NAME}-webservice/
chown ${USER} /var/log/${NAME}-webservice/

RC=$((RC+$?))

ln -s ${TARGET_DIR} /opt/gt/hive/${NAME}

cp ${SCRIPT_DIR}/${NAME}-webservice.service.example /usr/lib/systemd/system/${NAME}-webservice.service
systemctl enable ${NAME}-webservice
systemctl start ${NAME}-webservice
RC=$((RC+$?))

[[ ${RC} -ne 0 ]] && echo "Seems like we had a little issue starting the service"
exit ${RC}
