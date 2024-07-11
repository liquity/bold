// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IWETH is IERC20Metadata {
    function deposit() external payable;
    function withdraw(uint wad) external;
}
