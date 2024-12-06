// SPDX-License-Identifier: MIT
import "../Interfaces/IPriceFeed.sol";
import "../Dependencies/AggregatorV3Interface.sol";

pragma solidity ^0.8.0;

interface IChainlinkPriceFeed is IPriceFeed {
    enum PriceSource {
        primary,
        lastGoodPrice
    }

    function usdOracle()
        external
        view
        returns (AggregatorV3Interface, uint256, uint8);
    function priceSource() external view returns (PriceSource);
}
