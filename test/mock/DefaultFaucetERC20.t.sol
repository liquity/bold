// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {DefaultERC20} from "./DefaultERC20.t.sol";

abstract contract DefaultFaucetERC20 is DefaultERC20 {

  uint256 public immutable TAP_AMOUNT;

  constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 tapAmount_)
    DefaultERC20(name_, symbol_, decimals_) 
  {
    if (tapAmount_ == 0) {
      tapAmount_ = 1e18;
    }
    
    TAP_AMOUNT = tapAmount_;
  }

  function tapTo(address receiver) public {
    _mint(receiver, TAP_AMOUNT);
  }

  function tap() external {
    tapTo(msg.sender);
  }

  function mint(address account, uint256 amount) override public {
    amount = TAP_AMOUNT;
    _mint(account, amount);
  }
}