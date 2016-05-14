#!/bin/bash
#
#	Deploy script that gets executed on commit. Takes one argument, which branch to use.
#	The rest are steps that should be executed to finish deploy
#

. /opt/gt/utils/common.sh
branch=${1:master}
RC=0

su - atlassvc -c "cd ~/atlas/; git reset --hard; git fetch --all; git checkout ${branch}; git reset --hard; git pull;"
RC=$((RC+$?))
systemctl restart atlas-webservice
RC=$((RC+$?))

[[ ${RC} -ne 0 ]] && logger -s -t atlas-webservice "critical_error: Ran into issue while deploying service"

exit ${RC}

