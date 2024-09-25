// Copyright (C) 2020 d-xo
// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity >=0.6.12;

import {ERC20} from "./ERC20.sol";

contract ApprovalToZeroToken is ERC20 {
    // --- Init ---
    constructor(uint256 _totalSupply) public ERC20(_totalSupply) {}

    // --- Token ---
    function approve(address usr, uint256 wad) public override returns (bool) {
        require(usr != address(0), "no approval for the zero address");
        return super.approve(usr, wad);
    }
}
