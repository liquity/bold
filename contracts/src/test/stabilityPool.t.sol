pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract SPTest is DevTestSetup {
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

    // --- provideToSP, doClaim == true ---
    function testProvideToSPWithClaim_WithOnlyCurrentGainsSendsTotalETHGainToDepositor() public {
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

    function testProvideToSPWithClaim_WithOnlyCurrentGainsDoesntChangeStashedGain() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        assertEq(stabilityPool.stashedETH(A), 0);

        makeSPDepositAndClaim(A, 1e18);

        assertEq(stabilityPool.stashedETH(A), 0);
    }

    function testProvideToSPWithClaim_WithCurrentAndStashedGainsSendsTotalETHGainToDepositor() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // Check A has both stashed and current gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPDepositAndClaim(A, 1e18);

        // Check A's ETH balance increases by total (stashed + current) ETH gain
        assertEq(WETH.balanceOf(A), ETHBal_A + stashedETHGain + currentETHGain);
    }

    function testProvideToSPWithClaim_WithCurrentAndStashedGainsZerosStashedETHBalance() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // Check A has both stashed and current gains
        stabilityPool.stashedETH(A);

        makeSPDepositAndClaim(A, 1e18);

        // Check A's stashed balance reduced to 0
        assertEq(stabilityPool.stashedETH(A), 0);
    }

    function testProvideToSPWithClaim_WithOnlyStashedGainsSendsStashedETHGainToDepositor() public {
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

    function testProvideToSPWithClaim_WithOnlyStashedGainsZerosStashedETHBalance() public {
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

    // --- provideToSP, doClaim == false ---

    function testProvideToSPNoClaim_WithOnlyCurrentGainsDoesntChangeDepositorETHBalance() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPDepositNoClaim(A, 1e18);

        assertEq(WETH.balanceOf(A), ETHBal_A);
    }

    function testProvideToSPNoClaim_WithOnlyCurrentETHGainsStashesGains() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        // Check A has no stashed gains
        assertEq(stabilityPool.stashedETH(A), 0);

        makeSPDepositNoClaim(A, 1e18);

        // Check A's gain got stashed
        assertEq(stabilityPool.stashedETH(A), currentETHGain);
    }

    function testProvideToSPNoClaim_WithCurrentAndStashedGainsDoesntChangeDepositorETHBalance() public {
        _setupStashedAndCurrentETHGains();

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPDepositNoClaim(A, 1e18);

        assertEq(WETH.balanceOf(A), ETHBal_A);
    }

    function testProvideToSPNoClaim_WithCurrentAndStashedGainsIncreasedStashedGainByCurrentGain() public {
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

    function testProvideToSPNoClaim_WithOnlyStashedGainDoesntChangeDepositorETHBalance() public {
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

    function testProvideToSPNoClaim_WithOnlyStashedGainDoesntChangeStashedGain() public {
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

    // --- withdrawFromSP, doClaim == true ---
    function testWithdrawFromSPWithClaim_WithOnlyCurrentGainsSendsTotalETHGainToDepositor() public {
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

    function testWithdrawFromSPWithClaim_WithOnlyCurrentGainsDoesntChangeStashedGain() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        assertEq(stabilityPool.stashedETH(A), 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        assertEq(stabilityPool.stashedETH(A), 0);
    }

    function testWithdrawFromSPWithClaim_WithCurrentAndStashedGainsSendsTotalETHGainToDepositor() public {
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

    function testWithdrawFromSPWithClaim_WithCurrentAndStashedGainsZerosStashedETHBalance() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // Check A has both stashed and current gains
        stabilityPool.stashedETH(A);
        stabilityPool.getDepositorETHGain(A);

        makeSPWithdrawalAndClaim(A, 1e18);

        // Check A's stashed balance reduced to 0
        assertEq(stabilityPool.stashedETH(A), 0);
    }

    function testWithdrawFromSPPWithClaim_WithOnlyStashedGainsSendsStashedETHGainToDepositor() public {
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

    function testWithdrawFromSPWithClaim_WithOnlyStashedGainsZerosStashedETHBalance() public {
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

    // --- withdrawFromSP, doClaim == false ---

    function testWithdrawFromSPNoClaim_WithOnlyCurrentGainsDoesntChangeDepositorETHBalance() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        assertEq(WETH.balanceOf(A), ETHBal_A);
    }

    function testWithdrawFromSPNoClaim_WithOnlyCurrentETHGainsStashesGains() public {
        _setupForSPDepositAdjustments();

        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(currentETHGain, 0);

        // Check A has no stashed gains
        assertEq(stabilityPool.stashedETH(A), 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        // Check A's gain got stashed
        assertEq(stabilityPool.stashedETH(A), currentETHGain);
    }

    function testWithdrawFromSPNoClaim_WithCurrentAndStashedGainsDoesntChangeDepositorETHBalance() public {
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

    function testWithdrawFromSPNoClaim_WithCurrentAndStashedGainsIncreasedStashedGainByCurrentGain() public {
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

    function testWithdrawFromSPNoClaim_WithOnlyStashedGainDoesntChangeStashedGain() public {
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

    // --- claimAllETHGains ---

    function testClaimAllETHGainsDoesNotChangeCompoundedDeposit() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // A
        uint256 compoundedDeposit_A = stabilityPool.getCompoundedBoldDeposit(A);
        assertGt(compoundedDeposit_A, 0);

        claimAllETHGains(A);

        assertEq(compoundedDeposit_A, stabilityPool.getCompoundedBoldDeposit(A));

        // B
        uint256 compoundedDeposit_B = stabilityPool.getCompoundedBoldDeposit(B);
        assertGt(compoundedDeposit_B, 0);

        claimAllETHGains(B);

        assertEq(compoundedDeposit_B, stabilityPool.getCompoundedBoldDeposit(B));
    }

    function testClaimAllETHGainsForOnlyCurrentETHGainZerosCurrentETHGain() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // B
        uint256 curentETHGain_B = stabilityPool.getDepositorETHGain(B);
        assertGt(curentETHGain_B, 0);

        claimAllETHGains(B);

        assertEq(stabilityPool.getDepositorETHGain(B), 0);
    }

    function testClaimAllETHGainsForOnlyCurrentETHGainDoesntChangeStashedGain() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // B
        uint256 stashedGain_B = stabilityPool.stashedETH(B);
        assertEq(stashedGain_B, 0);

        claimAllETHGains(B);

        assertEq(stabilityPool.stashedETH(B), 0);
    }

    function testClaimAllETHGainsForOnlyCurrentETHGainIncreasesUserBalanceByCurrentETHGain() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        uint256 currentETHGain_B = stabilityPool.getDepositorETHGain(B);

        uint256 ETHBal_B = WETH.balanceOf(B);
        assertGt(ETHBal_B, 0);

        claimAllETHGains(B);

        assertEq(stabilityPool.stashedETH(B), 0);
        assertEq(WETH.balanceOf(B), ETHBal_B + currentETHGain_B);
    }

    function testClaimAllETHGainsForCurrentAndStashedETHGainZerosCurrentETHGain() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // A
        uint256 curentETHGain_A = stabilityPool.getDepositorETHGain(A);
        assertGt(curentETHGain_A, 0);

        claimAllETHGains(A);

        assertEq(stabilityPool.getDepositorETHGain(A), 0);
    }

    function testClaimAllETHGainsForOnlyCurrentAndStashedETHGainZerosStashedETHGain() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // A
        uint256 stashedGain_A = stabilityPool.stashedETH(A);
        assertGt(stashedGain_A, 0);

        claimAllETHGains(A);

        assertEq(stabilityPool.stashedETH(A), 0);
    }

    function testClaimAllETHGainsForCurrentAndStashedETHGainIncreasesUserBalanceByTotalETHGain() public {
        // A has stashed & current gains, B has only current
        _setupStashedAndCurrentETHGains();

        // A
        uint256 stashedGain_A = stabilityPool.stashedETH(A);
        uint256 currentGain_A = stabilityPool.getDepositorETHGain(A);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        claimAllETHGains(A);

        assertEq(stabilityPool.stashedETH(A), 0);
        assertEq(WETH.balanceOf(A), ETHBal_A + stashedGain_A + currentGain_A);
    }

    function testClaimAllETHGainsForOnlyStashedETHGainDoesntChangeETHGain() public {
        _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedETHGain_A = stabilityPool.stashedETH(A);
        uint256 currentETHGain_A = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain_A, 0);
        assertEq(currentETHGain_A, 0);

        claimAllETHGains(A);

        assertEq(stabilityPool.getDepositorETHGain(A), 0);
    }

    function testClaimAllETHGainsForOnlyStashedETHGainZerosStashedETHGain() public {
        _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedETHGain_A = stabilityPool.stashedETH(A);
        uint256 currentETHGain_A = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain_A, 0);
        assertEq(currentETHGain_A, 0);

        claimAllETHGains(A);

        assertEq(stabilityPool.stashedETH(A), 0);
    }

    function testClaimAllETHGainsForOnlyStashedETHGainIncreasesUserBalanceByStashedETHGain() public {
        _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // Check A has only stashed gains
        uint256 stashedETHGain_A = stabilityPool.stashedETH(A);
        uint256 currentETHGain_A = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain_A, 0);
        assertEq(currentETHGain_A, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        claimAllETHGains(A);

        assertEq(stabilityPool.stashedETH(A), 0);
        assertEq(WETH.balanceOf(A), ETHBal_A + stashedETHGain_A);
    }

    // --- Bold reward sum 'B' tests ---

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

    // ---- boldRewardsOwed tests ---

      function testBoldRewardsOwedIncreasesWhenTroveOpened() public {
        _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardsOwed_1 = stabilityPool.getBoldRewardsOwed();
        assertEq(boldRewardsOwed_1, 0);

        openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        uint256 boldRewardsOwed_2 =  stabilityPool.getBoldRewardsOwed();
        assertGt(boldRewardsOwed_2, boldRewardsOwed_1);
    }
    
    function testBoldRewardsOwedIncreasesWhenTroveInterestRateAdjusted() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardsOwed_1 = stabilityPool.getBoldRewardsOwed();
        assertEq(boldRewardsOwed_1, 0);

        changeInterestRateNoHints(B, troveIDs.B, 75e16);

        uint256 boldRewardsOwed_2 =  stabilityPool.getBoldRewardsOwed();
        assertGt(boldRewardsOwed_2, boldRewardsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenTroveClosed() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);
        troveIDs.F = openTroveNoHints100pct(F, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardsOwed_1 = stabilityPool.getBoldRewardsOwed();
        assertEq(boldRewardsOwed_1, 0);

        // F sends E his bold so he can close
        vm.startPrank(F);
        boldToken.transfer(E, boldToken.balanceOf(F));
        vm.stopPrank();
        closeTrove(E, troveIDs.E);

        uint256 boldRewardsOwed_2 =  stabilityPool.getBoldRewardsOwed();
        assertGt(boldRewardsOwed_2, boldRewardsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenTroveDebtAndCollAdjusted() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardsOwed_1 = stabilityPool.getBoldRewardsOwed();
        assertEq(boldRewardsOwed_1, 0);

        adjustTrove100pct(
            A,
            troveIDs.A,
            1,
            1,
            true,
            true
        );

        uint256 boldRewardsOwed_2 =  stabilityPool.getBoldRewardsOwed();
        assertGt(boldRewardsOwed_2, boldRewardsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenInterestAppliedPermissionlessly() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardsOwed_1 = stabilityPool.getBoldRewardsOwed();
        assertEq(boldRewardsOwed_1, 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, troveIDs.A);

        uint256 boldRewardsOwed_2 =  stabilityPool.getBoldRewardsOwed();
        assertGt(boldRewardsOwed_2, boldRewardsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenTroveLiquidated() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardsOwed_1 = stabilityPool.getBoldRewardsOwed();
        assertEq(boldRewardsOwed_1, 0);

        // A liquidates D
        liquidate(A, troveIDs.D);
        assertEq(troveManager.getTroveStatus(troveIDs.D), 3); // Status 3 - closed by liq

        uint256 boldRewardsOwed_2 =  stabilityPool.getBoldRewardsOwed();
        assertGt(boldRewardsOwed_2, boldRewardsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenRedemptionOccurs() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardsOwed_1 = stabilityPool.getBoldRewardsOwed();
        assertEq(boldRewardsOwed_1, 0);
        uint256 wethBalBefore_A = WETH.balanceOf(A);
        // A redeems
        redeem(A, 1e18);
        assertGt(WETH.balanceOf(A), wethBalBefore_A);

        uint256 boldRewardsOwed_2 =  stabilityPool.getBoldRewardsOwed();
        assertGt(boldRewardsOwed_2, boldRewardsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenNewDepositIsMade() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardsOwed_1 = stabilityPool.getBoldRewardsOwed();
        assertEq(boldRewardsOwed_1, 0);

        // E Makes deposit
        makeSPDepositAndClaim(E, 1e18);

        uint256 boldRewardsOwed_2 =  stabilityPool.getBoldRewardsOwed();
        assertGt(boldRewardsOwed_2, boldRewardsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenDepositToppedUp() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardsOwed_1 = stabilityPool.getBoldRewardsOwed();
        assertEq(boldRewardsOwed_1, 0);

        // A tops up deposit
        makeSPDepositAndClaim(A, 1e18);

        uint256 boldRewardsOwed_2 =  stabilityPool.getBoldRewardsOwed();
        assertGt(boldRewardsOwed_2, boldRewardsOwed_1);
    }

    function testBoldRewardsOwedIncreasesWhenDepositWithdrawn() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();
        troveIDs.E = openTroveNoHints100pct(E, 3 ether, 2000e18, 25e16);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 boldRewardsOwed_1 = stabilityPool.getBoldRewardsOwed();
        assertEq(boldRewardsOwed_1, 0);

        // A withdraws some deposit
        makeSPWithdrawalAndClaim(A, 1e18);

         uint256 boldRewardsOwed_2 =  stabilityPool.getBoldRewardsOwed();
        assertGt(boldRewardsOwed_2, boldRewardsOwed_1);
    }

    // --- depositor BOLD rewards tests ---

    function testGetDepositorBoldGain1SPDepositor1RewardEventEarnsAllSPYield() public {
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

        assertApproximatelyEqual(stabilityPool.getDepositorBoldGain(A), expectedSpYield, 1e4);
    }

    function testGetDepositorBoldGain2SPDepositor1RewardEventEarnFairShareOfSPYield() public {
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
        assertApproximatelyEqual(stabilityPool.getDepositorBoldGain(A), expectedShareOfReward_A, 1e4);
        assertApproximatelyEqual(stabilityPool.getDepositorBoldGain(B), expectedShareOfReward_B, 1e4);
    }

     function testGetDepositorBoldGain1SPDepositor2RewardEventEarnsAllSPYield() public {
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
        uint256 boldRewardsOwed_1 = stabilityPool.getBoldRewardsOwed();
        assertGt(boldRewardsOwed_1, 0);

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest_2 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_2, 0);
        uint256 expectedSpYield_2 = SP_YIELD_SPLIT * pendingAggInterest_2 / 1e18;

        // A trove gets poked, interest minted and yield paid to SP again
        applyTroveInterestPermissionless(B, troveIDs.A);
        uint256 boldRewardsOwed_2 = stabilityPool.getBoldRewardsOwed();
        assertGt(boldRewardsOwed_2, 0);

        assertApproximatelyEqual(stabilityPool.getDepositorBoldGain(A), expectedSpYield_1 + expectedSpYield_2, 1e4);
    }

    function testGetDepositorBoldGain3SPDepositor3RewardEventEarnFairShareOfSPYield() public {
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
        console.log(stabilityPool.getDepositorBoldGain(A), "stabilityPool.getDepositorBoldGain(A)");
        console.log(expectedShareOfReward1_A + expectedShareOfReward2_A, "expectedShareOfReward1_A + expectedShareOfReward2_A");
        assertApproximatelyEqual(stabilityPool.getDepositorBoldGain(A), expectedShareOfReward1_A + expectedShareOfReward2_A, 1e4);
        assertApproximatelyEqual(stabilityPool.getDepositorBoldGain(B), expectedShareOfReward1_B + expectedShareOfReward2_B, 1e4);
    }
}

// TODO:
// 1) claim tests for withdrawETHGainToTrove (if we don't remove it)
//
// 2) tests for claimAllETHGains (requires deposit data & getter refactor):
//    - updates recorded deposit value
//    - updates deposit snapshots
