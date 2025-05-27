// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./CollateralPriceFeedBase.sol";

// import "forge-std/console2.sol";

contract CollateralPriceFeed is CollateralPriceFeedBase {
    constructor(address _owner, address _oracleAddress, uint256 _oracleStalenessThreshold)
        CollateralPriceFeedBase(_owner, _oracleAddress, _oracleStalenessThreshold)
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
        return fetchPrice();
    }

    //  _fetchPricePrimary returns:
    // - The price
    // - A bool indicating whether a new oracle failure was detected in the call
    function _fetchPricePrimary() internal returns (uint256, bool) {
        assert(priceSource == PriceSource.primary);
        (uint256 collateralUsdPrice, bool isOracleDown) = _getOracleAnswer(tokenUsdOracle);

        // If the ETH-USD Chainlink response was invalid in this transaction, return the last good ETH-USD price calculated
        if (isOracleDown) return (_shutDownAndSwitchToLastGoodPrice(address(tokenUsdOracle.aggregator)), true);

        lastGoodPrice = collateralUsdPrice;
        return (collateralUsdPrice, false);
    }
}
