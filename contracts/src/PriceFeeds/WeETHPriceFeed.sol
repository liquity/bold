// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

interface IWeETHOracle {
    function getExchangeRate() external view returns (uint256);
}

import "./MainnetPriceFeedBase.sol";

contract WeETHPriceFeed is MainnetPriceFeedBase {
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

    Oracle public weEthOracle;
    
    uint256 public constant WEETH_ETH_DEVIATION_THRESHOLD = 2e16; // 2%

    function _fetchPricePrimary(bool _isRedemption) internal override returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
        (uint256 weEthPrice, bool weEthOracleDown) = _getOracleAnswer(weEthOracle);

        //If either the ETH-USD feed or the weETH-ETH oracle is down, shut down and switch to the last good price
        //seen by the system since we need both for primary and fallback price calcs
        if (ethUsdOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);
        }
        if (weEthOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(weEthOracle.aggregator)), true);
        }

        // Otherwise, use the primary price calculation:

        // Calculate the market RETH-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 weEthUsdMarketPrice = ethUsdPrice * weEthPrice / 1e18;

        // Calculate the canonical LST-USD price: USD_per_RETH = USD_per_ETH * ETH_per_RETH
        uint256 weEthUsdCanonicalPrice = ethUsdPrice * weEthPerEth / 1e18;

        uint256 weEthUsdPrice;

        // If it's a redemption and canonical is within 2% of market, use the max to mitigate unwanted redemption oracle arb
        if (
            _isRedemption
                && _withinDeviationThreshold(xvsUsdMarketPrice, xvsUsdCanonicalPrice, XVS_ETH_DEVIATION_THRESHOLD)
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

        try IWeETHOracle(weEthOracle.aggregator).getExchangeRate() returns (uint256 weEthPerEth) {
            //If rate is 0, return true
            if (weEthPerEth == 0) return (0, true);

            return (xvsPerEth, false);
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


