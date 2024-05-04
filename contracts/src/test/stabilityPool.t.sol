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

        assertEq( stabilityPool.stashedETH(A), 0);

        makeSPDepositAndClaim(A, 1e18);

        assertEq( stabilityPool.stashedETH(A), 0);
    }

    function testProvideToSPWithClaim_WithCurrentAndStashedGainsSendsTotalETHGainToDepositor() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        // Stash gains
        makeSPDepositNoClaim(A, 1e18);

        // A liqs D
        liquidate(A, troveIDs.D);
        assertEq(troveManager.getTroveStatus(troveIDs.D), 3); // Check D has Status 3 - closed by liquidation

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

    function testProvideToSPWithClaim_WithCurrentAndStashedGainsZerosStashedETHBalance() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        // Stash gains
        makeSPDepositNoClaim(A, 1e18);

        // A liqs D
        liquidate(A, troveIDs.D);
        assertEq(troveManager.getTroveStatus(troveIDs.D), 3); // Check D has Status 3 - closed by liquidation

        // Check A has both stashed and current gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertGt(currentETHGain, 0);

        makeSPDepositAndClaim(A, 1e18);

        // Check A's stashed balance reduced to 0
        assertEq(stabilityPool.stashedETH(A),0);
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
        assertEq(stabilityPool.stashedETH(A),0);
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
        assertEq( stabilityPool.stashedETH(A), 0);

        makeSPDepositNoClaim(A, 1e18);

        // Check A's gain got stashed
        assertEq(stabilityPool.stashedETH(A), currentETHGain);
    }

    function testProvideToSPNoClaim_WithCurrentAndStashedGainsDoesntChangeDepositorETHBalance() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // A liqs D
        liquidate(A, troveIDs.D);
        assertEq(troveManager.getTroveStatus(troveIDs.D), 3); // Check D has Status 3 - closed by liquidation

        // Check A has both stashed and current gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertGt(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPDepositNoClaim(A, 1e18);

        assertEq(WETH.balanceOf(A), ETHBal_A);
    }

    function testProvideToSPNoClaim_WithCurrentAndStashedGainsIncreasedStashedGainByCurrentGain() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // A liqs D
        liquidate(A, troveIDs.D);
        assertEq(troveManager.getTroveStatus(troveIDs.D), 3); // Check D has Status 3 - closed by liquidation

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

        assertEq( stabilityPool.stashedETH(A), 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        assertEq( stabilityPool.stashedETH(A), 0);
    }

    function testWithdrawFromSPWithClaim_WithCurrentAndStashedGainsSendsTotalETHGainToDepositor() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        // Stash gains
        makeSPDepositNoClaim(A, 1e18);

        // A liqs D
        liquidate(A, troveIDs.D);
        assertEq(troveManager.getTroveStatus(troveIDs.D), 3); // Check D has Status 3 - closed by liquidation

        // Check A has both stashed and current gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertGt(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        // Check A's ETH balance increases by total (stashed + current) ETH gain
        assertEq(WETH.balanceOf(A), ETHBal_A + stashedETHGain + currentETHGain);
    }

    function testWithdrawFromSPWithClaim_WithCurrentAndStashedGainsZerosStashedETHBalance() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        // Stash gains
        makeSPDepositNoClaim(A, 1e18);

        // A liqs D
        liquidate(A, troveIDs.D);
        assertEq(troveManager.getTroveStatus(troveIDs.D), 3); // Check D has Status 3 - closed by liquidation

        // Check A has both stashed and current gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertGt(currentETHGain, 0);

        makeSPWithdrawalAndClaim(A, 1e18);

        // Check A's stashed balance reduced to 0
        assertEq(stabilityPool.stashedETH(A),0);
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
        assertEq(stabilityPool.stashedETH(A),0);
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
        assertEq( stabilityPool.stashedETH(A), 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        // Check A's gain got stashed
        assertEq(stabilityPool.stashedETH(A), currentETHGain);
    }

    function testWithdrawFromSPNoClaim_WithCurrentAndStashedGainsDoesntChangeDepositorETHBalance() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // A liqs D
        liquidate(A, troveIDs.D);
        assertEq(troveManager.getTroveStatus(troveIDs.D), 3); // Check D has Status 3 - closed by liquidation

        // Check A has both stashed and current gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertGt(currentETHGain, 0);

        uint256 ETHBal_A = WETH.balanceOf(A);
        assertGt(ETHBal_A, 0);

        makeSPWithdrawalNoClaim(A, 1e18);

        assertEq(WETH.balanceOf(A), ETHBal_A);
    }

    function testWithdrawFromSPNoClaim_WithCurrentAndStashedGainsIncreasedStashedGainByCurrentGain() public {
        TroveIDs memory troveIDs = _setupForSPDepositAdjustments();

        // A stashes first gain
        makeSPDepositNoClaim(A, 1e18);

        // A liqs D
        liquidate(A, troveIDs.D);
        assertEq(troveManager.getTroveStatus(troveIDs.D), 3); // Check D has Status 3 - closed by liquidation

        // Check A has both stashed and current gains
        uint256 stashedETHGain = stabilityPool.stashedETH(A);
        uint256 currentETHGain = stabilityPool.getDepositorETHGain(A);
        assertGt(stashedETHGain, 0);
        assertGt(currentETHGain, 0);

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
}

// TODO:
// 1) tests for withdrawETHGainToTrove (if we don't remove it)
// 2) tests claimAllETHGains (requires deposit data & getter refactor):
// - updates recorded deposit value
// - updates deposit snapshots