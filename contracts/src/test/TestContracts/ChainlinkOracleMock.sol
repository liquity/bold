pragma solidity 0.8.18;

import "../../Dependencies/AggregatorV3Interface.sol";

// Mock Chainlink oracle that returns a stale price answer
contract ChainlinkOracleMock is AggregatorV3Interface {
    function decimals() external view returns (uint8) {
        return 8;
    }

    function description() external view returns (string memory) {
        return "Mock CL oracle";
    }
    function version() external view returns (uint256) {
        return 1;
    }
    
    // Not used in v2
    function getRoundData(uint80 _roundId)
        external
        view
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) {
        return (0,0,0,0,0);
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