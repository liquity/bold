// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface ITokenWrapper is IERC20Metadata {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function underlying() external view returns (IERC20Metadata);
}
