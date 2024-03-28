#!/usr/bin/env sh

set -e

DEFAULT_LOCAL_DEPLOYER="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
TENDERLY_DEVNET_FLAGS="--project project --template liquity2"

if [ -f .env ]; then
    source ./.env
fi

FORGE_FLAGS=""
INTRO=""

function print_usage {
    echo "" 1>&2
    echo "Usage:" 1>&2
    echo "" 1>&2
    echo "  ./deploy.sh <local | tenderly-devnet | mainnet>" 1>&2
    echo "" 1>&2
    echo "Environment variables (can be set in a .env file):" 1>&2
    echo "  " 1>&2
    echo "  CHAIN_ID:           Chain ID to deploy to (optional)" 1>&2
    echo "  RPC_URL:            RPC URL to use (optional)" 1>&2
    echo "  DEPLOYER:           Address or private key to deploy with (optional with local)" 1>&2
    echo "  DEPLOYER_PATH:      HD path to use with the ledger (optional, only used when DEPLOYER is an address)" 1>&2
    echo "  ETHERSCAN_API_KEY:  Etherscan API key for contracts verification (mainnet only)" 1>&2
    echo "  OPEN_DEMO_TROVES:   Set to 1 to open demo troves after deployment (defaults to 0, local only)" 1>&2
    echo "" 1>&2
}

if [[ "$1" == "" ]]; then
    print_usage
    exit 0
fi

# ./deploy.sh local
if [[ "$1" == "local" ]]; then
    INTRO="Deploying to local…"

    if [[ -z "$CHAIN_ID" ]]; then
        export CHAIN_ID="31337"
    fi
    if [[ -z "$RPC_URL" ]]; then
        export RPC_URL="http://localhost:8545"
    fi
    if [[ -z "$DEPLOYER" ]]; then
        export DEPLOYER=$DEFAULT_LOCAL_DEPLOYER
    fi

# ./deploy.sh tenderly-devnet
elif [[ "$1" == "tenderly-devnet" ]]; then
    INTRO="Deploying to Tenderly Devnet…"

    if [[ -z "$CHAIN_ID" ]]; then
        export CHAIN_ID="1"
    fi
    if [[ -z "$RPC_URL" ]]; then
        export RPC_URL=$(tenderly devnet spawn-rpc $TENDERLY_DEVNET_FLAGS 2>&1)
    fi

# ./deploy.sh mainnet
elif [[ "$1" == "mainnet" ]]; then
    INTRO="Deploying to mainnet…"

    if [[ -z "$CHAIN_ID" ]]; then
        export CHAIN_ID="1"
    fi
    if [[ -z "$RPC_URL" ]]; then
        echo "" 1>&2
        echo "RPC_URL not set, please provide a valid RPC URL" 1>&2
        exit 1
    fi
    if [[ -n "$ETHERSCAN_API_KEY" ]]; then
        FORGE_FLAGS="$FORGE_FLAGS --verify --etherscan-api-key $ETHERSCAN_API_KEY"
    fi

else
    echo "" 1>&2
    echo "Please provide a valid network." 1>&2
    print_usage
    exit 1
fi

# No DEPLOYER set, exit
if [ -z "$DEPLOYER" ]; then
    echo "" 1>&2
    echo "Please set DEPLOYER to an address or a private key" 1>&2
    echo "" 1>&2
    exit 1
fi

# When DEPLOYER is an address, sign with ledger
if [[ $(echo -n $DEPLOYER | wc -c) == 42 ]]; then
    FORGE_FLAGS="$FORGE_FLAGS --ledger $DEPLOYER --sender $DEPLOYER"

    # If DEPLOYER_PATH is set, use it
    if [[ -n "$DEPLOYER_PATH" ]]; then
        FORGE_FLAGS="$FORGE_FLAGS --hd-paths $DEPLOYER_PATH"
    fi
fi

# No OPEN_DEMO_TROVES set, default to 0
if [[ -z "$OPEN_DEMO_TROVES" ]]; then
    export OPEN_DEMO_TROVES="0"
fi

echo "" 1>&2
echo "$INTRO" 1>&2
echo "" 1>&2
echo "Environment:" 1>&2
echo "  " 1>&2
echo "  CHAIN_ID:           ${CHAIN_ID:="none"}" 1>&2
echo "  DEPLOYER:           ${DEPLOYER:="none"}" 1>&2
echo "  DEPLOYER_PATH:      ${DEPLOYER_PATH:="none"}" 1>&2
echo "  ETHERSCAN_API_KEY:  ${ETHERSCAN_API_KEY:="none"}" 1>&2
echo "  OPEN_DEMO_TROVES:   ${OPEN_DEMO_TROVES:="none"}" 1>&2
echo "  RPC_URL:            ${RPC_URL:="none"}" 1>&2
echo "" 1>&2

forge script \
    scripts/DeployLiquity2.s.sol:DeployLiquity2Script \
    --chain-id $CHAIN_ID \
    --rpc-url $RPC_URL \
    --broadcast \
    $FORGE_FLAGS \
    -vvvv

CONTRACTS_JQ_SELECTOR='[inputs .transactions[] | select(.transactionType == "CREATE") | [.contractName, .contractAddress]][] | @tsv'
CONTRACTS=$(cat broadcast/DeployLiquity2.s.sol/$CHAIN_ID/run-latest.json | jq --null-input --raw-output "$CONTRACTS_JQ_SELECTOR")
CONTRACTS=$(echo "$CONTRACTS" | sort | awk '{printf ("%-20s %s\n", $1, $2)}')

echo "" 1>&2
echo "Contracts deployed:" 1>&2
echo "" 1>&2
echo "$CONTRACTS" 1>&2
echo "" 1>&2
