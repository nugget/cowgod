#!/bin/sh
rm -f /tmp/*.dmp

SECS=300

while [ 1 ]; do
	./plugpitbot.js --nick $1
	echo "waiting $SECS seconds to restart"
	sleep $SECS
done
