// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DevTestSetup} from "./TestContracts/DevTestSetup.sol";
import {IDebtInFrontHelper} from "../src/Interfaces/IDebtInFrontHelper.sol";
import {DebtInFrontHelper} from "../src/DebtInFrontHelper.sol";

contract DebtInFrontHelperTest is DevTestSetup {
    IDebtInFrontHelper debtInFrontHelper;

    function setUp() public override {
        super.setUp();
        debtInFrontHelper = new DebtInFrontHelper(collateralRegistry, hintHelpers);
    }

    function test_GetDebtBetweenInterestRates(
        uint256[8] memory debt,
        uint256 excludedTroveId,
        uint256 hintId,
        uint8 numTrials
    ) external {
        for (uint256 i = 0; i < debt.length; ++i) {
            debt[i] = bound(debt[i], 2_000 ether, 10_000 ether);
        }

        excludedTroveId = bound(excludedTroveId, 0, debt.length);
        if (excludedTroveId > 0) excludedTroveId = addressToTroveId(A, excludedTroveId - 1);

        hintId = bound(hintId, 0, debt.length);
        if (hintId > 0) hintId = addressToTroveId(A, hintId - 1);

        // If 2 Troves share the same interest rate, the newer one is closer to redemption.
        // By creating the Troves in this "mangled" order, they will end up being ordered by index.
        openTroveWithExactICRAndDebt(A, 1, 2 ether, debt[1], 0.005 ether);
        openTroveWithExactICRAndDebt(A, 0, 2 ether, debt[0], 0.005 ether);
        openTroveWithExactICRAndDebt(A, 3, 2 ether, debt[3], 0.006 ether);
        openTroveWithExactICRAndDebt(A, 2, 2 ether, debt[2], 0.006 ether);
        openTroveWithExactICRAndDebt(A, 5, 2 ether, debt[5], 0.007 ether);
        openTroveWithExactICRAndDebt(A, 4, 2 ether, debt[4], 0.007 ether);
        openTroveWithExactICRAndDebt(A, 7, 2 ether, debt[7], 0.008 ether);
        openTroveWithExactICRAndDebt(A, 6, 2 ether, debt[6], 0.008 ether);

        uint256 expectedDebt = 0;
        for (uint256 i = 2; i < 6; ++i) {
            uint256 troveId = addressToTroveId(A, i);
            if (troveId != excludedTroveId) expectedDebt += troveManager.getTroveEntireDebt(troveId);
        }

        (uint256 actualDebt,) = debtInFrontHelper.getDebtBetweenInterestRates(
            0, 0.006 ether, 0.008 ether, excludedTroveId, hintId, numTrials
        );

        assertEqDecimal(actualDebt, expectedDebt, 18);
    }

    function test_GetDebtBetweenInterestRateAndTrove(
        uint256[8] memory debt,
        uint256 troveIdToStopAt,
        uint256 hintId,
        uint8 numTrials
    ) external {
        for (uint256 i = 0; i < debt.length; ++i) {
            debt[i] = bound(debt[i], 2_000 ether, 10_000 ether);
        }

        troveIdToStopAt = bound(troveIdToStopAt, 0, debt.length);
        if (troveIdToStopAt > 0) troveIdToStopAt = addressToTroveId(A, troveIdToStopAt - 1);

        hintId = bound(hintId, 0, debt.length);
        if (hintId > 0) hintId = addressToTroveId(A, hintId - 1);

        // If 2 Troves share the same interest rate, the newer one is closer to redemption.
        // By creating the Troves in this "mangled" order, they will end up being ordered by index.
        openTroveWithExactICRAndDebt(A, 1, 2 ether, debt[1], 0.005 ether);
        openTroveWithExactICRAndDebt(A, 0, 2 ether, debt[0], 0.005 ether);
        openTroveWithExactICRAndDebt(A, 3, 2 ether, debt[3], 0.006 ether);
        openTroveWithExactICRAndDebt(A, 2, 2 ether, debt[2], 0.006 ether);
        openTroveWithExactICRAndDebt(A, 5, 2 ether, debt[5], 0.007 ether);
        openTroveWithExactICRAndDebt(A, 4, 2 ether, debt[4], 0.007 ether);
        openTroveWithExactICRAndDebt(A, 7, 2 ether, debt[7], 0.008 ether);
        openTroveWithExactICRAndDebt(A, 6, 2 ether, debt[6], 0.008 ether);

        uint256 expectedDebt = 0;
        for (uint256 i = 2; i < 6; ++i) {
            uint256 troveId = addressToTroveId(A, i);
            if (troveId == troveIdToStopAt) break;
            expectedDebt += troveManager.getTroveEntireDebt(troveId);
        }

        (uint256 actualDebt,) = debtInFrontHelper.getDebtBetweenInterestRateAndTrove(
            0, 0.006 ether, 0.008 ether, troveIdToStopAt, hintId, numTrials
        );

        assertEqDecimal(actualDebt, expectedDebt, 18);
    }
}
