// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./CompositePriceFeed.sol";
import "../Interfaces/IRETHToken.sol";
import "../Interfaces/IRETHPriceFeed.sol";

// import "forge-std/console2.sol";

contract RETHPriceFeed is CompositePriceFeed, IRETHPriceFeed {
    constructor(
        address _owner,
        address _ethUsdOracleAddress,
        address _rEthEthOracleAddress,
        address _rEthTokenAddress,
        uint256 _ethUsdStalenessThreshold,
        uint256 _rEthEthStalenessThreshold
    )
        CompositePriceFeed(
            _owner,
            _ethUsdOracleAddress,
            _rEthTokenAddress,
            _ethUsdStalenessThreshold
        )
    {
        // Store RETH-ETH oracle
        rEthEthOracle.aggregator = AggregatorV3Interface(_rEthEthOracleAddress);
        rEthEthOracle.stalenessThreshold = _rEthEthStalenessThreshold;
        rEthEthOracle.decimals = rEthEthOracle.aggregator.decimals();

    }
    
    Oracle public rEthEthOracle;

    function _fetchPrice() internal override returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);
        (uint256 rEthEthPrice, bool rEthEthOracleDown) = _getOracleAnswer(rEthEthOracle);

        // If the ETH-USD feed is down, shut down and switch to the last good price seen by the system
        // since we need the ETH-USD price for both calcs: 1) ETH-USD x RETH-ETH, and 2) ETH-USD x canonical
        if (ethUsdOracleDown) {return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);}
        // If the ETH-USD feed is live but the RETH-ETH oracle is down, shutdown and substitute RETH-ETH with the canonical rate
        if (rEthEthOracleDown) {return (_shutDownAndSwitchToETHUSDxCanonical(address(rEthEthOracle.aggregator), ethUsdPrice), true);}

        // Otherwise, use the primary price calculation:

        // Calculate the market LST-USD price: USD_per_LST = USD_per_ETH * ETH_per_LST
        uint256 lstUsdMarketPrice = ethUsdPrice * rEthEthPrice / 1e18;

        // Calculate the canonical LST-USD price: USD_per_LST = USD_per_ETH * ETH_per_LST
        // TODO: Should we also shutdown if the call to the canonical rate reverts, or returns 0?
        uint256 lstUsdCanonicalPrice = ethUsdPrice * _getCanonicalRate() / 1e18;

        // Take the minimum of (market, canonical) in order to mitigate against upward market price manipulation.
        // NOTE: only needed 
        uint256 lstUsdPrice = LiquityMath._min(lstUsdMarketPrice, lstUsdCanonicalPrice);

        lastGoodPrice = lstUsdPrice;

        return (lstUsdPrice, false);
    }
    function _getCanonicalRate() internal view override returns (uint256) {
        // RETHToken returns exchange rate with 18 digit decimal precision
        return IRETHToken(rateProviderAddress).getExchangeRate();
    }
}
