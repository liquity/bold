pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract BorrowerOperationsTest is DevTestSetup {
    // closeTrove(): reverts when trove is the only one in the system", async () =>
    function testCloseLastTroveReverts() public {
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 100000e18, 1e17);

        // Artificially mint to Alice so she has enough to close her trove
        deal(address(boldToken), A, 100400e18);

        // Check she has more Bold than her trove debt
        uint256 aliceBal = boldToken.balanceOf(A);
        uint256 aliceDebt = troveManager.getTroveEntireDebt(ATroveId);
        assertGe(aliceBal, aliceDebt, "Not enough balance");

        // check Recovery Mode
        checkRecoveryMode(false);

        // Alice attempts to close her trove
        vm.startPrank(A);
        vm.expectRevert("TroveManager: Only one trove in the system");
        borrowerOperations.closeTrove(ATroveId);
        vm.stopPrank();
    }

    function testRepayingTooMuchDebtReverts() public {
        uint256 troveId = openTroveNoHints100pct(A, 100 ether, 2_000 ether, 0.01 ether);
        deal(address(boldToken), A, 1_000 ether);
        vm.prank(A);
        vm.expectRevert("BorrowerOps: Amount repaid must not be larger than the Trove's debt");
        borrowerOperations.repayBold(troveId, 3_000 ether);
    }

    function testWithdrawingTooMuchCollateralReverts() public {
        uint256 troveId = openTroveNoHints100pct(A, 100 ether, 2_000 ether, 0.01 ether);
        vm.prank(A);
        vm.expectRevert("BorrowerOps: Can't withdraw more than the Trove's entire collateral");
        borrowerOperations.withdrawColl(troveId, 200 ether);
    }
}
