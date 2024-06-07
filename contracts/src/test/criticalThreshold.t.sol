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

        vm.expectRevert("BorrowerOps: Borrowing not permitted below CT");
        this.adjustTrove100pct(A, ATroveId, 0, 1, false, true);

        vm.expectRevert("BorrowerOps: Borrowing not permitted below CT");
        this.withdrawBold100pct(A, ATroveId, 1);
    }

    function testNoIncreaseDebtWithAddCollBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.expectRevert("BorrowerOps: Borrowing not permitted below CT");
        this.adjustTrove100pct(A, ATroveId, 1e18, 1, true, true);
    }

    function testNoIncreaseDebtWithWithdrawCollBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.expectRevert("BorrowerOps: Borrowing not permitted below CT");
        this.adjustTrove100pct(A, ATroveId, 1, 1, false, true);
    }

    function testWithdrawCollAlongWithRepaymentBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        uint256 initialColl = troveManager.getTroveEntireColl(ATroveId);
        adjustTrove100pct(A, ATroveId, 1e18, 1499e18, false, false);

        assertEq(troveManager.getTroveEntireColl(ATroveId), initialColl - 1e18);
    }

    function testNoCollWithdrawalWithLowRepaymentBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.expectRevert("BorrowerOps: below CT, repayment must be >= coll withdrawal");
        this.adjustTrove100pct(A, ATroveId, 1e18, 1498999999999999999999, false, false); // 1 gwei short
    }

    function testNoCollWithdrawalWithNoRepaymentBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.expectRevert("BorrowerOps: below CT, repayment must be >= coll withdrawal");
        this.adjustTrove100pct(A, ATroveId, 1, 0, false, false);

        vm.expectRevert("BorrowerOps: below CT, repayment must be >= coll withdrawal");
        this.withdrawColl(A, ATroveId, 1);
    }

    function testNoPrematureInterestRateAdjustmentIfItWouldPullTCRBelowCCR() public {
        uint256 price = CCR; // set price such that TCR=CCR when nominalTCR=100%
        priceFeed.setPrice(price);

        uint256 interestRate = 0.1 ether;
        uint256 targetDebt = 10_000 ether;
        (uint256 borrow,) = findAmountToBorrowWithOpenTrove(targetDebt, interestRate);
        uint256 troveId = openTroveNoHints100pct(A, targetDebt, borrow, interestRate);
        assertEq(troveManager.getTCR(price), CCR, "TCR should equal CCR");

        vm.expectRevert("BorrowerOps: An operation that would result in TCR < CCR is not permitted");
        this.changeInterestRateNoHints(A, troveId, 0.3 ether);
    }

    function testPrematureInterestRateAdjustmentDisallowedIfTCRAlreadyBelowCCR() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.expectRevert("BorrowerOps: An operation that would result in TCR < CCR is not permitted");
        this.changeInterestRateNoHints(A, ATroveId, 0.3 ether);
    }
}
