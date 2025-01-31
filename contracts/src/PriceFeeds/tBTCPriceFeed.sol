// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

interface ItBTCOracle {
    function getExchangeRate() external view returns (uint256);
}

import "./MainnetPriceFeedBase.sol";

contract tBTCPriceFeed is MainnetPriceFeedBase {
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

    Oracle public tBTCETHOracle;
    
    uint256 public constant tBTC_ETH_DEVIATION_THRESHOLD = 2e16; // 2%

    function _fetchPricePrimary(bool _isRedemption) internal override returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
        (uint256 tBTCETHPrice, bool tBTCETHOracleDown) = _getOracleAnswer(tBTCETHOracle);

        //If either the ETH-USD feed or the tBTC-ETH oracle is down, shut down and switch to the last good price
        //seen by the system since we need both for primary and fallback price calcs
        if (ethUsdOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);
        }
        if (tBTCETHOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(tBTCETHOracle.aggregator)), true);
        }

        // Otherwise, use the primary price calculation:

        // Calculate the market RETH-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 tBTCUsdMarketPrice = ethUsdPrice * tBTCETHPrice / 1e18;

        // Calculate the canonical LST-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 tBTCUsdCanonicalPrice = ethUsdPrice * tBTCPerEth / 1e18;

        uint256 tBTCUsdPrice;

        // If it's a redemption and canonical is within 2% of market, use the max to mitigate unwanted redemption oracle arb
        if (
            _isRedemption
                && _withinDeviationThreshold(tBTCUsdMarketPrice, tBTCUsdCanonicalPrice, tBTC_ETH_DEVIATION_THRESHOLD)
        ) {
             tBTCUsdPrice = LiquityMath._max(tBTCUsdMarketPrice, tBTCUsdCanonicalPrice);
        } else {
            // Take the minimum of (market, canonical) in order to mitigate against upward market price manipulation.
            // Assumes a deviation between market <> canonical of >2% represents a legitimate market price difference.
            tBTCUsdPrice = LiquityMath._min(tBTCUsdMarketPrice, tBTCUsdCanonicalPrice);
        }

        lastGoodPrice = tBTCUsdPrice;

        return (tBTCUsdPrice, false);
    } 

     function _getCanonicalRate() internal view override returns (uint256, bool) {
        uint256 gasBefore = gasleft();

        try ItBTCOracle(tBTCETHOracle.aggregator).getExchangeRate() returns (uint256 tBTCPerEth) {
            //If rate is 0, return true
            if (tBTCPerEth == 0) return (0, true);

            return (tBTCPerEth, false);
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


