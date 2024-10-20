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

        _fetchPricePrimary(false);

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function _fetchPricePrimary(bool _isRedemption) internal override returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 stEthUsdPrice, bool stEthUsdOracleDown) = _getOracleAnswer(stEthUsdOracle);
        (uint256 stEthPerWstEth, bool exchangeRateIsDown) = _getCanonicalRate();
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);

        // - If exchange rate or ETH-USD is down, shut down and switch to last good price. Reasoning:
        // - Exchange rate is used in all price calcs
        // - ETH-USD is used in the fallback calc, and for redemptions in the primary price calc
        if (exchangeRateIsDown || ethUsdOracleDown) {
            return (_shutDownAndSwitchToLastGoodPrice(address(stEthUsdOracle.aggregator)), true);
        }

        // If the STETH-USD feed is down, shut down and try to substitute it with the ETH-USD price
        if (stEthUsdOracleDown) {
            return (_shutDownAndSwitchToETHUSDxCanonical(address(stEthUsdOracle.aggregator), ethUsdPrice), true);
        }

        // Otherwise, use the primary price calculation:
        uint256 wstEthUsdPrice;

        if (_isRedemption) { 
            // If it's a redemption, take the max of (STETH-USD, ETH-USD) and convert to WSTETH-USD
            wstEthUsdPrice = LiquityMath._max(stEthUsdPrice, ethUsdPrice) * stEthPerWstEth / 1e18;
        } else {
            // Otherwise, just calculate WSTETH-USD price: USD_per_WSTETH = USD_per_STETH * STETH_per_WSTETH
            wstEthUsdPrice = stEthUsdPrice * stEthPerWstEth / 1e18;
        }

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
