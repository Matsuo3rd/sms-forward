#!/bin/sh

CURRENT_DIR=$(dirname "$0")
NODE_PATH=$CURRENT_DIR

cd $CURRENT_DIR

. ./setenv.sh
node index.js
