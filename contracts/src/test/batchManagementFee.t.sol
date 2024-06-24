pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract BatchManagementFeeTest is DevTestSetup {
    function testAdjustTroveMintsFeeForBatch() public {
        // Open 2 troves in the same batch manager
        uint256 troveId = openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        openTroveAndJoinBatchManager(C, 200e18, 5000e18, B, 5e16);

        vm.warp(block.timestamp + 10 days);

        uint256 batchInitialBalance = boldToken.balanceOf(B);
        uint256 batchAccruedFee = troveManager.calcBatchAccruedFee(B);

        // Adjust first trove
        addColl(A, troveId, 1 ether);

        assertEq(boldToken.balanceOf(B), batchInitialBalance + batchAccruedFee);
    }

    function testAdjustTroveIncreasesTroveDebtByFee() public {
        // Open 2 troves in the same batch manager
        uint256 troveId = openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        openTroveAndJoinBatchManager(C, 200e18, 5000e18, B, 5e16);

        vm.warp(block.timestamp + 10 days);

        uint256 troveInitialDebt = troveManager.getTroveDebt(troveId);
        uint256 troveAccruedInterest = troveManager.calcTroveAccruedInterest(troveId);
        uint256 troveAccruedFee = troveManager.calcTroveAccruedFee(troveId);

        // Adjust first trove
        addColl(A, troveId, 1 ether);

        assertEq(troveManager.getTroveDebt(troveId), troveInitialDebt + troveAccruedInterest + troveAccruedFee);
    }

    function testAdjustTroveIncreasesDebtInActivePoolByFee() public {
        // Open 2 troves in the same batch manager
        uint256 troveId = openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        openTroveAndJoinBatchManager(C, 200e18, 5000e18, B, 5e16);

        vm.warp(block.timestamp + 10 days);

        uint256 activePoolInitialDebt = activePool.aggRecordedDebt();
        uint256 batchAccruedInterest = troveManager.calcBatchAccruedInterest(B);
        uint256 batchAccruedFee = troveManager.calcBatchAccruedFee(B);

        // Adjust first trove
        addColl(A, troveId, 1 ether);

        assertEq(activePool.aggRecordedDebt(), activePoolInitialDebt + batchAccruedInterest + batchAccruedFee);
    }

    function testCloseTroveMintsFeeForBatch() public {
        // Open 2 troves in the same batch manager
        uint256 troveId = openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        openTroveAndJoinBatchManager(C, 200e18, 5000e18, B, 5e16);
        // C sends to A so A can repay and close
        transferBold(C, A, 5000e18);

        vm.warp(block.timestamp + 10 days);

        uint256 batchInitialBalance = boldToken.balanceOf(B);
        uint256 batchAccruedFee = troveManager.calcBatchAccruedFee(B);

        // Close first trove
        closeTrove(A, troveId);

        assertEq(boldToken.balanceOf(B), batchInitialBalance + batchAccruedFee);
    }

    function testCloseTroveIncreasesTroveDebtFee() public {
        // Open 2 troves in the same batch manager
        uint256 troveId = openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        openTroveAndJoinBatchManager(C, 200e18, 5000e18, B, 5e16);
        // C sends to A so A can repay and close
        transferBold(C, A, 5000e18);

        vm.warp(block.timestamp + 10 days);

        uint256 AIntialBalance = boldToken.balanceOf(A);
        uint256 troveInitialDebt = troveManager.getTroveDebt(troveId);
        uint256 troveAccruedInterest = troveManager.calcTroveAccruedInterest(troveId);
        uint256 troveAccruedFee = troveManager.calcTroveAccruedFee(troveId);

        // Close first trove
        closeTrove(A, troveId);

        assertEq(
            AIntialBalance - boldToken.balanceOf(A),
            troveInitialDebt + troveAccruedInterest + troveAccruedFee - BOLD_GAS_COMPENSATION
        );
    }

    function testCloseTroveBatchFeeDoesNotIncreaseDebtInActivePool() public {
        // Open 2 troves in the same batch manager
        uint256 ATroveId = openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        uint256 BTroveId = openTroveAndJoinBatchManager(C, 200e18, 5000e18, B, 5e16);
        // C sends to A so A can repay and close
        transferBold(C, A, 5000e18);

        vm.warp(block.timestamp + 10 days);

        // Close first trove
        closeTrove(A, ATroveId);

        assertEq(activePool.aggRecordedDebt(), troveManager.getTroveEntireDebt(BTroveId));
    }

    function testChangeBatchInterestRateMintsFeeForBatch() public {
        // Open 2 troves in the same batch manager
        openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        openTroveAndJoinBatchManager(C, 200e18, 5000e18, B, 5e16);

        vm.warp(block.timestamp + 10 days);

        uint256 batchInitialBalance = boldToken.balanceOf(B);
        uint256 batchAccruedFee = troveManager.calcBatchAccruedFee(B);

        // Change batch interest rate
        setBatchInterestRate(B, 10e16);

        assertEq(boldToken.balanceOf(B), batchInitialBalance + batchAccruedFee);
    }

    function testChangeBatchInterestRateIncreasesTroveDebtByFee() public {
        // Open 2 troves in the same batch manager
        uint256 troveId = openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        openTroveAndJoinBatchManager(C, 200e18, 5000e18, B, 5e16);

        vm.warp(block.timestamp + 10 days);

        uint256 troveInitialDebt = troveManager.getTroveDebt(troveId);
        uint256 troveAccruedInterest = troveManager.calcTroveAccruedInterest(troveId);
        uint256 troveAccruedFee = troveManager.calcTroveAccruedFee(troveId);

        // Change batch interest rate
        setBatchInterestRate(B, 10e16);

        assertEq(troveManager.getTroveDebt(troveId), troveInitialDebt + troveAccruedInterest + troveAccruedFee);
    }

    function testChangeBatchInterestRateIncreasesDebtInActivePoolByFee() public {
        // Open 2 troves in the same batch manager
        openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        openTroveAndJoinBatchManager(C, 200e18, 5000e18, B, 5e16);

        vm.warp(block.timestamp + 10 days);

        uint256 activePoolInitialDebt = activePool.aggRecordedDebt();
        uint256 batchAccruedInterest = troveManager.calcBatchAccruedInterest(B);
        uint256 batchAccruedFee = troveManager.calcBatchAccruedFee(B);

        // Change batch interest rate
        setBatchInterestRate(B, 10e16);

        assertEq(activePool.aggRecordedDebt(), activePoolInitialDebt + batchAccruedInterest + batchAccruedFee);
    }

    function testAddTroveToBatchMintsFeeForBatch() public {
        // Open 2 troves, 1 in a batch manager, 1 alone
        openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        uint256 troveId = openTroveNoHints100pct(C, 200 ether, 5000e18, 10e16);

        vm.warp(block.timestamp + 10 days);

        uint256 batchInitialBalance = boldToken.balanceOf(B);
        uint256 batchAccruedFee = troveManager.calcBatchAccruedFee(B);

        // Add trove to batch
        setInterestBatchManager(C, troveId, B);

        assertEq(boldToken.balanceOf(B), batchInitialBalance + batchAccruedFee);
    }

    function testAddTroveToBatchDoesNotIncreaseTroveDebtByFee() public {
        // Open 2 troves, 1 in a batch manager, 1 alone
        openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        uint256 troveId = openTroveNoHints100pct(C, 200 ether, 5000e18, 10e16);

        vm.warp(block.timestamp + 10 days);

        uint256 troveInitialDebt = troveManager.getTroveDebt(troveId);
        uint256 troveAccruedInterest = troveManager.calcTroveAccruedInterest(troveId);
        uint256 troveAccruedFee = troveManager.calcTroveAccruedFee(troveId);
        assertEq(troveAccruedFee, 0, "Trove accrued fee should be zero");

        // Add trove to batch
        setInterestBatchManager(C, troveId, B);

        assertApproxEqAbs(troveManager.getTroveDebt(troveId), troveInitialDebt + troveAccruedInterest, 1);
    }

    function testAddTroveToBatchIncreasesDebtInActivePoolByFee() public {
        // Open 2 troves, 1 in a batch manager, 1 alone
        openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        uint256 troveId = openTroveNoHints100pct(C, 200 ether, 5000e18, 10e16);

        vm.warp(block.timestamp + 10 days);

        uint256 activePoolInitialDebt = activePool.aggRecordedDebt();
        uint256 batchAccruedInterest = troveManager.calcBatchAccruedInterest(B);
        uint256 batchAccruedFee = troveManager.calcBatchAccruedFee(B);
        uint256 troveAccruedInterest = troveManager.calcTroveAccruedInterest(troveId);

        // Add trove to batch
        setInterestBatchManager(C, troveId, B);

        assertEq(
            activePool.aggRecordedDebt(),
            activePoolInitialDebt + batchAccruedInterest + batchAccruedFee + troveAccruedInterest
        );
    }

    function testSwitchTroveBatchMintsFeeForBatches() public {
        // Open 2 troves in 2 different batch managers
        openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        uint256 troveId = openTroveAndJoinBatchManager(C, 100e18, 5000e18, D, 5e16);

        vm.warp(block.timestamp + 10 days);

        // Batch B
        uint256 batchBInitialBalance = boldToken.balanceOf(B);
        uint256 batchBAccruedFee = troveManager.calcBatchAccruedFee(B);
        // Batch D
        uint256 batchDInitialBalance = boldToken.balanceOf(D);
        uint256 batchDAccruedFee = troveManager.calcBatchAccruedFee(D);

        // Add trove to batch
        setInterestBatchManager(C, troveId, B);

        assertEq(boldToken.balanceOf(B), batchBInitialBalance + batchBAccruedFee);
        assertEq(boldToken.balanceOf(D), batchDInitialBalance + batchDAccruedFee);
    }

    function testSwitchTroveBatchIncreasesTroveDebtByFee() public {
        // Open 2 troves in 2 different batch managers
        openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        uint256 troveId = openTroveAndJoinBatchManager(C, 100e18, 5000e18, D, 5e16);

        vm.warp(block.timestamp + 10 days);

        uint256 troveInitialDebt = troveManager.getTroveDebt(troveId);
        uint256 troveAccruedInterest = troveManager.calcTroveAccruedInterest(troveId);
        uint256 troveAccruedFee = troveManager.calcTroveAccruedFee(troveId);

        // Add trove to batch
        setInterestBatchManager(C, troveId, B);

        assertEq(troveManager.getTroveDebt(troveId), troveInitialDebt + troveAccruedInterest + troveAccruedFee);
    }

    function testSwitchTroveBatchIncreasesDebtInActivePoolByFee() public {
        // Open 2 troves in 2 different batch managers
        openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        uint256 troveId = openTroveAndJoinBatchManager(C, 100e18, 5000e18, D, 5e16);

        vm.warp(block.timestamp + 10 days);

        uint256 activePoolInitialDebt = activePool.aggRecordedDebt();
        uint256 batchBAccruedInterest = troveManager.calcBatchAccruedInterest(B);
        uint256 batchBAccruedFee = troveManager.calcBatchAccruedFee(B);
        uint256 batchDAccruedInterest = troveManager.calcBatchAccruedInterest(B);
        uint256 batchDAccruedFee = troveManager.calcBatchAccruedFee(B);

        // Add trove to batch
        setInterestBatchManager(C, troveId, B);

        assertEq(
            activePool.aggRecordedDebt(),
            activePoolInitialDebt + batchBAccruedInterest + batchBAccruedFee + batchDAccruedInterest + batchDAccruedFee
        );
    }

    function testRemoveTroveFromBatchMintsFeeForBatch() public {
        // Open 2 troves in the same batch
        openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        uint256 troveId = openTroveAndJoinBatchManager(C, 100e18, 5000e18, B, 5e16);

        vm.warp(block.timestamp + 10 days);

        uint256 batchInitialBalance = boldToken.balanceOf(B);
        uint256 batchAccruedFee = troveManager.calcBatchAccruedFee(B);

        // Add trove to batch
        removeInterestBatchManager(C, troveId, 10e16);

        assertEq(boldToken.balanceOf(B), batchInitialBalance + batchAccruedFee);
    }

    function testRemoveTroveFromBatchIncreasesTroveDebtByFee() public {
        // Open 2 troves in the same batch
        openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        uint256 troveId = openTroveAndJoinBatchManager(C, 100e18, 5000e18, B, 5e16);

        vm.warp(block.timestamp + 10 days);

        uint256 troveInitialDebt = troveManager.getTroveDebt(troveId);
        uint256 troveAccruedInterest = troveManager.calcTroveAccruedInterest(troveId);
        uint256 troveAccruedFee = troveManager.calcTroveAccruedFee(troveId);

        // Add trove to batch
        removeInterestBatchManager(C, troveId, 10e16);

        assertEq(troveManager.getTroveDebt(troveId), troveInitialDebt + troveAccruedInterest + troveAccruedFee);
    }

    function testRemoveTroveFromBatchIncreasesDebtInActivePoolByFee() public {
        // Open 2 troves in the same batch
        openTroveAndJoinBatchManager(A, 100e18, 5000e18, B, 5e16);
        uint256 troveId = openTroveAndJoinBatchManager(C, 100e18, 5000e18, B, 5e16);

        vm.warp(block.timestamp + 10 days);

        uint256 activePoolInitialDebt = activePool.aggRecordedDebt();
        uint256 batchAccruedInterest = troveManager.calcBatchAccruedInterest(B);
        uint256 batchAccruedFee = troveManager.calcBatchAccruedFee(B);

        // Add trove to batch
        removeInterestBatchManager(C, troveId, 10e16);

        assertEq(activePool.aggRecordedDebt(), activePoolInitialDebt + batchAccruedInterest + batchAccruedFee);
    }
}
