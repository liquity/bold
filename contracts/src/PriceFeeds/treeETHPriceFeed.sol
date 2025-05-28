// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;


import "./CompositePriceFeed.sol";
import "../Interfaces/ITreeETHProvider.sol";
import "../Interfaces/ITreeETHPriceFeed.sol";


contract TreeETHPriceFeed is CompositePriceFeed, ITreeETHPriceFeed {
    constructor(
        address _owner,
        address _ethUsdOracleAddress,
        address _treeEthEthOracleAddress,
        address _treeEthRateProvider,
        uint256 _ethUsdStalenessThreshold,
        uint256 _treeEthEthStalenessThreshold
    ) CompositePriceFeed(_owner, _ethUsdOracleAddress, _treeEthRateProvider, _ethUsdStalenessThreshold) {
        // Store TreeETH-ETH oracle
        treeEthEthOracle.aggregator = AggregatorV3Interface(_treeEthEthOracleAddress);
        treeEthEthOracle.stalenessThreshold = _treeEthEthStalenessThreshold;
        treeEthEthOracle.decimals = treeEthEthOracle.aggregator.decimals();

        _fetchPricePrimary(false);

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    Oracle public treeEthEthOracle;

    uint256 public constant TREEETH_ETH_DEVIATION_THRESHOLD = 2e16; // 2%

    function _fetchPricePrimary(bool _isRedemption) internal override returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
        (uint256 treeEthEthPrice, bool treeEthEthOracleDown) = _getOracleAnswer(treeEthEthOracle);
        (uint256 treeEthPerEth, bool exchangeRateIsDown) = _getCanonicalRate();

        // If either the ETH-USD feed or exchange rate is down, shut down and switch to the last good price
        // seen by the system since we need both for primary and fallback price calcs
        if (ethUsdOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);
        }
        if (exchangeRateIsDown) {
            return (_shutDownAndSwitchToLastGoodPrice(rateProviderAddress), true);
        }
        // If the ETH-USD feed is live but the TreeETH-ETH oracle is down, shutdown and substitute TreeETH-ETH with the canonical rate
        if (treeEthEthOracleDown) {
            return (_shutDownAndSwitchToETHUSDxCanonical(address(treeEthEthOracle.aggregator), ethUsdPrice), true);
        }

        // Otherwise, use the primary price calculation:

        // Calculate the market TreeETH-USD price: USD_per_TreeETH = USD_per_ETH * ETH_per_TreeETH
        uint256 treeEthUsdMarketPrice = ethUsdPrice * treeEthEthPrice / 1e18;

        // Calculate the canonical LST-USD price: USD_per_TreeETH = USD_per_ETH * ETH_per_TreeETH
        uint256 treeEthUsdCanonicalPrice = ethUsdPrice * treeEthPerEth / 1e18;

        uint256 treeEthUsdPrice;

        // If it's a redemption and canonical is within 2% of market, use the max to mitigate unwanted redemption oracle arb
        if (
            _isRedemption
                && _withinDeviationThreshold(treeEthUsdMarketPrice, treeEthUsdCanonicalPrice, TREEETH_ETH_DEVIATION_THRESHOLD)
        ) {
            treeEthUsdPrice = LiquityMath._max(treeEthUsdMarketPrice, treeEthUsdCanonicalPrice);
        } else {
            // Take the minimum of (market, canonical) in order to mitigate against upward market price manipulation.
            // Assumes a deviation between market <> canonical of >2% represents a legitimate market price difference.
            treeEthUsdPrice = LiquityMath._min(treeEthUsdMarketPrice, treeEthUsdCanonicalPrice);
        }

        lastGoodPrice = treeEthUsdPrice;

        return (treeEthUsdPrice, false);
    }

    function _getCanonicalRate() internal view override returns (uint256, bool) {
        uint256 gasBefore = gasleft();

        try ITreeETHProvider(rateProviderAddress).getRate() returns (uint256 ethPerTreeEth) {
            // If rate is 0, return true
            if (ethPerTreeEth == 0) return (0, true);

            return (ethPerTreeEth, false);
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


