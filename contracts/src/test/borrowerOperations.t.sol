pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract BorrowerOperationsTest is DevTestSetup {
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
