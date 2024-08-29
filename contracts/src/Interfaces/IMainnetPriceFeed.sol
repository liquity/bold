// SPDX-License-Identifier: MIT
import "../Interfaces/IPriceFeed.sol";
import "../Dependencies/AggregatorV3Interface.sol";

pragma solidity ^0.8.0;

interface IMainnetPriceFeed is IPriceFeed {
     function ethUsdOracle() external view returns (AggregatorV3Interface, uint256, uint8);
}
