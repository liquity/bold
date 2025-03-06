#!/usr/bin/env bash

# rm -f bold-address.json; CHAIN_ID=1 ETH_RPC_URL=http://localhost:8545 ./vanity-bold.sh

start_time=$(date +%s)

# Exit on failure
#set -e

# Solidity script fails with `EvmError: MemoryOOG` with too many iterations
export ITERATIONS=100000

if [[ -z $CHAIN_ID ]]; then
    echo CHAIN_ID env var is needed
    exit 1
fi;
if [[ -z $ETH_RPC_URL ]]; then
    echo ETH_RPC_URL env var is needed
    exit 1
fi;
if [[ -z $DEPLOYER ]]; then
    echo DEPLOYER env var is needed
    exit 1
fi;
if [[ -z $SALT ]]; then
    export SALT=beBOLD
fi;

echo Base salt to be used: $SALT

i=0
while [ "$i" -le 100000 ]; do
    echo $i

    export START_INDEX=$((i * ITERATIONS))
    #forge script script/VanityBold.s.sol --chain-id 1 --rpc-url http://localhost:8545
    forge script script/VanityBold.s.sol --chain-id $CHAIN_ID --rpc-url $ETH_RPC_URL 2>/dev/null

    grep -E "0x[bB]01[dD]\w+[bB]01[dD]" ./bold-address.json
    R=$?
    #echo R: $R
    if [[ "$R" -eq 0 ]]; then
       echo "Found!"
       cat ./bold-address.json
       echo
       break
    fi;
    i=$((i+1))
done;

end_time=$(date +%s)
time_elapsed=$((end_time - start_time))
hours=$((time_elapsed / 3600))
minutes=$(( (time_elapsed % 3600) / 60 ))
seconds=$((time_elapsed % 60))
echo "Time elapsed: $hours hours $minutes minutes $seconds seconds"
