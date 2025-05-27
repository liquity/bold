// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;
 
import "./CompositePriceFeed.sol";


contract tBTCPriceFeed is CompositePriceFeed {
    Oracle public btcUsdOracle;
    Oracle public tBTCUsdOracle;

    uint256 public constant BTC_TBTC_DEVIATION_THRESHOLD = 2e16; // 2%

    constructor(
        address _owner, 
        address _tBTCUsdOracleAddress, 
        address _btcUsdOracleAddress,
        uint256 _tBTCUsdStalenessThreshold,
        uint256 _btcUsdStalenessThreshold
    ) CompositePriceFeed(_owner, _tBTCUsdOracleAddress, _btcUsdOracleAddress, _tBTCUsdStalenessThreshold)
    {
        // Store BTC-USD oracle
        btcUsdOracle.aggregator = AggregatorV3Interface(_btcUsdOracleAddress);
        btcUsdOracle.stalenessThreshold = _btcUsdStalenessThreshold;
        btcUsdOracle.decimals = btcUsdOracle.aggregator.decimals();

        // Store tBTC-USD oracle
        tBTCUsdOracle.aggregator = AggregatorV3Interface(_tBTCUsdOracleAddress);
        tBTCUsdOracle.stalenessThreshold = _tBTCUsdStalenessThreshold;
        tBTCUsdOracle.decimals = tBTCUsdOracle.aggregator.decimals();

        _fetchPricePrimary(false);

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function _fetchPricePrimary(bool _isRedemption) internal override returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 tbtcUsdPrice, bool tbtcUsdOracleDown) = _getOracleAnswer(tBTCUsdOracle);
        (uint256 btcUsdPrice, bool btcOracleDown) = _getOracleAnswer(btcUsdOracle);
        
        // tBTC oracle is down or invalid answer
        if (tbtcUsdOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(tBTCUsdOracle.aggregator)), true);
        }

        // BTC oracle is down or invalid answer
        if (btcOracleDown) {
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

    function _getCanonicalRate() internal view override returns (uint256, bool) {
        return (1 * 10 ** 18, false); // always return 1 BTC per tBTC by default.
    }
}   


