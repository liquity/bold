// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

interface IOsTokenVaultController {
    function convertToAssets(uint256 shares) external view returns (uint256);
}
