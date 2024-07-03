pragma solidity 0.8.18;

import "../Dependencies/Ownable.sol";
import "../Dependencies/AggregatorV3Interface.sol";
import "../Interfaces/IPriceFeed.sol";

// import "forge-std/console2.sol";

abstract contract MainnetPriceFeedBase is IPriceFeed {
    
    // Dummy flag raised when the collateral branch gets shut down. 
    // Should be removed after actual shutdown logic is implemented.
    bool shutdownFlag;

    // Last good price tracker for the derived USD price
    uint256 public lastGoodPrice;

    struct Oracle {
        AggregatorV3Interface aggregator;
        uint256 stalenessThreshold;
        uint8 decimals;
    }

    struct ChainlinkResponse {
        uint80 roundId;
        int256 answer;
        uint256 timestamp;
        bool success;
    } 

    function _fetchPrice(Oracle memory _oracle) 
        internal 
        returns (uint256, bool) {
        ChainlinkResponse memory chainlinkResponse = _getCurrentChainlinkResponse(_oracle.aggregator);

        uint256 scaledPrice;
        bool isShutdown;

        // Check oracle is serving an up-to-date and sensible price. If not, shut down this collateral branch.
        if (!_isValidChainlinkPrice(chainlinkResponse, _oracle.stalenessThreshold)) {
            // TODO: Call into collateral registry and shut down this branch.
            shutdownFlag = true;
            isShutdown = true;
        } else {
            scaledPrice = _scaleChainlinkPriceTo18decimals(chainlinkResponse.answer, _oracle.decimals);
        }

        return (scaledPrice, isShutdown);
    }

    function _getCurrentChainlinkResponse(AggregatorV3Interface _aggregator) 
        internal 
        view 
        returns (ChainlinkResponse memory chainlinkResponse) 
    {
        // Secondly, try to get latest price data:
        try _aggregator.latestRoundData() returns (
            uint80 roundId, int256 answer, uint256, /* startedAt */ uint256 timestamp, uint80 /* answeredInRound */
        ) {
            // If call to Chainlink succeeds, return the response and success = true
            chainlinkResponse.roundId = roundId;
            chainlinkResponse.answer = answer;
            chainlinkResponse.timestamp = timestamp;
            chainlinkResponse.success = true;

            return chainlinkResponse;
        } catch {
            // If call to Chainlink aggregator reverts, return a zero response with success = false
            return chainlinkResponse;
        }
    }

    // False if:
    // - Call to Chainlink aggregator reverts
    // - price is too stale, i.e. older than the oracle's staleness threshold
    // - Price answer is 0 or negative
    function _isValidChainlinkPrice(ChainlinkResponse memory chainlinkResponse, uint256 _stalenessThreshold) 
    internal view returns (bool) 
    {
        return
            chainlinkResponse.success && 
            block.timestamp - chainlinkResponse.timestamp < _stalenessThreshold &&
            chainlinkResponse.answer > 0;
    }

    // Trust assumption: Chainlink won't change the decimal precision on any feed used in v2 after deployment
    function _scaleChainlinkPriceTo18decimals(int256 _price, uint256 _decimals) internal pure returns (uint256) {
        // Scale an int price to a uint with 18 decimals
        return uint256(_price) * 10 ** (18 - _decimals);
    }
}