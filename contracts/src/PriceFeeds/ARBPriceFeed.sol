// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

interface IARBOracle {
    function getExchangeRate() external view returns (uint256);
}

import "./MainnetPriceFeedBase.sol";

contract ARBPriceFeed is MainnetPriceFeedBase {
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

    Oracle public arbEthOracle;
    
    uint256 public constant ARB_ETH_DEVIATION_THRESHOLD = 2e16; // 2%

    function _fetchPricePrimary(bool _isRedemption) internal override returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
        (uint256 arbEthPrice, bool arbEthOracleDown) = _getOracleAnswer(arbEthOracle);

        //If either the ETH-USD feed or the ARB-ETH oracle is down, shut down and switch to the last good price
        //seen by the system since we need both for primary and fallback price calcs
        if (ethUsdOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);
        }
        if (arbEthOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(arbEthOracle.aggregator)), true);
        }

        // Otherwise, use the primary price calculation:

        // Calculate the market RETH-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 arbUsdMarketPrice = ethUsdPrice * arbEthPrice / 1e18;

        // Calculate the canonical LST-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 arbUsdCanonicalPrice = ethUsdPrice * arbPerEth / 1e18;

        uint256 arbUsdPrice;

        // If it's a redemption and canonical is within 2% of market, use the max to mitigate unwanted redemption oracle arb
        if (
            _isRedemption
                && _withinDeviationThreshold(xvsUsdMarketPrice, xvsUsdCanonicalPrice, XVS_ETH_DEVIATION_THRESHOLD)
        ) {
             arbUsdPrice = LiquityMath._max(arbUsdMarketPrice, arbUsdCanonicalPrice);
        } else {
            // Take the minimum of (market, canonical) in order to mitigate against upward market price manipulation.
            // Assumes a deviation between market <> canonical of >2% represents a legitimate market price difference.
            arbUsdPrice = LiquityMath._min(arbUsdMarketPrice, arbUsdCanonicalPrice);
        }

        lastGoodPrice = arbUsdPrice;

        return (arbUsdPrice, false);
    } 

     function _getCanonicalRate() internal view override returns (uint256, bool) {
        uint256 gasBefore = gasleft();

        try IARBOracle(arbEthOracle.aggregator).getExchangeRate() returns (uint256 arbPerEth) {
            //If rate is 0, return true
            if (arbPerEth == 0) return (0, true);

            return (arbPerEth, false);
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


