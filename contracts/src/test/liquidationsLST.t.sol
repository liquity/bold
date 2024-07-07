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

        LiquityContracts[] memory contractsArray;
        TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](2);
        troveManagerParamsArray[0] = TroveManagerParams(110e16, 110e16, 5e16, 10e16);
        troveManagerParamsArray[1] = TroveManagerParams(120e16, 110e16, 5e16, 10e16);
        (contractsArray, collateralRegistry, boldToken,,, WETH) =
            _deployAndConnectContracts(troveManagerParamsArray);
        collToken = contractsArray[1].collToken;
        activePool = contractsArray[1].activePool;
        borrowerOperations = contractsArray[1].borrowerOperations;
        defaultPool = contractsArray[1].defaultPool;
        gasPool = contractsArray[1].gasPool;
        priceFeed = contractsArray[1].priceFeed;
        sortedTroves = contractsArray[1].sortedTroves;
        stabilityPool = contractsArray[1].stabilityPool;
        troveManager = contractsArray[1].troveManager;
        mockInterestRouter = contractsArray[1].interestRouter;

        MCR = troveManager.MCR();

        // Give some Coll to test accounts, and approve it to BorrowerOperations
        uint256 initialCollAmount = 10_000e18;
        // A to F
        for (uint256 i = 0; i < 6; i++) {
            // WETH to BorrowerOperations of branch 1
            giveAndApproveCollateral(WETH, accountsList[i], initialCollAmount, address(borrowerOperations));
            // LST of branch 1
            giveAndApproveCollateral(collToken, accountsList[i], initialCollAmount, address(borrowerOperations));
        }
    }

    struct LiquidationVars {
        uint256 liquidationAmount;
        uint256 collAmount;
        uint256 ATroveId;
        uint256 BTroveId;
        uint256 price;
        uint256 trovesCount;
        uint256 collSurplusAmount;
    }

    function testLiquidationRedistributionWithSurplus() public {
        LiquidationVars memory vars;

        vars.liquidationAmount = 2000e18;
        vars.collAmount = 2e18;

        uint256 AInitialWETHBalance = WETH.balanceOf(A);

        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        vars.ATroveId = borrowerOperations.openTrove(A, 0, vars.collAmount, vars.liquidationAmount, 0, 0, 0, 0);
        vm.stopPrank();

        vm.startPrank(B);
        vars.BTroveId = borrowerOperations.openTrove(B, 0, 2 * vars.collAmount, vars.liquidationAmount, 0, 0, 0, 0);

        // Price drops
        priceFeed.setPrice(1200e18 - 1);
        vars.price = priceFeed.fetchPrice();

        uint256 BInitialDebt = troveManager.getTroveEntireDebt(vars.BTroveId);
        uint256 BInitialColl = troveManager.getTroveEntireColl(vars.BTroveId);
        uint256 AInitialCollBalance = collToken.balanceOf(A);

        // Check not RM
        assertEq(troveManager.checkBelowCriticalThreshold(vars.price), false, "System should not be below CT");

        // Check CR_A < MCR and TCR > CCR
        assertLt(troveManager.getCurrentICR(vars.ATroveId, vars.price), MCR);
        assertGt(troveManager.getTCR(vars.price), CCR);

        assertEq(troveManager.getTroveIdsCount(), 2);

        troveManager.liquidate(vars.ATroveId);

        // Check Troves count is the same
        assertEq(troveManager.getTroveIdsCount(), 2);

        // Check SP stays the same
        assertEq(stabilityPool.getTotalBoldDeposits(), 0, "SP should be empty");
        assertEq(stabilityPool.getCollBalance(), 0, "SP should not have Coll rewards");

        // Check B has received debt
        uint256 ANewColl = troveManager.getTroveEntireColl(vars.ATroveId);
        uint256 BNewColl = troveManager.getTroveEntireColl(vars.BTroveId);
        uint256 BRedistributedDebt = vars.liquidationAmount * BNewColl / (BNewColl + ANewColl);
        assertApproxEqAbs(troveManager.getTroveEntireDebt(vars.BTroveId) - BInitialDebt, BRedistributedDebt, 100, "B debt mismatch");
        // Check B has received all coll minus coll gas comp
        uint256 redistributedColl = vars.liquidationAmount * DECIMAL_PRECISION / vars.price * 110 / 100; // debt with penalty
        uint256 BRedistributedColl = redistributedColl * BNewColl / (BNewColl + ANewColl);
        assertApproxEqAbs(
            troveManager.getTroveEntireColl(vars.BTroveId) - BInitialColl,
            LiquityMath._min(
                vars.collAmount * 995 / 1000, // Collateral - coll gas comp
                BRedistributedColl
            ),
            10,
            "B trove coll mismatch"
        );

        // Check A retains ~9.5% of the collateral (after claiming from CollSurplus)
        // collAmount - 0.5% - (liquidationAmount to Coll + 10%)
        vars.collSurplusAmount = vars.collAmount * 995 / 1000 - vars.liquidationAmount * DECIMAL_PRECISION / vars.price * 110 / 100;
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
            collToken.balanceOf(A) - AInitialCollBalance, vars.collSurplusAmount + ARedistributedColl, 10, "A collateral balance mismatch"
        );
        assertEq(AInitialWETHBalance - WETH.balanceOf(A), ETH_GAS_COMPENSATION, "A should have lost gas compensation");
    }

    struct InitialValues {
        uint256 spBoldBalance;
        uint256 spCollBalance;
        uint256 ACollBalance;
        uint256 BDebt;
        uint256 BColl;
    }

    struct FinalValues {
        uint256 spBoldBalance;
        uint256 spCollBalance;
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
        uint256 ATroveId = borrowerOperations.openTrove(A, 0, collAmount, liquidationAmount, 0, 0, 0, 0);
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
        initialValues.spCollBalance = stabilityPool.getCollBalance();
        initialValues.ACollBalance = collToken.balanceOf(A);
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

        // Check Troves count is the same
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        // Offset part
        FinalValues memory finalValues;
        finalValues.collToLiquidate = collAmount * 995 / 1000;
        // Check SP Bold has decreased
        finalValues.spBoldBalance = stabilityPool.getTotalBoldDeposits();
        assertEq(initialValues.spBoldBalance - finalValues.spBoldBalance, _spAmount, "SP Bold balance mismatch");
        // Check SP Coll has  increased
        finalValues.spCollBalance = stabilityPool.getCollBalance();
        finalValues.collSPPortion = finalValues.collToLiquidate * _spAmount / liquidationAmount;
        finalValues.collPenaltySP = _spAmount * DECIMAL_PRECISION / _finalPrice * 105 / 100;
        finalValues.collToSendToSP = LiquityMath._min(finalValues.collPenaltySP, finalValues.collSPPortion);
        // liquidationAmount to Coll + 5%
        assertApproxEqAbs(
            finalValues.spCollBalance - initialValues.spCollBalance,
            finalValues.collToSendToSP,
            10,
            "SP Coll balance mismatch"
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
        // collAmount - 0.5% - (liquidationAmount to Coll + penalty)
        uint256 collPenalty = finalValues.collPenaltySP + finalValues.collPenaltyRedistribution;
        console2.log(finalValues.collPenaltySP, "finalValues.collPenaltySP");
        console2.log(finalValues.collPenaltyRedistribution, "finalValues.collPenaltyRedistribution");
        console2.log(collPenalty, "collPenalty");
        uint256 collSurplusAmount;
        if (collPenalty < finalValues.collToLiquidate) {
            collSurplusAmount = finalValues.collToLiquidate - collPenalty;
        }
        assertApproxEqAbs(
            troveManager.getTroveEntireColl(ATroveId), collSurplusAmount, 1e9, "CollSurplusPoll mismatch"
        );
        vm.startPrank(A);
        borrowerOperations.closeTrove(ATroveId);
        vm.stopPrank();
        assertApproxEqAbs(
            collToken.balanceOf(A) - initialValues.ACollBalance,
            collSurplusAmount,
            1e9,
            "A collateral balance mismatch"
        );
    }
}
