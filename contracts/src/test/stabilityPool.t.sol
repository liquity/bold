pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";
import {mulDivCeil} from "./Utils/math.sol";

contract SPTest is DevTestSetup {
    function _setupStashedAndCurrentETHGains() internal {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // A liqs D
        liquidate(A, troveIDs.D);
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.D)), uint8(TroveManager.Status.closedByLiquidation));

        // Check A has both stashed and current gains
        uint256 stashedETHGain_A = stabilityPool.stashedETH(A);
        uint256 currentETHGain_A = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain_A, 0);
        assertGt(currentETHGain_A, 0);

        // Check B has only current gains, no stashed
        uint256 stashedETHGain_B = stabilityPool.stashedETH(B);
        uint256 currentETHGain_B = stabilityPool.getDepositorETHGain(B);
        assertEq(stashedETHGain_B, 0);
        assertGt(currentETHGain_B, 0);
    }

    // --- provideToSP, doClaim == true, ETH gains ---
    function testProvideToSPWithClaim_WithOnlyCurrentETHGainsSendsTotalETHGainToDepositor() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        assertEq(stashedETHGain, 0);

        makeSPDepositAndClaim(A, 1e18);

        assertEq(WETH.balanceOf(A), ETHBal_A + currentETHGain);
    }

    function testProvideToSPWithClaim_WithOnlyCurrentETHGainsDoesntChangeStashedETHGain() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        assertEq(stabilityPool.stashedETH(A), 0);

        makeSPDepositAndClaim(A, 1e18);

        assertEq(stabilityPool.stashedETH(A), 0);
    }

    function testProvideToSPWithClaim_WithCurrentAndStashedETHGainsSendsTotalETHGainToDepositor() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // Check A has both stashed and current gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertGt(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPDepositAndClaim(A, 1e18);

        // Check A's ETH balance increases by total (stashed + current) ETH gain
        assertEq(WETH.balanceOf(A), ETHBal_A + stashedETHGain + currentETHGain);
    }

    function testProvideToSPWithClaim_WithCurrentAndStashedETHGainsZerosStashedETHBalance() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // Check A has both stashed and current gains
        stabilityPool.stashedETH(A);

        makeSPDepositAndClaim(A, 1e18);

        // Check A's stashed balance reduced to 0
        assertEq(stabilityPool.stashedETH(A), 0);
    }

    function testProvideToSPWithClaim_WithOnlyStashedETHGainsSendsStashedETHGainToDepositor() public {
        _setupForSPDepositAdjustments();

        // Stash gains
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertEq(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPDepositAndClaim(A, 1e18);

        // Check A's ETH balance increases by total stashed ETH gain
        assertEq(WETH.balanceOf(A), ETHBal_A + stashedETHGain);
    }

    function testProvideToSPWithClaim_WithOnlyStashedETHGainsZerosStashedETHBalance() public {
        _setupForSPDepositAdjustments();

        // Stash gains
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertEq(currentETHGain, 0);

        makeSPDepositAndClaim(A, 1e18);

        // Check A's stashed balance reduced to 0
        assertEq(stabilityPool.stashedETH(A), 0);
    }

    // --- provideToSP, doClaim == true, BOLD gains ---

    function testProvideToSPWithClaim_WithOnlyCurrentBOLDGainsSendsTotalBOLDGainToDepositor() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 boldBal_A = boldToken.balanceOf(A);

        uint256 topUp = 1e18;
        makeSPDepositAndClaim(A, topUp);

        assertEq(boldToken.balanceOf(A), boldBal_A + currentBoldGain - topUp);
    }

    function testProvideToSPWithClaim_WithCurrentBOLDGainsZerosCurrentBOLDGains() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        // Check has currentBoldGain
        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 topUp = 1e18;
        makeSPDepositAndClaim(A, topUp);

        // Check A's currentBoldGain reduced to 0
        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
    }

    // --- provideToSP, doClaim == false, ETH gains ---

    function testProvideToSPNoClaim_WithOnlyCurrentETHGainsDoesntChangeDepositorETHBalance() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPDepositNoClaim(A, 1e18);

        assertEq(WETH.balanceOf(A), ETHBal_A);
    }

    function testProvideToSPNoClaim_WithOnlyCurrentETHGainsStashesETHGains() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        // Check A has no stashed gains
        assertEq(stabilityPool.stashedETH(A), 0);

        makeSPDepositNoClaim(A, 1e18);

        // Check A's gain got stashed
        assertEq(stabilityPool.stashedETH(A), currentETHGain);
    }

    function testProvideToSPNoClaim_WithCurrentAndStashedETHGainsDoesntChangeDepositorETHBalance() public {
        _setupStashedAndCurrentETHGains();

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPDepositNoClaim(A, 1e18);

        assertEq(WETH.balanceOf(A), ETHBal_A);
    }

    function testProvideToSPNoClaim_WithCurrentAndStashedETHGainsIncreasedStashedETHGainByCurrentGain() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // Check A has both stashed and current gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertGt(currentETHGain, 0);

        makeSPDepositNoClaim(A, 1e18);

        assertEq(stabilityPool.stashedETH(A), stashedETHGain + currentETHGain);
    }

    function testProvideToSPNoClaim_WithOnlyStashedETHGainDoesntChangeDepositorETHBalance() public {
        _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed  gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertEq(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPDepositNoClaim(A, 1e18);

        assertEq(WETH.balanceOf(A), ETHBal_A);
    }

    function testProvideToSPNoClaim_WithOnlyStashedETHGainDoesntChangeStashedETHGain() public {
        _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertEq(currentETHGain, 0);

        makeSPDepositNoClaim(A, 1e18);

        assertEq(stabilityPool.stashedETH(A), stashedETHGain);
    }

    // --- provideToSP, doClaim == false, BOLD gains ---

    function testProvideToSPNoClaimAddsBOLDGainsToDeposit() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 depositBefore_A = stabilityPool.getCompoundedBoldDeposit(A);

        uint256 topUp = 1e18;
        makeSPDepositNoClaim(A, topUp);

        assertEq(stabilityPool.getCompoundedBoldDeposit(A), depositBefore_A + topUp + currentBoldGain);
    }

    function testProvideToSPNoClaimZerosCurrentBoldGains() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 topUp = 1e18;
        makeSPDepositNoClaim(A, topUp);

        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
    }

    function testProvideToSPNoClaimReducesDepositorBoldBalanceByOnlyTheTopUp() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 boldBalBefore_A = boldToken.balanceOf(A);

        uint256 topUp = 1e18;
        makeSPDepositNoClaim(A, topUp);

        assertEq(boldToken.balanceOf(A), boldBalBefore_A - topUp);
    }

    // --- withdrawFromSP, doClaim == true, ETH gains ---
    function testWithdrawFromSPWithClaim_WithOnlyCurrentETHGainsSendsTotalETHGainToDepositor() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        assertEq(stashedETHGain, 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        assertEq(WETH.balanceOf(A), ETHBal_A + currentETHGain);
    }

    function testWithdrawFromSPWithClaim_WithOnlyCurrentETHGainsDoesntChangeStashedETHGain() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        assertEq(stabilityPool.stashedETH(A), 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        assertEq(stabilityPool.stashedETH(A), 0);
    }

    function testWithdrawFromSPWithClaim_WithCurrentAndStashedETHGainsSendsTotalETHGainToDepositor() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        // Check A's ETH balance increases by total (stashed + current) ETH gain
        assertEq(WETH.balanceOf(A), ETHBal_A + stashedETHGain + currentETHGain);
    }

    function testWithdrawFromSPWithClaim_WithCurrentAndStashedETHGainsZerosStashedETHBalance() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // Check A has both stashed and current gains
        stabilityPool.stashedETH(A);
        stabilityPool.getDepositorETHGain(A);

        makeSPWithdrawalAndClaim(A, 1e18);

        // Check A's stashed balance reduced to 0
        assertEq(stabilityPool.stashedETH(A), 0);
    }

    function testWithdrawFromSPPWithClaim_WithOnlyStashedETHGainsSendsStashedETHGainToDepositor() public {
        _setupForSPDepositAdjustments();

        // Stash gains
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertEq(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        // Check A's ETH balance increases by total stashed ETH gain
        assertEq(WETH.balanceOf(A), ETHBal_A + stashedETHGain);
    }

    function testWithdrawFromSPWithClaim_WithOnlyStashedETHGainsZerosStashedETHBalance() public {
        _setupForSPDepositAdjustments();

        // Stash gains
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertEq(currentETHGain, 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        // Check A's stashed balance reduced to 0
        assertEq(stabilityPool.stashedETH(A), 0);
    }

    // --- withdrawFromSP, doClaim == true, BOLD gains ---
    function testWithdrawFromSPWithClaim_WithCurrentBOLDGainsSendsBOLDGainToDepositor() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 boldBal_A = boldToken.balanceOf(A);

        uint256 withdrawal = 1e18;

        makeSPWithdrawalAndClaim(A, withdrawal);

        assertEq(boldToken.balanceOf(A), boldBal_A + withdrawal + currentBoldGain);
    }

    function testWithdrawFromSPWithClaim_WithCurrentBOLDGainsZerosCurrentBoldGains() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 withdrawal = 1e18;

        makeSPWithdrawalAndClaim(A, withdrawal);

        // Check A's BOLD gain reduced to 0
        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
    }

    // --- withdrawFromSP, doClaim == false, ETH gains ---

    function testWithdrawFromSPNoClaim_WithOnlyCurrentETHGainsDoesntChangeDepositorETHBalance() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        assertEq(WETH.balanceOf(A), ETHBal_A);
    }

    function testWithdrawFromSPNoClaim_WithOnlyCurrentETHGainsStashesETHGains() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        // Check A has no stashed gains
        assertEq(stabilityPool.stashedETH(A), 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        // Check A's gain got stashed
        assertEq(stabilityPool.stashedETH(A), currentETHGain);
    }

    function testWithdrawFromSPNoClaim_WithCurrentAndStashedETHGainsDoesntChangeDepositorETHBalance() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // Check A has both stashed and current gains
        stabilityPool.stashedETH(A);
        stabilityPool.getDepositorETHGain(A);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        assertEq(WETH.balanceOf(A), ETHBal_A);
    }

    function testWithdrawFromSPNoClaim_WithCurrentAndStashedETHGainsIncreasedStashedGainByCurrentETHGain() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);

        makeSPWithdrawalNoClaim(A, 1e18);

        assertEq(stabilityPool.stashedETH(A), stashedETHGain + currentETHGain);
    }

    function testWithdrawFromSPNoClaim_WithOnlyStashedGainDoesntChangeDepositorETHBalance() public {
        _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed  gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertEq(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        assertEq(WETH.balanceOf(A), ETHBal_A);
    }

    function testWithdrawFromSPNoClaim_WithOnlyStashedETHGainDoesntChangeStashedETHGain() public {
        _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertEq(currentETHGain, 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        assertEq(stabilityPool.stashedETH(A), stashedETHGain);
    }

    // --- withdrawFromSP, doClaim == false, BOLD gains ---

    function testWithdrawFromSPNoClaimAddsBOLDGainsToDeposit() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 depositBefore_A = stabilityPool.getCompoundedBoldDeposit(A);

        uint256 withdrawal = 1e18;
        makeSPWithdrawalNoClaim(A, withdrawal);

        assertEq(stabilityPool.getCompoundedBoldDeposit(A), depositBefore_A - withdrawal + currentBoldGain);
    }

    function testWithdrawFromSPNoClaimZerosCurrentBoldGains() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 withdrawal = 1e18;
        makeSPWithdrawalNoClaim(A, withdrawal);

        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
    }

    function testWithdrawFromSPNoClaimReducesDepositorBoldBalanceByOnlyTheTopUp() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        // A trove gets poked, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 currentBoldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(currentBoldGain, 0);

        uint256 boldBalBefore_A = boldToken.balanceOf(A);

        uint256 withdrawal = 1e18;
        makeSPWithdrawalNoClaim(A, withdrawal);

        assertEq(boldToken.balanceOf(A), boldBalBefore_A + withdrawal);
    }

    // --- claimAllETHGains ---

    function testClaimAllETHGainsRevertsWhenUserHasNoDeposit() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // A
        uint256 compoundedDeposit_A = stabilityPool.getCompoundedBoldDeposit(A);
        assertGt(compoundedDeposit_A, 0);

        vm.startPrank(A);
        vm.expectRevert("StabilityPool: User must have no deposit");
        stabilityPool.claimAllETHGains();
        vm.stopPrank();
    }

    function testClaimAllETHGainsDoesNotChangeCompoundedDeposit() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // A withdraws deposit
        uint256 deposit_A = stabilityPool.getCompoundedBoldDeposit(A);
        makeSPWithdrawalNoClaim(A, deposit_A);

        // A
        uint256 compoundedDeposit_A = stabilityPool.getCompoundedBoldDeposit(A);
        assertEq(compoundedDeposit_A, 0);

        claimAllETHGains(A);

        assertEq(compoundedDeposit_A, stabilityPool.getCompoundedBoldDeposit(A));
    }

    function testClaimAllETHGainsDoesntChangeCurrentETHGain() public {
        _setupForSPDepositAdjustments();

        // A withdraws deposit and stashes gain
        uint256 deposit_A = stabilityPool.getCompoundedBoldDeposit(A);
        makeSPWithdrawalNoClaim(A, deposit_A);

        // Check A has only stashed gains
        uint256 stashedETHGain_A = stabilityPool.stashedETH(A);
        uint256 currentETHGain_A = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain_A, 0);
        assertEq(currentETHGain_A, 0);

        claimAllETHGains(A);

        assertEq(stabilityPool.getDepositorETHGain(A), 0);
    }

    function testClaimAllETHGainsZerosStashedETHGain() public {
        _setupForSPDepositAdjustments();

        // A withdraws deposit and stashes gain
        uint256 deposit_A = stabilityPool.getCompoundedBoldDeposit(A);
        makeSPWithdrawalNoClaim(A, deposit_A);

        // Check A has only stashed gains
        uint256 stashedETHGain_A = stabilityPool.stashedETH(A);
        uint256 currentETHGain_A = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain_A, 0);
        assertEq(currentETHGain_A, 0);

        claimAllETHGains(A);

        assertEq(stabilityPool.stashedETH(A), 0);
    }

    function testClaimAllETHGainsIncreasesUserBalanceByStashedETHGain() public {
        _setupForSPDepositAdjustments();

        // A withdraws deposit and stashes gain
        uint256 deposit_A = stabilityPool.getCompoundedBoldDeposit(A);
        makeSPWithdrawalNoClaim(A, deposit_A);

        // Check A has only stashed gains
        uint256 stashedETHGain_A = stabilityPool.stashedETH(A);
        assertGt(stashedETHGain_A, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        claimAllETHGains(A);

        assertEq(stabilityPool.stashedETH(A), 0);
        assertEq(WETH.balanceOf(A), ETHBal_A + stashedETHGain_A);
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

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0, 0);
        assertEq(boldRewardSum_1, 0);

        openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0, 0);
        assertEq(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumDoesntChangeWhenNoYieldMinted() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertEq(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0, 0);
        assertEq(boldRewardSum_1, 0);

        // Adjust a Trove in a way that doesn't incur an upfront fee
        repayBold(B, troveIDs.B, 1_000 ether);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0, 0);
        assertEq(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenTroveOpened() public {
        _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0, 0);
        assertEq(boldRewardSum_1, 0);

        openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0, 0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenTroveInterestRateAdjusted() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0, 0);
        assertEq(boldRewardSum_1, 0);

        changeInterestRateNoHints(B, troveIDs.B, 75e16);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0, 0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenTroveClosed() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);
        troveIDs.F = openTroveNoHints100pct(F, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0, 0);
        assertGt(boldRewardSum_1, 0); // yield from upfront fee

        // F sends E his bold so he can close
        vm.startPrank(F);
        boldToken.transfer(E, boldToken.balanceOf(F));
        vm.stopPrank();
        closeTrove(E, troveIDs.E);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0, 0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenTroveDebtAndCollAdjusted() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0, 0);
        assertEq(boldRewardSum_1, 0);

        adjustTrove100pct(A, troveIDs.A, 1, 1, true, true);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0, 0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenInterestAppliedPermissionlessly() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0, 0);
        assertEq(boldRewardSum_1, 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0, 0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenTroveLiquidated() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0, 0);
        assertEq(boldRewardSum_1, 0);

        // A liquidates D
        liquidate(A, troveIDs.D);
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.D)), uint8(TroveManager.Status.closedByLiquidation));

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0, 0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenRedemptionOccurs() public {
        _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0, 0);
        assertEq(boldRewardSum_1, 0);

        uint256 wethBalBefore_A = WETH.balanceOf(A);
        // A redeems
        redeem(A, 1e18);
        assertGt(WETH.balanceOf(A), wethBalBefore_A);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0, 0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenNewDepositIsMade() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0, 0);
        assertGt(boldRewardSum_1, 0); // yield from upfront fee

        // E Makes deposit
        makeSPDepositAndClaim(E, 1e18);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0, 0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenDepositToppedUp() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0, 0);
        assertGt(boldRewardSum_1, 0); // yield from upfront fee

        // A tops up deposit
        makeSPDepositAndClaim(A, 1e18);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0, 0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenDepositWithdrawn() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0, 0);
        assertGt(boldRewardSum_1, 0); // yield from upfront fee

        // A withdraws some deposit
        makeSPWithdrawalAndClaim(A, 1e18);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0, 0);
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
        assertEq(yieldGainsOwed_1, 0);

        (, uint256 upfrontFee) = openTroveHelper(E, 0, 3 ether, 2000e18, 25e16);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_2, yieldGainsOwed_1 + _getSPYield(upfrontFee));
    }

    function testBoldRewardsOwedIncreasesWhenTroveOpened() public {
        _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

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
        assertEq(yieldGainsOwed_1, 0);

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
        assertGt(yieldGainsOwed_1, 0); // yield from upfront fee

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
        assertEq(yieldGainsOwed_1, 0);

        adjustTrove100pct(A, troveIDs.A, 1, 1, true, true);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenInterestAppliedPermissionlessly() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenTroveLiquidated() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

        // A liquidates D
        liquidate(A, troveIDs.D);
        assertEq(uint8(troveManager.getTroveStatus(troveIDs.D)), uint8(TroveManager.Status.closedByLiquidation));

        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenRedemptionOccurs() public {
        _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);
        uint256 wethBalBefore_A = WETH.balanceOf(A);
        // A redeems
        redeem(A, 1e18);
        assertGt(WETH.balanceOf(A), wethBalBefore_A);

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
        assertGt(yieldGainsOwed_1, 0); // yield from upfront fee

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
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        // B withdraws entirely
        makeSPWithdrawalAndClaim(B, stabilityPool.getCompoundedBoldDeposit(B));

        // Check A has entirely of the non-zero SP deposits
        assertApproximatelyEqual(stabilityPool.getCompoundedBoldDeposit(A), stabilityPool.getTotalBoldDeposits(), 1e4);
        assertGt(stabilityPool.getTotalBoldDeposits(), 0);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);
        uint256 expectedSpYield = SP_YIELD_SPLIT * pendingAggInterest / 1e18;

        // A trove gets poked, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), expectedSpYield, 1e4);
    }

    function testGetDepositorBoldGain_2SPDepositor1RewardEvent_EarnFairShareOfSPYield() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);
        uint256 expectedSpYield = SP_YIELD_SPLIT * pendingAggInterest / 1e18;

        uint256 expectedShareOfReward_A = getShareofSPReward(A, expectedSpYield);
        uint256 expectedShareOfReward_B = getShareofSPReward(B, expectedSpYield);
        // Confirm the expected shares sum up to the total expected yield
        assertApproximatelyEqual(expectedShareOfReward_A + expectedShareOfReward_B, expectedSpYield, 1e3);
        assertGt(expectedShareOfReward_B, expectedShareOfReward_A);

        // A trove gets poked, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        // Check both depositors earn their expected shares of the yield
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), expectedShareOfReward_A, 1e4);
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(B), expectedShareOfReward_B, 1e4);
    }

    function testGetDepositorBoldGain_1SPDepositor2RewardEvent_EarnsAllSPYield() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        // B withdraws entirely
        makeSPWithdrawalAndClaim(B, stabilityPool.getCompoundedBoldDeposit(B));

        // Check A has entirely of the non-zero SP deposits
        assertApproximatelyEqual(stabilityPool.getCompoundedBoldDeposit(A), stabilityPool.getTotalBoldDeposits(), 1e4);
        assertGt(stabilityPool.getTotalBoldDeposits(), 0);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);
        uint256 expectedSpYield_1 = SP_YIELD_SPLIT * pendingAggInterest_1 / 1e18;

        // A trove gets poked, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);
        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_1, 0);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest_2 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_2, 0);
        uint256 expectedSpYield_2 = SP_YIELD_SPLIT * pendingAggInterest_2 / 1e18;

        // A trove gets poked, interest minted and yield paid to SP again
        applyTroveInterestPermissionless(B, troveIDs.A);
        uint256 yieldGainsOwed_2 = stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, 0);

        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), expectedSpYield_1 + expectedSpYield_2, 1e4);
    }

    function testGetDepositorBoldGain_2SPDepositor2RewardEvent_EarnFairShareOfSPYield() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

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
        applyTroveInterestPermissionless(B, troveIDs.A);

        // fast-forward time again and accrue interest
        vm.warp(block.timestamp + 90 days + 1);

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
        applyTroveInterestPermissionless(B, troveIDs.A);

        // Check both depositors earn their expected shares of the yield
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(A), expectedShareOfReward1_A + expectedShareOfReward2_A, 1e4
        );
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(B), expectedShareOfReward1_B + expectedShareOfReward2_B, 1e4
        );
    }

    function testGetDepositorBoldGain_2SPDepositor1Liq1FreshDeposit_EarnFairShareOfSPYield() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

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
        applyTroveInterestPermissionless(B, troveIDs.A);
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
        vm.warp(block.timestamp + 90 days + 1);

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
        applyTroveInterestPermissionless(B, troveIDs.A);

        // Check both depositors earn their expected shares of the yield
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(A), expectedShareOfReward1_A + expectedShareOfReward2_A, 1e4
        );
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(B), expectedShareOfReward1_B + expectedShareOfReward2_B, 1e4
        );
    }

    function testGetDepositorBoldGain_2SPDepositor1LiqEmptiesPoolFreshDeposit_EarnFairShareOfSPYield() public {
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

        // A withdraws some deposit so that D's liq will empty the pool. This also mints interest and pays the yield to the SP
        makeSPWithdrawalAndClaim(A, 100e18);
        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
        assertEq(activePool.calcPendingAggInterest(), 0);

        // A liquidates D
        liquidate(A, troveIDs.D);
        // Check SP has no funds now
        assertEq(stabilityPool.getTotalBoldDeposits(), 0);

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
        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);
        uint256 expectedSpYield_1 = SP_YIELD_SPLIT * pendingAggInterest_1 / 1e18;

        // Expected reward round 2 calculated with a different totalSPDeposits denominator. Expect A and B to earn 0 of
        // this reward.
        expectedShareOfReward[1].A = getShareofSPReward(A, expectedSpYield_1);
        expectedShareOfReward[1].B = getShareofSPReward(B, expectedSpYield_1);
        expectedShareOfReward[1].C = getShareofSPReward(C, expectedSpYield_1);
        expectedShareOfReward[1].D = getShareofSPReward(D, expectedSpYield_1);
        // A and B should get 0 from reward 2
        assertEq(expectedShareOfReward[1].A, 0);
        assertEq(expectedShareOfReward[1].B, 0);
        // C and D should split the entire reward 2
        assertGt(expectedShareOfReward[1].C, 0);
        assertGt(expectedShareOfReward[1].D, 0);

        // Confirm the expected shares sum up to the total expected yield
        assertApproximatelyEqual(
            expectedShareOfReward[1].A + expectedShareOfReward[1].B + expectedShareOfReward[1].C
                + expectedShareOfReward[1].D,
            expectedSpYield_1,
            1e4
        );

        // A trove gets poked again, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        // Expect A to receive 0 - they already claimed his gain 1, and gets 0 from 2nd reward
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), 0, 1e4);
        // Expect B to receive only their share of reward 1, and get 0 for 2nd reward
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(B), expectedShareOfReward[0].B, 1e4);
        // Expect C to receive a share of both reward 1 and 2
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(C), expectedShareOfReward[1].C, 1e4);
    }

    function testGetDepositorBoldGain_2SPDepositor1LiqScaleChangeFreshDeposit_EarnFairShareOfSPYield() public {
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

        // C and D makes fresh deposit
        uint256 deposit_C = 1e18;
        uint256 deposit_D = 1e18;
        makeSPDepositAndClaim(C, deposit_C);
        transferBold(C, D, deposit_D);
        makeSPDepositAndClaim(D, deposit_D);

        // fast-forward time again and accrue interest
        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);
        uint256 expectedSpYield_1 = SP_YIELD_SPLIT * pendingAggInterest_1 / 1e18;

        // Expected reward round 2 calculated with a different totalSPDeposits denominator. Expect A and B to earn 0 of
        // this reward.
        expectedShareOfReward[1].A = getShareofSPReward(A, expectedSpYield_1);
        expectedShareOfReward[1].B = getShareofSPReward(B, expectedSpYield_1);
        expectedShareOfReward[1].C = getShareofSPReward(C, expectedSpYield_1);
        expectedShareOfReward[1].D = getShareofSPReward(D, expectedSpYield_1);

        // Expect A and B to get nearly 0 (in practice, 0 due to rounding)
        assertEq(expectedShareOfReward[1].A, 0);
        assertEq(expectedShareOfReward[1].B, 0);
        // Expect C and D to get reward 2
        assertGt(expectedShareOfReward[1].C, 0);
        assertGt(expectedShareOfReward[1].D, 0);

        // Expect C and D to share almost the entirety of reward 2.
        // More precision loss tolerance here, since there's an extra div by 1e9 in A and B's reward calcs.
        assertApproximatelyEqual(expectedShareOfReward[1].C + expectedShareOfReward[1].D, expectedSpYield_1, 1e14);

        // A trove gets poked again, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        // A only gets reward 2 since already claimed reward 1
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), expectedShareOfReward[1].A, 1e15);

        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(B), expectedShareOfReward[0].B + expectedShareOfReward[1].B, 1e14
        );
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(C), expectedShareOfReward[1].C, 1e14);
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(D), expectedShareOfReward[1].D, 1e14);
    }

    function testGetDepositorBoldGain_2SPDepositor2LiqScaleChangesFreshDeposit_EarnFairShareOfSPYield() public {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
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
        uint256 deposit_C = 2000e18;
        makeSPDepositAndClaim(C, deposit_C);

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

        // Expected reward round 2 calculated with a different totalSPDeposits denominator. Expect A and B to earn 0 of
        // this reward.
        expectedShareOfReward[1].A = getShareofSPReward(A, expectedSpYield[1]);
        expectedShareOfReward[1].B = getShareofSPReward(B, expectedSpYield[1]);
        expectedShareOfReward[1].C = getShareofSPReward(C, expectedSpYield[1]);

        // Expect A and B to get nearly no share (in practice, 0 due to rounding down)
        assertEq(expectedShareOfReward[1].A, 0);
        assertEq(expectedShareOfReward[1].B, 0);
        // Expect C to get almost the full share
        assertGt(expectedShareOfReward[1].C, 0);

        // Expect C to get most of reward 2
        //  More precision loss tolerance here,since there's an extra div by 1e9 in A and B's reward calcs.
        assertApproximatelyEqual(expectedShareOfReward[1].C, expectedSpYield[1], 1e14);

        // Price drops slightly
        priceFeed.setPrice(price - 1e18);
        // E gets liquidated
        liquidate(E, troveIDs.E);

        // 2000000001000000000000
        // Check scale increased again
        assertEq(stabilityPool.currentScale(), 2);

        // D makes fresh deposit (and interest minted and reward 2 yield paid to SP)
        uint256 deposit_D = 1e18;
        transferBold(E, D, deposit_D);
        makeSPDepositAndClaim(D, deposit_D);

        // fast-forward time again and accrue interest
        vm.warp(block.timestamp + 180 days);

        pendingAggInterest[2] = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest[2], 0);
        expectedSpYield[2] = SP_YIELD_SPLIT * pendingAggInterest[2] / 1e18;

        expectedShareOfReward[2].A = getShareofSPReward(A, expectedSpYield[2]);
        expectedShareOfReward[2].B = getShareofSPReward(B, expectedSpYield[2]);
        expectedShareOfReward[2].C = getShareofSPReward(C, expectedSpYield[2]);
        expectedShareOfReward[2].D = getShareofSPReward(D, expectedSpYield[2]);

        // Expect A, B, C get nearly no share of reward 3 (in practice, 0 due to rounding down)
        assertEq(expectedShareOfReward[2].A, 0);
        assertEq(expectedShareOfReward[2].B, 0);
        assertEq(expectedShareOfReward[2].C, 0);
        // Expect D gets the entire reward 3
        assertGt(expectedShareOfReward[2].D, 0);

        // Expect D to get most of reward 3
        // More precision loss tolerance here, since there's an extra div by 1e9 in B's reward calc.
        assertApproximatelyEqual(expectedShareOfReward[2].D, expectedSpYield[2], 1e14, "1");

        // Interest minted and reward 3 triggered again
        // A trove gets poked again, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        // Expect A only gets a share of reward 2 as they already claimed their share of reward 1
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), expectedShareOfReward[1].A, 1e14, "2");

        // Expect B, C and D only get shares of rewards 1, 2 and 3 respectively
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(B), expectedShareOfReward[0].B, 1e14, "3");
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(C), expectedShareOfReward[1].C, 1e14, "4");
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(D), expectedShareOfReward[2].D, 1e14, "5");
    }
}

// TODO:
// 1) claim tests for withdrawETHGainToTrove (if we don't remove it)
//
// 2) tests for claimAllETHGains (requires deposit data & getter refactor):
//    - updates recorded deposit value
//    - updates deposit snapshots
