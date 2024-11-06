// SPDX-License-Identifier: MIT
import "./IMainnetPriceFeed.sol";
import "../Dependencies/AggregatorV3Interface.sol";

pragma solidity ^0.8.0;

interface IRETHPriceFeed is IMainnetPriceFeed {
    function rEthEthOracle() external view returns (AggregatorV3Interface, uint256, uint8);
}
