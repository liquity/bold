pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract CriticalThresholdTest is DevTestSetup {
    function setUpBelowCT() internal returns (uint256, uint256, uint256) {
        priceFeed.setPrice(2000e18);
        // TCR: 200% -> 149.9%
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 90000e18, 1e17); // CR: 222% -> 166.6%
        uint256 BTroveId = openTroveNoHints100pct(B, 100 ether, 110000e18, 1e17); // CR: ~182% -> 136.27%
        uint256 newPrice = 1499e18;
        priceFeed.setPrice(newPrice);
        assert(troveManager.checkBelowCriticalThreshold(newPrice));

        return (ATroveId, BTroveId, newPrice);
    }

    function testTrovesAreNotLiquidatedBetweenMCRAndCT() public {
        (, uint256 BTroveId, uint256 price) = setUpBelowCT();

        // Check A between MCR and CT
        uint256 AICR = troveManager.getCurrentICR(BTroveId, price);
        assertGe(AICR, MCR, "Trove A should be above MCR");
        assertLt(AICR, CCR, "Trove A should be below CT");

        vm.expectRevert("TroveManager: nothing to liquidate");
        troveManager.liquidate(BTroveId);
    }

    function testNoNewTrovesBelowCT() public {
        setUpBelowCT();

        vm.expectRevert("BorrowerOps: Operation not permitted below CT");
        this.openTroveNoHints100pct(B, 100 ether, 10000e18, 1e17); // CR: ~1500%
    }

    function testNoIncreaseDebtAloneBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.startPrank(A);
        vm.expectRevert("BorrowerOps: Borrowing not permitted below CT");
        borrowerOperations.adjustTrove(ATroveId, 0, false, 1, true);

        vm.expectRevert("BorrowerOps: Borrowing not permitted below CT");
        borrowerOperations.withdrawBold(ATroveId, 1);
        vm.stopPrank();
    }

    function testNoIncreaseDebtWithAddCollBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.startPrank(A);
        vm.expectRevert("BorrowerOps: Borrowing not permitted below CT");
        borrowerOperations.adjustTrove(ATroveId, 1e18, true, 1, true);
        vm.stopPrank();
    }

    function testNoIncreaseDebtWithWithdrawCollBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.startPrank(A);
        vm.expectRevert("BorrowerOps: Borrowing not permitted below CT");
        borrowerOperations.adjustTrove(ATroveId, 1, false, 1, true);
        vm.stopPrank();
    }

    function testWithdrawCollAlongWithRepaymentBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        uint256 initialColl = troveManager.getTroveEntireColl(ATroveId);
        vm.startPrank(A);
        borrowerOperations.adjustTrove(ATroveId, 1e18, false, 1499e18, false);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(ATroveId), initialColl - 1e18);
    }

    function testNoCollWithdrawalWithLowRepaymentBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.startPrank(A);
        vm.expectRevert("BorrowerOps: below CT, repayment must be >= coll withdrawal");
        borrowerOperations.adjustTrove(ATroveId, 1e18, false, 1498999999999999999999, false); // 1 gwei short
        vm.stopPrank();
    }

    function testNoCollWithdrawalWithNoRepaymentBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.startPrank(A);
        vm.expectRevert("BorrowerOps: below CT, repayment must be >= coll withdrawal");
        borrowerOperations.adjustTrove(ATroveId, 1, false, 0, false);

        vm.expectRevert("BorrowerOps: below CT, repayment must be >= coll withdrawal");
        borrowerOperations.withdrawColl(ATroveId, 1);
        vm.stopPrank();
    }
}
