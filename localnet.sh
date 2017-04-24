#!/usr/bin/env bash
# Run JorConsole with a local networking relay
#
# This script assumes you have the websockproxy running available from:
# https://github.com/benjamincburns/websockproxy
# To get started quickly with it:
#   docker run --privileged -p 8080:80 --name relay benjamincburns/jor1k-relay:latest
# To start the container at a later date:
#  docker start relay
#
MEMORY=128
RELAY=http://localhost:8080/
node index.js --network --relay=${RELAY} --memory=${MEMORY}
