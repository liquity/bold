// SPDX-License-Identifier: MIT
import "./IMainnetPriceFeed.sol";
import "../Dependencies/AggregatorV3Interface.sol";

pragma solidity ^0.8.0;

interface IWeETHPriceFeed is IMainnetPriceFeed {
    function weEthEthOracle() external view returns (AggregatorV3Interface, uint256, uint8);
}
