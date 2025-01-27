// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "src/Dependencies/AggregatorV3Interface.sol";

// Mock oracle that consumes all gas in the price getter.
// this contract code is etched over mainnet oracle addresses in mainnet fork tests.
contract GasGuzzlerOracle is AggregatorV3Interface {
    uint8 decimal;

    int256 price;

    uint256 lastUpdateTime;

    uint256 pointlessStorageVar = 42;

    // We use 8 decimals unless set to 18
    function decimals() external view returns (uint8) {
        return decimal;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        // Expensive SLOAD loop that hits the block gas limit before completing
        for (uint256 i = 0; i < 1000000; i++) {
            uint256 unusedVar = pointlessStorageVar + i;
        }

        return (0, price, 0, lastUpdateTime, 0);
    }

    function setDecimals(uint8 _decimals) external {
        decimal = _decimals;
    }

    function setPrice(int256 _price) external {
        price = _price;
    }

    function setUpdatedAt(uint256 _updatedAt) external {
        lastUpdateTime = _updatedAt;
    }
}
