// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";
import {mulDivCeil} from "./Utils/Math.sol";

contract SPTest is DevTestSetup {
    struct ExpectedShareOfReward {
        uint256 _1_A;
        uint256 _1_B;
        uint256 _2_A;
        uint256 _2_B;
        uint256 _2_C;
        uint256 _2_D;
        uint256 _3_A;
        uint256 _3_B;
        uint256 _3_C;
        uint256 _3_D;
    }

    struct PendingAggInterest {
        uint256 _1;
        uint256 _2;
        uint256 _3;
    }

    struct ExpectedSPYield {
        uint256 _1;
        uint256 _2;
        uint256 _3;
    }

    struct PTestVars {
        uint256 storedVal;
        uint256 deposit1_A;
        uint256 deposit2_A;
        uint256 deposit1_B;
        uint256 deposit2_B;
        uint256 scale1;
        uint256 scale2;
        uint256 expectedSpYield1;
        uint256 expectedDeposit1_A;
        uint256 expectedDeposit2_A;
        uint256 expectedDeposit1_B;
        uint256 expectedDeposit2_B;
        uint256 expectedShareOfYield1_A;
        uint256 expectedShareOfYield1_B;
        uint256 expectedShareOfYield1_C;
        uint256 expectedShareOfYield1_D;
        uint256 troveDebt_C;
        uint256 troveDebt_D;
        uint256 totalSPBeforeLiq_C;
        uint256 totalSPBeforeLiq_D;
        uint256 expectedShareOfColl1_A;
        uint256 expectedShareOfColl1_B;
        uint256 expectedShareOfColl2_A;
        uint256 expectedShareOfColl2_B;
        uint256 boldGainA;
        uint256 boldGainB;
        uint256 boldGainC;
        uint256 boldGainD;
        uint256 spEthGain1;
        uint256 spEthGain2;
        uint256 ethGainA;
        uint256 ethGainB;
        uint256 ethGainC;
        uint256 ethGainD;
        uint256 expectedShareOfColl;
        uint256 spEthGain;
        uint256 totalDepositsBefore;
        uint256 spEthBal1;
        uint256 spEthBal2;
        uint256 initialBoldGainA;
        uint256 initialBoldGainB;
    }

    struct LiqTestVars {
        uint256 debtABefore;
        uint256 collABefore;
        uint256 debtBBefore;
        uint256 collBBefore;
        uint256 collCBefore;
        uint256 collGasComp;
        uint256 spCollBalBefore;
        uint256 spCollBalAfter;
        uint256 collToGiveToSP;
        uint256 collToRedist;
    }

    function _setupStashedAndCurrentCollGains() internal {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // A liqs D
        liquidate(A, troveIDs.D);
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.D)), uint8(ITroveManager.Status.closedByLiquidation));

        // Check A has both stashed and current gains
        uint256 stashedCollGain_A = stabilityPool.stashedColl(A);
        uint256 currentCollGain_A = stabilityPool.getDepositorCollGain(A);
        assertGt(stashedCollGain_A, 0);
        assertGt(currentCollGain_A, 0);

        // Check B has only current gains, no stashed
        uint256 stashedCollGain_B = stabilityPool.stashedColl(B);
        uint256 currentCollGain_B = stabilityPool.getDepositorCollGain(B);
        assertEq(stashedCollGain_B, 0);
        assertGt(currentCollGain_B, 0);
    }

    // --- provideToSP, doClaim == true, Coll gains ---
    function testProvideToSPWithClaim_WithOnlyCurrentCollGainsSendsTotalCollGainToDepositor() public {
        _setupForSPDepositAdjustments();

        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(currentCollGain, 0);

        uint256 collBal_A = collToken.balanceOf(A);
        assertGt(collBal_A, 0);

        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        assertEq(stashedCollGain, 0);

        makeSPDepositAndClaim(A, 1e18);

        assertEq(collToken.balanceOf(A), collBal_A + currentCollGain);
    }

    function testProvideToSPWithClaim_WithOnlyCurrentCollGainsDoesntChangeStashedCollGain() public {
        _setupForSPDepositAdjustments();

        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(currentCollGain, 0);

        assertEq(stabilityPool.stashedColl(A), 0);

        makeSPDepositAndClaim(A, 1e18);

        assertEq(stabilityPool.stashedColl(A), 0);
    }

    function testProvideToSPWithClaim_WithCurrentAndStashedCollGainsSendsTotalCollGainToDepositor() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentCollGains();

        // Check A has both stashed and current gains
        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(stashedCollGain, 0);
        assertGt(currentCollGain, 0);

        uint256 collBal_A = collToken.balanceOf(A);
        assertGt(collBal_A, 0);

        makeSPDepositAndClaim(A, 1e18);

        // Check A's Coll balance increases by total (stashed + current) Coll gain
        assertEq(collToken.balanceOf(A), collBal_A + stashedCollGain + currentCollGain);
    }

    function testProvideToSPWithClaim_WithCurrentAndStashedCollGainsZerosStashedCollBalance() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentCollGains();

        // Check A has both stashed and current gains
        stabilityPool.stashedColl(A);

        makeSPDepositAndClaim(A, 1e18);

        // Check A's stashed balance reduced to 0
        assertEq(stabilityPool.stashedColl(A), 0);
    }

    function testProvideToSPWithClaim_WithOnlyStashedCollGainsSendsStashedCollGainToDepositor() public {
        _setupForSPDepositAdjustments();

        // Stash gains
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(stashedCollGain, 0);
        assertEq(currentCollGain, 0);

        uint256 collBal_A = collToken.balanceOf(A);
        assertGt(collBal_A, 0);

        makeSPDepositAndClaim(A, 1e18);

        // Check A's Coll balance increases by total stashed Coll gain
        assertEq(collToken.balanceOf(A), collBal_A + stashedCollGain);
    }

    function testProvideToSPWithClaim_WithOnlyStashedCollGainsZerosStashedCollBalance() public {
        _setupForSPDepositAdjustments();

        // Stash gains
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(stashedCollGain, 0);
        assertEq(currentCollGain, 0);

        makeSPDepositAndClaim(A, 1e18);

        // Check A's stashed balance reduced to 0
        assertEq(stabilityPool.stashedColl(A), 0);
    }

    // --- provideToSP, doClaim == true, BOLD gains ---

    function testProvideToSPWithClaim_WithOnlyCurrentBOLDGainsSendsTotalBOLDGainToDepositor() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 boldBal_A = boldToken.balanceOf(A);

        uint256 topUp = 1e18;
        makeSPDepositAndClaim(A, topUp);

        assertEq(boldToken.balanceOf(A), boldBal_A + currentBoldGain - topUp);
    }

    function testProvideToSPWithClaim_WithCurrentBOLDGainsZerosCurrentBOLDGains() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        // Check has currentBoldGain
        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 topUp = 1e18;
        makeSPDepositAndClaim(A, topUp);

        // Check A's currentBoldGain reduced to 0
        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
    }

    // --- provideToSP, doClaim == false, Coll gains ---

    function testProvideToSPNoClaim_WithOnlyCurrentCollGainsDoesntChangeDepositorCollBalance() public {
        _setupForSPDepositAdjustments();

        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(currentCollGain, 0);

        uint256 collBal_A = collToken.balanceOf(A);
        assertGt(collBal_A, 0);

        makeSPDepositNoClaim(A, 1e18);

        assertEq(collToken.balanceOf(A), collBal_A);
    }

    function testProvideToSPNoClaim_WithOnlyCurrentCollGainsStashesCollGains() public {
        _setupForSPDepositAdjustments();

        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(currentCollGain, 0);

        // Check A has no stashed gains
        assertEq(stabilityPool.stashedColl(A), 0);

        makeSPDepositNoClaim(A, 1e18);

        // Check A's gain got stashed
        assertEq(stabilityPool.stashedColl(A), currentCollGain);
    }

    function testProvideToSPNoClaim_WithCurrentAndStashedCollGainsDoesntChangeDepositorCollBalance() public {
        _setupStashedAndCurrentCollGains();

        uint256 collBal_A = collToken.balanceOf(A);
        assertGt(collBal_A, 0);

        makeSPDepositNoClaim(A, 1e18);

        assertEq(collToken.balanceOf(A), collBal_A);
    }

    function testProvideToSPNoClaim_WithCurrentAndStashedCollGainsIncreasedStashedCollGainByCurrentGain() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentCollGains();

        // Check A has both stashed and current gains
        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(stashedCollGain, 0);
        assertGt(currentCollGain, 0);

        makeSPDepositNoClaim(A, 1e18);

        assertEq(stabilityPool.stashedColl(A), stashedCollGain + currentCollGain);
    }

    function testProvideToSPNoClaim_WithOnlyStashedCollGainDoesntChangeDepositorCollBalance() public {
        _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed  gains
        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(stashedCollGain, 0);
        assertEq(currentCollGain, 0);

        uint256 collBal_A = collToken.balanceOf(A);
        assertGt(collBal_A, 0);

        makeSPDepositNoClaim(A, 1e18);

        assertEq(collToken.balanceOf(A), collBal_A);
    }

    function testProvideToSPNoClaim_WithOnlyStashedCollGainDoesntChangeStashedCollGain() public {
        _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(stashedCollGain, 0);
        assertEq(currentCollGain, 0);

        makeSPDepositNoClaim(A, 1e18);

        assertEq(stabilityPool.stashedColl(A), stashedCollGain);
    }

    // --- provideToSP, doClaim == false, BOLD gains ---

    function testProvideToSPNoClaimAddsBOLDGainsToDeposit() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 depositBefore_A = stabilityPool.getCompoundedBoldDeposit(A);

        uint256 topUp = 1e18;
        makeSPDepositNoClaim(A, topUp);

        assertApproximatelyEqual(
            stabilityPool.getCompoundedBoldDeposit(A), depositBefore_A + topUp + currentBoldGain, 1e4
        );
    }

    function testProvideToSPNoClaimAddsBoldGainsToTotalBoldDeposits() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 totalBoldDepositsBefore = stabilityPool.getTotalBoldDeposits();

        uint256 topUp = 1e18;
        makeSPDepositNoClaim(A, topUp);

        assertApproximatelyEqual(
            stabilityPool.getTotalBoldDeposits(), totalBoldDepositsBefore + topUp + currentBoldGain, 1e4
        );
    }

    function testProvideToSPNoClaimZerosCurrentBoldGains() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 topUp = 1e18;
        makeSPDepositNoClaim(A, topUp);

        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
    }

    function testProvideToSPNoClaimReducesDepositorBoldBalanceByOnlyTheTopUp() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 boldBalBefore_A = boldToken.balanceOf(A);

        uint256 topUp = 1e18;
        makeSPDepositNoClaim(A, topUp);

        assertEq(boldToken.balanceOf(A), boldBalBefore_A - topUp);
    }

    // --- withdrawFromSP, doClaim == true, Coll gains ---
    function testWithdrawFromSPWithClaim_WithOnlyCurrentCollGainsSendsTotalCollGainToDepositor() public {
        _setupForSPDepositAdjustments();

        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(currentCollGain, 0);

        uint256 collBal_A = collToken.balanceOf(A);
        assertGt(collBal_A, 0);

        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        assertEq(stashedCollGain, 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        assertEq(collToken.balanceOf(A), collBal_A + currentCollGain);
    }

    function testWithdrawFromSPWithClaim_WithOnlyCurrentCollGainsDoesntChangeStashedCollGain() public {
        _setupForSPDepositAdjustments();

        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(currentCollGain, 0);

        assertEq(stabilityPool.stashedColl(A), 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        assertEq(stabilityPool.stashedColl(A), 0);
    }

    function testWithdrawFromSPWithClaim_WithCurrentAndStashedCollGainsSendsTotalCollGainToDepositor() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentCollGains();

        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);

        uint256 collBal_A = collToken.balanceOf(A);
        assertGt(collBal_A, 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        // Check A's Coll balance increases by total (stashed + current) Coll gain
        assertEq(collToken.balanceOf(A), collBal_A + stashedCollGain + currentCollGain);
    }

    function testWithdrawFromSPWithClaim_WithCurrentAndStashedCollGainsZerosStashedCollBalance() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentCollGains();

        // Check A has both stashed and current gains
        stabilityPool.stashedColl(A);
        stabilityPool.getDepositorCollGain(A);

        makeSPWithdrawalAndClaim(A, 1e18);

        // Check A's stashed balance reduced to 0
        assertEq(stabilityPool.stashedColl(A), 0);
    }

    function testWithdrawFromSPPWithClaim_WithOnlyStashedCollGainsSendsStashedCollGainToDepositor() public {
        _setupForSPDepositAdjustments();

        // Stash gains
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(stashedCollGain, 0);
        assertEq(currentCollGain, 0);

        uint256 collBal_A = collToken.balanceOf(A);
        assertGt(collBal_A, 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        // Check A's Coll balance increases by total stashed Coll gain
        assertEq(collToken.balanceOf(A), collBal_A + stashedCollGain);
    }

    function testWithdrawFromSPWithClaim_WithOnlyStashedCollGainsZerosStashedCollBalance() public {
        _setupForSPDepositAdjustments();

        // Stash gains
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(stashedCollGain, 0);
        assertEq(currentCollGain, 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        // Check A's stashed balance reduced to 0
        assertEq(stabilityPool.stashedColl(A), 0);
    }

    // --- withdrawFromSP, doClaim == true, BOLD gains ---
    function testWithdrawFromSPWithClaim_WithCurrentBOLDGainsSendsBOLDGainToDepositor() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 boldBal_A = boldToken.balanceOf(A);

        uint256 withdrawal = 1e18;

        makeSPWithdrawalAndClaim(A, withdrawal);

        assertEq(boldToken.balanceOf(A), boldBal_A + withdrawal + currentBoldGain);
    }

    function testWithdrawFromSPWithClaim_WithCurrentBOLDGainsZerosCurrentBoldGains() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 withdrawal = 1e18;

        makeSPWithdrawalAndClaim(A, withdrawal);

        // Check A's BOLD gain reduced to 0
        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
    }

    // --- withdrawFromSP, doClaim == false, Coll gains ---

    function testWithdrawFromSPNoClaim_WithOnlyCurrentCollGainsDoesntChangeDepositorCollBalance() public {
        _setupForSPDepositAdjustments();

        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(currentCollGain, 0);

        uint256 collBal_A = collToken.balanceOf(A);
        assertGt(collBal_A, 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        assertEq(collToken.balanceOf(A), collBal_A);
    }

    function testWithdrawFromSPNoClaim_WithOnlyCurrentCollGainsStashesCollGains() public {
        _setupForSPDepositAdjustments();

        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(currentCollGain, 0);

        // Check A has no stashed gains
        assertEq(stabilityPool.stashedColl(A), 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        // Check A's gain got stashed
        assertEq(stabilityPool.stashedColl(A), currentCollGain);
    }

    function testWithdrawFromSPNoClaim_WithCurrentAndStashedCollGainsDoesntChangeDepositorCollBalance() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentCollGains();

        // Check A has both stashed and current gains
        stabilityPool.stashedColl(A);
        stabilityPool.getDepositorCollGain(A);

        uint256 collBal_A = collToken.balanceOf(A);
        assertGt(collBal_A, 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        assertEq(collToken.balanceOf(A), collBal_A);
    }

    function testWithdrawFromSPNoClaim_WithCurrentAndStashedCollGainsIncreasedStashedGainByCurrentCollGain() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentCollGains();

        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);

        makeSPWithdrawalNoClaim(A, 1e18);

        assertEq(stabilityPool.stashedColl(A), stashedCollGain + currentCollGain);
    }

    function testWithdrawFromSPNoClaim_WithOnlyStashedGainDoesntChangeDepositorCollBalance() public {
        _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed  gains
        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(stashedCollGain, 0);
        assertEq(currentCollGain, 0);

        uint256 collBal_A = collToken.balanceOf(A);
        assertGt(collBal_A, 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        assertEq(collToken.balanceOf(A), collBal_A);
    }

    function testWithdrawFromSPNoClaim_WithOnlyStashedCollGainDoesntChangeStashedCollGain() public {
        _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedCollGain = stabilityPool.stashedColl(A);
        uint256 currentCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(stashedCollGain, 0);
        assertEq(currentCollGain, 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        assertEq(stabilityPool.stashedColl(A), stashedCollGain);
    }

    // --- withdrawFromSP, doClaim == false, BOLD gains ---

    function testWithdrawFromSPNoClaimAddsBOLDGainsToDeposit() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 depositBefore_A = stabilityPool.getCompoundedBoldDeposit(A);

        uint256 withdrawal = 1e18;
        makeSPWithdrawalNoClaim(A, withdrawal);

        assertApproximatelyEqual(
            stabilityPool.getCompoundedBoldDeposit(A), depositBefore_A - withdrawal + currentBoldGain, 1e4
        );
    }

    function testWithdrawFromSPNoClaimAddsBoldGainsToTotalBoldDeposits() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 totalBoldDepositsBefore = stabilityPool.getTotalBoldDeposits();

        uint256 withdrawal = 1e18;
        makeSPWithdrawalNoClaim(A, withdrawal);

        assertEq(stabilityPool.getTotalBoldDeposits(), totalBoldDepositsBefore - withdrawal + currentBoldGain);
    }

    function testWithdrawFromSPNoClaimZerosCurrentBoldGains() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 withdrawal = 1e18;
        makeSPWithdrawalNoClaim(A, withdrawal);

        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
    }

    function testWithdrawFromSPNoClaimReducesDepositorBoldBalanceByOnlyTheTopUp() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 boldBalBefore_A = boldToken.balanceOf(A);

        uint256 withdrawal = 1e18;
        makeSPWithdrawalNoClaim(A, withdrawal);

        assertEq(boldToken.balanceOf(A), boldBalBefore_A + withdrawal);
    }

    // --- claimAllCollGains ---

    function testClaimAllCollGainsRevertsWhenUserHasNoDeposit() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentCollGains();

        // A
        uint256 compoundedDeposit_A = stabilityPool.getCompoundedBoldDeposit(A);
        assertGt(compoundedDeposit_A, 0);

        vm.startPrank(A);
        vm.expectRevert("StabilityPool: User must have no deposit");
        stabilityPool.claimAllCollGains();
        vm.stopPrank();
    }

    function testClaimAllCollGainsRevertsWhenUserHasNoCollGains() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentCollGains();

        // B
        uint256 compoundedDeposit_B = stabilityPool.getCompoundedBoldDeposit(B);
        assertGt(compoundedDeposit_B, 0);

        // B withdraws deposit and tries to withdraw stashed coll gains
        vm.startPrank(B);
        stabilityPool.withdrawFromSP(compoundedDeposit_B, true);
        assertEq(stabilityPool.getCompoundedBoldDeposit(B), 0);
        vm.expectRevert("StabilityPool: Amount must be non-zero");
        stabilityPool.claimAllCollGains();
        vm.stopPrank();

        //As does C, who never had a deposit
        vm.startPrank(C);
        vm.expectRevert("StabilityPool: Amount must be non-zero");
        stabilityPool.claimAllCollGains();
        vm.stopPrank();
    }

    function testClaimAllCollGainsDoesNotChangeCompoundedDeposit() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentCollGains();

        // A withdraws deposit
        uint256 deposit_A = stabilityPool.getCompoundedBoldDeposit(A);
        makeSPWithdrawalNoClaim(A, deposit_A);

        // A
        uint256 compoundedDeposit_A = stabilityPool.getCompoundedBoldDeposit(A);
        assertEq(compoundedDeposit_A, 0);

        claimAllCollGains(A);

        assertEq(compoundedDeposit_A, stabilityPool.getCompoundedBoldDeposit(A));
    }

    function testClaimAllCollGainsDoesntChangeCurrentCollGain() public {
        _setupForSPDepositAdjustmentsWithoutOwedYieldRewards();

        // A withdraws deposit and stashes gain
        uint256 deposit_A = stabilityPool.getCompoundedBoldDeposit(A);
        makeSPWithdrawalNoClaim(A, deposit_A);

        // Check A has only stashed gains
        uint256 stashedCollGain_A = stabilityPool.stashedColl(A);
        uint256 currentCollGain_A = stabilityPool.getDepositorCollGain(A);
        assertGt(stashedCollGain_A, 0);
        assertEq(currentCollGain_A, 0);

        claimAllCollGains(A);

        assertEq(stabilityPool.getDepositorCollGain(A), 0);
    }

    function testClaimAllCollGainsZerosStashedCollGain() public {
        _setupForSPDepositAdjustmentsWithoutOwedYieldRewards();

        // A withdraws deposit and stashes gain
        uint256 deposit_A = stabilityPool.getCompoundedBoldDeposit(A);
        makeSPWithdrawalNoClaim(A, deposit_A);

        // Check A has only stashed gains
        uint256 stashedCollGain_A = stabilityPool.stashedColl(A);
        uint256 currentCollGain_A = stabilityPool.getDepositorCollGain(A);
        assertGt(stashedCollGain_A, 0);
        assertEq(currentCollGain_A, 0);

        claimAllCollGains(A);

        assertEq(stabilityPool.stashedColl(A), 0);
    }

    function testClaimAllCollGainsIncreasesUserBalanceByStashedCollGain() public {
        _setupForSPDepositAdjustmentsWithoutOwedYieldRewards();

        // A withdraws deposit and stashes gain
        uint256 deposit_A = stabilityPool.getCompoundedBoldDeposit(A);
        makeSPWithdrawalNoClaim(A, deposit_A);

        // Check A has only stashed gains
        uint256 stashedCollGain_A = stabilityPool.stashedColl(A);
        assertGt(stashedCollGain_A, 0);

        uint256 collBal_A = collToken.balanceOf(A);
        assertGt(collBal_A, 0);

        claimAllCollGains(A);

        assertEq(stabilityPool.stashedColl(A), 0);
        assertEq(collToken.balanceOf(A), collBal_A + stashedCollGain_A);
    }

    // --- Bold reward sum 'B' tests ---

    function testBoldRewardsSumDoesntChangeWhenSPIsEmpty() public {
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pct(A, 3 ether, 2000e18, 25e16);

        // check SP is 0
        assertEq(stabilityPool.getTotalBoldDeposits(), 0);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.scaleToB(0);
        assertEq(boldRewardSum_1, 0);

        openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        uint256 boldRewardSum_2 = stabilityPool.scaleToB(0);
        assertEq(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumDoesntChangeWhenNoYieldMinted() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertEq(pendingAggInterest, 0, "Pending interest should be zero");

        uint256 boldRewardSum_1 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_1, 0, "BOLD reward sum 1");

        // Adjust a Trove in a way that doesn't incur an upfront fee
        repayBold(B, troveIDs.B, 1_000 ether);

        uint256 boldRewardSum_2 = stabilityPool.scaleToB(0);
        assertEq(boldRewardSum_2, boldRewardSum_1, "BOLD reward sum 2");
    }

    function testBoldRewardSumIncreasesWhenTroveOpened() public {
        _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_1, 0);

        openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        uint256 boldRewardSum_2 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenTroveInterestRateAdjusted() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_1, 0);

        changeInterestRateNoHints(B, troveIDs.B, 75e16);

        uint256 boldRewardSum_2 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenTroveClosed() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);
        troveIDs.F = openTroveNoHints100pct(F, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_1, 0); // yield from upfront fee

        // F sends E his bold so he can close
        vm.startPrank(F);
        boldToken.transfer(E, boldToken.balanceOf(F));
        vm.stopPrank();
        closeTrove(E, troveIDs.E);

        uint256 boldRewardSum_2 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenTroveDebtAndCollAdjusted() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_1, 0);

        adjustTrove100pct(A, troveIDs.A, 1, 1, true, true);

        uint256 boldRewardSum_2 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenInterestAppliedPermissionlessly() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_1, 0);

        // B applies A's pending interest
        applyPendingDebt(B, troveIDs.A);

        uint256 boldRewardSum_2 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenTroveLiquidated() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_1, 0);

        // A liquidates D
        liquidate(A, troveIDs.D);
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.D)), uint8(ITroveManager.Status.closedByLiquidation));

        uint256 boldRewardSum_2 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenRedemptionOccurs() public {
        _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_1, 0);

        uint256 wethBalBefore_A = collToken.balanceOf(A);
        // A redeems
        redeem(A, 1e18);
        assertGt(collToken.balanceOf(A), wethBalBefore_A);

        uint256 boldRewardSum_2 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenNewDepositIsMade() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_1, 0); // yield from upfront fee

        // E Makes deposit
        makeSPDepositAndClaim(E, 1e18);

        uint256 boldRewardSum_2 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenDepositToppedUp() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_1, 0); // yield from upfront fee

        // A tops up deposit
        makeSPDepositAndClaim(A, 1e18);

        uint256 boldRewardSum_2 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenDepositWithdrawn() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_1, 0); // yield from upfront fee

        // A withdraws some deposit
        makeSPWithdrawalAndClaim(A, 1e18);

        uint256 boldRewardSum_2 = stabilityPool.scaleToB(0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    // ---- yieldGainsOwed tests ---

    function testBoldRewardsOwedDoesntChangeWhenSPIsEmpty() public {
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pct(A, 3 ether, 2000e18, 25e16);

        // check SP is 0
        assertEq(stabilityPool.getTotalBoldDeposits(), 0);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

        openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedOnlyIcreasesByUpfrontFeeYieldWhenNoInterestMinted() public {
        _setupForSPDepositAdjustments();

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertEq(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        uint256 yieldGainsPending_1 = stabilityPool.getYieldGainsPending();
        assertGt(yieldGainsOwed_1, 0, "Yield owed mismatch 1");
        assertEq(yieldGainsPending_1, 0, "Yield pending mismatch 1");

        (, uint256 upfrontFee) = openTroveHelper(E, 0, 3 ether, 2000e18, 25e16);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        uint256 yieldGainsPending_2 = stabilityPool.getYieldGainsPending();
        assertEq(yieldGainsOwed_2, yieldGainsOwed_1 + _getSPYield(upfrontFee), "Yield owed mismatch 2");
        assertEq(yieldGainsPending_2, 0, "Yield pending mismatch 2");
    }

    function testBoldRewardsOwedIncreasesWhenTroveOpened() public {
        _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        uint256 yieldGainsPending_1 = stabilityPool.getYieldGainsPending();
        assertGt(yieldGainsOwed_1, 0, "Yield owed mismatch 1");
        assertEq(yieldGainsPending_1, 0, "Yield pending mismatch 1");

        openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenTroveInterestRateAdjusted() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        uint256 yieldGainsPending_1 = stabilityPool.getYieldGainsPending();
        assertGt(yieldGainsOwed_1, 0, "Yield owed mismatch 1");
        assertEq(yieldGainsPending_1, 0, "Yield pending mismatch 1");

        changeInterestRateNoHints(B, troveIDs.B, 75e16);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenTroveClosed() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);
        troveIDs.F = openTroveNoHints100pct(F, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        uint256 yieldGainsPending_1 = stabilityPool.getYieldGainsPending();
        assertGt(yieldGainsOwed_1, 0, "Yield owed mismatch 1");
        assertEq(yieldGainsPending_1, 0, "Yield pending mismatch 1");

        // F sends E his bold so he can close
        vm.startPrank(F);
        boldToken.transfer(E, boldToken.balanceOf(F));
        vm.stopPrank();
        closeTrove(E, troveIDs.E);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenTroveDebtAndCollAdjusted() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        uint256 yieldGainsPending_1 = stabilityPool.getYieldGainsPending();
        assertGt(yieldGainsOwed_1, 0, "Yield owed mismatch 1");
        assertEq(yieldGainsPending_1, 0, "Yield pending mismatch 1");

        adjustTrove100pct(A, troveIDs.A, 1, 1, true, true);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenInterestAppliedPermissionlessly() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        uint256 yieldGainsPending_1 = stabilityPool.getYieldGainsPending();
        assertGt(yieldGainsOwed_1, 0, "Yield owed mismatch 1");
        assertEq(yieldGainsPending_1, 0, "Yield pending mismatch 1");

        // B applies A's pending interest
        applyPendingDebt(B, troveIDs.A);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenTroveLiquidated() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        uint256 yieldGainsPending_1 = stabilityPool.getYieldGainsPending();
        assertGt(yieldGainsOwed_1, 0, "Yield owed mismatch 1");
        assertEq(yieldGainsPending_1, 0, "Yield pending mismatch 1");

        // A liquidates D
        liquidate(A, troveIDs.D);
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.D)), uint8(ITroveManager.Status.closedByLiquidation));

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenRedemptionOccurs() public {
        _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        uint256 yieldGainsPending_1 = stabilityPool.getYieldGainsPending();
        assertGt(yieldGainsOwed_1, 0, "Yield owed mismatch 1");
        assertEq(yieldGainsPending_1, 0, "Yield pending mismatch 1");
        uint256 wethBalBefore_A = collToken.balanceOf(A);

        // A redeems
        redeem(A, 1e18);
        assertGt(collToken.balanceOf(A), wethBalBefore_A);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenNewDepositIsMade() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        uint256 yieldGainsPending_1 = stabilityPool.getYieldGainsPending();
        assertGt(yieldGainsOwed_1, 0, "Yield owed mismatch 1");
        assertEq(yieldGainsPending_1, 0, "Yield pending mismatch 1");

        // E Makes deposit
        makeSPDepositAndClaim(E, 1e18);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenDepositToppedUp() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_1, 0); // yield from upfront fee

        // A tops up deposit
        makeSPDepositAndClaim(A, 1e18);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenDepositWithdrawn() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_1, 0); // yield from upfront fee

        // A withdraws some deposit
        makeSPWithdrawalAndClaim(A, 1e18);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    // --- depositor BOLD rewards tests ---

    function testGetDepositorBoldGain_1SPDepositor1RewardEvent_EarnsAllSPYield() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustmentsWithoutOwedYieldRewards();

        // B withdraws entirely
        makeSPWithdrawalAndClaim(B, stabilityPool.getCompoundedBoldDeposit(B));

        // Check A has entirely of the non-zero SP deposits
        assertApproximatelyEqual(stabilityPool.getCompoundedBoldDeposit(A), stabilityPool.getTotalBoldDeposits(), 1e4);
        assertGt(stabilityPool.getTotalBoldDeposits(), 0);

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);
        uint256 expectedSpYield = SP_YIELD_SPLIT * pendingAggInterest / 1e18;

        // A trove gets poked, interest minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), expectedSpYield, 1e4);
    }

    function testGetDepositorBoldGain_2SPDepositor1RewardEvent_EarnFairShareOfSPYield() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustmentsWithoutOwedYieldRewards();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);
        uint256 expectedSpYield = SP_YIELD_SPLIT * pendingAggInterest / 1e18;

        uint256 expectedShareOfReward_A = getShareofSPReward(A, expectedSpYield);
        uint256 expectedShareOfReward_B = getShareofSPReward(B, expectedSpYield);
        // Confirm the expected shares sum up to the total expected yield
        assertApproximatelyEqual(expectedShareOfReward_A + expectedShareOfReward_B, expectedSpYield, 1e3);
        assertGt(expectedShareOfReward_B, expectedShareOfReward_A);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        // Check both depositors earn their expected shares of the yield
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), expectedShareOfReward_A, 1e4);
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(B), expectedShareOfReward_B, 1e4);
    }

    function testGetDepositorBoldGain_1SPDepositor2RewardEvent_EarnsAllSPYield() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustmentsWithoutOwedYieldRewards();

        // B withdraws entirely
        makeSPWithdrawalAndClaim(B, stabilityPool.getCompoundedBoldDeposit(B));

        // Check A has entirely of the non-zero SP deposits
        assertApproximatelyEqual(stabilityPool.getCompoundedBoldDeposit(A), stabilityPool.getTotalBoldDeposits(), 1e4);
        assertGt(stabilityPool.getTotalBoldDeposits(), 0);

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);
        uint256 expectedSpYield_1 = SP_YIELD_SPLIT * pendingAggInterest_1 / 1e18;

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);
        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_1, 0);

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest_2 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_2, 0);
        uint256 expectedSpYield_2 = SP_YIELD_SPLIT * pendingAggInterest_2 / 1e18;

        // A trove gets poked, interest minted and yield paid to SP again
        applyPendingDebt(B, troveIDs.A);
        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, 0);

        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), expectedSpYield_1 + expectedSpYield_2, 1e4);
    }

    function testGetDepositorBoldGain_2SPDepositor2RewardEvent_EarnFairShareOfSPYield() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustmentsWithoutOwedYieldRewards();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);
        uint256 expectedSpYield_1 = SP_YIELD_SPLIT * pendingAggInterest_1 / 1e18;

        uint256 expectedShareOfReward1_A = getShareofSPReward(A, expectedSpYield_1);
        uint256 expectedShareOfReward1_B = getShareofSPReward(B, expectedSpYield_1);
        assertGt(expectedShareOfReward1_A, 0);
        assertGt(expectedShareOfReward1_B, 0);

        // Confirm the expected shares sum up to the total expected yield
        assertApproximatelyEqual(expectedShareOfReward1_A + expectedShareOfReward1_B, expectedSpYield_1, 1e3);

        // A trove gets poked, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        // fast-forward time again and accrue interest
        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest_2 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_2, 0);
        uint256 expectedSpYield_2 = SP_YIELD_SPLIT * pendingAggInterest_2 / 1e18;

        uint256 expectedShareOfReward2_A = getShareofSPReward(A, expectedSpYield_2);
        uint256 expectedShareOfReward2_B = getShareofSPReward(B, expectedSpYield_2);
        assertGt(expectedShareOfReward2_A, 0);
        assertGt(expectedShareOfReward2_B, 0);

        // Confirm the expected shares sum up to the total expected yield
        assertApproximatelyEqual(expectedShareOfReward2_A + expectedShareOfReward2_B, expectedSpYield_2, 1e3);

        // A trove gets poked again, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        // Check both depositors earn their expected shares of the yield
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(A), expectedShareOfReward1_A + expectedShareOfReward2_A, 1e4
        );
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(B), expectedShareOfReward1_B + expectedShareOfReward2_B, 1e4
        );
    }

    function testGetDepositorBoldGain_2SPDepositor1Liq1FreshDeposit_EarnFairShareOfSPYield() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustmentsWithoutOwedYieldRewards();

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);
        uint256 expectedSpYield_1 = SP_YIELD_SPLIT * pendingAggInterest_1 / 1e18;

        uint256 expectedShareOfReward1_A = getShareofSPReward(A, expectedSpYield_1);
        uint256 expectedShareOfReward1_B = getShareofSPReward(B, expectedSpYield_1);
        assertGt(expectedShareOfReward1_A, 0);
        assertGt(expectedShareOfReward1_B, 0);
        uint256 totalSPDeposits_1 = stabilityPool.getTotalBoldDeposits();

        // Confirm the expected shares sum up to the total expected yield
        assertApproximatelyEqual(expectedShareOfReward1_A + expectedShareOfReward1_B, expectedSpYield_1, 1e3);

        // A trove gets poked, interest minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);
        assertEq(activePool.calcPendingAggInterest(), 0);

        // A liquidates D
        liquidate(A, troveIDs.D);

        // C makes fresh deposit
        uint256 deposit_C = 1e18;
        makeSPDepositAndClaim(C, deposit_C);

        // Check SP still has funds
        uint256 totalSPDeposits_2 = stabilityPool.getTotalBoldDeposits();
        assertGt(totalSPDeposits_2, 0);
        assertLt(totalSPDeposits_2, totalSPDeposits_1);

        // fast-forward time again and accrue interest
        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest_2 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_2, 0);
        uint256 expectedSpYield_2 = SP_YIELD_SPLIT * pendingAggInterest_2 / 1e18;

        // Expected reward round 2 calculated with a different totalSPDeposits denominator
        uint256 expectedShareOfReward2_A = getShareofSPReward(A, expectedSpYield_2);
        uint256 expectedShareOfReward2_B = getShareofSPReward(B, expectedSpYield_2);
        uint256 expectedShareOfReward2_C = getShareofSPReward(C, expectedSpYield_2);
        assertGt(expectedShareOfReward2_A, 0);
        assertGt(expectedShareOfReward2_B, 0);
        assertGt(expectedShareOfReward2_C, 0);

        // Confirm the expected shares sum up to the total expected yield
        assertApproximatelyEqual(
            expectedShareOfReward2_A + expectedShareOfReward2_B + expectedShareOfReward2_C, expectedSpYield_2, 1e4
        );

        // A trove gets poked again, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        // Check both depositors earn their expected shares of the yield
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(A), expectedShareOfReward1_A + expectedShareOfReward2_A, 1e4
        );
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(B), expectedShareOfReward1_B + expectedShareOfReward2_B, 1e4
        );
    }

    function testGetDepositorBoldGain_2SPDepositor1LiqFreshDeposit_EarnFairShareOfSPYield() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        ABCDEF[3] memory expectedShareOfReward;

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest_0 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_0, 0);
        uint256 expectedSpYield_0 = SP_YIELD_SPLIT * pendingAggInterest_0 / 1e18;

        expectedShareOfReward[0].A = getShareofSPReward(A, expectedSpYield_0);
        expectedShareOfReward[0].B = getShareofSPReward(B, expectedSpYield_0);
        assertGt(expectedShareOfReward[0].A, 0);
        assertGt(expectedShareOfReward[0].B, 0);
        uint256 totalSPDeposits_0 = stabilityPool.getTotalBoldDeposits();

        // Confirm the expected shares sum up to the total expected yield
        assertApproximatelyEqual(expectedShareOfReward[0].A + expectedShareOfReward[0].B, expectedSpYield_0, 1e3);

        // A withdraws some deposit so that D's liq will nearly empty the pool.
        // A claims all gains here.
        // This also mints interest and pays the yield to the SP
        makeSPWithdrawalAndClaim(A, 500e18);
        assertEq(stabilityPool.getDepositorYieldGain(A), 0, "A yield gain should be 0");
        assertEq(activePool.calcPendingAggInterest(), 0, "Pending agg interest should be 0");

        // A liquidates D
        liquidate(A, troveIDs.D);
        // Check SP has only 1e18 BOLD now, and A and B have small remaining deposits
        assertEq(stabilityPool.getTotalBoldDeposits(), 1e18, "SP total bold deposits should be 1e18");
        assertLt(stabilityPool.getCompoundedBoldDeposit(A), 1e18, "A should have <1e18 deposit");
        assertLt(stabilityPool.getCompoundedBoldDeposit(B), 1e18, "B should have <1e18 deposit");
        assertLe(
            stabilityPool.getCompoundedBoldDeposit(B) + stabilityPool.getCompoundedBoldDeposit(A),
            1e18,
            "A & B deposits should sum to <=1e18"
        );

        // C and D makes fresh deposit
        uint256 deposit_C = 1e18;
        uint256 deposit_D = 1e18;
        makeSPDepositAndClaim(C, deposit_C);
        transferBold(C, D, deposit_D);
        makeSPDepositAndClaim(D, deposit_D);

        // Check SP still has funds
        uint256 totalSPDeposits_1 = stabilityPool.getTotalBoldDeposits();
        assertGt(totalSPDeposits_1, 0);
        assertLt(totalSPDeposits_1, totalSPDeposits_0);

        // fast-forward time again and accrue interest
        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);
        uint256 expectedSpYield_1 = SP_YIELD_SPLIT * pendingAggInterest_1 / 1e18;

        // Expected reward round 2 calculated with a different totalSPDeposits denominator. Expect A and B to earn a small share of
        // this reward.
        expectedShareOfReward[1].A = getShareofSPReward(A, expectedSpYield_1);
        expectedShareOfReward[1].B = getShareofSPReward(B, expectedSpYield_1);
        expectedShareOfReward[1].C = getShareofSPReward(C, expectedSpYield_1);
        expectedShareOfReward[1].D = getShareofSPReward(D, expectedSpYield_1);
        assertGt(expectedShareOfReward[1].A, 0);
        assertGt(expectedShareOfReward[1].B, 0);
        assertGt(expectedShareOfReward[1].C, 0);
        assertGt(expectedShareOfReward[1].D, 0);
        // A and B should get small rewards from reward 2, as their deposits were reduced to 1e18.
        // Confirm A, B are smaller than C, D's rewards
        assertLt(expectedShareOfReward[1].A, expectedShareOfReward[1].C);
        assertLt(expectedShareOfReward[1].A, expectedShareOfReward[1].D);
        assertLt(expectedShareOfReward[1].B, expectedShareOfReward[1].C);
        assertLt(expectedShareOfReward[1].B, expectedShareOfReward[1].D);

        // Confirm the expected shares sum up to the total expected yield
        assertApproximatelyEqual(
            expectedShareOfReward[1].A + expectedShareOfReward[1].B + expectedShareOfReward[1].C
                + expectedShareOfReward[1].D,
            expectedSpYield_1,
            1e4,
            "expected shares should sum up to the total expected yield"
        );

        // A trove gets poked again, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        // Expect A to receive only their share of 2nd reward, since they already claimed first
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(A), expectedShareOfReward[1].A, 1e4, "A should receive only 2nd reward"
        );
        // Expect B to receive their share of 1st and 2nd rewards
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(B),
            expectedShareOfReward[0].B + expectedShareOfReward[1].B,
            1e4,
            "B should receive only their share of 1st and 2nd"
        );
        // Expect C to receive a share of only 2nd reward
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(C),
            expectedShareOfReward[1].C,
            1e4,
            "C should receive a share of both reward 1 and 2"
        );
    }

    function testGetDepositorBoldGain_2SPDepositor1LiqScaleChangeFreshDeposit_EarnFairShareOfSPYield() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustmentsBigTroves();
        ABCDEF[3] memory expectedShareOfReward;

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest_0 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_0, 0);
        uint256 expectedSpYield_0 = SP_YIELD_SPLIT * pendingAggInterest_0 / 1e18;

        expectedShareOfReward[0].A = getShareofSPReward(A, expectedSpYield_0);
        expectedShareOfReward[0].B = getShareofSPReward(B, expectedSpYield_0);
        assertGt(expectedShareOfReward[0].A, 0);
        assertGt(expectedShareOfReward[0].B, 0);
        uint256 totalSPDeposits_0 = stabilityPool.getTotalBoldDeposits();

        // Confirm the expected shares sum up to the total expected yield
        assertApproximatelyEqual(expectedShareOfReward[0].A + expectedShareOfReward[0].B, expectedSpYield_0, 1e3);

        // A withdraws some deposit so that D's liq will trigger a scale change.
        // This also mints interest and pays the yield to the SP
        uint256 debtSPDelta = totalSPDeposits_0 - troveManager.getTroveEntireDebt(troveIDs.D);
        makeSPWithdrawalAndClaim(A, debtSPDelta - 1e12);
        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
        assertEq(activePool.calcPendingAggInterest(), 0);

        assertEq(stabilityPool.currentScale(), 0);

        // A liquidates D
        liquidate(A, troveIDs.D);

        // Check scale increased
        assertEq(stabilityPool.currentScale(), 1);

        // C and D makes fresh deposit
        uint256 deposit_C = 1e27;
        uint256 deposit_D = 1e27;
        makeSPDepositAndClaim(C, deposit_C);
        transferBold(C, D, deposit_D);
        makeSPDepositAndClaim(D, deposit_D);

        // fast-forward time again and accrue interest
        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);
        uint256 expectedSpYield_1 = SP_YIELD_SPLIT * pendingAggInterest_1 / 1e18;

        // Expected reward round 2 calculated with a different totalSPDeposits denominator.
        expectedShareOfReward[1].A = getShareofSPReward(A, expectedSpYield_1);
        expectedShareOfReward[1].B = getShareofSPReward(B, expectedSpYield_1);
        expectedShareOfReward[1].C = getShareofSPReward(C, expectedSpYield_1);
        expectedShareOfReward[1].D = getShareofSPReward(D, expectedSpYield_1);

        // Expect A, B, C and D to get reward 2
        assertGt(expectedShareOfReward[1].A, 0);
        assertGt(expectedShareOfReward[1].B, 0);
        assertGt(expectedShareOfReward[1].C, 0);
        assertGt(expectedShareOfReward[1].D, 0);
        // ... though A, B's share should be smaller than C, D's share
        assertLt(expectedShareOfReward[1].A, expectedShareOfReward[1].C);
        assertLt(expectedShareOfReward[1].A, expectedShareOfReward[1].D);
        assertLt(expectedShareOfReward[1].B, expectedShareOfReward[1].C);
        assertLt(expectedShareOfReward[1].B, expectedShareOfReward[1].D);

        // A trove gets poked again, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        // A only gets reward 2 since already claimed reward 1
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), expectedShareOfReward[1].A, 1e15);

        // B gets reward 1 + 2
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(B), expectedShareOfReward[0].B + expectedShareOfReward[1].B, 1e14
        );
        // C, D get reward 2
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(C), expectedShareOfReward[1].C, 1e14);
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(D), expectedShareOfReward[1].D, 1e14);
    }

    function testGetDepositorBoldGain_2SPDepositor2LiqScaleChangesFreshDeposit_EarnFairShareOfSPYield() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustmentsBigTroves();
        ABCDEF[3] memory expectedShareOfReward;
        uint256[3] memory pendingAggInterest;
        uint256[3] memory expectedSpYield;

        vm.warp(block.timestamp + 90 days + 1);

        pendingAggInterest[0] = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest[0], 0);
        expectedSpYield[0] = SP_YIELD_SPLIT * pendingAggInterest[0] / 1e18;

        expectedShareOfReward[0].A = getShareofSPReward(A, expectedSpYield[0]);
        expectedShareOfReward[0].B = getShareofSPReward(B, expectedSpYield[0]);
        assertGt(expectedShareOfReward[0].A, 0);
        assertGt(expectedShareOfReward[0].B, 0);
        uint256 totalSPDeposits_0 = stabilityPool.getTotalBoldDeposits();

        // Confirm the expected shares sum up to the total expected yield
        assertApproximatelyEqual(expectedShareOfReward[0].A + expectedShareOfReward[0].B, expectedSpYield[0], 1e3);

        // A withdraws some deposit so that D's liq will *almost* empty the pool - triggers a scale change.
        // This also mints interest and pays the yield to the SP
        uint256 debtSPDelta = totalSPDeposits_0 - troveManager.getTroveEntireDebt(troveIDs.D);
        makeSPWithdrawalAndClaim(A, debtSPDelta - 1e12);
        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
        assertEq(activePool.calcPendingAggInterest(), 0);

        assertEq(stabilityPool.currentScale(), 0);

        // A liquidates D
        liquidate(A, troveIDs.D);

        // Check scale increased
        assertEq(stabilityPool.currentScale(), 1);

        // C makes fresh deposit
        makeSPDepositAndClaim(C, 2000e27);

        // fast-forward time again and accrue interest
        vm.warp(block.timestamp + 90 days + 1);

        pendingAggInterest[1] = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest[1], 0);

        // E opens a Trove with debt slightly lower than the SP size
        uint256 targetDebt_E = stabilityPool.getTotalBoldDeposits() - 1e9;
        uint256 interestRate_E = 5e16;
        (uint256 debtRequest_E, uint256 upfrontFee_E) = findAmountToBorrowWithOpenTrove(targetDebt_E, interestRate_E);
        uint256 price = priceFeed.getPrice();
        uint256 coll_E = mulDivCeil(targetDebt_E, MCR, price);
        troveIDs.E = openTroveNoHints100pct(E, coll_E, debtRequest_E, interestRate_E);

        // SP depositors benefit from the upfront fee paid by E, in addition to interest
        expectedSpYield[1] = SP_YIELD_SPLIT * (pendingAggInterest[1] + upfrontFee_E) / 1e18;

        // Expected reward round 2 calculated with a different totalSPDeposits denominator.
        expectedShareOfReward[1].A = getShareofSPReward(A, expectedSpYield[1]);
        expectedShareOfReward[1].B = getShareofSPReward(B, expectedSpYield[1]);
        expectedShareOfReward[1].C = getShareofSPReward(C, expectedSpYield[1]);

        assertGt(expectedShareOfReward[1].A, 0);
        assertGt(expectedShareOfReward[1].B, 0);
        assertGt(expectedShareOfReward[1].C, 0);

        // Expect A an B rewards to be smaller than C
        assertLt(expectedShareOfReward[1].A, expectedShareOfReward[1].C);
        assertLt(expectedShareOfReward[1].B, expectedShareOfReward[1].C);

        // Price drops slightly
        priceFeed.setPrice(price - 1e18);
        // E gets liquidated
        liquidate(E, troveIDs.E);

        // Check scale increased again
        assertEq(stabilityPool.currentScale(), 2);

        // D makes fresh deposit (and interest minted and reward 2 yield paid to SP)
        transferBold(E, D, 1e18);
        makeSPDepositAndClaim(D, 1e18);

        // fast-forward time again and accrue interest
        vm.warp(block.timestamp + 2 * STALE_TROVE_DURATION);

        pendingAggInterest[2] = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest[2], 0);
        expectedSpYield[2] = SP_YIELD_SPLIT * pendingAggInterest[2] / 1e18;

        expectedShareOfReward[2].A = getShareofSPReward(A, expectedSpYield[2]);
        expectedShareOfReward[2].B = getShareofSPReward(B, expectedSpYield[2]);
        expectedShareOfReward[2].C = getShareofSPReward(C, expectedSpYield[2]);
        expectedShareOfReward[2].D = getShareofSPReward(D, expectedSpYield[2]);

        // A, B, C, D get some rewards
        assertGt(expectedShareOfReward[2].A, 0);
        assertGt(expectedShareOfReward[2].B, 0);
        assertGt(expectedShareOfReward[2].C, 0);
        assertGt(expectedShareOfReward[2].D, 0);

        // Expect A, B to get less than C
        assertLt(expectedShareOfReward[2].A, expectedShareOfReward[1].C);
        assertLt(expectedShareOfReward[2].B, expectedShareOfReward[1].C);

        // Interest minted and reward 3 triggered again
        // A trove gets poked again, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        // Expect A only gets a share of reward 2 and 3 as they already claimed their share of reward 1
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(A), expectedShareOfReward[1].A + expectedShareOfReward[2].A, 1e14, "2"
        );

        // Expect B, C get shares of rewards 1, 2 and 3 respectively
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(B),
            expectedShareOfReward[0].B + expectedShareOfReward[1].B + expectedShareOfReward[2].B,
            1e14,
            "3"
        );
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(C),
            expectedShareOfReward[0].C + expectedShareOfReward[1].C + expectedShareOfReward[2].C,
            1e14,
            "4"
        );

        // Expect D gets share of 3 only
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(D), expectedShareOfReward[2].D, 1e14, "5");
    }

    // --- 'P' tests ---

    function testLiquidationWithLowPDoesNotDecreaseP_Cheat_Fuzz(uint256 _cheatP, uint256 _surplus) public {
        // Choose a low value of P initially
        _cheatP = bound(_cheatP, 1e27, 1e29);

        // Cheat 1: manipulate contract state to make value of P low
        vm.store(
            address(stabilityPool),
            bytes32(uint256(60)), // 60th storage slot where P is stored
            bytes32(uint256(_cheatP))
        );

        // Confirm that storage slot 60 is set
        uint256 storedVal = uint256(vm.load(address(stabilityPool), bytes32(uint256(60))));
        assertEq(storedVal, _cheatP, "value of slot 60 is not set");
        // Confirm that P specfically is set
        assertEq(stabilityPool.P(), _cheatP, "P is not set");

        ABCDEF memory troveIDs = _setupForPTests();

        uint256 scale1 = stabilityPool.currentScale();

        uint256 troveDebt = troveManager.getTroveEntireDebt(troveIDs.D);

        uint256 debtDelta = troveDebt - stabilityPool.getTotalBoldDeposits();

        _surplus = bound(_surplus, debtDelta + 1e9, debtDelta + 10e18);
        // B deposits the surplus to SP
        makeSPDepositAndClaim(B, _surplus);

        // A liquidates D
        liquidate(A, troveIDs.D);

        // Confirm scale change occurred
        uint256 scale2 = stabilityPool.currentScale();
        assertGt(scale2, scale1, "scale didnt change");

        // Confirm that P has not fallen below 1e27
        assertGe(stabilityPool.P(), 1e27);
    }

    function testLiquidationsWithLowPAllowFurtherRewardsForAllFreshDepositors_Cheat_Fuzz(
        uint256 _cheatP,
        uint256 _surplus
    ) public {
        PTestVars memory testVars;

        // Choose a low value of P initially
        _cheatP = bound(_cheatP, 1e27, 1e29);

        // Cheat 1: manipulate contract state to make value of P low
        vm.store(
            address(stabilityPool),
            bytes32(uint256(60)), // 10th storage slot where P is stored
            bytes32(uint256(_cheatP))
        );

        // Confirm that storage slot 60 is set
        uint256 storedVal = uint256(vm.load(address(stabilityPool), bytes32(uint256(60))));
        assertEq(storedVal, _cheatP, "value of slot 60 is not set");
        // Confirm that P specfically is set
        assertEq(stabilityPool.P(), _cheatP, "P is not set");

        ABCDEF memory troveIDs = _setupForPTests();

        uint256 scale1 = stabilityPool.currentScale();

        // Check A owns entire SP
        assertApproximatelyEqual(
            stabilityPool.getTotalBoldDeposits(), stabilityPool.getCompoundedBoldDeposit(A), 1e14, "A should own all SP"
        );
        // Check D's trove's debt equals the SP size
        uint256 troveDebt = troveManager.getTroveEntireDebt(troveIDs.D);
        uint256 debtDelta = troveDebt - stabilityPool.getTotalBoldDeposits();

        _surplus = bound(_surplus, debtDelta + 1e9, debtDelta + 10e18);

        // B transfers BOLD to A so he can slightly top up the SP
        transferBold(B, A, boldToken.balanceOf(B) / 2);

        // A adds surplus to SP
        makeSPDepositAndClaim(A, _surplus);
        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
        assertEq(activePool.calcPendingAggInterest(), 0);

        // A liquidates C
        liquidate(A, troveIDs.C);

        // Confirm scale change occured
        uint256 scale2 = stabilityPool.currentScale();
        assertGt(scale2, scale1, "scale didnt change");

        // D sends some BOLD to C
        uint256 freshDeposit = boldToken.balanceOf(D) / 2;
        assertGt(freshDeposit, 0);

        transferBold(D, C, freshDeposit);

        // D and C make deposits
        makeSPDepositAndClaim(C, freshDeposit);
        makeSPDepositAndClaim(D, freshDeposit);

        // Check A deposit reduced to ~0
        makeSPWithdrawalAndClaim(A, stabilityPool.getCompoundedBoldDeposit(A));
        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 0, "A deposit should be zero");

        vm.warp(block.timestamp + 1 days);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);
        testVars.expectedSpYield1 = SP_YIELD_SPLIT * pendingAggInterest / 1e18;

        testVars.expectedShareOfYield1_C = getShareofSPReward(C, testVars.expectedSpYield1);
        testVars.expectedShareOfYield1_D = getShareofSPReward(D, testVars.expectedSpYield1);

        assertGt(testVars.expectedShareOfYield1_C, 0);
        assertGt(testVars.expectedShareOfYield1_D, 0);
        assertEq(testVars.expectedShareOfYield1_C, testVars.expectedShareOfYield1_D);

        testVars.totalDepositsBefore = stabilityPool.getTotalBoldDeposits();

        // // D's trove liquidated
        testVars.spEthBal1 = collToken.balanceOf(address(stabilityPool));
        liquidate(A, troveIDs.D);
        testVars.spEthBal2 = collToken.balanceOf(address(stabilityPool));

        testVars.spEthGain = testVars.spEthBal2 - testVars.spEthBal1;
        assertGt(testVars.spEthGain, 0);
        testVars.expectedShareOfColl = freshDeposit * testVars.spEthGain / testVars.totalDepositsBefore;
        assertGt(testVars.expectedShareOfColl, 0);

        testVars.boldGainC = stabilityPool.getDepositorYieldGain(C);
        testVars.boldGainD = stabilityPool.getDepositorYieldGain(D);
        assertApproximatelyEqual(testVars.expectedShareOfYield1_C, testVars.boldGainC, 1e6, "C share of yield mismatch");
        assertApproximatelyEqual(testVars.expectedShareOfYield1_D, testVars.boldGainD, 1e6, "D share of yield mismatch");

        testVars.ethGainC = stabilityPool.getDepositorCollGain(C);
        testVars.ethGainD = stabilityPool.getDepositorCollGain(D);

        assertApproximatelyEqual(testVars.expectedShareOfColl, testVars.ethGainC, 1e7, "C share of coll mismatch");
        assertApproximatelyEqual(testVars.expectedShareOfColl, testVars.ethGainD, 1e7, "D share of coll mismatch");

        // E makes deposit after 2nd liq
        transferBold(C, E, boldToken.balanceOf(C));
        makeSPDepositAndClaim(E, boldToken.balanceOf(E));

        vm.warp(block.timestamp + 90 days);

        uint256 pendingAggInterest2 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest2, 0);
        uint256 expectedSpYield2 = SP_YIELD_SPLIT * pendingAggInterest2 / 1e18;

        uint256 expectedShareOfYield2_E = getShareofSPReward(E, expectedSpYield2);
        assertGt(expectedShareOfYield2_E, 0);

        // Interest gets minted and awarded to SP
        applyPendingDebt(A, troveIDs.A);

        // check all BOLD and Coll gains are as expected
        uint256 boldGainE = stabilityPool.getDepositorYieldGain(E);

        assertApproximatelyEqual(expectedShareOfYield2_E, boldGainE, 1e9, "E share of yield mismatch");
    }

    function testLiquidationsWithLowPAllowFurtherRewardsForAllFreshDepositors_Cheat_Fixed() public {
        testLiquidationsWithLowPAllowFurtherRewardsForAllFreshDepositors_Cheat_Fuzz(
            2371624267, 555740272250686904193353073666173923435456188015
        );
    }

    function test_Issue_ShareOfCollMismatch() external {
        testLiquidationsWithLowPAllowFurtherRewardsForAllFreshDepositors_Cheat_Fuzz(0, 504242351683211589370490);
    }

    function testLiquidationsWithLowPAllowFurtherRewardsForExistingDepositors(uint256 _cheatP, uint256 _surplus)
        public
    {
        PTestVars memory testVars;

        // Choose a low value of P initially
        _cheatP = bound(_cheatP, 1e27, 1e29);

        // Cheat 1: manipulate contract state to make value of P low
        vm.store(
            address(stabilityPool),
            bytes32(uint256(60)), // 60th storage slot where P is stored
            bytes32(uint256(_cheatP))
        );

        // Confirm that storage slot 60 is set
        uint256 storedVal = uint256(vm.load(address(stabilityPool), bytes32(uint256(60))));
        assertEq(storedVal, _cheatP, "value of slot 60 is not set");
        // Confirm that P specfically is set
        assertEq(stabilityPool.P(), _cheatP, "P is not set");

        ABCDEF memory troveIDs = _setupForPTests();
        testVars.initialBoldGainA = stabilityPool.getDepositorYieldGain(A);
        testVars.initialBoldGainB = stabilityPool.getDepositorYieldGain(B);

        uint256 troveDebt = troveManager.getTroveEntireDebt(troveIDs.D);
        uint256 debtDelta = troveDebt - stabilityPool.getTotalBoldDeposits();
        // Make the surplus high enough  - in range [0.01, 1] BOLD - to leave each depositor with non-zero deposit after the liq, yet still trigger a scale change
        _surplus = bound(_surplus, debtDelta + 1e15, debtDelta + 10e18);

        // B deposits to SP
        makeSPDepositAndClaim(B, _surplus);

        // A liquidates C
        testVars.troveDebt_C = troveManager.getTroveEntireDebt(troveIDs.C);
        testVars.totalSPBeforeLiq_C = stabilityPool.getTotalBoldDeposits();
        testVars.deposit1_A = stabilityPool.getCompoundedBoldDeposit(A);
        testVars.deposit1_B = stabilityPool.getCompoundedBoldDeposit(B);

        uint256 spEthBalBefore = collToken.balanceOf(address(stabilityPool));
        liquidate(A, troveIDs.C);
        bool spTooLowAfterLiquidateA = stabilityPool.getTotalBoldDeposits() < DECIMAL_PRECISION;
        uint256 spEthBalAfter = collToken.balanceOf(address(stabilityPool));
        testVars.spEthGain1 = spEthBalAfter - spEthBalBefore;

        testVars.expectedShareOfColl1_A = testVars.deposit1_A * testVars.spEthGain1 / testVars.totalSPBeforeLiq_C;
        testVars.expectedShareOfColl1_B = testVars.deposit1_B * testVars.spEthGain1 / testVars.totalSPBeforeLiq_C;

        // Confirm scale change occured
        testVars.scale2 = stabilityPool.currentScale();

        // Check A and B deposit still non-zero
        assertGt(stabilityPool.getCompoundedBoldDeposit(A), 0);
        assertGt(stabilityPool.getCompoundedBoldDeposit(B), 0);

        testVars.deposit2_A = stabilityPool.getCompoundedBoldDeposit(A);
        testVars.deposit2_B = stabilityPool.getCompoundedBoldDeposit(B);

        // Check deposits after liq C are what we expect
        testVars.expectedDeposit1_A =
            testVars.deposit1_A - testVars.deposit1_A * testVars.troveDebt_C / testVars.totalSPBeforeLiq_C;
        testVars.expectedDeposit1_B =
            testVars.deposit1_B - testVars.deposit1_B * testVars.troveDebt_C / testVars.totalSPBeforeLiq_C;

        assertApproximatelyEqual(testVars.expectedDeposit1_A, testVars.deposit2_A, 1e18);
        assertApproximatelyEqual(testVars.expectedDeposit1_B, testVars.deposit2_B, 1e18);
        assertGt(stabilityPool.getCompoundedBoldDeposit(A), 0);
        assertGt(stabilityPool.getCompoundedBoldDeposit(B), 0);

        vm.warp(block.timestamp + 1 days);

        uint256 pendingAggInterest1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest1, 0);
        uint256 expectedSpYield1 = SP_YIELD_SPLIT * pendingAggInterest1 / 1e18;

        testVars.expectedShareOfYield1_A = getShareofSPReward(A, expectedSpYield1);
        testVars.expectedShareOfYield1_B = getShareofSPReward(B, expectedSpYield1);

        testVars.troveDebt_D = troveManager.getTroveEntireDebt(troveIDs.D);

        // D makes fresh deposit so that SP can cover the liq
        transferBold(B, D, boldToken.balanceOf(B));
        makeSPDepositAndClaim(D, boldToken.balanceOf(D));
        testVars.totalSPBeforeLiq_D = stabilityPool.getTotalBoldDeposits();
        assertGt(testVars.totalSPBeforeLiq_D, testVars.troveDebt_D);

        if (spTooLowAfterLiquidateA) {
            testVars.expectedShareOfYield1_A = getShareofSPReward(A, expectedSpYield1);
            testVars.expectedShareOfYield1_B = getShareofSPReward(B, expectedSpYield1);
        }

        assertGt(testVars.expectedShareOfYield1_A, 0);
        assertGt(testVars.expectedShareOfYield1_B, 0);

        // D's trove liquidated
        spEthBalBefore = collToken.balanceOf(address(stabilityPool));
        liquidate(A, troveIDs.D);
        spEthBalAfter = collToken.balanceOf(address(stabilityPool));
        uint256 spEthGain2 = spEthBalAfter - spEthBalBefore;
        assertGt(spEthGain2, 0);

        // Check deposits after liq D are what we expect
        testVars.expectedDeposit2_A =
            testVars.deposit2_A - testVars.deposit2_A * testVars.troveDebt_D / testVars.totalSPBeforeLiq_D;
        testVars.expectedDeposit2_B =
            testVars.deposit2_B - testVars.deposit2_B * testVars.troveDebt_D / testVars.totalSPBeforeLiq_D;

        assertApproximatelyEqual(testVars.expectedDeposit2_A, stabilityPool.getCompoundedBoldDeposit(A), 1e18);
        assertApproximatelyEqual(testVars.expectedDeposit2_B, stabilityPool.getCompoundedBoldDeposit(B), 1e18);
        assertGt(stabilityPool.getCompoundedBoldDeposit(A), 0);
        assertGt(stabilityPool.getCompoundedBoldDeposit(B), 0);

        testVars.expectedShareOfColl2_A = testVars.deposit2_A * spEthGain2 / testVars.totalSPBeforeLiq_D;
        testVars.expectedShareOfColl2_B = testVars.deposit2_B * spEthGain2 / testVars.totalSPBeforeLiq_D;

        // Check all BOLD and Coll gains are as expected
        testVars.boldGainA = stabilityPool.getDepositorYieldGain(A);
        testVars.boldGainB = stabilityPool.getDepositorYieldGain(B);
        assertApproximatelyEqual(
            testVars.initialBoldGainA + testVars.expectedShareOfYield1_A,
            testVars.boldGainA,
            1e4,
            "A yield gain mismatch"
        );
        assertApproximatelyEqual(
            testVars.initialBoldGainB + testVars.expectedShareOfYield1_B,
            testVars.boldGainB,
            1e4,
            "B yield gain mismatch"
        );

        uint256 ethGainA = stabilityPool.getDepositorCollGain(A);
        uint256 ethGainB = stabilityPool.getDepositorCollGain(B);

        // High error tolerance needed here due to initial liq
        assertApproximatelyEqual(testVars.expectedShareOfColl1_A + testVars.expectedShareOfColl2_A, ethGainA, 1e15);
        assertApproximatelyEqual(testVars.expectedShareOfColl1_B + testVars.expectedShareOfColl2_B, ethGainB, 1e15);
    }

    function testHighFractionLiqWithLowPTriggersTwoScaleChanges_Cheat_Fuzz(uint256 _cheatP, uint256 _surplus) public {
        // Choose a low value of P initially
        _cheatP = bound(_cheatP, 1e27, 1e29);

        // Cheat 1: manipulate contract state to make value of P low
        vm.store(
            address(stabilityPool),
            bytes32(uint256(60)), // 60th storage slot where P is stored
            bytes32(uint256(_cheatP))
        );

        // Confirm that storage slot 60 is set
        uint256 storedVal = uint256(vm.load(address(stabilityPool), bytes32(uint256(60))));
        assertEq(storedVal, _cheatP, "value of slot 60 is not set");
        // Confirm that P specfically is set
        console2.log(stabilityPool.P(), "stabilityPool.P()");
        console2.log(_cheatP, "_cheatP");
        assertEq(stabilityPool.P(), _cheatP, "P is not set");

        ABCDEF memory troveIDs;
        (,,, troveIDs.D) = _setupForBatchLiquidateTrovesPureOffset(1e9);
        // B leaves so only A is in the pool
        makeSPWithdrawalAndClaim(B, stabilityPool.getCompoundedBoldDeposit(B));

        uint256 scale1 = stabilityPool.currentScale();

        uint256 troveDebt = troveManager.getTroveEntireDebt(troveIDs.D);

        uint256 debtDelta = troveDebt - stabilityPool.getTotalBoldDeposits();

        // Tiny surplus
        _surplus = bound(_surplus, debtDelta + 1e9, debtDelta + 1e10);
        // B deposits the surplus to SP
        makeSPDepositAndClaim(B, _surplus);

        // A liquidates D
        liquidate(A, troveIDs.D);

        // Confirm scale increased by 2
        uint256 scale2 = stabilityPool.currentScale();
        assertEq(scale2, scale1 + 2, "scale didnt increase by 2");
    }

    function testHighFractionLiqWithLowPDoesNotDecreasePBelow1e9(uint256 _cheatP, uint256 _surplus) public {
        // Choose a low value of P initially
        _cheatP = bound(_cheatP, 1e27, 1e29);

        // Cheat 1: manipulate contract state to make value of P low
        vm.store(
            address(stabilityPool),
            bytes32(uint256(60)), // 60th storage slot where P is stored
            bytes32(uint256(_cheatP))
        );

        // Confirm that storage slot 60 is set
        uint256 storedVal = uint256(vm.load(address(stabilityPool), bytes32(uint256(60))));
        assertEq(storedVal, _cheatP, "value of slot 60 is not set");
        // Confirm that P specfically is set
        assertEq(stabilityPool.P(), _cheatP, "P is not set");

        ABCDEF memory troveIDs = _setupForPTests();

        uint256 scale1 = stabilityPool.currentScale();

        uint256 troveDebt = troveManager.getTroveEntireDebt(troveIDs.D);

        uint256 debtDelta = troveDebt - stabilityPool.getTotalBoldDeposits();

        // Tiny surplus
        _surplus = bound(_surplus, debtDelta + 1e9, debtDelta + 1e10);
        // B deposits the surplus to SP
        makeSPDepositAndClaim(B, _surplus);

        // A liquidates D
        liquidate(A, troveIDs.D);

        // Confirm scale change occurred
        uint256 scale2 = stabilityPool.currentScale();
        assertGt(scale2, scale1, "scale didnt change");

        // Confirm that P has not fallen below 1e27
        assertGe(stabilityPool.P(), 1e27);
    }

    // --- Min. 1 BOLD in SP tests ---

    // --- Liq debt x in range: (totalBoldDeposits - 1e18) < x <= totalBoldDeposits ---

    function testLiqDebtWithin1BOLDOfTotalDepositsLeaves1BOLDinSP_Fuzz(uint256 _toRedist) public {
        // The portion to redistribute is the portion of the debt that would otherwise eat into the
        // the last 1e18 BOLD in the SP.
        // We bound this in range 0 < _toRedist <= 1e18.
        _toRedist = bound(_toRedist, 1, 1e18);
        console.log(_toRedist, "_toRedist");
        assertLe(_toRedist, 1e18, "wrong _toRedist");

        uint256 rate = 5e16;

        priceFeed.setPrice(3000e18);

        uint256 toSP = 5000e18;
        openTroveNoHints100pct(A, 5 ether, toSP, rate);

        // B's target debt should be: totalBoldDeposits - 1e18 + _toRedist
        uint256 B_targetDebt = toSP - 1e18 + _toRedist;
        // B opens Trove with debt equal to the amount intended to be offset
        (uint256 B_borrow,) = findAmountToBorrowWithOpenTrove(B_targetDebt, rate);
        uint256 troveIdB = openTroveNoHints100pct(B, 5 ether, B_borrow, rate);

        // A deposits to SP
        makeSPDepositNoClaim(A, toSP);

        // Confirm that B's entire debt is within 1e18 of SP total deposits
        assertLt(stabilityPool.getTotalBoldDeposits() - troveManager.getTroveEntireDebt(troveIdB), 1e18);

        priceFeed.setPrice(300e18);

        // B Liquidated
        liquidate(A, troveIdB);

        // Confirm in fact 1e18 remains in SP
        assertEq(stabilityPool.getTotalBoldDeposits(), 1e18);
        // A's deposit after liq should be <= totalBoldDeposits, and very close to it, due to rounding error
        assertLe(stabilityPool.getCompoundedBoldDeposit(A), stabilityPool.getTotalBoldDeposits());
        assertApproximatelyEqual(stabilityPool.getCompoundedBoldDeposit(A), stabilityPool.getTotalBoldDeposits(), 1e3);
    }

    function testLiqDebtWithin1BOLDOfTotalDepositsRedistributesRemainder_Fuzz(uint256 _toRedist) public {
        // The portion to redistribute is the portion of the debt that would otherwise eat into the
        // the last 1e18 BOLD in the SP.
        // We bound this in range 0 < _toRedist <= 1e18.
        _toRedist = bound(_toRedist, 1, 1e18);

        uint256 rate = 5e16;

        priceFeed.setPrice(3000e18);

        uint256 toSP = 5000e18;
        uint256 troveIdA = openTroveNoHints100pct(A, 5 ether, toSP, rate);
        uint256 debtABefore = troveManager.getTroveEntireDebt(troveIdA);

        // B's target debt should be: totalBoldDeposits - 1e18 + _toRedist
        uint256 B_targetDebt = toSP - 1e18 + _toRedist;
        // B opens Trove with debt equal to the amount intended to be offset
        (uint256 B_borrow,) = findAmountToBorrowWithOpenTrove(B_targetDebt, rate);
        uint256 troveIdB = openTroveNoHints100pct(B, 5 ether, B_borrow, rate);

        // A deposits to SP
        makeSPDepositNoClaim(A, toSP);

        // Confirm that B's entire debt is within 1e18 of SP total deposits
        assertLt(stabilityPool.getTotalBoldDeposits() - troveManager.getTroveEntireDebt(troveIdB), 1e18);

        priceFeed.setPrice(300e18);

        // B Liquidated
        liquidate(A, troveIdB);

        // Check redistribution occured, i.e. A's debt increased by the correct amount
        console.log(troveManager.getTroveEntireDebt(troveIdA), "A debt after");
        console.log(debtABefore, "A debt before");
        console.log(getTroveEntireDebt(troveIdA) - debtABefore, "A debt after - A debt before");
        console.log(_toRedist, "_toRedist");

        // Allow small error tolerance for the redistribution reward math
        assertApproximatelyEqual(troveManager.getTroveEntireDebt(troveIdA), debtABefore + _toRedist, 1e3);
    }

    function testLiqDebtWithin1BoldOfTotalDepositsSplitsCollGainsCorrectly_Fuzz() public {
        LiqTestVars memory vars;

        // The portion to redistribute is the portion of the debt that would otherwise eat into the
        // the last 1e18 BOLD in the SP.
        // We bound this in range 0 < _toRedist <= 1e18.
        // _toRedist = bound(_toRedist, 1, 1e18);
        uint256 _toRedist = 5e17;

        uint256 rate = 5e16;

        priceFeed.setPrice(3000e18);

        uint256 toSP = 5000e18;
        uint256 troveIdA = openTroveNoHints100pct(A, 5 ether, toSP, rate);
        vars.debtABefore = troveManager.getTroveEntireDebt(troveIdA);
        vars.collABefore = troveManager.getTroveEntireColl(troveIdA);

        // B's target debt should be: totalBoldDeposits - 1e18 + _toRedist
        uint256 B_targetDebt = toSP - 1e18 + _toRedist;
        // B opens Trove with debt equal to the amount intended to be offset
        (uint256 B_borrow,) = findAmountToBorrowWithOpenTrove(B_targetDebt, rate);
        uint256 troveIdB = openTroveNoHints100pct(B, 5 ether, B_borrow, rate);
        vars.debtBBefore = troveManager.getTroveEntireDebt(troveIdB);
        vars.collBBefore = troveManager.getTroveEntireColl(troveIdB);

        // A deposits to SP
        makeSPDepositNoClaim(A, toSP);

        // Confirm that B's entire debt is within 1e18 of SP total deposits
        assertLt(stabilityPool.getTotalBoldDeposits() - vars.debtBBefore, 1e18);

        priceFeed.setPrice(300e18);

        vars.collCBefore = collToken.balanceOf(C);

        // B Liquidated by C
        liquidate(C, troveIdB);

        uint256 liqDebtOffset = vars.debtBBefore - _toRedist;

        // Check redistribution occured, i.e. A's debt increased by the correct amount
        // Allow small error tolerance for the redistribution reward math
        assertApproximatelyEqual(
            troveManager.getTroveEntireDebt(troveIdA),
            vars.debtABefore + _toRedist,
            1e3,
            "Incorrect debt increase trove A"
        );

        uint256 collToOffset = vars.collBBefore * liqDebtOffset / vars.debtBBefore;
        // For < 400 units of LST collateral, collGasComp = 0.0375 WETH + 0.5% * coll.
        // We only need the Trove's component here.
        vars.collGasComp = collToOffset / 200;

        // Check C's total WETH balance increased by the total gas comp
        assertEq(collToken.balanceOf(C), vars.collCBefore + vars.collGasComp + 375e14, "Incorrect coll increase C");

        // Check SP Coll has increased.  Expect no coll surplus for Trove owner, given massive price decrease
        vars.spCollBalAfter = stabilityPool.getCollBalance();
        vars.collToGiveToSP = collToOffset - vars.collGasComp;
        vars.collToRedist = vars.collBBefore - collToOffset;

        assertApproxEqAbs(vars.spCollBalAfter - vars.spCollBalBefore, vars.collToGiveToSP, 10, "Incorrect coll in SP");

        //  Check correct coll is redistributed to A
        assertApproxEqAbs(
            troveManager.getTroveEntireColl(troveIdA) - vars.collABefore, vars.collToRedist, 10, "Incorrect coll to A"
        );
    }

    // --- Liq debt x in range: x < (totalBoldDeposits - 1e18)

    function testLiqDebtLessThanSPMinus1BOLDLeavesSurplusInSP_Fuzz(uint256 _surplusToLeaveInSP) public {
        _surplusToLeaveInSP = bound(_surplusToLeaveInSP, 1e18, 2000e18);

        uint256 rate = 5e16;

        priceFeed.setPrice(3000e18);

        uint256 toSP = 5000e18;
        openTroveNoHints100pct(A, 5 ether, toSP, rate);

        uint256 B_targetDebt = toSP - _surplusToLeaveInSP;
        // B opens Trove with debt equal to the amount intended to be offset
        (uint256 B_borrow,) = findAmountToBorrowWithOpenTrove(B_targetDebt, rate);
        uint256 troveIdB = openTroveNoHints100pct(B, 5 ether, B_borrow, rate);

        // Reassign surplus based on B's actual debt, in case there was rounding error when calculating B's exact debt
        _surplusToLeaveInSP = toSP - troveManager.getTroveEntireDebt(troveIdB);
        assertGe(_surplusToLeaveInSP, 1e18);

        // A deposits to SP
        makeSPDepositNoClaim(A, toSP);

        // Confirm that B's entire debt is less than (totalBoldDeposits - 1e18)
        assertLe(troveManager.getTroveEntireDebt(troveIdB), stabilityPool.getTotalBoldDeposits() - 1e18);

        priceFeed.setPrice(300e18);

        // B Liquidated
        liquidate(A, troveIdB);

        // Confirm the surplus remains in the SP
        assertEq(stabilityPool.getTotalBoldDeposits(), _surplusToLeaveInSP);
        // A's deposit after liq should be <= totalBoldDeposits, and very close to it, due to rounding error
        assertLe(stabilityPool.getCompoundedBoldDeposit(A), stabilityPool.getTotalBoldDeposits());
        assertApproximatelyEqual(stabilityPool.getCompoundedBoldDeposit(A), stabilityPool.getTotalBoldDeposits(), 1e3);
    }

    function testLiqDebtLessThanSPMinus1BOLDDoesNotRedistribute_Fuzz(uint256 _surplusToLeaveInSP) public {
        _surplusToLeaveInSP = bound(_surplusToLeaveInSP, 1e18, 2000e18);

        uint256 rate = 5e16;

        priceFeed.setPrice(3000e18);

        uint256 toSP = 5000e18;
        uint256 troveIdA = openTroveNoHints100pct(A, 5 ether, toSP, rate);
        uint256 debtABefore = troveManager.getTroveEntireDebt(troveIdA);

        uint256 B_targetDebt = toSP - _surplusToLeaveInSP;
        // B opens Trove with debt equal to the amount intended to be offset
        (uint256 B_borrow,) = findAmountToBorrowWithOpenTrove(B_targetDebt, rate);
        uint256 troveIdB = openTroveNoHints100pct(B, 5 ether, B_borrow, rate);

        // Reassign surplus based on B's actual debt, in case there was rounding error in calculating B's exact debt
        _surplusToLeaveInSP = toSP - troveManager.getTroveEntireDebt(troveIdB);
        assertGe(_surplusToLeaveInSP, 1e18);

        // A deposits to SP
        makeSPDepositNoClaim(A, toSP);

        // Confirm that B's entire debt is less than (totalBoldDeposits - 1e18)
        assertLe(troveManager.getTroveEntireDebt(troveIdB), stabilityPool.getTotalBoldDeposits() - 1e18);

        priceFeed.setPrice(300e18);

        // B Liquidated
        liquidate(A, troveIdB);

        // Check redistribution did not occur, i.e. A's debt did not change
        assertEq(troveManager.getTroveEntireDebt(troveIdA), debtABefore);
    }

    // --- Liq debt x for x > totalBoldDeposits ---

    function testLiqDebtGreaterThanTotalSPLeaves1BOLDInSP_Fuzz(uint256 _toRedist) public {
        _toRedist = bound(_toRedist, 1e18 + 1, 1000e18);

        uint256 rate = 5e16;

        priceFeed.setPrice(3000e18);

        uint256 toSP = 5000e18;
        openTroveNoHints100pct(A, 5 ether, toSP, rate);

        uint256 B_targetDebt = toSP - 1e18 + _toRedist;
        // B opens Trove with debt equal to the amount intended to be offset
        (uint256 B_borrow,) = findAmountToBorrowWithOpenTrove(B_targetDebt, rate);
        uint256 troveIdB = openTroveNoHints100pct(B, 5 ether, B_borrow, rate);

        // A deposits to SP
        makeSPDepositNoClaim(A, toSP);

        // Confirm that B's entire debt is greater than totalBoldDeposits
        assertGt(troveManager.getTroveEntireDebt(troveIdB), stabilityPool.getTotalBoldDeposits());

        priceFeed.setPrice(300e18);

        // B Liquidated
        liquidate(A, troveIdB);

        // Confirm that 1e18 remains in the SP
        assertEq(stabilityPool.getTotalBoldDeposits(), 1e18);
        // A's deposit after liq should be <= totalBoldDeposits, and very close to it, due to rounding error
        assertLe(stabilityPool.getCompoundedBoldDeposit(A), stabilityPool.getTotalBoldDeposits());
        assertApproximatelyEqual(stabilityPool.getCompoundedBoldDeposit(A), stabilityPool.getTotalBoldDeposits(), 1e3);
    }

    function testLiqDebtGreaterThanTotalSPRedistributesTheRemainder_Fuzz(uint256 _toRedist) public {
        _toRedist = bound(_toRedist, 1e18 + 1, 1000e18);

        uint256 rate = 5e16;

        priceFeed.setPrice(3000e18);

        uint256 toSP = 5000e18;
        uint256 troveIdA = openTroveNoHints100pct(A, 5 ether, toSP, rate);
        uint256 debtABefore = troveManager.getTroveEntireDebt(troveIdA);

        uint256 B_targetDebt = toSP - 1e18 + _toRedist;
        // B opens Trove with debt equal to the amount intended to be offset
        (uint256 B_borrow,) = findAmountToBorrowWithOpenTrove(B_targetDebt, rate);
        uint256 troveIdB = openTroveNoHints100pct(B, 5 ether, B_borrow, rate);

        // A deposits to SP
        makeSPDepositNoClaim(A, toSP);

        // Confirm that B's entire debt is greater than totalBoldDeposits
        assertGt(troveManager.getTroveEntireDebt(troveIdB), stabilityPool.getTotalBoldDeposits());

        priceFeed.setPrice(300e18);

        // B Liquidated
        liquidate(A, troveIdB);

        // Check redistribution occured, i.e. A's debt increased by the correct amount
        // Allow small error tolerance for the redistribution reward math
        assertApproximatelyEqual(troveManager.getTroveEntireDebt(troveIdA), debtABefore + _toRedist, 1e3);
    }

    function testLiqDebtGreaterThanTotalSSplitsCollGainsCorrectly_Fuzz(uint256 _toRedist) public {
        LiqTestVars memory vars;

        _toRedist = bound(_toRedist, 1e18 + 1, 1000e18);
        // uint256 _toRedist = 1000e18;

        uint256 rate = 5e16;

        priceFeed.setPrice(3000e18);

        uint256 toSP = 5000e18;
        uint256 troveIdA = openTroveNoHints100pct(A, 5 ether, toSP, rate);
        vars.debtABefore = troveManager.getTroveEntireDebt(troveIdA);
        vars.collABefore = troveManager.getTroveEntireColl(troveIdA);

        uint256 B_targetDebt = toSP - 1e18 + _toRedist;
        // B opens Trove with debt equal to the amount intended to be offset
        (uint256 B_borrow,) = findAmountToBorrowWithOpenTrove(B_targetDebt, rate);
        uint256 troveIdB = openTroveNoHints100pct(B, 5 ether, B_borrow, rate);

        vars.debtBBefore = troveManager.getTroveEntireDebt(troveIdB);

        vars.collBBefore = troveManager.getTroveEntireColl(troveIdB);
        assertEq(vars.collBBefore, 5 ether);

        // A deposits to SP
        makeSPDepositNoClaim(A, toSP);

        uint256 spBefore = stabilityPool.getTotalBoldDeposits();

        // Reassign _toRedist based on B's actual debt, in case there was rounding error in calculating B's exact debt
        _toRedist = troveManager.getTroveEntireDebt(troveIdB) - spBefore + 1e18;

        // Confirm that B's entire debt is greater than totalBoldDeposits
        assertGt(troveManager.getTroveEntireDebt(troveIdB), spBefore);

        priceFeed.setPrice(300e18);

        vars.collCBefore = collToken.balanceOf(C);
        vars.spCollBalBefore = stabilityPool.getCollBalance();

        // B Liquidated by C
        liquidate(C, troveIdB);

        uint256 liqDebtOffset = vars.debtBBefore - _toRedist;

        assertEq(stabilityPool.getTotalBoldDeposits(), spBefore - liqDebtOffset);

        // Check debt redistribution occured, i.e. A's debt increased by the correct amount
        // Allow small error tolerance for the redistribution reward math
        assertApproximatelyEqual(troveManager.getTroveEntireDebt(troveIdA), vars.debtABefore + _toRedist, 1e3);

        // Check coll redistribution is correct

        uint256 collToOffset = vars.collBBefore * liqDebtOffset / vars.debtBBefore;
        // For < 400 units of LST collateral, collGasComp = 0.0375 WETH + 0.5% * coll.
        // We only need the Trove's component here.
        vars.collGasComp = collToOffset / 200;

        // Check C's total WETH balance increased by the total gas comp
        assertEq(collToken.balanceOf(C), vars.collCBefore + vars.collGasComp + 375e14);

        // Check SP Coll has increased.  Expect no coll surplus for Trove owner, given massive price decrease
        vars.spCollBalAfter = stabilityPool.getCollBalance();
        vars.collToGiveToSP = collToOffset - vars.collGasComp;
        vars.collToRedist = vars.collBBefore - collToOffset;

        assertApproxEqAbs(vars.spCollBalAfter - vars.spCollBalBefore, vars.collToGiveToSP, 10, "Incorrect coll in SP");

        //  Check correct coll is redistributed to A
        assertApproxEqAbs(
            troveManager.getTroveEntireColl(troveIdA) - vars.collABefore, vars.collToRedist, 10, "Incorrect coll to A"
        );
    }

    // --- Withdrawals from SP ---

    function testSingleDepositorCantWithdrawWhenLeavingLessThan1BoldInPool_Fuzz(uint256 _withdrawal) public {
        priceFeed.setPrice(3000e18);
        openTroveNoHints100pct(A, 5 ether, 2000e18, 5e16);

        _withdrawal = bound(_withdrawal, 1e18 + 1, 2e18);
        // uint256 _withdrawal = 2e18;

        // A deposits to SP
        makeSPDepositNoClaim(A, 2e18);

        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 2e18);
        assertEq(stabilityPool.getTotalBoldDeposits(), 2e18);

        vm.startPrank(A);
        vm.expectRevert("Withdrawal must leave totalBoldDeposits >= MIN_BOLD_IN_SP");
        // Claim all gains here so they don't get added to deposit
        stabilityPool.withdrawFromSP(_withdrawal, true);
    }

    function testSingleDepositorCanWithdrawWhenLeavingAtLeast1BoldInPool_Fuzz(uint256 _withdrawal) public {
        priceFeed.setPrice(3000e18);
        openTroveNoHints100pct(A, 5 ether, 2000e18, 5e16);

        // Withdraw up to 1e18, leaving 1e18 in pool
        _withdrawal = bound(_withdrawal, 0, 1e18);

        // A deposits to SP
        makeSPDepositNoClaim(A, 2e18);

        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 2e18);
        assertEq(stabilityPool.getTotalBoldDeposits(), 2e18);

        uint256 ABalBefore = boldToken.balanceOf(A);
        // A has some accrued yield from upfront fee of first Trove
        uint256 accruedYieldGains = stabilityPool.getDepositorYieldGainWithPending(A);

        // Claim all gains here so they don't get added to deposit
        makeSPWithdrawalAndClaim(A, _withdrawal);

        // Check deposit decreases and A's balance increases by correct amt
        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 2e18 - _withdrawal);
        assertEq(boldToken.balanceOf(A), ABalBefore + _withdrawal + accruedYieldGains);

        // Confirm SP has >= 1e18
        assertGe(stabilityPool.getTotalBoldDeposits(), 1e18);
    }

    // Tests TODO:
    // - Collateral gains split correctly across mixed offset + redist
    // - Liquidations when SP.totalBoldDeposits <1e18
    // - Depleted deposits can't withdraw if would leave <1e18 in SP
    // - When A can't withdraw, B can top up SP, then A can withdraw
    // - Bold yield gains added to depsosit, allowing withdrawal
}
