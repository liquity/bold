// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract ShutdownTest is DevTestSetup {
    uint256 NUM_COLLATERALS = 4;
    TestDeployer.LiquityContractsDev[] public contractsArray;

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
        
        // Initialize SystemParams-based variables
        systemParams = contractsArray[0].systemParams;
        SP_YIELD_SPLIT = systemParams.SP_YIELD_SPLIT();
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

        // Set first branch as default
        borrowerOperations = contractsArray[0].borrowerOperations;
        troveManager = contractsArray[0].troveManager;
        priceFeed = contractsArray[0].priceFeed;
        systemParams = contractsArray[0].systemParams;
        MCR = troveManager.get_MCR();
        SCR = troveManager.get_SCR();
    }

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

    function prepareAndShutdownFirstBranch() internal returns (uint256) {
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 10000e18, 5e16);

        // Price halves and first branch is shut down
        contractsArray[0].priceFeed.setPrice(1000e18);
        contractsArray[0].borrowerOperations.shutdown();

        return troveId;
    }

    function testCanShutdownBranchesSeparately() public {
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(1, A, 0, 110e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(2, A, 0, 11e18, 100000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(3, A, 0, 11e18, 12500e18, 5e16);

        vm.startPrank(A);

        for (uint256 i = 0; i < NUM_COLLATERALS; i++) {
            vm.expectRevert(BorrowerOperations.TCRNotBelowSCR.selector);
            contractsArray[i].borrowerOperations.shutdown();
        }

        contractsArray[0].priceFeed.setPrice(1000e18);
        contractsArray[0].borrowerOperations.shutdown();
        for (uint256 i = 1; i < NUM_COLLATERALS; i++) {
            vm.expectRevert(BorrowerOperations.TCRNotBelowSCR.selector);
            contractsArray[i].borrowerOperations.shutdown();
        }

        contractsArray[1].priceFeed.setPrice(100e18);
        contractsArray[1].borrowerOperations.shutdown();
        for (uint256 i = 2; i < NUM_COLLATERALS; i++) {
            vm.expectRevert(BorrowerOperations.TCRNotBelowSCR.selector);
            contractsArray[i].borrowerOperations.shutdown();
        }

        contractsArray[2].priceFeed.setPrice(10000e18);
        contractsArray[2].borrowerOperations.shutdown();
        for (uint256 i = 3; i < NUM_COLLATERALS; i++) {
            vm.expectRevert(BorrowerOperations.TCRNotBelowSCR.selector);
            contractsArray[i].borrowerOperations.shutdown();
        }

        contractsArray[3].priceFeed.setPrice(1250e18);
        contractsArray[3].borrowerOperations.shutdown();

        vm.stopPrank();
    }

    function testCanShutdownOnlyOnce() public {
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 10000e18, 5e16);

        vm.startPrank(A);

        contractsArray[0].priceFeed.setPrice(1000e18);
        contractsArray[0].borrowerOperations.shutdown();

        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        contractsArray[0].borrowerOperations.shutdown();
    }

    function testCannotOpenTroveAfterShutdown() public {
        prepareAndShutdownFirstBranch();

        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.openTrove(B, 0, 20e18, 5000e18, 0, 0, 5e16, 10000e18, address(0), address(0), address(0));
        vm.stopPrank();
    }

    function testCannotAddCollAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.addColl(troveId, 1e18);
        vm.stopPrank();
    }

    function testCannotWithdrawCollAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.withdrawColl(troveId, 1);
        vm.stopPrank();
    }

    function testCannotWithdrawBoldAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.withdrawBold(troveId, 1, 10000e18);
        vm.stopPrank();
    }

    function testCannotRepayBoldAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.repayBold(troveId, 1000e18);
        vm.stopPrank();
    }

    function testCannotAdjustZombieTroveAfterShutdown() public {
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, B, 0, 22e18, 20000e18, 6e16);

        // B redeems from A’s trove, to make it zombie
        //deal(address(boldToken), B, 20000e18);
        vm.startPrank(B);
        collateralRegistry.redeemCollateral(10000e18, 0, 1e18);
        vm.stopPrank();

        // Price goes down and shutdown is triggered

        contractsArray[0].priceFeed.setPrice(500e18);
        contractsArray[0].borrowerOperations.shutdown();

        // Check A’s trove is zombie
        assertEq(troveManager.checkTroveIsZombie(troveId), true, "A trove should be zombie");

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.adjustZombieTrove(troveId, 1e18, true, 0, false, 0, 0, 1000e18);
        vm.stopPrank();
    }

    function testCanCloseTroveAfterShutdown() public {
        // We need at least 2 troves, as there must always be 1 per branch
        openMulticollateralTroveNoHints100pctWithIndex(0, B, 0, 11e18, 10000e18, 5e16);

        uint256 troveId = prepareAndShutdownFirstBranch();

        deal(address(boldToken), A, 20000e18);
        vm.startPrank(A);
        borrowerOperations.closeTrove(troveId);
        vm.stopPrank();

        // Check trove is closed
        assertEq(uint8(troveManager.getTroveStatus(troveId)), uint8(ITroveManager.Status.closedByOwner));
    }

    function testCanCloseLastTroveAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        deal(address(boldToken), A, 20000e18);
        vm.startPrank(A);
        borrowerOperations.closeTrove(troveId);
        vm.stopPrank();

        // Check trove is closed
        assertEq(uint8(troveManager.getTroveStatus(troveId)), uint8(ITroveManager.Status.closedByOwner));
    }

    function testCannotLiquidateLastTroveAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(B);
        vm.expectRevert(TroveManager.OnlyOneTroveLeft.selector);
        troveManager.liquidate(troveId);
        vm.stopPrank();

        // Check trove is not closed
        assertEq(uint8(troveManager.getTroveStatus(troveId)), uint8(ITroveManager.Status.active));
    }

    function testCannotAdjustInterestAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.adjustTroveInterestRate(troveId, 4e16, 0, 0, 10000e18);
        vm.stopPrank();
    }

    function testCannotApplyTroveInterestPermissionlesslyAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.applyPendingDebt(troveId);
        vm.stopPrank();
    }

    function testCannotSetIndividualDelegateAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.setInterestIndividualDelegate(troveId, B, 5e15, 1e18, 0, 0, 0, 0, 0);
        vm.stopPrank();
    }

    function testCannotRegisterBatchManagerAfterShutdown() public {
        prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.registerBatchManager(5e15, 1e18, 10e16, 25e14, 30 days);
        vm.stopPrank();
    }

    function testCannotLowerBatchManagementFeeAfterShutdown() public {
        vm.startPrank(A);
        borrowerOperations.registerBatchManager(5e15, 1e18, 10e16, 25e14, 30 days);
        vm.stopPrank();

        prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.lowerBatchManagementFee(20e14);
        vm.stopPrank();
    }

    function testCannotSetBatchManagerAnnualInterestRateAfterShutdown() public {
        vm.startPrank(A);
        borrowerOperations.registerBatchManager(5e15, 1e18, 10e16, 25e14, 30 days);
        vm.stopPrank();

        prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.setBatchManagerAnnualInterestRate(9e16, 0, 0, 1000e18);
        vm.stopPrank();
    }

    function testCannotSetInterestBatchManagerAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.setInterestBatchManager(troveId, B, 0, 0, 1000e18);
        vm.stopPrank();
    }

    function testCannotRemoveFromBatchAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.removeFromBatch(troveId, 5e16, 0, 0, 1000e18);
        vm.stopPrank();
    }

    function testCannotSwitchBatchManagerAfterShutdown() public {
        // Register batch managers B, C
        registerBatchManager(B, 5e15, 1e18, 10e16, 25e14, 30 days);
        registerBatchManager(C, 5e15, 1e18, 10e16, 25e14, 30 days);
        // A opens trove
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 10000e18, 5e16);
        // A joins B batch
        setInterestBatchManager(A, troveId, B, 5e15);

        // Price halves and first branch is shut down
        contractsArray[0].priceFeed.setPrice(1000e18);
        contractsArray[0].borrowerOperations.shutdown();

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.IsShutDown.selector);
        borrowerOperations.switchBatchManager(troveId, 0, 0, C, 0, 0, 1000e18);
        vm.stopPrank();
    }

    function testCannotUrgentRedeemWithoutShutdown() public {
        prepareAndShutdownFirstBranch();
        // open trove in 2nd branch
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(1, A, 0, 110e18, 10000e18, 5e16);

        vm.startPrank(A);
        vm.expectRevert(TroveManager.NotShutDown.selector);
        contractsArray[1].troveManager.urgentRedemption(100e18, uintToArray(troveId), 0);
        vm.stopPrank();
    }

    function testCannotUrgentRedeemZero() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert(TroveManager.ZeroAmount.selector);
        troveManager.urgentRedemption(0, uintToArray(troveId), 0);
        vm.stopPrank();
    }

    function testCannotUrgentRedeemWithoutEnoughBalance() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        // A sends 900 Bold to B
        vm.startPrank(A);
        boldToken.transfer(B, 900e18);
        vm.stopPrank();

        // B tries to redeem 1000 Bold
        vm.startPrank(B);
        vm.expectRevert(TroveManager.NotEnoughBoldBalance.selector);
        troveManager.urgentRedemption(1000e18, uintToArray(troveId), 0);
        vm.stopPrank();
    }

    function testUrgentRedeemRevertsIfMinNotReached() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        // Min not reached
        vm.startPrank(A);
        vm.expectRevert(abi.encodeWithSelector(TroveManager.MinCollNotReached.selector, 101e16));
        troveManager.urgentRedemption(1000e18, uintToArray(troveId), 102e16);
        vm.stopPrank();

        // Min just reached
        vm.startPrank(A);
        troveManager.urgentRedemption(1000e18, uintToArray(troveId), 101e16);
        vm.stopPrank();
    }

    function testCanUrgentReedemPartiallyBelow100() external {
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 5e16);
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 5e16);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        contractsArray[0].borrowerOperations.shutdown();

        uint256 icr = troveManager.getCurrentICR(troveId, price);
        assertLt(icr, 1e18, "Trove CR should be below 100%");

        uint256 boldBalanceBefore = boldToken.balanceOf(A);
        uint256 collBalanceBefore = contractsArray[0].collToken.balanceOf(A);
        uint256 redemptionAmount = 100e18;
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldBalanceBefore - redemptionAmount, "Bold balance mismatch");
        assertEq(
            contractsArray[0].collToken.balanceOf(A),
            collBalanceBefore
                + redemptionAmount * DECIMAL_PRECISION / price * (DECIMAL_PRECISION + URGENT_REDEMPTION_BONUS)
                    / DECIMAL_PRECISION,
            "Coll balance mismatch"
        );
    }

    function testCanUrgentReedemFullyBelow100() external {
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 5e16);
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 5e16);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        contractsArray[0].borrowerOperations.shutdown();

        uint256 icr = troveManager.getCurrentICR(troveId, price);
        assertLt(icr, 1e18, "Trove CR should be below 100%");

        uint256 boldBalanceBefore = boldToken.balanceOf(A);
        uint256 collBalanceBefore = contractsArray[0].collToken.balanceOf(A);
        uint256 redemptionAmount = troveManager.getTroveEntireDebt(troveId);
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        assertEq(
            boldToken.balanceOf(A),
            boldBalanceBefore
                - 11e18 * price / DECIMAL_PRECISION * DECIMAL_PRECISION / (DECIMAL_PRECISION + URGENT_REDEMPTION_BONUS),
            "Bold balance mismatch"
        );
        assertEq(contractsArray[0].collToken.balanceOf(A), collBalanceBefore + 11e18, "Coll balance mismatch");
    }

    function testCanUrgentReedemPartiallyBelowMCR() external {
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 5e16);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        contractsArray[0].borrowerOperations.shutdown();

        uint256 icr = troveManager.getCurrentICR(troveId, price);
        assertGt(icr, 1e18, "Trove CR should be above 100%");
        assertLt(icr, MCR, "Trove CR should be below MCR");

        uint256 boldBalanceBefore = boldToken.balanceOf(A);
        uint256 collBalanceBefore = contractsArray[0].collToken.balanceOf(A);
        uint256 redemptionAmount = 100e18;
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldBalanceBefore - redemptionAmount, "Bold balance mismatch");
        assertEq(
            contractsArray[0].collToken.balanceOf(A),
            collBalanceBefore
                + redemptionAmount * DECIMAL_PRECISION / price * (DECIMAL_PRECISION + URGENT_REDEMPTION_BONUS)
                    / DECIMAL_PRECISION,
            "Coll balance mismatch"
        );
    }

    function testCanUrgentReedemFullyBelowMCR() external {
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 5e16);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        contractsArray[0].borrowerOperations.shutdown();

        uint256 icr = troveManager.getCurrentICR(troveId, price);
        assertGt(icr, 1e18, "Trove CR should be above 100%");
        assertLt(icr, MCR, "Trove CR should be below MCR");

        uint256 boldBalanceBefore = boldToken.balanceOf(A);
        uint256 collBalanceBefore = contractsArray[0].collToken.balanceOf(A);
        uint256 redemptionAmount = troveManager.getTroveEntireDebt(troveId);
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldBalanceBefore - redemptionAmount, "Bold balance mismatch");
        // TODO: determine why this is off by 1 wei - it should be exact
        assertApproximatelyEqual(
            contractsArray[0].collToken.balanceOf(A),
            collBalanceBefore
                + redemptionAmount * DECIMAL_PRECISION / price * (DECIMAL_PRECISION + URGENT_REDEMPTION_BONUS)
                    / DECIMAL_PRECISION,
            1, // 1 wei tolerance
            "Coll balance mismatch"
        );
    }

    function testCanUrgentReedemPartiallyAboveMCR() external {
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 5e16);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        contractsArray[0].borrowerOperations.shutdown();

        uint256 icr = troveManager.getCurrentICR(troveId, price);
        assertGt(icr, MCR, "Trove CR should be above MCR");

        uint256 boldBalanceBefore = boldToken.balanceOf(A);
        uint256 collBalanceBefore = contractsArray[0].collToken.balanceOf(A);
        uint256 redemptionAmount = 100e18;
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldBalanceBefore - redemptionAmount, "Bold balance mismatch");
        assertEq(
            contractsArray[0].collToken.balanceOf(A),
            collBalanceBefore
                + redemptionAmount * DECIMAL_PRECISION / price * (DECIMAL_PRECISION + URGENT_REDEMPTION_BONUS)
                    / DECIMAL_PRECISION,
            "Coll balance mismatch"
        );
    }

    function testCanUrgentRedeemFullyAboveMCR() external {
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 5e16);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        contractsArray[0].borrowerOperations.shutdown();

        uint256 icr = troveManager.getCurrentICR(troveId, price);
        assertGt(icr, MCR, "Trove CR should be above MCR");

        uint256 boldBalanceBefore = boldToken.balanceOf(A);
        uint256 collBalanceBefore = contractsArray[0].collToken.balanceOf(A);
        uint256 redemptionAmount = troveManager.getTroveEntireDebt(troveId);
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldBalanceBefore - redemptionAmount, "Bold balance mismatch");
        // TODO: determine why this is off by 1 wei - it should be exact
        assertApproximatelyEqual(
            contractsArray[0].collToken.balanceOf(A),
            collBalanceBefore
                + redemptionAmount * DECIMAL_PRECISION / price * (DECIMAL_PRECISION + URGENT_REDEMPTION_BONUS)
                    / DECIMAL_PRECISION,
            1, // 1 wei tolerance
            "Coll balance mismatch"
        );
    }

    function testUrgentRedeemOf0DebtTroveDoesntUpdateTrovesLastUpdateTime() external {
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 5e16);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        contractsArray[0].borrowerOperations.shutdown();

        uint256 redemptionAmount = troveManager.getTroveEntireDebt(troveId);

        // Urgent redeem to bring Trove to 0 debt
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        // Check Trove debt reduced to 0
        assertEq(troveManager.getTroveEntireDebt(troveId), 0, "Trove debt not reduced to 0");

        (,,,,, uint64 lastDebtUpdateTime1,,,,) = troveManager.Troves(troveId);
        assertEq(lastDebtUpdateTime1, block.timestamp, "first update time incorrect");

        // Urgent-redeem again from the Trove
        vm.warp(block.timestamp + 1 days);
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        // Check update time didn't update
        (,,,,, uint64 lastDebtUpdateTime2,,,,) = troveManager.Troves(troveId);
        assertEq(lastDebtUpdateTime2, lastDebtUpdateTime1, "2nd update time incorrect");
    }

    function testUrgentRedeemOfClosedTroveDoesntUpdateTrovesLastUpdateTime() external {
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 5e16);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        contractsArray[0].borrowerOperations.shutdown();

        uint256 redemptionAmount = troveManager.getTroveEntireDebt(troveId);

        // A closes Trove
        vm.startPrank(A);
        borrowerOperations.closeTrove(troveId);
        vm.stopPrank();

        // Check Trove status is closed
        assertEq(
            uint256(troveManager.getTroveStatus(troveId)),
            uint256(ITroveManager.Status.closedByOwner),
            "Trove not closed"
        );

        // Check update time zero'd
        (,,,,, uint64 lastDebtUpdateTime1,,,,) = troveManager.Troves(troveId);
        assertEq(lastDebtUpdateTime1, 0, "first update time incorrect");

        // Urgent-redeem again from the Trove
        vm.warp(block.timestamp + 1 days);
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        // Check update time didn't update
        (,,,,, uint64 lastDebtUpdateTime2,,,,) = troveManager.Troves(troveId);
        assertEq(lastDebtUpdateTime2, lastDebtUpdateTime1, "2nd update time incorrect");
    }

    function testShutdownZerosPendingAggInterest() public {
        // Open troves with time in between so they each accrue interest
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        vm.warp(block.timestamp + 1 days);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        vm.warp(block.timestamp + 1 days);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);
        vm.warp(block.timestamp + 1 days);

        uint256 accruedAggInterest = contractsArray[0].activePool.calcPendingAggInterest();
        assertGt(accruedAggInterest, 0);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();
        assertTrue(borrowerOperations.hasBeenShutDown());

        // Check shutdown zeros pending agg. interest
        accruedAggInterest = contractsArray[0].activePool.calcPendingAggInterest();
        assertEq(accruedAggInterest, 0);
    }

    function testShutdownZerosMintsPendingAggInterestToSP() public {
        // Open troves with time in between so they each accrue interest
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        vm.warp(block.timestamp + 1 days);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        vm.warp(block.timestamp + 1 days);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);
        vm.warp(block.timestamp + 1 days);

        uint256 accruedAggInterest = contractsArray[0].activePool.calcPendingAggInterest();
        assertGt(accruedAggInterest, 0);

        uint256 expectedSPYield = _getSPYield(accruedAggInterest);
        assertGt(expectedSPYield, 0);

        uint256 spBal1 = boldToken.balanceOf(address(contractsArray[0].stabilityPool));

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();
        assertTrue(borrowerOperations.hasBeenShutDown());

        // Check shutdown has increased SP balance correctly
        uint256 spBal2 = boldToken.balanceOf(address(contractsArray[0].stabilityPool));
        assertEq(spBal2 - spBal1, expectedSPYield);
    }

    function testPendingAggInterestRemainsZeroAfterShutdown() public {
        // Open troves with time in between so they each accrue interest
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        vm.warp(block.timestamp + 1 days);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        vm.warp(block.timestamp + 1 days);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);
        vm.warp(block.timestamp + 1 days);

        uint256 accruedAggInterest = contractsArray[0].activePool.calcPendingAggInterest();
        assertGt(accruedAggInterest, 0);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();
        assertTrue(borrowerOperations.hasBeenShutDown());

        // Check shutdown zeros pending agg. interest
        accruedAggInterest = contractsArray[0].activePool.calcPendingAggInterest();
        assertEq(accruedAggInterest, 0);

        // Time passes
        vm.warp(block.timestamp + 1 days);

        // Check agg. interest has not increased
        accruedAggInterest = contractsArray[0].activePool.calcPendingAggInterest();
        assertEq(accruedAggInterest, 0);
    }

    function testIndividualTrovesDontAcrrueInterestAfterShutdown() public {
        // Open troves with time in between so they each accrue interest
        uint256 troveId1 = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        vm.warp(block.timestamp + 1 days);
        uint256 troveId2 = openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        vm.warp(block.timestamp + 1 days);
        uint256 troveId3 = openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);
        vm.warp(block.timestamp + 1 days);

        // Check each Trove has accrued interest
        uint256 interest1_t0 = troveManager.calcTroveAccruedInterest((troveId1));
        uint256 interest2_t0 = troveManager.calcTroveAccruedInterest((troveId2));
        uint256 interest3_t0 = troveManager.calcTroveAccruedInterest((troveId3));
        assertGt(interest1_t0, 0);
        assertGt(interest2_t0, 0);
        assertGt(interest3_t0, 0);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();
        assertTrue(borrowerOperations.hasBeenShutDown());

        // Time passes again
        vm.warp(block.timestamp + 1 days);

        // Check each Trove's interest has not changed since shutdown

        uint256 interest1_t1 = troveManager.calcTroveAccruedInterest((troveId1));
        uint256 interest2_t1 = troveManager.calcTroveAccruedInterest((troveId2));
        uint256 interest3_t1 = troveManager.calcTroveAccruedInterest((troveId3));

        assertEq(interest1_t1, interest1_t0);
        assertEq(interest2_t1, interest2_t0);
        assertEq(interest3_t1, interest3_t0);
    }

    // - Trove with 0 interest accrues 0 interest after shutdown
    function testTroveWith0InterestAccrues0InterestShutdown() public {
        // Open troves with time in between so they each accrue interest
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        vm.warp(block.timestamp + 1 days);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        vm.warp(block.timestamp + 1 days);
        uint256 troveId3 = openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);

        // Check Trove 3 has no interest
        uint256 interest3_t0 = troveManager.calcTroveAccruedInterest((troveId3));
        assertEq(interest3_t0, 0);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();
        assertTrue(borrowerOperations.hasBeenShutDown());

        // Time passes again
        vm.warp(block.timestamp + 1 days);

        // Check Trove 3 still has 0 interest after shutdown;
        uint256 interest3_t1 = troveManager.calcTroveAccruedInterest((troveId3));
        assertEq(interest3_t1, interest3_t0);
    }

    function testSetShutdownSetsShutdownFlagsAndTime() public {
        // Open troves with time in between so they each accrue interest
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);

        assertFalse(contractsArray[0].borrowerOperations.hasBeenShutDown());
        assertFalse(contractsArray[0].activePool.hasBeenShutDown());
        assertEq(troveManager.shutdownTime(), 0);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();

        assertTrue(contractsArray[0].borrowerOperations.hasBeenShutDown());
        assertTrue(contractsArray[0].activePool.hasBeenShutDown());
        assertEq(troveManager.shutdownTime(), block.timestamp);
    }

    function testSetShutdownFlagOnActivePoolRevertWhenNotCalledByTM() public {
        // Open troves with time in between so they each accrue interest
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);

        // Random EOA tries to call setShutdownFlag and fails
        vm.startPrank(C);
        vm.expectRevert();
        contractsArray[0].activePool.setShutdownFlag();

        // Price halves, branch can be shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();

        // Random EOA tries to call setShutdownFlag and fails
        vm.startPrank(C);
        vm.expectRevert();
        contractsArray[0].activePool.setShutdownFlag();
    }

    function testUrgentRedemptionAppliesInterestEarnedUpToShutdownTimeToTrove() public {
        // Open troves with time in between so they each accrue interest
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        vm.warp(block.timestamp + 1 days);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        vm.warp(block.timestamp + 1 days);
        uint256 troveId3 = openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);
        vm.warp(block.timestamp + 1 days);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();
        assertTrue(borrowerOperations.hasBeenShutDown());

        // Check Trove 3 has accrued interest
        uint256 interest3_t0 = troveManager.calcTroveAccruedInterest((troveId3));
        assertGt(interest3_t0, 0);

        uint256 recordedDebt3 = troveManager.getTroveDebt(troveId3);
        assertGt(recordedDebt3, 0);

        uint256 redemptionAmount = 100e18;
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId3), 0);
        vm.stopPrank();

        // fast forward time
        vm.warp(block.timestamp + 1 days);

        // Check Trove 3's recorded debt changed correctly: increased by interest up to shutdown, decreased by redeemed amount
        assertEq(troveManager.getTroveDebt(troveId3), recordedDebt3 - redemptionAmount + interest3_t0);
    }

    function testTroveAfterUrgentRedemptionHas0AccruedInterest() public {
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        uint256 troveId3 = openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);
        vm.warp(block.timestamp + 1 days);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();
        assertTrue(borrowerOperations.hasBeenShutDown());

        (uint256 debtBefore3,,,,) = troveManager.getEntireDebtAndColl(troveId3);
        assertGt(debtBefore3, 0);

        // Check Trove has some pending interest
        assertGt(troveManager.calcTroveAccruedInterest(troveId3), 0);

        uint256 redemptionAmount = 100e18;
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId3), 0);
        vm.stopPrank();

        // Check Trove's debt is reduced
        (uint256 debtAfter3,,,,) = troveManager.getEntireDebtAndColl(troveId3);
        assertGt(debtAfter3, 0);
        assertEq(debtAfter3, debtBefore3 - redemptionAmount);

        // Check Trove has no pending interest
        assertEq(troveManager.calcTroveAccruedInterest(troveId3), 0);
    }

    function testTroveAfterUrgentRedemptionEarnsNoInterest() public {
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        uint256 troveId3 = openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);
        vm.warp(block.timestamp + 1 days);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();
        assertTrue(borrowerOperations.hasBeenShutDown());

        (uint256 debtBefore3,,,,) = troveManager.getEntireDebtAndColl(troveId3);
        assertGt(debtBefore3, 0);

        uint256 redemptionAmount = 100e18;
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId3), 0);
        vm.stopPrank();

        // Check Trove has no pending interest
        assertEq(troveManager.calcTroveAccruedInterest(troveId3), 0);

        // Check Trove's debt after redemption is > 0
        (uint256 debtAfter3,,,,) = troveManager.getEntireDebtAndColl(troveId3);
        assertGt(debtAfter3, 0, "Debt should be positive");
        assertEq(debtAfter3, debtBefore3 - redemptionAmount, "Debt mismatch");

        // fast forward time
        vm.warp(block.timestamp + 1 days);

        // Check Trove still has no interest
        assertEq(troveManager.calcTroveAccruedInterest(troveId3), 0, "Trove accrued interest should be zero");
    }

    function testUrgentRedemptionReducesAggRecordedDebtByRedeemedAmount() public {
        // Open troves with time in between so they each accrue interest
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        uint256 troveId3 = openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);
        vm.warp(block.timestamp + 1 days);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();
        assertTrue(borrowerOperations.hasBeenShutDown());

        uint256 aggRecordedDebt_t0 = contractsArray[0].activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_t0, 0);

        uint256 redemptionAmount = 100e18;
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId3), 0);
        vm.stopPrank();

        // fast forward time
        vm.warp(block.timestamp + 1 days);

        // Check agg. recorded debt decreased only by the redemption amount (since there is no pending agg. interest)
        assertEq(contractsArray[0].activePool.aggRecordedDebt(), aggRecordedDebt_t0 - redemptionAmount);
    }

    function testUrgentRedemptionMintsNoInterestToSP() public {
        // Open troves with time in between so they each accrue interest
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        uint256 troveId3 = openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);
        vm.warp(block.timestamp + 1 days);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();
        assertTrue(borrowerOperations.hasBeenShutDown());

        uint256 spBoldBal_t0 = boldToken.balanceOf(address(contractsArray[0].stabilityPool));

        uint256 redemptionAmount = 100e18;
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId3), 0);
        vm.stopPrank();

        uint256 spBoldBal_t1 = boldToken.balanceOf(address(contractsArray[0].stabilityPool));

        // Check SP bold bal didnt change from urgent redemption
        assertEq(spBoldBal_t1, spBoldBal_t0);
    }

    function testUrgentRedemptionReducesAggWeightedDebtSumByNetWeightedAmountRemoved() public {
        // Open troves with time in between so they each accrue interest
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        uint256 troveId3 = openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);
        vm.warp(block.timestamp + 1 days);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();
        assertTrue(borrowerOperations.hasBeenShutDown());

        // Trove 3 has accrued interest up to shutdown
        uint256 interest_t3 = troveManager.calcTroveAccruedInterest(troveId3);
        assertGt(interest_t3, 0);

        uint256 aggWeightedDebtSum_t0 = contractsArray[0].activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_t0, 0);

        uint256 redemptionAmount = 100e18;
        vm.startPrank(A);
        troveManager.urgentRedemption(redemptionAmount, uintToArray(troveId3), 0);
        vm.stopPrank();

        // fast forward time
        vm.warp(block.timestamp + 1 days);

        uint256 netWeightedDebtRemoved =
            (redemptionAmount - interest_t3) * troveManager.getTroveAnnualInterestRate((troveId3));

        // Check recorded debt sum decreased by redemption amount weighted by trove 3's interest rate
        assertEq(contractsArray[0].activePool.aggWeightedDebtSum(), aggWeightedDebtSum_t0 - netWeightedDebtRemoved);
    }

    function testApproxAvgInterestRateIs0AfterShutdown() public {
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 9000e18, 5e16);
        vm.warp(block.timestamp + 1 days);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 1, 11e18, 10000e18, 6e16);
        vm.warp(block.timestamp + 1 days);
        openMulticollateralTroveNoHints100pctWithIndex(0, A, 2, 11e18, 11000e18, 7e16);
        vm.warp(block.timestamp + 1 days);

        // Check approx. avg. interest > 0 before
        TroveChange memory _noTroveChange;
        assertGt(contractsArray[0].activePool.getNewApproxAvgInterestRateFromTroveChange(_noTroveChange), 0);

        // Price halves and first branch is shut down
        uint256 price = 1000e18;
        contractsArray[0].priceFeed.setPrice(price);
        assertLt(troveManager.getTCR(price), SCR);
        contractsArray[0].borrowerOperations.shutdown();
        assertTrue(borrowerOperations.hasBeenShutDown());

        // Check approx. avg. interest is 0 after shut down
        assertEq(contractsArray[0].activePool.getNewApproxAvgInterestRateFromTroveChange(_noTroveChange), 0);
    }

    // TODO: tests for Zombie Troves in shutdown (though, uses the exact same logic as normal redemptions)

    function test_Issue_UrgentRedemptionDoesNotUpdateBatchedTroveDebt() external {
        uint256 troveId = openTroveAndJoinBatchManager({
            _troveOwner: A,
            _coll: 16_000 ether * 1 ether / priceFeed.getPrice(),
            _debt: 10_000 ether,
            _batchAddress: B,
            _annualInterestRate: 0.01 ether
        });

        vm.warp(block.timestamp + 30 days);

        priceFeed.setPrice(priceFeed.getPrice() / 2);
        assertLtDecimal(troveManager.getTCR(priceFeed.getPrice()), _100pct, 18, "TCR should be < 100%");

        borrowerOperations.shutdown();

        uint256[] memory redeemed = new uint256[](1);
        redeemed[0] = troveId;

        uint256 troveDebtBefore = troveManager.getTroveEntireDebt(troveId);
        // emit log_named_decimal_uint("trove debt", troveDebtBefore, 18);
        // trove debt: 10012.193751172827922686

        vm.prank(A);
        uint256 redeemAmount = 1 ether;
        troveManager.urgentRedemption(redeemAmount, redeemed, 0);

        uint256 troveDebtAfter = troveManager.getTroveEntireDebt(troveId);
        // emit log_named_decimal_uint("trove debt", troveDebtAfter, 18);
        // trove debt: 10012.193751172827922686

        assertEq(troveDebtAfter, troveDebtBefore - redeemAmount);
    }
}
