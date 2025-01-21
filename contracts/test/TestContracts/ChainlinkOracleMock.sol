// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "src/Dependencies/AggregatorV3Interface.sol";

// Mock Chainlink oracle that returns a stale price answer.
// this contract code is etched over mainnet oracle addresses in mainnet fork tests.
contract ChainlinkOracleMock is AggregatorV3Interface {
    uint8 decimal;

    int256 price;

    uint256 lastUpdateTime;

    // We use 8 decimals unless set to 18
    function decimals() external view returns (uint8) {
        return decimal;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        // console2.log(lastUpdateTime, "lastUpdateTime");
        // console2.log(block.timestamp, "block.timestamp");
        // console2.log(price, "price returned by oracle");
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
