pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract InterestRateAggregate is DevTestSetup {
    
    // ---  Pending aggregate interest calculator ---

    function testCalcPendingAggInterestReturns0For0TimePassedSinceLastUpdate() public {
        priceFeed.setPrice(2000e18);
        assertEq(troveManager.lastAggUpdateTime(), 0);
        assertEq(troveManager.calcPendingAggInterest(), 0);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  0); 
        assertEq(troveManager.lastAggUpdateTime(), block.timestamp);
        assertEq(troveManager.calcPendingAggInterest(), 0);

        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  5e17);
        assertEq(troveManager.lastAggUpdateTime(), block.timestamp);
        assertEq(troveManager.calcPendingAggInterest(), 0);
    }

    // calcPendingAggInterest returns 0 with no recorded aggregate debt

    function testCalcPendingAggInterestReturns0When0AggRecordedDebt() public {
        priceFeed.setPrice(2000e18);
        assertEq(troveManager.aggRecordedDebt(), 0);
        assertEq(troveManager.aggWeightedDebtSum(), 0);
        assertEq(troveManager.calcPendingAggInterest(), 0);

        vm.warp(block.timestamp + 1000);
        assertEq(troveManager.aggRecordedDebt(), 0);
        assertEq(troveManager.aggWeightedDebtSum(), 0);
        assertEq(troveManager.calcPendingAggInterest(), 0);
    }

    // calcPendingAggInterest returns 0 when all troves have 0 interest rate
    function testCalcPendingAggInterestReturns0WhenAllTrovesHave0InterestRate() public {
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  0); 
        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  0); 

        assertEq(troveManager.calcPendingAggInterest(), 0);
        
        vm.warp(block.timestamp + 1000);

        assertEq(troveManager.calcPendingAggInterest(), 0);

        openTroveNoHints100pctMaxFee(C,  2 ether, 2000e18,  0); 

        assertEq(troveManager.calcPendingAggInterest(), 0);

        vm.warp(block.timestamp + 1000);

        assertEq(troveManager.calcPendingAggInterest(), 0);
    }

    // TODO: create additional fuzz test
    function testCalcPendingInterestReturnsCorrectInterestForGivenPeriod() public {
        priceFeed.setPrice(2000e18);
        uint256 _duration = 1 days;

        uint256 troveDebtRequest = 2000e18;
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); // 25% annual interest
        openTroveNoHints100pctMaxFee(B,  2 ether, troveDebtRequest,  75e16); // 75% annual interest
        console.log("A debt", troveManager.getTroveDebt(A));

        uint256 expectedTroveDebt = troveDebtRequest + troveManager.BOLD_GAS_COMPENSATION();
        assertEq(troveManager.getTroveDebt(A), expectedTroveDebt);
        assertEq(troveManager.getTroveDebt(B), expectedTroveDebt);
    
        vm.warp(block.timestamp + _duration);
       
        // Expect weighted average of 2 * troveDebt debt at 50% interest
        uint256 expectedPendingAggInterest = expectedTroveDebt * 2 * 5e17 * _duration / SECONDS_IN_1_YEAR / 1e18;
    
        assertEq(expectedPendingAggInterest, troveManager.calcPendingAggInterest());
    }

    // --- mintAggInterest ---

    function testMintAggInterestRevertsWhenNotCalledByBOorSP() public {
       // pass positive debt change
        int256 debtChange = 37e18;
        vm.startPrank(A);
        vm.expectRevert();
        troveManager.mintAggInterest(debtChange);
        vm.stopPrank();

        vm.startPrank(address(borrowerOperations));  
        troveManager.mintAggInterest(debtChange);
        vm.stopPrank();

        vm.startPrank(address(stabilityPool));  
        troveManager.mintAggInterest(debtChange);
        vm.stopPrank();
       
        // pass negative debt change
        debtChange = -37e18;
        vm.startPrank(A);
        vm.expectRevert();
        troveManager.mintAggInterest(debtChange);
        vm.stopPrank();

        vm.startPrank(address(borrowerOperations));  
        troveManager.mintAggInterest(debtChange);
        vm.stopPrank();

        vm.startPrank(address(stabilityPool));  
        troveManager.mintAggInterest(debtChange);
        vm.stopPrank();

        // pass 0 debt change
        vm.startPrank(A);
        vm.expectRevert();
        troveManager.mintAggInterest(0);
        vm.stopPrank();

        vm.startPrank(address(borrowerOperations));  
        troveManager.mintAggInterest(0);
        vm.stopPrank();

        vm.startPrank(address(stabilityPool));  
        troveManager.mintAggInterest(0);
        vm.stopPrank();
    }

    // --- openTrove impact on aggregates ---

    // openTrove increases recorded aggregate debt by correct amount
    function testOpenTroveIncreasesRecordedAggDebtByAggPendingInterestPlusNewDebt() public {
        priceFeed.setPrice(2000e18);
        assertEq(troveManager.aggRecordedDebt(), 0);
    
        uint256 troveDebtRequest = 2000e18;
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); // 25% annual interest

        // Check aggregate recorded debt increased to non-zero
        uint256 aggREcordedDebt_1 = troveManager.aggRecordedDebt();
        assertGt(aggREcordedDebt_1, 0);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // check there's pending interest
        uint256 pendingInterest = troveManager.calcPendingAggInterest();
        assertGt(pendingInterest, 0);

        uint256 expectedTroveDebt_B = troveDebtRequest + troveManager.BOLD_GAS_COMPENSATION();
        openTroveNoHints100pctMaxFee(B,  2 ether, troveDebtRequest,  25e16); 
        assertEq(troveManager.getTroveDebt(B), expectedTroveDebt_B);

        // check that opening Trove B increased the agg. recorded debt by the pending agg. interest plus Trove B's debt 
        assertEq(troveManager.aggRecordedDebt(), aggREcordedDebt_1 + pendingInterest + expectedTroveDebt_B);
    }

    function testOpenTroveReducesPendingAggInterestTo0() public {
        priceFeed.setPrice(2000e18);
    
        uint256 troveDebtRequest = 2000e18;
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); // 25% annual interest

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // check there's pending agg. interest
        assertGt(troveManager.calcPendingAggInterest(), 0);

        openTroveNoHints100pctMaxFee(B,  2 ether, troveDebtRequest,  25e16); 

        // Check pending agg. interest reduced to 0
        assertEq(troveManager.calcPendingAggInterest(), 0);
    }
    
    function testOpenTroveUpdatesTheLastAggUpdateTime() public {
        priceFeed.setPrice(2000e18);
        assertEq(troveManager.lastAggUpdateTime(), 0);

        vm.warp(block.timestamp + 1 days);
        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  25e16); // 25% annual interest
    
        assertEq(troveManager.lastAggUpdateTime(), block.timestamp);

        vm.warp(block.timestamp + 1 days);

        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  25e16); // 25% annual interest

        assertEq(troveManager.lastAggUpdateTime(), block.timestamp);
    }

    function testOpenTroveMintsInterestToInterestRouter() public {
        priceFeed.setPrice(2000e18);
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        // Open initial Trove so that aggregate interest begins accruing
        openTroveNoHints100pctMaxFee(A,  5 ether, 3000e18,  25e16); 
       
        vm.warp(block.timestamp + 1 days);

        uint256 pendingAggInterest_1 = troveManager.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);

        // Open 2nd trove
        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  25e16); 

        // Check I-router Bold bal has increased as expected from 2nd trove opening
        uint256 boldBalRouter_1 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_1, pendingAggInterest_1);

        vm.warp(block.timestamp + 1 days);

        uint256 pendingAggInterest_2 = troveManager.calcPendingAggInterest();

        // Open 3rd trove
        openTroveNoHints100pctMaxFee(C,  2 ether, 2000e18, 25e16); 

        // Check I-router Bold bal has increased as expected from 3rd trove opening
        uint256 boldBalRouter_2 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_2, pendingAggInterest_1 + pendingAggInterest_2);
    }

    function testOpenTroveIncreasesWeightedSumByCorrectWeightedDebt() public {
        priceFeed.setPrice(2000e18);
        uint256 troveDebtRequest_A = 2000e18;
        uint256 annualInterest_A = 25e16;
        uint256 troveDebtRequest_B = 2000e18;
        uint256 annualInterest_B = 25e16;

        assertEq(troveManager.aggWeightedDebtSum(), 0);

        // A opens trove
        openTroveNoHints100pctMaxFee(A,  5 ether, troveDebtRequest_A,  annualInterest_A); 
        uint256 troveDebt_A = troveManager.getTroveDebt(A);
        assertGt(troveDebt_A, 0);

        // // Trove's debt should be weighted by its annual interest rate
        uint256 expectedWeightedDebt_A = troveDebt_A *  annualInterest_A;
        console.log(expectedWeightedDebt_A, "expectedWeightedDebt_A");
        console.log(troveManager.aggWeightedDebtSum(), "troveManager.aggWeightedDebtSum()");

        assertEq(troveManager.aggWeightedDebtSum(), expectedWeightedDebt_A);

        vm.warp(block.timestamp + 1000);

        // B opens Trove
        openTroveNoHints100pctMaxFee(B,  5 ether, troveDebtRequest_B,  annualInterest_B); 
        uint256 troveDebt_B = troveManager.getTroveDebt(A);
        assertGt(troveDebt_B, 0);

        uint256 expectedWeightedDebt_B = troveDebt_B *  annualInterest_B;

        assertEq(troveManager.aggWeightedDebtSum(), expectedWeightedDebt_A + expectedWeightedDebt_B);
    }

    // --- SP deposits ---

    function testSPDepositReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;
        // A opens Trove to obtain BOLD
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // // check there's pending agg. interest
        assertGt(troveManager.calcPendingAggInterest(), 0);

        // A deposits to SP
        makeSPDeposit(A, sPdeposit);

        // Check pending agg. interest reduced to 0
        assertEq(troveManager.calcPendingAggInterest(), 0);
    }

    function testSPDepositIncreasesAggRecordedDebtByPendingAggInterest() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;

        // A opens Trove to obtain BOLD
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 pendingInterest = troveManager.calcPendingAggInterest();
        assertGt(pendingInterest, 0);

        uint256 aggRecordedDebt_1 = troveManager.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);

        // A deposits to SP
        makeSPDeposit(A, sPdeposit);

        // Check pending agg. debt increased
        uint256 aggRecordedDebt_2 = troveManager.aggRecordedDebt();
        assertEq(aggRecordedDebt_2, aggRecordedDebt_1 + pendingInterest);
    }

    function testSPDepositUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;

        // A opens Trove to obtain BOLD
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.lastAggUpdateTime(), 0);
        assertLt(troveManager.lastAggUpdateTime(), block.timestamp);

        // A deposits to SP
        makeSPDeposit(A, sPdeposit);

        // Check last agg update time increased to now
        assertEq(troveManager.lastAggUpdateTime(), block.timestamp);
    }

    function testSPDepositMintsInterestToInterestRouter() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;

        // A opens Trove to obtain BOLD
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get I-router balance
        uint256 boldBalRouter_1 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_1, 0);

        uint256 pendingAggInterest = troveManager.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // Make SP deposit
        makeSPDeposit(A, sPdeposit);

        // Check I-router Bold bal has increased as expected from SP deposit
        uint256 boldBalRouter_2 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_2, pendingAggInterest);
    }

    //  Does not change the debt weighted sum
    function testSPDepositDoesNotChangeAggWeightedDebtSum() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;

        // A opens Trove to obtain BOLD
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get weighted sum before
        uint256 weightedDebtSum_1 = troveManager.aggWeightedDebtSum();
        assertGt(weightedDebtSum_1, 0);

        uint256 pendingAggInterest = troveManager.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // Make SP deposit
        makeSPDeposit(A, sPdeposit);

        // Get weighted sum after, check no change
        uint256 weightedDebtSum_2 = troveManager.aggWeightedDebtSum();
        assertEq(weightedDebtSum_2, weightedDebtSum_1);
    }

    // --- SP Withdrawals ---

    function testSPWithdrawalReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;
        // A opens Trove to obtain BOLD  and makes SP deposit
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        makeSPDeposit(A, sPdeposit);
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // check there's pending agg. interest
        assertGt(troveManager.calcPendingAggInterest(), 0);

        // A withdraws deposit
        makeSPWithdrawal(A, sPdeposit);

        // Check pending agg. interest reduced to 0
        assertEq(troveManager.calcPendingAggInterest(), 0);
    }

    function testSPWithdrawalIncreasesAggRecordedDebtByPendingAggInterest() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;
        // A opens Trove to obtain BOLD  and makes SP deposit
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        makeSPDeposit(A, sPdeposit);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 pendingInterest = troveManager.calcPendingAggInterest();
        assertGt(pendingInterest, 0);

        uint256 aggRecordedDebt_1 = troveManager.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);

        // A withdraws deposit
        makeSPWithdrawal(A, sPdeposit);

        // Check pending agg. debt increased
        uint256 aggRecordedDebt_2 = troveManager.aggRecordedDebt();
        assertEq(aggRecordedDebt_2, aggRecordedDebt_1 + pendingInterest);
    }

    function testSPWithdrawalUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;
        // A opens Trove to obtain BOLD  and makes SP deposit
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        makeSPDeposit(A, sPdeposit);
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(troveManager.lastAggUpdateTime(), 0);
        assertLt(troveManager.lastAggUpdateTime(), block.timestamp);

        // A withdraws from SP
        makeSPWithdrawal(A, sPdeposit);

        // Check last agg update time increased to now
        assertEq(troveManager.lastAggUpdateTime(), block.timestamp);
    }

    function testSPWithdrawalMintsInterestToInterestRouter() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;
        // A opens Trove to obtain BOLD  and makes SP deposit
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        makeSPDeposit(A, sPdeposit);
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get I-router balance
        uint256 boldBalRouter_1 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_1, 0);

        uint256 pendingAggInterest = troveManager.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A withdraws from SP
        makeSPWithdrawal(A, sPdeposit);

        // Check I-router Bold bal has increased as expected from 3rd trove opening
        uint256 boldBalRouter_2 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_2, pendingAggInterest);
    }

    function testSPWithdrawalDoesNotChangeAggWeightedDebtSum() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;

        // A opens Trove to obtain BOLD
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get weighted sum before
        uint256 weightedDebtSum_1 = troveManager.aggWeightedDebtSum();
        assertGt(weightedDebtSum_1, 0);

        uint256 pendingAggInterest = troveManager.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // Make SP deposit
        makeSPDeposit(A, sPdeposit);

        // Get weighted sum after, check no change
        uint256 weightedDebtSum_2 = troveManager.aggWeightedDebtSum();
        assertEq(weightedDebtSum_2, weightedDebtSum_1);
    }
}
