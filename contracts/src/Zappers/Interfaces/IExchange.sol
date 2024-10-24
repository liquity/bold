// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IExchange {
    function swapFromBold(uint256 _boldAmount, uint256 _minCollAmount) external;

    function swapToBold(uint256 _collAmount, uint256 _minBoldAmount) external returns (uint256);
}
