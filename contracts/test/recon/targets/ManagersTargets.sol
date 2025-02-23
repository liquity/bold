// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseTargetFunctions} from "@chimera/BaseTargetFunctions.sol";
import {BeforeAfter} from "../BeforeAfter.sol";
import {Properties} from "../Properties.sol";
import {vm} from "@chimera/Hevm.sol";

import {MockERC20} from "../mocks/MockERC20.sol";


// Target functions that are effectively inherited from the Actor and AssetManagers
// Once properly standardized, managers will expose these by default
// Keeping them out makes your project more custom
abstract contract ManagersTargets is
    BaseTargetFunctions,
    Properties
{
    // == ACTOR HANDLERS == //
    
    /// @dev Start acting as another actor
    function switchActor(uint256 entropy) public returns (address) {
        _switchActor(entropy);

        return _getActor();
    }


    // /// @dev Starts using a new asset // NOTE: Unused for now
    function switch_asset(uint256 entropy) public returns (address) {
        _switchAsset(entropy);

        return _getAsset();
    }


    /// === GHOST UPDATING HANDLERS ===///
    /// We `updateGhosts` cause you never know (e.g. donations)
    /// If you don't want to track donations, remove the `updateGhosts`

    /// @dev Approve to arbitrary address, uses Actor by default
    /// NOTE: You're almost always better off setting approvals in `Setup`
    function asset_approve(address to, uint128 amt) public asActor returns (uint256) {
        MockERC20(_getAsset()).approve(to, amt);

        return amt;
    }

    /// @dev Mint to arbitrary address, uses owner by default, even though MockERC20 doesn't check
    function asset_mint(address to, uint128 amt) public asAdmin returns (uint256) {
        MockERC20(_getAsset()).mint(to, amt);

        return amt;
    }
}