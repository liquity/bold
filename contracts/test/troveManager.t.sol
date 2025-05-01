// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";

contract TroveManagerTest is DevTestSetup {
    function testOnlyCollateralRegistryCanCallRedeem() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotCollateralRegistry.selector);
        troveManager.redeemCollateral(A, 1, 2000e18, 1e16, 100);
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallShutdown() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        troveManager.shutdown();
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallOnOpenTrove() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        TroveChange memory troveChange;
        troveManager.onOpenTrove(A, addressToTroveId(A), troveChange, 5e16);
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallOnOpenTroveAndJoinBatch() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        TroveChange memory troveChange;
        troveManager.onOpenTroveAndJoinBatch(A, addressToTroveId(A), troveChange, B, 10000e18, 5000e18);
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallSetTroveStatusToActive() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        troveManager.setTroveStatusToActive(addressToTroveId(A));
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallOnAdjustTroveInterestRate() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        TroveChange memory troveChange;
        troveManager.onAdjustTroveInterestRate(addressToTroveId(A), 10000e18, 5000e18, 6e16, troveChange);
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallOnAdjustTrove() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        TroveChange memory troveChange;
        troveManager.onAdjustTrove(addressToTroveId(A), 10000e18, 5000e18, troveChange);
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallOnCloseTrove() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        TroveChange memory troveChange;
        troveManager.onCloseTrove(addressToTroveId(A), troveChange, B, 10000e18, 5000e18);
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallOnAdjustTroveInsideBatch() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        TroveChange memory troveChange;
        troveManager.onAdjustTroveInsideBatch(addressToTroveId(A), 10000e18, 5000e18, troveChange, B, 10000e18, 5000e18);
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallOnApplyTroveInterest() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        TroveChange memory troveChange;
        troveManager.onApplyTroveInterest(addressToTroveId(A), 10000e18, 5000e18, B, 10000e18, 5000e18, troveChange);
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallOnRegisterBatchManager() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        troveManager.onRegisterBatchManager(A, 5e16, 5e14);
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallOnLowerBatchManagerAnnualFee() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        troveManager.onLowerBatchManagerAnnualFee(A, 10000e18, 5000e18, 5e14);
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallOnSetBatchManagerAnnualInterestRate() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        troveManager.onSetBatchManagerAnnualInterestRate(A, 10000e18, 5000e18, 5e14, 100e18);
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallOnSetInterestBatchManager() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        TroveManager.OnSetInterestBatchManagerParams memory params;
        troveManager.onSetInterestBatchManager(params);
        vm.stopPrank();
    }

    function testOnlyBorrowerOperationsCanCallOnRemoveFromBatch() public {
        vm.startPrank(A);
        vm.expectRevert(TroveManager.CallerNotBorrowerOperations.selector);
        TroveChange memory troveChange;
        troveManager.onRemoveFromBatch(addressToTroveId(A), 10000e18, 5000e18, troveChange, B, 10000e18, 5000e18, 5e14);
        vm.stopPrank();
    }

    function testLiquidateLastTroveReverts() public {
        priceFeed.setPrice(2_000e18);
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 100_000e18, 1e17);
        priceFeed.setPrice(1_000e18);

        vm.startPrank(A);
        vm.expectRevert(TroveManager.OnlyOneTroveLeft.selector);
        troveManager.liquidate(ATroveId);
        vm.stopPrank();
    }

    function testRedeemSkipTrovesUnder100pct() public {
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pct(A, 2 ether, 2001e18, 1e17);
        uint256 BTroveId = openTroveNoHints100pct(B, 5 ether, 2000e18, 2e17);
        openTroveNoHints100pct(C, 5 ether, 2000e18, 3e17);

        uint256 debtA1 = troveManager.getTroveDebt(ATroveId);
        assertGt(debtA1, 0);
        uint256 collA1 = troveManager.getTroveColl(ATroveId);
        assertGt(collA1, 0);
        uint256 debtB1 = troveManager.getTroveDebt(BTroveId);
        assertGt(debtB1, 0);
        uint256 collB1 = troveManager.getTroveColl(BTroveId);
        assertGt(collB1, 0);

        // Reduce ETH price so A’s ICR goes below 100%
        uint256 newPrice = 1000e18;
        priceFeed.setPrice(newPrice);
        assertLt(troveManager.getCurrentICR(ATroveId, newPrice), _100pct);
        assertGt(troveManager.getCurrentICR(BTroveId, newPrice), _100pct);

        uint256 redemptionAmount = 1000e18; // 1k BOLD

        // Wait some time so that redemption rate is not 100%
        vm.warp(block.timestamp + 7 days);

        // C redeems 1k BOLD
        vm.startPrank(C);
        collateralRegistry.redeemCollateral(redemptionAmount, 10, 1e18);
        vm.stopPrank();

        // Check A's coll and debt are the same
        uint256 debtA2 = troveManager.getTroveDebt(ATroveId);
        assertEq(debtA2, debtA1, "A debt mismatch");
        uint256 collA2 = troveManager.getTroveColl(ATroveId);
        assertEq(collA2, collA1, "A coll mismatch");

        // Check B's coll and debt reduced
        uint256 debtB2 = troveManager.getTroveDebt(BTroveId);
        assertLt(debtB2, debtB1, "B debt mismatch");
        uint256 collB2 = troveManager.getTroveColl(BTroveId);
        assertLt(collB2, collB1, "B coll mismatch");
    }

    function testInitialRedemptionBaseRate() public view {
        assertEq(collateralRegistry.baseRate(), INITIAL_BASE_RATE);
    }

    function testRedemptionBaseRateAfter2Weeks() public {
        assertEq(collateralRegistry.baseRate(), INITIAL_BASE_RATE);

        // Two weeks go by
        vm.warp(block.timestamp + 14 days);

        priceFeed.setPrice(2000e18);
        openTroveNoHints100pct(A, 200 ether, 200000e18, 1e17);
        // A redeems 1 wei of BOLD, base rate goes down to almost zero (it’s updated on redemption)
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(1, 10, 1e18);
        vm.stopPrank();

        //console.log(collateralRegistry.baseRate(), "baseRate");
        assertLt(collateralRegistry.baseRate(), 20); // Goes down below 2e-16
    }

    function testLiquidationSucceedsEvenWhenEncounteringInactiveTroves() public {
        ABCDEF memory troveIDs;

        uint256 coll = 100 ether;
        uint256 borrow = 10_000 ether;
        uint256 interestRate = 0.01 ether;
        troveIDs.A = openTroveNoHints100pct(A, coll, borrow, interestRate);
        troveIDs.B = openTroveNoHints100pct(B, coll, borrow, interestRate);
        troveIDs.C = openTroveNoHints100pct(C, coll, borrow, interestRate);
        troveIDs.D = openTroveNoHints100pct(D, 1_000 ether, borrow, interestRate); // whale to keep TCR afloat

        uint256 dropPrice = 110 ether;
        priceFeed.setPrice(dropPrice);
        assertGt(troveManager.getTCR(dropPrice), CCR, "Want TCR > CCR");

        troveManager.liquidate(troveIDs.A);

        uint256[] memory liquidatedTroves = new uint256[](2);
        liquidatedTroves[0] = troveIDs.A; // inactive
        liquidatedTroves[1] = troveIDs.B;
        troveManager.batchLiquidateTroves(liquidatedTroves);
    }
}
