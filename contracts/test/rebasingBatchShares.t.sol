// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract RebasingBatchShares is DevTestSetup {
    bool WITH_INTEREST = true; // Do we need to tick some interest to cause a rounding error?

    // See: https://github.com/GalloDaSballo/bold-review/issues/42
    // This test is kept for historical purposes, doesn’t make much sense now in the current state
    function testBatchRebaseToSystemInsolvency() public {
        // === EXTRA SETUP === //
        // Open Trove
        priceFeed.setPrice(2000e18);
        // Extra Debt (irrelevant / Used to not use deal)
        openTroveNoHints100pct(C, 100 ether, 100e21, MAX_ANNUAL_INTEREST_RATE);
        vm.startPrank(C);
        boldToken.transfer(A, boldToken.balanceOf(C));
        vm.stopPrank();

        // === 1: Setup Batch Rebase === ///

        // Open 2 troves so we get enough interest
        // 1 will be redeemed down to 1 wei
        uint256 ATroveId = openTroveAndJoinBatchManager(A, 100 ether, MIN_DEBT, B, MAX_ANNUAL_INTEREST_RATE);
        // Sock Puppet Trove | Opened second so we can redeem this one | We need to redeem this one so we can inflate the precision loss
        uint256 BTroveId = openTroveAndJoinBatchManager(B, 100 ether, MIN_DEBT, B, MAX_ANNUAL_INTEREST_RATE);

        // MUST accrue to rebase shares
        // Limit to one block so this attack is basically unavoidable
        if (WITH_INTEREST) {
            vm.warp(block.timestamp + 12);
        }

        LatestBatchData memory b4Batch = troveManager.getLatestBatchData(address(B));

        // TODO: Open A, Mint 1 extra (forgiven to A)
        _addOneDebtAndEnsureItDoesntMintShares(ATroveId, A);

        LatestBatchData memory afterBatch = troveManager.getLatestBatchData(address(B));

        assertEq(
            b4Batch.entireDebtWithoutRedistribution + 1,
            afterBatch.entireDebtWithoutRedistribution,
            "Debt is credited to batch"
        );

        // Closing A here will credit to B and Batch, that's ok but not enough
        LatestTroveData memory trove = troveManager.getLatestTroveData(BTroveId);
        uint256 bEntireDebtB4 = trove.entireDebt;

        vm.startPrank(A);
        collateralRegistry.redeemCollateral(bEntireDebtB4, 100, 1e18); // 2 debt, 1 share (hopefully)
        vm.stopPrank();

        uint256 sharesAfterRedeem = _getBatchDebtShares(BTroveId);
        //assertEq(sharesAfterRedeem, 1, "Must be down to 1, rebased");
        assertEq(sharesAfterRedeem, 0, "Must be 0, as it was fully redeemed");

        // Let's have B get 1 share, 2 debt | Now it will be 1 | 1 because A is socializing that share
        LatestTroveData memory bAfterRedeem = troveManager.getLatestTroveData(BTroveId);
        //assertEq(bAfterRedeem.entireDebt, 1, "Must be 1, Should be 2 for exploit"); // NOTE: it's one because of the division on total shares
        assertEq(bAfterRedeem.entireDebt, 0, "Must be 0, as it was fully redeemed");

        // Close A (also remove from batch is fine)
        closeTrove(A, ATroveId);

        // Now B has rebased the Batch to 1 Share, 2 Debt
        LatestTroveData memory afterClose = troveManager.getLatestTroveData(BTroveId);
        //assertEq(afterClose.entireDebt, 2, "Becomes 2"); // Note the debt becomes 2 here because of the round down on what A needs to repay
        assertEq(afterClose.entireDebt, 0, "Still 0, as it had zero shares"); // Note the debt becomes 2 here because of the round down on what A needs to repay

        // === 2: Rebase to 100+ === //
        // We need to rebase to above 100
        uint256 x;
        while (x++ < 100) {
            // Each iteration adds 1 wei of debt to the Batch, while leaving the Shares at 1
            _openCloseRemainderLoop(1, BTroveId, x);
        }

        _logTrovesAndBatch(B, BTroveId);

        // === 3: Compound gains === //
        // We can now spam
        // Each block, we will rebase the share by charging the upfrontFee
        // This endsup taking
        uint256 y;
        while (y < 2560) {
            _triggerInterestRateFee();
            y++;

            LatestTroveData memory troveData = troveManager.getLatestTroveData(BTroveId);
            // This flags that we can borrow for free
            if (troveData.entireDebt > 4000e18 + 1) {
                break;
            }
        }
        // 2391 blocks
        console2.log("We have more than 2X MIN_DEBT of rebase it took us blocks:", y);

        _logTrovesAndBatch(B, BTroveId);

        // === 4: Free Loans === //
        // uint256 debtB4 = borrowerOperations.getEntireBranchDebt();
        // We should be able to open a new Trove now
        //uint256 anotherATroveId = openTroveExpectRevert(A, x + 1, 100 ether, MIN_DEBT, B);
        //assertEq(anotherATroveId, 0);
        uint256 anotherATroveId =
            openTroveAndJoinBatchManagerWithIndex(A, x + 1, 100 ether, MIN_DEBT, B, MAX_ANNUAL_INTEREST_RATE);
        assertGt(anotherATroveId, 0);

        /*
        LatestTroveData memory anotherATrove = troveManager.getLatestTroveData(anotherATroveId);
        uint256 aDebt = anotherATrove.entireDebt;

        // It will pay zero debt
        assertEq(aDebt, 0, "Forgiven");

        uint256 balB4 = boldToken.balanceOf(A);
        closeTrove(A, anotherATroveId);
        uint256 balAfter = boldToken.balanceOf(A);

        // And we can repeat this to get free debt
        uint256 debtAfter = borrowerOperations.getEntireBranchDebt();

        assertGt(debtAfter, debtB4, "Debt should have increased");
        assertLt(balB4, balAfter, "Something should have benn paid");
        */
    }

    uint128 subTractor = 1;

    // Trigger interest fee by changing the fee to it -1
    function _triggerInterestRateFee() internal {
        // Add Fee?
        vm.warp(block.timestamp + MIN_INTEREST_RATE_CHANGE_PERIOD);
        vm.startPrank(B);
        borrowerOperations.setBatchManagerAnnualInterestRate(1e18 - subTractor++, 0, 0, type(uint256).max);
        vm.stopPrank();
    }

    function _logTrovesAndBatch(address batch, uint256 /* troveId */ ) internal view {
        console2.log("");
        console2.log("Troves And Batch");
        // Log Batch Debt
        uint256 batchDebt = _getLatestBatchDebt(batch);
        console2.log("Batch Debt:           ", batchDebt);
        // Log all Batch shares
        uint256 batchShares = _getTotalBatchDebtShares(batch);
        console2.log("Batch Shares:         ", batchShares);
        // Log ratio
        uint256 batchSharesRatio = batchShares > 0 ? batchDebt / batchShares : 0;
        console2.log("debt / shares ratio:  ", batchSharesRatio);
        console2.log("Ratio too high?       ", batchSharesRatio > MAX_BATCH_SHARES_RATIO);

        // Trove
        /*
        LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
        console2.log("Trove Debt:           ", troveData.entireDebt);
        uint256 troveBatchShares = _getBatchDebtShares(troveId);
        console2.log("Trove Shares:         ", troveBatchShares);
        uint256 troveSharesRatio = troveBatchShares > 0 ? troveData.entireDebt / troveBatchShares : 0;
        console2.log("Trove ratio:          ", troveSharesRatio);
        console2.log("Ratio too high?       ", troveSharesRatio > MAX_BATCH_SHARES_RATIO);
        */
    }

    function _openCloseRemainderLoop(uint256 amt, uint256 BTroveId, uint256 iteration) internal {
        LatestTroveData memory troveBefore = troveManager.getLatestTroveData(BTroveId);

        // Open
        uint256 ATroveId =
            openTroveAndJoinBatchManagerWithIndex(A, iteration + 1, 100 ether, MIN_DEBT, B, MAX_ANNUAL_INTEREST_RATE);

        // Add debt
        _addDebtAndEnsureItMintsShares(ATroveId, A, amt);

        closeTrove(A, ATroveId); // Close A (also remove from batch is fine)

        LatestTroveData memory troveAfter = troveManager.getLatestTroveData(BTroveId);
        assertEq(troveAfter.entireDebt, troveBefore.entireDebt, "rebasing is not working");
        assertEq(troveAfter.entireDebt, 0, "trove B was closed");
    }

    function _addDebtAndEnsureItMintsShares(uint256 troveId, address caller, uint256 amt) internal {
        (,,,,,,,,, uint256 b4BatchDebtShares) = troveManager.Troves(troveId);

        withdrawBold100pct(caller, troveId, amt);

        (,,,,,,,,, uint256 afterBatchDebtShares) = troveManager.Troves(troveId);

        assertLt(b4BatchDebtShares, afterBatchDebtShares, "Shares should increase");
    }

    function _addDebtAndEnsureItDoesntMintShares(uint256 troveId, address caller, uint256 amt) internal {
        (,,,,,,,,, uint256 b4BatchDebtShares) = troveManager.Troves(troveId);

        withdrawBold100pct(caller, troveId, amt);

        (,,,,,,,,, uint256 afterBatchDebtShares) = troveManager.Troves(troveId);

        assertEq(b4BatchDebtShares, afterBatchDebtShares, "Same Shares");
    }

    function _addOneDebtAndEnsureItDoesntMintShares(uint256 troveId, address caller) internal {
        _addDebtAndEnsureItDoesntMintShares(troveId, caller, 1);
    }

    function _getLatestBatchDebt(address batch) internal view returns (uint256) {
        LatestBatchData memory batchData = troveManager.getLatestBatchData(batch);

        return batchData.entireDebtWithoutRedistribution;
    }

    function _getBatchDebtShares(uint256 troveId) internal view returns (uint256) {
        (,,,,,,,,, uint256 batchDebtShares) = troveManager.Troves(troveId);

        return batchDebtShares;
    }

    function _getTotalBatchDebtShares(address batch) internal view returns (uint256) {
        (,,,,,,, uint256 allBatchDebtShares) = troveManager.getBatch(batch);

        return allBatchDebtShares;
    }

    function openTroveExpectRevert(
        address _troveOwner,
        uint256 _troveIndex,
        uint256 _coll,
        uint256 _debt,
        address _batchAddress
    ) internal returns (uint256) {
        IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams memory params = IBorrowerOperations
            .OpenTroveAndJoinInterestBatchManagerParams({
            owner: _troveOwner,
            ownerIndex: _troveIndex,
            collAmount: _coll,
            boldAmount: _debt,
            upperHint: 0,
            lowerHint: 0,
            interestBatchManager: _batchAddress,
            maxUpfrontFee: 1e24,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(_troveOwner);
        vm.expectRevert(TroveManager.BatchSharesRatioTooHigh.selector);
        uint256 troveId = borrowerOperations.openTroveAndJoinInterestBatchManager(params);
        vm.stopPrank();

        return troveId;
    }

    // Rounding on batch decrease

    // See Coinspect audit report
    function testDeflateDebtLeavingSharesConstant() public {
        uint256 ITERATIONS = 200;

        // === Generate Bold Balance on A === //
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pct(C, 100 ether, 100e21, MAX_ANNUAL_INTEREST_RATE);
        vm.startPrank(C);
        boldToken.transfer(A, boldToken.balanceOf(C));
        vm.stopPrank();

        // B opens trove
        uint256 BTroveId = openTroveAndJoinBatchManager(B, 100 ether, MIN_DEBT - 2.3 ether, B, MAX_ANNUAL_INTEREST_RATE);

        if (WITH_INTEREST) {
            vm.warp(block.timestamp + 12);
        }
        _addOneDebtAndEnsureItDoesntMintShares(BTroveId, B);

        (uint256 debtBefore,,,,,,, uint256 allBatchDebtSharesBefore) = troveManager.getBatch(B);
        uint256 sharesBeforeRepay = _getBatchDebtShares(BTroveId);
        assertEq(sharesBeforeRepay, allBatchDebtSharesBefore, "Shares mismatch before repayment");

        console2.log("batchDebtShares: %s", sharesBeforeRepay);
        console2.log("debt: %s", debtBefore);
        console2.log("allBatchDebtSharesBefore: %s", allBatchDebtSharesBefore);

        uint256 debtAfter;
        uint256 allBatchDebtSharesAfter;
        uint256 sharesAfterRepay;

        console2.log("\n repay to force rounding");
        uint256 x;
        vm.startPrank(B);
        while (x++ < ITERATIONS) {
            borrowerOperations.repayBold(BTroveId, 1);
        }
        vm.stopPrank();

        (debtAfter,,,,,,, allBatchDebtSharesAfter) = troveManager.getBatch(B);
        sharesAfterRepay = _getBatchDebtShares(BTroveId);
        assertEq(sharesAfterRepay, allBatchDebtSharesAfter, "Shares mismatch after repayment");
        assertEq(sharesAfterRepay, sharesBeforeRepay, "Shares should not have changed");
        assertLe(debtBefore - debtAfter, ITERATIONS, "Too much debt change");

        console2.log("batchDebtShares: %s", sharesAfterRepay);
        console2.log("debt: %s", debtAfter);
        console2.log("allBatchDebtSharesAfter: %s", allBatchDebtSharesAfter);

        console2.log("\ndeltas");
        console2.log("batchDebtShares: %s", sharesBeforeRepay - sharesAfterRepay);
        console2.log("debt: %s", debtBefore - debtAfter);
        console2.log("allBatchDebtSharesBefore: %s", allBatchDebtSharesBefore - allBatchDebtSharesAfter);
    }

    function test_WhenBatchSharesRatioIsTooHigh_CanKickTroveFromBatch() external {
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

            // Shouldn't be able to kick the Trove yet
            vm.expectRevert(BorrowerOperations.BatchSharesRatioTooLow.selector);
            borrowerOperations.kickFromBatch(targetTrove, 0, 0);

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

        // The target Trove has more than MIN_DEBT
        assertGeDecimal(troveManager.getTroveEntireDebt(targetTrove), MIN_DEBT, 18, "debt < MIN_DEBT");

        // Yet can't be put back into SortedTroves due to the debt:shares ratio
        vm.expectRevert(TroveManager.BatchSharesRatioTooHigh.selector);
        borrowerOperations.applyPendingDebt(targetTrove);

        // After kicking the Trove from its batch, it can be put back into SortedTroves
        borrowerOperations.kickFromBatch(targetTrove, 0, 0);
        borrowerOperations.applyPendingDebt(targetTrove);

        // Now it should be redeemable again
        uint256 debtBefore = troveManager.getTroveEntireDebt(targetTrove);
        redeem(A, 1_000 ether);
        assertEqDecimal(troveManager.getTroveEntireDebt(targetTrove), debtBefore - 1_000 ether, 18, "wrong debt");
    }
}
