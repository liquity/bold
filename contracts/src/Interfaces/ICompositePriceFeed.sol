// SPDX-License-Identifier: MIT
import "../Interfaces/IPriceFeed.sol";
import "../Dependencies/AggregatorV3Interface.sol";

pragma solidity 0.8.18;

interface ICompositePriceFeed is IPriceFeed {
    function ethUsdOracle() external view returns (AggregatorV3Interface, uint256, uint8);
    function lstEthOracle() external view returns (AggregatorV3Interface, uint256, uint8);
}