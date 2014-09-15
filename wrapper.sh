#!/bin/sh

while [ 1 ]; do
	./plugpitbot.js --nick $1
	sleep 60
done
