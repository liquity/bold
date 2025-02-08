// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

interface IExchangeHelpersV2 {
    function getDy(uint256 _dx, bool _collToBold, IERC20 _collToken) external returns (uint256 dy);
    function getDx(uint256 _dy, bool _collToBold, IERC20 _collToken) external returns (uint256 dx);
}
