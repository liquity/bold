pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract Redemptions is DevTestSetup {
    struct BoldRedeemAmounts {
        uint256 A;
        uint256 B;
        uint256 C;
    }

    struct CorrespondingETH {
        uint256 A;
        uint256 B;
        uint256 C;
    }

    function testRedemptionIsInOrderOfInterestRate() public {
        (uint256 coll,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);
        uint256 debt_C = troveManager.getTroveEntireDebt(troveIDs.C);
        uint256 debt_D = troveManager.getTroveEntireDebt(troveIDs.D);

        // E redeems enough to fully redeem A and partially from B
        uint256 redeemAmount_1 = (debt_A - BOLD_GAS_COMPENSATION) + (debt_B - BOLD_GAS_COMPENSATION) / 2;
        redeem(E, redeemAmount_1);

        // Check A's Trove debt equals gas comp
        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), BOLD_GAS_COMPENSATION);
        // Check B coll and debt reduced
        assertLt(troveManager.getTroveEntireDebt(troveIDs.B), debt_B);
        assertLt(troveManager.getTroveEntireColl(troveIDs.B), coll);
        // Check C coll and debt unchanged
        assertEq(troveManager.getTroveEntireDebt(troveIDs.C), debt_C);
        assertEq(troveManager.getTroveEntireColl(troveIDs.C), coll);
        // Check D coll and debt unchanged
        assertEq(troveManager.getTroveEntireDebt(troveIDs.D), debt_D);
        assertEq(troveManager.getTroveEntireColl(troveIDs.D), coll);

        // E redeems enough to fully redeem B and partially redeem C
        uint256 redeemAmount_2 = (debt_B - BOLD_GAS_COMPENSATION) / 2 + (debt_C - BOLD_GAS_COMPENSATION) / 2;
        redeem(E, redeemAmount_2);

        // Check B's Trove debt equals gas comp
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), BOLD_GAS_COMPENSATION);
        // Check C coll and debt reduced
        assertLt(troveManager.getTroveEntireDebt(troveIDs.C), debt_C);
        assertLt(troveManager.getTroveEntireColl(troveIDs.C), coll);
        // Check D coll and debt unchanged
        assertEq(troveManager.getTroveEntireDebt(troveIDs.D), debt_D);
        assertEq(troveManager.getTroveEntireColl(troveIDs.D), coll);
    }

    // - Troves can be redeemed down to gas comp
    function testFullRedemptionDoesntCloseTroves() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);

        // E redeems enough to fully redeem A and B
        uint256 redeemAmount_1 = (debt_A - BOLD_GAS_COMPENSATION) + (debt_B - BOLD_GAS_COMPENSATION);
        redeem(E, redeemAmount_1);

        // Check A and B still open
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.A)), uint8(ITroveManager.Status.unredeemable));
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.B)), uint8(ITroveManager.Status.unredeemable));
    }

    function testFullRedemptionLeavesTrovesWithDebtEqualToGasComp() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);

        // E redeems enough to fully redeem A and B
        uint256 redeemAmount_1 = (debt_A - BOLD_GAS_COMPENSATION) + (debt_B - BOLD_GAS_COMPENSATION);
        redeem(E, redeemAmount_1);

        // Check A and B's Trove debt equals gas comp
        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), BOLD_GAS_COMPENSATION);
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), BOLD_GAS_COMPENSATION);
    }

    function testFullRedemptionSkipsTrovesAtGasCompDebt() public {
        (uint256 coll,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);
        uint256 debt_C = troveManager.getTroveEntireDebt(troveIDs.C);

        // E redeems enough to fully redeem A and B
        uint256 redeemAmount_1 = (debt_A - BOLD_GAS_COMPENSATION) + (debt_B - BOLD_GAS_COMPENSATION);
        redeem(E, redeemAmount_1);

        // Check A and B's Trove debt equals gas comp
        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), BOLD_GAS_COMPENSATION);
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), BOLD_GAS_COMPENSATION);

        // E redeems again, enough to partially redeem C
        uint256 redeemAmount_2 = debt_C / 2;
        redeem(E, redeemAmount_2);

        // Check A and B still open with debt == gas comp
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.A)), uint8(ITroveManager.Status.unredeemable));
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.B)), uint8(ITroveManager.Status.unredeemable));
        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), BOLD_GAS_COMPENSATION);
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), BOLD_GAS_COMPENSATION);

        // Check C's debt and coll reduced
        assertLt(troveManager.getTroveEntireDebt(troveIDs.C), debt_C);
        assertLt(troveManager.getTroveEntireColl(troveIDs.C), coll);
    }

    // - Accrued Trove interest contributes to redeemed debt of a redeemed trove

    function testRedemptionIncludesAccruedTroveInterest() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        // Fast-forward to generate interest
        vm.warp(block.timestamp + 1 days);

        LatestTroveData memory trove_A = troveManager.getLatestTroveData(troveIDs.A);
        assertGt(trove_A.accruedInterest, 0);
        assertEq(trove_A.redistBoldDebtGain, 0);

        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);

        // E redeems, enough to fully redeem A (recorded debt + interest - gas comp), without touching the next trove B
        uint256 redeemAmount = troveManager.getTroveDebt(troveIDs.A) + trove_A.accruedInterest - BOLD_GAS_COMPENSATION;
        redeem(E, redeemAmount);

        // Check A reduced down to gas comp
        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), BOLD_GAS_COMPENSATION);

        // Check B's debt unchanged
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), debt_B);
    }

    function testRedemption1TroveLeavesETHFeeInTrove() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();
        uint256 price = priceFeed.getPrice();

        // E redeems enough to partly redeem from A
        uint256 redeemAmount = troveManager.getTroveDebt(troveIDs.A) / 2;
        uint256 correspondingETH = redeemAmount * DECIMAL_PRECISION / price;
        uint256 predictedETHFee = troveManager.getEffectiveRedemptionFeeInColl(redeemAmount, price);
        assertGt(correspondingETH, 0);
        assertGt(predictedETHFee, 0);

        // Expect Trove's coll reduced by the ETH corresponding to the BOLD redeemed (less the ETH fee)
        uint256 expectedRemainingColl = troveManager.getTroveEntireColl(troveIDs.B) - correspondingETH + predictedETHFee;
        assertGt(expectedRemainingColl, 0);

        redeem(E, redeemAmount);

        // Check A reduced down to gas comp
        assertEq(troveManager.getTroveEntireColl(troveIDs.A), expectedRemainingColl);
    }

    function testRedemption1TroveLeavesETHFeeInActivePool() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();
        uint256 price = priceFeed.getPrice();

        // E redeems enough to partly redeem from A
        uint256 redeemAmount = troveManager.getTroveDebt(troveIDs.A) / 2;
        uint256 correspondingETH = redeemAmount * DECIMAL_PRECISION / price;
        uint256 predictedETHFee = troveManager.getEffectiveRedemptionFeeInColl(redeemAmount, price);
        assertGt(correspondingETH, 0);
        assertGt(predictedETHFee, 0);
        // Expect Active pool to reduce by the ETH removed from the Trove
        uint256 expectedETHDelta = correspondingETH - predictedETHFee;
        assertGt(expectedETHDelta, 0);

        uint256 activePoolBalBefore = WETH.balanceOf(address(activePool));
        uint256 activePoolETHTrackerBefore = activePool.getETHBalance();
        assertGt(activePoolBalBefore, 0);
        assertGt(activePoolETHTrackerBefore, 0);

        redeem(E, redeemAmount);

        // Check Active Pool ETH reduced correctly
        assertEq(WETH.balanceOf(address(activePool)), activePoolBalBefore - expectedETHDelta);
        assertEq(activePool.getETHBalance(), activePoolETHTrackerBefore - expectedETHDelta);
    }

    function testRedemption3TroveLeavesETHFeesInTroves() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();
        uint256 price = priceFeed.getPrice();

        BoldRedeemAmounts memory boldRedeemAmounts;
        CorrespondingETH memory correspondingETH;

        boldRedeemAmounts.A = troveManager.getTroveDebt(troveIDs.A) - BOLD_GAS_COMPENSATION;
        boldRedeemAmounts.B = troveManager.getTroveDebt(troveIDs.B) - BOLD_GAS_COMPENSATION;
        boldRedeemAmounts.C = (troveManager.getTroveDebt(troveIDs.C) - BOLD_GAS_COMPENSATION) / 2;
        uint256 totalBoldRedeemAmount = boldRedeemAmounts.A + boldRedeemAmounts.B + boldRedeemAmounts.C;

        correspondingETH.A = boldRedeemAmounts.A * DECIMAL_PRECISION / price;
        correspondingETH.B = boldRedeemAmounts.B * DECIMAL_PRECISION / price;
        correspondingETH.C = boldRedeemAmounts.C * DECIMAL_PRECISION / price;

        uint256 redemptionFeePct = collateralRegistry.getEffectiveRedemptionFeeInBold(totalBoldRedeemAmount)
            * DECIMAL_PRECISION / totalBoldRedeemAmount;

        uint256 predictedETHFee_A = correspondingETH.A * redemptionFeePct / DECIMAL_PRECISION;
        uint256 predictedETHFee_B = correspondingETH.B * redemptionFeePct / DECIMAL_PRECISION;
        uint256 predictedETHFee_C = correspondingETH.C * redemptionFeePct / DECIMAL_PRECISION;

        assertGt(predictedETHFee_A, 0);
        assertGt(predictedETHFee_B, 0);
        assertGt(predictedETHFee_C, 0);

        // Expect each Trove's coll to reduce by the ETH corresponding to the bold redeemed, less the ETH fee
        uint256 expectedRemainingColl_A =
            troveManager.getTroveEntireColl(troveIDs.A) - correspondingETH.A + predictedETHFee_A;
        uint256 expectedRemainingColl_B =
            troveManager.getTroveEntireColl(troveIDs.B) - correspondingETH.B + predictedETHFee_B;
        uint256 expectedRemainingColl_C =
            troveManager.getTroveEntireColl(troveIDs.C) - correspondingETH.C + predictedETHFee_C;
        assertGt(expectedRemainingColl_A, 0);
        assertGt(expectedRemainingColl_B, 0);
        assertGt(expectedRemainingColl_C, 0);

        redeem(E, totalBoldRedeemAmount);

        assertApproxEqAbs(troveManager.getTroveEntireColl(troveIDs.A), expectedRemainingColl_A, 10);
        assertApproxEqAbs(troveManager.getTroveEntireColl(troveIDs.B), expectedRemainingColl_B, 10);
        assertApproxEqAbs(troveManager.getTroveEntireColl(troveIDs.C), expectedRemainingColl_C, 10);
    }

    function testRedemption3TroveLeavesETHFeesInActivePool() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();
        uint256 price = priceFeed.getPrice();

        BoldRedeemAmounts memory boldRedeemAmounts;

        boldRedeemAmounts.A = troveManager.getTroveDebt(troveIDs.A) - BOLD_GAS_COMPENSATION;
        boldRedeemAmounts.B = troveManager.getTroveDebt(troveIDs.B) - BOLD_GAS_COMPENSATION;
        boldRedeemAmounts.C = (troveManager.getTroveDebt(troveIDs.C) - BOLD_GAS_COMPENSATION) / 2;

        uint256 totalBoldRedeemAmount = boldRedeemAmounts.A + boldRedeemAmounts.B + boldRedeemAmounts.C;
        uint256 totalCorrespondingETH = totalBoldRedeemAmount * DECIMAL_PRECISION / price;

        uint256 redemptionFeePct = collateralRegistry.getEffectiveRedemptionFeeInBold(totalBoldRedeemAmount)
            * DECIMAL_PRECISION / totalBoldRedeemAmount;
        uint256 totalETHFee = totalCorrespondingETH * redemptionFeePct / DECIMAL_PRECISION;

        uint256 expectedETHDelta = totalCorrespondingETH - totalETHFee;
        assertGt(expectedETHDelta, 0);

        uint256 activePoolBalBefore = WETH.balanceOf(address(activePool));
        uint256 activePoolETHTrackerBefore = activePool.getETHBalance();
        assertGt(activePoolBalBefore, 0);
        assertGt(activePoolETHTrackerBefore, 0);

        redeem(E, totalBoldRedeemAmount);

        // Check Active Pool ETH reduced correctly
        assertApproxEqAbs(WETH.balanceOf(address(activePool)), activePoolBalBefore - expectedETHDelta, 30);
        assertApproxEqAbs(activePool.getETHBalance(), activePoolETHTrackerBefore - expectedETHDelta, 30);
    }

    // --- Zombie Troves ---

    function testFullyRedeemedTroveBecomesZombieTrove() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        assertEq(uint8(troveManager.getTroveStatus(troveIDs.A)), uint8(ITroveManager.Status.unredeemable));
    }

    function testTroveRedeemedToBelowMIN_NET_DEBTBecomesZombieTrove() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        assertEq(uint8(troveManager.getTroveStatus(troveIDs.B)), uint8(ITroveManager.Status.unredeemable));
    }

    function testTroveRedeemedToAboveMIN_NET_DEBTDoesNotBecomesZombieTrove() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTroveAAndHitB(troveIDs);

        assertEq(uint8(troveManager.getTroveStatus(troveIDs.C)), uint8(ITroveManager.Status.active));
    }

    function testZombieTrovesRemovedFromSortedList() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        // Check A,B,C,D in sorted list
        assertTrue(sortedTroves.contains(troveIDs.A));
        assertTrue(sortedTroves.contains(troveIDs.B));
        assertTrue(sortedTroves.contains(troveIDs.C));
        assertTrue(sortedTroves.contains(troveIDs.D));

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        // Check A, B removed from sorted list
        assertFalse(sortedTroves.contains(troveIDs.A));
        assertFalse(sortedTroves.contains(troveIDs.B));
        assertTrue(sortedTroves.contains(troveIDs.C));
        assertTrue(sortedTroves.contains(troveIDs.C));

        // Check Trove with lowest interest rate is C
        assertEq(sortedTroves.getLast(), troveIDs.C);
    }

    function testZombieTroveCantBeRedeemedFrom() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        // Get B debt before 2nd redeem
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);
        assertGt(debt_B, 0);

        uint256 redeemAmount = debt_B / 2;
        redeem(E, redeemAmount);

        // Check B's debt unchanged from redeemAmount < debt_B;
        assertEq(debt_B, troveManager.getTroveEntireDebt(troveIDs.B));

        redeemAmount = debt_B + 1;
        redeem(E, redeemAmount);

        // Check B's debt unchanged from redeemAmount > debt_B;
        assertEq(debt_B, troveManager.getTroveEntireDebt(troveIDs.B));
    }

    function testZombieTrovesCanReceiveRedistGains() public {
        uint256 interestRate_E = 5e16; // 5%
        uint256 troveDebtRequest_E = 2250e18;
        uint256 troveColl_E = 25e17;
        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        // E opens new Trove
        troveIDs.E = openTroveNoHints100pct(E, troveColl_E, troveDebtRequest_E, interestRate_E);

        // Price drops, E becomes liquidateable
        price = 1050e18;
        priceFeed.setPrice(price);

        assertFalse(troveManager.checkBelowCriticalThreshold(price));
        assertLt(troveManager.getCurrentICR(troveIDs.E, price), troveManager.MCR());

        // A liquidates E
        liquidate(A, troveIDs.E);
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.E)), uint8(ITroveManager.Status.closedByLiquidation));

        // // Check A and B have redist. gains
        assertTrue(troveManager.hasRedistributionGains(troveIDs.A));
        assertTrue(troveManager.hasRedistributionGains(troveIDs.B));
        assertTrue(troveManager.hasRedistributionGains(troveIDs.C));
    }

    function testZombieTrovesAccrueInterest() public {
        ABCDEF memory troveInterestRates;
        troveInterestRates.A = 1e17; // 10%
        troveInterestRates.B = 2e17; // 20%
        troveInterestRates.C = 3e17; // 30%
        troveInterestRates.D = 4e17; // 40%

        (,, ABCDEF memory troveIDs) = _setupForRedemption(troveInterestRates);

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        assertEq(troveManager.calcTroveAccruedInterest(troveIDs.A), 0);
        assertEq(troveManager.calcTroveAccruedInterest(troveIDs.B), 0);

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);

        // Time passes
        vm.warp(block.timestamp + 365 days);

        // Expect debts to have increased by their respective annual interest rates
        uint256 expectedDebt_A = debt_A * (1e18 + troveInterestRates.A) / 1e18; // 10% increase
        uint256 expectedDebt_B = debt_B * (1e18 + troveInterestRates.B) / 1e18; // 20% increase

        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), expectedDebt_A); // 10% increase
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), expectedDebt_B); // 20% increase
    }

    function testZombieTrovesCanAccrueInterestThatBringThemAboveMIN_DEBT() public {
        ABCDEF memory troveInterestRates;
        troveInterestRates.A = 1e17; // 10%
        troveInterestRates.B = 2e17; // 20%
        troveInterestRates.C = 3e17; // 30%
        troveInterestRates.D = 4e17; // 40%

        (,, ABCDEF memory troveIDs) = _setupForRedemption(troveInterestRates);

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        assertLt(troveManager.getTroveEntireDebt(troveIDs.B), MIN_DEBT);
        assertLt(troveManager.getTroveEntireDebt(troveIDs.B), MIN_DEBT);

        // 100 years passes
        vm.warp(block.timestamp + 36500 days);

        assertGt(troveManager.getTroveEntireDebt(troveIDs.A), MIN_DEBT);
        assertGt(troveManager.getTroveEntireDebt(troveIDs.B), MIN_DEBT);
    }

    function testZombieTrovesCanReceiveRedistGainsThatBringThemAboveMIN_DEBT() public {
        uint256 interestRate_E = 5e16; // 5%
        uint256 troveDebtRequest_E = 225000e18;
        uint256 troveColl_E = 250e18;

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        // E  opens new Trove
        uint256 troveID_E = openTroveNoHints100pct(E, troveColl_E, troveDebtRequest_E, interestRate_E);
        // openTroveNoHints100pct(F, troveColl_F, troveDebtRequest_F, interestRate_F);

        // Price drops, E becomes liquidateable
        price = 950e18;
        priceFeed.setPrice(price);

        // assertFalse(troveManager.checkBelowCriticalThreshold(price));
        assertLt(troveManager.getCurrentICR(troveID_E, price), troveManager.MCR());

        assertLt(troveManager.getTroveEntireDebt(troveIDs.A), MIN_DEBT);
        assertLt(troveManager.getTroveEntireDebt(troveIDs.B), MIN_DEBT);

        // A liquidates E
        liquidate(A, troveID_E);
        assertEq(uint8(troveManager.getTroveStatus(troveID_E)), uint8(ITroveManager.Status.closedByLiquidation));

        assertTrue(troveManager.hasRedistributionGains(troveIDs.A));
        assertTrue(troveManager.hasRedistributionGains(troveIDs.B));

        assertGt(troveManager.getTroveEntireDebt(troveIDs.A), MIN_DEBT);
        assertGt(troveManager.getTroveEntireDebt(troveIDs.B), MIN_DEBT);
    }

    // --- Borrower ops on zombie troves ---

    function testZombieBorrowerCanCloseZombieTrove() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        // E sends bold back to A and B so they can close
        transferBold(E, A, boldToken.balanceOf(E) / 2);
        transferBold(E, B, boldToken.balanceOf(E));

        assertEq(uint8(troveManager.getTroveStatus(troveIDs.A)), uint8(ITroveManager.Status.unredeemable));
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.B)), uint8(ITroveManager.Status.unredeemable));

        closeTrove(A, troveIDs.A);
        closeTrove(B, troveIDs.B);

        assertEq(uint8(troveManager.getTroveStatus(troveIDs.A)), uint8(ITroveManager.Status.closedByOwner));
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.B)), uint8(ITroveManager.Status.closedByOwner));
    }

    function testZombieBorrowerCanDrawFreshDebtToAboveMIN_NET_DEBT() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        vm.warp(block.timestamp + 1 days);

        // Calculate how far below min debt each zombie Trove is
        uint256 debtDelta_A = MIN_DEBT - troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debtDelta_B = MIN_DEBT - troveManager.getTroveEntireDebt(troveIDs.B);

        assertGt(debtDelta_A, 0);
        assertGt(debtDelta_B, 0);

        uint256 surplusDebt = 37;

        // A and B withdraw Bold from their zombie Trove
        adjustUnredeemableTrove(A, troveIDs.A, 0, false, debtDelta_A + surplusDebt, true);
        adjustUnredeemableTrove(B, troveIDs.B, 0, false, debtDelta_A + surplusDebt, true);

        // Check they are above the min debt
        assertGt(troveManager.getTroveEntireDebt(troveIDs.A), MIN_DEBT);
        assertGt(troveManager.getTroveEntireDebt(troveIDs.B), MIN_DEBT);
    }

    function testZombieTroveDrawingFreshDebtToAboveMIN_NET_DEBTChangesStatusToActive() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        vm.warp(block.timestamp + 1 days);

        // Calculate how far below min debt each zombie Trove is
        uint256 debtDelta_A = MIN_DEBT - troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debtDelta_B = MIN_DEBT - troveManager.getTroveEntireDebt(troveIDs.B);

        assertGt(debtDelta_A, 0);
        assertGt(debtDelta_B, 0);

        uint256 surplusDebt = 37;

        // A and B withdraw Bold from their zombie Trove
        adjustUnredeemableTrove(A, troveIDs.A, 0, false, debtDelta_A + surplusDebt, true);
        adjustUnredeemableTrove(B, troveIDs.B, 0, false, debtDelta_A + surplusDebt, true);

        // Check they are above the min debt
        assertGt(troveManager.getTroveEntireDebt(troveIDs.A), MIN_DEBT);
        assertGt(troveManager.getTroveEntireDebt(troveIDs.B), MIN_DEBT);

        // Check A and B now have active status
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.A)), uint8(ITroveManager.Status.active));
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.B)), uint8(ITroveManager.Status.active));
    }

    function testZombieTroveDrawingFreshDebtToAboveMIN_NET_DEBTInsertsItToSortedList() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        vm.warp(block.timestamp + 1 days);

        // Calculate how far below min debt each zombie Trove is
        uint256 debtDelta_A = MIN_DEBT - troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debtDelta_B = MIN_DEBT - troveManager.getTroveEntireDebt(troveIDs.B);

        assertGt(debtDelta_A, 0);
        assertGt(debtDelta_B, 0);

        uint256 surplusDebt = 37;

        // Check A and B are not in SortedTroves
        assertFalse(sortedTroves.contains(troveIDs.A));
        assertFalse(sortedTroves.contains(troveIDs.B));

        // A and B withdraw Bold from their zombie Trove
        adjustUnredeemableTrove(A, troveIDs.A, 0, false, debtDelta_A + surplusDebt, true);
        adjustUnredeemableTrove(B, troveIDs.B, 0, false, debtDelta_A + surplusDebt, true);

        // Check they are above the min debt
        assertGt(troveManager.getTroveEntireDebt(troveIDs.A), MIN_DEBT);
        assertGt(troveManager.getTroveEntireDebt(troveIDs.B), MIN_DEBT);

        // Check A and B are now in SortedTroves
        assertTrue(sortedTroves.contains(troveIDs.A));
        assertTrue(sortedTroves.contains(troveIDs.B));
    }

    function testZombieBorrowerDrawsFreshDebtToAboveMIN_NET_DEBTReducesPendingInterestTo0() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.calcTroveAccruedInterest(troveIDs.A), 0);
        assertGt(troveManager.calcTroveAccruedInterest(troveIDs.B), 0);

        // Calculate how far below min debt each zombie Trove is
        uint256 debtDelta_A = MIN_DEBT - troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debtDelta_B = MIN_DEBT - troveManager.getTroveEntireDebt(troveIDs.B);

        assertGt(debtDelta_A, 0);
        assertGt(debtDelta_B, 0);

        uint256 surplusDebt = 37;

        // A and B withdraw Bold from their zombie Trove
        adjustUnredeemableTrove(A, troveIDs.A, 0, false, debtDelta_A + surplusDebt, true);
        adjustUnredeemableTrove(B, troveIDs.B, 0, false, debtDelta_A + surplusDebt, true);

        // Check they are above the min debt
        assertGt(troveManager.getTroveEntireDebt(troveIDs.A), MIN_DEBT);
        assertGt(troveManager.getTroveEntireDebt(troveIDs.B), MIN_DEBT);

        // Check accrued interest reduced to 0
        assertEq(troveManager.calcTroveAccruedInterest(troveIDs.A), 0);
        assertEq(troveManager.calcTroveAccruedInterest(troveIDs.B), 0);
    }

    function testZombieTroveBorrowerCanNotDrawFreshDebtToBelowMIN_NET_DEBT() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        uint256 debtDeficiency = 37;

        // Calculate how much to borrow to get to *just* below min debt
        (uint256 borrow_A,) = findAmountToBorrowWithAdjustTrove(troveIDs.A, MIN_DEBT - debtDeficiency);
        (uint256 borrow_B,) = findAmountToBorrowWithAdjustTrove(troveIDs.B, MIN_DEBT - debtDeficiency);

        // A and B attempt to withdraw Bold, but not enough
        vm.expectRevert("BorrowerOps: Trove's debt must be greater than minimum");
        this.adjustUnredeemableTrove(A, troveIDs.A, 0, false, borrow_A, true);

        vm.expectRevert("BorrowerOps: Trove's debt must be greater than minimum");
        this.adjustUnredeemableTrove(B, troveIDs.B, 0, false, borrow_B, true);
    }

    function testZombieTroveBorrowerCanNotRepayDebt() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        uint256 debtRepayment = 1;

        // E sends Bold back to A and B
        transferBold(E, A, boldToken.balanceOf(E) / 2);
        transferBold(E, B, boldToken.balanceOf(E));

        vm.startPrank(A);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.repayBold(troveIDs.A, debtRepayment);
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.repayBold(troveIDs.B, debtRepayment);
        vm.stopPrank();
    }

    function testZombieTroveBorrowerCanNotUseNormalWithdrawBoldFunction() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        uint256 debtWithdrawal = 1;

        vm.startPrank(A);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.withdrawBold(troveIDs.A, debtWithdrawal, 0);
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.withdrawBold(troveIDs.B, debtWithdrawal, 0);
        vm.stopPrank();
    }

    function testZombieTroveBorrowerCanNotUseNormalAdjustTroveFunction() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        uint256 debtWithdrawal = 1;

        vm.expectRevert("BorrowerOps: Trove does not have active status");
        this.adjustTrove100pct(A, troveIDs.A, 0, debtWithdrawal, false, true);

        vm.expectRevert("BorrowerOps: Trove does not have active status");
        this.adjustTrove100pct(B, troveIDs.B, 0, debtWithdrawal, false, true);
    }

    function testZombieTroveBorrowerCanNotAddColl() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        uint256 collTopUp = 1e18;

        // A attempts to add coll
        vm.startPrank(A);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.addColl(troveIDs.A, collTopUp);
        vm.stopPrank();

        // B attempts to repay and can't (since would leave Trove at debt  < MIN_NET_DEBT)
        vm.startPrank(B);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.addColl(troveIDs.B, collTopUp);
        vm.stopPrank();
    }

    function testZombieTroveBorrowerCanNotChangeInterestRate() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        uint256 newInterestRate = 37e16;

        // A and B attempt to change interes rates
        vm.startPrank(A);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.adjustTroveInterestRate(troveIDs.A, newInterestRate, troveIDs.A, troveIDs.A, 0);
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.adjustTroveInterestRate(troveIDs.B, newInterestRate, troveIDs.B, troveIDs.B, 0);
        vm.stopPrank();
    }

    function testZombieTroveAccruedInterestCanBePermissionlesslyApplied() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        // fast-forward time such that trove is Stale
        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(troveIDs.A));

        assertGt(troveManager.calcTroveAccruedInterest(troveIDs.A), 0);
        assertGt(troveManager.calcTroveAccruedInterest(troveIDs.B), 0);

        // E applies interest on A and B's Troves
        applyTroveInterestPermissionless(E, troveIDs.A);
        applyTroveInterestPermissionless(E, troveIDs.B);

        assertEq(troveManager.calcTroveAccruedInterest(troveIDs.A), 0);
        assertEq(troveManager.calcTroveAccruedInterest(troveIDs.B), 0);
    }

    function testZombieTroveCanBeLiquidated() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        uint256 interestRate_E = 1e18; // 100%
        uint256 troveDebtRequest_E = 200000e18;
        uint256 troveColl_E = 25000e18;
        // E  opens new Trove and deposits to SP
        openTroveNoHints100pct(E, troveColl_E, troveDebtRequest_E, interestRate_E);
        makeSPDepositAndClaim(E, boldToken.balanceOf(E));
        assertGt(stabilityPool.getTotalBoldDeposits(), troveManager.getTroveEntireDebt(troveIDs.B));

        // Price drops, B becomes liquidateable
        uint256 price = 10e18;
        priceFeed.setPrice(price);

        // assertFalse(troveManager.checkBelowCriticalThreshold(price));
        assertLt(troveManager.getCurrentICR(troveIDs.B, price), MCR);

        assertEq(uint8(troveManager.getTroveStatus(troveIDs.B)), uint8(ITroveManager.Status.unredeemable));

        // E liquidates B
        liquidate(E, troveIDs.B);
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.B)), uint8(ITroveManager.Status.closedByLiquidation));
    }

    // TODO: tests borrower for combined adjustments - debt changes and coll add/withdrawals.
    // Borrower should only be able to close OR leave Trove at >= min net debt.
}
