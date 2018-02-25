export NODE_HOME="/Serveurs/node-v6.9.1-darwin-x64"

PATH=$PATH:$NODE_HOME/bin
#export CURRENT_DIR=$PWD
CURRENT_DIR=$(dirname "$0")

if [[ ! -d $NODE_HOME ]] ; then
    echo 'NODE_HOME not found. Define NODE_HOME in setenv.sh to NodeJS directory'
    exit
fi
