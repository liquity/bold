// SPDX-License-Identifier: MIT
import "./IPriceFeed.sol";

pragma solidity 0.8.18;

interface IRETHPriceFeed is IPriceFeed {
    function getREthEthStalenessThreshold() external view returns (uint256);
}