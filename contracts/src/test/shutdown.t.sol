pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract ShutdownTest is DevTestSetup {
    uint256 NUM_COLLATERALS = 4;
    LiquityContracts[] public contractsArray;

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

        uint256[] memory scrs = new uint256[](NUM_COLLATERALS);
        scrs[0] = 110e16;
        scrs[1] = 120e16;
        scrs[2] = 120e16;
        scrs[3] = 125e16;

    
        LiquityContracts[] memory _contractsArray;
        (_contractsArray, collateralRegistry, boldToken, , , WETH) =  _deployAndConnectContracts(troveManagerParams, scrs);
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
            }
        }

        // Set first branch as default
        borrowerOperations = contractsArray[0].borrowerOperations;
        troveManager = contractsArray[0].troveManager;
        MCR = troveManager.MCR();
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
            upfrontFee
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
            vm.expectRevert("BO: TCR is not below SCR");
            contractsArray[i].borrowerOperations.shutdown();
        }

        contractsArray[0].priceFeed.setPrice(1000e18);
        contractsArray[0].borrowerOperations.shutdown();
        for (uint256 i = 1; i < NUM_COLLATERALS; i++) {
            vm.expectRevert("BO: TCR is not below SCR");
            contractsArray[i].borrowerOperations.shutdown();
        }

        contractsArray[1].priceFeed.setPrice(100e18);
        contractsArray[1].borrowerOperations.shutdown();
        for (uint256 i = 2; i < NUM_COLLATERALS; i++) {
            vm.expectRevert("BO: TCR is not below SCR");
            contractsArray[i].borrowerOperations.shutdown();
        }

        contractsArray[2].priceFeed.setPrice(10000e18);
        contractsArray[2].borrowerOperations.shutdown();
        for (uint256 i = 3; i < NUM_COLLATERALS; i++) {
            vm.expectRevert("BO: TCR is not below SCR");
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

        vm.expectRevert("BO: already shutdown");
        contractsArray[0].borrowerOperations.shutdown();
    }

    function testCannotOpenTroveAfterShutdown() public {
        prepareAndShutdownFirstBranch();

        vm.startPrank(B);
        vm.expectRevert("BO: Branch shut down");
        borrowerOperations.openTrove(B, 0, 20e18, 5000e18, 0, 0, 5e16, 10000e18);
        vm.stopPrank();
    }

    function testCannotAddCollAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert("BO: Branch shut down");
        borrowerOperations.addColl(troveId, 1e18);
        vm.stopPrank();
    }

    function testCannotWithdrawCollAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert("BO: Branch shut down");
        borrowerOperations.withdrawColl(troveId, 1);
        vm.stopPrank();
    }

    function testCannotWithdrawBoldAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert("BO: Branch shut down");
        borrowerOperations.withdrawBold(troveId, 1, 10000e18);
        vm.stopPrank();
    }

    function testCannotRepayBoldAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert("BO: Branch shut down");
        borrowerOperations.repayBold(troveId, 1000e18);
        vm.stopPrank();
    }

    function testCannotAdjustUnredeemableTroveAfterShutdown() public {
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 11e18, 10000e18, 5e16);
        openMulticollateralTroveNoHints100pctWithIndex(0, B, 0, 22e18, 20000e18, 6e16);

        contractsArray[0].priceFeed.setPrice(1000e18);
        contractsArray[0].borrowerOperations.shutdown();

        // B redeems from A’s trove, to make it unredeemable
        //deal(address(boldToken), B, 20000e18);
        vm.startPrank(B);
        collateralRegistry.redeemCollateral(10000e18, 0, 1e18);
        vm.stopPrank();

        // Check A’s trove is unredeemable
        assertEq(troveManager.checkTroveIsUnredeemable(troveId), true, "A trove should be unredeemable");

        vm.startPrank(A);
        vm.expectRevert("BO: Branch shut down");
        borrowerOperations.adjustUnredeemableTrove(troveId, 1e18, true, 0, false, 0, 0, 1000e18);
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

    function testCannotAdjustInterestAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert("BO: Branch shut down");
        borrowerOperations.adjustTroveInterestRate(troveId, 4e16, 0, 0, 10000e18);
        vm.stopPrank();
    }

    function testCannotApplyTroveInterestPermissionlesslyAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert("BO: Branch shut down");
        borrowerOperations.applyTroveInterestPermissionless(troveId);
        vm.stopPrank();
    }

    function testCannotLiquidateAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        // TODO
        /*
        vm.startPrank(A);
        vm.expectRevert("BO: Branch shut down");
        troveManager.liquitate(troveId);
        vm.expectRevert("BO: Branch shut down");
        troveManager.batchLiquitate(uintToArray(troveId));
        vm.stopPrank();
        */
    }

    // TODO: interest delegation actions
    /*
    function testCannotAfterShutdown() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        vm.startPrank(A);
        vm.expectRevert("BO: Branch shut down");
        borrowerOperations.();
        vm.stopPrank();
    }
    */

    function testCannotUrgentRedeemWithoutShutdown() public {
        prepareAndShutdownFirstBranch();
        // open trove in 2nd branch
        uint256 troveId = openMulticollateralTroveNoHints100pctWithIndex(1, A, 0, 110e18, 10000e18, 5e16);

        vm.startPrank(A);
        vm.expectRevert("BO: Branch is not shut down");
        contractsArray[1].borrowerOperations.urgentRedemption(100e18, uintToArray(troveId), 0);
        vm.stopPrank();
    }

    function testUrgentRedeemRevertsIfMinNotReached() public {
        uint256 troveId = prepareAndShutdownFirstBranch();

        // Min not reached
        vm.startPrank(A);
        vm.expectRevert("TM: Min collateral not reached");
        borrowerOperations.urgentRedemption(1000e18, uintToArray(troveId), 102e16);
        vm.stopPrank();

        // Min just reached
        vm.startPrank(A);
        borrowerOperations.urgentRedemption(1000e18, uintToArray(troveId), 101e16);
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
        borrowerOperations.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldBalanceBefore - redemptionAmount, "Bold balance mismatch");
        assertEq(
            contractsArray[0].collToken.balanceOf(A),
            collBalanceBefore + redemptionAmount * DECIMAL_PRECISION / price * 101 / 100,
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
        borrowerOperations.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        assertEq(
            boldToken.balanceOf(A),
            boldBalanceBefore - 11e18 * price / DECIMAL_PRECISION * 100 / 101,
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
        borrowerOperations.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldBalanceBefore - redemptionAmount, "Bold balance mismatch");
        assertEq(
            contractsArray[0].collToken.balanceOf(A),
            collBalanceBefore + redemptionAmount * DECIMAL_PRECISION / price * 101 / 100,
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
        borrowerOperations.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldBalanceBefore - redemptionAmount, "Bold balance mismatch");
        assertEq(
            contractsArray[0].collToken.balanceOf(A),
            collBalanceBefore + redemptionAmount * DECIMAL_PRECISION / price * 101 / 100,
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
        borrowerOperations.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldBalanceBefore - redemptionAmount, "Bold balance mismatch");
        assertEq(
            contractsArray[0].collToken.balanceOf(A),
            collBalanceBefore + redemptionAmount * DECIMAL_PRECISION / price * 101 / 100,
            "Coll balance mismatch"
        );
    }

    function testCanUrgentReedemFullyAboveMCR() external {
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
        borrowerOperations.urgentRedemption(redemptionAmount, uintToArray(troveId), 0);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldBalanceBefore - redemptionAmount, "Bold balance mismatch");
        assertEq(
            contractsArray[0].collToken.balanceOf(A),
            collBalanceBefore + redemptionAmount * DECIMAL_PRECISION / price * 101 / 100,
            "Coll balance mismatch"
        );
    }
}
