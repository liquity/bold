// SPDX-License-Identifier: GPL-3.0
// Docgen-SOLC: 0.8.25

pragma solidity ^0.8.24;

import {Owned} from "./Owned.sol";
import {IWhitelist} from "../Interfaces/IWhitelist.sol";

contract Whitelist is IWhitelist, Owned {
    // calling contract -> user -> whitelisted
    mapping(address => mapping(address => bool)) whitelist;

    event Whitelisted(address callingContract, address user);
    event WhitelistRemoved(address callingContract, address user);

    constructor(address owner) Owned(owner) {}

    function addToWhitelist(address callingContract, address user) external override onlyOwner {
        whitelist[callingContract][user] = true;

        emit Whitelisted(callingContract, user);
    }

    function removeFromWhitelist(address callingContract, address user) external override onlyOwner {
        whitelist[callingContract][user] = false;

        emit WhitelistRemoved(callingContract, user);
    }

    function isWhitelisted(address callingContract, address user) external view override returns (bool) {
        return whitelist[callingContract][user];
    }
}
