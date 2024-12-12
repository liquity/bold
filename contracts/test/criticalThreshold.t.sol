// SPDX-License-Identifier: MIT

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

        vm.expectRevert(TroveManager.NothingToLiquidate.selector);
        troveManager.liquidate(BTroveId);
    }

    function testNoNewTrovesWithFinalTCRBelowCT() public {
        setUpBelowCT();

        vm.expectRevert(BorrowerOperations.TCRBelowCCR.selector);
        this.openTroveNoHints100pct(C, 2.3 ether, 3000e18, 1e17); // CR: ~110%
    }

    function testNewTrovesWithFinalTCRAboveCT() public {
        setUpBelowCT();

        this.openTroveNoHints100pct(C, 100 ether, 10000e18, 1e17); // CR: ~1500%
        uint256 price = priceFeed.getPrice();
        assertGe(troveManager.getTCR(price), CCR, "TCR should be >= CCR");
    }

    function testNoIncreaseDebtAloneWithFinalTCRBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.expectRevert(BorrowerOperations.TCRBelowCCR.selector);
        this.adjustTrove100pct(A, ATroveId, 0, 1, false, true);

        vm.expectRevert(BorrowerOperations.TCRBelowCCR.selector);
        this.withdrawBold100pct(A, ATroveId, 1);
    }

    function testNoIncreaseDebtWithAddCollWithFinalTCRBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        uint256 price = priceFeed.getPrice();
        vm.expectRevert(BorrowerOperations.TCRBelowCCR.selector);
        this.adjustTrove100pct(A, ATroveId, 1.1 ether, price, true, true);
    }

    function testIncreaseDebtWithAddCollWithFinalTCRAboveCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        this.adjustTrove100pct(A, ATroveId, 10e18, 1, true, true);
        uint256 price = priceFeed.getPrice();
        assertGe(troveManager.getTCR(price), CCR, "TCR should be >= CCR");
    }

    function testNoIncreaseDebtWithWithdrawCollBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.expectRevert(BorrowerOperations.TCRBelowCCR.selector);
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

        vm.expectRevert(BorrowerOperations.RepaymentNotMatchingCollWithdrawal.selector);
        this.adjustTrove100pct(A, ATroveId, 1e18, 1498999999999999999999, false, false); // 1 gwei short
    }

    function testNoCollWithdrawalWithNoRepaymentBelowCT() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.expectRevert(BorrowerOperations.RepaymentNotMatchingCollWithdrawal.selector);
        this.adjustTrove100pct(A, ATroveId, 1, 0, false, false);

        vm.expectRevert(BorrowerOperations.RepaymentNotMatchingCollWithdrawal.selector);
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

        vm.expectRevert(BorrowerOperations.TCRBelowCCR.selector);
        this.changeInterestRateNoHints(A, troveId, 0.3 ether);
    }

    function testPrematureInterestRateAdjustmentDisallowedIfTCRAlreadyBelowCCR() public {
        (uint256 ATroveId,,) = setUpBelowCT();

        vm.expectRevert(BorrowerOperations.TCRBelowCCR.selector);
        this.changeInterestRateNoHints(A, ATroveId, 0.3 ether);
    }

    function testNoAdjustmentIfFinalICRLtMCRFromAbove100AddingColl() public {
        (, uint256 BTroveId,) = setUpBelowCT();
        uint256 price = 1110e18;
        priceFeed.setPrice(price); // B ICR ~101%
        assertGt(troveManager.getCurrentICR(BTroveId, price), 1e18);
        assertLt(troveManager.getCurrentICR(BTroveId, price), 110e16);

        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.ICRBelowMCR.selector);
        borrowerOperations.addColl(BTroveId, 1 ether); // 1 ETH is ~1% of trove coll, so not enough to bring it back to 100%

        // With sufficient coll it works
        borrowerOperations.addColl(BTroveId, 10 ether);
    }

    function testNoAdjustmentIfFinalICRLtMCRFromAbove100Repaying() public {
        (, uint256 BTroveId,) = setUpBelowCT();
        uint256 price = 1110e18;
        priceFeed.setPrice(price); // B ICR ~101%
        assertGt(troveManager.getCurrentICR(BTroveId, price), 1e18);
        assertLt(troveManager.getCurrentICR(BTroveId, price), 110e16);

        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.ICRBelowMCR.selector);
        borrowerOperations.repayBold(BTroveId, 1000e18); // 1k bold is less than 1% of trove debt, so not enough to bring it back to 100%

        // With sufficient repayment it works
        borrowerOperations.repayBold(BTroveId, 15000e18);
    }

    function testNoAdjustmentIfFinalICRLtMCRFromBelow100AddingColl() public {
        (, uint256 BTroveId,) = setUpBelowCT();
        uint256 price = 1059e18;
        priceFeed.setPrice(price); // B ICR < 100%
        assertLt(troveManager.getCurrentICR(BTroveId, price), 1e18);

        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.ICRBelowMCR.selector);
        borrowerOperations.addColl(BTroveId, 1 ether); // 1 ETH is ~1% of trove coll, so not enough to bring it back to 100%

        // With sufficient coll it works
        borrowerOperations.addColl(BTroveId, 15 ether);
    }

    function testNoAdjustmentIfFinalICRLtMCRFromBelow100Repaying() public {
        (, uint256 BTroveId,) = setUpBelowCT();
        uint256 price = 1059e18;
        priceFeed.setPrice(price); // B ICR < 100%
        assertLt(troveManager.getCurrentICR(BTroveId, price), 1e18);

        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.ICRBelowMCR.selector);
        borrowerOperations.repayBold(BTroveId, 1000e18); // 1k bold is less than 1% of trove debt, so not enough to bring it back to 100%

        // With sufficient repayment it works
        borrowerOperations.repayBold(BTroveId, 15000e18);
    }
}
