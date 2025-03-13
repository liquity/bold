// SPDX-License-Identifier: GPL-3.0
// Docgen-SOLC: 0.8.25

pragma solidity ^0.8.24;

import {Owned} from "./Owned.sol";
import {IWhitelist} from "../interfaces/IWhitelist.sol";

contract Whitelist is IWhitelist, Owned {
    mapping(address => bool) whitelist;
  
    event Whitelisted(address user);
    event WhitelistRemoved(address user);
  
    constructor(address owner) Owned(owner) {}
    
    function addToWhitelist(address user) onlyOwner external override {
        whitelist[user] = true;

        emit Whitelisted(user);
    }

    function removeFromWhitelist(address user) onlyOwner external override {
        whitelist[user] = false;

        emit WhitelistRemoved(user);
    }

    function isWhitelisted(address user) external view override returns (bool) {
        return whitelist[user];
    }
}