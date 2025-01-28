// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./MainnetPriceFeedBase.sol";

contract ARBPriceFeed is MainnetPriceFeedBase {
    constructor(address _owner, address _arbUsdOracleAddress, uint256 _arbUsdStalenessThreshold)
        MainnetPriceFeedBase(_owner, _arbUsdOracleAddress, _arbUsdStalenessThreshold)
    {
        _fetchPricePrimary();
        assert(priceSource == PriceSource.primary);
    }

    function fetchPrice() public returns (uint256, bool) {
        if (priceSource == PriceSource.primary) return _fetchPricePrimary();
        assert(priceSource == PriceSource.lastGoodPrice);
        return (lastGoodPrice, false);
    }

    function fetchRedemptionPrice() external returns (uint256, bool) {
        return fetchPrice();
    }
} 