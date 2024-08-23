// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "../Dependencies/AddRemoveManagers.sol";
import "./TestContracts/DevTestSetup.sol";

contract InterestIndividualDelegationTest is DevTestSetup {
    function openTroveAndSetIndividualDelegate() internal returns (uint256) {
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        vm.startPrank(A);
        borrowerOperations.setInterestIndividualDelegate(troveId, B, 1e16, 20e16, 0, 0, 0, 0);
        vm.stopPrank();

        return troveId;
    }

    function testSetsDelegateProperly() public {
        uint256 troveId = openTroveAndSetIndividualDelegate();

        IBorrowerOperations.InterestIndividualDelegate memory delegate =
            borrowerOperations.getInterestIndividualDelegateOf(troveId);
        assertEq(delegate.account, B, "Wrong individual delegate");
        assertEq(delegate.minInterestRate, 1e16, "Wrong min interest");
        assertEq(delegate.maxInterestRate, 20e16, "Wrong max interest");
    }

    function testRemovesDelegateProperly() public {
        uint256 troveId = openTroveAndSetIndividualDelegate();

        IBorrowerOperations.InterestIndividualDelegate memory delegate =
            borrowerOperations.getInterestIndividualDelegateOf(troveId);
        assertEq(delegate.account, B, "Wrong individual delegate");

        vm.startPrank(A);
        borrowerOperations.removeInterestIndividualDelegate(troveId);
        vm.stopPrank();

        delegate = borrowerOperations.getInterestIndividualDelegateOf(troveId);
        assertEq(delegate.account, address(0), "Individual delegate address should be zero");
        assertEq(delegate.minInterestRate, uint128(0), "Individual delegate min rate should be zero");
        assertEq(delegate.maxInterestRate, uint128(0), "Individual delegate max rate should be zero");
    }

    function testOnlyBorrowerCanSetDelegate() public {
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 2000e18, 5e16);

        vm.startPrank(B);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.setInterestIndividualDelegate(troveId, B, 1e16, 20e16, 0, 0, 0, 0);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.setInterestIndividualDelegate(troveId, A, 1e16, 20e16, 0, 0, 0, 0);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.setInterestIndividualDelegate(troveId, C, 1e16, 20e16, 0, 0, 0, 0);
        vm.stopPrank();
    }

    function testOnlyBorrowerCanRemoveDelegate() public {
        uint256 troveId = openTroveAndSetIndividualDelegate();

        IBorrowerOperations.InterestIndividualDelegate memory delegate =
            borrowerOperations.getInterestIndividualDelegateOf(troveId);
        assertEq(delegate.account, B, "Wrong individual delegate");

        vm.startPrank(B);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.removeInterestIndividualDelegate(troveId);
        vm.stopPrank();

        vm.startPrank(C);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.removeInterestIndividualDelegate(troveId);
        vm.stopPrank();
    }

    function testDelegateCanSetInterestInTheRange() public {
        uint256 troveId = openTroveAndSetIndividualDelegate();

        vm.startPrank(B);
        borrowerOperations.adjustTroveInterestRate(troveId, 6e16, 0, 0, 1e24);
        vm.stopPrank();

        assertEq(troveManager.getTroveAnnualInterestRate(troveId), 6e16, "Wrong interest rate");
    }

    function testDelegateCannotSetInterestBelowMin() public {
        uint256 troveId = openTroveAndSetIndividualDelegate();

        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.InterestNotInRange.selector);
        borrowerOperations.adjustTroveInterestRate(troveId, MIN_ANNUAL_INTEREST_RATE, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testDelegateCannotSetInterestAboveMax() public {
        uint256 troveId = openTroveAndSetIndividualDelegate();

        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.InterestNotInRange.selector);
        borrowerOperations.adjustTroveInterestRate(troveId, 50e16, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testSetDelegateRemovesBatchManager() public {
        vm.startPrank(B);
        borrowerOperations.registerBatchManager(1e16, 20e16, 5e16, 25e14, MIN_INTEREST_RATE_CHANGE_PERIOD);
        vm.stopPrank();

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);
        // Set batch manager (B)
        vm.startPrank(A);
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.stopPrank();

        IBorrowerOperations.InterestIndividualDelegate memory delegate =
            borrowerOperations.getInterestIndividualDelegateOf(troveId);
        assertEq(borrowerOperations.interestBatchManagerOf(troveId), B, "Wrong batch manager");
        assertEq(delegate.account, address(0), "Individual delegate should be empty");

        // Switch to individual delegate (C) along with new interest
        uint256 newAnnualInterestRate = 6e16;
        vm.startPrank(A);
        borrowerOperations.setInterestIndividualDelegate(troveId, C, 1e16, 20e16, newAnnualInterestRate, 0, 0, 10000e18);
        vm.stopPrank();

        delegate = borrowerOperations.getInterestIndividualDelegateOf(troveId);
        assertEq(borrowerOperations.interestBatchManagerOf(troveId), address(0), "Batch manager should be empty");
        assertEq(delegate.account, C, "Wrong individual delegate");
        assertEq(troveManager.getTroveAnnualInterestRate(troveId), newAnnualInterestRate, "Wrong interest rate");
    }

    function testInterestUpdateByDelegatePremature() public {
        uint256 troveId = openTroveAndSetIndividualDelegate();

        uint256 newAnnualInterestRate = 6e16;
        uint256 upfrontFee = predictAdjustInterestRateUpfrontFee(troveId, newAnnualInterestRate);
        uint256 recordedDebtBefore = troveManager.getTroveDebt(troveId);
        vm.startPrank(B);
        borrowerOperations.adjustTroveInterestRate(troveId, newAnnualInterestRate, 0, 0, 1e24);
        vm.stopPrank();

        assertEq(troveManager.getTroveDebt(troveId), recordedDebtBefore + upfrontFee);
        assertEq(troveManager.getTroveAnnualInterestRate(troveId), 6e16, "Wrong interest rate");
    }

    function testInterestUpdateByDelegateAfterCooldown() public {
        uint256 troveId = openTroveAndSetIndividualDelegate();

        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN);

        uint256 entireDebtBefore = troveManager.getTroveEntireDebt(troveId);

        uint256 newAnnualInterestRate = 6e16;
        vm.startPrank(B);
        borrowerOperations.adjustTroveInterestRate(troveId, newAnnualInterestRate, 0, 0, 1e24);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireDebt(troveId), entireDebtBefore);
        assertEq(troveManager.getTroveAnnualInterestRate(troveId), 6e16, "Wrong interest rate");
    }
}
