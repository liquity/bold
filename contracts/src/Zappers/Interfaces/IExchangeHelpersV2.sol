// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IExchangeHelpersV2 {
    function getDy(uint256 _dx, bool _collToBold, address _collToken) external returns (uint256 dy);
    function getDx(uint256 _dy, bool _collToBold, address _collToken) external returns (uint256 dx);
}
