// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./MainnetPriceFeedBase.sol";


contract WeETHPriceFeed is MainnetPriceFeedBase {
     constructor(
        address _owner,
        address _ethUsdOracleAddress,
        address _weEthEthOracleAddress,
        uint256 _ethUsdStalenessThreshold,
        uint256 _weEthEthStalenessThreshold
    ) MainnetPriceFeedBase(_owner, _ethUsdOracleAddress, _ethUsdStalenessThreshold) {
        // Store WeETH-ETH oracle
        weEthEthOracle.aggregator = AggregatorV3Interface(_weEthEthOracleAddress);
        weEthEthOracle.stalenessThreshold = _weEthEthStalenessThreshold;
        weEthEthOracle.decimals = weEthEthOracle.aggregator.decimals();
        priceSource = PriceSource.primary;
        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    Oracle public weEthEthOracle;

    function fetchRedemptionPrice() public returns (uint256, bool) {
        return fetchPrice();
    }

    function fetchPrice() public returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 weEthPrice, bool weEthOracleDown) = _getOracleAnswer(weEthEthOracle);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);

        // If the ETH-USD Chainlink response was invalid in this transaction, return the last good rsETH-USD price calculated
        if (weEthOracleDown) return (_shutDownAndSwitchToLastGoodPrice(address(weEthEthOracle.aggregator)), true);
        if (ethUsdOracleDown) return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);

        // Calculate the canonical LST-USD price: USD_per_LST = USD_per_ETH * underlying_per_LST
        uint256 weEthUsdPrice = ethUsdPrice * weEthPrice / 1e18;

        lastGoodPrice = weEthUsdPrice;
        return (weEthUsdPrice, false);
    }
    
}   


