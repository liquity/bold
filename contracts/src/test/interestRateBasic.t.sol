// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";

contract InterestRateBasic is DevTestSetup {
    function testOpenTroveSetsInterestRate() public {
        priceFeed.setPrice(2000e18);

        uint256 CTroveId = openTroveNoHints100pct(C, 2 ether, 2000e18, 37e16);
        assertEq(troveManager.getTroveAnnualInterestRate(CTroveId), 37e16);

        uint256 DTroveId = openTroveNoHints100pct(D, 2 ether, 2000e18, 1e18);
        assertEq(troveManager.getTroveAnnualInterestRate(DTroveId), 1e18);
    }

    function testOpenTroveSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);
        assertEq(troveManager.getTroveLastDebtUpdateTime(addressToTroveId(A)), 0);
        assertEq(troveManager.getTroveLastDebtUpdateTime(addressToTroveId(B)), 0);

        uint256 ATroveId = openTroveNoHints100pct(A, 2 ether, 2000e18, MIN_ANNUAL_INTEREST_RATE);
        assertEq(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        vm.warp(block.timestamp + 1000);
        uint256 BTroveId = openTroveNoHints100pct(B, 2 ether, 2000e18, MIN_ANNUAL_INTEREST_RATE);
        assertEq(troveManager.getTroveLastDebtUpdateTime(BTroveId), block.timestamp);
    }

    function testOpenTroveInsertsToCorrectPositionInSortedList() public {
        priceFeed.setPrice(2000e18);

        // Users A, B, C, D, E will open Troves with interest rates ascending in the alphabetical order of their names
        uint256 interestRate_A = MIN_ANNUAL_INTEREST_RATE;
        uint256 interestRate_B = 1e17;
        uint256 interestRate_C = 2e17;
        uint256 interestRate_D = 3e17;
        uint256 interestRate_E = 4e17;

        // B and D open
        uint256 BTroveId = openTroveNoHints100pct(B, 2 ether, 2000e18, interestRate_B);
        uint256 DTroveId = openTroveNoHints100pct(D, 2 ether, 2000e18, interestRate_D);

        // Check initial list order - expect [B, D]
        // B
        assertEq(sortedTroves.getNext(BTroveId), 0); // tail
        assertEq(sortedTroves.getPrev(BTroveId), DTroveId);
        // D
        assertEq(sortedTroves.getNext(DTroveId), BTroveId);
        assertEq(sortedTroves.getPrev(DTroveId), 0); // head

        // C opens. Expect to be inserted between B and D
        uint256 CTroveId = openTroveNoHints100pct(C, 2 ether, 2000e18, interestRate_C);
        assertEq(sortedTroves.getNext(CTroveId), BTroveId);
        assertEq(sortedTroves.getPrev(CTroveId), DTroveId);

        // A opens. Expect to be inserted at the tail, below B
        uint256 ATroveId = openTroveNoHints100pct(A, 2 ether, 2000e18, interestRate_A);
        assertEq(sortedTroves.getNext(ATroveId), 0);
        assertEq(sortedTroves.getPrev(ATroveId), BTroveId);

        // E opens. Expect to be inserted at the head, above D
        uint256 ETroveId = openTroveNoHints100pct(E, 2 ether, 2000e18, interestRate_E);
        assertEq(sortedTroves.getNext(ETroveId), DTroveId);
        assertEq(sortedTroves.getPrev(ETroveId), 0);
    }

    // TODO: uncomment this test if we pick a max, otherwise delete this test if we keep no max
    // function testRevertWhenOpenTroveWithInterestRateGreaterThanMax() public {
    //     priceFeed.setPrice(2000e18);

    //     vm.startPrank(A);
    //     vm.expectRevert();
    //     borrowerOperations.openTrove(A, 0, 1e18, 2e18, 2000e18, 0, 0, 1e18 + 1);

    //     vm.expectRevert();
    //     borrowerOperations.openTrove(A, 1, 1e18, 2e18, 2000e18, 0, 0, 42e18);
    // }

    function testRevertWhenAdjustInterestRateFromNonOwner() public {
        priceFeed.setPrice(2000e18);

        // A opens Trove
        uint256 A_Id = openTroveNoHints100pct(A, 2 ether, 2000e18, 37e16);
        assertEq(troveManager.getTroveAnnualInterestRate(A_Id), 37e16);

        // B (who is not delegate) tries to adjust it
        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.NotOwnerNorInterestManager.selector);
        borrowerOperations.adjustTroveInterestRate(A_Id, 40e16, 0, 0, 0);
        vm.stopPrank();
    }

    // TODO: uncomment this test if we pick a max, otherwise delete this test if we keep no max
    // function testRevertWhenAdjustInterestRateGreaterThanMax() public {
    //     priceFeed.setPrice(2000e18);

    //     // A opens Trove with valid annual interest rate ...
    //     uint256 ATroveId = openTroveNoHints100pct(A, 2 ether, 2000e18, 37e16);
    //     assertEq(troveManager.getTroveAnnualInterestRate(ATroveId), 37e16);

    //     // ... then tries to adjust it to an invalid value
    //     vm.startPrank(A);
    //     vm.expectRevert();
    //     borrowerOperations.adjustTroveInterestRate(ATroveId, 1e18 + 1, 0, 0);

    //     vm.expectRevert();
    //     borrowerOperations.adjustTroveInterestRate(ATroveId, 42e18, 0, 0);
    // }

    // --- adjustTroveInterestRate ---

    function testAdjustTroveInterestRateSetsCorrectNewRate() public {
        priceFeed.setPrice(2000e18);

        // A, B, C opens Troves with valid annual interest rates
        uint256 ATroveId = openTroveNoHints100pct(A, 2 ether, 2000e18, 5e17);
        uint256 BTroveId = openTroveNoHints100pct(B, 2 ether, 2000e18, 5e17);
        uint256 CTroveId = openTroveNoHints100pct(C, 2 ether, 2000e18, 5e17);
        assertEq(troveManager.getTroveAnnualInterestRate(ATroveId), 5e17);
        assertEq(troveManager.getTroveAnnualInterestRate(BTroveId), 5e17);
        assertEq(troveManager.getTroveAnnualInterestRate(CTroveId), 5e17);

        changeInterestRateNoHints(A, ATroveId, MIN_ANNUAL_INTEREST_RATE);
        assertEq(troveManager.getTroveAnnualInterestRate(ATroveId), MIN_ANNUAL_INTEREST_RATE);

        changeInterestRateNoHints(B, BTroveId, 6e17);
        assertEq(troveManager.getTroveAnnualInterestRate(BTroveId), 6e17);

        changeInterestRateNoHints(C, CTroveId, 1e18);
        assertEq(troveManager.getTroveAnnualInterestRate(CTroveId), 1e18);
    }

    function testAdjustTroveInterestRateSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);

        uint256 ATroveId = openTroveNoHints100pct(A, 2 ether, 2000e18, 5e17);

        vm.warp(block.timestamp + 1 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        changeInterestRateNoHints(A, ATroveId, 75e16);

        assertEq(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);
    }

    function testAdjustTroveInterestRateSetsReducesPendingInterestTo0() public {
        priceFeed.setPrice(2000e18);

        uint256 ATroveId = openTroveNoHints100pct(A, 2 ether, 2000e18, 5e17);

        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.calcTroveAccruedInterest(ATroveId), 0);

        changeInterestRateNoHints(A, ATroveId, 75e16);

        assertEq(troveManager.calcTroveAccruedInterest(ATroveId), 0);
    }

    function testAdjustTroveInterestRateDoesNotChangeEntireTroveDebtUnlessPremature() public {
        priceFeed.setPrice(2000e18);

        uint256 ATroveId = openTroveNoHints100pct(A, 2 ether, 2000e18, 5e17);

        // Wait for the cooldown to pass, so the adjustment will be free
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN);

        (uint256 entireTroveDebt_1,,,,) = troveManager.getEntireDebtAndColl(ATroveId);
        assertGt(entireTroveDebt_1, 0);

        changeInterestRateNoHints(A, ATroveId, 75e16);

        (uint256 entireTroveDebt_2,,,,) = troveManager.getEntireDebtAndColl(ATroveId);
        assertEq(entireTroveDebt_1, entireTroveDebt_2);

        // Wait less than the cooldown, so the adjustment will cost
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN / 2);

        (uint256 entireTroveDebt_3,,,,) = troveManager.getEntireDebtAndColl(ATroveId);
        assertGt(entireTroveDebt_3, entireTroveDebt_2);
    }

    function testAdjustTroveInterestRateIncreasesRecordedDebtByAccruedInterestAndUpfrontFee() public {
        priceFeed.setPrice(2000e18);

        uint256 ATroveId = openTroveNoHints100pct(A, 2 ether, 2000e18, 5e17);

        // Wait for the cooldown to pass, so the adjustment will be free
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN);

        uint256 recordedTroveDebt_1 = troveManager.getTroveDebt(ATroveId);
        assertGt(recordedTroveDebt_1, 0);

        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(ATroveId);
        changeInterestRateNoHints(A, ATroveId, 75e16);

        // Recorded debt only increases by accrued interest
        uint256 recordedTroveDebt_2 = troveManager.getTroveDebt(ATroveId);
        assertEq(recordedTroveDebt_2, recordedTroveDebt_1 + accruedTroveInterest, "Rec debt + interest mismatch");

        // Wait less than the cooldown, so the adjustment will cost
        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN / 2);

        accruedTroveInterest = troveManager.calcTroveAccruedInterest(ATroveId);
        uint256 upfrontFee = changeInterestRateNoHints(A, ATroveId, 80e16);

        // Recorded debt increases by accrued interest + upfront fee
        uint256 recordedTroveDebt_3 = troveManager.getTroveDebt(ATroveId);
        assertEq(
            recordedTroveDebt_3,
            recordedTroveDebt_2 + accruedTroveInterest + upfrontFee,
            "Rec debt + interest + upfront fee mismatch"
        );
    }

    function testAdjustTroveInterestRateInsertsToCorrectPositionInSortedList() public {
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pct(A, 2 ether, 2000e18, 1e17);
        uint256 BTroveId = openTroveNoHints100pct(B, 2 ether, 2000e18, 2e17);
        uint256 CTroveId = openTroveNoHints100pct(C, 2 ether, 2000e18, 3e17);
        uint256 DTroveId = openTroveNoHints100pct(D, 2 ether, 2000e18, 4e17);
        uint256 ETroveId = openTroveNoHints100pct(E, 2 ether, 2000e18, 5e17);

        // Check initial sorted list order - expect [A:10%, B:20%, C:30%, D:40%, E:50%]
        // A
        assertEq(sortedTroves.getNext(ATroveId), 0); // tail
        assertEq(sortedTroves.getPrev(ATroveId), BTroveId);
        // B
        assertEq(sortedTroves.getNext(BTroveId), ATroveId);
        assertEq(sortedTroves.getPrev(BTroveId), CTroveId);
        // C
        assertEq(sortedTroves.getNext(CTroveId), BTroveId);
        assertEq(sortedTroves.getPrev(CTroveId), DTroveId);
        // D
        assertEq(sortedTroves.getNext(DTroveId), CTroveId);
        assertEq(sortedTroves.getPrev(DTroveId), ETroveId);
        // E
        assertEq(sortedTroves.getNext(ETroveId), DTroveId);
        assertEq(sortedTroves.getPrev(ETroveId), 0); // head

        // C sets rate to 0.5%, moves to tail - expect [C:0.5%, A:10%, B:20%, D:40%, E:50%]
        changeInterestRateNoHints(C, CTroveId, MIN_ANNUAL_INTEREST_RATE);
        assertEq(sortedTroves.getNext(CTroveId), 0);
        assertEq(sortedTroves.getPrev(CTroveId), ATroveId);

        // D sets rate to 7%, moves to head - expect [C:0.5%, A:10%, B:20%, E:50%, D:70%]
        changeInterestRateNoHints(D, DTroveId, 7e17);
        assertEq(sortedTroves.getNext(DTroveId), ETroveId);
        assertEq(sortedTroves.getPrev(DTroveId), 0);

        // A sets rate to 6%, moves up 2 positions - expect [C:0.5%, B:20%, E:50%, A:60%, D:70%]
        changeInterestRateNoHints(A, ATroveId, 6e17);
        assertEq(sortedTroves.getNext(ATroveId), ETroveId);
        assertEq(sortedTroves.getPrev(ATroveId), DTroveId);
    }

    function testAdjustTroveDoesNotChangeListPositions() public {
        priceFeed.setPrice(2000e18);

        // Troves opened in ascending order of interest rate
        uint256 ATroveId = openTroveNoHints100pct(A, 2 ether, 2000e18, 1e17);
        uint256 BTroveId = openTroveNoHints100pct(B, 2 ether, 2000e18, 2e17);
        uint256 CTroveId = openTroveNoHints100pct(C, 2 ether, 2000e18, 3e17);
        uint256 DTroveId = openTroveNoHints100pct(D, 2 ether, 2000e18, 4e17);
        uint256 ETroveId = openTroveNoHints100pct(E, 2 ether, 2000e18, 5e17);

        // Check A's neighbors
        assertEq(sortedTroves.getNext(ATroveId), 0); // tail
        assertEq(sortedTroves.getPrev(ATroveId), BTroveId);

        // Adjust A's coll + debt
        adjustTrove100pct(A, ATroveId, 10 ether, 5000e18, true, true);

        // Check A's neighbors unchanged
        assertEq(sortedTroves.getNext(ATroveId), 0); // tail
        assertEq(sortedTroves.getPrev(ATroveId), BTroveId);

        // Check C's neighbors
        assertEq(sortedTroves.getNext(CTroveId), BTroveId);
        assertEq(sortedTroves.getPrev(CTroveId), DTroveId);

        // Adjust C's coll + debt
        adjustTrove100pct(C, CTroveId, 10 ether, 5000e18, true, true);

        // Check C's neighbors unchanged
        assertEq(sortedTroves.getNext(CTroveId), BTroveId);
        assertEq(sortedTroves.getPrev(CTroveId), DTroveId);

        // Check E's neighbors
        assertEq(sortedTroves.getNext(ETroveId), DTroveId);
        assertEq(sortedTroves.getPrev(ETroveId), 0); // head

        // Adjust E's coll + debt
        adjustTrove100pct(E, ETroveId, 10 ether, 5000e18, true, true);

        // Check E's neighbors unchanged
        assertEq(sortedTroves.getNext(ETroveId), DTroveId);
        assertEq(sortedTroves.getPrev(ETroveId), 0); // head
    }

    // --- withdrawBold ---

    function testWithdrawBoldSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 boldWithdrawal = 500e18;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        // A draws more debt
        withdrawBold100pct(A, ATroveId, boldWithdrawal);
        assertEq(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);
    }

    function testWithdrawBoldReducesTroveAccruedInterestTo0() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 boldWithdrawal = 500e18;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.calcTroveAccruedInterest(ATroveId), 0);

        // A draws more debt
        withdrawBold100pct(A, ATroveId, boldWithdrawal);

        assertEq(troveManager.calcTroveAccruedInterest(ATroveId), 0);
    }

    function testWithdrawBoldIncreasesEntireTroveDebtByWithdrawnAmountPlusUpfrontFee() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 boldWithdrawal = 500e18;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        uint256 entireTroveDebt_1 = troveManager.getTroveEntireDebt(ATroveId);
        assertGt(entireTroveDebt_1, 0);

        uint256 upfrontFee = predictAdjustTroveUpfrontFee(ATroveId, boldWithdrawal);
        assertGt(upfrontFee, 0);

        // A draws more debt
        withdrawBold100pct(A, ATroveId, boldWithdrawal);

        uint256 entireTroveDebt_2 = troveManager.getTroveEntireDebt(ATroveId);
        assertEq(entireTroveDebt_2, entireTroveDebt_1 + boldWithdrawal + upfrontFee);
    }

    function testWithdrawBoldIncreasesRecordedTroveDebtByAccruedInterestPlusWithdrawnAmountPlusUpfrontFee() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 boldWithdrawal = 500e18;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_1 = troveManager.getTroveDebt(ATroveId);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(ATroveId);
        uint256 upfrontFee = predictAdjustTroveUpfrontFee(ATroveId, boldWithdrawal);

        // A draws more debt
        withdrawBold100pct(A, ATroveId, boldWithdrawal);

        uint256 recordedTroveDebt_2 = troveManager.getTroveDebt(ATroveId);
        assertEq(recordedTroveDebt_2, recordedTroveDebt_1 + accruedTroveInterest + boldWithdrawal + upfrontFee);
    }

    // --- repayBold ---

    function testRepayBoldSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 3000e18;
        uint256 interestRate = 25e16;
        uint256 boldRepayment = 500e18;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        // A repays bold
        repayBold(A, ATroveId, boldRepayment);

        assertEq(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);
    }

    function testRepayBoldReducesTroveAccruedInterestTo0() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 3000e18;
        uint256 interestRate = 25e16;
        uint256 boldRepayment = 500e18;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.calcTroveAccruedInterest(ATroveId), 0);

        // A repays bold
        repayBold(A, ATroveId, boldRepayment);

        assertEq(troveManager.calcTroveAccruedInterest(ATroveId), 0);
    }

    function testRepayBoldReducesEntireTroveDebtByRepaidAmount() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 3000e18;
        uint256 interestRate = 25e16;
        uint256 boldRepayment = 500e18;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        uint256 entireTroveDebt_1 = troveManager.getTroveEntireDebt(ATroveId);
        assertGt(entireTroveDebt_1, 0);

        // A repays bold
        repayBold(A, ATroveId, boldRepayment);

        uint256 entireTroveDebt_2 = troveManager.getTroveEntireDebt(ATroveId);
        assertEq(entireTroveDebt_2, entireTroveDebt_1 - boldRepayment);
    }

    function testRepayBoldChangesRecordedTroveDebtByAccruedInterestMinusRepaidAmount() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 3000e18;
        uint256 interestRate = 25e16;
        uint256 boldRepayment = 500e18;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        LatestTroveData memory preRepay = troveManager.getLatestTroveData(ATroveId);
        // A repays bold
        repayBold(A, ATroveId, boldRepayment);
        LatestTroveData memory postRepay = troveManager.getLatestTroveData(ATroveId);

        assertEq(postRepay.recordedDebt, preRepay.recordedDebt + preRepay.accruedInterest - boldRepayment);
    }

    // --- addColl ---

    function testAddCollSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collIncrease = 1 ether;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        // A adds coll
        addColl(A, ATroveId, collIncrease);

        assertEq(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);
    }

    function testAddCollReducesTroveAccruedInterestTo0() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collIncrease = 1 ether;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.calcTroveAccruedInterest(ATroveId), 0);

        // A adds coll
        addColl(A, ATroveId, collIncrease);

        assertEq(troveManager.calcTroveAccruedInterest(ATroveId), 0);
    }

    function testAddCollDoesntChangeEntireTroveDebt() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collIncrease = 1 ether;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        uint256 entireTroveDebt_1 = troveManager.getTroveEntireDebt(ATroveId);
        assertGt(entireTroveDebt_1, 0);

        // A adds coll
        addColl(A, ATroveId, collIncrease);

        uint256 entireTroveDebt_2 = troveManager.getTroveEntireDebt(ATroveId);
        assertEq(entireTroveDebt_2, entireTroveDebt_1);
    }

    function testAddCollIncreasesRecordedTroveDebtByAccruedInterest() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collIncrease = 1 ether;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_1 = troveManager.getTroveDebt(ATroveId);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(ATroveId);

        // A adds coll
        addColl(A, ATroveId, collIncrease);

        uint256 recordedTroveDebt_2 = troveManager.getTroveDebt(ATroveId);

        assertEq(recordedTroveDebt_2, recordedTroveDebt_1 + accruedTroveInterest);
    }

    // --- withdrawColl ---

    function testWithdrawCollSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collDecrease = 1 ether;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        // A withdraws coll
        withdrawColl(A, ATroveId, collDecrease);

        assertEq(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);
    }

    function testWithdrawCollReducesTroveAccruedInterestTo0() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collDecrease = 1 ether;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.calcTroveAccruedInterest(ATroveId), 0);

        // A withdraws coll
        withdrawColl(A, ATroveId, collDecrease);

        assertEq(troveManager.calcTroveAccruedInterest(ATroveId), 0);
    }

    function testWithdrawCollDoesntChangeEntireTroveDebt() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collDecrease = 1 ether;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        uint256 entireTroveDebt_1 = troveManager.getTroveEntireDebt(ATroveId);
        assertGt(entireTroveDebt_1, 0);

        // A withdraws coll
        withdrawColl(A, ATroveId, collDecrease);

        uint256 entireTroveDebt_2 = troveManager.getTroveEntireDebt(ATroveId);
        assertEq(entireTroveDebt_2, entireTroveDebt_1);
    }

    function testWithdrawCollIncreasesRecordedTroveDebtByAccruedInterest() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collDecrease = 1 ether;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_1 = troveManager.getTroveDebt(ATroveId);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(ATroveId);

        // A withdraws coll
        withdrawColl(A, ATroveId, collDecrease);

        uint256 recordedTroveDebt_2 = troveManager.getTroveDebt(ATroveId);

        assertEq(recordedTroveDebt_2, recordedTroveDebt_1 + accruedTroveInterest);
    }

    // --- applyPendingDebt ---

    function testApplyTroveInterestPermissionlessSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        // Fast-forward time such that trove is Stale
        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(ATroveId));

        assertLt(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        // B applies A's pending interest
        applyPendingDebt(B, ATroveId);

        assertEq(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);
    }

    function testApplyTroveInterestPermissionlessReducesTroveAccruedInterestTo0() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        // Fast-forward time such that trove is Stale
        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(ATroveId));

        assertGt(troveManager.calcTroveAccruedInterest(ATroveId), 0);

        // B applies A's pending interest
        applyPendingDebt(B, ATroveId);

        assertEq(troveManager.calcTroveAccruedInterest(ATroveId), 0);
    }

    function testApplyTroveInterestPermissionlessDoesntChangeEntireTroveDebt() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        // Fast-forward time such that trove is Stale
        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(ATroveId));

        uint256 entireTroveDebt_1 = troveManager.getTroveEntireDebt(ATroveId);
        assertGt(entireTroveDebt_1, 0);

        // B applies A's pending interest
        applyPendingDebt(B, ATroveId);

        uint256 entireTroveDebt_2 = troveManager.getTroveEntireDebt(ATroveId);
        assertEq(entireTroveDebt_2, entireTroveDebt_1);
    }

    function testApplyTroveInterestPermissionlessIncreasesRecordedTroveDebtByAccruedInterest() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        // Fast-forward time such that trove is Stale
        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(ATroveId));

        uint256 recordedTroveDebt_1 = troveManager.getTroveDebt(ATroveId);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(ATroveId);

        // B applies A's pending interest
        applyPendingDebt(B, ATroveId);

        uint256 recordedTroveDebt_2 = troveManager.getTroveDebt(ATroveId);

        assertEq(recordedTroveDebt_2, recordedTroveDebt_1 + accruedTroveInterest);
    }

    function testApplyTroveInterestPermissionlessUpdatesRedistribution() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);

        // Open a trove to be liquidated and redistributed
        uint256 CTroveId = openTroveNoHints100pct(C, 2.1 ether, 2000e18, interestRate);
        // Price goes down
        priceFeed.setPrice(1000e18);
        // C is liquidated
        LatestTroveData memory troveData = troveManager.getLatestTroveData(ATroveId);
        uint256 initialEntireDebt = troveData.entireDebt;
        LatestTroveData memory troveDataC = troveManager.getLatestTroveData(CTroveId);
        uint256 entireDebtC = troveDataC.entireDebt;
        liquidate(A, CTroveId);

        // Check A has redistribution gains
        troveData = troveManager.getLatestTroveData(ATroveId);
        assertGt(troveData.redistBoldDebtGain, 0, "A should have redist gains");

        // Fast-forward time
        vm.warp(block.timestamp + 91 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        troveData = troveManager.getLatestTroveData(ATroveId);
        uint256 accruedInterest = troveData.accruedInterest;
        // B applies A's pending interest
        vm.startPrank(B);
        borrowerOperations.applyPendingDebt(ATroveId);
        vm.stopPrank();

        troveData = troveManager.getLatestTroveData(ATroveId);
        assertEq(troveData.entireDebt, initialEntireDebt + accruedInterest + entireDebtC);
    }

    function testApplyTroveInterestPermissionlessRevertsIfTroveHasZeroDebt() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveNoHints100pct(A, 3 ether, troveDebtRequest, interestRate);
        LatestTroveData memory troveData = troveManager.getLatestTroveData(ATroveId);
        uint256 redeemAmount = troveData.entireDebt;

        // Fully redeem A
        deal(address(boldToken), E, redeemAmount);
        redeem(E, redeemAmount);
        troveData = troveManager.getLatestTroveData(ATroveId);
        assertEq(troveData.entireDebt, 0, "Trove A should be fully redeemed");

        // Fast-forward time such that trove is Stale
        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(ATroveId));

        assertLt(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        // B tries to apply A's pending interest
        vm.startPrank(B);
        vm.expectRevert(BorrowerOperations.TroveWithZeroDebt.selector);
        borrowerOperations.applyPendingDebt(ATroveId);
        vm.stopPrank();
    }

    // --- redemptions ---

    function testRedemptionSetsTroveLastDebtUpdateTimeToNow() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        // Fast-forward to generate interest
        vm.warp(block.timestamp + 1 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(troveIDs.A), block.timestamp);

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        // E redeems, hitting A partially
        uint256 redeemAmount = debt_A / 2;
        redeem(E, redeemAmount);

        assertEq(troveManager.getTroveLastDebtUpdateTime(troveIDs.A), block.timestamp);
    }

    function testRedemptionReducesTroveAccruedInterestTo0() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        // Fast-forward to generate interest
        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.calcTroveAccruedInterest(troveIDs.A), 0);

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        // E redeems, hitting A partially
        uint256 redeemAmount = debt_A / 2;
        redeem(E, redeemAmount);

        assertEq(troveManager.calcTroveAccruedInterest(troveIDs.A), 0);
    }

    function testRedemptionReducesEntireTroveDebtByRedeemedAmount() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        // Fast-forward to generate interest
        vm.warp(block.timestamp + 1 days);

        uint256 entireTroveDebt_1 = troveManager.getTroveEntireDebt(troveIDs.A);
        assertGt(entireTroveDebt_1, 0);

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        // E redeems, hitting A partially
        uint256 redeemAmount = debt_A / 2;
        redeem(E, redeemAmount);

        uint256 entireTroveDebt_2 = troveManager.getTroveEntireDebt(troveIDs.A);

        assertEq(entireTroveDebt_2, entireTroveDebt_1 - redeemAmount);
    }

    function testRedemptionChangesRecordedTroveDebtByAccruedInterestMinusRedeemedAmount() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        // Fast-forward to generate interest
        vm.warp(block.timestamp + 1 days);

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        // E redeems, hitting A partially
        uint256 redeemAmount = debt_A / 2;

        LatestTroveData memory preRedeem = troveManager.getLatestTroveData(troveIDs.A);
        redeem(E, redeemAmount);
        LatestTroveData memory postRedeem = troveManager.getLatestTroveData(troveIDs.A);

        assertEq(postRedeem.recordedDebt, preRedeem.recordedDebt + preRedeem.accruedInterest - redeemAmount);
    }

    // --- upfront fee ---

    function testOpenTroveMintsUpfrontFeeToInterestReceivers() public {
        priceFeed.setPrice(2000e18);

        uint256 borrow = 2_000 ether;
        uint256 interestRate = 0.1 ether;
        openTroveNoHints100pct(A, 2 ether, borrow, interestRate);

        uint256 debtWithoutFee = borrow;
        uint256 fee = calcUpfrontFee(debtWithoutFee, interestRate);

        assertEqDecimal(
            boldToken.balanceOf(address(stabilityPool)) + boldToken.balanceOf(address(mockInterestRouter)),
            fee,
            18,
            "Wrong amount minted to interest receivers"
        );
    }
}
