pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";


contract InterestRateBasic is DevTestSetup {

    function testOpenTroveSetsInterestRate() public {
        priceFeed.setPrice(2000e18);

        uint256 A_Id = openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  0);
        assertEq(troveManager.getTroveAnnualInterestRate(A_Id), 0);

        uint256 B_Id = openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  1);
        assertEq(troveManager.getTroveAnnualInterestRate(B_Id), 1);

        uint256 C_Id = openTroveNoHints100pctMaxFee(C,  2 ether, 2000e18,  37e16);
        assertEq(troveManager.getTroveAnnualInterestRate(C_Id), 37e16);

        uint256 D_Id = openTroveNoHints100pctMaxFee(D,  2 ether, 2000e18,  1e18);
        assertEq(troveManager.getTroveAnnualInterestRate(D_Id), 1e18);
    }

    function testOpenTroveSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);
        assertEq(troveManager.getTroveLastDebtUpdateTime(A), 0);
        assertEq(troveManager.getTroveLastDebtUpdateTime(B), 0);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  0);
        assertEq(troveManager.getTroveLastDebtUpdateTime(A), block.timestamp);

        vm.warp(block.timestamp + 1000);
        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  1);
        assertEq(troveManager.getTroveLastDebtUpdateTime(B), block.timestamp);
    }
    function testOpenTroveInsertsToCorrectPositionInSortedList() public {
        priceFeed.setPrice(2000e18);

        // Users A, B, C, D, E will open Troves with interest rates ascending in the alphabetical order of their names
        uint256 interestRate_A = 0;
        uint256 interestRate_B = 1e17;
        uint256 interestRate_C = 2e17;
        uint256 interestRate_D = 3e17;
        uint256 interestRate_E = 4e17;

        // B and D open
        uint256 B_Id = openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  interestRate_B);
        uint256 D_Id = openTroveNoHints100pctMaxFee(D,  2 ether, 2000e18,  interestRate_D);

        // Check initial list order - expect [B, D]
        // B
        assertEq(sortedTroves.getNext(B_Id), 0); // tail
        assertEq(sortedTroves.getPrev(B_Id), D_Id);
        // D
        assertEq(sortedTroves.getNext(D_Id), B_Id);
        assertEq(sortedTroves.getPrev(D_Id), 0); // head

        // C opens. Expect to be inserted between B and D
        uint256 C_Id = openTroveNoHints100pctMaxFee(C,  2 ether, 2000e18,  interestRate_C);
        assertEq(sortedTroves.getNext(C_Id), B_Id);
        assertEq(sortedTroves.getPrev(C_Id), D_Id);

        // A opens. Expect to be inserted at the tail, below B
        uint256 A_Id = openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  interestRate_A);
        assertEq(sortedTroves.getNext(A_Id), 0);
        assertEq(sortedTroves.getPrev(A_Id), B_Id);

        // E opens. Expect to be inserted at the head, above D
        uint256 E_Id = openTroveNoHints100pctMaxFee(E,  2 ether, 2000e18,  interestRate_E);
        assertEq(sortedTroves.getNext(E_Id), D_Id);
        assertEq(sortedTroves.getPrev(E_Id), 0);
    }


    function testRevertWhenOpenTroveWithInterestRateGreaterThanMax() public {
        priceFeed.setPrice(2000e18);

        vm.startPrank(A);
        vm.expectRevert();
        borrowerOperations.openTrove(A, 0, 1e18, 2e18, 2000e18, 0, 0, 1e18 + 1);

        vm.expectRevert();
        borrowerOperations.openTrove(A, 1, 1e18, 2e18, 2000e18, 0, 0, 42e18);
    }

    function testRevertWhenAdjustInterestRateGreaterThanMax() public {
        priceFeed.setPrice(2000e18);

        // A opens Trove with valid annual interest rate ...
        uint256 A_Id = openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  37e16);
        assertEq(troveManager.getTroveAnnualInterestRate(A_Id), 37e16);

        // ... then tries to adjust it to an invalid value
        vm.startPrank(A);
        vm.expectRevert();
        borrowerOperations.adjustTroveInterestRate(A_Id, 1e18 + 1, 0, 0);

        vm.expectRevert();
        borrowerOperations.adjustTroveInterestRate(A_Id, 42e18, 0, 0);
    }

    // --- adjustTroveInterestRate ---

    function testAdjustTroveInterestRateSetsCorrectNewRate() public {
        priceFeed.setPrice(2000e18);

        // A, B, C opens Troves with valid annual interest rates
        uint256 A_Id = openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  5e17);
        uint256 B_Id = openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  5e17);
        uint256 C_Id = openTroveNoHints100pctMaxFee(C,  2 ether, 2000e18,  5e17);
        assertEq(troveManager.getTroveAnnualInterestRate(A_Id), 5e17);
        assertEq(troveManager.getTroveAnnualInterestRate(B_Id), 5e17);
        assertEq(troveManager.getTroveAnnualInterestRate(C_Id), 5e17);

        changeInterestRateNoHints(A, A_Id, 0);
        assertEq(troveManager.getTroveAnnualInterestRate(A_Id), 0);

        changeInterestRateNoHints(B, B_Id, 6e17);
        assertEq(troveManager.getTroveAnnualInterestRate(B_Id), 6e17);

        changeInterestRateNoHints(C, C_Id, 1e18);
        assertEq(troveManager.getTroveAnnualInterestRate(C_Id), 1e18);
    }

    function testAdjustTroveInterestRateSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  5e17);

        vm.warp(block.timestamp + 1 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(A), block.timestamp);

        changeInterestRateNoHints(A, 75e16);

        assertEq(troveManager.getTroveLastDebtUpdateTime(A), block.timestamp);
    }

    function testAdjustTroveInterestRateSetsReducesPendingInterestTo0() public {
        priceFeed.setPrice(2000e18);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  5e17);

        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.calcTroveAccruedInterest(A), 0);

        changeInterestRateNoHints(A, 75e16);

        assertEq(troveManager.calcTroveAccruedInterest(A), 0);
    }

    function testAdjustTroveInterestRateDoesNotChangeEntireTroveDebt() public {
        priceFeed.setPrice(2000e18);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  5e17);

        vm.warp(block.timestamp + 1 days);

        (uint256 entireTroveDebt_1, , , , ) = troveManager.getEntireDebtAndColl(A);
        assertGt(entireTroveDebt_1, 0);

        changeInterestRateNoHints(A, 75e16);

        (uint256 entireTroveDebt_2, , , , ) = troveManager.getEntireDebtAndColl(A);
        assertEq(entireTroveDebt_1, entireTroveDebt_2);
    }

    function testAdjustTroveInterestRateNoRedistGainsIncreasesRecordedDebtByAccruedInterest() public {
        priceFeed.setPrice(2000e18);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  5e17);

        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_1 = troveManager.getTroveDebt(A);
        assertGt(recordedTroveDebt_1, 0);

        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(A);

        changeInterestRateNoHints(A, 75e16);

        uint256 recordedTroveDebt_2 = troveManager.getTroveDebt(A);
        assertEq(recordedTroveDebt_2, recordedTroveDebt_1 + accruedTroveInterest);
    }

    function testAdjustTroveInterestRateInsertsToCorrectPositionInSortedList() public {
        priceFeed.setPrice(2000e18);
        uint256 A_Id = openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  1e17);
        uint256 B_Id = openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  2e17);
        uint256 C_Id = openTroveNoHints100pctMaxFee(C,  2 ether, 2000e18,  3e17);
        uint256 D_Id = openTroveNoHints100pctMaxFee(D,  2 ether, 2000e18,  4e17);
        uint256 E_Id = openTroveNoHints100pctMaxFee(E,  2 ether, 2000e18,  5e17);

        // Check initial sorted list order - expect [A:10%, B:02%, C:30%, D:40%, E:50%]
        // A
        assertEq(sortedTroves.getNext(A_Id), 0); // tail
        assertEq(sortedTroves.getPrev(A_Id), B_Id);
        // B
        assertEq(sortedTroves.getNext(B_Id), A_Id);
        assertEq(sortedTroves.getPrev(B_Id), C_Id);
        // C
        assertEq(sortedTroves.getNext(C_Id), B_Id);
        assertEq(sortedTroves.getPrev(C_Id), D_Id);
        // D
        assertEq(sortedTroves.getNext(D_Id), C_Id);
        assertEq(sortedTroves.getPrev(D_Id), E_Id);
        // E
        assertEq(sortedTroves.getNext(E_Id), D_Id);
        assertEq(sortedTroves.getPrev(E_Id), 0); // head

        // C sets rate to 0%, moves to tail - expect [C:0%, A:10%, B:20%, D:40%, E:50%]
        changeInterestRateNoHints(C, C_Id, 0);
        assertEq(sortedTroves.getNext(C_Id), 0);
        assertEq(sortedTroves.getPrev(C_Id), A_Id);

        // D sets rate to 7%, moves to head - expect [C:0%, A:10%, B:20%, E:50%, D:70%]
        changeInterestRateNoHints(D, D_Id, 7e17);
        assertEq(sortedTroves.getNext(D_Id), E_Id);
        assertEq(sortedTroves.getPrev(D_Id), 0);

        // A sets rate to 6%, moves up 2 positions - expect [C:0%, B:20%, E:50%, A:60%, D:70%]
        changeInterestRateNoHints(A, A_Id, 6e17);
        assertEq(sortedTroves.getNext(A_Id), E_Id);
        assertEq(sortedTroves.getPrev(A_Id), D_Id);
    }

    function testAdjustTroveDoesNotChangeListPositions() public {
        priceFeed.setPrice(2000e18);

        // Troves opened in ascending order of interest rate
        uint256 A_Id = openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  1e17);
        uint256 B_Id = openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  2e17);
        uint256 C_Id = openTroveNoHints100pctMaxFee(C,  2 ether, 2000e18,  3e17);
        uint256 D_Id = openTroveNoHints100pctMaxFee(D,  2 ether, 2000e18,  4e17);
        uint256 E_Id = openTroveNoHints100pctMaxFee(E,  2 ether, 2000e18,  5e17);

        // Check A's neighbors
        assertEq(sortedTroves.getNext(A_Id), 0); // tail
        assertEq(sortedTroves.getPrev(A_Id), B_Id);

        // Adjust A's coll + debt
        adjustTrove100pctMaxFee(A, A_Id, 10 ether, 5000e18, true, true);

        // Check A's neighbors unchanged
        assertEq(sortedTroves.getNext(A_Id), 0); // tail
        assertEq(sortedTroves.getPrev(A_Id), B_Id);

        // Check C's neighbors
        assertEq(sortedTroves.getNext(C_Id), B_Id);
        assertEq(sortedTroves.getPrev(C_Id), D_Id);

        // Adjust C's coll + debt
        adjustTrove100pctMaxFee(C, C_Id, 10 ether, 5000e18, true, true);

        // Check C's neighbors unchanged
        assertEq(sortedTroves.getNext(C_Id), B_Id);
        assertEq(sortedTroves.getPrev(C_Id), D_Id);

        // Check E's neighbors
        assertEq(sortedTroves.getNext(E_Id), D_Id);
        assertEq(sortedTroves.getPrev(E_Id), 0); // head

        // Adjust E's coll + debt
        adjustTrove100pctMaxFee(E, E_Id, 10 ether, 5000e18, true, true);

        // Check E's neighbors unchanged
        assertEq(sortedTroves.getNext(E_Id), D_Id);
        assertEq(sortedTroves.getPrev(E_Id), 0); // head
    }

    // --- withdrawBold ---

    function testWithdrawBoldSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 boldWithdrawal = 500e18;

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  interestRate);

        vm.warp(block.timestamp + 1 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        // A draws more debt
        withdrawBold100pctMaxFee(ATroveId, boldWithdrawal);
        assertEq(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);
    }

    function testWithdrawBoldReducesTroveAccruedInterestTo0() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 boldWithdrawal = 500e18;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.calcTroveAccruedInterest(A), 0);

        // A draws more debt
        withdrawBold100pctMaxFee(A, boldWithdrawal);

        assertEq(troveManager.calcTroveAccruedInterest(A), 0);
    }

    function testWithdrawBoldIncreasesEntireTroveDebtByWithdrawnAmount() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 boldWithdrawal = 500e18;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        (uint256 entireTroveDebt_1, , , , ) = troveManager.getEntireDebtAndColl(A);
        assertGt(entireTroveDebt_1, 0);

        // A draws more debt
        withdrawBold100pctMaxFee(A, boldWithdrawal);

        (uint256 entireTroveDebt_2, , , , ) = troveManager.getEntireDebtAndColl(A);

        assertEq(entireTroveDebt_2, entireTroveDebt_1 + boldWithdrawal);
    }

    function testWithdrawBoldIncreasesRecordedTroveDebtByAccruedInterestPlusWithdrawnAmount() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 boldWithdrawal = 500e18;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_1 = troveManager.getTroveDebt(A);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(A);

        // A draws more debt
        withdrawBold100pctMaxFee(A, boldWithdrawal);

        uint256 recordedTroveDebt_2 = troveManager.getTroveDebt(A);

        assertEq(recordedTroveDebt_2, recordedTroveDebt_1 + accruedTroveInterest + boldWithdrawal);
    }

    // --- repayBold ---

    function testRepayBoldSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 3000e18;
        uint256 interestRate = 25e16;
        uint256 boldRepayment = 500e18;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  interestRate);

        vm.warp(block.timestamp + 1 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(A), block.timestamp);

        // A repays bold
        repayBold(A, boldRepayment);

        assertEq(troveManager.getTroveLastDebtUpdateTime(A), block.timestamp);
    }

    function testRepayBoldReducesTroveAccruedInterestTo0() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 3000e18;
        uint256 interestRate = 25e16;
        uint256 boldRepayment = 500e18;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.calcTroveAccruedInterest(A), 0);

        // A repays bold
        repayBold(A, boldRepayment);

        assertEq(troveManager.calcTroveAccruedInterest(A), 0);
    }

    function testRepayBoldReducesEntireTroveDebtByRepaidAmount() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 3000e18;
        uint256 interestRate = 25e16;
        uint256 boldRepayment = 500e18;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        (uint256 entireTroveDebt_1, , , , ) = troveManager.getEntireDebtAndColl(A);
        assertGt(entireTroveDebt_1, 0);

        // A repays bold
        repayBold(A, boldRepayment);

        (uint256 entireTroveDebt_2, , , , ) = troveManager.getEntireDebtAndColl(A);


        assertEq(entireTroveDebt_2, entireTroveDebt_1 - boldRepayment);
    }

    function testRepayBoldChangesRecordedTroveDebtByAccruedInterestMinusRepaidAmount() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 3000e18;
        uint256 interestRate = 25e16;
        uint256 boldRepayment = 500e18;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_1 = troveManager.getTroveDebt(A);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(A);

        // A repays bold
        repayBold(A, boldRepayment);

        uint256 recordedTroveDebt_2 = troveManager.getTroveDebt(A);

        assertEq(recordedTroveDebt_2, recordedTroveDebt_1 + accruedTroveInterest - boldRepayment);
    }

    // --- addColl ---

    function testAddCollSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collIncrease = 1 ether;

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest,  interestRate);

        vm.warp(block.timestamp + 1 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);

        // A adds coll
        addColl(ATroveId, collIncrease);

        assertEq(troveManager.getTroveLastDebtUpdateTime(ATroveId), block.timestamp);
    }

    function testAddCollReducesTroveAccruedInterestTo0() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collIncrease = 1 ether;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.calcTroveAccruedInterest(A), 0);

        // A adds coll
        addColl(A, collIncrease);

        assertEq(troveManager.calcTroveAccruedInterest(A), 0);
    }

    function testAddCollDoesntChangeEntireTroveDebt() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collIncrease = 1 ether;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        (uint256 entireTroveDebt_1, , , , ) = troveManager.getEntireDebtAndColl(A);
        assertGt(entireTroveDebt_1, 0);

        // A adds coll
        addColl(A, collIncrease);

        (uint256 entireTroveDebt_2, , , , ) = troveManager.getEntireDebtAndColl(A);

        assertEq(entireTroveDebt_2, entireTroveDebt_1);
    }

    function testAddCollIncreasesRecordedTroveDebtByAccruedInterest() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collIncrease = 1 ether;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_1 = troveManager.getTroveDebt(A);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(A);

        // A adds coll
        addColl(A, collIncrease);

        uint256 recordedTroveDebt_2 = troveManager.getTroveDebt(A);

        assertEq(recordedTroveDebt_2, recordedTroveDebt_1 + accruedTroveInterest);
    }

    // --- withdrawColl ---

    function testWithdrawCollSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collDecrease = 1 ether;

        openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest,  interestRate);

        vm.warp(block.timestamp + 1 days);

        assertLt(troveManager.getTroveLastDebtUpdateTime(A), block.timestamp);

        // A withdraws coll
        withdrawColl(A, collDecrease);

        assertEq(troveManager.getTroveLastDebtUpdateTime(A), block.timestamp);
    }

    function testWithdrawCollReducesTroveAccruedInterestTo0() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collDecrease = 1 ether;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.calcTroveAccruedInterest(A), 0);

        // A withdraws coll
        withdrawColl(A, collDecrease);

        assertEq(troveManager.calcTroveAccruedInterest(A), 0);
    }

    function testWithdrawCollDoesntChangeEntireTroveDebt() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collDecrease = 1 ether;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        (uint256 entireTroveDebt_1, , , , ) = troveManager.getEntireDebtAndColl(A);
         assertGt(entireTroveDebt_1, 0);

        // A withdraws coll
        withdrawColl(A, collDecrease);

        (uint256 entireTroveDebt_2, , , , ) = troveManager.getEntireDebtAndColl(A);

        assertEq(entireTroveDebt_2, entireTroveDebt_1);
    }

    function testWithdrawCollIncreasesRecordedTroveDebtByAccruedInterest() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;
        uint256 collDecrease = 1 ether;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_1 = troveManager.getTroveDebt(A);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(A);

        // A withdraws coll
        withdrawColl(A, collDecrease);

        uint256 recordedTroveDebt_2 = troveManager.getTroveDebt(A);

        assertEq(recordedTroveDebt_2, recordedTroveDebt_1 + accruedTroveInterest);
    }

    // --- applyTroveInterestPermissionless ---

    function testApplyTroveInterestPermissionlessSetsTroveLastDebtUpdateTimeToNow() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest,  interestRate);

        // Fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(A));

        assertLt(troveManager.getTroveLastDebtUpdateTime(A), block.timestamp);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, A);

        assertEq(troveManager.getTroveLastDebtUpdateTime(A), block.timestamp);
    }

    function testApplyTroveInterestPermissionlessReducesTroveAccruedInterestTo0() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        // Fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(A));

        assertGt(troveManager.calcTroveAccruedInterest(A), 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, A);

        assertEq(troveManager.calcTroveAccruedInterest(A), 0);
    }

    function testApplyTroveInterestPermissionlessDoesntChangeEntireTroveDebt() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

       // Fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(A));

        (uint256 entireTroveDebt_1, , , , ) = troveManager.getEntireDebtAndColl(A);
         assertGt(entireTroveDebt_1, 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, A);

        (uint256 entireTroveDebt_2, , , , ) = troveManager.getEntireDebtAndColl(A);

        assertEq(entireTroveDebt_2, entireTroveDebt_1);
    }

    function testApplyTroveInterestPermissionlessIncreasesRecordedTroveDebtByAccruedInterest() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate);

        // Fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(A));

        uint256 recordedTroveDebt_1 = troveManager.getTroveDebt(A);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(A);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, A);

        uint256 recordedTroveDebt_2 = troveManager.getTroveDebt(A);

        assertEq(recordedTroveDebt_2, recordedTroveDebt_1 + accruedTroveInterest);
    }
}

// commit + next: liqs apply interest
