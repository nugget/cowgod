#!/bin/sh
git pull
cd plugbotapi
git fetch upstream
git merge upstream/master
git push
