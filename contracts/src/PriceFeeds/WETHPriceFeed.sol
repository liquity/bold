// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./MainnetPriceFeedBase.sol";
import "../Interfaces/IWETHPriceFeed.sol";

// import "forge-std/console2.sol";

contract WETHPriceFeed is MainnetPriceFeedBase, IWETHPriceFeed {
    Oracle public ethUsdOracle;

    constructor(address _owner, address _ethUsdOracleAddress, uint256 _ethUsdStalenessThreshold)
        MainnetPriceFeedBase(_owner)
    {
        ethUsdOracle.aggregator = AggregatorV3Interface(_ethUsdOracleAddress);
        ethUsdOracle.stalenessThreshold = _ethUsdStalenessThreshold;
        ethUsdOracle.decimals = ethUsdOracle.aggregator.decimals();

        // Check ETH-USD aggregator has the expected 8 decimals
        assert(ethUsdOracle.decimals == 8);

        _fetchPrice();

        // Check the oracle didn't already fail
        assert(priceFeedDisabled == false);
    }

    function _fetchPrice() internal override returns (uint256, bool) {
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);

        // If the Chainlink response was invalid in this transaction, return the last good ETH-USD price calculated
        if (ethUsdOracleDown) {return (_disableFeedAndShutDown(address(ethUsdOracle.aggregator)), true);}

        lastGoodPrice = ethUsdPrice;

        return (ethUsdPrice, false);
    }
}
