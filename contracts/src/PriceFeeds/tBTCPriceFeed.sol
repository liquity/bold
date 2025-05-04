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
        
        // Get tBTC price
        ChainlinkResponse memory tbtcResponse = _getCurrentChainlinkResponse(tokenUsdOracle.aggregator);
        if (!_isValidChainlinkPrice(tbtcResponse, tokenUsdOracle.stalenessThreshold)) {
            // tBTC oracle is down
            return (_shutDownAndSwitchToLastGoodPrice(address(tokenUsdOracle.aggregator)), true);
        }
        
        // Get BTC price
        ChainlinkResponse memory btcResponse = _getCurrentChainlinkResponse(btcUsdOracle.aggregator);
        if (!_isValidChainlinkPrice(btcResponse, btcUsdOracle.stalenessThreshold)) {
            // BTC oracle is down
            return (_shutDownAndSwitchToLastGoodPrice(address(btcUsdOracle.aggregator)), true);
        }
        
        // Scale both prices to 18 decimals
        uint256 tbtcPrice = _scaleChainlinkPriceTo18decimals(tbtcResponse.answer, tokenUsdOracle.decimals);
        uint256 btcPrice = _scaleChainlinkPriceTo18decimals(btcResponse.answer, btcUsdOracle.decimals);
        
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
        
        ChainlinkResponse memory response = _getCurrentChainlinkResponse(tokenUsdOracle.aggregator);
        if (!_isValidChainlinkPrice(response, tokenUsdOracle.stalenessThreshold)) {
            return (_shutDownAndSwitchToLastGoodPrice(address(tokenUsdOracle.aggregator)), true);
        }
        
        uint256 tokenUsdPrice = _scaleChainlinkPriceTo18decimals(response.answer, tokenUsdOracle.decimals);
        lastGoodPrice = tokenUsdPrice;
        return (tokenUsdPrice, false);
    }
}   


