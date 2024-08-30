// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.18;

import "../../Dependencies/AggregatorV3Interface.sol";

// Mock Chainlink oracle that returns a stale price answer
contract ChainlinkOracleMock is AggregatorV3Interface {
    function decimals() external pure returns (uint8) {
        return 8;
    }

    function latestRoundData()
        external
        view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) {
        // returns a 2000 USD price, but it's stale
        int256 price = 2000e8;
        uint256 lastUpdateTime = block.timestamp - 7 days;

        return (0,price,0,lastUpdateTime,0);
    }
}