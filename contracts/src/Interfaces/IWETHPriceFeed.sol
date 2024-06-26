// SPDX-License-Identifier: MIT
import "./IPriceFeed.sol";

pragma solidity 0.8.18;

interface IWETHPriceFeed is IPriceFeed {
    function getEthUsdStalenessThreshold() external view returns (uint256);
}