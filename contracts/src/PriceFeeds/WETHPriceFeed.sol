// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./MainnetPriceFeedBase.sol";

// import "forge-std/console2.sol";

contract WETHPriceFeed is MainnetPriceFeedBase {
    constructor(address _ethUsdOracleAddress, uint256 _ethUsdStalenessThreshold, address _borrowerOperationsAddress)
        MainnetPriceFeedBase(_ethUsdOracleAddress, _ethUsdStalenessThreshold, _borrowerOperationsAddress)
    {
        _fetchPricePrimary();

        // Check the oracle didn't already fail
        assert(priceSource == PriceSource.primary);
    }

    function fetchPrice() public returns (uint256, bool) {
        // If branch is live and the primary oracle setup has been working, try to use it
        if (priceSource == PriceSource.primary) return _fetchPricePrimary();

        // Otherwise if branch is shut down and already using the lastGoodPrice, continue with it
        assert(priceSource == PriceSource.lastGoodPrice);
        return (lastGoodPrice, false);
    }

    function fetchRedemptionPrice() external returns (uint256, bool) {
        // Use same price for redemption as all other ops in WETH branch
        return fetchPrice();
    }

    //  _fetchPricePrimary returns:
    // - The price
    // - A bool indicating whether a new oracle failure was detected in the call
    function _fetchPricePrimary() internal returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 ethUsdPrice, bool ethUsdOracleDown) = _getOracleAnswer(ethUsdOracle);

        // If the ETH-USD Chainlink response was invalid in this transaction, return the last good ETH-USD price calculated
        if (ethUsdOracleDown) return (_shutDownAndSwitchToLastGoodPrice(address(ethUsdOracle.aggregator)), true);

        lastGoodPrice = ethUsdPrice;
        return (ethUsdPrice, false);
    }
}
