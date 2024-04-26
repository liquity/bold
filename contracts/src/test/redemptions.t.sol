pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract Redemptions is DevTestSetup {
    function testRedemptionIsInOrderOfInterestRate() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);
        uint256 debt_C = troveManager.getTroveEntireDebt(troveIDs.C);
        uint256 debt_D = troveManager.getTroveEntireDebt(troveIDs.D);

        // E redeems enough to fully redeem A and partially from B
        uint256 redeemAmount_1 = debt_A + debt_B / 2;
        redeem(E, redeemAmount_1);

        // Check A's Trove debt equals gas comp
        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), troveManager.BOLD_GAS_COMPENSATION());
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
        uint256 redeemAmount_2 = debt_B / 2 + debt_C / 2;
        redeem(E, redeemAmount_2);

        // Check A's Trove debt equals gas comp
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), troveManager.BOLD_GAS_COMPENSATION());
        // Check C coll and debt reduced
        assertLt(troveManager.getTroveEntireDebt(troveIDs.C), debt_C);
        assertLt(troveManager.getTroveEntireColl(troveIDs.C), coll);
        // Check D coll and debt unchanged
        assertEq(troveManager.getTroveEntireDebt(troveIDs.D), debt_D);
        assertEq(troveManager.getTroveEntireColl(troveIDs.D), coll);
    }

    // - Troves can be redeemed down to gas comp
    function testFullRedemptionDoesntCloseTroves() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);

        // E redeems enough to fully redeem A and B
        uint256 redeemAmount_1 = debt_A + debt_B;
        redeem(E, redeemAmount_1);

        // Check A and B still open
        assertEq(troveManager.getTroveStatus(troveIDs.A), 5); // Status 'unredeemable'
        assertEq(troveManager.getTroveStatus(troveIDs.B), 5); // Status 'unredeemable'
    }

    function testFullRedemptionLeavesTrovesWithDebtEqualToGasComp() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);

        // E redeems enough to fully redeem A and B
        uint256 redeemAmount_1 = debt_A + debt_B;
        redeem(E, redeemAmount_1);

        // Check A and B's Trove debt equals gas comp
        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), troveManager.BOLD_GAS_COMPENSATION());
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), troveManager.BOLD_GAS_COMPENSATION());
    }

    function testFullRedemptionSkipsTrovesAtGasCompDebt() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);
        uint256 debt_C = troveManager.getTroveEntireDebt(troveIDs.C);

        // E redeems enough to fully redeem A and B
        uint256 redeemAmount_1 = debt_A + debt_B;
        redeem(E, redeemAmount_1);

        // Check A and B's Trove debt equals gas comp
        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), troveManager.BOLD_GAS_COMPENSATION());
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), troveManager.BOLD_GAS_COMPENSATION());

        // E redeems again, enough to partially redeem C
        uint256 redeemAmount_2 = debt_C / 2;
        redeem(E, redeemAmount_2);

        // Check A and B still open with debt == gas comp
        assertEq(troveManager.getTroveStatus(troveIDs.A), 5); // Status 'unredeemable'
        assertEq(troveManager.getTroveStatus(troveIDs.B), 5); // Status 'unredeemable'
        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), troveManager.BOLD_GAS_COMPENSATION());
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), troveManager.BOLD_GAS_COMPENSATION());

        // Check C's debt and coll reduced
        assertLt(troveManager.getTroveEntireDebt(troveIDs.C), debt_C);
        assertLt(troveManager.getTroveEntireColl(troveIDs.C), coll);
    }

    // - Accrued Trove interest contributes to redee into debt of a redeemed trove

    function testRedemptionIncludesAccruedTroveInterest() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        // Fast-forward to generate interest
        vm.warp(block.timestamp + 1 days);

        (,, uint256 redistDebtGain_A,, uint256 accruedInterest_A) =
            troveManager.getEntireDebtAndColl(troveIDs.A);
        assertGt(accruedInterest_A, 0);
        assertEq(redistDebtGain_A, 0);

        troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);

        // E redeems again, enough to fully redeem A (recorded debt + interest - gas comp), without touching the next trove B
        uint256 redeemAmount =
            troveManager.getTroveDebt(troveIDs.A) + accruedInterest_A - troveManager.BOLD_GAS_COMPENSATION();
        redeem(E, redeemAmount);

        // Check A reduced down to gas comp
        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), troveManager.BOLD_GAS_COMPENSATION());

        // Check B's debt unchanged
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), debt_B);
    }

    // --- Zombie Troves ---

    function testFullyRedeemedTroveBecomesZombieTrove() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        assertEq(troveManager.getTroveStatus(troveIDs.A), 5); // Status 5 - 'unredeemable'
    }

    function testTroveRedeemedToBelowMinNetDebtBecomesZombieTrove() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        assertEq(troveManager.getTroveStatus(troveIDs.B), 5); // Status 5 - 'unredeemable'
    }

    function testTroveRedeemedToAboveMinNetDebtDoesNotBecomesZombieTrove() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTroveAAndHitB(troveIDs);

        assertEq(troveManager.getTroveStatus(troveIDs.C), 1); // Status 1 - 'active'
    }

    function testZombieTrovesRemovedFromSortedList() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

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
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        // Get B debt before 2nd redeem
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);
        assertGt(troveManager.getTroveEntireDebt(troveIDs.B), 0);

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

        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        // E opens new Trove
        troveIDs.E = openTroveNoHints100pctMaxFee(E, troveColl_E, troveDebtRequest_E, interestRate_E);

        // Price drops, E becomes liquidateable
        price = 1050e18;
        priceFeed.setPrice(price);

        assertFalse(troveManager.checkRecoveryMode(price));
        assertLt(troveManager.getCurrentICR(troveIDs.E, price), troveManager.MCR());

        // A liquidates E
        liquidate(A, troveIDs.E);
        assertEq(troveManager.getTroveStatus(troveIDs.E), 3); // Status 3 - closed by liquidation

        // // Check A and B have redist. gains
        assertTrue(troveManager.hasRedistributionGains(troveIDs.A));
        assertTrue(troveManager.hasRedistributionGains(troveIDs.B));
        assertTrue(troveManager.hasRedistributionGains(troveIDs.C));
    }

    function testZombieTrovesAccrueInterest() public {
        TroveInterestRates memory troveInterestRates;
        troveInterestRates.A = 1e17; // 10%
        troveInterestRates.B = 2e17; // 20%
        troveInterestRates.C = 3e17; // 30%
        troveInterestRates.D = 4e17; // 40%

        ( , , TroveIDs memory troveIDs) = _setupForRedemption(troveInterestRates);

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
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B),  expectedDebt_B); // 20% increase
    }

    function testZombieTrovesCanAccrueInterestThatBringThemAboveMinNetDebt() public {
        TroveInterestRates memory troveInterestRates;
        troveInterestRates.A = 1e17; // 10%
        troveInterestRates.B = 2e17; // 20%
        troveInterestRates.C = 3e17; // 30%
        troveInterestRates.D = 4e17; // 40%

        ( , , TroveIDs memory troveIDs) = _setupForRedemption(troveInterestRates);

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        assertLt(troveManager.getTroveEntireDebt(troveIDs.A), troveManager.MIN_NET_DEBT()); 
        assertLt(troveManager.getTroveEntireDebt(troveIDs.B),  troveManager.MIN_NET_DEBT());

        // 100 years passes
        vm.warp(block.timestamp + 36500 days);

        assertGt(troveManager.getTroveEntireDebt(troveIDs.A), troveManager.MIN_NET_DEBT()); 
        assertGt(troveManager.getTroveEntireDebt(troveIDs.B),  troveManager.MIN_NET_DEBT());
    }

    function testZombieTrovesCanReceiveRedistGainsThatBringThemAboveMinNetDebt() public {
        uint256 interestRate_E = 5e16; // 5%
        uint256 troveDebtRequest_E = 225000e18;
        uint256 troveColl_E = 250e18;

        uint256 price = 2000e18;
        priceFeed.setPrice(price);

        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        // E  opens new Trove
        uint256 troveID_E = openTroveNoHints100pctMaxFee(E, troveColl_E, troveDebtRequest_E, interestRate_E);
        // openTroveNoHints100pctMaxFee(F, troveColl_F, troveDebtRequest_F, interestRate_F);

        // Price drops, E becomes liquidateable
        price = 950e18;
        priceFeed.setPrice(price);

        // assertFalse(troveManager.checkRecoveryMode(price));
        assertLt(troveManager.getCurrentICR(troveID_E, price), troveManager.MCR());

        assertLt(troveManager.getTroveEntireDebt(troveIDs.A), troveManager.MIN_NET_DEBT()); 
        assertLt(troveManager.getTroveEntireDebt(troveIDs.B),  troveManager.MIN_NET_DEBT());

       // A liquidates E
        liquidate(A, troveID_E);
        assertEq(troveManager.getTroveStatus(troveID_E), 3); // Status 3 - closed by liquidation

        assertTrue(troveManager.hasRedistributionGains(troveIDs.A));
        assertTrue(troveManager.hasRedistributionGains(troveIDs.B));

        assertGt(troveManager.getTroveEntireDebt(troveIDs.A), troveManager.MIN_NET_DEBT());
        assertGt(troveManager.getTroveEntireDebt(troveIDs.B),  troveManager.MIN_NET_DEBT());
    }

    // --- Borrower ops on zombie troves ---

    function testZombieBorrowerCanCloseZombieTrove() public {
     (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        // E sends bold back to A and B so they can close
        transferBold(E, A, boldToken.balanceOf(E) / 2);
        transferBold(E, B, boldToken.balanceOf(E));

        assertEq(troveManager.getTroveStatus(troveIDs.A), 5); // Status 5 - 'unredeemable'
        assertEq(troveManager.getTroveStatus(troveIDs.B), 5); // Status 5 - 'unredeemable'

        closeTrove(A, troveIDs.A); 
        closeTrove(B, troveIDs.B); 

        assertEq(troveManager.getTroveStatus(troveIDs.A), 2); // Status 2 - 'closed by owner'
        assertEq(troveManager.getTroveStatus(troveIDs.B), 2); // Status 2 - 'closed by owner'
    }

    function testZombieBorrowerCanDrawFreshDebtToAboveMinNetDebt() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        vm.warp(block.timestamp + 1 days);

        // Calculate how far below min net debt each zombie Trove is
        uint256 debtDelta_A = minNetDebt - (troveManager.getTroveEntireDebt(troveIDs.A) - boldGasComp);
        uint256 debtDelta_B = minNetDebt - (troveManager.getTroveEntireDebt(troveIDs.B) - boldGasComp);

        assertGt(debtDelta_A, 0);
        assertGt(debtDelta_B, 0);

        uint256 surplusDebt = 37;

        // A and B withdraw Bold from their zombie Trove
        vm.startPrank(A);
        borrowerOperations.adjustUnredeemableTrove(
            troveIDs.A,
            1e18,
            0,
            false,
            debtDelta_A + surplusDebt,
            true,
            troveIDs.A,
            troveIDs.A
        );
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.adjustUnredeemableTrove(
            troveIDs.B,
            1e18,
            0,
            false,
            debtDelta_A + surplusDebt,
            true,
            troveIDs.B,
            troveIDs.B
        );
        vm.stopPrank();

        // Check they are above the min net debt
        assertGt(troveManager.getTroveEntireDebt(troveIDs.A) - boldGasComp, minNetDebt);
        assertGt(troveManager.getTroveEntireDebt(troveIDs.B) - boldGasComp, minNetDebt);
    }

    function testZombieTroveDrawingFreshDebtToAboveMinNetDebtChangesStatusToActive() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        vm.warp(block.timestamp + 1 days);

        // Calculate how far below min net debt each zombie Trove is
        uint256 debtDelta_A = minNetDebt - (troveManager.getTroveEntireDebt(troveIDs.A) - boldGasComp);
        uint256 debtDelta_B = minNetDebt - (troveManager.getTroveEntireDebt(troveIDs.B) - boldGasComp);

        assertGt(debtDelta_A, 0);
        assertGt(debtDelta_B, 0);

        uint256 surplusDebt = 37;

        // A and B withdraw Bold from their zombie Trove
        vm.startPrank(A);
        borrowerOperations.adjustUnredeemableTrove(
            troveIDs.A,
            1e18,
            0,
            false,
            debtDelta_A + surplusDebt,
            true,
            troveIDs.A,
            troveIDs.A
        );
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.adjustUnredeemableTrove(
            troveIDs.B,
            1e18,
            0,
            false,
            debtDelta_A + surplusDebt,
            true,
            troveIDs.B,
            troveIDs.B
        );
        vm.stopPrank();

        // Check they are above the min net debt
        assertGt(troveManager.getTroveEntireDebt(troveIDs.A) - boldGasComp, minNetDebt);
        assertGt(troveManager.getTroveEntireDebt(troveIDs.B) - boldGasComp, minNetDebt);

        // Check A and B now have active status
        assertEq(troveManager.getTroveStatus(troveIDs.A), 1);
        assertEq(troveManager.getTroveStatus(troveIDs.B), 1);
    }

    function testZombieTroveDrawingFreshDebtToAboveMinNetDebtInsertsItToSortedList() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        vm.warp(block.timestamp + 1 days);

        // Calculate how far below min net debt each zombie Trove is
        uint256 debtDelta_A = minNetDebt - (troveManager.getTroveEntireDebt(troveIDs.A) - boldGasComp);
        uint256 debtDelta_B = minNetDebt - (troveManager.getTroveEntireDebt(troveIDs.B) - boldGasComp);

        assertGt(debtDelta_A, 0);
        assertGt(debtDelta_B, 0);

        uint256 surplusDebt = 37;

        // Check A and B are not in SortedTroves
        assertFalse(sortedTroves.contains(troveIDs.A));
        assertFalse(sortedTroves.contains(troveIDs.B));

        // A and B withdraw Bold from their zombie Trove
        vm.startPrank(A);
        borrowerOperations.adjustUnredeemableTrove(
            troveIDs.A,
            1e18,
            0,
            false,
            debtDelta_A + surplusDebt,
            true,
            troveIDs.A,
            troveIDs.A
        );
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.adjustUnredeemableTrove(
            troveIDs.B,
            1e18,
            0,
            false,
            debtDelta_A + surplusDebt,
            true,
            troveIDs.B,
            troveIDs.B
        );
        vm.stopPrank();

        // Check they are above the min net debt
        assertGt(troveManager.getTroveEntireDebt(troveIDs.A) - boldGasComp, minNetDebt);
        assertGt(troveManager.getTroveEntireDebt(troveIDs.B) - boldGasComp, minNetDebt);

        // Check A and B are now in SortedTroves
        assertTrue(sortedTroves.contains(troveIDs.A));
        assertTrue(sortedTroves.contains(troveIDs.B));
    }

    function testZombieBorrowerDrawsFreshDebtToAboveMinNetDebtReducesPendingInterestTo0() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.calcTroveAccruedInterest(troveIDs.A), 0);
        assertGt(troveManager.calcTroveAccruedInterest(troveIDs.B), 0);

        // Calculate how far below min net debt each zombie Trove is
        uint256 debtDelta_A = minNetDebt - (troveManager.getTroveEntireDebt(troveIDs.A) - boldGasComp);
        uint256 debtDelta_B = minNetDebt - (troveManager.getTroveEntireDebt(troveIDs.B) - boldGasComp);

        assertGt(debtDelta_A, 0);
        assertGt(debtDelta_B, 0);

        uint256 surplusDebt = 37;

        // A and B withdraw Bold from their zombie Trove
        vm.startPrank(A);
        borrowerOperations.adjustUnredeemableTrove(
            troveIDs.A,
            1e18,
            0,
            false,
            debtDelta_A + surplusDebt,
            true,
            troveIDs.A,
            troveIDs.A
        );
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.adjustUnredeemableTrove(
            troveIDs.B,
            1e18,
            0,
            false,
            debtDelta_A + surplusDebt,
            true,
            troveIDs.B,
            troveIDs.B
        );
        vm.stopPrank();

        // Check they are above the min net debt
        assertGt(troveManager.getTroveEntireDebt(troveIDs.A) - boldGasComp, minNetDebt);
        assertGt(troveManager.getTroveEntireDebt(troveIDs.B) - boldGasComp, minNetDebt);

        // Check accrued interest reduced to 0
        assertEq(troveManager.calcTroveAccruedInterest(troveIDs.A), 0);
        assertEq(troveManager.calcTroveAccruedInterest(troveIDs.B), 0);
    }

    function testZombieTroveBorrowerCanNotDrawFreshDebtToBelowMinNetDebt() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        // Calculate how far below min net debt each zombie Trove is
        uint256 debtDelta_A = minNetDebt - (troveManager.getTroveEntireDebt(troveIDs.A) - boldGasComp);
        uint256 debtDelta_B = minNetDebt - (troveManager.getTroveEntireDebt(troveIDs.B) - boldGasComp);

        console.log(debtDelta_A, "debtDelta_A");

        assertGt(debtDelta_A, 0);
        assertGt(debtDelta_B, 0);

        uint256 debtDeficiency = 37;

        // A and B attempt to withdraw Bold, but not enough
        vm.startPrank(A);
        vm.expectRevert("BorrowerOps: Trove's net debt must be greater than minimum");
        borrowerOperations.adjustUnredeemableTrove(
            troveIDs.A,
            1e18,
            0,
            false,
            debtDelta_A - debtDeficiency,
            true,
            troveIDs.A,
            troveIDs.A
        );
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("BorrowerOps: Trove's net debt must be greater than minimum");
        borrowerOperations.adjustUnredeemableTrove(
            troveIDs.B,
            1e18,
            0,
            false,
            debtDelta_B - debtDeficiency,
            true,
            troveIDs.B,
            troveIDs.B
        );
        vm.stopPrank();
    }

    function testZombieTroveBorrowerCanNotRepayDebt() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

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
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        uint256 debtWithdrawal = 1;

        vm.startPrank(A);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.withdrawBold(troveIDs.A, 1e18, debtWithdrawal);
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.withdrawBold(troveIDs.B, 1e18, debtWithdrawal);
        vm.stopPrank();
    }

    function testZombieTroveBorrowerCanNotUseNormalAdjustTroveFunction() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        uint256 debtWithdrawal = 1;

        vm.startPrank(A);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.adjustTrove(
            troveIDs.A,
            1e18,
            0,
            false,
            debtWithdrawal,
            true
        );
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.adjustTrove(
            troveIDs.B,
            1e18,
            0,
            false,
            debtWithdrawal,
            true
        );
        vm.stopPrank();
    }

    function testZombieTroveBorrowerCanNotAddColl() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

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
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        uint256 newInterestRate = 37e16;

        // A and B attempt to change interes rates
        vm.startPrank(A);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.adjustTroveInterestRate(troveIDs.A, newInterestRate, troveIDs.A, troveIDs.A);
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("BorrowerOps: Trove does not have active status");
        borrowerOperations.adjustTroveInterestRate(troveIDs.B, newInterestRate, troveIDs.B, troveIDs.B);
        vm.stopPrank();
    } 

    function testZombieTroveAccruedInterestCanBePermissionlesslyApplied() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        uint256 newInterestRate = 37e16;

        // fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
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
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemptionAscendingInterest();

        _redeemAndCreateZombieTrovesAAndB(troveIDs);

        uint256 interestRate_E = 1e18; // 100%
        uint256 troveDebtRequest_E = 200000e18;
        uint256 troveColl_E = 25000e18;
        // E  opens new Trove and deposits to SP
        openTroveNoHints100pctMaxFee(E, troveColl_E, troveDebtRequest_E, interestRate_E);
        makeSPDeposit(E, boldToken.balanceOf(E));
        assertGt(stabilityPool.getTotalBoldDeposits(), troveManager.getTroveEntireDebt(troveIDs.B));

        // Price drops, B becomes liquidateable
        uint256 price = 100e18;
        priceFeed.setPrice(price);

        // assertFalse(troveManager.checkRecoveryMode(price));
        assertLt(troveManager.getCurrentICR(troveIDs.B, price), troveManager.MCR());

        assertEq(troveManager.getTroveStatus(troveIDs.B), 5);        

        // E liquidates B
        liquidate(E, troveIDs.B);
        assertEq(troveManager.getTroveStatus(troveIDs.B), 3); // Status 3 - closed by liquidation
    }   

    // TODO: tests borrower for combined adjustments - debt changes and coll add/withdrawals.
    // Borrower should only be able to close OR leave Trove at >= min net debt.    
}
