// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./CompositePriceFeed.sol";
import "../Interfaces/IWSTETH.sol";
import "../Interfaces/IWSTETHPriceFeed.sol";

contract WSTETHPriceFeed is CompositePriceFeed, IWSTETHPriceFeed {
    Oracle public stEthUsdOracle;

    constructor(
        address _owner,
        address _ethUsdOracleAddress,
        address _stEthUsdOracleAddress,
        address _wstEthTokenAddress,
        uint256 _ethUsdStalenessThreshold,
        uint256 _stEthUsdStalenessThreshold
    ) CompositePriceFeed(_owner, _ethUsdOracleAddress, _wstEthTokenAddress, _ethUsdStalenessThreshold) {
        stEthUsdOracle.aggregator = AggregatorV3Interface(_stEthUsdOracleAddress);
        stEthUsdOracle.stalenessThreshold = _stEthUsdStalenessThreshold;
        stEthUsdOracle.decimals = stEthUsdOracle.aggregator.decimals();

        _fetchPricePrimary();

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function _fetchPricePrimary() internal override returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 stEthUsdPrice, bool stEthUsdOracleDown) = _getOracleAnswer(stEthUsdOracle);
        (uint256 stEthPerWstEth, bool exchangeRateIsDown) = _getCanonicalRate();

        // If exchange rate is down, shut down and switch to last good price - since we need this 
        // rate for all price calcs
        if (exchangeRateIsDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(stEthUsdOracle.aggregator)), true);
        }

        // If the STETH-USD feed is down, shut down and try to substitute it with the ETH-USD price
        if (stEthUsdOracleDown) {
            (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
            // If the ETH-USD feed is *also* down, shut down and return the last good price
            if (ethUsdOracleDown) {
                return (_shutDownAndSwitchToLastGoodPrice(address(stEthUsdOracle.aggregator)), true);
            } else {
                return (_shutDownAndSwitchToETHUSDxCanonical(address(stEthUsdOracle.aggregator), ethUsdPrice), true);
            }
        }

        // Otherwise, use the primary price calculation.   
        // Calculate WSTETH-USD price USD_per_WSTETH = USD_per_STETH * STETH_per_WSTETH
        uint256 wstEthUsdPrice = stEthUsdPrice * stEthPerWstEth / 1e18;
        lastGoodPrice = wstEthUsdPrice;

        return (wstEthUsdPrice, false);
    }

    function _getCanonicalRate() internal view override returns (uint256, bool) {
        try IWSTETH(rateProviderAddress).stEthPerToken() returns (uint256 stEthPerWstEth) {
            // If rate is 0, return true
            if (stEthPerWstEth == 0) return (0, true);

            return (stEthPerWstEth, false);
        } catch {
            // If call to exchange rate reverts, return true
            return (0, true);
        }  
    } 
}
