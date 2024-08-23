// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract BorrowerOperationsTest is DevTestSetup {
    function testCloseLastTroveReverts() public {
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 100000e18, 1e17);

        // Artificially mint to Alice so she has enough to close her trove
        uint256 aliceDebt = troveManager.getTroveEntireDebt(ATroveId);
        deal(address(boldToken), A, aliceDebt);

        // check is not below CT
        checkBelowCriticalThreshold(false);

        // Alice attempts to close her trove
        vm.startPrank(A);
        vm.expectRevert(TroveManager.OnlyOneTroveLeft.selector);
        borrowerOperations.closeTrove(ATroveId);
        vm.stopPrank();
    }

    function testRepayingTooMuchDebtCapsAtMinDebt() public {
        uint256 troveId = openTroveNoHints100pct(A, 100 ether, 2_000 ether, 0.01 ether);
        deal(address(boldToken), A, 3_000 ether);
        vm.prank(A);
        borrowerOperations.repayBold(troveId, 3_000 ether);

        assertEq(troveManager.getTroveEntireDebt(troveId), MIN_DEBT, "Trove debt should be MIN_DEBT");
    }

    function testWithdrawingTooMuchCollateralReverts() public {
        uint256 troveId = openTroveNoHints100pct(A, 100 ether, 2_000 ether, 0.01 ether);
        vm.prank(A);
        vm.expectRevert(BorrowerOperations.CollWithdrawalTooHigh.selector);
        borrowerOperations.withdrawColl(troveId, 200 ether);
    }

    function testZeroAdjustmentReverts() public {
        uint256 troveId = openTroveNoHints100pct(A, 100 ether, 2_000 ether, 0.01 ether);
        vm.prank(A);
        vm.expectRevert(BorrowerOperations.ZeroAdjustment.selector);
        borrowerOperations.adjustTrove(troveId, 0, false, 0, false, 1_000 ether);
    }

    function testOpenTroveChargesUpfrontFee() public {
        uint256 borrow = 10_000 ether;
        uint256 interestRate = 0.05 ether;

        uint256 upfrontFee = predictOpenTroveUpfrontFee(borrow, interestRate);
        assertGt(upfrontFee, 0);

        uint256 activePoolDebtBefore = activePool.getBoldDebt();

        vm.prank(A);
        uint256 troveId = borrowerOperations.openTrove(
            A, 0, 100 ether, borrow, 0, 0, interestRate, upfrontFee, address(0), address(0), address(0)
        );

        uint256 troveDebt = troveManager.getTroveEntireDebt(troveId);
        uint256 activePoolDebtAfter = activePool.getBoldDebt();

        uint256 expectedDebt = borrow + upfrontFee;
        assertEqDecimal(troveDebt, expectedDebt, 18, "Wrong Trove debt");
        assertEqDecimal(activePoolDebtAfter - activePoolDebtBefore, expectedDebt, 18, "Wrong AP debt increase");
    }

    function testOpenTroveRevertsIfUpfrontFeeExceedsUserProvidedLimit() public {
        uint256 borrow = 10_000 ether;
        uint256 interestRate = 0.05 ether;

        uint256 upfrontFee = predictOpenTroveUpfrontFee(borrow, interestRate);
        assertGt(upfrontFee, 0);

        vm.prank(A);
        vm.expectRevert(BorrowerOperations.UpfrontFeeTooHigh.selector);
        borrowerOperations.openTrove(
            A, 0, 100 ether, borrow, 0, 0, interestRate, upfrontFee - 1, address(0), address(0), address(0)
        );
    }

    function testWithdrawBoldChargesUpfrontFee() public {
        uint256 troveId = openTroveNoHints100pct(A, 100 ether, 10_000 ether, 0.05 ether);

        uint256 withdrawal = 1_000 ether;

        uint256 upfrontFee = predictAdjustTroveUpfrontFee(troveId, withdrawal);
        assertGt(upfrontFee, 0);

        uint256 troveDebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 activePoolDebtBefore = activePool.getBoldDebt();

        vm.prank(A);
        borrowerOperations.withdrawBold(troveId, withdrawal, upfrontFee);

        uint256 troveDebtAfter = troveManager.getTroveEntireDebt(troveId);
        uint256 activePoolDebtAfter = activePool.getBoldDebt();

        uint256 expectedDebtIncrease = withdrawal + upfrontFee;
        assertEqDecimal(troveDebtAfter - troveDebtBefore, expectedDebtIncrease, 18, "Wrong Trove debt increase");
        assertEqDecimal(activePoolDebtAfter - activePoolDebtBefore, expectedDebtIncrease, 18, "Wrong AP debt increase");
    }

    function testWithdrawBoldRevertsIfUpfrontFeeExceedsUserProvidedLimit() public {
        uint256 troveId = openTroveNoHints100pct(A, 100 ether, 10_000 ether, 0.05 ether);

        uint256 withdrawal = 1_000 ether;

        uint256 upfrontFee = predictAdjustTroveUpfrontFee(troveId, withdrawal);
        assertGt(upfrontFee, 0);

        vm.prank(A);
        vm.expectRevert(BorrowerOperations.UpfrontFeeTooHigh.selector);
        borrowerOperations.withdrawBold(troveId, withdrawal, upfrontFee - 1);
    }

    function testAdjustInterestRateFailsIfNotNew() public {
        uint256 troveId = openTroveNoHints100pct(A, 100 ether, 10_000 ether, 0.05 ether);
        vm.prank(A);
        vm.expectRevert(BorrowerOperations.InterestRateNotNew.selector);
        borrowerOperations.adjustTroveInterestRate(troveId, 0.05 ether, 0, 0, 1000e18);
    }

    function testAdjustInterestRateChargesUpfrontFeeWhenPremature() public {
        uint256 troveId = openTroveNoHints100pct(A, 100 ether, 10_000 ether, 0.05 ether);

        uint56[4] memory interestRate = [0.01 ether, 0.02 ether, 0.03 ether, 0.04 ether];

        // Wait less than the cooldown period, thus the next adjustment will have a cost
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN / 2);

        uint256 upfrontFee = predictAdjustInterestRateUpfrontFee(troveId, interestRate[1]);
        assertGt(upfrontFee, 0);

        uint256 troveDebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 activePoolDebtBefore = activePool.getBoldDebt();

        vm.prank(A);
        borrowerOperations.adjustTroveInterestRate(troveId, interestRate[1], 0, 0, upfrontFee);

        uint256 troveDebtAfter = troveManager.getTroveEntireDebt(troveId);
        uint256 activePoolDebtAfter = activePool.getBoldDebt();

        assertEqDecimal(troveDebtAfter - troveDebtBefore, upfrontFee, 18, "Wrong Trove debt increase 1");
        assertEqDecimal(activePoolDebtAfter - activePoolDebtBefore, upfrontFee, 18, "Wrong AP debt increase 1");

        // Once again wait less than the cooldown period, thus the next adjustment will still have a cost
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN * 3 / 4);

        upfrontFee = predictAdjustInterestRateUpfrontFee(troveId, interestRate[2]);
        assertGt(upfrontFee, 0);

        troveDebtBefore = troveManager.getTroveEntireDebt(troveId);
        activePoolDebtBefore = activePool.getBoldDebt();

        vm.prank(A);
        borrowerOperations.adjustTroveInterestRate(troveId, interestRate[2], 0, 0, upfrontFee);

        troveDebtAfter = troveManager.getTroveEntireDebt(troveId);
        activePoolDebtAfter = activePool.getBoldDebt();

        assertEqDecimal(troveDebtAfter - troveDebtBefore, upfrontFee, 18, "Wrong Trove debt increase 2");
        assertEqDecimal(activePoolDebtAfter - activePoolDebtBefore, upfrontFee, 18, "Wrong AP debt increase 2");

        // Wait for cooldown to finish, thus the next adjustment will be free again
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN);

        troveDebtBefore = troveManager.getTroveEntireDebt(troveId);
        activePoolDebtBefore = activePool.getBoldDebt();

        vm.prank(A);
        borrowerOperations.adjustTroveInterestRate(troveId, interestRate[3], 0, 0, 0);

        troveDebtAfter = troveManager.getTroveEntireDebt(troveId);
        activePoolDebtAfter = activePool.getBoldDebt();

        assertEqDecimal(troveDebtAfter - troveDebtBefore, 0, 18, "Wrong Trove debt increase 3");
        assertEqDecimal(activePoolDebtAfter - activePoolDebtBefore, 0, 18, "Wrong AP debt increase 3");
    }

    function testAdjustInterestRateRevertsWhenUpfrontFeeExceedsUserProvidedLimit() public {
        uint256 troveId = openTroveNoHints100pct(A, 100 ether, 10_000 ether, 0.05 ether);

        uint56 interestRate = 0.01 ether;

        // Wait less than the cooldown period, thus the next adjustment will have a cost
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN / 2);

        uint256 upfrontFee = predictAdjustInterestRateUpfrontFee(troveId, interestRate);
        assertGt(upfrontFee, 0);

        vm.prank(A);
        vm.expectRevert(BorrowerOperations.UpfrontFeeTooHigh.selector);
        borrowerOperations.adjustTroveInterestRate(troveId, interestRate, 0, 0, upfrontFee - 1);
    }
}
