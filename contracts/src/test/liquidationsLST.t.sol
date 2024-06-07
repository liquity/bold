pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract LiquidationsLSTTest is DevTestSetup {
    function setUp() public override {
        // Start tests at a non-zero timestamp
        vm.warp(block.timestamp + 600);

        accounts = new Accounts();
        createAccounts();

        (A, B, C, D, E, F, G) = (
            accountsList[0],
            accountsList[1],
            accountsList[2],
            accountsList[3],
            accountsList[4],
            accountsList[5],
            accountsList[6]
        );

        LiquityContracts memory contracts;
        (contracts, collateralRegistry, boldToken) = _deployAndConnectContracts(TroveManagerParams(120e16, 5e16, 10e16));
        WETH = contracts.WETH;
        activePool = contracts.activePool;
        borrowerOperations = contracts.borrowerOperations;
        collSurplusPool = contracts.collSurplusPool;
        defaultPool = contracts.defaultPool;
        gasPool = contracts.gasPool;
        priceFeed = contracts.priceFeed;
        sortedTroves = contracts.sortedTroves;
        stabilityPool = contracts.stabilityPool;
        troveManager = contracts.troveManager;
        mockInterestRouter = contracts.interestRouter;

        MCR = troveManager.MCR();

        // Give some ETH to test accounts, and approve it to BorrowerOperations
        uint256 initialETHAmount = 10_000e18;
        for (uint256 i = 0; i < 6; i++) {
            // A to F
            giveAndApproveETH(accountsList[i], initialETHAmount);
        }
    }

    function testLiquidationRedistributionWithSurplus() public {
        uint256 liquidationAmount = 2000e18;
        uint256 collAmount = 2e18;

        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        uint256 ATroveId = borrowerOperations.openTrove(
            A, 0, collAmount, liquidationAmount - troveManager.BOLD_GAS_COMPENSATION(), 0, 0, 0, 0
        );
        vm.stopPrank();

        vm.startPrank(B);
        uint256 BTroveId = borrowerOperations.openTrove(B, 0, 2 * collAmount, liquidationAmount, 0, 0, 0, 0);

        // Price drops
        priceFeed.setPrice(1200e18 - 1);
        uint256 price = priceFeed.fetchPrice();

        uint256 BInitialDebt = troveManager.getTroveEntireDebt(BTroveId);
        uint256 BInitialColl = troveManager.getTroveEntireColl(BTroveId);
        uint256 AInitialETHBalance = WETH.balanceOf(A);

        // Check not RM
        assertEq(troveManager.checkBelowCriticalThreshold(price), false, "System should not be below CT");

        // Check CR_A < MCR and TCR > CCR
        assertLt(troveManager.getCurrentICR(ATroveId, price), MCR);
        assertGt(troveManager.getTCR(price), CCR);

        assertEq(troveManager.getTroveIdsCount(), 2);

        troveManager.liquidate(ATroveId);

        // Check Troves count reduced by 1
        assertEq(troveManager.getTroveIdsCount(), 1);

        // Check SP stays the same
        assertEq(stabilityPool.getTotalBoldDeposits(), 0, "SP should be empty");
        assertEq(stabilityPool.getETHBalance(), 0, "SP should not have ETH rewards");

        // Check B has received debt
        assertEq(troveManager.getTroveEntireDebt(BTroveId) - BInitialDebt, liquidationAmount, "B debt mismatch");
        // Check B has received all coll minus coll gas comp
        assertApproxEqAbs(
            troveManager.getTroveEntireColl(BTroveId) - BInitialColl,
            LiquityMath._min(
                collAmount * 995 / 1000, // Collateral - coll gas comp
                liquidationAmount * DECIMAL_PRECISION / price * 110 / 100 // debt with penalty
            ),
            10,
            "B trove coll mismatch"
        );

        // Check A retains ~9.5% of the collateral (after claiming from CollSurplus)
        // collAmount - 0.5% - (liquidationAmount to ETH + 10%)
        uint256 collSurplusAmount = collAmount * 995 / 1000 - liquidationAmount * DECIMAL_PRECISION / price * 110 / 100;
        assertApproxEqAbs(
            WETH.balanceOf(address(collSurplusPool)),
            collSurplusAmount,
            10,
            "CollSurplusPoll should have received collateral"
        );
        vm.startPrank(A);
        borrowerOperations.claimCollateral();
        vm.stopPrank();
        assertApproxEqAbs(
            WETH.balanceOf(A) - AInitialETHBalance, collSurplusAmount, 10, "A collateral balance mismatch"
        );
    }

    struct InitialValues {
        uint256 spBoldBalance;
        uint256 spETHBalance;
        uint256 AETHBalance;
        uint256 BDebt;
        uint256 BColl;
    }

    struct FinalValues {
        uint256 spBoldBalance;
        uint256 spETHBalance;
        uint256 collToLiquidate;
        uint256 collSPPortion;
        uint256 collPenaltySP;
        uint256 collToSendToSP;
        uint256 collRedistributionPortion;
        uint256 collPenaltyRedistribution;
    }

    function testLiquidationFuzz(uint256 _finalPrice, uint256 _spAmount) public {
        uint256 liquidationAmount = 2000e18;
        uint256 collAmount = 2e18;
        uint256 initialPrice = 2000e18;
        // A initial CR: 200%

        _finalPrice = bound(_finalPrice, 1000e18, 1200e18 - 1); // A final CR in [100%, 120%[
        _spAmount = bound(_spAmount, 0, liquidationAmount);

        priceFeed.setPrice(initialPrice);
        vm.startPrank(A);
        uint256 ATroveId = borrowerOperations.openTrove(
            A, 0, collAmount, liquidationAmount - troveManager.BOLD_GAS_COMPENSATION(), 0, 0, 0, 0
        );
        vm.stopPrank();

        vm.startPrank(B);
        uint256 BTroveId = borrowerOperations.openTrove(B, 0, 3 * collAmount, liquidationAmount, 0, 0, 0, 0);
        vm.stopPrank();
        // B deposits to SP
        if (_spAmount > 0) {
            makeSPDepositAndClaim(B, _spAmount);
        }

        // Price drops
        priceFeed.setPrice(_finalPrice);
        console2.log(_finalPrice, "_finalPrice");

        InitialValues memory initialValues;
        initialValues.spBoldBalance = stabilityPool.getTotalBoldDeposits();
        initialValues.spETHBalance = stabilityPool.getETHBalance();
        initialValues.AETHBalance = WETH.balanceOf(A);
        initialValues.BDebt = troveManager.getTroveEntireDebt(BTroveId);
        initialValues.BColl = troveManager.getTroveEntireColl(BTroveId);

        // Check not RM
        assertEq(troveManager.checkBelowCriticalThreshold(_finalPrice), false, "System should not be below CT");

        // Check CR_A < MCR and TCR > CCR
        assertLt(troveManager.getCurrentICR(ATroveId, _finalPrice), MCR);
        assertGt(troveManager.getTCR(_finalPrice), CCR);

        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        troveManager.liquidate(ATroveId);

        // Check Troves count reduced by 1
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);

        // Offset part
        FinalValues memory finalValues;
        finalValues.collToLiquidate = collAmount * 995 / 1000;
        // Check SP Bold has decreased
        finalValues.spBoldBalance = stabilityPool.getTotalBoldDeposits();
        assertEq(initialValues.spBoldBalance - finalValues.spBoldBalance, _spAmount, "SP Bold balance mismatch");
        // Check SP ETH has  increased
        finalValues.spETHBalance = stabilityPool.getETHBalance();
        finalValues.collSPPortion = finalValues.collToLiquidate * _spAmount / liquidationAmount;
        finalValues.collPenaltySP = _spAmount * DECIMAL_PRECISION / _finalPrice * 105 / 100;
        finalValues.collToSendToSP = LiquityMath._min(finalValues.collPenaltySP, finalValues.collSPPortion);
        // liquidationAmount to ETH + 5%
        assertApproxEqAbs(
            finalValues.spETHBalance - initialValues.spETHBalance,
            finalValues.collToSendToSP,
            10,
            "SP ETH balance mismatch"
        );

        // Redistribution part
        finalValues.collRedistributionPortion = finalValues.collToLiquidate - finalValues.collSPPortion;
        finalValues.collPenaltyRedistribution =
            (liquidationAmount - _spAmount) * DECIMAL_PRECISION / _finalPrice * 110 / 100;
        // Check B has received debt
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(BTroveId) - initialValues.BDebt,
            liquidationAmount - _spAmount,
            10,
            "B debt mismatch"
        );
        // Check B has received coll
        assertApproxEqAbs(
            troveManager.getTroveEntireColl(BTroveId) - initialValues.BColl,
            LiquityMath._min(
                finalValues.collPenaltyRedistribution,
                finalValues.collRedistributionPortion + finalValues.collSPPortion - finalValues.collToSendToSP
            ),
            10,
            "B trove coll mismatch"
        );

        // Surplus
        // Check A retains part of the collateral (after claiming from CollSurplus)
        // collAmount - 0.5% - (liquidationAmount to ETH + penalty)
        uint256 collPenalty = finalValues.collPenaltySP + finalValues.collPenaltyRedistribution;
        console2.log(finalValues.collPenaltySP, "finalValues.collPenaltySP");
        console2.log(finalValues.collPenaltyRedistribution, "finalValues.collPenaltyRedistribution");
        console2.log(collPenalty, "collPenalty");
        uint256 collSurplusAmount;
        if (collPenalty < finalValues.collToLiquidate) {
            collSurplusAmount = finalValues.collToLiquidate - collPenalty;
        }
        assertApproxEqAbs(WETH.balanceOf(address(collSurplusPool)), collSurplusAmount, 1e9, "CollSurplusPoll mismatch");
        if (collSurplusAmount > 0) {
            vm.startPrank(A);
            borrowerOperations.claimCollateral();
            vm.stopPrank();
            assertApproxEqAbs(
                WETH.balanceOf(A) - initialValues.AETHBalance, collSurplusAmount, 1e9, "A collateral balance mismatch"
            );
        }
    }
}
