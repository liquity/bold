// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

// Mock token that uses all available gas on exchange rate calls.
// This contract code is etched over LST token addresses in mainnet fork tests.
// Has exchange rate functions for WSTETH and RETH.
contract GasGuzzlerToken {
    uint256 pointlessStorageVar = 42;

    // RETH exchange rate getter
    function getExchangeRate() external view returns (uint256) {
        // Expensive SLOAD loop that hits the block gas limit before completing
        for (uint256 i = 0; i < 1000000; i++) {
            uint256 unusedVar = pointlessStorageVar + i;
        }
        return 11e17;
    }

    // WSTETH exchange rate getter
    function stEthPerToken() external view returns (uint256) {
        // Expensive SLOAD loop that hits the block gas limit before completing
        for (uint256 i = 0; i < 1000000; i++) {
            uint256 unusedVar = pointlessStorageVar + i;
        }
        return 11e17;
    }
}
