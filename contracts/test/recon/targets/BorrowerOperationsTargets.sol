
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseTargetFunctions} from "@chimera/BaseTargetFunctions.sol";
import {vm} from "@chimera/Hevm.sol";
import "forge-std/console2.sol";

import {Properties} from "../Properties.sol";

import {IBorrowerOperations} from "../../../src/Interfaces/IBorrowerOperations.sol";

abstract contract BorrowerOperationsTargets is BaseTargetFunctions, Properties  {

    function borrowerOperations_addColl(uint256 _troveId, uint256 _collAmount) public asActor {
        borrowerOperations.addColl(_troveId, _collAmount);
    }

    function borrowerOperations_addColl_clamped(uint88 _collAmount) public {
        uint256 collChange = _collAmount % (collToken.balanceOf(_getActor()) + 1);

        borrowerOperations_addColl(clampedTroveId, collChange);
    }


    function borrowerOperations_adjustTrove(uint256 _troveId, uint256 _collChange, bool _isCollIncrease, uint256 _boldChange, bool _isDebtIncrease, uint256 _maxUpfrontFee) public asActor {
        borrowerOperations.adjustTrove(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _maxUpfrontFee);
    }

    function borrowerOperations_adjustTrove_clamped(uint88 _collChange, bool _isCollIncrease, uint88 _boldChange, bool _isDebtIncrease, uint256 _maxUpfrontFee) public {
        uint256 collChange;
        uint256 boldChange;
        if(_isCollIncrease) {
            collChange = _collChange % (collToken.balanceOf(_getActor()) + 1);
        } else {
            collChange = _collChange % (troveManager.getTroveColl(clampedTroveId) + 1);
        }

        if(!_isDebtIncrease) {
            boldChange = _boldChange % (troveManager.getTroveDebt(clampedTroveId) + 1);
        }
        borrowerOperations_adjustTrove(clampedTroveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, type(uint256).max);
    }


    function borrowerOperations_adjustTroveInterestRate(uint256 _troveId, uint256 _newAnnualInterestRate, uint256 _upperHint, uint256 _lowerHint, uint256 _maxUpfrontFee) public asActor {
        borrowerOperations.adjustTroveInterestRate(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint, _maxUpfrontFee);
    }

    function borrowerOperations_adjustTroveInterestRate_clamped(uint256 _troveId, uint256 _newAnnualInterestRate, uint256 _maxUpfrontFee) public {
        _newAnnualInterestRate = _newAnnualInterestRate % (2.5e18 + 1); // NOTE: TODO: Change based on codebase
        borrowerOperations_adjustTroveInterestRate(clampedTroveId, _newAnnualInterestRate, 0, 0, type(uint256).max);
    }
    

    function borrowerOperations_adjustZombieTrove(uint256 _troveId, uint256 _collChange, bool _isCollIncrease, uint256 _boldChange, bool _isDebtIncrease, uint256 _upperHint, uint256 _lowerHint, uint256 _maxUpfrontFee) public asActor {
        borrowerOperations.adjustZombieTrove(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _upperHint, _lowerHint, _maxUpfrontFee);
    }

    function borrowerOperations_adjustZombieTrove_clamped(uint88 _collChange, bool _isCollIncrease, uint88 _boldChange, bool _isDebtIncrease, uint256 _upperHint, uint256 _lowerHint) public {
        uint256 collChange;
        uint256 boldChange;
        if(_isCollIncrease) {
            collChange = _collChange % (collToken.balanceOf(_getActor()) + 1);
        } else {
            collChange = _collChange % (troveManager.getTroveColl(clampedTroveId) + 1);
        }

        if(!_isDebtIncrease) {
            boldChange = _boldChange % (troveManager.getTroveDebt(clampedTroveId) + 1);
        }
        borrowerOperations_adjustZombieTrove(clampedTroveId, collChange, _isCollIncrease, boldChange, _isDebtIncrease, _upperHint, _lowerHint, type(uint256).max);
    }


    function borrowerOperations_applyPendingDebt(uint256 _troveId, uint256 _lowerHint, uint256 _upperHint) public asActor {
        borrowerOperations.applyPendingDebt(_troveId, _lowerHint, _upperHint);
    }


    function borrowerOperations_applyPendingDebt(uint256 _troveId) public asActor {
        borrowerOperations.applyPendingDebt(_troveId);
    }

    function borrowerOperations_applyPendingDebt_clamped() public {
        borrowerOperations_applyPendingDebt(clampedTroveId);
    }

    function borrowerOperations_claimCollateral() public asActor {
        borrowerOperations.claimCollateral();
    }


    function borrowerOperations_closeTrove(uint256 _troveId) public asActor {
        borrowerOperations.closeTrove(_troveId);
    }

    function borrowerOperations_closeTrove_clamped() public {
        borrowerOperations_closeTrove(clampedTroveId);
    }


    function borrowerOperations_lowerBatchManagementFee(uint256 _newAnnualManagementFee) public asActor {
        borrowerOperations.lowerBatchManagementFee(_newAnnualManagementFee);
    }

    function borrowerOperations_onLiquidateTrove(uint256 _troveId) public asActor {
        borrowerOperations.onLiquidateTrove(_troveId);
    }

    function borrowerOperations_openTrove(address _owner, uint256 _ownerIndex, uint256 _collAmount, uint256 _boldAmount, uint256 _upperHint, uint256 _lowerHint, uint256 _annualInterestRate, uint256 _maxUpfrontFee, address _addManager, address _removeManager, address _receiver) public returns (uint256) {
        uint256 troveId = borrowerOperations.openTrove(_owner, _ownerIndex, _collAmount, _boldAmount, _upperHint, _lowerHint, _annualInterestRate, _maxUpfrontFee, _addManager, _removeManager, _receiver);
        clampedTroveId = troveId;
        return troveId;
    }

    function borrowerOperations_openTrove_clamped(address _owner, uint256 _ownerIndex, uint88 _collAmount, uint88 _boldAmount, address _addManager, address _removeManager, address _receiver) public returns (uint256) {
        return borrowerOperations_openTrove(_getActor(), _ownerIndex, _collAmount, _boldAmount, 0, 0, 1e17, type(uint256).max, _getActor(), _getActor(), _getActor());
    }

    function borrowerOperations_openTroveAndJoinInterestBatchManager(IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams memory _params) public asActor {
        borrowerOperations.openTroveAndJoinInterestBatchManager(_params);
    }

    function borrowerOperations_registerBatchManager(uint128 _minInterestRate, uint128 _maxInterestRate, uint128 _currentInterestRate, uint128 _annualManagementFee, uint128 _minInterestRateChangePeriod) public asActor {
        borrowerOperations.registerBatchManager(_minInterestRate, _maxInterestRate, _currentInterestRate, _annualManagementFee, _minInterestRateChangePeriod);
    }

    function borrowerOperations_removeFromBatch(uint256 _troveId, uint256 _newAnnualInterestRate, uint256 _upperHint, uint256 _lowerHint, uint256 _maxUpfrontFee) public asActor {
        borrowerOperations.removeFromBatch(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint, _maxUpfrontFee);
    }

    function borrowerOperations_removeInterestIndividualDelegate(uint256 _troveId) public asActor {
        borrowerOperations.removeInterestIndividualDelegate(_troveId);
    }


    function borrowerOperations_repayBold(uint256 _troveId, uint256 _boldAmount) public asActor {
        borrowerOperations.repayBold(_troveId, _boldAmount);
    }

    function borrowerOperations_repayBold_clamped(uint88 _boldAmount) public asActor {
        uint256 amt = _boldAmount %  (troveManager.getTroveDebt(clampedTroveId) + 1);
        // TODO: Should use max as the max debt
        borrowerOperations_repayBold(clampedTroveId, amt);
    }


    function borrowerOperations_setAddManager(uint256 _troveId, address _manager) public asActor {
        borrowerOperations.setAddManager(_troveId, _manager);
    }

    function borrowerOperations_setBatchManagerAnnualInterestRate(uint128 _newAnnualInterestRate, uint256 _upperHint, uint256 _lowerHint, uint256 _maxUpfrontFee) public asActor {
        borrowerOperations.setBatchManagerAnnualInterestRate(_newAnnualInterestRate, _upperHint, _lowerHint, _maxUpfrontFee);
    }

    function borrowerOperations_setInterestBatchManager(uint256 _troveId, address _newBatchManager, uint256 _upperHint, uint256 _lowerHint, uint256 _maxUpfrontFee) public asActor {
        borrowerOperations.setInterestBatchManager(_troveId, _newBatchManager, _upperHint, _lowerHint, _maxUpfrontFee);
    }

    function borrowerOperations_setInterestIndividualDelegate(uint256 _troveId, address _delegate, uint128 _minInterestRate, uint128 _maxInterestRate, uint256 _newAnnualInterestRate, uint256 _upperHint, uint256 _lowerHint, uint256 _maxUpfrontFee, uint256 _minInterestRateChangePeriod) public asActor {
        borrowerOperations.setInterestIndividualDelegate(_troveId, _delegate, _minInterestRate, _maxInterestRate, _newAnnualInterestRate, _upperHint, _lowerHint, _maxUpfrontFee, _minInterestRateChangePeriod);
    }

    function borrowerOperations_setRemoveManager(uint256 _troveId, address _manager) public asActor {
        borrowerOperations.setRemoveManager(_troveId, _manager);
    }

    function borrowerOperations_setRemoveManagerWithReceiver(uint256 _troveId, address _manager, address _receiver) public asActor {
        borrowerOperations.setRemoveManagerWithReceiver(_troveId, _manager, _receiver);
    }

    function borrowerOperations_shutdown() public asActor {
        borrowerOperations.shutdown();
    }

    function borrowerOperations_shutdownFromOracleFailure() public asActor {
        borrowerOperations.shutdownFromOracleFailure();
    }

    // === Switch Batch Manager === //

    function borrowerOperations_switchBatchManager(uint256 _troveId, uint256 _removeUpperHint, uint256 _removeLowerHint, address _newBatchManager, uint256 _addUpperHint, uint256 _addLowerHint, uint256 _maxUpfrontFee) public asActor {
        borrowerOperations.switchBatchManager(_troveId, _removeUpperHint, _removeLowerHint, _newBatchManager, _addUpperHint, _addLowerHint, _maxUpfrontFee);
    }


    // === Withdraw Bold === //
    function borrowerOperations_withdrawBold(uint256 _troveId, uint256 _boldAmount, uint256 _maxUpfrontFee) public asActor {
        borrowerOperations.withdrawBold(_troveId, _boldAmount, _maxUpfrontFee);
    }

    function borrowerOperations_withdrawBold_clamped(uint88 _boldAmount) public {
        borrowerOperations_withdrawBold(clampedTroveId, _boldAmount, type(uint256).max);
    }


    // === Withdraw Coll === //
    function borrowerOperations_withdrawColl(uint256 _troveId, uint256 _collWithdrawal) public asActor {
        borrowerOperations.withdrawColl(_troveId, _collWithdrawal);
    }

    function borrowerOperations_withdrawColl_clamped(uint256 _collWithdrawal) public {
        uint256 amt = _collWithdrawal%  (troveManager.getTroveColl(clampedTroveId) + 1);
        borrowerOperations_withdrawColl(clampedTroveId, _collWithdrawal);
    }

    
}