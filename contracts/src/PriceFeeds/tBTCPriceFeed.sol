// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;
 
import "./TokenPriceFeedBase.sol";

contract tBTCPriceFeed is TokenPriceFeedBase {
    Oracle public btcUsdOracle;
    uint256 public constant BTC_TBTC_DEVIATION_THRESHOLD = 2e16; // 2%

    constructor(
        address _owner, 
        address _tBTCUsdOracleAddress, 
        address _btcUsdOracleAddress,
        uint256 _tBTCUsdStalenessThreshold,
        uint256 _btcUsdStalenessThreshold
    ) TokenPriceFeedBase(_owner, _tBTCUsdOracleAddress, _tBTCUsdStalenessThreshold)
    {
        // Store BTC-USD oracle
        btcUsdOracle.aggregator = AggregatorV3Interface(_btcUsdOracleAddress);
        btcUsdOracle.stalenessThreshold = _btcUsdStalenessThreshold;
        btcUsdOracle.decimals = btcUsdOracle.aggregator.decimals();

        _fetchPricePrimary();

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function fetchPrice() public returns (uint256, bool) {
        // If branch is live and the primary oracle setup has been working, try to use it
        if (priceSource == PriceSource.primary) return _fetchPricePrimary();

        // Otherwise if branch is shut down and already using the lastGoodPrice, continue with it
        assert(priceSource == PriceSource.lastGoodPrice);
        return (lastGoodPrice, false);
    }

    function fetchRedemptionPrice() external returns (uint256, bool) {
        // If branch is shut down and already using the lastGoodPrice, return it
        if (priceSource == PriceSource.lastGoodPrice) {
            return (lastGoodPrice, false);
        }
        
        // Get tBTC price using the helper function - scaled to 18 decimals
        (uint256 tbtcPrice, bool tbtcOracleDown) = _getOracleAnswer(tokenUsdOracle);
        if (tbtcOracleDown) {
            // tBTC oracle is down or invalid answer
            return (_shutDownAndSwitchToLastGoodPrice(address(tokenUsdOracle.aggregator)), true);
        }
        
        // Get BTC price using the helper function - scaled to 18 decimals
        (uint256 btcPrice, bool btcOracleDown) = _getOracleAnswer(btcUsdOracle);
        if (btcOracleDown) {
            // BTC oracle is down or invalid answer
            return (_shutDownAndSwitchToLastGoodPrice(address(btcUsdOracle.aggregator)), true);
        }
        
        // Compare prices (within 2% of each other)
        // Instead of comparing tbtcPrice/btcPrice with fractions, we cross-multiply
        if (tbtcPrice >= btcPrice * 98 / 100 && tbtcPrice <= btcPrice * 102 / 100) {
            // If within 2%, use the higher price to prevent value leakage
            uint256 price = tbtcPrice > btcPrice ? tbtcPrice : btcPrice;
            lastGoodPrice = price;
            return (price, false);
        } else {
            // If significant depeg, use tBTC price
            lastGoodPrice = tbtcPrice;
            return (tbtcPrice, false);
        }
    }

    function _fetchPricePrimary() internal returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        
        (uint256 tokenUsdPrice, bool tokenUsdOracleDown) = _getOracleAnswer(tokenUsdOracle);
        
        // tBTC oracle is down or invalid answer
        if (tokenUsdOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(tokenUsdOracle.aggregator)), true);
        }
        
        lastGoodPrice = tokenUsdPrice;
        return (tokenUsdPrice, false);
    }
}   


