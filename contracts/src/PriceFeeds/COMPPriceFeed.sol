// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

interface ICOMPOracle {
    function getExchangeRate() external view returns (uint256);
}

import "./MainnetPriceFeedBase.sol";

contract COMPPriceFeed is MainnetPriceFeedBase {
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

    Oracle public compEthOracle;
    
    uint256 public constant COMP_ETH_DEVIATION_THRESHOLD = 2e16; // 2%

    function _fetchPricePrimary(bool _isRedemption) internal override returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
        (uint256 compEthPrice, bool compEthOracleDown) = _getOracleAnswer(compEthOracle);

        //If either the ETH-USD feed or the COMP-ETH oracle is down, shut down and switch to the last good price
        //seen by the system since we need both for primary and fallback price calcs
        if (ethUsdOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);
        }
        if (compEthOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(compEthOracle.aggregator)), true);
        }

        // Otherwise, use the primary price calculation:

        // Calculate the market RETH-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 compUsdMarketPrice = ethUsdPrice * compEthPrice / 1e18;

        // Calculate the canonical LST-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 compUsdCanonicalPrice = ethUsdPrice * compPerEth / 1e18;

        uint256 compUsdPrice;

        // If it's a redemption and canonical is within 2% of market, use the max to mitigate unwanted redemption oracle arb
        if (
            _isRedemption
                && _withinDeviationThreshold(compUsdMarketPrice, compUsdCanonicalPrice, COMP_ETH_DEVIATION_THRESHOLD)
        ) {
             compUsdPrice = LiquityMath._max(compUsdMarketPrice, compUsdCanonicalPrice);
        } else {
            // Take the minimum of (market, canonical) in order to mitigate against upward market price manipulation.
            // Assumes a deviation between market <> canonical of >2% represents a legitimate market price difference.
            compUsdPrice = LiquityMath._min(compUsdMarketPrice, compUsdCanonicalPrice);
        }

        lastGoodPrice = compUsdPrice;
    
        return (compUsdPrice, false);
    } 

     function _getCanonicalRate() internal view override returns (uint256, bool) {
        uint256 gasBefore = gasleft();

        try ICOMPOracle(compEthOracle.aggregator).getExchangeRate() returns (uint256 compPerEth) {
            //If rate is 0, return true
            if (compPerEth == 0) return (0, true);

            return (compPerEth, false);
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


