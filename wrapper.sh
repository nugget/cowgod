#!/bin/sh
rm -f /tmp/*.dmp

while [ 1 ]; do
	./plugpitbot.js --nick $1
	echo "waiting 60 seconds to restart"
	sleep 60
done
