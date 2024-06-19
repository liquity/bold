pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract InterestBatchManagementTest is DevTestSetup {
    function testCannotSetExsitingBatchManager() public {
        registerBatchManager(B);

        vm.startPrank(B);
        vm.expectRevert("BO: Batch Manager already exists");
        borrowerOperations.registerBatchManager(1e16, 20e16, 5e16, 25e14, 0);
        vm.stopPrank();
    }

    function testCannotAdjustInterestOfBatchedTrove() public {
        uint256 troveId = openTroveAndJoinBatchManager();

        vm.startPrank(A);
        vm.expectRevert("BO: Trove is in batch");
        borrowerOperations.adjustTroveInterestRate(troveId, 10e16, 0, 0, 10000e18);
        vm.stopPrank();
    }

    function testSetsBatchManagerProperlyOnOpen() public {
        uint256 troveId = openTroveAndJoinBatchManager();

        address batchManagerAddress = borrowerOperations.interestBatchManagerOf(troveId);
        assertEq(batchManagerAddress, B, "Wrong batch manager in BO");
        (,,,,,,,, address tmBatchManagerAddress,,) = troveManager.Troves(troveId);
        assertEq(tmBatchManagerAddress, B, "Wrong batch manager in TM");

        IBorrowerOperations.InterestBatchManager memory batchManager = borrowerOperations.getInterestBatchManager(batchManagerAddress);
        assertEq(batchManager.minInterestRate, 1e16, "Wrong min interest");
        assertEq(batchManager.maxInterestRate, 20e16, "Wrong max interest");
        assertEq(batchManager.minInterestRateChangePeriod, 0, "Wrong min change period");
        LatestBatchData memory batch = troveManager.getLatestBatchData(batchManagerAddress);
        assertEq(batch.annualFee, 25e14, "Wrong fee");
    }

    function testSetsBatchManagerProperlyAfterOpening() public {
        registerBatchManager(B);

        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        vm.startPrank(A);
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.stopPrank();

        address batchManagerAddress = borrowerOperations.interestBatchManagerOf(troveId);
        assertEq(batchManagerAddress, B, "Wrong batch manager in BO");
        (,,,,,,,, address tmBatchManagerAddress,,) = troveManager.Troves(troveId);
        assertEq(tmBatchManagerAddress, B, "Wrong batch manager in TM");

        IBorrowerOperations.InterestBatchManager memory batchManager = borrowerOperations.getInterestBatchManager(batchManagerAddress);
        assertEq(batchManager.minInterestRate, 1e16, "Wrong min interest");
        assertEq(batchManager.maxInterestRate, 20e16, "Wrong max interest");
        assertEq(batchManager.minInterestRateChangePeriod, 0, "Wrong min change period");
        LatestBatchData memory batch = troveManager.getLatestBatchData(batchManagerAddress);
        assertEq(batch.annualFee, 25e14, "Wrong fee");
    }

    function testRemovesBatchManagerProperly() public {
        uint256 troveId = openTroveAndJoinBatchManager();

        vm.startPrank(A);
        borrowerOperations.removeInterestBatchManager(troveId, 4e16, 0, 0, 1e24);
        vm.stopPrank();

        assertEq(borrowerOperations.interestBatchManagerOf(troveId), address(0), "Wrong batch manager in BO");
        (,,,,,,,, address tmBatchManagerAddress,,) = troveManager.Troves(troveId);
        assertEq(tmBatchManagerAddress, address(0), "Wrong batch manager in TM");
    }

    function testOnlyBorrowerCanSetBatchManager() public {
        registerBatchManager(A);
        registerBatchManager(B);
        registerBatchManager(C);

        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        vm.startPrank(B);
        vm.expectRevert("BorrowerOps: sender is not Trove owner");
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.expectRevert("BorrowerOps: sender is not Trove owner");
        borrowerOperations.setInterestBatchManager(troveId, A, 0, 0, 1e24);
        vm.expectRevert("BorrowerOps: sender is not Trove owner");
        borrowerOperations.setInterestBatchManager(troveId, C, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testCannotSetUnregisteredBatchManager() public {
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);

        vm.startPrank(A);
        vm.expectRevert("BO: Not valid Batch Manager");
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1e24);
        vm.stopPrank();
    }

    function testSetBatchManagerRemovesIndividualDelegate() public {
        vm.startPrank(B);
        borrowerOperations.registerBatchManager(1e16, 20e16, 5e16, 25e14, 0);
        vm.stopPrank();

        // Open trove
        uint256 troveId = openTroveNoHints100pct(A, 100e18, 5000e18, 5e16);
        // Set individual delegate (C)
        vm.startPrank(A);
        borrowerOperations.setInterestIndividualDelegate(troveId, C, 1e16, 20e16, 0, 0, 0, 0);
        vm.stopPrank();

        IBorrowerOperations.InterestIndividualDelegate memory delegate = borrowerOperations.getInterestIndividualDelegateOf(troveId);
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
        uint256 batchEntireDebtBefore = batch.entireDebt;
        assertGt(batchEntireDebtBefore, batchRecordedDebtBefore, "Batch entire debt should be greater than recorded");

        vm.startPrank(B);
        borrowerOperations.lowerBatchManagementFee(10e14);
        vm.stopPrank();

        // Check interest and fee were applied
        assertEq(troveManager.getTroveDebt(troveId), ATroveEntireDebtBefore, "Interest was not applied to trove");
        assertEq(troveManager.getTroveDebt(troveId), troveManager.getTroveEntireDebt(troveId), "Trove recorded debt should be equal to entire");
        batch = troveManager.getLatestBatchData(B);
        assertEq(batch.recordedDebt, batchEntireDebtBefore, "Interest was not applied to batch");
        assertEq(batch.recordedDebt, batch.entireDebt, "Batch recorded debt should be equal to entire");

        // Check new fee
        assertEq(batch.annualFee, 10e14, "Wrong batch management fee");
    }

    function testOnlyBatchManagerCanLowerBatchManagementFee() public {
        openTroveAndJoinBatchManager();

        vm.startPrank(C);
        vm.expectRevert("BO: Not valid Batch Manager");
        borrowerOperations.lowerBatchManagementFee(10e14);
        vm.stopPrank();
    }

    function testCannotIncreaseBatchManagementFee() public {
        openTroveAndJoinBatchManager();

        vm.startPrank(B);
        vm.expectRevert("BO: New fee should be lower");
        borrowerOperations.lowerBatchManagementFee(50e14);
        vm.stopPrank();
    }

    function testLowerBatchManagementFeeDoesNotApplyRedistributionGains() public {
        uint256 troveId = openTroveAndJoinBatchManager();

        // TODO: Generate redistributions and check below

        vm.startPrank(B);
        borrowerOperations.lowerBatchManagementFee(10e14);
        vm.stopPrank();
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
        uint256 batchEntireDebtBefore = batch.entireDebt;
        assertGt(batchEntireDebtBefore, batchRecordedDebtBefore, "Batch entire debt should be greater than recorded");

        vm.startPrank(B);
        borrowerOperations.setBatchManagerAnnualInterestRate(6e16, 0, 0, 100000e18);
        vm.stopPrank();

        // Check interest was applied
        assertEq(troveManager.getTroveDebt(troveId), ATroveEntireDebtBefore, "Interest was not applied to trove");
        assertEq(troveManager.getTroveDebt(troveId), troveManager.getTroveEntireDebt(troveId), "Trove recorded debt should be equal to entire");
        batch = troveManager.getLatestBatchData(B);
        assertEq(batch.recordedDebt, batchEntireDebtBefore, "Interest was not applied to batch");
        assertEq(batch.recordedDebt, batch.entireDebt, "Batch recorded debt should be equal to entire");

        // Check new interest rate
        assertEq(troveManager.getBatchAnnualInterestRate(B), 6e16, "Wrong batch interest rate");
    }

    function testOnlyBatchManagerCanChangeBatchInterestRate() public {
        openTroveAndJoinBatchManager();

        vm.startPrank(C);
        vm.expectRevert("BO: Not valid Batch Manager");
        borrowerOperations.setBatchManagerAnnualInterestRate(6e16, 0, 0, 100000e18);
        vm.stopPrank();
    }

    function testCannotChangeBatchToWrongInterestRate() public {
        openTroveAndJoinBatchManager();

        vm.startPrank(B);
        //vm.expectRevert("Interest rate must not be lower than min");
        //borrowerOperations.setBatchManagerAnnualInterestRate(0, 0, 0, 100000e18);
        vm.expectRevert("Interest rate must not be greater than max");
        borrowerOperations.setBatchManagerAnnualInterestRate(2e18, 0, 0, 100000e18);
        vm.stopPrank();
    }

    function testCannotChangeBatchInterestRateOutsideOwnRange() public {
        openTroveAndJoinBatchManager();

        vm.startPrank(B);
        vm.expectRevert("BO: interest not in range of batch manager");
        borrowerOperations.setBatchManagerAnnualInterestRate(1e15, 0, 0, 100000e18);
        vm.expectRevert("BO: interest not in range of batch manager");
        borrowerOperations.setBatchManagerAnnualInterestRate(21e16, 0, 0, 100000e18);
        vm.stopPrank();
    }

    function testCannotChangeBatchInterestRateBeforePeriod() public {
        // Register batch manager
        vm.startPrank(B);
        borrowerOperations.registerBatchManager(
            1e16,  // min interest: 1%
            20e16, // max interest: 20%
            5e16,  // current interest: 5%
            25e14, // fee: 0.25%,
            6000   // min interest rate change period
        );
        vm.stopPrank();

        // Open trove and join manager
        vm.startPrank(A);
        borrowerOperations.openTroveAndJoinInterestBatchManager(
            A,
            0,
            100e18, // coll
            5000e18, // bold
            0, // _upperHint
            0, // _lowerHint
            B, // interest batch manager
            1e24
        );
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("BO: cannot change interest rate again yet");
        borrowerOperations.setBatchManagerAnnualInterestRate(6e16, 0, 0, 100000e18);
        vm.stopPrank();
    }

    function testChangeBatchInterestRateDoesNotApplyRedistributionGains() public {
        uint256 troveId = openTroveAndJoinBatchManager();

        // TODO: Generate redistributions and check below

        vm.startPrank(B);
        borrowerOperations.setBatchManagerAnnualInterestRate(6e16, 0, 0, 100000e18);
        vm.stopPrank();
    }

    function testSwitchFromOldToNewBatchManager() public {
        ABCDEF memory troveIDs;
        ABCDEF memory troveRecordedDebtBefore;
        ABCDEF memory troveEntireDebtBefore;

        troveIDs.A = openTroveAndJoinBatchManager();

        // Register a new batch manager and add a trove to it
        registerBatchManager(C);
        vm.startPrank(D);
        troveIDs.D = borrowerOperations.openTroveAndJoinInterestBatchManager(
            D,
            0,
            100e18, // coll
            5000e18, // bold
            0, // _upperHint
            0, // _lowerHint
            C, // interest batch manager
            1e24
        );
        vm.stopPrank();

        // Add a new trove to first manager
        vm.startPrank(E);
        troveIDs.E = borrowerOperations.openTroveAndJoinInterestBatchManager(
            E,
            0,
            100e18, // coll
            5000e18, // bold
            0, // _upperHint
            0, // _lowerHint
            B, // interest batch manager
            1e24
        );
        vm.stopPrank();

        // Fast forward 1 year
        vm.warp(block.timestamp + 365 days);

        // debts before
        troveRecordedDebtBefore.A = troveManager.getTroveDebt(troveIDs.A);
        troveEntireDebtBefore.A = troveManager.getTroveEntireDebt(troveIDs.A);
        assertGt(troveEntireDebtBefore.A, troveRecordedDebtBefore.A, "Trove A entire debt should be greater than recorded");

        troveRecordedDebtBefore.D = troveManager.getTroveDebt(troveIDs.D);
        troveEntireDebtBefore.D = troveManager.getTroveEntireDebt(troveIDs.D);
        assertGt(troveEntireDebtBefore.D, troveRecordedDebtBefore.D, "Trove D entire debt should be greater than recorded");

        troveRecordedDebtBefore.E = troveManager.getTroveDebt(troveIDs.E);
        troveEntireDebtBefore.E = troveManager.getTroveEntireDebt(troveIDs.E);
        assertGt(troveEntireDebtBefore.E, troveRecordedDebtBefore.E, "Trove E entire debt should be greater than recorded");

        LatestBatchData memory batchB = troveManager.getLatestBatchData(B);
        uint256 batchBRecordedDebtBefore = batchB.recordedDebt;
        uint256 batchBEntireDebtBefore = batchB.entireDebt;
        assertGt(batchBEntireDebtBefore, batchBRecordedDebtBefore, "Batch B entire debt should be greater than recorded");

        LatestBatchData memory batchC = troveManager.getLatestBatchData(C);
        uint256 batchCRecordedDebtBefore = batchC.recordedDebt;
        uint256 batchCEntireDebtBefore = batchC.entireDebt;
        assertGt(batchCEntireDebtBefore, batchCRecordedDebtBefore, "Batch C entire debt should be greater than recorded");

        // Move the last trove from B to C
        vm.startPrank(E);
        borrowerOperations.setInterestBatchManager(troveIDs.E, C, 0, 0, 100000e18);
        vm.stopPrank();

        // Check new batch manager
        assertEq(borrowerOperations.interestBatchManagerOf(troveIDs.E), C, "Wrong batch manager in BO");
        (,,,,,,,, address tmBatchManagerAddress,,) = troveManager.Troves(troveIDs.E);
        assertEq(tmBatchManagerAddress, C, "Wrong batch manager in TM");

        // Check interest was applied
        assertApproxEqAbs(troveManager.getTroveDebt(troveIDs.A), troveEntireDebtBefore.A, 1, "Interest was not applied to trove A");
        assertEq(troveManager.getTroveDebt(troveIDs.A), troveManager.getTroveEntireDebt(troveIDs.A), "Trove A recorded debt should be equal to entire");

        assertApproxEqAbs(troveManager.getTroveDebt(troveIDs.D), troveEntireDebtBefore.D, 1, "Interest was not applied to trove D");
        assertEq(troveManager.getTroveDebt(troveIDs.D), troveManager.getTroveEntireDebt(troveIDs.D), "Trove D recorded debt should be equal to entire");

        assertApproxEqAbs(troveManager.getTroveDebt(troveIDs.E), troveEntireDebtBefore.E, 1, "Interest was not applied to trove E");
        assertEq(troveManager.getTroveDebt(troveIDs.E), troveManager.getTroveEntireDebt(troveIDs.E), "Trove E recorded debt should be equal to entire");

        batchB = troveManager.getLatestBatchData(B);
        assertEq(batchB.recordedDebt, batchBEntireDebtBefore - troveEntireDebtBefore.E, "Interest was not applied to batch B");
        assertEq(batchB.recordedDebt, batchB.entireDebt, "Batch B recorded debt should be equal to entire");

        batchC = troveManager.getLatestBatchData(C);
        assertEq(batchC.recordedDebt, batchCEntireDebtBefore + troveEntireDebtBefore.E, "Interest was not applied to batch C");
        assertEq(batchC.recordedDebt, batchC.entireDebt, "Batch C recorded debt should be equal to entire");
    }

    // --- applyBatchInterestAndFeePermissionless ---

    function testCannotApplyTroveInterestPermissionlessIfInBatch() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveAndJoinBatchManager(A, 3 ether, troveDebtRequest, B, interestRate);

        // Fast-forward time
        vm.warp(block.timestamp + 91 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        // B tries to apply A's pending interest
        vm.startPrank(B);
        vm.expectRevert("BO: Trove is in batch");
        borrowerOperations.applyTroveInterestPermissionless(ATroveId);
        vm.stopPrank();
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
        applyBatchInterestAndFeePermissionless(C, B);

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
        applyBatchInterestAndFeePermissionless(C, B);

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
        uint256 entireBatchDebt_1 = batch.entireDebt;
        assertGt(entireBatchDebt_1, 0);
        uint256 entireTroveDebt_1 = troveManager.getTroveEntireDebt(ATroveId);
        assertGt(entireTroveDebt_1, 0);

        // C applies batch B's pending interest
        applyBatchInterestAndFeePermissionless(C, B);

        batch = troveManager.getLatestBatchData(B);
        uint256 entireBatchDebt_2 = batch.entireDebt;
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
        uint256 accruedBatchFee = troveManager.calcBatchAccruedFee(B);
        uint256 recordedTroveDebt_1 = troveManager.getTroveDebt(ATroveId);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(ATroveId);
        uint256 accruedTroveFee = troveManager.calcTroveAccruedFee(ATroveId);

        // C applies batch B's pending interest
        applyBatchInterestAndFeePermissionless(C, B);

        batch = troveManager.getLatestBatchData(B);
        uint256 recordedBatchDebt_2 = batch.recordedDebt;
        uint256 recordedTroveDebt_2 = troveManager.getTroveDebt(ATroveId);

        assertEq(recordedBatchDebt_2, recordedBatchDebt_1 + accruedBatchInterest + accruedBatchFee);
        assertEq(recordedTroveDebt_2, recordedTroveDebt_1 + accruedTroveInterest + accruedTroveFee);
    }
}
