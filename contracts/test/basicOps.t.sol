// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";

contract BasicOps is DevTestSetup {
    function testOpenTroveFailsWithoutAllowance() public {
        priceFeed.setPrice(2000e18);

        vm.startPrank(G);
        vm.expectRevert("ERC20: insufficient allowance");
        borrowerOperations.openTrove(
            G, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();
    }

    function testOpenTroveFailsWithoutBalance() public {
        priceFeed.setPrice(2000e18);

        vm.startPrank(G);
        collToken.approve(address(borrowerOperations), 2e18);
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        borrowerOperations.openTrove(
            G, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();
    }

    function testOpenTrove() public {
        priceFeed.setPrice(2000e18);
        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    function testOpenTrove_whenNoValidPrice_shouldRevert() public {
        priceFeed.setValidPrice(false);

        vm.startPrank(A);
        vm.expectRevert(bytes(priceFeed.REVERT_MSG()));
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();
    }

    function testCloseTrove() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        // Transfer some Bold to B so that B can close Trove accounting for interest and upfront fee
        boldToken.transfer(B, 100e18);
        vm.stopPrank();

        vm.startPrank(B);
        uint256 B_Id = borrowerOperations.openTrove(
            B, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        vm.startPrank(B);
        borrowerOperations.closeTrove(B_Id);
        vm.stopPrank();

        // Check Troves count reduced by 1
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    function testCloseTrove_whenNoValidPrice_shouldRevert() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        // Transfer some Bold to B so that B can close Trove accounting for interest and upfront fee
        boldToken.transfer(B, 100e18);
        vm.stopPrank();

        vm.startPrank(B);
        uint256 B_Id = borrowerOperations.openTrove(
            B, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();

        assertEq(troveManager.getTroveIdsCount(), 2);

        priceFeed.setValidPrice(false);

        vm.startPrank(B);
        vm.expectRevert(bytes(priceFeed.REVERT_MSG()));
        borrowerOperations.closeTrove(B_Id);
        vm.stopPrank();

        assertEq(troveManager.getTroveIdsCount(), 2);
    }

    function testAdjustTrove() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        uint256 A_Id = borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        // Check Trove coll and debt
        uint256 debt_1 = troveManager.getTroveDebt(A_Id);
        assertGt(debt_1, 0);
        uint256 coll_1 = troveManager.getTroveColl(A_Id);
        assertGt(coll_1, 0);

        // Adjust trove
        adjustTrove100pct(A, A_Id, 1e18, 500e18, true, true);

        // Check coll and debt altered
        uint256 debt_2 = troveManager.getTroveDebt(A_Id);
        assertGt(debt_2, debt_1);
        uint256 coll_2 = troveManager.getTroveColl(A_Id);
        assertGt(coll_2, coll_1);
    }

    function testAdjustTrove_whenNoValidPrice_shouldRevert() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        uint256 A_Id = borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        uint256 initialDebt = troveManager.getTroveDebt(A_Id);
        assertGt(initialDebt, 0);
        uint256 initialColl = troveManager.getTroveColl(A_Id);
        assertGt(initialColl, 0);

        priceFeed.setValidPrice(false);

        vm.startPrank(A);
        uint256 upfrontFee = predictAdjustTroveUpfrontFee(A_Id, 500e18);
        vm.expectRevert(bytes(priceFeed.REVERT_MSG()));
        borrowerOperations.adjustTrove(
            A_Id,
            1e18,
            true,
            500e18,
            true,
            upfrontFee
        );
        vm.stopPrank();

        assertEq(troveManager.getTroveDebt(A_Id), initialDebt);
        assertEq(troveManager.getTroveColl(A_Id), initialColl);
    }

    function testRedeem() public {
        priceFeed.setPrice(2000e18);

        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 5e18, 5_000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();

        vm.startPrank(B);
        uint256 B_Id = borrowerOperations.openTrove(
            B, 0, 5e18, 4_000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        uint256 debt_1 = troveManager.getTroveDebt(B_Id);
        assertGt(debt_1, 0, "Debt cannot be zero");
        uint256 coll_1 = troveManager.getTroveColl(B_Id);
        assertGt(coll_1, 0, "Coll cannot be zero");
        vm.stopPrank();

        // B is now first in line to get redeemed, as they both have the same interest rate,
        // but B's Trove is younger.

        uint256 redemptionAmount = 1000e18; // 1k BOLD

        // Wait some time so that redemption rate is not 100%
        vm.warp(block.timestamp + 7 days);

        // A redeems 1k BOLD
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(redemptionAmount, 10, 1e18);

        // Check B's coll and debt reduced
        uint256 debt_2 = troveManager.getTroveDebt(B_Id);
        assertLt(debt_2, debt_1, "Debt mismatch after");
        uint256 coll_2 = troveManager.getTroveColl(B_Id);
        assertLt(coll_2, coll_1, "Coll mismatch after");
    }

    function testRedeem_whenNoValidPrice_shouldRevert() public {
        priceFeed.setPrice(2000e18);

        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 5e18, 5_000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();

        vm.startPrank(B);
        uint256 B_Id = borrowerOperations.openTrove(
            B, 0, 5e18, 4_000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        uint256 debt_1 = troveManager.getTroveDebt(B_Id);
        assertGt(debt_1, 0, "Debt cannot be zero");
        uint256 coll_1 = troveManager.getTroveColl(B_Id);
        assertGt(coll_1, 0, "Coll cannot be zero");
        vm.stopPrank();

        vm.warp(block.timestamp + 7 days);

        priceFeed.setValidPrice(false);

        vm.startPrank(A);
        vm.expectRevert(bytes(priceFeed.REVERT_MSG()));
        collateralRegistry.redeemCollateral(1000e18, 10, 1e18);
        vm.stopPrank();

        assertEq(troveManager.getTroveDebt(B_Id), debt_1, "Debt mismatch after");
        assertEq(troveManager.getTroveColl(B_Id), coll_1, "Coll mismatch after");
    }

    function testLiquidation() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        uint256 A_Id = borrowerOperations.openTrove(
            A, 0, 2e18, 2200e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.openTrove(
            B, 0, 10e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        // Price drops
        priceFeed.setPrice(1200e18);
        uint256 price = priceFeed.fetchPrice();

        // Check CR_A < MCR and TCR > CCR
        assertLt(troveManager.getCurrentICR(A_Id, price), MCR);
        assertGt(troveManager.getTCR(price), CCR);

        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        troveManager.liquidate(A_Id);

        // Check Troves count reduced by 1
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    function testLiquidation_whenNoValidPrice_shouldRevert() public {
        priceFeed.setPrice(2000e18);

        vm.startPrank(A);
        uint256 A_Id = borrowerOperations.openTrove(
            A, 0, 2e18, 2200e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.openTrove(
            B, 0, 10e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();

        assertEq(troveManager.getTroveIdsCount(), 2);

        priceFeed.setPrice(1200e18);
        uint256 price = priceFeed.fetchPrice();

        assertLt(troveManager.getCurrentICR(A_Id, price), MCR);
        assertGt(troveManager.getTCR(price), CCR);

        priceFeed.setValidPrice(false);

        vm.startPrank(B);
        vm.expectRevert(bytes(priceFeed.REVERT_MSG()));
        troveManager.liquidate(A_Id);
        vm.stopPrank();

        assertEq(troveManager.getTroveIdsCount(), 2);
    }

    function testSPDeposit() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        // Simulate a revert on the feed which shouldn't matter, as the price is not used for SP deposits
        priceFeed.setValidPrice(false);

        // A makes an SP deposit
        makeSPDepositAndClaim(A, 100e18);

        // time passes
        vm.warp(block.timestamp + 7 days);

        // A tops up their SP deposit
        makeSPDepositAndClaim(A, 100e18);

        // Check A's balance decreased and SP deposit increased (A gained some interest)
        assertGt(boldToken.balanceOf(A), 1800e18, "Wrong bold balance");
        assertLt(boldToken.balanceOf(A), 1801e18, "Wrong bold balance");
        assertApproximatelyEqual(stabilityPool.getCompoundedBoldDeposit(A), 200e18, 1e3, "Wrong SP deposit");
    }

    function testSPWithdrawal() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        // Simulate a revert on the feed which shouldn't matter, as the price is not used for SP withdrawals
        priceFeed.setValidPrice(false);

        // A makes an SP deposit
        makeSPDepositAndClaim(A, 100e18);

        // time passes
        vm.warp(block.timestamp + 7 days);

        // Check A's balance decreased and SP deposit increased
        assertEq(boldToken.balanceOf(A), 1900e18);
        assertApproximatelyEqual(stabilityPool.getCompoundedBoldDeposit(A), 100e18, 1e2);

        // A withdraws their full SP deposit less 1e18
        makeSPWithdrawalAndClaim(A, 99e18);

        // Check A's balance increased and SP deposit decreased to 0 (A gained some interest)
        assertGt(boldToken.balanceOf(A), 1999e18, "Wrong bold balance");
        assertLt(boldToken.balanceOf(A), 2000e18, "Wrong bold balance");
        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 1e18, "Wrong SP deposit");
    }
}
