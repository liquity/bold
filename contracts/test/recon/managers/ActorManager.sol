// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseSetup} from "@chimera/BaseSetup.sol";
import {vm} from "@chimera/Hevm.sol";
import {vm} from "@chimera/Hevm.sol";
import {EnumerableSet} from "openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {IERC20} from "openzeppelin/contracts/token/ERC20/IERC20.sol";

// TODO: Should we separate actor from lender from borrower from admin?
// I feel that's the cleanest way
abstract contract ActorManager {
    using EnumerableSet for EnumerableSet.AddressSet;

    address private _actor;

    EnumerableSet.AddressSet private _actors;

    // If the current target is address(0) then it has not been setup yet and should revert
    error ActorNotSetup();
    // Do not allow duplicates
    error ActorExists();
    // If the actor does not exist
    error ActorNotAdded();
    // Do not allow the default actor
    error DefaultActor();

    // TODO: We have defined the library
    // But we need to make this more explicit
    // So it's very clean in the story what's going on

    constructor() {
        // address(this) is the default actor
        _actors.add(address(this));
        _actor = address(this);
    }
    
    modifier useActor() {
        vm.prank(_getActor());
        _;
    }

    // use this function to get the current active actor
    function _getActor() internal view returns (address) {
       return _actor;
    }

    // returns an actor different from the currently set one 
    function _getDifferentActor() internal view returns (address differentActor) {
        address[] memory actors_ = _getActors();
        for(uint256 i; i < actors_.length; i++) {
            if(actors_[i] != _actor) {
                differentActor = actors_[i];
            }
        }
    }

    function _getRandomActor(uint256 entropy) internal view returns (address randomActor) {
        address[] memory actorsArray = _getActors();
        randomActor = actorsArray[entropy % actorsArray.length];
    }

    // Get regular users
    function _getActors() internal view returns (address[] memory) {
        return _actors.values();
    }

    function _enableActor(address target) internal {
        _actor = target;
    }
    
    // NOTE: disabling an actor set the default actor (address(this)) as the current actor
    function _disableActor() internal {
        _actor = address(this);
    }

    function _addActor(address target) internal {
        if (_actors.contains(target)) {
            revert ActorExists();
        }

        if (target == address(this)) {
            revert DefaultActor();
        }

        _actors.add(target);
    }

    function _removeActor(address target) internal {
        if (!_actors.contains(target)) {
            revert ActorNotAdded();
        }

        if (target == address(this)) {
            revert DefaultActor();
        }

        _actors.remove(target);  
    }

    // Note: expose this function _in `TargetFunctions` for actor switching
    function _switchActor(uint256 entropy) internal {
        _disableActor();

        address target = _actors.at(entropy % _actors.length());
        _enableActor(target);
    }
}