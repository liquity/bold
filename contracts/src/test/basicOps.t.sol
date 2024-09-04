// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

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
        assertGt(debt_1, 0);
        uint256 coll_1 = troveManager.getTroveColl(B_Id);
        assertGt(coll_1, 0);
        vm.stopPrank();

        // B is now first in line to get redeemed, as they both have the same interest rate,
        // but B's Trove is younger.

        uint256 redemptionAmount = 1000e18; // 1k BOLD

        // A redeems 1k BOLD
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(redemptionAmount, 10, 1e18);

        // Check B's coll and debt reduced
        uint256 debt_2 = troveManager.getTroveDebt(B_Id);
        assertLt(debt_2, debt_1);
        uint256 coll_2 = troveManager.getTroveColl(B_Id);
        assertLt(coll_2, coll_1);
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
        (uint256 price,) = priceFeed.fetchPrice();

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

    function testSPDeposit() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        // A makes an SP deposit
        makeSPDepositAndClaim(A, 100e18);

        // time passes
        vm.warp(block.timestamp + 7 days);

        // A tops up their SP deposit
        makeSPDepositAndClaim(A, 100e18);

        // Check A's balance decreased and SP deposit increased (A gained some interest)
        assertGt(boldToken.balanceOf(A), 1800e18, "Wrong bold balance");
        assertLt(boldToken.balanceOf(A), 1801e18, "Wrong bold balance");
        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 200e18, "Wrong SP deposit");
    }

    function testSPWithdrawal() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        // A makes an SP deposit
        makeSPDepositAndClaim(A, 100e18);

        // time passes
        vm.warp(block.timestamp + 7 days);

        // Check A's balance decreased and SP deposit increased
        assertEq(boldToken.balanceOf(A), 1900e18);
        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 100e18);

        // A withdraws their full SP deposit
        makeSPWithdrawalAndClaim(A, 100e18);

        // Check A's balance increased and SP deposit decreased to 0 (A gained some interest)
        assertGt(boldToken.balanceOf(A), 2000e18, "Wrong bold balance");
        assertLt(boldToken.balanceOf(A), 2001e18, "Wrong bold balance");
        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 0, "Wrong SP deposit");
    }
}
