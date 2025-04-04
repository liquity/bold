// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./CompositePriceFeed.sol";
import "../Interfaces/IRETHToken.sol";
import "../Interfaces/IRETHPriceFeed.sol";

// import "forge-std/console2.sol";

contract RETHPriceFeed is CompositePriceFeed, IRETHPriceFeed {
    constructor(
        address _ethUsdOracleAddress,
        address _rEthEthOracleAddress,
        address _rEthTokenAddress,
        uint256 _ethUsdStalenessThreshold,
        uint256 _rEthEthStalenessThreshold,
        address _borrowerOperationsAddress
    )
        CompositePriceFeed(_ethUsdOracleAddress, _rEthTokenAddress, _ethUsdStalenessThreshold, _borrowerOperationsAddress)
    {
        // Store RETH-ETH oracle
        rEthEthOracle.aggregator = AggregatorV3Interface(_rEthEthOracleAddress);
        rEthEthOracle.stalenessThreshold = _rEthEthStalenessThreshold;
        rEthEthOracle.decimals = rEthEthOracle.aggregator.decimals();

        _fetchPricePrimary(false);

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    Oracle public rEthEthOracle;

    uint256 public constant RETH_ETH_DEVIATION_THRESHOLD = 2e16; // 2%

    function _fetchPricePrimary(bool _isRedemption) internal override returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
        (uint256 rEthEthPrice, bool rEthEthOracleDown) = _getOracleAnswer(rEthEthOracle);
        (uint256 ethPerReth, bool exchangeRateIsDown) = _getCanonicalRate();

        // If either the ETH-USD feed or exchange rate is down, shut down and switch to the last good price
        // seen by the system since we need both for primary and fallback price calcs
        if (ethUsdOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);
        }
        if (exchangeRateIsDown) {
            return (_shutDownAndSwitchToLastGoodPrice(rateProviderAddress), true);
        }
        // If the ETH-USD feed is live but the RETH-ETH oracle is down, shutdown and substitute RETH-ETH with the canonical rate
        if (rEthEthOracleDown) {
            return (_shutDownAndSwitchToETHUSDxCanonical(address(rEthEthOracle.aggregator), ethUsdPrice), true);
        }

        // Otherwise, use the primary price calculation:

        // Calculate the market RETH-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 rEthUsdMarketPrice = ethUsdPrice * rEthEthPrice / 1e18;

        // Calculate the canonical LST-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 rEthUsdCanonicalPrice = ethUsdPrice * ethPerReth / 1e18;

        uint256 rEthUsdPrice;

        // If it's a redemption and canonical is within 2% of market, use the max to mitigate unwanted redemption oracle arb
        if (
            _isRedemption
                && _withinDeviationThreshold(rEthUsdMarketPrice, rEthUsdCanonicalPrice, RETH_ETH_DEVIATION_THRESHOLD)
        ) {
            rEthUsdPrice = LiquityMath._max(rEthUsdMarketPrice, rEthUsdCanonicalPrice);
        } else {
            // Take the minimum of (market, canonical) in order to mitigate against upward market price manipulation.
            // Assumes a deviation between market <> canonical of >2% represents a legitimate market price difference.
            rEthUsdPrice = LiquityMath._min(rEthUsdMarketPrice, rEthUsdCanonicalPrice);
        }

        lastGoodPrice = rEthUsdPrice;

        return (rEthUsdPrice, false);
    }

    function _getCanonicalRate() internal view override returns (uint256, bool) {
        uint256 gasBefore = gasleft();

        try IRETHToken(rateProviderAddress).getExchangeRate() returns (uint256 ethPerReth) {
            // If rate is 0, return true
            if (ethPerReth == 0) return (0, true);

            return (ethPerReth, false);
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
