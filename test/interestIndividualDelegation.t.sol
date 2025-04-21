// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "src/Dependencies/AddRemoveManagers.sol";
import "./TestContracts/DevTestSetup.sol";

contract InterestIndividualDelegationTest is DevTestSetup {
    function openTroveAndSetIndividualDelegate() internal returns (uint256) {
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        vm.startPrank(A);
        borrowerOperations.setInterestIndividualDelegate(troveId, B, 1e16, 20e16, 0, 0, 0, 0, 0);
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
        borrowerOperations.setInterestIndividualDelegate(troveId, B, 1e16, 20e16, 0, 0, 0, 0, 0);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.setInterestIndividualDelegate(troveId, A, 1e16, 20e16, 0, 0, 0, 0, 0);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.setInterestIndividualDelegate(troveId, C, 1e16, 20e16, 0, 0, 0, 0, 0);
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

    function testOwnerCanSetInterestBelowMin() public {
        uint256 troveId = openTroveAndSetIndividualDelegate();

        vm.startPrank(A);
        borrowerOperations.adjustTroveInterestRate(troveId, MIN_ANNUAL_INTEREST_RATE, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testOwnerCanSetInterestAboveMax() public {
        uint256 troveId = openTroveAndSetIndividualDelegate();

        vm.startPrank(A);
        borrowerOperations.adjustTroveInterestRate(troveId, 50e16, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testSetDelegateRevertsIfTroveIsClosed() public {
        vm.startPrank(B);
        borrowerOperations.registerBatchManager(1e16, 20e16, 5e16, 25e14, MIN_INTEREST_RATE_CHANGE_PERIOD);
        vm.stopPrank();

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);
        // Open a second one, so it’s not the last one and to have BOLD for interest
        openTroveNoHints100pctWithIndex(A, 1, 100e18, 5000e18, 5e16);
        // Close trove
        closeTrove(A, troveId);

        // Set batch manager (B)
        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.TroveNotActive.selector);
        borrowerOperations.setInterestIndividualDelegate(troveId, C, 1e16, 20e16, 0, 0, 0, 10000e18, 0);
        vm.stopPrank();
    }

    function testSetDelegateRevertsIfTroveIsZombie() public {
        vm.startPrank(B);
        borrowerOperations.registerBatchManager(1e16, 20e16, 5e16, 25e14, MIN_INTEREST_RATE_CHANGE_PERIOD);
        vm.stopPrank();

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);
        // Make trove zombie
        redeem(A, 4000e18);
        // Check A’s trove is zombie
        assertEq(troveManager.checkTroveIsZombie(troveId), true, "A trove should be zombie");

        // Set batch manager (B)
        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.TroveNotActive.selector);
        borrowerOperations.setInterestIndividualDelegate(troveId, C, 1e16, 20e16, 0, 0, 0, 10000e18, 0);
        vm.stopPrank();
    }

    function testSetDelegateRevertsIfMinTooLow() public {
        vm.startPrank(B);
        borrowerOperations.registerBatchManager(1e16, 20e16, 5e16, 25e14, MIN_INTEREST_RATE_CHANGE_PERIOD);
        vm.stopPrank();

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);
        // Set batch manager (B)
        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.InterestRateTooLow.selector);
        borrowerOperations.setInterestIndividualDelegate(troveId, C, 1e14, 20e16, 0, 0, 0, 10000e18, 0);
        vm.stopPrank();
    }

    function testSetDelegateRevertsIfMaxTooHigh() public {
        vm.startPrank(B);
        borrowerOperations.registerBatchManager(1e16, 20e16, 5e16, 25e14, MIN_INTEREST_RATE_CHANGE_PERIOD);
        vm.stopPrank();

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);
        // Set batch manager (B)
        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.InterestRateTooHigh.selector);
        borrowerOperations.setInterestIndividualDelegate(
            troveId, C, 1e16, uint128(MAX_ANNUAL_INTEREST_RATE) + 1, 0, 0, 0, 10000e18, 0
        );
        vm.stopPrank();
    }

    function testSetDelegateRevertsIfMinEqMax() public {
        vm.startPrank(B);
        borrowerOperations.registerBatchManager(1e16, 20e16, 5e16, 25e14, MIN_INTEREST_RATE_CHANGE_PERIOD);
        vm.stopPrank();

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);
        // Set batch manager (B)
        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.MinGeMax.selector);
        borrowerOperations.setInterestIndividualDelegate(troveId, C, 20e16, 20e16, 0, 0, 0, 10000e18, 0);
        vm.stopPrank();
    }

    function testSetDelegateRevertsIfMinGtMax() public {
        vm.startPrank(B);
        borrowerOperations.registerBatchManager(1e16, 20e16, 5e16, 25e14, MIN_INTEREST_RATE_CHANGE_PERIOD);
        vm.stopPrank();

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);
        // Set batch manager (B)
        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.MinGeMax.selector);
        borrowerOperations.setInterestIndividualDelegate(troveId, C, 21e16, 20e16, 0, 0, 0, 10000e18, 0);
        vm.stopPrank();
    }

    function testSetDelegateRevertsIfNewInterestRateNotInRangeBelow() public {
        vm.startPrank(B);
        borrowerOperations.registerBatchManager(1e16, 20e16, 5e16, 25e14, MIN_INTEREST_RATE_CHANGE_PERIOD);
        vm.stopPrank();

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);
        // Set batch manager (B)
        vm.startPrank(A);
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.stopPrank();

        // Try to switch to individual delegate (C) along with new interest
        uint256 newAnnualInterestRate = 1e14;
        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.InterestRateTooLow.selector);
        borrowerOperations.setInterestIndividualDelegate(
            troveId, C, 1e16, 20e16, newAnnualInterestRate, 0, 0, 10000e18, 0
        );
        vm.stopPrank();
    }

    function testSetDelegateRevertsIfNewInterestRateNotInRangeAbove() public {
        vm.startPrank(B);
        borrowerOperations.registerBatchManager(1e16, 20e16, 5e16, 25e14, MIN_INTEREST_RATE_CHANGE_PERIOD);
        vm.stopPrank();

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);
        // Set batch manager (B)
        vm.startPrank(A);
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.stopPrank();

        // Try to switch to individual delegate (C) along with new interest
        uint256 newAnnualInterestRate = MAX_ANNUAL_INTEREST_RATE + 1;
        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.InterestRateTooHigh.selector);
        borrowerOperations.setInterestIndividualDelegate(
            troveId, C, 1e16, 20e16, newAnnualInterestRate, 0, 0, 10000e18, 0
        );
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
        borrowerOperations.setInterestIndividualDelegate(
            troveId, C, 1e16, 20e16, newAnnualInterestRate, 0, 0, 10000e18, 0
        );
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

    function testBorrowerCanSetDelegatesMinInterestRateChangePeriod() public {
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        uint256 minInterestRateChangePeriod = 7 days;

        IBorrowerOperations.InterestIndividualDelegate memory delegate =
            borrowerOperations.getInterestIndividualDelegateOf(troveId);
        assertEq(delegate.minInterestRateChangePeriod, 0);

        vm.startPrank(A);
        borrowerOperations.setInterestIndividualDelegate(
            troveId, B, 1e16, 20e16, 0, 0, 0, 0, minInterestRateChangePeriod
        );
        vm.stopPrank();

        // Confirm delegate has a min change period set
        delegate = borrowerOperations.getInterestIndividualDelegateOf(troveId);
        assertEq(delegate.minInterestRateChangePeriod, minInterestRateChangePeriod);
    }

    function testAfterOpenTroveDelegateCantAdjustInterestRateUntilMinPeriodHasPassed() public {
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        uint256 minInterestRateChangePeriod = 7 days;

        vm.startPrank(A);
        borrowerOperations.setInterestIndividualDelegate(
            troveId, B, 1e16, 20e16, 0, 0, 0, 0, minInterestRateChangePeriod
        );
        vm.stopPrank();

        // insufficient time since last rate adjustment
        vm.warp(block.timestamp + minInterestRateChangePeriod - 1 days);

        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.DelegateInterestRateChangePeriodNotPassed.selector);
        borrowerOperations.adjustTroveInterestRate(troveId, 10e16, 0, 0, 1e24);
    }

    function testAfterBorrowerAdjustTroveDelegateCantAdjustInterestRateUntilMinPeriodHasPassed() public {
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        uint256 minInterestRateChangePeriod = 7 days;

        vm.startPrank(A);
        borrowerOperations.setInterestIndividualDelegate(
            troveId, B, 1e16, 20e16, 0, 0, 0, 0, minInterestRateChangePeriod
        );
        vm.warp(block.timestamp + 7 days);

        borrowerOperations.adjustTroveInterestRate(troveId, 10e16, 0, 0, 1e24);
        vm.stopPrank();

        // insufficient time since last rate adjustment
        vm.warp(block.timestamp + minInterestRateChangePeriod - 1 days);

        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.DelegateInterestRateChangePeriodNotPassed.selector);
        borrowerOperations.adjustTroveInterestRate(troveId, 11e16, 0, 0, 1e24);
    }

    function testAfterDelegateAdjustsRateCantAdjustInterestRateUntilMinPeriodHasPassed() public {
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        uint256 minInterestRateChangePeriod = 7 days;

        vm.startPrank(A);
        borrowerOperations.setInterestIndividualDelegate(
            troveId, B, 1e16, 20e16, 0, 0, 0, 0, minInterestRateChangePeriod
        );
        vm.stopPrank();

        vm.warp(block.timestamp + 7 days);

        vm.startPrank(B);
        // Delegate adjusts rate initially
        borrowerOperations.adjustTroveInterestRate(troveId, 10e16, 0, 0, 1e24);

        // insufficient time since last rate adjustment
        vm.warp(block.timestamp + minInterestRateChangePeriod - 1 days);

        vm.expectRevert(BorrowerOperations.DelegateInterestRateChangePeriodNotPassed.selector);
        borrowerOperations.adjustTroveInterestRate(troveId, 11e16, 0, 0, 1e24);
    }

    // ---

    function testAfterOpenTroveDelegateCanAdjustInterestRateAfterMinPeriodHasPassed() public {
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        uint256 minInterestRateChangePeriod = 7 days;

        vm.startPrank(A);
        borrowerOperations.setInterestIndividualDelegate(
            troveId, B, 1e16, 20e16, 0, 0, 0, 0, minInterestRateChangePeriod
        );
        vm.stopPrank();

        // min period passes
        vm.warp(block.timestamp + minInterestRateChangePeriod);

        vm.startPrank(B);
        borrowerOperations.adjustTroveInterestRate(troveId, 10e16, 0, 0, 1e24);

        // Confirm B successfully changed A's rate
        LatestTroveData memory trove = troveManager.getLatestTroveData(troveId);
        assertEq(trove.annualInterestRate, 10e16);
    }

    function testAfterBorrowerAdjustTroveDelegateCanAdjustInterestRateAfterMinPeriodHasPassed() public {
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        uint256 minInterestRateChangePeriod = 7 days;

        vm.startPrank(A);
        borrowerOperations.setInterestIndividualDelegate(
            troveId, B, 1e16, 20e16, 0, 0, 0, 0, minInterestRateChangePeriod
        );
        vm.warp(block.timestamp + 7 days);

        borrowerOperations.adjustTroveInterestRate(troveId, 10e16, 0, 0, 1e24);
        vm.stopPrank();

        // min period passes
        vm.warp(block.timestamp + minInterestRateChangePeriod);

        vm.startPrank(B);
        borrowerOperations.adjustTroveInterestRate(troveId, 11e16, 0, 0, 1e24);

        // Confirm B successfully changed A's rate
        LatestTroveData memory trove = troveManager.getLatestTroveData(troveId);
        assertEq(trove.annualInterestRate, 11e16);
    }

    function testAfterDelegateAdjustsRateTheyCanAdjustInterestRateAgainAfterMinPeriodHasPassed() public {
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        uint256 minInterestRateChangePeriod = 7 days;

        vm.startPrank(A);
        borrowerOperations.setInterestIndividualDelegate(
            troveId, B, 1e16, 20e16, 0, 0, 0, 0, minInterestRateChangePeriod
        );
        vm.stopPrank();

        vm.warp(block.timestamp + 7 days);

        vm.startPrank(B);
        // Delegate adjusts rate initially
        borrowerOperations.adjustTroveInterestRate(troveId, 10e16, 0, 0, 1e24);

        // min period passes
        vm.warp(block.timestamp + minInterestRateChangePeriod);

        // Delegate adjusts again
        borrowerOperations.adjustTroveInterestRate(troveId, 11e16, 0, 0, 1e24);

        // Confirm B successfully changed A's rate
        LatestTroveData memory trove = troveManager.getLatestTroveData(troveId);
        assertEq(trove.annualInterestRate, 11e16);
    }
}
