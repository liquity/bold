pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract LiquidationsTest is DevTestSetup {
    function testLiquidationOffsetWithSurplus() public {
        uint256 liquidationAmount = 2000e18;
        uint256 collAmount = 2e18;

        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        uint256 ATroveId = borrowerOperations.openTrove(A, 0, collAmount, liquidationAmount, 0, 0, 0, 0);
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.openTrove(B, 0, 2 * collAmount, liquidationAmount, 0, 0, 0, 0);
        vm.stopPrank();
        // B deposits to SP
        makeSPDepositAndClaim(B, liquidationAmount);

        // Price drops
        priceFeed.setPrice(1100e18 - 1);
        uint256 price = priceFeed.fetchPrice();

        uint256 initialSPBoldBalance = stabilityPool.getTotalBoldDeposits();
        uint256 initialSPCollBalance = stabilityPool.getCollBalance();
        uint256 AInitialCollBalance = collToken.balanceOf(A);

        // Check not RM
        assertEq(troveManager.checkBelowCriticalThreshold(price), false, "System should not be below CT");

        // Check CR_A < MCR and TCR > CCR
        assertLt(troveManager.getCurrentICR(ATroveId, price), MCR);
        assertGt(troveManager.getTCR(price), CCR);

        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        troveManager.liquidate(ATroveId);

        // Check Troves count is the same
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        // Check SP Bold has decreased
        uint256 finalSPBoldBalance = stabilityPool.getTotalBoldDeposits();
        assertEq(initialSPBoldBalance - finalSPBoldBalance, liquidationAmount, "SP Bold balance mismatch");
        // Check SP Coll has  increased
        uint256 finalSPCollBalance = stabilityPool.getCollBalance();
        // liquidationAmount to Coll + 5%
        assertApproxEqAbs(
            finalSPCollBalance - initialSPCollBalance,
            liquidationAmount * DECIMAL_PRECISION / price * 105 / 100,
            10,
            "SP Coll balance mismatch"
        );

        // Check A retains ~4.5% of the collateral (after claiming from CollSurplus)
        // collAmount - 0.5% - (liquidationAmount to Coll + 5%)
        uint256 collSurplusAmount = collAmount * 995 / 1000 - liquidationAmount * DECIMAL_PRECISION / price * 105 / 100;
        assertEq(
            troveManager.getTroveEntireColl(ATroveId),
            collSurplusAmount,
            "Coll Surplus mismatch"
        );
        vm.startPrank(A);
        borrowerOperations.closeTrove(ATroveId);
        vm.stopPrank();
        assertEq(collToken.balanceOf(A) - AInitialCollBalance, collSurplusAmount + ETH_GAS_COMPENSATION, "A collateral balance mismatch");
    }

    function testLiquidationOffsetNoSurplus() public {
        uint256 liquidationAmount = 10000e18;
        uint256 collAmount = 10e18;

        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        uint256 ATroveId = borrowerOperations.openTrove(A, 0, collAmount, liquidationAmount, 0, 0, 0, 0);
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.openTrove(B, 0, 3 * collAmount, liquidationAmount, 0, 0, 0, 0);
        vm.stopPrank();
        // B deposits to SP
        makeSPDepositAndClaim(B, liquidationAmount);

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

        troveManager.liquidate(ATroveId);

        // Check Troves count is the same
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        // Check SP Bold has decreased
        uint256 finalSPBoldBalance = stabilityPool.getTotalBoldDeposits();
        assertEq(initialSPBoldBalance - finalSPBoldBalance, liquidationAmount, "SP Bold balance mismatch");
        // Check SP Coll has increased by coll minus coll gas comp
        uint256 finalSPCollBalance = stabilityPool.getCollBalance();
        // liquidationAmount to Coll + 5%
        assertApproxEqAbs(
            finalSPCollBalance - initialSPCollBalance, collAmount * 995 / 1000, 10, "SP Coll balance mismatch"
        );

        // Check there’s no surplus
        assertEq(troveManager.getTroveEntireColl(ATroveId), 0, "CollSurplusPoll should be empty");

        // But still can close the trove
        uint256 collBalanceBefore = collToken.balanceOf(A);
        vm.startPrank(A);
        borrowerOperations.closeTrove(ATroveId);
        vm.stopPrank();

        // Check balance didn’t change after closing
        assertEq(collToken.balanceOf(A), collBalanceBefore + ETH_GAS_COMPENSATION, "A coll bal should be the same");
    }

    function testLiquidationRedistributionNoSurplus() public {
        uint256 liquidationAmount = 2000e18;
        uint256 collAmount = 2e18;

        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        uint256 ATroveId = borrowerOperations.openTrove(A, 0, collAmount, liquidationAmount, 0, 0, 0, 0);
        vm.stopPrank();

        vm.startPrank(B);
        uint256 BTroveId = borrowerOperations.openTrove(B, 0, 2 * collAmount, liquidationAmount, 0, 0, 0, 0);

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

        troveManager.liquidate(ATroveId);

        // Check Troves count is the same
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        // Check SP stays the same
        assertEq(stabilityPool.getTotalBoldDeposits(), 0, "SP should be empty");
        assertEq(stabilityPool.getCollBalance(), 0, "SP should not have Coll rewards");

        // Check B has received debt
        assertEq(troveManager.getTroveEntireDebt(BTroveId) - BInitialDebt, liquidationAmount, "B debt mismatch");
        // Check B has received all coll minus coll gas comp
        assertApproxEqAbs(
            troveManager.getTroveEntireColl(BTroveId) - BInitialColl,
            collAmount * 995 / 1000, // Collateral - coll gas comp
            10,
            "B trove coll mismatch"
        );

        assertEq(collToken.balanceOf(address(collSurplusPool)), 0, "CollSurplusPoll should be empty");
    }

    struct InitialValues {
        uint256 spBoldBalance;
        uint256 spCollBalance;
        uint256 ACollBalance;
        uint256 BDebt;
        uint256 BColl;
    }

    struct LiquidationVars {
        uint256 liquidationAmount;
        uint256 collAmount;
        uint256 ATroveId;
        uint256 BTroveId;
        uint256 price;
        uint256 trovesCount;
        uint256 finalSPBoldBalance;
        uint256 finalSPCollBalance;
        uint256 collSurplusAmount;
    }

    // Offset and Redistribution
    function testLiquidationMix() public {
        LiquidationVars memory vars;

        vars.liquidationAmount = 2000e18;
        vars.collAmount = 2e18;

        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        vars.ATroveId = borrowerOperations.openTrove(A, 0, vars.collAmount, vars.liquidationAmount, 0, 0, 0, 0);
        vm.stopPrank();

        vm.startPrank(B);
        vars.BTroveId = borrowerOperations.openTrove(B, 0, 2 * vars.collAmount, vars.liquidationAmount, 0, 0, 0, 0);
        vm.stopPrank();
        // B deposits to SP
        makeSPDepositAndClaim(B, vars.liquidationAmount / 2);

        // Price drops
        priceFeed.setPrice(1100e18 - 1);
        vars.price = priceFeed.fetchPrice();

        InitialValues memory initialValues;
        initialValues.spBoldBalance = stabilityPool.getTotalBoldDeposits();
        initialValues.spCollBalance = stabilityPool.getCollBalance();
        initialValues.ACollBalance = collToken.balanceOf(A);
        initialValues.BDebt = troveManager.getTroveEntireDebt(vars.BTroveId);
        initialValues.BColl = troveManager.getTroveEntireColl(vars.BTroveId);

        // Check not RM
        assertEq(troveManager.checkBelowCriticalThreshold(vars.price), false, "System should not be below CT");

        // Check CR_A < MCR and TCR > CCR
        assertLt(troveManager.getCurrentICR(vars.ATroveId, vars.price), MCR);
        assertGt(troveManager.getTCR(vars.price), CCR);

        vars.trovesCount = troveManager.getTroveIdsCount();
        assertEq(vars.trovesCount, 2);

        // Liquidate A
        troveManager.liquidate(vars.ATroveId);

        // Check Troves count is the same
        vars.trovesCount = troveManager.getTroveIdsCount();
        assertEq(vars.trovesCount, 2);

        // Check SP Bold has decreased
        vars.finalSPBoldBalance = stabilityPool.getTotalBoldDeposits();
        assertEq(initialValues.spBoldBalance - vars.finalSPBoldBalance, vars.liquidationAmount / 2, "SP Bold balance mismatch");
        // Check SP Coll has  increased
        vars.finalSPCollBalance = stabilityPool.getCollBalance();
        // liquidationAmount to Coll + 5%
        assertApproxEqAbs(
            vars.finalSPCollBalance - initialValues.spCollBalance,
            vars.liquidationAmount / 2 * DECIMAL_PRECISION / vars.price * 105 / 100,
            10,
            "SP Coll balance mismatch"
        );

        // Check B has received debt
        uint256 ANewColl = troveManager.getTroveEntireColl(vars.ATroveId);
        uint256 BNewColl = troveManager.getTroveEntireColl(vars.BTroveId);
        uint256 BRedistributedDebt = vars.liquidationAmount / 2 * BNewColl / (BNewColl + ANewColl);
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(vars.BTroveId) - initialValues.BDebt, BRedistributedDebt, 100, "B debt mismatch"
        );
        // Check B has received coll
        uint256 redistributedColl = vars.liquidationAmount / 2 * DECIMAL_PRECISION / vars.price * 110 / 100;
        uint256 BRedistributedColl = redistributedColl * BNewColl / (BNewColl + ANewColl);
        assertApproxEqAbs(
            troveManager.getTroveEntireColl(vars.BTroveId) - initialValues.BColl,
            BRedistributedColl,
            10,
            "B trove coll mismatch"
        );

        // Check A retains ~4.5% of the collateral
        // collAmount - 0.5% - (liquidationAmount to Coll + 5%)
        vars.collSurplusAmount = vars.collAmount * 995 / 1000
            - vars.liquidationAmount / 2 * DECIMAL_PRECISION / vars.price * 105 / 100
            - vars.liquidationAmount / 2 * DECIMAL_PRECISION / vars.price * 110 / 100;
        uint256 ARedistributedColl = redistributedColl * ANewColl / (BNewColl + ANewColl);
        assertApproxEqAbs(
            troveManager.getTroveEntireColl(vars.ATroveId),
            vars.collSurplusAmount + ARedistributedColl,
            10,
            "Coll Surplus should remain in trove"
        );

        vm.startPrank(A);
        borrowerOperations.closeTrove(vars.ATroveId);
        vm.stopPrank();
        assertApproxEqAbs(
            collToken.balanceOf(A) - initialValues.ACollBalance, vars.collSurplusAmount + ARedistributedColl + ETH_GAS_COMPENSATION, 10, "A collateral balance mismatch"
        );
    }
}
