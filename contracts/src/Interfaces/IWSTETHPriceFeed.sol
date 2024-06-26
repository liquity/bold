// SPDX-License-Identifier: MIT
import "./IPriceFeed.sol";

pragma solidity 0.8.18;

interface IWSTETHPriceFeed is IPriceFeed {
    function getStEthUsdStalenessThreshold() external view returns (uint256);
}