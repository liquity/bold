pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract Redemptions is DevTestSetup {
    function testRedemptionIsInOrderOfInterestRate() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemption();

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
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemption();

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);

        // E redeems enough to fully redeem A and B
        uint256 redeemAmount_1 = debt_A + debt_B;
        redeem(E, redeemAmount_1);

        // Check A and B still open
        assertEq(troveManager.getTroveStatus(troveIDs.A), 1); // Status active
        assertEq(troveManager.getTroveStatus(troveIDs.B), 1); // Status active
    }

    function testFullRedemptionLeavesTrovesWithDebtEqualToGasComp() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemption();

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
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemption();

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
        assertEq(troveManager.getTroveStatus(troveIDs.A), 1); // Status active
        assertEq(troveManager.getTroveStatus(troveIDs.B), 1); // Status active
        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), troveManager.BOLD_GAS_COMPENSATION());
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), troveManager.BOLD_GAS_COMPENSATION());

        // Check C's debt and coll reduced
        assertLt(troveManager.getTroveEntireDebt(troveIDs.C), debt_C);
        assertLt(troveManager.getTroveEntireColl(troveIDs.C), coll);
    }

    // - Accrued Trove interest contributes to redee into debt of a redeemed trove

    function testRedemptionIncludesAccruedTroveInterest() public {
        (uint256 coll, uint256 debtRequest, TroveIDs memory troveIDs) = _setupForRedemption();

        (uint256 entireDebt_A,, uint256 redistDebtGain_A,, uint256 accruedInterest_A) =
            troveManager.getEntireDebtAndColl(troveIDs.A);
        assertGt(accruedInterest_A, 0);
        assertEq(redistDebtGain_A, 0);

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
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

    // TODO:
    // individual Trove interest updates for redeemed Troves

    // -
}
