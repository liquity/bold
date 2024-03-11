pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";


contract BorrowerOperationsTest is DevTestSetup {
    // closeTrove(): reverts when trove is the only one in the system", async () =>
    function testCloseLastTroveReverts() public {
        priceFeed.setPrice(2000e18);
        uint256 A_Id = openTroveNoHints100pctMaxFee(A,  100 ether, 100000e18,  1e17);

        // Artificially mint to Alice so she has enough to close her trove
        deal(address(boldToken), A, 100200e18);

        // Check she has more Bold than her trove debt
        uint256 aliceBal = boldToken.balanceOf(A);
        (uint256 aliceDebt,,,) = troveManager.getEntireDebtAndColl(A_Id);
        assertGe(aliceBal, aliceDebt, "Not enough balance");

        // check Recovery Mode
        checkRecoveryMode(false);

        // Alice attempts to close her trove
        vm.startPrank(A);
        vm.expectRevert("TroveManager: Only one trove in the system");
        borrowerOperations.closeTrove(A_Id);
        vm.stopPrank();
    }
}
