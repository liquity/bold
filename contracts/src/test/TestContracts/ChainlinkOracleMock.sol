// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "../../Dependencies/AggregatorV3Interface.sol";

// Mock Chainlink oracle that returns a stale price answer
contract ChainlinkOracleMock is AggregatorV3Interface {
    // Default price of 2000 
    int256 price = 2000e8;

    // Price is stale by default
    bool stale = true;

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        // 7 days old if stale, otherwise current time
        uint256 lastUpdateTime = stale ? block.timestamp - 7 days : block.timestamp;

        return (0, price, 0, lastUpdateTime, 0);
    }

    function setPriceAndStaleness(int256 _price, bool _isStale) external {
        price = _price;
        stale = _isStale;
    }
}
