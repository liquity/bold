// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract LiquidationsTest is DevTestSetup {
    struct LiquidationsTestVars {
        uint256 liquidationAmount;
        uint256 collAmount;
        uint256 ATroveId;
        uint256 BTroveId;
        uint256 price;
        uint256 spBoldBalance;
        uint256 spCollBalance;
        uint256 ACollBalance;
        uint256 BDebt;
        uint256 BColl;
        uint256 AInterest;
        uint256 BInterest;
    }

    function testLiquidationOffsetWithSurplus() public {
        uint256 liquidationAmount = 2000e18;
        uint256 collAmount = 2e18;

        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        uint256 ATroveId = borrowerOperations.openTrove(
            A,
            0,
            collAmount,
            liquidationAmount,
            0,
            0,
            MIN_ANNUAL_INTEREST_RATE,
            1000e18,
            address(0),
            address(0),
            address(0)
        );
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.openTrove(
            B,
            0,
            2 * collAmount,
            liquidationAmount + 100e18,
            0,
            0,
            MIN_ANNUAL_INTEREST_RATE,
            1000e18,
            address(0),
            address(0),
            address(0)
        );
        vm.stopPrank();
        // B deposits to SP
        makeSPDepositAndClaim(B, liquidationAmount + 100e18);

        // Price drops
        priceFeed.setPrice(1100e18 - 1);
        uint256 price = priceFeed.fetchPrice();

        LiquidationsTestVars memory initialValues;
        initialValues.spBoldBalance = stabilityPool.getTotalBoldDeposits();
        initialValues.spCollBalance = stabilityPool.getCollBalance();
        initialValues.ACollBalance = collToken.balanceOf(A);

        // Check not RM
        assertEq(troveManager.checkBelowCriticalThreshold(price), false, "System should not be below CT");

        // Check CR_A < MCR and TCR > CCR
        assertLt(troveManager.getCurrentICR(ATroveId, price), MCR);
        assertGt(troveManager.getTCR(price), CCR);

        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        initialValues.AInterest = troveManager.getTroveEntireDebt(ATroveId) - liquidationAmount;
        troveManager.liquidate(ATroveId);

        // Check Troves count reduced by 1
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);

        // Check SP Bold has decreased
        uint256 finalSPBoldBalance = stabilityPool.getTotalBoldDeposits();
        assertEq(
            initialValues.spBoldBalance - finalSPBoldBalance,
            liquidationAmount + initialValues.AInterest,
            "SP Bold balance mismatch"
        );
        // Check SP Coll has  increased
        uint256 finalSPCollBalance = stabilityPool.getCollBalance();
        // liquidationAmount to Coll + 5%
        assertApproxEqAbs(
            finalSPCollBalance - initialValues.spCollBalance,
            (liquidationAmount + initialValues.AInterest) * DECIMAL_PRECISION / price * 105 / 100,
            10,
            "SP Coll balance mismatch"
        );

        // Check A retains ~4.5% of the collateral (after claiming from CollSurplus)
        // collAmount - 0.5% - (liquidationAmount to Coll + 5%)
        uint256 collSurplusAmount = collAmount * 995 / 1000
            - (liquidationAmount + initialValues.AInterest) * DECIMAL_PRECISION / price * 105 / 100;
        assertApproxEqAbs(
            collToken.balanceOf(address(collSurplusPool)),
            collSurplusAmount,
            1,
            "CollSurplusPool should have received collateral"
        );
        assertEq(
            collToken.balanceOf(address(collSurplusPool)),
            collSurplusPool.getCollBalance(),
            "CollSurplusPool balance and getter should match"
        );
        vm.startPrank(A);
        borrowerOperations.claimCollateral();
        vm.stopPrank();
        assertApproxEqAbs(
            collToken.balanceOf(A) - initialValues.ACollBalance, collSurplusAmount, 1, "A collateral balance mismatch"
        );
    }

    function testLiquidationOffsetNoSurplus() public {
        uint256 liquidationAmount = 10000e18;
        uint256 collAmount = 10e18;

        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        uint256 ATroveId = borrowerOperations.openTrove(
            A,
            0,
            collAmount,
            liquidationAmount,
            0,
            0,
            MIN_ANNUAL_INTEREST_RATE,
            1000e18,
            address(0),
            address(0),
            address(0)
        );
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.openTrove(
            B,
            0,
            3 * collAmount,
            liquidationAmount + 100e18,
            0,
            0,
            MIN_ANNUAL_INTEREST_RATE,
            1000e18,
            address(0),
            address(0),
            address(0)
        );
        vm.stopPrank();
        // B deposits to SP
        makeSPDepositAndClaim(B, liquidationAmount + 100e18);

        // Price drops
        priceFeed.setPrice(1030e18);
        uint256 price = priceFeed.fetchPrice();

        uint256 initialSPBoldBalance = stabilityPool.getTotalBoldDeposits();
        uint256 initialSPCollBalance = stabilityPool.getCollBalance();

        // Check not RM
        assertEq(troveManager.checkBelowCriticalThreshold(price), false, "System should not be below CT");

        // Check CR_A < MCR and TCR > CCR
        assertLt(troveManager.getCurrentICR(ATroveId, price), MCR, "ICR too high");
        assertGe(troveManager.getTCR(price), CCR, "TCR too low");

        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        uint256 AInterest = troveManager.getTroveEntireDebt(ATroveId) - liquidationAmount;
        troveManager.liquidate(ATroveId);

        // Check Troves count reduced by 1
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);

        // Check SP Bold has decreased
        uint256 finalSPBoldBalance = stabilityPool.getTotalBoldDeposits();
        assertEq(initialSPBoldBalance - finalSPBoldBalance, liquidationAmount + AInterest, "SP Bold balance mismatch");
        // Check SP Coll has increased by coll minus coll gas comp
        uint256 finalSPCollBalance = stabilityPool.getCollBalance();
        // liquidationAmount to Coll + 5%
        assertApproxEqAbs(
            finalSPCollBalance - initialSPCollBalance, collAmount * 995 / 1000, 10, "SP Coll balance mismatch"
        );

        // Check there’s no surplus
        assertEq(collToken.balanceOf(address(collSurplusPool)), 0, "CollSurplusPool should be empty");
        assertEq(
            collToken.balanceOf(address(collSurplusPool)),
            collSurplusPool.getCollBalance(),
            "CollSurplusPool balance and getter should match"
        );

        vm.startPrank(A);
        vm.expectRevert("CollSurplusPool: No collateral available to claim");
        borrowerOperations.claimCollateral();
        vm.stopPrank();
    }

    function testLiquidationRedistributionNoSurplus() public {
        uint256 liquidationAmount = 2000e18;
        uint256 collAmount = 2e18;

        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        uint256 ATroveId = borrowerOperations.openTrove(
            A,
            0,
            collAmount,
            liquidationAmount,
            0,
            0,
            MIN_ANNUAL_INTEREST_RATE,
            1000e18,
            address(0),
            address(0),
            address(0)
        );
        vm.stopPrank();

        vm.startPrank(B);
        uint256 BTroveId = borrowerOperations.openTrove(
            B,
            0,
            2 * collAmount,
            liquidationAmount,
            0,
            0,
            MIN_ANNUAL_INTEREST_RATE,
            1000e18,
            address(0),
            address(0),
            address(0)
        );

        // Price drops
        priceFeed.setPrice(1100e18 - 1);
        uint256 price = priceFeed.fetchPrice();

        uint256 BInitialDebt = troveManager.getTroveEntireDebt(BTroveId);
        uint256 BInitialColl = troveManager.getTroveEntireColl(BTroveId);

        // Check not RM
        assertEq(troveManager.checkBelowCriticalThreshold(price), false, "System should not be below CT");

        // Check CR_A < MCR and TCR > CCR
        assertLt(troveManager.getCurrentICR(ATroveId, price), MCR);
        assertGt(troveManager.getTCR(price), CCR);

        // Check empty SP
        assertEq(stabilityPool.getTotalBoldDeposits(), 0, "SP should be empty");

        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        uint256 AInterest = troveManager.getTroveEntireDebt(ATroveId) - liquidationAmount;
        troveManager.liquidate(ATroveId);

        // Check Troves count reduced by 1
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);

        // Check SP stays the same
        assertEq(stabilityPool.getTotalBoldDeposits(), 0, "SP should be empty");
        assertEq(stabilityPool.getCollBalance(), 0, "SP should not have Coll rewards");

        // Check B has received debt
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(BTroveId) - BInitialDebt,
            liquidationAmount + AInterest,
            3,
            "B debt mismatch"
        );
        // Check B has received all coll minus coll gas comp
        assertApproxEqAbs(
            troveManager.getTroveEntireColl(BTroveId) - BInitialColl,
            collAmount, // no coll gas comp
            10,
            "B trove coll mismatch"
        );

        assertEq(collToken.balanceOf(address(collSurplusPool)), 0, "CollSurplusPool should be empty");
        assertEq(
            collToken.balanceOf(address(collSurplusPool)),
            collSurplusPool.getCollBalance(),
            "CollSurplusPool balance and getter should match"
        );
    }

    // Offset and Redistribution
    function testLiquidationMix() public {
        LiquidationsTestVars memory vars;
        vars.liquidationAmount = 2000e18;
        vars.collAmount = 2e18;

        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        vars.ATroveId = borrowerOperations.openTrove(
            A,
            0,
            vars.collAmount,
            vars.liquidationAmount,
            0,
            0,
            MIN_ANNUAL_INTEREST_RATE,
            1000e18,
            address(0),
            address(0),
            address(0)
        );
        vm.stopPrank();

        vm.startPrank(B);
        vars.BTroveId = borrowerOperations.openTrove(
            B,
            0,
            2 * vars.collAmount,
            vars.liquidationAmount,
            0,
            0,
            MIN_ANNUAL_INTEREST_RATE,
            1000e18,
            address(0),
            address(0),
            address(0)
        );
        vm.stopPrank();
        // B deposits to SP
        makeSPDepositAndClaim(B, vars.liquidationAmount / 2);

        // Price drops
        priceFeed.setPrice(1100e18 - 1);
        vars.price = priceFeed.fetchPrice();

        vars.spBoldBalance = stabilityPool.getTotalBoldDeposits();
        vars.spCollBalance = stabilityPool.getCollBalance();
        vars.ACollBalance = collToken.balanceOf(A);
        vars.BDebt = troveManager.getTroveEntireDebt(vars.BTroveId);
        vars.BColl = troveManager.getTroveEntireColl(vars.BTroveId);

        // Check not RM
        assertEq(troveManager.checkBelowCriticalThreshold(vars.price), false, "System should not be below CT");

        // Check CR_A < MCR and TCR > CCR
        assertLt(troveManager.getCurrentICR(vars.ATroveId, vars.price), MCR);
        assertGt(troveManager.getTCR(vars.price), CCR);

        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        vars.AInterest = troveManager.getTroveEntireDebt(vars.ATroveId) - vars.liquidationAmount;
        troveManager.liquidate(vars.ATroveId);

        // Check Troves count reduced by 1
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);

        // Check SP Bold has decreased
        uint256 finalSPBoldBalance = stabilityPool.getTotalBoldDeposits();
        // subtract 1e18 for the min remaining in the SP
        assertEq(vars.spBoldBalance - finalSPBoldBalance, vars.liquidationAmount / 2 - 1e18, "SP Bold balance mismatch");
        // Check SP Coll has  increased
        uint256 finalSPCollBalance = stabilityPool.getCollBalance();
        // vars.liquidationAmount to Coll + 5%
        assertApproxEqAbs(
            finalSPCollBalance - vars.spCollBalance,
            // subtract 1e18 for the min remaining in the SP
            (vars.liquidationAmount / 2 - 1e18) * DECIMAL_PRECISION / vars.price * 105 / 100,
            10,
            "SP Coll balance mismatch"
        );

        // Check B has received debt
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(vars.BTroveId) - vars.BDebt,
            // Add 1e18 for the extra redist portion due to SP min 1e18
            vars.liquidationAmount / 2 + 1e18 + vars.AInterest,
            3,
            "B debt mismatch"
        );
        // // Check B has received coll
        assertApproxEqAbs(
            troveManager.getTroveEntireColl(vars.BTroveId) - vars.BColl,
            //vars.collAmount * 995 / 1000 - vars.liquidationAmount / 2 * DECIMAL_PRECISION / vars.price * 105 / 100,
            // add 1e18 for extra redist portion
            (vars.liquidationAmount / 2 + 1e18 + vars.AInterest) * DECIMAL_PRECISION / vars.price * 110 / 100,
            10,
            "B trove coll mismatch"
        );

        // Check A retains ~4.5% of the collateral (after claiming from CollSurplus)
        // vars.collAmount - 0.5% (of offset) - (vars.liquidationAmount to Coll + 5% / 10%)
        uint256 collSurplusAmount =
        // Portion offset
        vars.collAmount * (vars.liquidationAmount / 2 - 1e18) / (vars.liquidationAmount + vars.AInterest) * 995 / 1000
            - (vars.liquidationAmount / 2 - 1e18) * DECIMAL_PRECISION / vars.price * 105 / 100
        // Portion redistributed
        + vars.collAmount * (vars.liquidationAmount / 2 + 1e18 + vars.AInterest)
            / (vars.liquidationAmount + vars.AInterest)
            - (vars.liquidationAmount / 2 + 1e18 + vars.AInterest) * DECIMAL_PRECISION / vars.price * 110 / 100;
        assertApproxEqAbs(
            collToken.balanceOf(address(collSurplusPool)),
            collSurplusAmount,
            10,
            "CollSurplusPool should have received collateral"
        );
        assertEq(
            collToken.balanceOf(address(collSurplusPool)),
            collSurplusPool.getCollBalance(),
            "CollSurplusPool balance and getter should match"
        );
        vm.startPrank(A);
        borrowerOperations.claimCollateral();
        vm.stopPrank();
        assertApproxEqAbs(
            collToken.balanceOf(A) - vars.ACollBalance, collSurplusAmount, 10, "A collateral balance mismatch"
        );
    }
}
