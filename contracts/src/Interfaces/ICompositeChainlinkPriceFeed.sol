// SPDX-License-Identifier: MIT
import "./IChainlinkPriceFeed.sol";
import "../Dependencies/AggregatorV3Interface.sol";

pragma solidity ^0.8.0;

interface ICompositeChainlinkPriceFeed is IChainlinkPriceFeed {
    function tokenEthOracle()
        external
        view
        returns (AggregatorV3Interface, uint256, uint8);
}
