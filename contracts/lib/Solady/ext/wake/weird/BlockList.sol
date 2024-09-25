// Copyright (C) 2020 d-xo
// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity >=0.6.12;

import {ERC20} from "./ERC20.sol";

contract BlockableToken is ERC20 {
    // --- Access Control ---
    address owner;

    modifier auth() {
        require(msg.sender == owner, "unauthorised");
        _;
    }

    // --- BlockList ---
    mapping(address => bool) blocked;

    function block(address usr) public auth {
        blocked[usr] = true;
    }

    function allow(address usr) public auth {
        blocked[usr] = false;
    }

    // --- Init ---
    constructor(uint256 _totalSupply) public ERC20(_totalSupply) {
        owner = msg.sender;
    }

    // --- Token ---
    function transferFrom(address src, address dst, uint256 wad) public override returns (bool) {
        require(!blocked[src], "blocked");
        require(!blocked[dst], "blocked");
        return super.transferFrom(src, dst, wad);
    }
}
