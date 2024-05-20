pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

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

    function _setupStashedAndCurrentETHGains() internal { 
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // A liqs D
        liquidate(A, troveIDs.D);
        assertEq(troveManager.getTroveStatus(troveIDs.D), 3); // Check D has Status 3 - closed by liquidation

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
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
       TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
       TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
       TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
       TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0,0);
        assertEq(boldRewardSum_1, 0);

        openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0,0);
        assertEq(boldRewardSum_2, boldRewardSum_1);
    }

     function testBoldRewardSumDoesntChangeWhenNoYieldMinted() public {
        _setupForSPDepositAdjustments();

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertEq(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0,0);
        assertEq(boldRewardSum_1, 0);

        openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        uint256 boldRewardSum_2 = stabilityPool.getYieldGainsOwed();
        assertEq(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenTroveOpened() public {
        _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0,0);
        assertEq(boldRewardSum_1, 0);

        openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0,0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }
    
    function testBoldRewardSumIncreasesWhenTroveInterestRateAdjusted() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0,0);
        assertEq(boldRewardSum_1, 0);

        changeInterestRateNoHints(B, troveIDs.B, 75e16);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0,0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenTroveClosed() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);
        troveIDs.F = openTroveNoHints100pct(F, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0,0);
        assertEq(boldRewardSum_1, 0);

        // F sends E his bold so he can close
        vm.startPrank(F);
        boldToken.transfer(E, boldToken.balanceOf(F));
        vm.stopPrank();
        closeTrove(E, troveIDs.E);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0,0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenTroveDebtAndCollAdjusted() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0,0);
        assertEq(boldRewardSum_1, 0);

        adjustTrove100pct(
            A,
            troveIDs.A,
            1,
            1,
            true,
            true
        );

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0,0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenInterestAppliedPermissionlessly() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0,0);
        assertEq(boldRewardSum_1, 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0,0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenTroveLiquidated() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0,0);
        assertEq(boldRewardSum_1, 0);

        // A liquidates D
        liquidate(A, troveIDs.D);
        assertEq(troveManager.getTroveStatus(troveIDs.D), 3); // Status 3 - closed by liq

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0,0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenRedemptionOccurs() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0,0);
        assertEq(boldRewardSum_1, 0);

        uint256 wethBalBefore_A = WETH.balanceOf(A);
        // A redeems
        redeem(A, 1e18);
        assertGt(WETH.balanceOf(A), wethBalBefore_A);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0,0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenNewDepositIsMade() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0,0);
        assertEq(boldRewardSum_1, 0);

        // E Makes deposit
        makeSPDepositAndClaim(E, 1e18);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0,0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenDepositToppedUp() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0,0);
        assertEq(boldRewardSum_1, 0);

        // A tops up deposit
        makeSPDepositAndClaim(A, 1e18);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0,0);
        assertGt(boldRewardSum_2, boldRewardSum_1);
    }

    function testBoldRewardSumIncreasesWhenDepositWithdrawn() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardSum_1 = stabilityPool.epochToScaleToB(0,0);
        assertEq(boldRewardSum_1, 0);

        // A withdraws some deposit
        makeSPWithdrawalAndClaim(A, 1e18);

        uint256 boldRewardSum_2 = stabilityPool.epochToScaleToB(0,0);
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

        uint256 yieldGainsOwed_2 =  stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_2, yieldGainsOwed_1);
    }

     function testBoldRewardsOwedDoesntChangeWhenNoYieldMinted() public {
        _setupForSPDepositAdjustments();

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertEq(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

        openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        uint256 yieldGainsOwed_2 =  stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenTroveOpened() public {
        _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

        openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        uint256 yieldGainsOwed_2 =  stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }
    
    function testBoldRewardsOwedIncreasesWhenTroveInterestRateAdjusted() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

        changeInterestRateNoHints(B, troveIDs.B, 75e16);

        uint256 yieldGainsOwed_2 =  stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenTroveClosed() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);
        troveIDs.F = openTroveNoHints100pct(F, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

        // F sends E his bold so he can close
        vm.startPrank(F);
        boldToken.transfer(E, boldToken.balanceOf(F));
        vm.stopPrank();
        closeTrove(E, troveIDs.E);

        uint256 yieldGainsOwed_2 =  stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenTroveDebtAndCollAdjusted() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

        adjustTrove100pct(
            A,
            troveIDs.A,
            1,
            1,
            true,
            true
        );

        uint256 yieldGainsOwed_2 =  stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenInterestAppliedPermissionlessly() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 yieldGainsOwed_2 =  stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenTroveLiquidated() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

        // A liquidates D
        liquidate(A, troveIDs.D);
        assertEq(troveManager.getTroveStatus(troveIDs.D), 3); // Status 3 - closed by liq

        uint256 yieldGainsOwed_2 =  stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenRedemptionOccurs() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);
        uint256 wethBalBefore_A = WETH.balanceOf(A);
        // A redeems
        redeem(A, 1e18);
        assertGt(WETH.balanceOf(A), wethBalBefore_A);

        uint256 yieldGainsOwed_2 =  stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenNewDepositIsMade() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

        // E Makes deposit
        makeSPDepositAndClaim(E, 1e18);

        uint256 yieldGainsOwed_2 =  stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenDepositToppedUp() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

        // A tops up deposit
        makeSPDepositAndClaim(A, 1e18);

        uint256 yieldGainsOwed_2 =  stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenDepositWithdrawn() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 yieldGainsOwed_1 = stabilityPool.getYieldGainsOwed();
        assertEq(yieldGainsOwed_1, 0);

        // A withdraws some deposit
        makeSPWithdrawalAndClaim(A, 1e18);

        uint256 yieldGainsOwed_2 =  stabilityPool.getYieldGainsOwed();
        assertGt(yieldGainsOwed_2, yieldGainsOwed_1);
    }

    // --- depositor BOLD rewards tests ---

    function testGetDepositorBoldGain_1SPDepositor1RewardEvent_EarnsAllSPYield() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), expectedShareOfReward1_A + expectedShareOfReward2_A, 1e4);
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(B), expectedShareOfReward1_B + expectedShareOfReward2_B, 1e4);
    }

    function testGetDepositorBoldGain_2SPDepositor1Liq1FreshDeposit_EarnFairShareOfSPYield() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

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
        assertEq( activePool.calcPendingAggInterest(), 0);

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
        assertApproximatelyEqual(expectedShareOfReward2_A + expectedShareOfReward2_B + expectedShareOfReward2_C, expectedSpYield_2, 1e4);

        // A trove gets poked again, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        // Check both depositors earn their expected shares of the yield
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), expectedShareOfReward1_A + expectedShareOfReward2_A, 1e4);
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(B), expectedShareOfReward1_B + expectedShareOfReward2_B, 1e4);
    }

    function testGetDepositorBoldGain_2SPDepositor1LiqEmptiesPoolFreshDeposit_EarnFairShareOfSPYield() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        ExpectedShareOfReward memory expectedShareOfReward;

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);
        uint256 expectedSpYield_1 = SP_YIELD_SPLIT * pendingAggInterest_1 / 1e18;

        expectedShareOfReward._1_A = getShareofSPReward(A, expectedSpYield_1);
        expectedShareOfReward._1_B = getShareofSPReward(B, expectedSpYield_1);
        assertGt(expectedShareOfReward._1_A, 0);
        assertGt(expectedShareOfReward._1_B, 0);
        uint256 totalSPDeposits_1 = stabilityPool.getTotalBoldDeposits();
    
        // Confirm the expected shares sum up to the total expected yield 
        assertApproximatelyEqual(expectedShareOfReward._1_A + expectedShareOfReward._1_B, expectedSpYield_1, 1e3);

        // A withdraws some deposit so that D's liq will empty the pool. This also mints interest and pays the yield to the SP
        makeSPWithdrawalAndClaim(A, 100e18);
        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
        assertEq( activePool.calcPendingAggInterest(), 0);

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
        uint256 totalSPDeposits_2 = stabilityPool.getTotalBoldDeposits();
        assertGt(totalSPDeposits_2, 0);
        assertLt(totalSPDeposits_2, totalSPDeposits_1);

        // fast-forward time again and accrue interest
        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest_2 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_2, 0);
        uint256 expectedSpYield_2 = SP_YIELD_SPLIT * pendingAggInterest_2 / 1e18;

        // Expected reward round 2 calculated with a different totalSPDeposits denominator. Expect A and B to earn 0 of
        // this reward.
        expectedShareOfReward._2_A = getShareofSPReward(A, expectedSpYield_2);
        expectedShareOfReward._2_B = getShareofSPReward(B, expectedSpYield_2);
        expectedShareOfReward._2_C = getShareofSPReward(C, expectedSpYield_2);
        expectedShareOfReward._2_D = getShareofSPReward(C, expectedSpYield_2);
        // A and B should get 0 from reward 2
        assertEq(expectedShareOfReward._2_A, 0);
        assertEq(expectedShareOfReward._2_B, 0);
        // C and D should split the entire reward 2
        assertGt(expectedShareOfReward._2_C, 0);
        assertGt(expectedShareOfReward._2_D, 0);
    
        // Confirm the expected shares sum up to the total expected yield 
        assertApproximatelyEqual(
            expectedShareOfReward._2_A + 
            expectedShareOfReward._2_B + 
            expectedShareOfReward._2_C + 
            expectedShareOfReward._2_D, 
            expectedSpYield_2, 1e4
        );

        // // A trove gets poked again, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        // Expect A to receive 0 - they already claimed his gain 1, and gets 0 from 2nd reward
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), 0, 1e4);
        // Expect B to receive only their share of reward 1, and get 0 for 2nd reward
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(B), expectedShareOfReward._1_B, 1e4);
        // Expect C to receive a share of both reward 1 and 2
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(C), expectedShareOfReward._2_C, 1e4);
    }


    function testGetDepositorBoldGain_2SPDepositor1LiqScaleChangeFreshDeposit_EarnFairShareOfSPYield() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        ExpectedShareOfReward memory expectedShareOfReward;

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);
        uint256 expectedSpYield_1 = SP_YIELD_SPLIT * pendingAggInterest_1 / 1e18;

        expectedShareOfReward._1_A = getShareofSPReward(A, expectedSpYield_1);
        expectedShareOfReward._1_B = getShareofSPReward(B, expectedSpYield_1);
        assertGt(expectedShareOfReward._1_A, 0);
        assertGt(expectedShareOfReward._1_B, 0);
        uint256 totalSPDeposits_1 = stabilityPool.getTotalBoldDeposits();
    
        // Confirm the expected shares sum up to the total expected yield 
        assertApproximatelyEqual(expectedShareOfReward._1_A + expectedShareOfReward._1_B, expectedSpYield_1, 1e3);

        // A withdraws some deposit so that D's liq will *almost* empty the pool - triggers a scale change.
        // This also mints interest and pays the yield to the SP
        uint256 debtSPDelta = totalSPDeposits_1 - troveManager.getTroveEntireDebt(troveIDs.D);
        makeSPWithdrawalAndClaim(A, debtSPDelta - 1e12);
        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
        assertEq( activePool.calcPendingAggInterest(), 0);

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

        uint256 pendingAggInterest_2 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_2, 0);
        uint256 expectedSpYield_2 = SP_YIELD_SPLIT * pendingAggInterest_2 / 1e18;

        // Expected reward round 2 calculated with a different totalSPDeposits denominator. Expect A and B to earn 0 of
        // this reward.
        expectedShareOfReward._2_A = getShareofSPReward(A, expectedSpYield_2);
        expectedShareOfReward._2_B = getShareofSPReward(B, expectedSpYield_2);
        expectedShareOfReward._2_C = getShareofSPReward(C, expectedSpYield_2);
        expectedShareOfReward._2_D = getShareofSPReward(D, expectedSpYield_2);
        
        // Expect A and B to get nearly 0 (in practice, 0 due to rounding)
        assertEq(expectedShareOfReward._2_A, 0);
        assertEq(expectedShareOfReward._2_B, 0);
        // Expect C and D to get reward 2
        assertGt(expectedShareOfReward._2_C, 0);
        assertGt(expectedShareOfReward._2_D, 0);
        
        // Expect C and D to share almost the entirety of reward 2.
        // More precision loss tolerance here, since there's an extra div by 1e9 in A and B's reward calcs.
        assertApproximatelyEqual(expectedShareOfReward._2_C + expectedShareOfReward._2_D, expectedSpYield_2, 1e14);

        // A trove gets poked again, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        // A only gets reward 2 since already claimed reward 1
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), expectedShareOfReward._2_A, 1e15);

        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(B), expectedShareOfReward._1_B + expectedShareOfReward._2_B, 1e14);
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(C), expectedShareOfReward._2_C, 1e14);
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(D), expectedShareOfReward._2_D, 1e14);
    }

   
    function testGetDepositorBoldGain_2SPDepositor2LiqScaleChangesFreshDeposit_EarnFairShareOfSPYield() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        ExpectedShareOfReward memory expectedShareOfReward;
        PendingAggInterest memory pendingAggInterest;
        ExpectedSPYield memory expectedSpYield;
        
        vm.warp(block.timestamp + 90 days + 1);

        pendingAggInterest._1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest._1, 0);
        expectedSpYield._1 = SP_YIELD_SPLIT * pendingAggInterest._1 / 1e18;

        expectedShareOfReward._1_A = getShareofSPReward(A, expectedSpYield._1);
        expectedShareOfReward._1_B = getShareofSPReward(B, expectedSpYield._1);
        assertGt(expectedShareOfReward._1_A, 0);
        assertGt(expectedShareOfReward._1_B, 0);
        uint256 totalSPDeposits_1 = stabilityPool.getTotalBoldDeposits();
    
        // Confirm the expected shares sum up to the total expected yield 
        assertApproximatelyEqual(expectedShareOfReward._1_A + expectedShareOfReward._1_B, expectedSpYield._1, 1e3);

        // A withdraws some deposit so that D's liq will *almost* empty the pool - triggers a scale change.
        // This also mints interest and pays the yield to the SP
        uint256 debtSPDelta = totalSPDeposits_1 - troveManager.getTroveEntireDebt(troveIDs.D);
        makeSPWithdrawalAndClaim(A, debtSPDelta - 1e12);
        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
        assertEq( activePool.calcPendingAggInterest(), 0);

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

        pendingAggInterest._2 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest._2, 0);
        expectedSpYield._2 = SP_YIELD_SPLIT * pendingAggInterest._2 / 1e18;

        // Expected reward round 2 calculated with a different totalSPDeposits denominator. Expect A and B to earn 0 of
        // this reward.
        expectedShareOfReward._2_A = getShareofSPReward(A, expectedSpYield._2);
        expectedShareOfReward._2_B = getShareofSPReward(B, expectedSpYield._2);
        expectedShareOfReward._2_C = getShareofSPReward(C, expectedSpYield._2);
        
        // Expect A and B to get nearly no share (in practice, 0 due to rounding down)
        assertEq(expectedShareOfReward._2_A, 0);
        assertEq(expectedShareOfReward._2_B, 0);
        // Expect C to get almost the full share
        assertGt(expectedShareOfReward._2_C, 0);
        
        // // Expect C to get most of reward 2
        //  More precision loss tolerance here,since there's an extra div by 1e9 in A and B's reward calcs.
        assertApproximatelyEqual(expectedShareOfReward._2_C, expectedSpYield._2, 1e14);

        // E creates Trove and gets liquidated
        
        uint256 debtRequest_E = stabilityPool.getTotalBoldDeposits() - BOLD_GAS_COMP - 1e9; // make E's debt slightly lower than the SP size
        uint256 price = priceFeed.getPrice();
        uint256 coll_E =  (debtRequest_E + BOLD_GAS_COMP + 1000) * MCR / price;
        troveIDs.E = openTroveNoHints100pct(E, coll_E, debtRequest_E, 5e16);
        // Price drops slightly
        priceFeed.setPrice(price - 1e18);
        liquidate(E, troveIDs.E);

        // 2000000001000000000000
         // Check scale increased again
        assertEq(stabilityPool.currentScale(), 2);

        // // D makes fresh deposit (and interest minted and reward 2 yield paid to SP)
        uint256 deposit_D = 1e18;
        transferBold(E, D, deposit_D);
        makeSPDepositAndClaim(D, deposit_D);

        // fast-forward time again and accrue interest
        vm.warp(block.timestamp + 180 days);

        pendingAggInterest._3 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest._3, 0);
        expectedSpYield._3 = SP_YIELD_SPLIT * pendingAggInterest._3 / 1e18;

        expectedShareOfReward._3_A = getShareofSPReward(A, expectedSpYield._3);
        expectedShareOfReward._3_B = getShareofSPReward(B, expectedSpYield._3);
        expectedShareOfReward._3_C = getShareofSPReward(C, expectedSpYield._3);
        expectedShareOfReward._3_D = getShareofSPReward(D, expectedSpYield._3);
        
        // Expect A, B, C get nearly no share of reward 3 (in practice, 0 due to rounding down)
        assertEq(expectedShareOfReward._3_A, 0);
        assertEq(expectedShareOfReward._3_B, 0);
        assertEq(expectedShareOfReward._3_C, 0);
        // // Expect D gets the entire reward 3
        assertGt(expectedShareOfReward._3_D, 0);

        // Expect D to get most of reward 3
        // More precision loss tolerance here, since there's an extra div by 1e9 in B's reward calc.
        assertApproximatelyEqual(expectedShareOfReward._3_D, expectedSpYield._3, 1e14);

        // Interest minted and reward 3 triggered again
         // A trove gets poked again, interst minted and yield paid to SP
        applyTroveInterestPermissionless(B, troveIDs.A);

        // Expect A only gets a share of reward 2 as they already claimed their share of reward 1
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(A), expectedShareOfReward._2_A, 1e14);

        // Expect B, C and D only get shares of rewards 1, 2 and 3 respectively
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(B), expectedShareOfReward._1_B, 1e14);
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(C), expectedShareOfReward._2_C, 1e14);
        assertApproximatelyEqual(stabilityPool.getDepositorYieldGain(D), expectedShareOfReward._3_D, 1e14);
    }
}

// TODO:
// 1) claim tests for withdrawETHGainToTrove (if we don't remove it)
//
// 2) tests for claimAllETHGains (requires deposit data & getter refactor):
//    - updates recorded deposit value
//    - updates deposit snapshots
