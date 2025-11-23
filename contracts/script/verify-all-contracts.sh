#!/bin/bash

# Verification script for all contracts in prod-run.json on Saga EVM
# Usage: ./script/verify-all-contracts.sh [contract_name]
# If contract_name is provided, only that contract type will be verified
# Otherwise, all contracts will be verified

RPC_URL="https://sagaevm.jsonrpc.sagarpc.io"
VERIFIER="blockscout"
VERIFIER_URL="https://api-sagaevm.sagaexplorer.io/api/"
PROD_RUN_JSON="prod-run.json"

# Map contract names to their source file paths
get_contract_path() {
    local contract_name=$1
    case "$contract_name" in
        "BoldToken")
            echo "src/BoldToken.sol:BoldToken"
            ;;
        "WrappedToken")
            echo "src/ERC20Wrappers/WrappedToken.sol:WrappedToken"
            ;;
        "AddressesRegistry")
            echo "src/AddressesRegistry.sol:AddressesRegistry"
            ;;
        "CollateralRegistry")
            echo "src/CollateralRegistry.sol:CollateralRegistry"
            ;;
        "HintHelpers")
            echo "src/HintHelpers.sol:HintHelpers"
            ;;
        "MultiTroveGetter")
            echo "src/MultiTroveGetter.sol:MultiTroveGetter"
            ;;
        "FixedAssetReader")
            echo "src/NFTMetadata/utils/FixedAssets.sol:FixedAssetReader"
            ;;
        "MetadataNFT")
            echo "src/NFTMetadata/MetadataNFT.sol:MetadataNFT"
            ;;
        "WETHPriceFeed")
            echo "src/PriceFeeds/WETHPriceFeed.sol:WETHPriceFeed"
            ;;
        "yETHPriceFeed")
            echo "src/PriceFeeds/yETHPriceFeed.sol:yETHPriceFeed"
            ;;
        "yUSDPriceFeed")
            echo "src/PriceFeeds/yUSDPriceFeed.sol:yUSDPriceFeed"
            ;;
        "KINGPriceFeed")
            echo "src/PriceFeeds/KINGPriceFeed.sol:KINGPriceFeed"
            ;;
        "SAGAPriceFeed")
            echo "src/PriceFeeds/SAGAPriceFeed.sol:SAGAPriceFeed"
            ;;
        "stATOMPriceFeed")
            echo "src/PriceFeeds/stATOMPriceFeed.sol:stATOMPriceFeed"
            ;;
        "TBTCPriceFeed")
            echo "src/PriceFeeds/tBTCPriceFeed.sol:TBTCPriceFeed"
            ;;
        "BorrowerOperations")
            echo "src/BorrowerOperations.sol:BorrowerOperations"
            ;;
        "TroveManager")
            echo "src/TroveManager.sol:TroveManager"
            ;;
        "TroveNFT")
            echo "src/TroveNFT.sol:TroveNFT"
            ;;
        "StabilityPool")
            echo "src/StabilityPool.sol:StabilityPool"
            ;;
        "ActivePool")
            echo "src/ActivePool.sol:ActivePool"
            ;;
        "DefaultPool")
            echo "src/DefaultPool.sol:DefaultPool"
            ;;
        "GasPool")
            echo "src/GasPool.sol:GasPool"
            ;;
        "CollSurplusPool")
            echo "src/CollSurplusPool.sol:CollSurplusPool"
            ;;
        "SortedTroves")
            echo "src/SortedTroves.sol:SortedTroves"
            ;;
        "GasCompZapper")
            echo "src/Zappers/GasCompZapper.sol:GasCompZapper"
            ;;
        "WrappedTokenZapper")
            echo "src/Zappers/WrappedTokenZapper.sol:WrappedTokenZapper"
            ;;
        *)
            echo ""
            ;;
    esac
}

verify_contract() {
    local contract_name=$1
    local contract_address=$2
    local contract_path=$3
    
    if [ -z "$contract_path" ]; then
        echo "⚠ Skipping $contract_name at $contract_address (no source path mapping)"
        return 1
    fi
    
    echo "=========================================="
    echo "Verifying $contract_name"
    echo "Address: $contract_address"
    echo "Path: $contract_path"
    echo "=========================================="
    
    forge verify-contract \
        --rpc-url "$RPC_URL" \
        --verifier "$VERIFIER" \
        --verifier-url "$VERIFIER_URL" \
        "$contract_address" \
        "$contract_path"
    
    if [ $? -eq 0 ]; then
        echo "✓ Successfully verified $contract_name at $contract_address"
    else
        echo "✗ Failed to verify $contract_name at $contract_address"
    fi
    echo ""
}

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq first."
    exit 1
fi

# Check if prod-run.json exists
if [ ! -f "$PROD_RUN_JSON" ]; then
    echo "Error: $PROD_RUN_JSON not found in current directory"
    exit 1
fi

# Extract all contracts from JSON
contracts=$(jq -r '.transactions[] | select(.contractName != null) | "\(.contractName)|\(.contractAddress)"' "$PROD_RUN_JSON" | sort -u)

if [ -z "$contracts" ]; then
    echo "No contracts found in $PROD_RUN_JSON"
    exit 1
fi

# Count total contracts
total=$(echo "$contracts" | wc -l | tr -d ' ')
echo "Found $total contracts to verify"
echo ""

# Check if a specific contract type was requested
if [ -n "$1" ]; then
    filtered_contracts=$(echo "$contracts" | grep "^$1|")
    if [ -z "$filtered_contracts" ]; then
        echo "No contracts found matching: $1"
        echo "Available contract types:"
        echo "$contracts" | cut -d'|' -f1 | sort -u
        exit 1
    fi
    contracts="$filtered_contracts"
    count=$(echo "$contracts" | wc -l | tr -d ' ')
    echo "Verifying $count instances of $1"
    echo ""
fi

# Track success/failure counts
success_count=0
failure_count=0
skipped_count=0

# Verify each contract
while IFS='|' read -r contract_name contract_address; do
    contract_path=$(get_contract_path "$contract_name")
    
    if [ -z "$contract_path" ]; then
        echo "⚠ Skipping $contract_name at $contract_address (no source path mapping)"
        skipped_count=$((skipped_count + 1))
        continue
    fi
    
    if verify_contract "$contract_name" "$contract_address" "$contract_path"; then
        success_count=$((success_count + 1))
    else
        failure_count=$((failure_count + 1))
    fi
    
    # Small delay to avoid rate limiting
    sleep 1
done <<< "$contracts"

# Print summary
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo "Total contracts: $total"
echo "Successfully verified: $success_count"
echo "Failed: $failure_count"
echo "Skipped (no mapping): $skipped_count"
echo "=========================================="

