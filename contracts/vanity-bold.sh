#!/bin/bash

# Exit on failure
#set -e

i=0
while [ "$i" -le 100000 ]; do
    if [ $((i % 1000)) -eq 0 ]; then
        echo $i
    fi
    export SALT=beBOLD$i
    S=$(forge script script/VanityBold.s.sol --chain-id 1 --rpc-url http://localhost:8545)
    #echo S: $S
    #cat ./bold-address.json
    #echo
    grep -i b01d ./bold-address.json
    R=$?
    #echo R: $R
    if [[ "$R" -eq 0 ]]; then
       echo "Found!"
       echo $SALT
       cat ./bold-address.json
       echo
    fi;
    i=$((i+1))
done;
