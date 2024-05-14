pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract SPTest is DevTestSetup {
    function _setupStashedAndCurrentETHGains() internal {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();

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
        uint256 stashedETHGain = stabilityPool.stashedETH(A);

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
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);

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
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);

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
}

// TODO:
// 1) claim tests for withdrawETHGainToTrove (if we don't remove it)
//
// 2) tests for claimAllETHGains (requires deposit data & getter refactor):
//    - updates recorded deposit value
//    - updates deposit snapshots
