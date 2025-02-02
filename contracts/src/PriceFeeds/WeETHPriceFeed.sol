// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./CompositePriceFeed.sol";
import "../Interfaces/IWeETHToken.sol";
import "../Interfaces/IWeETHPriceFeed.sol";


contract WeETHPriceFeed is CompositePriceFeed, IWeETHPriceFeed {
     constructor(
        address _owner,
        address _ethUsdOracleAddress,
        address _weEthEthOracleAddress,
        address _weEthTokenAddress,
        uint256 _ethUsdStalenessThreshold,
        uint256 _weEthEthStalenessThreshold
    ) CompositePriceFeed(_owner, _ethUsdOracleAddress, _weEthTokenAddress, _ethUsdStalenessThreshold) {
        // Store WeETH-ETH oracle
        weEthEthOracle.aggregator = AggregatorV3Interface(_weEthEthOracleAddress);
        weEthEthOracle.stalenessThreshold = _weEthEthStalenessThreshold;
        weEthEthOracle.decimals = weEthEthOracle.aggregator.decimals();

        _fetchPricePrimary(false);

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    Oracle public weEthEthOracle;

    uint256 public constant WEETH_ETH_DEVIATION_THRESHOLD = 2e16; // 2%

    function _fetchPricePrimary(bool _isRedemption) internal override returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
        (uint256 weEthEthPrice, bool weEthEthOracleDown) = _getOracleAnswer(weEthEthOracle);
        (uint256 weEthPerEth, bool exchangeRateIsDown) = _getCanonicalRate();

        // If either the ETH-USD feed or exchange rate is down, shut down and switch to the last good price
        // seen by the system since we need both for primary and fallback price calcs
        if (ethUsdOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);
        }
        if (exchangeRateIsDown) {
            return (_shutDownAndSwitchToLastGoodPrice(rateProviderAddress), true);
        }
        // If the ETH-USD feed is live but the WeETH-ETH oracle is down, shutdown and substitute WeETH-ETH with the canonical rate
        if (weEthEthOracleDown) {
            return (_shutDownAndSwitchToETHUSDxCanonical(address(weEthEthOracle.aggregator), ethUsdPrice), true);
        }

        // Otherwise, use the primary price calculation:

        // Calculate the market WeETH-USD price: USD_per_WeETH = USD_per_ETH * ETH_per_WeETH
        uint256 weEthUsdMarketPrice = ethUsdPrice * weEthEthPrice / 1e18;

        // Calculate the canonical LST-USD price: USD_per_WeETH = USD_per_ETH * ETH_per_WeETH
        uint256 weEthUsdCanonicalPrice = ethUsdPrice * weEthPerEth / 1e18;

        uint256 weEthUsdPrice;

        // If it's a redemption and canonical is within 2% of market, use the max to mitigate unwanted redemption oracle arb
        if (
            _isRedemption
                && _withinDeviationThreshold(weEthUsdMarketPrice, weEthUsdCanonicalPrice, WEETH_ETH_DEVIATION_THRESHOLD)
        ) {
            weEthUsdPrice = LiquityMath._max(weEthUsdMarketPrice, weEthUsdCanonicalPrice);
        } else {
            // Take the minimum of (market, canonical) in order to mitigate against upward market price manipulation.
            // Assumes a deviation between market <> canonical of >2% represents a legitimate market price difference.
            weEthUsdPrice = LiquityMath._min(weEthUsdMarketPrice, weEthUsdCanonicalPrice);
        }

        lastGoodPrice = weEthUsdPrice;

        return (weEthUsdPrice, false);
    }

    function _getCanonicalRate() internal view override returns (uint256, bool) {
        uint256 gasBefore = gasleft();

        try IWeETHToken(rateProviderAddress).getExchangeRate() returns (uint256 ethPerWeEth) {
            // If rate is 0, return true
            if (ethPerWeEth == 0) return (0, true);

            return (ethPerWeEth, false);
        } catch {
            // Require that enough gas was provided to prevent an OOG revert in the external call
            // causing a shutdown. Instead, just revert. Slightly conservative, as it includes gas used
            // in the check itself.
            if (gasleft() <= gasBefore / 64) revert InsufficientGasForExternalCall();

            // If call to exchange rate reverts, return true
            return (0, true);
        }
    }
}   


