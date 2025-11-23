#!/bin/bash

# Verification script for GasCompZapper contracts on Saga EVM
# Usage: ./script/verify-gas-comp-zappers.sh [branch_number]
# If branch_number is provided, only that branch will be verified
# Otherwise, all branches will be verified

RPC_URL="https://sagaevm.jsonrpc.sagarpc.io"
VERIFIER="blockscout"
VERIFIER_URL="https://api-sagaevm.sagaexplorer.io/api/"
CONTRACT_PATH="src/Zappers/GasCompZapper.sol:GasCompZapper"

# Branch 0
BRANCH_0="0x31A2552006B47a77c10b18FDe3AC35ba2b1c09a0"

# Branch 1 - yETH
BRANCH_1="0x2e0128f8D160455d1Bd90dD7160251F2c4aeeC2d"

# Branch 2
BRANCH_2="0xcC17Aaa404D76358B84a414735F0d7eDa59f6ad8"

# Branch 3 - wSAGA
BRANCH_3="0x6b258B4B90374F618baC5E53AE716dcA187993e6"

# Branch 4 - wstATOM
BRANCH_4="0x361B49bC440Ba50708FF5afC92d2f3048433BFfb"

# Branch 5
BRANCH_5="0x1b2443dF05c8ACA7301825D4A1FBCD0D7Ac09B14"

# Branch 6 - yUSD
BRANCH_6="0xb9cECd6801cFcaBE477A9968d0dd389b42a957AF"

verify_contract() {
    local branch_name=$1
    local contract_address=$2
    
    echo "=========================================="
    echo "Verifying $branch_name"
    echo "Address: $contract_address"
    echo "=========================================="
    
    forge verify-contract \
        --rpc-url "$RPC_URL" \
        --verifier "$VERIFIER" \
        --verifier-url "$VERIFIER_URL" \
        "$contract_address" \
        "$CONTRACT_PATH"
    
    if [ $? -eq 0 ]; then
        echo "✓ Successfully verified $branch_name"
    else
        echo "✗ Failed to verify $branch_name"
    fi
    echo ""
}

# Check if a specific branch was requested
if [ -n "$1" ]; then
    case "$1" in
        0)
            verify_contract "Branch 0" "$BRANCH_0"
            ;;
        1)
            verify_contract "Branch 1 - yETH" "$BRANCH_1"
            ;;
        2)
            verify_contract "Branch 2" "$BRANCH_2"
            ;;
        3)
            verify_contract "Branch 3 - wSAGA" "$BRANCH_3"
            ;;
        4)
            verify_contract "Branch 4 - wstATOM" "$BRANCH_4"
            ;;
        5)
            verify_contract "Branch 5" "$BRANCH_5"
            ;;
        6)
            verify_contract "Branch 6 - yUSD" "$BRANCH_6"
            ;;
        *)
            echo "Invalid branch number: $1"
            echo "Usage: $0 [branch_number]"
            echo "Branch numbers: 0, 1, 2, 3, 4, 5, 6"
            exit 1
            ;;
    esac
else
    # Verify all branches
    verify_contract "Branch 0" "$BRANCH_0"
    verify_contract "Branch 1 - yETH" "$BRANCH_1"
    verify_contract "Branch 2" "$BRANCH_2"
    verify_contract "Branch 3 - wSAGA" "$BRANCH_3"
    verify_contract "Branch 4 - wstATOM" "$BRANCH_4"
    verify_contract "Branch 5" "$BRANCH_5"
    verify_contract "Branch 6 - yUSD" "$BRANCH_6"
fi

echo "=========================================="
echo "Verification process completed"
echo "=========================================="

