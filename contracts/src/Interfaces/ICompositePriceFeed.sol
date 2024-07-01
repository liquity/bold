// SPDX-License-Identifier: MIT
import "./IPriceFeed.sol";

pragma solidity 0.8.18;

interface ICompositePriceFeed is IPriceFeed {
    function getLstEthStalenessThreshold() external view returns (uint256);
    function getEthUsdStalenessThreshold() external view returns (uint256);
}