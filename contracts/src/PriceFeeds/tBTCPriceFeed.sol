// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;


import "./TokenPriceFeedBase.sol";
import "../Dependencies/Constants.sol";

contract TBTCPriceFeed is TokenPriceFeedBase {
    Oracle public btcUsdOracle;
    Oracle public tBTCUsdOracle;

    uint256 public constant BTC_TBTC_DEVIATION_THRESHOLD = 2e16; // 2%
    
    constructor(
        address _owner, 
        address _tbtcUsdOracleAddress, 
        uint256 _tbtcUsdStalenessThreshold,
        address _btcUsdOracleAddress,
        uint256 _btcUsdStalenessThreshold
    )
        TokenPriceFeedBase(_owner, _tbtcUsdOracleAddress, _tbtcUsdStalenessThreshold)
    {
        // Store BTC-USD oracle
        btcUsdOracle.aggregator = AggregatorV3Interface(_btcUsdOracleAddress);
        btcUsdOracle.stalenessThreshold = _btcUsdStalenessThreshold;
        btcUsdOracle.decimals = btcUsdOracle.aggregator.decimals();

        // Store tBTC-USD oracle
        tBTCUsdOracle.aggregator = AggregatorV3Interface(_tbtcUsdOracleAddress);
        tBTCUsdOracle.stalenessThreshold = _tbtcUsdStalenessThreshold;
        tBTCUsdOracle.decimals = tBTCUsdOracle.aggregator.decimals();

        _fetchPricePrimary(false);

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function fetchPrice() public returns (uint256, bool) {
        // If branch is live and the primary oracle setup has been working, try to use it
        if (priceSource == PriceSource.primary) return _fetchPricePrimary(false);

        // Otherwise if branch is shut down and already using the lastGoodPrice, continue with it
        assert(priceSource == PriceSource.lastGoodPrice);
        return (lastGoodPrice, false);
    }

    function fetchRedemptionPrice() external returns (uint256, bool) {
        // Use same price for redemption as all other ops in tBTC branch
        // If branch is live and the primary oracle setup has been working, try to use it
        if (priceSource == PriceSource.primary) return _fetchPricePrimary(true);

        // Otherwise if branch is shut down and already using the lastGoodPrice, continue with it
        assert(priceSource == PriceSource.lastGoodPrice);
        return (lastGoodPrice, false);
    }

    function _fetchPricePrimary(bool _isRedemption) internal returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 tbtcUsdPrice, bool tbtcUsdOracleDown) = _getOracleAnswer(tBTCUsdOracle);
        (uint256 btcUsdPrice, bool btcOracleDown) = _getOracleAnswer(btcUsdOracle);

        if (tbtcUsdOracleDown && btcOracleDown) {
            // both oracles are down or invalid answer, use lastGoodPrice
            uint256 price = _shutDownAndSwitchToLastGoodPrice(address(tBTCUsdOracle.aggregator));
            // Emit events for both oracle failures (tBTC-USD emitted first already)
            emit ShutDownFromOracleFailure(address(btcUsdOracle.aggregator));
            return (price, true);
        } else if (tbtcUsdOracleDown) {
            // tBTC oracle is down or invalid answer, use BTC-USD
            lastGoodPrice = btcUsdPrice;
            return (_shutDownAndSwitchToLastGoodPrice(address(tBTCUsdOracle.aggregator)), true);
        } else if (btcOracleDown) {
            // BTC oracle is down or invalid answer, use tBTC-USD
            lastGoodPrice = tbtcUsdPrice;
            return (_shutDownAndSwitchToLastGoodPrice(address(btcUsdOracle.aggregator)), true);
        }

        // Otherwise, use the primary price calculation:
        if (_isRedemption && _withinDeviationThreshold(tbtcUsdPrice, btcUsdPrice, BTC_TBTC_DEVIATION_THRESHOLD)) {
            // If it's a redemption and within 2%, take the max of (tBTC-USD, BTC-USD) to prevent value leakage and convert to tBTC-USD
            tbtcUsdPrice = LiquityMath._max(tbtcUsdPrice, btcUsdPrice);
        }else{
            // Take the minimum of (market, canonical) in order to mitigate against upward market price manipulation.
            tbtcUsdPrice = LiquityMath._min(tbtcUsdPrice, btcUsdPrice);
        }

        // Otherwise, just use tBTC-USD price: USD_per_tBTC.
        lastGoodPrice = tbtcUsdPrice;
        return (tbtcUsdPrice, false);
    }

    function _withinDeviationThreshold(uint256 _priceToCheck, uint256 _referencePrice, uint256 _deviationThreshold)
        internal
        pure
        returns (bool)
    {
        // Calculate the price deviation of the oracle market price relative to the canonical price
        uint256 max = _referencePrice * (DECIMAL_PRECISION + _deviationThreshold) / 1e18;
        uint256 min = _referencePrice * (DECIMAL_PRECISION - _deviationThreshold) / 1e18;

        return _priceToCheck >= min && _priceToCheck <= max;
    }
}   


