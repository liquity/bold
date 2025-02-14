
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseTargetFunctions} from "@chimera/BaseTargetFunctions.sol";
import {vm} from "@chimera/Hevm.sol";
import "forge-std/console2.sol";

import {Properties} from "../Properties.sol";

abstract contract StabilityPoolTargets is BaseTargetFunctions, Properties  {

    function stabilityPool_claimAllCollGains() public asActor {
        stabilityPool.claimAllCollGains();
    }


    function stabilityPool_provideToSP(uint256 _topUp, bool _doClaim) public asActor {
        stabilityPool.provideToSP(_topUp, _doClaim);
    }

    function stabilityPool_provideToSP_clamped(uint256 _topUp, bool _doClaim) public {
        _topUp = _topUp % (boldToken.balanceOf(_getActor()) + 1);
        stabilityPool_provideToSP(_topUp, _doClaim);
    }

    function stabilityPool_withdrawFromSP(uint256 _amount, bool _doClaim) public asActor {
        stabilityPool.withdrawFromSP(_amount, _doClaim);
    }

    function stabilityPool_withdrawFromSP_clamped(uint256 _amount, bool _doClaim) public {
        _amount = _amount % (stabilityPool.getCompoundedBoldDeposit(_getActor()) + 1);
        stabilityPool_withdrawFromSP(_amount, _doClaim);
    }



    function stabilityPool_offset(uint256 _debtToOffset, uint256 _collToAdd) public asActor {
        stabilityPool.offset(_debtToOffset, _collToAdd);
    }

    function stabilityPool_triggerBoldRewards(uint256 _boldYield) public asActor {
        stabilityPool.triggerBoldRewards(_boldYield);
    }

}