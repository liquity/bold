// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./MainnetPriceFeedBase.sol";

contract COMPPriceFeed is MainnetPriceFeedBase {
    constructor(address _owner, address _compUsdOracleAddress, uint256 _compUsdStalenessThreshold)
        MainnetPriceFeedBase(_owner, _compUsdOracleAddress, _compUsdStalenessThreshold)
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