// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./MainnetPriceFeedBase.sol";

contract RSETHPriceFeed is MainnetPriceFeedBase {
    //RSETH feed on arbitrum.
    address public rsEthOracleAddress = 0x8fE61e9D74ab69cE9185F365dfc21FC168c4B56c; //RSETH/ETH
    Oracle public rsEthOracle;

    constructor(
        address _owner,
        address _ethUsdOracleAddress,
        address _rsEthOracleAddress,
        uint256 _ethUsdStalenessThreshold,
        uint256 _rsEthUsdStalenessThreshold
    ) MainnetPriceFeedBase(_owner, _ethUsdOracleAddress, _ethUsdStalenessThreshold) {
        rsEthOracle.aggregator = AggregatorV3Interface(_rsEthOracleAddress);
        rsEthOracle.stalenessThreshold = _rsEthUsdStalenessThreshold;
        rsEthOracle.decimals = 18;
        priceSource = PriceSource.primary;
        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function fetchRedemptionPrice() public returns (uint256, bool) {
        return fetchPrice();
    }

    function fetchPrice() public returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 rsEthPrice, bool rsEthOracleDown) = _getOracleAnswer(rsEthOracle);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);

        // If the ETH-USD Chainlink response was invalid in this transaction, return the last good rsETH-USD price calculated
        if (rsEthOracleDown) return (_shutDownAndSwitchToLastGoodPrice(address(rsEthOracle.aggregator)), true);
        if (ethUsdOracleDown) return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);

        // Calculate the canonical LST-USD price: USD_per_LST = USD_per_ETH * underlying_per_LST
        uint256 rsEthUsdPrice = ethUsdPrice * rsEthPrice / 1e18;

        lastGoodPrice = rsEthUsdPrice;
        return (rsEthUsdPrice, false);
    }
}