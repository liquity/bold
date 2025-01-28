// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./MainnetPriceFeedBase.sol";

contract UNIPriceFeed is MainnetPriceFeedBase {
    constructor(address _owner, address _uniUsdOracleAddress, uint256 _uniUsdStalenessThreshold)
        MainnetPriceFeedBase(_owner, _uniUsdOracleAddress, _uniUsdStalenessThreshold)
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