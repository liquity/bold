pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract InterestRateBasic is DevTestSetup {

    function testOpenTroveSetsInterestRate() public {
        priceFeed.setPrice(2000e18);
        assertEq(troveManager.getTroveAnnualInterestRate(A), 0);
        assertEq(troveManager.getTroveAnnualInterestRate(B), 0);
        assertEq(troveManager.getTroveAnnualInterestRate(C), 0);
        assertEq(troveManager.getTroveAnnualInterestRate(D), 0);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  0);
        assertEq(troveManager.getTroveAnnualInterestRate(A), 0);

        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  1);
        assertEq(troveManager.getTroveAnnualInterestRate(B), 1);

        openTroveNoHints100pctMaxFee(C,  2 ether, 2000e18,  37e16);
        assertEq(troveManager.getTroveAnnualInterestRate(C), 37e16);

        openTroveNoHints100pctMaxFee(D,  2 ether, 2000e18,  1e18);
        assertEq(troveManager.getTroveAnnualInterestRate(D), 1e18);
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
        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  interestRate_B);
        openTroveNoHints100pctMaxFee(D,  2 ether, 2000e18,  interestRate_D);

        // Check initial list order - expect [B, D]
        // B
        assertEq(sortedTroves.getNext(B), ZERO_ADDRESS); // tail
        assertEq(sortedTroves.getPrev(B), D);
        // D
        assertEq(sortedTroves.getNext(D), B);
        assertEq(sortedTroves.getPrev(D), ZERO_ADDRESS); // head

        // C opens. Expect to be inserted between B and D
        openTroveNoHints100pctMaxFee(C,  2 ether, 2000e18,  interestRate_C);
        assertEq(sortedTroves.getNext(C), B);
        assertEq(sortedTroves.getPrev(C), D);

        // A opens. Expect to be inserted at the tail, below B
        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  interestRate_A);
        assertEq(sortedTroves.getNext(A), ZERO_ADDRESS); 
        assertEq(sortedTroves.getPrev(A), B); 

        // E opens. Expect to be inserted at the head, above D
        openTroveNoHints100pctMaxFee(E,  2 ether, 2000e18,  interestRate_E);
        assertEq(sortedTroves.getNext(E), D); 
        assertEq(sortedTroves.getPrev(E), ZERO_ADDRESS); 
    }


    function testRevertWhenOpenTroveWithInterestRateGreaterThanMax() public {
        priceFeed.setPrice(2000e18);
    
        vm.startPrank(A);
        vm.expectRevert();
        borrowerOperations.openTrove{value: 2 ether}(1e18, 2000e18, ZERO_ADDRESS, ZERO_ADDRESS, 1e18 + 1);

         vm.expectRevert();
        borrowerOperations.openTrove{value: 2 ether}(1e18, 2000e18, ZERO_ADDRESS, ZERO_ADDRESS, 42e18);
    }

    function testRevertWhenAdjustInterestRateGreaterThanMax() public {
        priceFeed.setPrice(2000e18);

        // A opens Trove with valid annual interest rate ...
        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  37e16);
        assertEq(troveManager.getTroveAnnualInterestRate(A), 37e16);

        // ... then tries to adjust it to an invalid value
        vm.startPrank(A);
        vm.expectRevert();
        borrowerOperations.adjustTroveInterestRate(1e18 + 1, ZERO_ADDRESS, ZERO_ADDRESS);

        vm.expectRevert();
        borrowerOperations.adjustTroveInterestRate(42e18, ZERO_ADDRESS, ZERO_ADDRESS);
    }

    function testAdjustTroveInterestRateSetsCorrectNewRate() public {
        priceFeed.setPrice(2000e18);

        // A, B, C opens Troves with valid annual interest rates
        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  5e17);
        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  5e17);
        openTroveNoHints100pctMaxFee(C,  2 ether, 2000e18,  5e17);
        assertEq(troveManager.getTroveAnnualInterestRate(A), 5e17);
        assertEq(troveManager.getTroveAnnualInterestRate(B), 5e17);
        assertEq(troveManager.getTroveAnnualInterestRate(C), 5e17);

        changeInterestRateNoHints(A, 0);
        assertEq(troveManager.getTroveAnnualInterestRate(A), 0);

        changeInterestRateNoHints(B, 6e17);
        assertEq(troveManager.getTroveAnnualInterestRate(B), 6e17);

        changeInterestRateNoHints(C, 1e18);
        assertEq(troveManager.getTroveAnnualInterestRate(C), 1e18);
    }

    function testAdjustTroveInterestRateInsertsToCorrectPositionInSortedList() public {
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  1e17);
        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  2e17);
        openTroveNoHints100pctMaxFee(C,  2 ether, 2000e18,  3e17);
        openTroveNoHints100pctMaxFee(D,  2 ether, 2000e18,  4e17);
        openTroveNoHints100pctMaxFee(E,  2 ether, 2000e18,  5e17);
        
        // Check initial sorted list order - expect [A:10%, B:02%, C:30%, D:40%, E:50%]
        // A
        assertEq(sortedTroves.getNext(A), ZERO_ADDRESS); // tail
        assertEq(sortedTroves.getPrev(A), B);
        // B
        assertEq(sortedTroves.getNext(B), A);
        assertEq(sortedTroves.getPrev(B), C);
        // C
        assertEq(sortedTroves.getNext(C), B);
        assertEq(sortedTroves.getPrev(C), D);
        // D
        assertEq(sortedTroves.getNext(D), C);
        assertEq(sortedTroves.getPrev(D), E);
        // E
        assertEq(sortedTroves.getNext(E), D);
        assertEq(sortedTroves.getPrev(E), ZERO_ADDRESS); // head
    
        // C sets rate to 0%, moves to tail - expect [C:0%, A:10%, B:20%, D:40%, E:50%]
        changeInterestRateNoHints(C, 0);
        assertEq(sortedTroves.getNext(C), ZERO_ADDRESS);
        assertEq(sortedTroves.getPrev(C), A);

        // D sets rate to 7%, moves to head - expect [C:0%, A:10%, B:20%, E:50%, D:70%]
        changeInterestRateNoHints(D, 7e17);
        assertEq(sortedTroves.getNext(D), E);
        assertEq(sortedTroves.getPrev(D), ZERO_ADDRESS);

        // A sets rate to 6%, moves up 2 positions - expect [C:0%, B:20%, E:50%, A:60%, D:70%]
        changeInterestRateNoHints(A, 6e17);
        assertEq(sortedTroves.getNext(A), E);
        assertEq(sortedTroves.getPrev(A), D);
    } 

    function testAdjustTroveDoesNotChangeListPositions() public {
        priceFeed.setPrice(2000e18);

        // Troves opened in ascending order of interest rate
        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  1e17);
        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  2e17);
        openTroveNoHints100pctMaxFee(C,  2 ether, 2000e18,  3e17);
        openTroveNoHints100pctMaxFee(D,  2 ether, 2000e18,  4e17);
        openTroveNoHints100pctMaxFee(E,  2 ether, 2000e18,  5e17);

        // Check A's neighbors
        assertEq(sortedTroves.getNext(A), ZERO_ADDRESS); // tail
        assertEq(sortedTroves.getPrev(A), B);

        // Adjust A's coll + debt
        adjustTrove100pctMaxFee(A, 10 ether, 5000e18, true, true);

        // Check A's neighbors unchanged
        assertEq(sortedTroves.getNext(A), ZERO_ADDRESS); // tail
        assertEq(sortedTroves.getPrev(A), B);

        // Check C's neighbors
        assertEq(sortedTroves.getNext(C), B);
        assertEq(sortedTroves.getPrev(C), D);

        // Adjust C's coll + debt
        adjustTrove100pctMaxFee(C, 10 ether, 5000e18, true, true);

        // Check C's neighbors unchanged
        assertEq(sortedTroves.getNext(C), B);
        assertEq(sortedTroves.getPrev(C), D);

        // Check E's neighbors
        assertEq(sortedTroves.getNext(E), D);
        assertEq(sortedTroves.getPrev(E), ZERO_ADDRESS); // head

        // Adjust E's coll + debt
        adjustTrove100pctMaxFee(E, 10 ether, 5000e18, true, true);

        // Check E's neighbors unchanged
        assertEq(sortedTroves.getNext(E), D);
        assertEq(sortedTroves.getPrev(E), ZERO_ADDRESS); // head
    }
}