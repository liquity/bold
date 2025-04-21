// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import { DefaultERC20 } from "./DefaultERC20.t.sol";

contract FaucetERC20 is DefaultERC20 {
  uint256 public immutable TAP_AMOUNT;

  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 tapAmount
  ) DefaultERC20(name_, symbol_, decimals_) {
    TAP_AMOUNT = tapAmount;
  }

  function tap() external {
    _mint(msg.sender, TAP_AMOUNT);
  }
}
