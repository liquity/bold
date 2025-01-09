#!/bin/bash

# Foundry coverage
forge coverage --report lcov --report-file lcov_foundry.info

# # Hardhat coverage
# NODE_OPTIONS="--max-old-space-size=16384" npx hardhat coverage

# # Remove path from contract names in Hardhat
# sed -i "s/SF:.*src/SF:src/g" coverage/lcov.info

# # Merge coverage reports
# lcov \
#     --rc lcov_branch_coverage=1 \
#     --add-tracefile lcov_foundry.info \
#     --add-tracefile coverage/lcov.info \
#     --output-file lcov_merged.info

# Instead of merge
cp lcov_foundry.info lcov_merged.info

lcov --remove lcov_merged.info -o lcov_merged.info \
     'test/*' \
     'script/*' \
     'src/Dependencies/Ownable.sol' \
     'src/Zappers/Modules/Exchanges/UniswapV3/UniPriceConverter.sol' \
     'src/NFTMetadata/*' \
     'src/MultiTroveGetter.sol' \
     'src/HintHelpers.sol'

genhtml lcov_merged.info --output-directory coverage
