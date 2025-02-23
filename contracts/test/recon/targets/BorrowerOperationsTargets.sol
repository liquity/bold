
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseTargetFunctions} from "@chimera/BaseTargetFunctions.sol";
import {vm} from "@chimera/Hevm.sol";
import "forge-std/console2.sol";

import {Properties} from "../Properties.sol";

import {IBorrowerOperations} from "../../../src/Interfaces/IBorrowerOperations.sol";

import {LiquityMath} from "../../../src/Dependencies/LiquityMath.sol";

abstract contract BorrowerOperationsTargets is BaseTargetFunctions, Properties  {

    /// === Inlined Test === ///
    function borrowerOperations_claimCollateral() public updateGhosts {
        uint256 currentSurplus = collSurplusPool.getCollateral(_getActor());

        uint256 balB4 = collToken.balanceOf(_getActor());

        vm.prank(_getActor());
        try borrowerOperations.claimCollateral() {

        } catch {
            eq(currentSurplus, 0, "An owner with collateral surplus can always claim");
        }

        uint256 balAfter = collToken.balanceOf(_getActor());

        eq(balAfter - balB4, currentSurplus, "An owner that claims collateral surplus always receives the exact amount they are owed");
    }

     function inlined_test_adding_to_a_batch() public {
        uint256 debtB4 = troveManager.getTroveEntireDebt(clampedTroveId);
        borrowerOperations_setInterestBatchManager(clampedTroveId, clampedBatchManager, 0, 0, type(uint256).max);

        uint256 debtAfter = troveManager.getTroveEntireDebt(clampedTroveId);

        gte(debtAfter, debtB4, "BT-03: Adding a trove to a Batch should never decrease the Trove debt");

        revert("Stateless"); // Reverting here means the function has no impact on ghost variables
    }

    function inlined_test_removing_from_a_batch() public {
        uint256 debtB4 = troveManager.getTroveEntireDebt(clampedTroveId);
        // Get current borrow rate so we don't trigger adjustment
        // Get current batch rate
        uint256 annualRate = troveManager.getTroveAnnualInterestRate(clampedTroveId);
        borrowerOperations_removeFromBatch(clampedTroveId, annualRate, 0, 0, type(uint256).max);

        uint256 debtAfter = troveManager.getTroveEntireDebt(clampedTroveId);

        gte(debtAfter, debtB4, "BT-04: Removing a trove from a Batch should never decrease the Trove debt");

        revert("Stateless"); // Reverting here means the function has no impact on ghost variables
    }

    /// NOTE: Inlined test to check that the trove can never set itself to insolvent
    function inlined_property_check_not_insolvent(uint256 troveId) internal {
        uint256 price = priceFeed.getPrice();
        uint256 mcr = borrowerOperations.MCR();

        // Get Current Coll
        uint256 currentColl = troveManager.getTroveEntireColl(troveId);
        // Get current debt
        uint256 currentDebt = troveManager.getTroveEntireDebt(troveId);

        uint256 cr = LiquityMath._computeCR(currentColl, currentDebt, price);
        gte(cr, mcr, "Can never self liquidate");
    }



    /// === Handlers === ///


    function borrowerOperations_addColl(uint256 _troveId, uint256 _collAmount) public updateGhosts asActor {
        borrowerOperations.addColl(_troveId, _collAmount);
        inlined_property_check_not_insolvent(_troveId);
    }

    function borrowerOperations_addColl_clamped(uint88 _collAmount) public {
        uint256 collChange = _collAmount % (collToken.balanceOf(_getActor()) + 1);

        borrowerOperations_addColl(clampedTroveId, collChange);
    }


    function borrowerOperations_adjustTrove(uint256 _troveId, uint256 _collChange, bool _isCollIncrease, uint256 _boldChange, bool _isDebtIncrease, uint256 _maxUpfrontFee) public updateGhosts asActor {
        borrowerOperations.adjustTrove(_troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _maxUpfrontFee);
        inlined_property_check_not_insolvent(_troveId);
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
            boldChange = _boldChange % (troveManager.getTroveEntireDebt(clampedTroveId) + 1);
        }
        borrowerOperations_adjustTrove(clampedTroveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, type(uint256).max);
    }


    function borrowerOperations_adjustTroveInterestRate(uint256 _troveId, uint256 _newAnnualInterestRate, uint256 _upperHint, uint256 _lowerHint, uint256 _maxUpfrontFee) public updateGhosts asActor {
        borrowerOperations.adjustTroveInterestRate(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint, _maxUpfrontFee);
    }

    function borrowerOperations_adjustTroveInterestRate_clamped(uint256 _troveId, uint256 _newAnnualInterestRate, uint256 _maxUpfrontFee) public {
        _newAnnualInterestRate = _newAnnualInterestRate % (2.5e18 + 1); // NOTE: TODO: Change based on codebase
        borrowerOperations_adjustTroveInterestRate(clampedTroveId, _newAnnualInterestRate, 0, 0, type(uint256).max);
    }
    

    function borrowerOperations_adjustZombieTrove(uint256 _troveId, uint256 _collChange, bool _isCollIncrease, uint256 _boldChange, bool _isDebtIncrease, uint256 _upperHint, uint256 _lowerHint, uint256 _maxUpfrontFee) public updateGhosts asActor {
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
            boldChange = _boldChange % (troveManager.getTroveEntireDebt(clampedTroveId) + 1);
        }
        borrowerOperations_adjustZombieTrove(clampedTroveId, collChange, _isCollIncrease, boldChange, _isDebtIncrease, _upperHint, _lowerHint, type(uint256).max);
    }


    function borrowerOperations_applyPendingDebt(uint256 _troveId, uint256 _lowerHint, uint256 _upperHint) public updateGhosts asActor {
        borrowerOperations.applyPendingDebt(_troveId, _lowerHint, _upperHint);
    }


    function borrowerOperations_applyPendingDebt(uint256 _troveId) public updateGhosts asActor {
        borrowerOperations.applyPendingDebt(_troveId);
    }

    function borrowerOperations_applyPendingDebt_clamped() public {
        borrowerOperations_applyPendingDebt(clampedTroveId);
    }


    function borrowerOperations_closeTrove(uint256 _troveId) public updateGhosts asActor {
        borrowerOperations.closeTrove(_troveId);
    }

    function borrowerOperations_closeTrove_clamped() public {
        borrowerOperations_closeTrove(clampedTroveId);
    }


    function borrowerOperations_lowerBatchManagementFee(uint256 _newAnnualManagementFee) public updateGhosts asActor {
        borrowerOperations.lowerBatchManagementFee(_newAnnualManagementFee);
    }

    function borrowerOperations_onLiquidateTrove(uint256 _troveId) public updateGhosts asActor {
        borrowerOperations.onLiquidateTrove(_troveId);
    }

    function borrowerOperations_openTrove(address _owner, uint256 _ownerIndex, uint256 _collAmount, uint256 _boldAmount, uint256 _upperHint, uint256 _lowerHint, uint256 _annualInterestRate, uint256 _maxUpfrontFee, address _addManager, address _removeManager, address _receiver) public updateGhosts asActor returns (uint256) {
        uint256 troveId = borrowerOperations.openTrove(_owner, _ownerIndex, _collAmount, _boldAmount, _upperHint, _lowerHint, _annualInterestRate, _maxUpfrontFee, _addManager, _removeManager, _receiver);
        clampedTroveId = troveId;
        inlined_property_check_not_insolvent(troveId);
        return troveId;
    }

    function borrowerOperations_openTrove_clamped(address _owner, uint256 _ownerIndex, uint88 _collAmount, uint88 _boldAmount, address _addManager, address _removeManager, address _receiver) public returns (uint256) {
        return borrowerOperations_openTrove(_getActor(), _ownerIndex, _collAmount, _boldAmount, 0, 0, 1e17, type(uint256).max, _getActor(), _getActor(), _getActor());
    }

    function borrowerOperations_openTroveAndJoinInterestBatchManager(IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams memory _params) public updateGhosts asActor {
        borrowerOperations.openTroveAndJoinInterestBatchManager(_params);
    }

    function borrowerOperations_registerBatchManager(uint128 _minInterestRate, uint128 _maxInterestRate, uint128 _currentInterestRate, uint128 _annualManagementFee, uint128 _minInterestRateChangePeriod) public updateGhosts asActor {
        borrowerOperations.registerBatchManager(_minInterestRate, _maxInterestRate, _currentInterestRate, _annualManagementFee, _minInterestRateChangePeriod);
    }

    function borrowerOperations_registerBatchManager_clamped() public returns (address) {
        borrowerOperations_registerBatchManager(1e18 / 100, 1e18 - 100, 1e17, 1e17, 1 hours);
        clampedBatchManager = _getActor();
        return clampedBatchManager; // Add to dictionary
    }


    function borrowerOperations_removeFromBatch(uint256 _troveId, uint256 _newAnnualInterestRate, uint256 _upperHint, uint256 _lowerHint, uint256 _maxUpfrontFee) public updateGhosts asActor {
        borrowerOperations.removeFromBatch(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint, _maxUpfrontFee);
    }

    function borrowerOperations_removeFromBatch_clamped(uint256 _troveId, uint256 _newAnnualInterestRate) public {
        borrowerOperations_removeFromBatch(clampedTroveId, _newAnnualInterestRate, 0, 0, type(uint256).max);
    }



    function borrowerOperations_removeInterestIndividualDelegate(uint256 _troveId) public updateGhosts asActor {
        borrowerOperations.removeInterestIndividualDelegate(_troveId);
    }


    function borrowerOperations_repayBold(uint256 _troveId, uint256 _boldAmount) public updateGhosts asActor {
        borrowerOperations.repayBold(_troveId, _boldAmount);
        inlined_property_check_not_insolvent(_troveId);
    }

    function borrowerOperations_repayBold_clamped(uint88 _boldAmount) public updateGhosts asActor {
        uint256 amt = _boldAmount %  (troveManager.getTroveEntireDebt(clampedTroveId) + 1);
        // TODO: Should use max as the max debt
        borrowerOperations_repayBold(clampedTroveId, amt);
    }


    function borrowerOperations_setAddManager(uint256 _troveId, address _manager) public updateGhosts asActor {
        borrowerOperations.setAddManager(_troveId, _manager);
    }

    function borrowerOperations_setBatchManagerAnnualInterestRate(uint128 _newAnnualInterestRate, uint256 _upperHint, uint256 _lowerHint, uint256 _maxUpfrontFee) public updateGhosts asActor {
        borrowerOperations.setBatchManagerAnnualInterestRate(_newAnnualInterestRate, _upperHint, _lowerHint, _maxUpfrontFee);
    }

    // NOTE: Non standard handler! We need to prank the maanger to get this to work
    function borrowerOperations_setBatchManagerAnnualInterestRate_clamped(uint128 _newAnnualInterestRate) public updateGhosts {
        vm.prank(clampedBatchManager);
        borrowerOperations.setBatchManagerAnnualInterestRate(_newAnnualInterestRate, 0, 0, type(uint256).max);
    }

    function borrowerOperations_setInterestBatchManager(uint256 _troveId, address _newBatchManager, uint256 _upperHint, uint256 _lowerHint, uint256 _maxUpfrontFee) public updateGhosts asActor {
        borrowerOperations.setInterestBatchManager(_troveId, _newBatchManager, _upperHint, _lowerHint, _maxUpfrontFee);
    }

    function borrowerOperations_setInterestBatchManager_clamped() public {
        borrowerOperations_setInterestBatchManager(clampedTroveId, clampedBatchManager, 0, 0, type(uint256).max);
    }

    function borrowerOperations_setInterestIndividualDelegate(uint256 _troveId, address _delegate, uint128 _minInterestRate, uint128 _maxInterestRate, uint256 _newAnnualInterestRate, uint256 _upperHint, uint256 _lowerHint, uint256 _maxUpfrontFee, uint256 _minInterestRateChangePeriod) public updateGhosts asActor {
        borrowerOperations.setInterestIndividualDelegate(_troveId, _delegate, _minInterestRate, _maxInterestRate, _newAnnualInterestRate, _upperHint, _lowerHint, _maxUpfrontFee, _minInterestRateChangePeriod);
    }

    function borrowerOperations_setRemoveManager(uint256 _troveId, address _manager) public updateGhosts asActor {
        borrowerOperations.setRemoveManager(_troveId, _manager);
    }

    function borrowerOperations_setRemoveManagerWithReceiver(uint256 _troveId, address _manager, address _receiver) public updateGhosts asActor {
        borrowerOperations.setRemoveManagerWithReceiver(_troveId, _manager, _receiver);
    }

    function borrowerOperations_shutdown() public updateGhosts asActor {
        borrowerOperations.shutdown();
    }

    function borrowerOperations_shutdownFromOracleFailure() public updateGhosts asActor {
        borrowerOperations.shutdownFromOracleFailure();
    }

    // === Switch Batch Manager === //

    function borrowerOperations_switchBatchManager(uint256 _troveId, uint256 _removeUpperHint, uint256 _removeLowerHint, address _newBatchManager, uint256 _addUpperHint, uint256 _addLowerHint, uint256 _maxUpfrontFee) public updateGhosts asActor {
        borrowerOperations.switchBatchManager(_troveId, _removeUpperHint, _removeLowerHint, _newBatchManager, _addUpperHint, _addLowerHint, _maxUpfrontFee);
    }
    function borrowerOperations_switchBatchManager_clamped() public {
        borrowerOperations_switchBatchManager(clampedTroveId, 0, 0, clampedBatchManager, 0, 0, type(uint256).max);
    }


    // === Withdraw Bold === //
    function borrowerOperations_withdrawBold(uint256 _troveId, uint256 _boldAmount, uint256 _maxUpfrontFee) public updateGhosts asActor {
        borrowerOperations.withdrawBold(_troveId, _boldAmount, _maxUpfrontFee);
        inlined_property_check_not_insolvent(_troveId);
    }

    function borrowerOperations_withdrawBold_clamped(uint88 _boldAmount) public {
        borrowerOperations_withdrawBold(clampedTroveId, _boldAmount, type(uint256).max);
    }


    // === Withdraw Coll === //
    function borrowerOperations_withdrawColl(uint256 _troveId, uint256 _collWithdrawal) public updateGhosts asActor {
        borrowerOperations.withdrawColl(_troveId, _collWithdrawal);
        inlined_property_check_not_insolvent(_troveId);
    }

    function borrowerOperations_withdrawColl_clamped(uint256 _collWithdrawal) public {
        uint256 amt = _collWithdrawal%  (troveManager.getTroveColl(clampedTroveId) + 1);
        borrowerOperations_withdrawColl(clampedTroveId, _collWithdrawal);
    }

    
}