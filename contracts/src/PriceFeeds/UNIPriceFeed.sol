// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

interface IUNIOracle {
    function getExchangeRate() external view returns (uint256);
}

import "./MainnetPriceFeedBase.sol";

contract UNIPriceFeed is MainnetPriceFeedBase {
    constructor(
        address _owner, 
        address _ethUsdOracleAddress, 
        uint256 _ethUsdStalenessThreshold
        ) MainnetPriceFeedBase(
            _owner, 
            _ethUsdOracleAddress, 
            _ethUsdStalenessThreshold) 
        {

        }

    Oracle public uniEthOracle;
    
    uint256 public constant UNI_ETH_DEVIATION_THRESHOLD = 2e16; // 2%

    function _fetchPricePrimary(bool _isRedemption) internal override returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
        (uint256 uniEthPrice, bool uniEthOracleDown) = _getOracleAnswer(uniEthOracle);

        //If either the ETH-USD feed or the UNI-ETH oracle is down, shut down and switch to the last good price
        //seen by the system since we need both for primary and fallback price calcs
        if (ethUsdOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);
        }
        if (uniEthOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(uniEthOracle.aggregator)), true);
        }

        // Otherwise, use the primary price calculation:

        // Calculate the market RETH-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 uniUsdMarketPrice = ethUsdPrice * uniEthPrice / 1e18;

        // Calculate the canonical LST-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 uniUsdCanonicalPrice = ethUsdPrice * uniPerEth / 1e18;

        uint256 uniUsdPrice;

        // If it's a redemption and canonical is within 2% of market, use the max to mitigate unwanted redemption oracle arb
        if (
            _isRedemption
                && _withinDeviationThreshold(uniUsdMarketPrice, uniUsdCanonicalPrice, UNI_ETH_DEVIATION_THRESHOLD)
        ) {
             uniUsdPrice = LiquityMath._max(uniUsdMarketPrice, uniUsdCanonicalPrice);
        } else {
            // Take the minimum of (market, canonical) in order to mitigate against upward market price manipulation.
            // Assumes a deviation between market <> canonical of >2% represents a legitimate market price difference.
            uniUsdPrice = LiquityMath._min(uniUsdMarketPrice, uniUsdCanonicalPrice);
        }

        lastGoodPrice = uniUsdPrice;

        return (uniUsdPrice, false);
    } 

     function _getCanonicalRate() internal view override returns (uint256, bool) {
        uint256 gasBefore = gasleft();

        try IUNIOracle(uniEthOracle.aggregator).getExchangeRate() returns (uint256 uniPerEth) {
            //If rate is 0, return true
            if (uniPerEth == 0) return (0, true);

            return (uniPerEth, false);
        } catch {
            //Require that enough gas was provided to prevent an OOG revert in the external call
            //causing a shutdown. Instead, just revert. Slightly conservative, as it includes gas used
            //in the check itself.
            if (gasleft() <= gasBefore / 64) revert InsufficientGasForExternalCall();

            //If call to exchange rate reverts, return true
            return (0, true);
        }
    }
}   


