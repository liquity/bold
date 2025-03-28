
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseTargetFunctions} from "@chimera/BaseTargetFunctions.sol";
import {vm} from "@chimera/Hevm.sol";
import "forge-std/console2.sol";

import {Properties} from "../Properties.sol";

abstract contract CollTokenTargets is BaseTargetFunctions, Properties  {

    function collToken_approve(address spender, uint256 amount) public updateGhosts asActor {
        collToken.approve(spender, amount);
    }

    // function collToken_decreaseAllowance(address spender, uint256 subtractedValue) public updateGhosts asActor {
    //     collToken.decreaseAllowance(spender, subtractedValue);
    // }

    // function collToken_increaseAllowance(address spender, uint256 addedValue) public updateGhosts asActor {
    //     collToken.increaseAllowance(spender, addedValue);
    // }

    function collToken_mint(address to, uint256 amt) public updateGhosts asActor {
        collToken.mint(to, amt);
    }

    function collToken_transfer(address to, uint256 amount) public updateGhosts asActor {
        collToken.transfer(to, amount);
    }

    function collToken_transferFrom(address from, address to, uint256 amount) public updateGhosts asActor {
        collToken.transferFrom(from, to, amount);
    }
}