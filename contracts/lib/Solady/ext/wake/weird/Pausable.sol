// Copyright (C) 2020 d-xo
// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity >=0.6.12;

import {ERC20} from "./ERC20.sol";

contract PausableToken is ERC20 {
    // --- Access Control ---
    address owner;

    modifier auth() {
        require(msg.sender == owner, "unauthorised");
        _;
    }

    // --- Pause ---
    bool live = true;

    function stop() external auth {
        live = false;
    }

    function start() external auth {
        live = true;
    }

    // --- Init ---
    constructor(uint256 _totalSupply) public ERC20(_totalSupply) {
        owner = msg.sender;
    }

    // --- Token ---
    function approve(address usr, uint256 wad) public override returns (bool) {
        require(live, "paused");
        return super.approve(usr, wad);
    }

    function transfer(address dst, uint256 wad) public override returns (bool) {
        require(live, "paused");
        return super.transfer(dst, wad);
    }

    function transferFrom(address src, address dst, uint256 wad) public override returns (bool) {
        require(live, "paused");
        return super.transferFrom(src, dst, wad);
    }
}
