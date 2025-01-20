#!/bin/bash

# Exit on failure
#set -e

# Solidity script fails with `EvmError: MemoryOOG` with too many iterations
export ITERATIONS=100000

i=0
while [ "$i" -le 100000 ]; do
    echo $i

    export START_INDEX=$((i * ITERATIONS))
    #forge script script/VanityBold.s.sol --chain-id 1 --rpc-url http://localhost:8545
    forge script script/VanityBold.s.sol --chain-id $CHAIN_ID --rpc-url $ETH_RPC_URL

    grep -i b01d ./bold-address.json
    R=$?
    #echo R: $R
    if [[ "$R" -eq 0 ]]; then
       echo "Found!"
       echo $SALT
       cat ./bold-address.json
       echo
       exit 0
    fi;
    i=$((i+1))
done;
