// SPDX-License-Identifier: MIT

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

        TestDeployer deployer = new TestDeployer();
        TestDeployer.LiquityContractsDev memory contracts;
        (contracts, collateralRegistry, boldToken,,,) = deployer.deployAndConnectContracts(
            TestDeployer.TroveManagerParams(160e16, 120e16, 10e16, 120e16, 5e16, 10e16)
        );
        collToken = contracts.collToken;
        activePool = contracts.activePool;
        borrowerOperations = contracts.borrowerOperations;
        collSurplusPool = contracts.pools.collSurplusPool;
        defaultPool = contracts.pools.defaultPool;
        gasPool = contracts.pools.gasPool;
        priceFeed = contracts.priceFeed;
        sortedTroves = contracts.sortedTroves;
        stabilityPool = contracts.stabilityPool;
        troveManager = contracts.troveManager;
        mockInterestRouter = contracts.interestRouter;
        systemParams = contracts.systemParams;

        MCR = troveManager.get_MCR();
        MIN_ANNUAL_INTEREST_RATE = systemParams.MIN_ANNUAL_INTEREST_RATE();
        MIN_BOLD_IN_SP = systemParams.MIN_BOLD_IN_SP();

        // Give some Coll to test accounts, and approve it to BorrowerOperations
        uint256 initialCollAmount = 10_000e18;
        for (uint256 i = 0; i < 6; i++) {
            // A to F
            giveAndApproveColl(accountsList[i], initialCollAmount);
        }
    }

    struct InitialValues {
        uint256 spBoldBalance;
        uint256 spCollBalance;
        uint256 ACollBalance;
        uint256 AInterest;
        uint256 BDebt;
        uint256 BColl;
    }

    function testLiquidationRedistributionWithSurplus() public {
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
        priceFeed.setPrice(1200e18 - 1);
        uint256 price = priceFeed.fetchPrice();

        InitialValues memory initialValues;
        initialValues.BDebt = troveManager.getTroveEntireDebt(BTroveId);
        initialValues.BColl = troveManager.getTroveEntireColl(BTroveId);
        initialValues.ACollBalance = collToken.balanceOf(A);

        // Check not RM
        assertEq(troveManager.checkBelowCriticalThreshold(price), false, "System should not be below CT");

        // Check CR_A < MCR and TCR > CCR
        assertLt(troveManager.getCurrentICR(ATroveId, price), MCR);
        assertGt(troveManager.getTCR(price), CCR);

        assertEq(troveManager.getTroveIdsCount(), 2);

        initialValues.AInterest = troveManager.getTroveEntireDebt(ATroveId) - liquidationAmount;
        troveManager.liquidate(ATroveId);

        // Check Troves count reduced by 1
        assertEq(troveManager.getTroveIdsCount(), 1);

        // Check SP stays the same
        assertEq(stabilityPool.getTotalBoldDeposits(), 0, "SP should be empty");
        assertEq(stabilityPool.getCollBalance(), 0, "SP should not have Coll rewards");

        // Check B has received debt
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(BTroveId) - initialValues.BDebt,
            liquidationAmount + initialValues.AInterest,
            3,
            "B debt mismatch"
        );
        // Check B has received all coll minus coll gas comp
        assertApproxEqAbs(
            troveManager.getTroveEntireColl(BTroveId) - initialValues.BColl,
            LiquityMath._min(
                collAmount, // no coll gas comp
                (liquidationAmount + initialValues.AInterest) * DECIMAL_PRECISION / price * 110 / 100 // debt with penalty
            ),
            10,
            "B trove coll mismatch"
        );

        // Check A retains ~10% of the collateral (after claiming from CollSurplus)
        // collAmount - (liquidationAmount to Coll + 10%)
        uint256 collSurplusAmount =
            collAmount - (liquidationAmount + initialValues.AInterest) * DECIMAL_PRECISION / price * 110 / 100;
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
            collToken.balanceOf(A) - initialValues.ACollBalance, collSurplusAmount, 10, "A collateral balance mismatch"
        );
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
        // A makes a deposit to ensure there's MIN_BOLD_IN_SP left after liquidation
        makeSPDepositAndClaim(A, MIN_BOLD_IN_SP);

        vm.startPrank(B);
        uint256 BTroveId = borrowerOperations.openTrove(
            B,
            0,
            3 * collAmount,
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
        // B deposits to SP
        if (_spAmount > 0) {
            makeSPDepositAndClaim(B, _spAmount);
        }

        // Price drops
        priceFeed.setPrice(_finalPrice);
        //console2.log(_finalPrice, "_finalPrice");

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

        uint256 AInterest = troveManager.getTroveEntireDebt(ATroveId) - liquidationAmount;
        //console2.log(AInterest, "AInterest");
        troveManager.liquidate(ATroveId);

        // Check Troves count reduced by 1
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);

        FinalValues memory finalValues;
        // Offset part
        uint256 collToOffset = collAmount * _spAmount / (liquidationAmount + AInterest);
        finalValues.collSPPortion = collToOffset * 995 / 1000;
        finalValues.collPenaltySP = _spAmount * DECIMAL_PRECISION / _finalPrice * 105 / 100;
        finalValues.collToSendToSP = LiquityMath._min(finalValues.collPenaltySP, finalValues.collSPPortion);

        // Check SP Bold has decreased
        finalValues.spBoldBalance = stabilityPool.getTotalBoldDeposits();
        assertEq(initialValues.spBoldBalance - finalValues.spBoldBalance, _spAmount, "SP Bold balance mismatch");
        // Check SP Coll has  increased
        finalValues.spCollBalance = stabilityPool.getCollBalance();
        // liquidationAmount to Coll + 5%
        assertApproxEqAbs(
            finalValues.spCollBalance - initialValues.spCollBalance,
            finalValues.collToSendToSP,
            1000,
            "SP Coll balance mismatch"
        );

        // Redistribution part
        finalValues.collRedistributionPortion = collAmount - collToOffset;
        finalValues.collPenaltyRedistribution =
            (liquidationAmount - _spAmount + AInterest) * DECIMAL_PRECISION / _finalPrice * 110 / 100;

        finalValues.collToLiquidate = finalValues.collSPPortion + finalValues.collRedistributionPortion;

        // Check B has received debt
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(BTroveId) - initialValues.BDebt,
            liquidationAmount - _spAmount + AInterest,
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
            1000,
            "B trove coll mismatch"
        );

        // Surplus
        // Check A retains part of the collateral (after claiming from CollSurplus)
        // collAmount - 0.5% of offset coll - (liquidationAmount to Coll + penalty)
        uint256 collPenalty = finalValues.collToSendToSP + finalValues.collPenaltyRedistribution;
        //console2.log(finalValues.collPenaltySP, "finalValues.collPenaltySP");
        //console2.log(finalValues.collPenaltyRedistribution, "finalValues.collPenaltyRedistribution");
        //console2.log(collPenalty, "collPenalty");
        uint256 collSurplusAmount;
        if (collPenalty < finalValues.collToLiquidate) {
            collSurplusAmount = finalValues.collToLiquidate - collPenalty;
        }
        assertApproxEqAbs(
            collToken.balanceOf(address(collSurplusPool)), collSurplusAmount, 1e9, "CollSurplusPool mismatch"
        );
        assertEq(
            collToken.balanceOf(address(collSurplusPool)),
            collSurplusPool.getCollBalance(),
            "CollSurplusPool balance and getter should match"
        );
        if (collSurplusAmount > 0) {
            vm.startPrank(A);
            borrowerOperations.claimCollateral();
            vm.stopPrank();
            assertApproxEqAbs(
                collToken.balanceOf(A) - initialValues.ACollBalance,
                collSurplusAmount,
                1e9,
                "A collateral balance mismatch"
            );
        }
    }
}
