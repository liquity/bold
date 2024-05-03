pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract MulticollateralTest is DevTestSetup {
    uint256 NUM_COLLATERALS = 4;
    LiquityContracts[] public contractsArray;

    function openMulticollateralTroveNoHints100pctMaxFeeWithIndex(
        uint256 _collIndex,
        address _account,
        uint256 _index,
        uint256 _coll,
        uint256 _boldAmount,
        uint256 _annualInterestRate
    ) public returns (uint256) {
        // TODO: remove when we switch to new gas compensation
        if (_boldAmount >= 2000e18) _boldAmount -= 200e18;

        vm.startPrank(_account);
        uint256 troveId = contractsArray[_collIndex].borrowerOperations.openTrove(
            _account, _index, 1e18, _coll, _boldAmount, 0, 0, _annualInterestRate
        );
        vm.stopPrank();
        return troveId;
    }

    function makeMulticollateralSPDeposit(uint256 _collIndex, address _account, uint256 _amount) public {
        vm.startPrank(_account);
        contractsArray[_collIndex].stabilityPool.provideToSP(_amount);
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

        TroveManagerParams[] memory troveManagerParams = new TroveManagerParams[](NUM_COLLATERALS);
        troveManagerParams[0] = TroveManagerParams(110e16, 5e16, 10e16);
        troveManagerParams[1] = TroveManagerParams(120e16, 5e16, 10e16);
        troveManagerParams[2] = TroveManagerParams(120e16, 5e16, 10e16);
        troveManagerParams[3] = TroveManagerParams(125e16, 5e16, 10e16);

        LiquityContracts[] memory _contractsArray;
        (_contractsArray, collateralRegistry, boldToken) = _deployAndConnectContracts(troveManagerParams);
        // Unimplemented feature (...):Copying of type struct LiquityContracts memory[] memory to storage not yet supported.
        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            contractsArray.push(_contractsArray[c]);
        }
        // Set all price feeds to 2k
        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            contractsArray[c].priceFeed.setPrice(2000e18);
        }

        // Give some Collateral to test accounts, and approve it to BorrowerOperations
        uint256 initialCollateralAmount = 10_000e18;

        for (uint256 c = 0; c < NUM_COLLATERALS; c++) {
            for (uint256 i = 0; i < 6; i++) {
                // A to F
                giveAndApproveCollateral(
                    contractsArray[c].WETH,
                    accountsList[i],
                    initialCollateralAmount,
                    address(contractsArray[c].borrowerOperations)
                );
            }
        }
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
    }

    function testMultiCollateralRedemption() public {
        // All collaterals have the same price for this test
        uint256 price = contractsArray[0].priceFeed.getPrice();

        // First collateral unbacked Bold: 10k (SP empty)
        openMulticollateralTroveNoHints100pctMaxFeeWithIndex(0, A, 0, 10e18, 10000e18, 5e16);

        // Second collateral unbacked Bold: 5k
        openMulticollateralTroveNoHints100pctMaxFeeWithIndex(1, A, 0, 10e18, 10000e18, 5e16);
        makeMulticollateralSPDeposit(1, A, 5000e18);

        // Third collateral unbacked Bold: 1k
        openMulticollateralTroveNoHints100pctMaxFeeWithIndex(2, A, 0, 10e18, 10000e18, 5e16);
        makeMulticollateralSPDeposit(2, A, 9000e18);

        // Fourth collateral unbacked Bold: 0
        openMulticollateralTroveNoHints100pctMaxFeeWithIndex(3, A, 0, 10e18, 10000e18, 5e16);
        makeMulticollateralSPDeposit(3, A, 10000e18);

        // Check A’s final bal
        // TODO: change when we switch to new gas compensation
        //assertEq(boldToken.balanceOf(A), 16000e18, "Wrong Bold balance before redemption");
        assertEq(boldToken.balanceOf(A), 15200e18, "Wrong Bold balance before redemption");

        // initial balances
        uint256 coll1InitialBalance = contractsArray[0].WETH.balanceOf(A);
        uint256 coll2InitialBalance = contractsArray[1].WETH.balanceOf(A);
        uint256 coll3InitialBalance = contractsArray[2].WETH.balanceOf(A);
        uint256 coll4InitialBalance = contractsArray[3].WETH.balanceOf(A);

        // fees
        uint256 fee = collateralRegistry.getEffectiveRedemptionFeeInBold(1600e18) * DECIMAL_PRECISION / price;
        uint256 fee1 = fee * 10 / 16;
        uint256 fee2 = fee * 5 / 16;
        uint256 fee3 = fee / 16;

        // A redeems 1.6k
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(1600e18, 0, 1e18);
        vm.stopPrank();

        // Check bold balance
        // TODO: change when we switch to new gas compensation
        //assertApproxEqAbs(boldToken.balanceOf(A), 14400e18, 10, "Wrong Bold balance after redemption");
        assertApproxEqAbs(boldToken.balanceOf(A), 13600e18, 10, "Wrong Bold balance after redemption");

        // Check collateral balances
        // final balances
        uint256 coll1FinalBalance = contractsArray[0].WETH.balanceOf(A);
        uint256 coll2FinalBalance = contractsArray[1].WETH.balanceOf(A);
        uint256 coll3FinalBalance = contractsArray[2].WETH.balanceOf(A);
        uint256 coll4FinalBalance = contractsArray[3].WETH.balanceOf(A);

        assertEq(coll1FinalBalance - coll1InitialBalance, 5e17 - fee1, "Wrong Collateral 1 balance");
        assertEq(coll2FinalBalance - coll2InitialBalance, 25e16 - fee2, "Wrong Collateral 2 balance");
        assertEq(coll3FinalBalance - coll3InitialBalance, 5e16 - fee3, "Wrong Collateral 3 balance");
        assertEq(coll4FinalBalance - coll4InitialBalance, 0, "Wrong Collateral 4 balance");
    }

    struct TestValues {
        uint256 price;
        uint256 unbackedPortion;
        uint256 redeemAmount;
        uint256 fee;
        uint256 collInitialBalance;
        uint256 collFinalBalance;
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
        _spBoldAmount1 = bound(_spBoldAmount1, 0, boldAmount - 200e18);
        _spBoldAmount2 = bound(_spBoldAmount2, 0, boldAmount - 200e18);
        _spBoldAmount3 = bound(_spBoldAmount3, 0, boldAmount - 200e18);
        _spBoldAmount4 = bound(_spBoldAmount4, 0, boldAmount - 200e18 - minBoldBalance);
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
            /*
            115792089237316195423570985008687907853269984665640564039457584007913129639932,
            115792089237316195423570985008687907853269984665640564039457584007913129639932,
            115792089237316195423570985008687907853269984665640564039457584007913129639932,
            115792089237316195423570985008687907853269984665640564039457584007913129639932,
            0
            */
            // TODO: remove gas compensation
            boldAmount - 200e18,
            boldAmount - 200e18,
            boldAmount - 200e18,
            boldAmount - 200e18 - minBoldBalance,
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
        openMulticollateralTroveNoHints100pctMaxFeeWithIndex(0, A, 0, 10e18, _boldAmount, 5e16);
        if (_spBoldAmount1 > 0) makeMulticollateralSPDeposit(0, A, _spBoldAmount1);

        // Second collateral
        openMulticollateralTroveNoHints100pctMaxFeeWithIndex(1, A, 0, 10e18, _boldAmount, 5e16);
        if (_spBoldAmount2 > 0) makeMulticollateralSPDeposit(1, A, _spBoldAmount2);

        // Third collateral
        openMulticollateralTroveNoHints100pctMaxFeeWithIndex(2, A, 0, 10e18, _boldAmount, 5e16);
        if (_spBoldAmount3 > 0) makeMulticollateralSPDeposit(2, A, _spBoldAmount3);

        // Fourth collateral
        openMulticollateralTroveNoHints100pctMaxFeeWithIndex(3, A, 0, 10e18, _boldAmount, 5e16);
        if (_spBoldAmount4 > 0) makeMulticollateralSPDeposit(3, A, _spBoldAmount4);

        uint256 boldBalance = boldToken.balanceOf(A);
        // Check A’s final bal
        // TODO: change when we switch to new gas compensation
        //assertEq(boldToken.balanceOf(A), _boldAmount * 4 - _spBoldAmount1 - _spBoldAmount2 - _spBoldAmount3 - _spBoldAmount4, "Wrong Bold balance before redemption");
        // Stack too deep
        //assertEq(boldBalance, _boldAmount * 4 - _spBoldAmount1 - _spBoldAmount2 - _spBoldAmount3 - _spBoldAmount4 - 800e18, "Wrong Bold balance before redemption");

        uint256 redeemAmount = boldBalance * _redemptionFraction / DECIMAL_PRECISION;

        // initial balances
        testValues1.collInitialBalance = contractsArray[0].WETH.balanceOf(A);
        testValues2.collInitialBalance = contractsArray[1].WETH.balanceOf(A);
        testValues3.collInitialBalance = contractsArray[2].WETH.balanceOf(A);
        testValues4.collInitialBalance = contractsArray[3].WETH.balanceOf(A);

        testValues1.unbackedPortion = _boldAmount - _spBoldAmount1;
        testValues2.unbackedPortion = _boldAmount - _spBoldAmount2;
        testValues3.unbackedPortion = _boldAmount - _spBoldAmount3;
        testValues4.unbackedPortion = _boldAmount - _spBoldAmount4;
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

        // A redeems 1.6k
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(redeemAmount, 0, 1e18);
        vm.stopPrank();

        // Check bold balance
        assertApproxEqAbs(boldToken.balanceOf(A), boldBalance - redeemAmount, 10, "Wrong Bold balance after redemption");

        // Check collateral balances
        // final balances
        testValues1.collFinalBalance = contractsArray[0].WETH.balanceOf(A);
        testValues2.collFinalBalance = contractsArray[1].WETH.balanceOf(A);
        testValues3.collFinalBalance = contractsArray[2].WETH.balanceOf(A);
        testValues4.collFinalBalance = contractsArray[3].WETH.balanceOf(A);

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
}
