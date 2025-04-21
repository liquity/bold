// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import { DefaultERC20 } from "./DefaultERC20.t.sol";

contract NoApprovalERC20 is DefaultERC20 {
  constructor(string memory name_, string memory symbol_, uint8 decimals_)
    DefaultERC20(name_, symbol_, decimals_)
  { }

  function transfer(address to, uint256 amount) public override returns (bool) {
    _transfer(msg.sender, to, amount);

    return true;
  }

  function transferFrom(address from, address to, uint256 amount)
    public
    override
    returns (bool)
  {
    _transfer(from, to, amount);
    return true;
  }
}
