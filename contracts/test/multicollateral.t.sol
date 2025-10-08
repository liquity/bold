// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
import "./TestContracts/DevTestSetup.sol";

contract MulticollateralTest is DevTestSetup {
    uint256 NUM_COLLATERALS = 4;
    TestDeployer.LiquityContractsDev[] public contractsArray; 

    function openMulticollateralTroveNoHints100pctWithIndex(
        uint256 _collIndex,
        address _account,
        uint256 _index,
        uint256 _coll,
        uint256 _boldAmount,
        uint256 _annualInterestRate
    ) public returns (uint256 troveId) {
        TroveChange memory troveChange;
        troveChange.debtIncrease = _boldAmount;
        troveChange.newWeightedRecordedDebt = troveChange.debtIncrease * _annualInterestRate;
        uint256 avgInterestRate =
            contractsArray[_collIndex].activePool.getNewApproxAvgInterestRateFromTroveChange(troveChange);
        uint256 upfrontFee = calcUpfrontFee(troveChange.debtIncrease, avgInterestRate);

        vm.startPrank(_account);

        troveId = contractsArray[_collIndex].borrowerOperations.openTrove(
            _account,
            _index,
            _coll,
            _boldAmount,
            0, // _upperHint
            0, // _lowerHint
            _annualInterestRate,
            upfrontFee,
            address(0),
            address(0),
            address(0)
        );

        vm.stopPrank();
    }

    function makeMulticollateralSPDepositAndClaim(uint256 _collIndex, address _account, uint256 _amount) public {
        vm.startPrank(_account);
        contractsArray[_collIndex].stabilityPool.provideToSP(_amount, true);
        vm.stopPrank();
    }

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

        TestDeployer.TroveManagerParams[] memory troveManagerParamsArray =
            new TestDeployer.TroveManagerParams[](NUM_COLLATERALS);
        troveManagerParamsArray[0] = TestDeployer.TroveManagerParams(150e16, 110e16, 10e16, 110e16, 5e16, 10e16);
        troveManagerParamsArray[1] = TestDeployer.TroveManagerParams(160e16, 120e16, 10e16, 120e16, 5e16, 10e16);
        troveManagerParamsArray[2] = TestDeployer.TroveManagerParams(160e16, 120e16, 10e16, 120e16, 5e16, 10e16);
        troveManagerParamsArray[3] = TestDeployer.TroveManagerParams(160e16, 125e16, 10e16, 125e16, 5e16, 10e16);

        TestDeployer deployer = new TestDeployer();
        TestDeployer.LiquityContractsDev[] memory _contractsArray;
        (_contractsArray, collateralRegistry, boldToken,,, WETH) =
            deployer.deployAndConnectContractsMultiColl(troveManagerParamsArray);
        // Unimplemented feature (...):Copying of type struct LiquityContracts memory[] memory to storage not yet supported.
        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            contractsArray.push(_contractsArray[c]);
        }
        // Set price feeds
        contractsArray[0].priceFeed.setPrice(2000e18);
        contractsArray[1].priceFeed.setPrice(200e18);
        contractsArray[2].priceFeed.setPrice(20000e18);
        contractsArray[3].priceFeed.setPrice(2500e18);
        // Just in case
        for (uint256 c = 4; c < NUM_COLLATERALS; c++) {
            contractsArray[c].priceFeed.setPrice(2000e18 + c * 1e18);
        }

        // Give some Collateral to test accounts, and approve it to BorrowerOperations
        uint256 initialCollateralAmount = 10_000e18;

        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            for (uint256 i = 0; i < 6; i++) {
                // A to F
                giveAndApproveCollateral(
                    contractsArray[c].collToken,
                    accountsList[i],
                    initialCollateralAmount,
                    address(contractsArray[c].borrowerOperations)
                );
                // Approve WETH for gas compensation in all branches
                vm.startPrank(accountsList[i]);
                WETH.approve(address(contractsArray[c].borrowerOperations), type(uint256).max);
                vm.stopPrank();
            }
        }
        
        systemParams = contractsArray[0].systemParams;
        REDEMPTION_FEE_FLOOR = systemParams.REDEMPTION_FEE_FLOOR();
        INITIAL_BASE_RATE = systemParams.INITIAL_BASE_RATE();
    }

    function testMultiCollateralDeployment() public {
        // check deployment
        assertEq(collateralRegistry.totalCollaterals(), NUM_COLLATERALS, "Wrong number of branches");
        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            assertNotEq(address(collateralRegistry.getToken(c)), ZERO_ADDRESS, "Missing collateral token");
            assertNotEq(address(collateralRegistry.getTroveManager(c)), ZERO_ADDRESS, "Missing TroveManager");
        }
        for (uint256 c = NUM_COLLATERALS; c < 10; c++) {
            assertEq(address(collateralRegistry.getToken(c)), ZERO_ADDRESS, "Extra collateral token");
            assertEq(address(collateralRegistry.getTroveManager(c)), ZERO_ADDRESS, "Extra TroveManager");
        }
        // reverts for invalid index
        vm.expectRevert("Invalid index");
        collateralRegistry.getToken(10);
        vm.expectRevert("Invalid index");
        collateralRegistry.getTroveManager(10);
    }

    struct TestValues {
        uint256 troveId;
        uint256 price;
        uint256 unbackedPortion;
        uint256 redeemAmount;
        uint256 fee;
        uint256 collInitialBalance;
        uint256 collFinalBalance;
        uint256 branchDebt;
        uint256 collTokenBalBefore_A;
        uint256 redeemed;
        uint256 correspondingETH;
        uint256 ETHFee;
        uint256 spBoldAmount;
    }

    function testMultiCollateralRedemption() public {
        TestValues memory testValues1;
        TestValues memory testValues2;
        TestValues memory testValues3;
        TestValues memory testValues4;
        uint256 redeemAmount = 1600e18;

        // First collateral unbacked Bold: 10k (SP empty)
        testValues1.troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 10e18, 10000e18, 5e16);

        // Second collateral unbacked Bold: 5k
        testValues2.troveId = openMulticollateralTroveNoHints100pctWithIndex(1, A, 0, 100e18, 10000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(1, A, 5000e18);

        // Third collateral unbacked Bold: 1k
        testValues3.troveId = openMulticollateralTroveNoHints100pctWithIndex(2, A, 0, 10e18, 10000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(2, A, 9000e18);

        // Fourth collateral unbacked Bold: 0
        testValues4.troveId = openMulticollateralTroveNoHints100pctWithIndex(3, A, 0, 10e18, 10000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(3, A, 10000e18);

        // let time go by to reduce redemption rate (/16)
        vm.warp(block.timestamp + 1 days);

        // Check A’s final bal
        assertEq(boldToken.balanceOf(A), 16000e18, "Wrong Bold balance before redemption");

        // initial balances
        testValues1.collInitialBalance = contractsArray[0].collToken.balanceOf(A);
        testValues2.collInitialBalance = contractsArray[1].collToken.balanceOf(A);
        testValues3.collInitialBalance = contractsArray[2].collToken.balanceOf(A);
        testValues4.collInitialBalance = contractsArray[3].collToken.balanceOf(A);

        testValues1.price = contractsArray[0].priceFeed.getPrice();
        testValues2.price = contractsArray[1].priceFeed.getPrice();
        testValues3.price = contractsArray[2].priceFeed.getPrice();
        testValues4.price = contractsArray[3].priceFeed.getPrice();

        testValues1.unbackedPortion = contractsArray[0].troveManager.getTroveEntireDebt(testValues1.troveId);
        testValues2.unbackedPortion = contractsArray[1].troveManager.getTroveEntireDebt(testValues2.troveId) - 5000e18;
        testValues3.unbackedPortion = contractsArray[2].troveManager.getTroveEntireDebt(testValues3.troveId) - 9000e18;
        testValues4.unbackedPortion = contractsArray[3].troveManager.getTroveEntireDebt(testValues4.troveId) - 10000e18;
        uint256 totalUnbacked = testValues1.unbackedPortion + testValues2.unbackedPortion + testValues3.unbackedPortion
            + testValues4.unbackedPortion;

        testValues1.redeemAmount = redeemAmount * testValues1.unbackedPortion / totalUnbacked;
        testValues2.redeemAmount = redeemAmount * testValues2.unbackedPortion / totalUnbacked;
        testValues3.redeemAmount = redeemAmount * testValues3.unbackedPortion / totalUnbacked;
        testValues4.redeemAmount = redeemAmount * testValues4.unbackedPortion / totalUnbacked;

        // fees
        uint256 fee = collateralRegistry.getEffectiveRedemptionFeeInBold(redeemAmount);
        testValues1.fee = fee * testValues1.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues1.price;
        testValues2.fee = fee * testValues2.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues2.price;
        testValues3.fee = fee * testValues3.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues3.price;
        testValues4.fee = fee * testValues4.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues4.price;

        // Check redemption rate
        assertApproxEqAbs(
            collateralRegistry.getRedemptionFeeWithDecay(redeemAmount),
            redeemAmount * (INITIAL_BASE_RATE / 16 + REDEMPTION_FEE_FLOOR) / DECIMAL_PRECISION,
            1e7,
            "Wrong redemption fee with decay"
        );

        uint256 initialBoldSupply = boldToken.totalSupply();

        // A redeems 1.6k
        redeem(A, redeemAmount);

        // Check redemption rate
        assertApproxEqAbs(
            collateralRegistry.getRedemptionRate(),
            INITIAL_BASE_RATE / 16 + REDEMPTION_FEE_FLOOR + redeemAmount * DECIMAL_PRECISION / initialBoldSupply,
            1e5,
            "Wrong redemption rate"
        );

        // Check bold balance
        assertApproxEqAbs(boldToken.balanceOf(A), 14400e18, 10, "Wrong Bold balance after redemption");

        // Check collateral balances
        // final balances
        testValues1.collFinalBalance = contractsArray[0].collToken.balanceOf(A);
        testValues2.collFinalBalance = contractsArray[1].collToken.balanceOf(A);
        testValues3.collFinalBalance = contractsArray[2].collToken.balanceOf(A);
        testValues4.collFinalBalance = contractsArray[3].collToken.balanceOf(A);

        assertApproxEqAbs(
            testValues1.collFinalBalance - testValues1.collInitialBalance,
            testValues1.redeemAmount * DECIMAL_PRECISION / testValues1.price - testValues1.fee,
            1e14,
            "Wrong Collateral 1 balance"
        );
        assertApproxEqAbs(
            testValues2.collFinalBalance - testValues2.collInitialBalance,
            testValues2.redeemAmount * DECIMAL_PRECISION / testValues2.price - testValues2.fee,
            1e14,
            "Wrong Collateral 2 balance"
        );
        assertApproxEqAbs(
            testValues3.collFinalBalance - testValues3.collInitialBalance,
            testValues3.redeemAmount * DECIMAL_PRECISION / testValues3.price - testValues3.fee,
            1e13,
            "Wrong Collateral 3 balance"
        );
        assertApproxEqAbs(
            testValues4.collFinalBalance - testValues4.collInitialBalance,
            testValues4.redeemAmount * DECIMAL_PRECISION / testValues4.price - testValues4.fee,
            1e11,
            "Wrong Collateral 4 balance"
        );
    }

    function testMultiCollateralRedemptionFuzz(
        uint256 _spBoldAmount1,
        uint256 _spBoldAmount2,
        uint256 _spBoldAmount3,
        uint256 _spBoldAmount4,
        uint256 _redemptionFraction
    ) public {
        uint256 boldAmount = 10000e18;
        uint256 minBoldBalance = 1;
        // TODO: remove gas compensation
        _spBoldAmount1 = bound(_spBoldAmount1, 0, boldAmount);
        _spBoldAmount2 = bound(_spBoldAmount2, 0, boldAmount);
        _spBoldAmount3 = bound(_spBoldAmount3, 0, boldAmount);
        _spBoldAmount4 = bound(_spBoldAmount4, 0, boldAmount - minBoldBalance);
        _redemptionFraction = bound(_redemptionFraction, DECIMAL_PRECISION / minBoldBalance, DECIMAL_PRECISION);

        _testMultiCollateralRedemption(
            boldAmount, _spBoldAmount1, _spBoldAmount2, _spBoldAmount3, _spBoldAmount4, _redemptionFraction
        );
    }

    function testMultiCollateralRedemptionMaxSPAmount() public {
        uint256 boldAmount = 10000e18;
        uint256 minBoldBalance = 1;

        _testMultiCollateralRedemption(
            boldAmount,
            boldAmount,
            boldAmount,
            boldAmount,
            boldAmount - minBoldBalance,
            DECIMAL_PRECISION / minBoldBalance
        );
    }

    function _testMultiCollateralRedemption(
        uint256 _boldAmount,
        uint256 _spBoldAmount1,
        uint256 _spBoldAmount2,
        uint256 _spBoldAmount3,
        uint256 _spBoldAmount4,
        uint256 _redemptionFraction
    ) internal {
        TestValues memory testValues1;
        TestValues memory testValues2;
        TestValues memory testValues3;
        TestValues memory testValues4;

        testValues1.price = contractsArray[0].priceFeed.getPrice();
        testValues2.price = contractsArray[1].priceFeed.getPrice();
        testValues3.price = contractsArray[2].priceFeed.getPrice();
        testValues4.price = contractsArray[3].priceFeed.getPrice();

        // First collateral
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 10e18, _boldAmount, 5e16);
        if (_spBoldAmount1 > 0) makeMulticollateralSPDepositAndClaim(0, A, _spBoldAmount1);

        // Second collateral
        testValues2.troveId = openMulticollateralTroveNoHints100pctWithIndex(1, A, 0, 100e18, _boldAmount, 5e16);
        if (_spBoldAmount2 > 0) makeMulticollateralSPDepositAndClaim(1, A, _spBoldAmount2);

        // Third collateral
        openMulticollateralTroveNoHints100pctWithIndex(2, A, 0, 10e18, _boldAmount, 5e16);
        if (_spBoldAmount3 > 0) makeMulticollateralSPDepositAndClaim(2, A, _spBoldAmount3);

        // Fourth collateral
        openMulticollateralTroveNoHints100pctWithIndex(3, A, 0, 10e18, _boldAmount, 5e16);
        if (_spBoldAmount4 > 0) makeMulticollateralSPDepositAndClaim(3, A, _spBoldAmount4);

        uint256 boldBalance = boldToken.balanceOf(A);
        // Check A’s final bal
        // TODO: change when we switch to new gas compensation
        //assertEq(boldToken.balanceOf(A), _boldAmount * 4 - _spBoldAmount1 - _spBoldAmount2 - _spBoldAmount3 - _spBoldAmount4, "Wrong Bold balance before redemption");
        // Stack too deep
        //assertEq(boldBalance, _boldAmount * 4 - _spBoldAmount1 - _spBoldAmount2 - _spBoldAmount3 - _spBoldAmount4 - 800e18, "Wrong Bold balance before redemption");

        uint256 redeemAmount = boldBalance * _redemptionFraction / DECIMAL_PRECISION;

        // initial balances
        testValues1.collInitialBalance = contractsArray[0].collToken.balanceOf(A);
        testValues2.collInitialBalance = contractsArray[1].collToken.balanceOf(A);
        testValues3.collInitialBalance = contractsArray[2].collToken.balanceOf(A);
        testValues4.collInitialBalance = contractsArray[3].collToken.balanceOf(A);

        testValues1.unbackedPortion = contractsArray[0].troveManager.getEntireBranchDebt() - _spBoldAmount1;
        testValues2.unbackedPortion = contractsArray[1].troveManager.getEntireBranchDebt() - _spBoldAmount2;
        testValues3.unbackedPortion = contractsArray[2].troveManager.getEntireBranchDebt() - _spBoldAmount3;
        testValues4.unbackedPortion = contractsArray[3].troveManager.getEntireBranchDebt() - _spBoldAmount4;
        uint256 totalUnbacked = testValues1.unbackedPortion + testValues2.unbackedPortion + testValues3.unbackedPortion
            + testValues4.unbackedPortion;

        testValues1.redeemAmount = redeemAmount * testValues1.unbackedPortion / totalUnbacked;
        testValues2.redeemAmount = redeemAmount * testValues2.unbackedPortion / totalUnbacked;
        testValues3.redeemAmount = redeemAmount * testValues3.unbackedPortion / totalUnbacked;
        testValues4.redeemAmount = redeemAmount * testValues4.unbackedPortion / totalUnbacked;

        // fees
        uint256 fee = collateralRegistry.getEffectiveRedemptionFeeInBold(redeemAmount);
        testValues1.fee = fee * testValues1.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues1.price;
        testValues2.fee = fee * testValues2.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues2.price;
        testValues3.fee = fee * testValues3.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues3.price;
        testValues4.fee = fee * testValues4.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues4.price;

        console.log(testValues1.fee, "fee1");
        console.log(testValues2.fee, "fee2");
        console.log(testValues3.fee, "fee3");
        console.log(testValues4.fee, "fee4");

        // A redeems
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(redeemAmount, 0, 1e18);
        vm.stopPrank();

        // Check bold balance
        assertApproxEqAbs(boldToken.balanceOf(A), boldBalance - redeemAmount, 10, "Wrong Bold balance after redemption");

        // Check collateral balances
        // final balances
        testValues1.collFinalBalance = contractsArray[0].collToken.balanceOf(A);
        testValues2.collFinalBalance = contractsArray[1].collToken.balanceOf(A);
        testValues3.collFinalBalance = contractsArray[2].collToken.balanceOf(A);
        testValues4.collFinalBalance = contractsArray[3].collToken.balanceOf(A);

        console.log(redeemAmount, "redeemAmount");
        console.log(testValues1.unbackedPortion, "testValues1.unbackedPortion");
        console.log(totalUnbacked, "totalUnbacked");
        console.log(testValues1.redeemAmount, "partial redeem amount 1");
        assertApproxEqAbs(
            testValues1.collFinalBalance - testValues1.collInitialBalance,
            testValues1.redeemAmount * DECIMAL_PRECISION / testValues1.price - testValues1.fee,
            10,
            "Wrong Collateral 1 balance"
        );
        assertApproxEqAbs(
            testValues2.collFinalBalance - testValues2.collInitialBalance,
            testValues2.redeemAmount * DECIMAL_PRECISION / testValues2.price - testValues2.fee,
            10,
            "Wrong Collateral 2 balance"
        );
        assertApproxEqAbs(
            testValues3.collFinalBalance - testValues3.collInitialBalance,
            testValues3.redeemAmount * DECIMAL_PRECISION / testValues3.price - testValues3.fee,
            10,
            "Wrong Collateral 3 balance"
        );
        assertApproxEqAbs(
            testValues4.collFinalBalance - testValues4.collInitialBalance,
            testValues4.redeemAmount * DECIMAL_PRECISION / testValues4.price - testValues4.fee,
            10,
            "Wrong Collateral 4 balance"
        );
    }

    function testMultiCollRedemptionIncreasesRedeemerETHBalanceByCorrespondingETHLessTheETHFee() public {
        TestValues memory testValues0;
        TestValues memory testValues1;
        TestValues memory testValues2;
        TestValues memory testValues3;

        uint256 boldAmount = 100000e18;
        testValues0.spBoldAmount = boldAmount / 2;
        testValues1.spBoldAmount = boldAmount / 4;
        testValues2.spBoldAmount = boldAmount / 8;
        testValues3.spBoldAmount = boldAmount / 16;

        uint256 redemptionFraction = 25e16;

        testValues0.price = contractsArray[0].priceFeed.getPrice();
        testValues1.price = contractsArray[1].priceFeed.getPrice();
        testValues2.price = contractsArray[2].priceFeed.getPrice();
        testValues3.price = contractsArray[3].priceFeed.getPrice();

        // First collateral
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 100e18, boldAmount, 5e16);
        makeMulticollateralSPDepositAndClaim(0, A, testValues0.spBoldAmount);

        // Second collateral
        openMulticollateralTroveNoHints100pctWithIndex(1, A, 0, 1000e18, boldAmount, 5e16);
        makeMulticollateralSPDepositAndClaim(1, A, testValues1.spBoldAmount);

        // Third collateral
        openMulticollateralTroveNoHints100pctWithIndex(2, A, 0, 100e18, boldAmount, 5e16);
        makeMulticollateralSPDepositAndClaim(2, A, testValues2.spBoldAmount);

        // Fourth collateral
        openMulticollateralTroveNoHints100pctWithIndex(3, A, 0, 100e18, boldAmount, 5e16);
        makeMulticollateralSPDepositAndClaim(3, A, testValues3.spBoldAmount);

        uint256 boldBalance = boldToken.balanceOf(A);

        uint256 redeemAmount = boldBalance * redemptionFraction / DECIMAL_PRECISION;
        uint256 expectedFeePct =
            collateralRegistry.getEffectiveRedemptionFeeInBold(redeemAmount) * DECIMAL_PRECISION / redeemAmount;
        assertGt(expectedFeePct, 0);

        // Get BOLD debts from each branch
        testValues0.branchDebt = contractsArray[0].troveManager.getEntireBranchDebt();
        testValues1.branchDebt = contractsArray[1].troveManager.getEntireBranchDebt();
        testValues2.branchDebt = contractsArray[2].troveManager.getEntireBranchDebt();
        testValues3.branchDebt = contractsArray[3].troveManager.getEntireBranchDebt();

        testValues0.collTokenBalBefore_A = contractsArray[0].collToken.balanceOf(A);
        testValues1.collTokenBalBefore_A = contractsArray[1].collToken.balanceOf(A);
        testValues2.collTokenBalBefore_A = contractsArray[2].collToken.balanceOf(A);
        testValues3.collTokenBalBefore_A = contractsArray[3].collToken.balanceOf(A);

        // A redeems
        redeem(A, redeemAmount);

        // Check how much BOLD was redeemed from each branch
        testValues0.redeemed = testValues0.branchDebt - contractsArray[0].troveManager.getEntireBranchDebt();
        testValues1.redeemed = testValues1.branchDebt - contractsArray[1].troveManager.getEntireBranchDebt();
        testValues2.redeemed = testValues2.branchDebt - contractsArray[2].troveManager.getEntireBranchDebt();
        testValues3.redeemed = testValues3.branchDebt - contractsArray[3].troveManager.getEntireBranchDebt();

        assertGt(testValues0.redeemed, 0);
        assertGt(testValues1.redeemed, 0);
        assertGt(testValues2.redeemed, 0);
        assertGt(testValues3.redeemed, 0);

        // Get corresponding ETH from each branch, and fee
        testValues0.correspondingETH = testValues0.redeemed * DECIMAL_PRECISION / testValues0.price;
        testValues1.correspondingETH = testValues1.redeemed * DECIMAL_PRECISION / testValues1.price;
        testValues2.correspondingETH = testValues2.redeemed * DECIMAL_PRECISION / testValues2.price;
        testValues3.correspondingETH = testValues3.redeemed * DECIMAL_PRECISION / testValues3.price;

        testValues0.ETHFee = testValues0.correspondingETH * expectedFeePct / DECIMAL_PRECISION;
        testValues1.ETHFee = testValues1.correspondingETH * expectedFeePct / DECIMAL_PRECISION;
        testValues2.ETHFee = testValues2.correspondingETH * expectedFeePct / DECIMAL_PRECISION;
        testValues3.ETHFee = testValues3.correspondingETH * expectedFeePct / DECIMAL_PRECISION;
        assertGt(testValues0.ETHFee, 0);
        assertGt(testValues1.ETHFee, 0);
        assertGt(testValues2.ETHFee, 0);
        assertGt(testValues3.ETHFee, 0);

        // Expect collToken balance of redeemer increased by drawn ETH, leaving the ETH fee in the branch
        assertApproxEqAbs(
            contractsArray[0].collToken.balanceOf(A) - testValues0.collTokenBalBefore_A,
            testValues0.correspondingETH - testValues0.ETHFee,
            20
        );
        assertApproxEqAbs(
            contractsArray[1].collToken.balanceOf(A) - testValues1.collTokenBalBefore_A,
            testValues1.correspondingETH - testValues1.ETHFee,
            100
        );
        assertApproxEqAbs(
            contractsArray[2].collToken.balanceOf(A) - testValues2.collTokenBalBefore_A,
            testValues2.correspondingETH - testValues2.ETHFee,
            20
        );
        assertApproxEqAbs(
            contractsArray[3].collToken.balanceOf(A) - testValues3.collTokenBalBefore_A,
            testValues3.correspondingETH - testValues3.ETHFee,
            20
        );
    }

    function testMultiCollateralRedemptionWithZeroUnbacked() public {
        TestValues memory testValues1;
        TestValues memory testValues2;
        TestValues memory testValues3;
        TestValues memory testValues4;
        uint256 redeemAmount = 1600e18;

        // First collateral unbacked Bold: 10k (SP empty) - will be shutdown
        testValues1.troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 10e18, 10000e18, 5e16);

        // Second collateral unbacked Bold: 0
        testValues2.troveId = openMulticollateralTroveNoHints100pctWithIndex(1, A, 0, 100e18, 10000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(1, A, 10100e18); // we put some more for interest

        // Third collateral unbacked Bold: 0
        testValues3.troveId = openMulticollateralTroveNoHints100pctWithIndex(2, A, 0, 10e18, 4000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(2, A, 4100e18); // we put some more for interest

        // Fourth collateral unbacked Bold: 0
        testValues4.troveId = openMulticollateralTroveNoHints100pctWithIndex(3, A, 0, 10e18, 2000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(3, A, 2100e18); // we put some more for interest

        // Check A’s final bal
        // 10k of first branch - 3 * 100 in the other SPs
        assertEq(boldToken.balanceOf(A), 9700e18, "Wrong Bold balance before redemption");

        // initial balances
        testValues1.collInitialBalance = contractsArray[0].collToken.balanceOf(A);
        testValues2.collInitialBalance = contractsArray[1].collToken.balanceOf(A);
        testValues3.collInitialBalance = contractsArray[2].collToken.balanceOf(A);
        testValues4.collInitialBalance = contractsArray[3].collToken.balanceOf(A);

        // Shut first branch down
        contractsArray[0].priceFeed.setPrice(1000e18);
        contractsArray[0].borrowerOperations.shutdown();

        // First branch is shutdown, the other 3 are fully backed
        assertGt(contractsArray[0].troveManager.shutdownTime(), 0, "First branch should be shut down");
        (uint256 unbackedPortion1,,) = contractsArray[1].troveManager.getUnbackedPortionPriceAndRedeemability();
        assertEq(unbackedPortion1, 0, "Second branch should be fully backed");
        (uint256 unbackedPortion2,,) = contractsArray[2].troveManager.getUnbackedPortionPriceAndRedeemability();
        assertEq(unbackedPortion2, 0, "Third branch should be fully backed");
        (uint256 unbackedPortion3,,) = contractsArray[3].troveManager.getUnbackedPortionPriceAndRedeemability();
        assertEq(unbackedPortion3, 0, "Fourth branch should be fully backed");

        testValues1.price = contractsArray[0].priceFeed.getPrice();
        testValues2.price = contractsArray[1].priceFeed.getPrice();
        testValues3.price = contractsArray[2].priceFeed.getPrice();
        testValues4.price = contractsArray[3].priceFeed.getPrice();

        // Effectively (second loop in CollateralRegistry.redeemCollateral)
        testValues1.unbackedPortion = 0;
        testValues2.unbackedPortion = contractsArray[1].troveManager.getTroveEntireDebt(testValues2.troveId);
        testValues3.unbackedPortion = contractsArray[2].troveManager.getTroveEntireDebt(testValues3.troveId);
        testValues4.unbackedPortion = contractsArray[3].troveManager.getTroveEntireDebt(testValues4.troveId);
        uint256 totalUnbacked = testValues1.unbackedPortion + testValues2.unbackedPortion + testValues3.unbackedPortion
            + testValues4.unbackedPortion;

        testValues1.redeemAmount = redeemAmount * testValues1.unbackedPortion / totalUnbacked;
        testValues2.redeemAmount = redeemAmount * testValues2.unbackedPortion / totalUnbacked;
        testValues3.redeemAmount = redeemAmount * testValues3.unbackedPortion / totalUnbacked;
        testValues4.redeemAmount = redeemAmount * testValues4.unbackedPortion / totalUnbacked;

        // fees
        uint256 fee = collateralRegistry.getEffectiveRedemptionFeeInBold(redeemAmount);
        testValues1.fee = fee * testValues1.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues1.price;
        testValues2.fee = fee * testValues2.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues2.price;
        testValues3.fee = fee * testValues3.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues3.price;
        testValues4.fee = fee * testValues4.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues4.price;

        // A redeems 1.6k
        redeem(A, redeemAmount);

        // Check bold balance
        assertApproxEqAbs(boldToken.balanceOf(A), 8100e18, 10, "Wrong Bold balance after redemption");

        // Check collateral balances
        // final balances
        testValues1.collFinalBalance = contractsArray[0].collToken.balanceOf(A);
        testValues2.collFinalBalance = contractsArray[1].collToken.balanceOf(A);
        testValues3.collFinalBalance = contractsArray[2].collToken.balanceOf(A);
        testValues4.collFinalBalance = contractsArray[3].collToken.balanceOf(A);

        assertApproxEqAbs(
            testValues1.collFinalBalance - testValues1.collInitialBalance,
            testValues1.redeemAmount * DECIMAL_PRECISION / testValues1.price - testValues1.fee,
            1e14,
            "Wrong Collateral 1 balance"
        );
        assertApproxEqAbs(
            testValues2.collFinalBalance - testValues2.collInitialBalance,
            testValues2.redeemAmount * DECIMAL_PRECISION / testValues2.price - testValues2.fee,
            1e14,
            "Wrong Collateral 2 balance"
        );
        assertApproxEqAbs(
            testValues3.collFinalBalance - testValues3.collInitialBalance,
            testValues3.redeemAmount * DECIMAL_PRECISION / testValues3.price - testValues3.fee,
            1e13,
            "Wrong Collateral 3 balance"
        );
        assertApproxEqAbs(
            testValues4.collFinalBalance - testValues4.collInitialBalance,
            testValues4.redeemAmount * DECIMAL_PRECISION / testValues4.price - testValues4.fee,
            1e11,
            "Wrong Collateral 4 balance"
        );
    }

    function testMultiCollateralRedemptionWithZeroUnbackedLowSCRButNoShutdown() public {
        TestValues memory testValues1;
        TestValues memory testValues2;
        TestValues memory testValues3;
        TestValues memory testValues4;
        uint256 redeemAmount = 1600e18;

        // First collateral unbacked Bold: 10k (SP empty) - will become below SCR
        testValues1.troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 10e18, 10000e18, 5e16);

        // Second collateral unbacked Bold: 0
        testValues2.troveId = openMulticollateralTroveNoHints100pctWithIndex(1, A, 0, 100e18, 10000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(1, A, 10100e18); // we put some more for interest

        // Third collateral unbacked Bold: 0
        testValues3.troveId = openMulticollateralTroveNoHints100pctWithIndex(2, A, 0, 10e18, 4000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(2, A, 4100e18); // we put some more for interest

        // Fourth collateral unbacked Bold: 0
        testValues4.troveId = openMulticollateralTroveNoHints100pctWithIndex(3, A, 0, 10e18, 2000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(3, A, 2100e18); // we put some more for interest

        // Check A’s final bal
        // 10k of first branch - 3 * 100 in the other SPs
        assertEq(boldToken.balanceOf(A), 9700e18, "Wrong Bold balance before redemption");

        // initial balances
        testValues1.collInitialBalance = contractsArray[0].collToken.balanceOf(A);
        testValues2.collInitialBalance = contractsArray[1].collToken.balanceOf(A);
        testValues3.collInitialBalance = contractsArray[2].collToken.balanceOf(A);
        testValues4.collInitialBalance = contractsArray[3].collToken.balanceOf(A);

        // Bring first branch below SCR
        contractsArray[0].priceFeed.setPrice(1000e18);

        testValues1.price = contractsArray[0].priceFeed.getPrice();
        testValues2.price = contractsArray[1].priceFeed.getPrice();
        testValues3.price = contractsArray[2].priceFeed.getPrice();
        testValues4.price = contractsArray[3].priceFeed.getPrice();

        // First branch is shutdown, the other 3 are fully backed
        assertEq(contractsArray[0].troveManager.shutdownTime(), 0, "First branch should not be shut down");
        assertLt(
            contractsArray[0].troveManager.getTCR(testValues1.price),
            contractsArray[0].troveManager.get_SCR(),
            "First branch should be below SCR"
        );
        (uint256 unbackedPortion1,,) = contractsArray[1].troveManager.getUnbackedPortionPriceAndRedeemability();
        assertEq(unbackedPortion1, 0, "Second branch should be fully backed");
        (uint256 unbackedPortion2,,) = contractsArray[2].troveManager.getUnbackedPortionPriceAndRedeemability();
        assertEq(unbackedPortion2, 0, "Third branch should be fully backed");
        (uint256 unbackedPortion3,,) = contractsArray[3].troveManager.getUnbackedPortionPriceAndRedeemability();
        assertEq(unbackedPortion3, 0, "Fourth branch should be fully backed");

        // Effectively (second loop in CollateralRegistry.redeemCollateral)
        testValues1.unbackedPortion = 0;
        testValues2.unbackedPortion = contractsArray[1].troveManager.getTroveEntireDebt(testValues2.troveId);
        testValues3.unbackedPortion = contractsArray[2].troveManager.getTroveEntireDebt(testValues3.troveId);
        testValues4.unbackedPortion = contractsArray[3].troveManager.getTroveEntireDebt(testValues4.troveId);
        uint256 totalUnbacked = testValues1.unbackedPortion + testValues2.unbackedPortion + testValues3.unbackedPortion
            + testValues4.unbackedPortion;

        testValues1.redeemAmount = redeemAmount * testValues1.unbackedPortion / totalUnbacked;
        testValues2.redeemAmount = redeemAmount * testValues2.unbackedPortion / totalUnbacked;
        testValues3.redeemAmount = redeemAmount * testValues3.unbackedPortion / totalUnbacked;
        testValues4.redeemAmount = redeemAmount * testValues4.unbackedPortion / totalUnbacked;

        // fees
        uint256 fee = collateralRegistry.getEffectiveRedemptionFeeInBold(redeemAmount);
        testValues1.fee = fee * testValues1.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues1.price;
        testValues2.fee = fee * testValues2.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues2.price;
        testValues3.fee = fee * testValues3.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues3.price;
        testValues4.fee = fee * testValues4.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues4.price;

        // A redeems 1.6k
        redeem(A, redeemAmount);

        // Check bold balance
        assertApproxEqAbs(boldToken.balanceOf(A), 8100e18, 10, "Wrong Bold balance after redemption");

        // Check collateral balances
        // final balances
        testValues1.collFinalBalance = contractsArray[0].collToken.balanceOf(A);
        testValues2.collFinalBalance = contractsArray[1].collToken.balanceOf(A);
        testValues3.collFinalBalance = contractsArray[2].collToken.balanceOf(A);
        testValues4.collFinalBalance = contractsArray[3].collToken.balanceOf(A);

        assertApproxEqAbs(
            testValues1.collFinalBalance - testValues1.collInitialBalance,
            testValues1.redeemAmount * DECIMAL_PRECISION / testValues1.price - testValues1.fee,
            1e14,
            "Wrong Collateral 1 balance"
        );
        assertApproxEqAbs(
            testValues2.collFinalBalance - testValues2.collInitialBalance,
            testValues2.redeemAmount * DECIMAL_PRECISION / testValues2.price - testValues2.fee,
            1e14,
            "Wrong Collateral 2 balance"
        );
        assertApproxEqAbs(
            testValues3.collFinalBalance - testValues3.collInitialBalance,
            testValues3.redeemAmount * DECIMAL_PRECISION / testValues3.price - testValues3.fee,
            1e13,
            "Wrong Collateral 3 balance"
        );
        assertApproxEqAbs(
            testValues4.collFinalBalance - testValues4.collInitialBalance,
            testValues4.redeemAmount * DECIMAL_PRECISION / testValues4.price - testValues4.fee,
            1e11,
            "Wrong Collateral 4 balance"
        );
    }
}

contract CsBold013 is TestAccounts {
    uint256 constant INITIAL_PRICE = 2_000 ether;

    // TODO: Determine appropriate values for test(WETH, SETH) or remove test
    // Collateral branch parameters (SETH = staked ETH, i.e. wstETH / rETH)
    uint256 constant CCR_WETH = 150 * _1pct;
    uint256 constant CCR_SETH = 160 * _1pct;

    uint256 constant MCR_WETH = 110 * _1pct;
    uint256 constant MCR_SETH = 120 * _1pct;

    uint256 constant SCR_WETH = 110 * _1pct;
    uint256 constant SCR_SETH = 120 * _1pct;

    // Batch CR buffer (same for all branches for now)
    // On top of MCR to join a batch, or adjust inside a batch
    uint256 constant BCR_ALL = 10 * _1pct;

    uint256 constant LIQUIDATION_PENALTY_SP_WETH = 5 * _1pct;
    uint256 constant LIQUIDATION_PENALTY_SP_SETH = 5 * _1pct;

    uint256 constant LIQUIDATION_PENALTY_REDISTRIBUTION_WETH = 10 * _1pct;
    uint256 constant LIQUIDATION_PENALTY_REDISTRIBUTION_SETH = 20 * _1pct;

    uint256 constant MIN_ANNUAL_INTEREST_RATE = _1pct / 2;

    IBoldToken boldToken;
    ICollateralRegistry collateralRegistry;
    IHintHelpers hintHelpers;
    IWETH weth;
    TestDeployer.LiquityContractsDev[] branches;

    function setUp() external {
        // Start tests at a non-zero timestamp
        vm.warp(1744780557);

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

        TestDeployer.TroveManagerParams[] memory params = new TestDeployer.TroveManagerParams[](3);

        // WETH
        params[0] = TestDeployer.TroveManagerParams({
            CCR: CCR_WETH,
            MCR: MCR_WETH,
            SCR: SCR_WETH,
            BCR: BCR_ALL,
            LIQUIDATION_PENALTY_SP: LIQUIDATION_PENALTY_SP_WETH,
            LIQUIDATION_PENALTY_REDISTRIBUTION: LIQUIDATION_PENALTY_REDISTRIBUTION_WETH
        });

        // wstETH
        params[1] = TestDeployer.TroveManagerParams({
            CCR: CCR_SETH,
            MCR: MCR_SETH,
            SCR: SCR_SETH,
            BCR: BCR_ALL,
            LIQUIDATION_PENALTY_SP: LIQUIDATION_PENALTY_SP_SETH,
            LIQUIDATION_PENALTY_REDISTRIBUTION: LIQUIDATION_PENALTY_REDISTRIBUTION_SETH
        });

        // rETH (same as wstETH)
        params[2] = params[1];

        TestDeployer deployer = new TestDeployer();
        TestDeployer.LiquityContractsDev[] memory _branches;
        (_branches, collateralRegistry, boldToken, hintHelpers,, weth) =
            deployer.deployAndConnectContractsMultiColl(params);

        for (uint256 i = 0; i < _branches.length; ++i) {
            branches.push(_branches[i]);
            _branches[i].priceFeed.setPrice(INITIAL_PRICE);

            for (uint256 j = 0; j < accountsList.length; j++) {
                deal(address(_branches[i].collToken), accountsList[j], 10_000 ether);

                vm.prank(accountsList[j]);
                _branches[i].collToken.approve(address(_branches[i].borrowerOperations), type(uint256).max);

                if (_branches[i].collToken != weth) {
                    vm.prank(accountsList[j]);
                    weth.approve(address(_branches[i].borrowerOperations), type(uint256).max);
                }
            }
        }
    }

    function predictOpenTroveUpfrontFee(uint256 collIndex, uint256 borrowedAmount, uint256 interestRate)
        internal
        view
        returns (uint256)
    {
        return hintHelpers.predictOpenTroveUpfrontFee(collIndex, borrowedAmount, interestRate);
    }

    // Quick and dirty binary search instead of Newton's, because it's easier
    function findAmountToBorrowWithOpenTrove(uint256 collIndex, uint256 targetDebt, uint256 interestRate)
        internal
        view
        returns (uint256 borrow, uint256 upfrontFee)
    {
        uint256 borrowRight = targetDebt;
        upfrontFee = predictOpenTroveUpfrontFee(collIndex, borrowRight, interestRate);
        uint256 borrowLeft = borrowRight - upfrontFee;

        for (uint256 i = 0; i < 256; ++i) {
            borrow = (borrowLeft + borrowRight) / 2;
            upfrontFee = predictOpenTroveUpfrontFee(collIndex, borrow, interestRate);
            uint256 actualDebt = borrow + upfrontFee;

            if (actualDebt == targetDebt) {
                break;
            } else if (actualDebt < targetDebt) {
                borrowLeft = borrow;
            } else {
                borrowRight = borrow;
            }
        }
    }

    function openTroveWithExactICRAndDebt(
        uint256 collIndex,
        address account,
        uint256 index,
        uint256 icr,
        uint256 debt,
        uint256 interestRate
    ) public returns (uint256 troveId, uint256 coll) {
        (uint256 borrow, uint256 upfrontFee) = findAmountToBorrowWithOpenTrove(collIndex, debt, interestRate);
        uint256 price = branches[collIndex].priceFeed.getPrice();
        coll = Math.ceilDiv(debt * icr, price);

        vm.prank(account);
        troveId = branches[collIndex].borrowerOperations.openTrove(
            account, index, coll, borrow, 0, 0, interestRate, upfrontFee, address(0), address(0), address(0)
        );
    }

    function test_WontRedeemMoreThanTotalUnbacked_UnlessTotalUnbackedIsZero() external {
        // ETH branch setup
        {
            openTroveWithExactICRAndDebt(0, A, 0, CCR_WETH, 200_000 ether, MIN_ANNUAL_INTEREST_RATE);

            vm.prank(A);
            branches[0].stabilityPool.provideToSP(100_000 ether, false);

            branches[0].priceFeed.setPrice(INITIAL_PRICE * (SCR_WETH - _1pct) / CCR_WETH);
            branches[0].borrowerOperations.shutdown();
        }

        // wstETH branch setup
        {
            openTroveWithExactICRAndDebt(1, A, 0, 2 * CCR_WETH, 100_000 ether, MIN_ANNUAL_INTEREST_RATE);

            vm.prank(A);
            branches[1].stabilityPool.provideToSP(99_000 ether, false);
        }

        // rETH branch setup
        {
            openTroveWithExactICRAndDebt(2, A, 0, 2 * CCR_WETH, 10_000 ether, MIN_ANNUAL_INTEREST_RATE);

            vm.prank(A);
            branches[2].stabilityPool.provideToSP(9_000 ether, false);
        }

        // Example scenario:
        // - ETH branch
        {
            (uint256 unbackedDebt,, bool redeemable) =
                branches[0].troveManager.getUnbackedPortionPriceAndRedeemability();
            // is shutdown
            assertFalse(redeemable);
            // and has 100K unbacked debt
            assertEqDecimal(unbackedDebt, 100_000 ether, 18);
        }
        // - WSTETH branch
        {
            (uint256 unbackedDebt,, bool redeemable) =
                branches[1].troveManager.getUnbackedPortionPriceAndRedeemability();
            // is redeemable
            assertTrue(redeemable);
            // with 1K unbacked debt
            assertEqDecimal(unbackedDebt, 1_000 ether, 18);
            // and 100K total debt
            assertEqDecimal(branches[1].troveManager.getEntireBranchDebt(), 100_000 ether, 18);
        }
        // - rETH branch
        {
            (uint256 unbackedDebt,, bool redeemable) =
                branches[2].troveManager.getUnbackedPortionPriceAndRedeemability();
            // is redeemable
            assertTrue(redeemable);
            // with 1K unbacked debt
            assertEqDecimal(unbackedDebt, 1_000 ether, 18);
            // and 10K total debt
            assertEqDecimal(branches[2].troveManager.getEntireBranchDebt(), 10_000 ether, 18);
        }

        vm.startPrank(A);
        {
            // A redemption of more than 2K should be truncated
            uint256 boldBefore = boldToken.balanceOf(A);
            collateralRegistry.redeemCollateral(10_000 ether, 0, 1 ether);
            uint256 actuallyRedeemed = boldBefore - boldToken.balanceOf(A);
            assertEqDecimal(actuallyRedeemed, 2_000 ether, 18, "wrong amount redeemed");

            // The rest should be redeemed in proportion to remaining branch debt (99K vs. 9K)
            // Let's redeem 10% of remaining debt (9.9K + 900)
            collateralRegistry.redeemCollateral(10_800 ether, 0, 1 ether);
        }
        vm.stopPrank();

        assertEqDecimal(branches[0].troveManager.getEntireBranchDebt(), 200_000 ether, 18, "wrong branch #0 debt");
        assertEqDecimal(branches[1].troveManager.getEntireBranchDebt(), 89_100 ether, 18, "wrong branch #1 debt");
        assertEqDecimal(branches[2].troveManager.getEntireBranchDebt(), 8_100 ether, 18, "wrong branch #2 debt");
    }
}
