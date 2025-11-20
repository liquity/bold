// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "src/Dependencies/AddRemoveManagers.sol";
import "./TestContracts/DevTestSetup.sol";

contract InterestBatchManagementTest is DevTestSetup {
    function testCannotSetExsitingBatchManager() public {
        registerBatchManager(B);

        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.BatchManagerExists.selector);
        borrowerOperations.registerBatchManager(1e16, 20e16, 5e16, 25e14, 0);
        vm.stopPrank();
    }

    function testCannotAdjustInterestOfBatchedTrove() public {
        uint256 troveId = openTroveAndJoinBatchManager();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.TroveInBatch.selector);
        borrowerOperations.adjustTroveInterestRate(troveId, 10e16, 0, 0, 10000e18);
        vm.stopPrank();
    }

    function testSetsBatchManagerProperlyOnOpen() public {
        uint256 troveId = openTroveAndJoinBatchManager();

        address batchManagerAddress = borrowerOperations.interestBatchManagerOf(troveId);
        assertEq(batchManagerAddress, B, "Wrong batch manager in BO");
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(troveId);
        assertEq(tmBatchManagerAddress, B, "Wrong batch manager in TM");

        IBorrowerOperations.InterestBatchManager memory batchManager =
            borrowerOperations.getInterestBatchManager(batchManagerAddress);
        assertEq(batchManager.minInterestRate, 1e16, "Wrong min interest");
        assertEq(batchManager.maxInterestRate, 20e16, "Wrong max interest");
        assertEq(batchManager.minInterestRateChangePeriod, MIN_INTEREST_RATE_CHANGE_PERIOD, "Wrong min change period");
        LatestBatchData memory batch = troveManager.getLatestBatchData(batchManagerAddress);
        assertEq(batch.annualManagementFee, 25e14, "Wrong fee");
    }

    function testSetsBatchManagerProperlyAfterOpening() public {
        registerBatchManager(B);

        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        vm.startPrank(A);
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.stopPrank();

        address batchManagerAddress = borrowerOperations.interestBatchManagerOf(troveId);
        assertEq(batchManagerAddress, B, "Wrong batch manager in BO");
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(troveId);
        assertEq(tmBatchManagerAddress, B, "Wrong batch manager in TM");

        IBorrowerOperations.InterestBatchManager memory batchManager =
            borrowerOperations.getInterestBatchManager(batchManagerAddress);
        assertEq(batchManager.minInterestRate, 1e16, "Wrong min interest");
        assertEq(batchManager.maxInterestRate, 20e16, "Wrong max interest");
        assertEq(batchManager.minInterestRateChangePeriod, MIN_INTEREST_RATE_CHANGE_PERIOD, "Wrong min change period");
        LatestBatchData memory batch = troveManager.getLatestBatchData(batchManagerAddress);
        assertEq(batch.annualManagementFee, 25e14, "Wrong fee");
    }

    function testCannotSetBatchManagerIfTroveDoesNotExist() public {
        registerBatchManager(B);

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.TroveNotActive.selector);
        borrowerOperations.setInterestBatchManager(addressToTroveId(A), B, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testCannotSetBatchManagerIfTroveIsClosed() public {
        registerBatchManager(B);

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);
        // Open another trove so that we can close the first one
        openTroveNoHints100pct(B, 100e18, 5000e18, 5e16);

        // Close trove
        deal(address(boldToken), A, 6000e18); // Needs more Bold for interest and upfront fee
        closeTrove(A, troveId);

        // Try to set interest batch manager
        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.TroveNotActive.selector);
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testCannotSetBatchManagerIfTroveIsLiquidated() public {
        priceFeed.setPrice(2000e18);
        registerBatchManager(B);

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 5e18, 5000e18, 5e16);
        // Open another trove so that we can liquidate the first one
        openTroveNoHints100pct(B, 100e18, 5000e18, 5e16);

        // Price goes down
        priceFeed.setPrice(1050e18);

        // Close trove
        liquidate(A, troveId);

        // Try to set interest batch manager
        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.TroveNotActive.selector);
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testCannotSetBatchManagerIfTroveIsZombie() public {
        registerBatchManager(B);

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        // Redeem from trove
        redeem(A, 4000e18);

        // Try to set interest batch manager
        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.TroveNotActive.selector);
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testRemovesBatchManagerProperlyWithDifferentNewInterestRate() public {
        uint256 troveId = openTroveAndJoinBatchManager();
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(troveId);
        LatestTroveData memory trove = troveManager.getLatestTroveData(troveId);
        uint256 annualInterestRate = trove.annualInterestRate;

        uint256 newAnnualInterestRate = 4e16;
        assertEq(tmBatchManagerAddress, B, "Wrong batch manager in TM");
        assertNotEq(newAnnualInterestRate, annualInterestRate, "New interest rate should be different");

        vm.startPrank(A);
        borrowerOperations.removeFromBatch(troveId, newAnnualInterestRate, 0, 0, 1e24);
        vm.stopPrank();

        assertEq(borrowerOperations.interestBatchManagerOf(troveId), address(0), "Wrong batch manager in BO");
        (,,,,,,, annualInterestRate, tmBatchManagerAddress,) = troveManager.Troves(troveId);
        assertEq(tmBatchManagerAddress, address(0), "Wrong batch manager in TM");
        assertEq(annualInterestRate, newAnnualInterestRate, "Wrong interest rate");
    }

    function testRemovesBatchManagerProperlyWithSameNewInterestRate() public {
        uint256 troveId = openTroveAndJoinBatchManager();
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(troveId);
        LatestTroveData memory trove = troveManager.getLatestTroveData(troveId);
        uint256 annualInterestRate = trove.annualInterestRate;

        uint256 newAnnualInterestRate = 5e16;
        assertEq(tmBatchManagerAddress, B, "Wrong batch manager in TM");
        assertEq(newAnnualInterestRate, annualInterestRate, "New interest rate should be the same");

        vm.startPrank(A);
        borrowerOperations.removeFromBatch(troveId, newAnnualInterestRate, 0, 0, 1e24);
        vm.stopPrank();

        assertEq(borrowerOperations.interestBatchManagerOf(troveId), address(0), "Wrong batch manager in BO");
        (,,,,,,, annualInterestRate, tmBatchManagerAddress,) = troveManager.Troves(troveId);
        assertEq(tmBatchManagerAddress, address(0), "It should not have batch manager in TM");
        assertEq(annualInterestRate, newAnnualInterestRate, "Wrong interest rate");
    }

    function testRemoveBatchManagerFailsIfNewRateIsTooLow() public {
        uint256 troveId = openTroveAndJoinBatchManager();
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(troveId);
        LatestTroveData memory trove = troveManager.getLatestTroveData(troveId);
        uint256 annualInterestRate = trove.annualInterestRate;

        uint256 newAnnualInterestRate = 4e15;
        assertEq(tmBatchManagerAddress, B, "Wrong batch manager in TM");
        assertNotEq(newAnnualInterestRate, annualInterestRate, "New interest rate should be different");

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.InterestRateTooLow.selector);
        borrowerOperations.removeFromBatch(troveId, newAnnualInterestRate, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testRemoveBatchManagerFailsIfNewRateIsTooHigh() public {
        uint256 troveId = openTroveAndJoinBatchManager();
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(troveId);
        LatestTroveData memory trove = troveManager.getLatestTroveData(troveId);
        uint256 annualInterestRate = trove.annualInterestRate;

        uint256 newAnnualInterestRate = MAX_ANNUAL_INTEREST_RATE + 1;
        assertEq(tmBatchManagerAddress, B, "Wrong batch manager in TM");
        assertNotEq(newAnnualInterestRate, annualInterestRate, "New interest rate should be different");

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.InterestRateTooHigh.selector);
        borrowerOperations.removeFromBatch(troveId, newAnnualInterestRate, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testRemoveBatchManagerFailsIfTroveNotInBatch() public {
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(troveId);

        uint256 newAnnualInterestRate = 4e16;
        assertEq(tmBatchManagerAddress, address(0), "Wrong batch manager in TM");

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.TroveNotInBatch.selector);
        borrowerOperations.removeFromBatch(troveId, newAnnualInterestRate, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testOnlyBorrowerCanSetBatchManager() public {
        registerBatchManager(A);
        registerBatchManager(B);
        registerBatchManager(C);

        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        vm.startPrank(B);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.setInterestBatchManager(troveId, A, 0, 0, 1e24);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.setInterestBatchManager(troveId, C, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testCannotSetUnregisteredBatchManager() public {
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.InvalidInterestBatchManager.selector);
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testSetBatchManagerRemovesIndividualDelegate() public {
        vm.startPrank(B);
        borrowerOperations.registerBatchManager(1e16, 20e16, 5e16, 25e14, MIN_INTEREST_RATE_CHANGE_PERIOD);
        vm.stopPrank();

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);
        // Set individual delegate (C)
        vm.startPrank(A);
        borrowerOperations.setInterestIndividualDelegate(troveId, C, 1e16, 20e16, 0, 0, 0, 0, 0);
        vm.stopPrank();

        IBorrowerOperations.InterestIndividualDelegate memory delegate =
            borrowerOperations.getInterestIndividualDelegateOf(troveId);
        assertEq(borrowerOperations.interestBatchManagerOf(troveId), address(0), "Batch manager should be empty");
        assertEq(delegate.account, C, "Wrong individual delegate");

        // Switch batch manager (B)
        vm.startPrank(A);
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.stopPrank();

        delegate = borrowerOperations.getInterestIndividualDelegateOf(troveId);
        assertEq(borrowerOperations.interestBatchManagerOf(troveId), B, "Wrong batch manager");
        assertEq(delegate.account, address(0), "Individual delegate should be empty");
    }

    function testLowerBatchManagementFee() public {
        uint256 troveId = openTroveAndJoinBatchManager();

        // Fast forward 1 year
        vm.warp(block.timestamp + 365 days);

        uint256 ATroveRecordedDebtBefore = troveManager.getTroveDebt(troveId);
        uint256 ATroveEntireDebtBefore = troveManager.getTroveEntireDebt(troveId);
        assertGt(ATroveEntireDebtBefore, ATroveRecordedDebtBefore, "Trove entire debt should be greater than recorded");
        LatestBatchData memory batch = troveManager.getLatestBatchData(B);
        uint256 batchRecordedDebtBefore = batch.recordedDebt;
        uint256 batchEntireDebtBefore = batch.entireDebtWithoutRedistribution;
        assertGt(batchEntireDebtBefore, batchRecordedDebtBefore, "Batch entire debt should be greater than recorded");

        vm.startPrank(B);
        borrowerOperations.lowerBatchManagementFee(10e14);
        vm.stopPrank();

        // Check interest and fee were applied
        assertEq(troveManager.getTroveDebt(troveId), ATroveEntireDebtBefore, "Interest was not applied to trove");
        assertEq(
            troveManager.getTroveDebt(troveId),
            troveManager.getTroveEntireDebt(troveId),
            "Trove recorded debt should be equal to entire"
        );
        batch = troveManager.getLatestBatchData(B);
        assertEq(batch.recordedDebt, batchEntireDebtBefore, "Interest was not applied to batch");
        assertEq(
            batch.recordedDebt, batch.entireDebtWithoutRedistribution, "Batch recorded debt should be equal to entire"
        );

        // Check new fee
        assertEq(batch.annualManagementFee, 10e14, "Wrong batch management fee");
    }

    function testOnlyBatchManagerCanLowerBatchManagementFee() public {
        openTroveAndJoinBatchManager();

        vm.startPrank(C);
        vm.expectRevert(BorrowerOperations.InvalidInterestBatchManager.selector);
        borrowerOperations.lowerBatchManagementFee(10e14);
        vm.stopPrank();
    }

    function testCannotIncreaseBatchManagementFee() public {
        openTroveAndJoinBatchManager();

        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.NewFeeNotLower.selector);
        borrowerOperations.lowerBatchManagementFee(50e14);
        vm.stopPrank();
    }

    function testLowerBatchManagementFeeDoesNotApplyRedistributionGains() public {
        uint256 ATroveId = openTroveAndJoinBatchManager();

        // TODO: Generate redistributions and check below
        // Open a trove to be liquidated and redistributed
        priceFeed.setPrice(2000e18);
        uint256 CTroveId = openTroveNoHints100pct(C, 2.1 ether, 2000e18, 5e16);
        // Price goes down
        priceFeed.setPrice(1000e18);
        // C is liquidated
        liquidate(A, CTroveId);

        // Check A has redistribution gains
        LatestTroveData memory troveData = troveManager.getLatestTroveData(ATroveId);
        assertGt(troveData.redistBoldDebtGain, 0, "A should have redist gains");

        uint256 troveRecordedDebtBefore = troveData.recordedDebt;

        vm.startPrank(B);
        borrowerOperations.lowerBatchManagementFee(10e14);
        vm.stopPrank();

        troveData = troveManager.getLatestTroveData(ATroveId);
        assertGt(troveData.redistBoldDebtGain, 0, "A should have redist gains");
        assertEq(troveData.recordedDebt, troveRecordedDebtBefore, "Recorded debt should stay the same");
    }

    function testChangeBatchInterestRate() public {
        uint256 troveId = openTroveAndJoinBatchManager();

        // Fast forward 1 year
        vm.warp(block.timestamp + 365 days);

        uint256 ATroveRecordedDebtBefore = troveManager.getTroveDebt(troveId);
        uint256 ATroveEntireDebtBefore = troveManager.getTroveEntireDebt(troveId);
        assertGt(ATroveEntireDebtBefore, ATroveRecordedDebtBefore, "Trove entire debt should be greater than recorded");
        LatestBatchData memory batch = troveManager.getLatestBatchData(B);
        uint256 batchRecordedDebtBefore = batch.recordedDebt;
        uint256 batchEntireDebtBefore = batch.entireDebtWithoutRedistribution;
        assertGt(batchEntireDebtBefore, batchRecordedDebtBefore, "Batch entire debt should be greater than recorded");

        vm.startPrank(B);
        borrowerOperations.setBatchManagerAnnualInterestRate(6e16, 0, 0, 100000e18);
        vm.stopPrank();

        // Check interest was applied
        assertEq(troveManager.getTroveDebt(troveId), ATroveEntireDebtBefore, "Interest was not applied to trove");
        assertEq(
            troveManager.getTroveDebt(troveId),
            troveManager.getTroveEntireDebt(troveId),
            "Trove recorded debt should be equal to entire"
        );
        batch = troveManager.getLatestBatchData(B);
        assertEq(batch.recordedDebt, batchEntireDebtBefore, "Interest was not applied to batch");
        assertEq(
            batch.recordedDebt, batch.entireDebtWithoutRedistribution, "Batch recorded debt should be equal to entire"
        );

        // Check new interest rate
        assertEq(troveManager.getBatchAnnualInterestRate(B), 6e16, "Wrong batch interest rate");
    }

    function testOnlyBatchManagerCanChangeBatchInterestRate() public {
        openTroveAndJoinBatchManager();

        vm.startPrank(C);
        vm.expectRevert(BorrowerOperations.InvalidInterestBatchManager.selector);
        borrowerOperations.setBatchManagerAnnualInterestRate(6e16, 0, 0, 100000e18);
        vm.stopPrank();
    }

    function testCannotChangeBatchToWrongInterestRate() public {
        openTroveAndJoinBatchManager();

        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.InterestNotInRange.selector);
        borrowerOperations.setBatchManagerAnnualInterestRate(0, 0, 0, 100000e18);
        vm.expectRevert(BorrowerOperations.InterestNotInRange.selector);
        borrowerOperations.setBatchManagerAnnualInterestRate(2e18, 0, 0, 100000e18);
        vm.stopPrank();
    }

    function testCannotChangeBatchInterestRateOutsideOwnRange() public {
        openTroveAndJoinBatchManager();

        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.InterestNotInRange.selector);
        borrowerOperations.setBatchManagerAnnualInterestRate(uint128(MIN_ANNUAL_INTEREST_RATE), 0, 0, 100000e18);
        vm.expectRevert(BorrowerOperations.InterestNotInRange.selector);
        borrowerOperations.setBatchManagerAnnualInterestRate(21e16, 0, 0, 100000e18);
        vm.stopPrank();
    }

    function testChangeBatchInterestRateDoesNotApplyRedistributionGains() public {
        uint256 ATroveId = openTroveAndJoinBatchManager();

        // TODO: Generate redistributions and check below
        // Open a trove to be liquidated and redistributed
        priceFeed.setPrice(2000e18);
        uint256 CTroveId = openTroveNoHints100pct(C, 2.1 ether, 2000e18, 5e16);
        // Price goes down
        priceFeed.setPrice(1000e18);
        // C is liquidated
        liquidate(A, CTroveId);

        // Check A has redistribution gains
        LatestTroveData memory troveData = troveManager.getLatestTroveData(ATroveId);
        assertGt(troveData.redistBoldDebtGain, 0, "A should have redist gains");

        troveData = troveManager.getLatestTroveData(ATroveId);

        uint256 troveRecordedDebtBefore = troveData.recordedDebt;

        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1 days);
        troveData = troveManager.getLatestTroveData(ATroveId);

        uint256 troveAccruedInterest = troveManager.calcTroveAccruedInterest(ATroveId);
        uint256 batchAccruedManagementFee = troveManager.calcBatchAccruedManagementFee(B);
        vm.startPrank(B);
        borrowerOperations.setBatchManagerAnnualInterestRate(6e16, 0, 0, 100000e18);
        vm.stopPrank();
        troveData = troveManager.getLatestTroveData(ATroveId);

        troveData = troveManager.getLatestTroveData(ATroveId);
        assertGt(troveData.redistBoldDebtGain, 0, "A should have redist gains");
        assertEq(
            troveData.recordedDebt,
            troveRecordedDebtBefore + troveAccruedInterest + batchAccruedManagementFee,
            "Recorded debt mismatch"
        );
    }

    function testSwitchFromOldToNewBatchManager() public {
        ABCDEF memory troveIDs;
        ABCDEF memory troveRecordedDebtBefore;
        ABCDEF memory troveEntireDebtBefore;
        ABCDEF memory batchRecordedDebtBefore;
        ABCDEF memory batchEntireDebtBefore;

        troveIDs.A = openTroveAndJoinBatchManager();

        // Register a new batch manager and add a trove to it
        registerBatchManager(C);
        IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams memory paramsD = IBorrowerOperations
            .OpenTroveAndJoinInterestBatchManagerParams({
            owner: D,
            ownerIndex: 0,
            collAmount: 100e18,
            boldAmount: 5000e18,
            upperHint: 0,
            lowerHint: 0,
            interestBatchManager: C,
            maxUpfrontFee: 1e24,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(D);
        troveIDs.D = borrowerOperations.openTroveAndJoinInterestBatchManager(paramsD);
        vm.stopPrank();

        // Add a new trove to first manager
        IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams memory paramsE = IBorrowerOperations
            .OpenTroveAndJoinInterestBatchManagerParams({
            owner: E,
            ownerIndex: 0,
            collAmount: 100e18,
            boldAmount: 5000e18,
            upperHint: 0,
            lowerHint: 0,
            interestBatchManager: B,
            maxUpfrontFee: 1e24,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(E);
        troveIDs.E = borrowerOperations.openTroveAndJoinInterestBatchManager(paramsE);
        vm.stopPrank();

        // Fast forward 1 year
        vm.warp(block.timestamp + 365 days);

        // debts before
        troveRecordedDebtBefore.A = troveManager.getTroveDebt(troveIDs.A);
        troveEntireDebtBefore.A = troveManager.getTroveEntireDebt(troveIDs.A);
        assertGt(
            troveEntireDebtBefore.A, troveRecordedDebtBefore.A, "Trove A entire debt should be greater than recorded"
        );

        troveRecordedDebtBefore.D = troveManager.getTroveDebt(troveIDs.D);
        troveEntireDebtBefore.D = troveManager.getTroveEntireDebt(troveIDs.D);
        assertGt(
            troveEntireDebtBefore.D, troveRecordedDebtBefore.D, "Trove D entire debt should be greater than recorded"
        );

        troveRecordedDebtBefore.E = troveManager.getTroveDebt(troveIDs.E);
        troveEntireDebtBefore.E = troveManager.getTroveEntireDebt(troveIDs.E);
        assertGt(
            troveEntireDebtBefore.E, troveRecordedDebtBefore.E, "Trove E entire debt should be greater than recorded"
        );

        LatestBatchData memory batchB = troveManager.getLatestBatchData(B);
        batchRecordedDebtBefore.B = batchB.recordedDebt;
        batchEntireDebtBefore.B = batchB.entireDebtWithoutRedistribution;
        assertGt(
            batchEntireDebtBefore.B, batchRecordedDebtBefore.B, "Batch B entire debt should be greater than recorded"
        );

        LatestBatchData memory batchC = troveManager.getLatestBatchData(C);
        batchRecordedDebtBefore.C = batchC.recordedDebt;
        batchEntireDebtBefore.C = batchC.entireDebtWithoutRedistribution;
        assertGt(
            batchEntireDebtBefore.C, batchRecordedDebtBefore.C, "Batch C entire debt should be greater than recorded"
        );

        // Move the last trove from B to C
        //switchBatchManager(E, troveIDs.E, C);
        removeFromBatch(E, troveIDs.E, 5e16);
        uint256 upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveIDs.E, C);
        setInterestBatchManager(E, troveIDs.E, C);

        // Check new batch manager
        assertEq(borrowerOperations.interestBatchManagerOf(troveIDs.E), C, "Wrong batch manager in BO");
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(troveIDs.E);
        assertEq(tmBatchManagerAddress, C, "Wrong batch manager in TM");

        // Check interest was applied
        assertApproxEqAbs(
            troveManager.getTroveDebt(troveIDs.A), troveEntireDebtBefore.A, 10, "Interest was not applied to trove A"
        );
        assertEq(
            troveManager.getTroveDebt(troveIDs.A),
            troveManager.getTroveEntireDebt(troveIDs.A),
            "Trove A recorded debt should be equal to entire"
        );

        assertApproxEqAbs(
            troveManager.getTroveDebt(troveIDs.D), troveEntireDebtBefore.D, 1, "Interest was not applied to trove D"
        );
        assertEq(
            troveManager.getTroveDebt(troveIDs.D),
            troveManager.getTroveEntireDebt(troveIDs.D),
            "Trove D recorded debt should be equal to entire"
        );

        assertApproxEqAbs(
            troveManager.getTroveDebt(troveIDs.E),
            troveEntireDebtBefore.E + upfrontFee,
            1,
            "Interest was not applied to trove E"
        );
        assertEq(
            troveManager.getTroveDebt(troveIDs.E),
            troveManager.getTroveEntireDebt(troveIDs.E),
            "Trove E recorded debt should be equal to entire"
        );

        batchB = troveManager.getLatestBatchData(B);
        assertEq(
            batchB.recordedDebt,
            batchEntireDebtBefore.B - troveEntireDebtBefore.E,
            "Interest was not applied to batch B"
        );
        assertEq(
            batchB.recordedDebt,
            batchB.entireDebtWithoutRedistribution,
            "Batch B recorded debt should be equal to entire"
        );

        batchC = troveManager.getLatestBatchData(C);
        assertEq(
            batchC.recordedDebt,
            batchEntireDebtBefore.C + troveEntireDebtBefore.E + upfrontFee,
            "Interest was not applied to batch C"
        );
        assertEq(
            batchC.recordedDebt,
            batchC.entireDebtWithoutRedistribution,
            "Batch C recorded debt should be equal to entire"
        );
    }

    // --- applyBatchInterestAndFeePermissionless ---
    // (Now this is included in applyPendingDebt)

    function testApplyTroveInterestPermissionlessUpdatesRedistributionIfInBatch() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveAndJoinBatchManager(A, 3 ether, troveDebtRequest, B, interestRate);

        // Open a trove to be liquidated and redistributed
        uint256 CTroveId = openTroveNoHints100pct(C, 2.1 ether, 2000e18, interestRate);
        // Price goes down
        priceFeed.setPrice(1000e18);
        // C is liquidated
        LatestTroveData memory troveData = troveManager.getLatestTroveData(ATroveId);
        uint256 initialEntireDebt = troveData.entireDebt;
        LatestTroveData memory troveDataC = troveManager.getLatestTroveData(CTroveId);
        uint256 entireDebtC = troveDataC.entireDebt;
        liquidate(A, CTroveId);

        // Check A has redistribution gains
        troveData = troveManager.getLatestTroveData(ATroveId);
        assertGt(troveData.redistBoldDebtGain, 0, "A should have redist gains");

        // Fast-forward time
        vm.warp(block.timestamp + 91 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        troveData = troveManager.getLatestTroveData(ATroveId);
        uint256 accruedInterest = troveData.accruedInterest;
        uint256 accruedBatchManagementFee = troveData.accruedBatchManagementFee;
        // B applies A's pending interest
        vm.startPrank(B);
        borrowerOperations.applyPendingDebt(ATroveId);
        vm.stopPrank();

        troveData = troveManager.getLatestTroveData(ATroveId);
        assertEq(troveData.entireDebt, initialEntireDebt + accruedInterest + accruedBatchManagementFee + entireDebtC);
    }

    function testApplyBatchInterestPermissionlessSetsLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveAndJoinBatchManager(A, 3 ether, troveDebtRequest, B, interestRate);

        // Fast-forward time
        vm.warp(block.timestamp + 600);

        assertLt(troveManager.getBatchLastDebtUpdateTime(B), block.timestamp);
        assertLt(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        // C applies batch B's pending interest
        applyPendingDebt(C, ATroveId);

        assertEq(troveManager.getBatchLastDebtUpdateTime(B), block.timestamp);
        assertEq(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);
    }

    function testApplyBatchInterestPermissionlessReducesAccruedInterestTo0() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveAndJoinBatchManager(A, 3 ether, troveDebtRequest, B, interestRate);

        // Fast-forward time
        vm.warp(block.timestamp + 600);

        assertGt(troveManager.calcBatchAccruedInterest(B), 0, "Batch should have accrued interest");
        assertGt(troveManager.calcTroveAccruedInterest(ATroveId), 0, "Trove should have accrued interest");

        // C applies batch B's pending interest
        applyPendingDebt(C, ATroveId);

        assertEq(troveManager.calcBatchAccruedInterest(B), 0, "Batch should not have accrued interest");
        assertEq(troveManager.calcTroveAccruedInterest(ATroveId), 0, "Trove should not have accrued interest");
    }

    function testApplyBatchInterestPermissionlessDoesntChangeEntireDebt() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveAndJoinBatchManager(A, 3 ether, troveDebtRequest, B, interestRate);

        // Fast-forward time
        vm.warp(block.timestamp + 600);

        LatestBatchData memory batch = troveManager.getLatestBatchData(B);
        uint256 entireBatchDebt_1 = batch.entireDebtWithoutRedistribution;
        assertGt(entireBatchDebt_1, 0);
        uint256 entireTroveDebt_1 = troveManager.getTroveEntireDebt(ATroveId);
        assertGt(entireTroveDebt_1, 0);

        // C applies batch B's pending interest
        applyPendingDebt(C, ATroveId);

        batch = troveManager.getLatestBatchData(B);
        uint256 entireBatchDebt_2 = batch.entireDebtWithoutRedistribution;
        assertEq(entireBatchDebt_2, entireBatchDebt_1, "Batch entire debt mismatch");
        uint256 entireTroveDebt_2 = troveManager.getTroveEntireDebt(ATroveId);
        assertEq(entireTroveDebt_2, entireTroveDebt_1, "Trove entire debt mismatch");
    }

    function testApplyBatchInterestPermissionlessIncreasesRecordedDebtByAccruedInterest() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveAndJoinBatchManager(A, 3 ether, troveDebtRequest, B, interestRate);

        // Fast-forward time
        vm.warp(block.timestamp + 600);

        LatestBatchData memory batch = troveManager.getLatestBatchData(B);
        uint256 recordedBatchDebt_1 = batch.recordedDebt;
        uint256 accruedBatchInterest = troveManager.calcBatchAccruedInterest(B);
        uint256 accruedBatchManagementFee = troveManager.calcBatchAccruedManagementFee(B);
        uint256 recordedTroveDebt_1 = troveManager.getTroveDebt(ATroveId);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(ATroveId);
        uint256 accruedTroveFee = troveManager.calcTroveAccruedBatchManagementFee(ATroveId);

        // C applies batch B's pending interest
        applyPendingDebt(C, ATroveId);

        batch = troveManager.getLatestBatchData(B);
        uint256 recordedBatchDebt_2 = batch.recordedDebt;
        uint256 recordedTroveDebt_2 = troveManager.getTroveDebt(ATroveId);

        assertEq(recordedBatchDebt_2, recordedBatchDebt_1 + accruedBatchInterest + accruedBatchManagementFee);
        assertEq(recordedTroveDebt_2, recordedTroveDebt_1 + accruedTroveInterest + accruedTroveFee);
    }

    function testApplyBatchInterestPermissionlessReinsertsIntoSortedTrovesIfInBatch() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveAndJoinBatchManager(A, 3 ether, troveDebtRequest, B, interestRate);
        assertEq(sortedTroves.contains(ATroveId), true, "SortedTroves should have trove A ");
        assertEq(sortedTroves.isBatchedNode(ATroveId), true, "A should be batched in SortedTroves");

        // redeem from A
        redeem(A, 500e18);

        // Check A is zombie
        assertEq(uint8(troveManager.getTroveStatus(ATroveId)), uint8(ITroveManager.Status.zombie));

        // Fast-forward time
        vm.warp(block.timestamp + 3650 days);

        // C applies batch B's pending interest
        applyPendingDebt(C, ATroveId);

        // Check properly activaded and re-inserted
        assertEq(
            uint8(troveManager.getTroveStatus(ATroveId)), uint8(ITroveManager.Status.active), "A should not be zombie"
        );
        assertEq(sortedTroves.contains(ATroveId), true, "SortedTroves should have trove A ");
        assertEq(sortedTroves.isBatchedNode(ATroveId), true, "A should be batched in SortedTroves");
        address batchManagerAddress = borrowerOperations.interestBatchManagerOf(ATroveId);
        assertEq(batchManagerAddress, B, "Wrong batch manager in BO");
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(ATroveId);
        assertEq(tmBatchManagerAddress, B, "Wrong batch manager in TM");
    }

    function testJoinBatchBatchManagerChargesUpfrontFeeIfTroveShortChangeBatchNotSameInterestRate() public {
        // B registers as batch manager
        registerBatchManager(B, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 5e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);
        // Cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1);

        // A opens trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveId, B);
        assertGt(upfrontFee, 0, "Upfront fee should be > 0");

        // A joins B
        setInterestBatchManager(A, troveId, B);

        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee,
            1e14,
            "A debt should have increased by upfront fee"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");
    }

    function testJoinBatchBatchManagerChargesUpfrontFeeIfBatchShortChangeTroveNotSameInterestRate() public {
        // B registers as batch manager
        registerBatchManager(B, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 6e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);

        // A opens trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        // Cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1);

        // B changes interest rate
        setBatchInterestRate(B, 5e16);

        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveId, B);
        assertGt(upfrontFee, 0, "Upfront fee should be > 0");

        // A joins B
        setInterestBatchManager(A, troveId, B);

        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee,
            1e14,
            "A debt should have increased by upfront fee"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");
    }

    function testJoinBatchBatchManagerChargesUpfrontFeeIfTroveAndBatchShortChangeSameInterestRate() public {
        // B registers as batch manager
        registerBatchManager(B, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 4e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);
        // Cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1);

        // A opens trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        // B changes interest rate
        setBatchInterestRate(B, 5e16);

        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveId, B);
        assertGt(upfrontFee, 0, "Upfront fee should be > 0");

        // A joins B
        setInterestBatchManager(A, troveId, B);

        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee,
            1e14,
            "A debt should have increased by upfront fee"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");
    }

    function testJoinBatchBatchManagerDoesNotChargeUpfrontFeeIfNotTroveNorBatchShortChangeSameInterestRate() public {
        // B registers as batch manager
        registerBatchManager(B, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 6e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);

        // A opens trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        // Cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1);

        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveId, B);
        assertGt(upfrontFee, 0, "Upfront fee should be > 0");

        // A joins B
        setInterestBatchManager(A, troveId, B);

        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee,
            1e14,
            "A debt should have increased by upfront fee"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");
    }

    function testCannotGameUpfrontFeeByJoiningABatchAndChangingInterest() public {
        // B registers as batch manager
        registerBatchManager(B, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 5e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);

        // Interest rate change and cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + MIN_INTEREST_RATE_CHANGE_PERIOD + 1);

        // A opens trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveId, B);
        assertGt(upfrontFee, 0, "Upfront fee should be > 0");

        // A joins B
        setInterestBatchManager(A, troveId, B);

        // B changes interest rate
        setBatchInterestRate(B, 4e16);

        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee,
            1e14,
            "A debt should have increased by upfront fee"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");
    }

    function testJoinABatchWithSameInterestAndLeaveToSameInterestChargesUpfrontFeeOnlyOnce() public {
        // B registers as batch manager
        registerBatchManager(B, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 5e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);

        // Cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1);

        // A opens trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveId, B);
        assertGt(upfrontFee, 0, "Upfront fee should be > 0");

        // A joins B
        setInterestBatchManager(A, troveId, B);

        // A leaves B
        removeFromBatch(A, troveId, 5e16);

        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee,
            1e14,
            "A debt should have increased by upfront fee"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");
    }

    function testJoinABatchWithDifferentInterestAndLeaveToSameInterestChargesUpfrontFeeOnlyOnce() public {
        // B registers as batch manager
        registerBatchManager(B, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 5e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);

        // Cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1);

        // A opens trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 6e16);

        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveId, B);
        assertGt(upfrontFee, 0, "Upfront fee should be > 0");

        // A joins B
        setInterestBatchManager(A, troveId, B);

        // A leaves B
        removeFromBatch(A, troveId, 5e16);

        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee,
            1e14,
            "A debt should have increased by upfront fee"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");
    }

    function testJoinABatchWithSameInterestAndLeaveToDifferentInterestChargesUpfrontFeeTwice() public {
        // B registers as batch manager
        registerBatchManager(B, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 5e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);

        // Cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1);

        // A opens trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee1 = predictJoinBatchInterestRateUpfrontFee(troveId, B);
        assertGt(upfrontFee1, 0, "Upfront 1 fee should be > 0");

        // A joins B
        setInterestBatchManager(A, troveId, B);

        uint256 upfrontFee2 = predictAdjustInterestRateUpfrontFee(troveId, 4e16);
        assertGt(upfrontFee2, 0, "Upfront 2 fee should be > 0");

        // A leaves B
        removeFromBatch(A, troveId, 4e16);

        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee1 + upfrontFee2,
            1e14,
            "A debt should have increased by upfront fee twice"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");
    }

    function testJoinABatchWithDifferentInterestAndLeaveToDifferentInterestChargesUpfrontFeeTwice() public {
        // B registers as batch manager
        registerBatchManager(B, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 6e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);

        // Cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1);

        // A opens trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee1 = predictJoinBatchInterestRateUpfrontFee(troveId, B);
        assertGt(upfrontFee1, 0, "Upfront 1 fee should be > 0");

        // A joins B
        setInterestBatchManager(A, troveId, B);

        uint256 upfrontFee2 = predictAdjustInterestRateUpfrontFee(troveId, 4e16);
        assertGt(upfrontFee2, 0, "Upfront 2 fee should be > 0");

        // A leaves B
        removeFromBatch(A, troveId, 4e16);

        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee1 + upfrontFee2,
            1e14,
            "A debt should have increased by upfront fee twice"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");
    }

    function testSwitchBatchManagerChargesUpfrontFeeIfJoinedOldLessThanCooldownAgo() public {
        // C registers as batch manager
        registerBatchManager(C, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 5e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);
        // A opens trove and joins batch manager B (which has the same interest)
        uint256 troveId = openTroveAndJoinBatchManager(A, 100 ether, 2000e18, B, 5e16);

        // Cool down period not gone by yet
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN - 60);
        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveId, C);
        assertGt(upfrontFee, 0, "Upfront fee should be > 0");

        // Switch from B to C
        switchBatchManager(A, troveId, C);

        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee,
            1e14,
            "A debt should have increased by upfront fee"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");
    }

    function testSwitchBatchManagerChargesUpfrontFeeIfJoinedOldMoreThanCooldownAgo() public {
        // C registers as batch manager
        registerBatchManager(C, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 5e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);
        // A opens trove and joins batch manager B (which has the same interest)
        uint256 troveId = openTroveAndJoinBatchManager(A, 100 ether, 2000e18, B, 5e16);

        // Cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1);
        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveId, C);
        assertGt(upfrontFee, 0, "Upfront fee should be > 0");

        // Switch from B to C
        switchBatchManager(A, troveId, C);

        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee,
            1e14,
            "A debt should have increased by upfront fee"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");
    }

    function testSwitchBatchManagerChargesUpfrontFeeIfOldBatchChangedFeeLessThanCooldownAgo() public {
        // C registers as batch manager
        registerBatchManager(C, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 5e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);
        // A opens trove and joins batch manager B
        uint256 troveId = openTroveAndJoinBatchManager(A, 100 ether, 2000e18, B, 4e16);

        // Cool down period has gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 60);
        // B changes interest rate
        LatestBatchData memory batch = troveManager.getLatestBatchData(B);
        setBatchInterestRate(B, 5e16);
        batch = troveManager.getLatestBatchData(B);

        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveId, C);
        assertGt(upfrontFee, 0, "Upfront fee should be > 0");
        // Switch from B to C
        switchBatchManager(A, troveId, C);
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee,
            1,
            "A debt should have increased by upfront fee"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");
    }

    function testSwitchBatchManagerDoesNotChargeTroveUpfrontFeeIfBatchChangesRateWithoutUpfrontFee() public {
        // B registers as batch manager
        registerBatchManager(B, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 5e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);

        // C registers as batch manager
        registerBatchManager(C, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 5e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);

        // Cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1);

        // A opens trove and joins batch manager B (which has the same interest)
        uint256 troveId = openTroveAndJoinBatchManager(A, 100 ether, 2000e18, B, 5e16);

        // Switch from B to C
        switchBatchManager(A, troveId, C);

        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        // C changes interest rate, but it doesn’t trigger upfront fee
        setBatchInterestRate(C, 10e16);

        assertEq(troveManager.getTroveEntireDebt(troveId), ADebtBefore, "A debt should be the same");
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");
    }

    function testSwitchBatchManagerBackAndForthCannotBeUsedToDo2ConsecutiveChangesForFree() public {
        // B registers as batch manager, with interest rate 5%
        registerBatchManager(B, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 5e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);

        // C registers as batch manager, with interest rate 4%
        registerBatchManager(C, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 4e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);

        // A opens trove and joins batch manager B
        uint256 troveId = openTroveAndJoinBatchManager(A, 100 ether, 2000e18, B, 5e16);

        // Cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1);

        // Switch from B to C
        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveId, C);
        switchBatchManager(A, troveId, C);

        // It should trigger upfront fee
        assertGt(upfrontFee, 0, "Upfront fee should be > 0");
        assertEq(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee,
            "A debt should increase by upfrontfee after first switch"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(
            troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A after first switch"
        );

        // Adjust interest rate of new batch C, to 6%
        ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        setBatchInterestRate(C, 6e16);

        // It shouldn’t trigger upfront fee
        assertEq(
            troveManager.getTroveEntireDebt(troveId), ADebtBefore, "A debt should not increase after first batch adjust"
        );
        troveData = troveManager.getLatestTroveData(troveId);
        assertEq(
            troveData.lastInterestRateAdjTime,
            block.timestamp,
            "Wrong interest rate adj time for A after first batch adjust"
        );

        // Cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1);

        // Switch from C to B
        ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveId, B);
        switchBatchManager(A, troveId, B);

        // It should trigger upfront fee
        assertGt(upfrontFee, 0, "Upfront fee should be > 0");
        assertEq(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee,
            "A debt should increase by upfrontfee after second switch"
        );
        troveData = troveManager.getLatestTroveData(troveId);
        assertEq(
            troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A after second switch"
        );

        // Adjust interest rate of batch B, to 3%
        ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        setBatchInterestRate(B, 3e16);

        // It shouldn’t trigger upfront fee
        assertEq(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore,
            "A debt should not increase after second batch adjust"
        );
        troveData = troveManager.getLatestTroveData(troveId);
        assertEq(
            troveData.lastInterestRateAdjTime,
            block.timestamp,
            "Wrong interest rate adj time for A after second batch adjust"
        );
    }

    function testJoinBatchManagerCannotBeUsedToDo2ConsecutiveChangesForFree() public {
        // B registers as batch manager, with min interest rate
        registerBatchManager(B, uint128(MIN_ANNUAL_INTEREST_RATE), 1e18, 5e16, 0, MIN_INTEREST_RATE_CHANGE_PERIOD);

        // A opens trove at 5% interest rate
        uint256 troveId = openTroveNoHints100pct(A, 100 ether, 2000e18, 5e16);

        // Cool down period gone by
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN + 1);

        // A joins batch manager B
        uint256 ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 upfrontFee = predictJoinBatchInterestRateUpfrontFee(troveId, B);
        setInterestBatchManager(A, troveId, B);

        // It should trigger upfront fee
        assertGt(upfrontFee, 0, "Upfront fee should be > 0");
        assertEq(
            troveManager.getTroveEntireDebt(troveId),
            ADebtBefore + upfrontFee,
            "A debt should increase by upfrontfee after first switch"
        );
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        assertEq(
            troveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A after first switch"
        );

        // Adjust interest rate of new batch B, to 6%
        ADebtBefore = troveManager.getTroveEntireDebt(troveId);
        setBatchInterestRate(B, 6e16);

        // It shouldn’t trigger upfront fee
        assertEq(
            troveManager.getTroveEntireDebt(troveId), ADebtBefore, "A debt should not increase after first batch adjust"
        );
        troveData = troveManager.getLatestTroveData(troveId);
        assertEq(
            troveData.lastInterestRateAdjTime,
            block.timestamp,
            "Wrong interest rate adj time for A after first batch adjust"
        );
    }

    function testAnZombieTroveGoesBackToTheBatch() public {
        // A opens trove and joins batch manager B
        uint256 troveId = openTroveAndJoinBatchManager(A, 100 ether, 2000e18, B, 5e16);

        // Open another trove with higher interest
        openTroveNoHints100pct(C, 100 ether, 2000e18, 10e16);

        vm.warp(block.timestamp + 10 days);

        // C redeems and makes A zombie
        redeem(C, 1000e18);

        // A adjusts back to normal
        adjustZombieTrove(A, troveId, 0, false, 1000e18, true);

        assertEq(borrowerOperations.interestBatchManagerOf(troveId), B, "A should be in batch (BO)");
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(troveId);
        assertEq(tmBatchManagerAddress, B, "A should be in batch (TM)");
    }

    function testOpenTroveAndJoinBatchManagerChargesProperUpfrontFeeSimple() public {
        uint256 initialDebt = 2000e18;
        uint256 interestRate = 5e16;
        // A opens trove and joins batch manager B
        uint256 ATroveId = openTroveAndJoinBatchManager(A, 100 ether, initialDebt, B, interestRate);
        uint256 ATroveEntireDebt = troveManager.getTroveEntireDebt(ATroveId);
        uint256 expectedUpfrontFeeA =
            initialDebt * interestRate * UPFRONT_INTEREST_PERIOD / ONE_YEAR / DECIMAL_PRECISION;
        assertEq(ATroveEntireDebt - initialDebt, expectedUpfrontFeeA, "Wrong upfront fee for A");

        vm.warp(block.timestamp + 10 days);

        // C opens trove and joins batch manager B
        uint256 CTroveId = openTroveAndJoinBatchManager(C, 100 ether, 2000e18, B, interestRate);
        uint256 CTroveEntireDebt = troveManager.getTroveEntireDebt(CTroveId);
        uint256 expectedUpfrontFeeC =
            initialDebt * interestRate * UPFRONT_INTEREST_PERIOD / ONE_YEAR / DECIMAL_PRECISION;
        assertApproxEqAbs(CTroveEntireDebt - initialDebt, expectedUpfrontFeeC, 100, "Wrong upfront fee for C");
    }

    function testOpenTroveAndJoinBatchManagerChargesProperUpfrontFeeWithDifferentInterestRates() public {
        // D opens a regular trove
        uint256 DTroveId = openTroveNoHints100pct(D, 100 ether, 4000e18, 10e16);
        uint256 DInitialDebt = troveManager.getTroveEntireDebt(DTroveId);
        uint256 DWeightedDebt = DInitialDebt * 10e16;

        uint256 initialDebt = 2000e18;
        uint256 interestRate = 5e16;
        // A opens trove and joins batch manager B (with different interest rate than D)
        uint256 ATroveId = openTroveAndJoinBatchManager(A, 100 ether, initialDebt, B, interestRate);
        uint256 ATroveEntireDebt = troveManager.getTroveEntireDebt(ATroveId);
        uint256 avgInterestRate = (DWeightedDebt + initialDebt * interestRate) / (DInitialDebt + initialDebt);
        uint256 expectedUpfrontFeeA =
            initialDebt * avgInterestRate * UPFRONT_INTEREST_PERIOD / ONE_YEAR / DECIMAL_PRECISION;
        assertEq(ATroveEntireDebt - initialDebt, expectedUpfrontFeeA, "Wrong upfront fee for A");
        LatestTroveData memory ATroveData = troveManager.getLatestTroveData(ATroveId);
        assertEq(ATroveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for A");

        vm.warp(block.timestamp + 10 days);

        // C opens trove and joins batch manager B
        uint256 CTroveId = openTroveAndJoinBatchManager(C, 100 ether, 2000e18, B, interestRate);
        uint256 CTroveEntireDebt = troveManager.getTroveEntireDebt(CTroveId);
        ATroveEntireDebt = troveManager.getTroveEntireDebt(ATroveId);
        uint256 DTroveEntireDebt = troveManager.getTroveEntireDebt(DTroveId);
        //avgInterestRate = (DWeightedDebt + (ATroveEntireDebt + initialDebt) * interestRate) / (DInitialDebt + ATroveEntireDebt + initialDebt);
        avgInterestRate = (DWeightedDebt + (ATroveEntireDebt + initialDebt) * interestRate)
            / (DTroveEntireDebt + ATroveEntireDebt + initialDebt);
        uint256 expectedUpfrontFeeC =
            initialDebt * avgInterestRate * UPFRONT_INTEREST_PERIOD / ONE_YEAR / DECIMAL_PRECISION;
        assertApproxEqAbs(CTroveEntireDebt - initialDebt, expectedUpfrontFeeC, 1, "Wrong upfront fee for C");
        LatestTroveData memory CTroveData = troveManager.getLatestTroveData(CTroveId);
        assertEq(CTroveData.lastInterestRateAdjTime, block.timestamp, "Wrong interest rate adj time for C");
    }

    // BCR

    function testCannotOpenAndJoinIfBelowMCRPlusBCR() public {
        // Make sure TCR is big
        openTroveNoHints100pct(C, 100e18, 5000e18, MIN_ANNUAL_INTEREST_RATE);

        registerBatchManager(B);

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        uint256 boldAmount = 10000e18;
        uint256 collAmount = boldAmount * (MCR + BCR) / price; // upfront fee will put it slightly below

        IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams memory params = IBorrowerOperations
            .OpenTroveAndJoinInterestBatchManagerParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            interestBatchManager: B,
            maxUpfrontFee: 1e24,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.ICRBelowMCRPlusBCR.selector);
        borrowerOperations.openTroveAndJoinInterestBatchManager(params);
        vm.stopPrank();
    }

    function testCannotJoinBatchAfterOpeningIfBelowMCRPlusBCR() public {
        registerBatchManager(B);

        // Make sure TCR is big
        openTroveNoHints100pct(C, 100e18, 5000e18, MIN_ANNUAL_INTEREST_RATE);

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        uint256 boldAmount = 10000e18;
        uint256 collAmount = boldAmount * (MCR + BCR) / price; // upfront fee will put it slightly below

        uint256 troveId = openTroveNoHints100pct(A, collAmount, boldAmount, MIN_ANNUAL_INTEREST_RATE);

        uint256 ICR = troveManager.getCurrentICR(troveId, price);
        assertLt(ICR, MCR + BCR, "ICR too high");
        assertGt(ICR, MCR, "ICR too low");

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.ICRBelowMCRPlusBCR.selector);
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testCannotBorrowInsideABatchIfBelowMCRPlusBCR() public {
        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        // Make sure TCR is big
        openTroveNoHints100pct(C, 100e18, 5000e18, MIN_ANNUAL_INTEREST_RATE);

        uint256 troveId = openTroveAndJoinBatchManager();
        uint256 debt = troveManager.getTroveEntireDebt(troveId);
        uint256 coll = troveManager.getTroveEntireColl(troveId);

        uint256 boldAmount = coll * price / (MCR + BCR) - debt;

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.ICRBelowMCRPlusBCR.selector);
        borrowerOperations.withdrawBold(troveId, boldAmount, boldAmount);
        vm.stopPrank();
    }

    function testCannotWithdrawCollateralInsideABatchIfBelowMCRPlusBCR() public {
        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        // Make sure TCR is big
        openTroveNoHints100pct(C, 100e18, 5000e18, MIN_ANNUAL_INTEREST_RATE);

        uint256 troveId = openTroveAndJoinBatchManager();
        uint256 debt = troveManager.getTroveEntireDebt(troveId);
        uint256 coll = troveManager.getTroveEntireColl(troveId);

        uint256 collAmount = coll - debt * (MCR + BCR) / price;

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.ICRBelowMCRPlusBCR.selector);
        borrowerOperations.withdrawColl(troveId, collAmount);
        vm.stopPrank();
    }

    function testCannotAdjustInsideABatchIfBelowMCRPlusBCR1() public {
        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        // Make sure TCR is big
        openTroveNoHints100pct(C, 100e18, 5000e18, MIN_ANNUAL_INTEREST_RATE);

        uint256 troveId = openTroveAndJoinBatchManager();
        uint256 debt = troveManager.getTroveEntireDebt(troveId);
        uint256 coll = troveManager.getTroveEntireColl(troveId);

        uint256 withdrawColl = 97.5 ether;
        uint256 repayBold = debt - (coll - withdrawColl) * price / (MCR + BCR) - 1;
        //console2.log(coll - withdrawColl, "coll - withdrawColl");
        //console2.log(debt - repayBold, "debt - repayBold");

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.ICRBelowMCRPlusBCR.selector);
        borrowerOperations.adjustTrove(troveId, withdrawColl, false, repayBold, false, 10000e18);
        vm.stopPrank();
    }

    function testCannotAdjustInsideABatchIfBelowMCRPlusBCR2() public {
        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        // Make sure TCR is big
        openTroveNoHints100pct(C, 100e18, 5000e18, MIN_ANNUAL_INTEREST_RATE);

        uint256 troveId = openTroveAndJoinBatchManager();
        uint256 debt = troveManager.getTroveEntireDebt(troveId);
        uint256 coll = troveManager.getTroveEntireColl(troveId);

        uint256 borrowBold = 195000e18;
        uint256 addColl = (debt + borrowBold) * (MCR + BCR) / price - coll;
        //console2.log(debt+borrowBold, "debt+borrowBold");
        //console2.log(coll+addColl, "coll+addColl");

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.ICRBelowMCRPlusBCR.selector);
        borrowerOperations.adjustTrove(troveId, addColl, true, borrowBold, true, 10000e18);
        vm.stopPrank();
    }

    function testCannotAdjustInsideABatchIfBelowMCRPlusBCRIfItWasAlreadyBelow() public {
        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        // Make sure TCR is big
        openTroveNoHints100pct(C, 100e18, 5000e18, MIN_ANNUAL_INTEREST_RATE);

        // Open trove to adjust
        uint256 troveId = openTroveAndJoinBatchManager();

        // Price goes down
        price = 58e18;
        priceFeed.setPrice(price);

        // Trove is below MCR + BCR
        uint256 ICR = troveManager.getCurrentICR(troveId, price);
        //console2.log(ICR, "ICR");
        assertLt(ICR, MCR + BCR, "ICR too high");
        assertGt(ICR, MCR, "ICR too low");

        // Change would improve ICR, but not enough
        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.ICRBelowMCRPlusBCR.selector);
        borrowerOperations.adjustTrove(troveId, 1 ether, true, 100e18, false, 1000e18);
        vm.stopPrank();
    }

    function testRemoveFromBatchDeletesInterestBatchManagerOf() public {
        uint256 troveId = openTroveAndJoinBatchManager();
        
        // Verify trove is in batch
        address batchManagerAddress = borrowerOperations.interestBatchManagerOf(troveId);
        assertEq(batchManagerAddress, B, "Trove should be in batch B");
        
        // Remove from batch
        vm.startPrank(A);
        borrowerOperations.removeFromBatch(troveId, 4e16, 0, 0, 1e24);
        vm.stopPrank();
        
        // Verify mapping is deleted
        assertEq(borrowerOperations.interestBatchManagerOf(troveId), address(0), "interestBatchManagerOf should be deleted");
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(troveId);
        assertEq(tmBatchManagerAddress, address(0), "TM batch manager should be address(0)");
    }

    function testKickFromBatchDeletesInterestBatchManagerOf() public {
        registerBatchManager({
            _account: B,
            _minInterestRate: uint128(MIN_ANNUAL_INTEREST_RATE),
            _maxInterestRate: uint128(MAX_ANNUAL_INTEREST_RATE),
            _currentInterestRate: uint128(MAX_ANNUAL_INTEREST_RATE),
            _fee: MAX_ANNUAL_BATCH_MANAGEMENT_FEE,
            _minInterestRateChangePeriod: MIN_INTEREST_RATE_CHANGE_PERIOD
        });

        // Placeholder Trove so that the batch isn't wiped out fully when we redeem the target Trove later
        uint256 placeholderTrove = openTroveAndJoinBatchManager({
            _troveOwner: C,
            _coll: 1_000_000 ether,
            _debt: MIN_DEBT,
            _batchAddress: B,
            _annualInterestRate: 0 // ignored
        });

        // Open the target Trove, the one we will make irredeemable
        uint256 targetTrove = openTroveAndJoinBatchManager({
            _troveOwner: A,
            _coll: 1_000_000 ether,
            _debt: MIN_DEBT,
            _batchAddress: B,
            _annualInterestRate: 0 // ignored
        });

        // Verify trove is in batch
        address batchManagerAddress = borrowerOperations.interestBatchManagerOf(targetTrove);
        assertEq(batchManagerAddress, B, "Trove should be in batch B");

        // Another Trove to provide funds and keep the average interest rate high,
        // which speeds up our manipulation of the batch:shares ratio
        openTroveHelper({
            _account: A,
            _index: 1,
            _coll: 1_000_000 ether,
            _boldAmount: 10_000_000 ether,
            _annualInterestRate: MAX_ANNUAL_INTEREST_RATE
        });

        // Increase the batch:shares ratio past the limit
        for (uint256 i = 1;; ++i) {
            skip(MIN_INTEREST_RATE_CHANGE_PERIOD);
            setBatchInterestRate(B, MAX_ANNUAL_INTEREST_RATE - i % 2);

            (uint256 debt,,,,,,, uint256 shares) = troveManager.getBatch(B);
            if (shares * MAX_BATCH_SHARES_RATIO < debt) break;

            // Keep debt low to minimize interest and maintain healthy TCR
            repayBold(A, targetTrove, troveManager.getTroveEntireDebt(targetTrove) - MIN_DEBT);
            repayBold(A, placeholderTrove, troveManager.getTroveEntireDebt(placeholderTrove) - MIN_DEBT);
        }

        // Make a zombie out of the target Trove
        skip(MIN_INTEREST_RATE_CHANGE_PERIOD);
        setBatchInterestRate(B, MIN_ANNUAL_INTEREST_RATE);
        redeem(A, troveManager.getTroveEntireDebt(targetTrove));
        assertTrue(troveManager.checkTroveIsZombie(targetTrove), "not a zombie");

        // Open a Trove to be liquidated
        (uint256 liquidatedTrove,) = openTroveWithExactICRAndDebt({
            _account: D,
            _index: 0,
            _ICR: MCR,
            _debt: 100_000 ether,
            _interestRate: MIN_ANNUAL_INTEREST_RATE
        });

        // Liquidate by redistribution
        priceFeed.setPrice(priceFeed.getPrice() * 99 / 100);
        liquidate(A, liquidatedTrove);

        // Verify trove is still in batch before kicking
        batchManagerAddress = borrowerOperations.interestBatchManagerOf(targetTrove);
        assertEq(batchManagerAddress, B, "Trove should still be in batch B before kick");

        // Kick the trove from batch
        borrowerOperations.kickFromBatch(targetTrove, 0, 0);

        // Verify mapping is deleted after kick
        assertEq(borrowerOperations.interestBatchManagerOf(targetTrove), address(0), "interestBatchManagerOf should be deleted after kick");
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(targetTrove);
        assertEq(tmBatchManagerAddress, address(0), "TM batch manager should be address(0) after kick");
    }
}
