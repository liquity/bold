// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;


import "./TokenPriceFeedBase.sol";
import "../Dependencies/Constants.sol";

contract FBTCPriceFeed is TokenPriceFeedBase {
    Oracle public btcUsdOracle;
    Oracle public fbtcUsdOracle;

    uint256 public constant BTC_FBTC_DEVIATION_THRESHOLD = 2e16; // 2%
    
    constructor(
        address _owner, 
        address _fbtcUsdOracleAddress, 
        uint256 _fbtcUsdStalenessThreshold,
        address _btcUsdOracleAddress,
        uint256 _btcUsdStalenessThreshold
    )
        TokenPriceFeedBase(_owner, _fbtcUsdOracleAddress, _fbtcUsdStalenessThreshold)
    {
        // Store BTC-USD oracle
        btcUsdOracle.aggregator = AggregatorV3Interface(_btcUsdOracleAddress);
        btcUsdOracle.stalenessThreshold = _btcUsdStalenessThreshold;
        btcUsdOracle.decimals = btcUsdOracle.aggregator.decimals();

        // Store FBTC-USD oracle
        fbtcUsdOracle.aggregator = AggregatorV3Interface(_fbtcUsdOracleAddress);
        fbtcUsdOracle.stalenessThreshold = _fbtcUsdStalenessThreshold;
        fbtcUsdOracle.decimals = fbtcUsdOracle.aggregator.decimals();

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
        // Use same price for redemption as all other ops in FBTC branch
        return _fetchPricePrimary(true);
    }

    function _fetchPricePrimary(bool _isRedemption) internal returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 fbtcUsdPrice, bool fbtcUsdOracleDown) = _getOracleAnswer(fbtcUsdOracle);
        (uint256 btcUsdPrice, bool btcOracleDown) = _getOracleAnswer(btcUsdOracle);

        if (fbtcUsdOracleDown && btcOracleDown) {
            // both oracles are down or invalid answer, use lastGoodPrice
            uint256 price = _shutDownAndSwitchToLastGoodPrice(address(fbtcUsdOracle.aggregator));
            // Emit events for both oracle failures (FBTC-USD emitted first already)
            emit ShutDownFromOracleFailure(address(btcUsdOracle.aggregator));
            return (price, true);
        } else if (fbtcUsdOracleDown) {
            // FBTC oracle is down or invalid answer, use BTC-USD
            lastGoodPrice = btcUsdPrice;
            return (_shutDownAndSwitchToLastGoodPrice(address(fbtcUsdOracle.aggregator)), true);
        } else if (btcOracleDown) {
            // BTC oracle is down or invalid answer, use FBTC-USD
            lastGoodPrice = fbtcUsdPrice;
            return (_shutDownAndSwitchToLastGoodPrice(address(btcUsdOracle.aggregator)), true);
        }

        // Otherwise, use the primary price calculation:
        if (_isRedemption && _withinDeviationThreshold(fbtcUsdPrice, btcUsdPrice, BTC_FBTC_DEVIATION_THRESHOLD)) {
            // If it's a redemption and within 2%, take the max of (FBTC-USD, BTC-USD) to prevent value leakage and convert to FBTC-USD
            fbtcUsdPrice = LiquityMath._max(fbtcUsdPrice, btcUsdPrice);
        }else{
            // Take the minimum of (market, canonical) in order to mitigate against upward market price manipulation.
            fbtcUsdPrice = LiquityMath._min(fbtcUsdPrice, btcUsdPrice);
        }

        // Otherwise, just use FBTC-USD price: USD_per_FBTC.
        lastGoodPrice = fbtcUsdPrice;
        return (fbtcUsdPrice, false);
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


