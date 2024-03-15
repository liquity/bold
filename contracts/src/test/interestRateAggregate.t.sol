pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract InterestRateAggregate is DevTestSetup {
    
    // ---  Pending aggregate interest calculator ---

    function testCalcPendingAggInterestReturns0For0TimePassedSinceLastUpdate() public {
        priceFeed.setPrice(2000e18);
        assertEq(activePool.lastAggUpdateTime(), 0);
        assertEq(activePool.calcPendingAggInterest(), 0);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  0); 
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
        assertEq(activePool.calcPendingAggInterest(), 0);

        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  5e17);
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    // calcPendingAggInterest returns 0 with no recorded aggregate debt

    function testCalcPendingAggInterestReturns0When0AggRecordedDebt() public {
        priceFeed.setPrice(2000e18);
        assertEq(activePool.aggRecordedDebt(), 0);
        assertEq(activePool.aggWeightedDebtSum(), 0);
        assertEq(activePool.calcPendingAggInterest(), 0);

        vm.warp(block.timestamp + 1000);
        assertEq(activePool.aggRecordedDebt(), 0);
        assertEq(activePool.aggWeightedDebtSum(), 0);
        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    // calcPendingAggInterest returns 0 when all troves have 0 interest rate
    function testCalcPendingAggInterestReturns0WhenAllTrovesHave0InterestRate() public {
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  0); 
        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  0); 

        assertEq(activePool.calcPendingAggInterest(), 0);
        
        vm.warp(block.timestamp + 1000);

        assertEq(activePool.calcPendingAggInterest(), 0);

        openTroveNoHints100pctMaxFee(C,  2 ether, 2000e18,  0); 

        assertEq(activePool.calcPendingAggInterest(), 0);

        vm.warp(block.timestamp + 1000);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    // TODO: create additional fuzz test
    function testCalcPendingAggInterestReturnsCorrectInterestForGivenPeriod() public {
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
    
        assertEq(expectedPendingAggInterest, activePool.calcPendingAggInterest());
    }

    // --- calcTroveAccruedInterest

    // returns 0 for non-existent trove
      function testCalcPendingTroveInterestReturns0When0AggRecordedDebt() public {
        priceFeed.setPrice(2000e18);

        assertEq(troveManager.calcTroveAccruedInterest(A), 0);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  25e16); 
        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  75e16); 

        vm.warp(block.timestamp + 1 days);

        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));

        closeTrove(B);

        assertEq(troveManager.calcTroveAccruedInterest(B), 0);
    }
    // returns 0 for 0 time passed

    function testCalcPendingTroveInterestReturns0For0TimePassed() public {
        priceFeed.setPrice(2000e18);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  25e16); 
        assertEq(troveManager.calcTroveAccruedInterest(A), 0);

        vm.warp(block.timestamp +  1 days);

        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  75e16); 
        assertEq(troveManager.calcTroveAccruedInterest(B), 0);
    }

    function testCalcPendingTroveInterestReturns0For0InterestRate() public {
        priceFeed.setPrice(2000e18);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  0); 

        assertEq(troveManager.calcTroveAccruedInterest(A), 0);

        vm.warp(block.timestamp +  1 days);

        assertEq(troveManager.calcTroveAccruedInterest(A), 0);
    }

    // TODO: create additional corresponding fuzz test
    function testCalcPendingTroveInterestReturnsCorrectInterestForGivenPeriod() public {
        priceFeed.setPrice(2000e18);

        uint256 annualRate_A = 1e18;
        uint256 annualRate_B = 37e16;
        uint256 debtRequest_A = 2000e18;
        uint256 debtRequest_B = 2500e18;

        uint256 duration = 42 days;

        openTroveNoHints100pctMaxFee(A,  2 ether, debtRequest_A,  annualRate_A); 
        uint256 debt_A = troveManager.getTroveDebt(A);
        assertGt(debt_A, 0);
        assertEq(troveManager.calcTroveAccruedInterest(A), 0);

        vm.warp(block.timestamp +  duration);

        uint256 expectedInterest_A = annualRate_A * debt_A * duration / 1e18 / SECONDS_IN_1_YEAR;
        assertEq(troveManager.calcTroveAccruedInterest(A), expectedInterest_A);
       
        openTroveNoHints100pctMaxFee(B,  2 ether, debtRequest_B,  annualRate_B); 
        uint256 debt_B = troveManager.getTroveDebt(B);
        assertGt(debt_B, 0);
        assertEq(troveManager.calcTroveAccruedInterest(B), 0);

        vm.warp(block.timestamp +  duration);

        uint256 expectedInterest_B = annualRate_B * debt_B * duration / 1e18 / SECONDS_IN_1_YEAR;
        assertEq(troveManager.calcTroveAccruedInterest(B), expectedInterest_B);
    }

    // --- mintAggInterest ---

    function testMintAggInterestRevertsWhenNotCalledByBOorSP() public {
       // pass positive debt change
        uint256 debtChange = 37e18;
        vm.startPrank(A);
        vm.expectRevert();
        activePool.mintAggInterest(debtChange, 0);
        vm.stopPrank();

        vm.startPrank(address(borrowerOperations));  
        activePool.mintAggInterest(debtChange, 0);
        vm.stopPrank();

        vm.startPrank(address(stabilityPool));  
        activePool.mintAggInterest(debtChange, 0);
        vm.stopPrank();
       
        // pass negative debt change
        vm.startPrank(A);
        vm.expectRevert();
        activePool.mintAggInterest(0, debtChange);
        vm.stopPrank();

        vm.startPrank(address(borrowerOperations));  
        activePool.mintAggInterest(0, debtChange);
        vm.stopPrank();

        vm.startPrank(address(stabilityPool));  
        activePool.mintAggInterest(0, debtChange);
        vm.stopPrank();

        // pass 0 debt change
        vm.startPrank(A);
        vm.expectRevert();
        activePool.mintAggInterest(0, 0);
        vm.stopPrank();

        vm.startPrank(address(borrowerOperations));  
        activePool.mintAggInterest(0, 0);
        vm.stopPrank();

        vm.startPrank(address(stabilityPool));  
        activePool.mintAggInterest(0, 0);
        vm.stopPrank();
    }

    // --- openTrove impact on aggregates ---

    // openTrove increases recorded aggregate debt by correct amount
    function testOpenTroveIncreasesRecordedAggDebtByAggPendingInterestPlusTroveDebt() public {
        priceFeed.setPrice(2000e18);
        assertEq(activePool.aggRecordedDebt(), 0);
    
        uint256 troveDebtRequest = 2000e18;
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); // 25% annual interest

        // Check aggregate recorded debt increased to non-zero
        uint256 aggREcordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggREcordedDebt_1, 0);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // check there's pending interest
        uint256 pendingInterest = activePool.calcPendingAggInterest();
        assertGt(pendingInterest, 0);

        uint256 expectedTroveDebt_B = troveDebtRequest + troveManager.BOLD_GAS_COMPENSATION();
        openTroveNoHints100pctMaxFee(B,  2 ether, troveDebtRequest,  25e16); 
        assertEq(troveManager.getTroveDebt(B), expectedTroveDebt_B);

        // check that opening Trove B increased the agg. recorded debt by the pending agg. interest plus Trove B's debt 
        assertEq(activePool.aggRecordedDebt(), aggREcordedDebt_1 + pendingInterest + expectedTroveDebt_B);
    }

    function testOpenTroveIncreasesRecordedDebtSumByTroveDebt() public {
        priceFeed.setPrice(2000e18);
        assertEq(activePool.aggRecordedDebt(), 0);
    
        uint256 troveDebtRequest = 2000e18;
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); // 25% annual interest

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 recordedDebt_1 = activePool.getRecordedDebtSum();
        assertGt(recordedDebt_1, 0);

        openTroveNoHints100pctMaxFee(B,  2 ether, troveDebtRequest,  25e16); 
        uint256 troveDebt_A = troveManager.getTroveDebt(A);
        assertGt(troveDebt_A, 0);

        assertEq(activePool.getRecordedDebtSum(), recordedDebt_1 + troveDebt_A);
    }

    function testOpenTroveReducesPendingAggInterestTo0() public {
        priceFeed.setPrice(2000e18);
    
        uint256 troveDebtRequest = 2000e18;
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); // 25% annual interest

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // check there's pending agg. interest
        assertGt(activePool.calcPendingAggInterest(), 0);

        openTroveNoHints100pctMaxFee(B,  2 ether, troveDebtRequest,  25e16); 

        // Check pending agg. interest reduced to 0
        assertEq(activePool.calcPendingAggInterest(), 0);
    }
    
    function testOpenTroveUpdatesTheLastAggUpdateTime() public {
        priceFeed.setPrice(2000e18);
        assertEq(activePool.lastAggUpdateTime(), 0);

        vm.warp(block.timestamp + 1 days);
        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  25e16); // 25% annual interest
    
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);

        vm.warp(block.timestamp + 1 days);

        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  25e16); // 25% annual interest

        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    function testOpenTroveMintsInterestToInterestRouter() public {
        priceFeed.setPrice(2000e18);
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        // Open initial Trove so that aggregate interest begins accruing
        openTroveNoHints100pctMaxFee(A,  5 ether, 3000e18,  25e16); 
       
        vm.warp(block.timestamp + 1 days);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);

        // Open 2nd trove
        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  25e16); 

        // Check I-router Bold bal has increased as expected from 2nd trove opening
        uint256 boldBalRouter_1 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_1, pendingAggInterest_1);

        vm.warp(block.timestamp + 1 days);

        uint256 pendingAggInterest_2 = activePool.calcPendingAggInterest();

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

        assertEq(activePool.aggWeightedDebtSum(), 0);

        // A opens trove
        openTroveNoHints100pctMaxFee(A,  5 ether, troveDebtRequest_A,  annualInterest_A); 
        uint256 troveDebt_A = troveManager.getTroveDebt(A);
        assertGt(troveDebt_A, 0);

        // // Trove's debt should be weighted by its annual interest rate
        uint256 expectedWeightedDebt_A = troveDebt_A *  annualInterest_A;
        console.log(expectedWeightedDebt_A, "expectedWeightedDebt_A");
        console.log(activePool.aggWeightedDebtSum(), "activePool.aggWeightedDebtSum()");

        assertEq(activePool.aggWeightedDebtSum(), expectedWeightedDebt_A);

        vm.warp(block.timestamp + 1000);

        // B opens Trove
        openTroveNoHints100pctMaxFee(B,  5 ether, troveDebtRequest_B,  annualInterest_B); 
        uint256 troveDebt_B = troveManager.getTroveDebt(A);
        assertGt(troveDebt_B, 0);

        uint256 expectedWeightedDebt_B = troveDebt_B *  annualInterest_B;

        assertEq(activePool.aggWeightedDebtSum(), expectedWeightedDebt_A + expectedWeightedDebt_B);
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
        assertGt(activePool.calcPendingAggInterest(), 0);

        // A deposits to SP
        makeSPDeposit(A, sPdeposit);

        // Check pending agg. interest reduced to 0
        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    function testSPDepositIncreasesAggRecordedDebtByPendingAggInterest() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;

        // A opens Trove to obtain BOLD
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 pendingInterest = activePool.calcPendingAggInterest();
        assertGt(pendingInterest, 0);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);

        // A deposits to SP
        makeSPDeposit(A, sPdeposit);

        // Check pending agg. debt increased
        uint256 aggRecordedDebt_2 = activePool.aggRecordedDebt();
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

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A deposits to SP
        makeSPDeposit(A, sPdeposit);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
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

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
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
        uint256 weightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(weightedDebtSum_1, 0);

        // Make SP deposit
        makeSPDeposit(A, sPdeposit);

        // Get weighted sum after, check no change
        uint256 weightedDebtSum_2 = activePool.aggWeightedDebtSum();
        assertEq(weightedDebtSum_2, weightedDebtSum_1);
    }

    function testSPDepositDoesNotChangeRecordedDebtSum() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;

        // A opens Trove to obtain BOLD
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get recorded sum before
        uint256 recordedDebt_1 = activePool.getRecordedDebtSum();
        assertGt(recordedDebt_1, 0);

        // Make SP deposit
        makeSPDeposit(A, sPdeposit);

        // Get recorded sum after, check no change
        assertEq(activePool.getRecordedDebtSum(), recordedDebt_1);
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
        assertGt(activePool.calcPendingAggInterest(), 0);

        // A withdraws deposit
        makeSPWithdrawal(A, sPdeposit);

        // Check pending agg. interest reduced to 0
        assertEq(activePool.calcPendingAggInterest(), 0);
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

        uint256 pendingInterest = activePool.calcPendingAggInterest();
        assertGt(pendingInterest, 0);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);

        // A withdraws deposit
        makeSPWithdrawal(A, sPdeposit);

        // Check pending agg. debt increased
        uint256 aggRecordedDebt_2 = activePool.aggRecordedDebt();
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

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A withdraws from SP
        makeSPWithdrawal(A, sPdeposit);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
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

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
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
        makeSPDeposit(A, sPdeposit);
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get weighted sum before
        uint256 weightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(weightedDebtSum_1, 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // Make SP deposit
        makeSPWithdrawal(A, sPdeposit);

        // Get weighted sum after, check no change
        uint256 weightedDebtSum_2 = activePool.aggWeightedDebtSum();
        assertEq(weightedDebtSum_2, weightedDebtSum_1);
    }

    function testSPWithdrawalDoesNotChangeRecordedDebtSum() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;

        // A opens Trove to obtain BOLD
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        makeSPDeposit(A, sPdeposit);
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

      // Get recorded sum before
        uint256 recordedDebt_1 = activePool.getRecordedDebtSum();
        assertGt(recordedDebt_1, 0);

        // Make SP withdrawal
        makeSPWithdrawal(A, sPdeposit);

        // Get weighted sum after, check no change
        assertEq(activePool.getRecordedDebtSum(), recordedDebt_1);
    }

    // --- closeTrove ---

    // Reduces pending agg interest to 0
    function testCloseTroveReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;
         // A, B open Troves 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        openTroveNoHints100pctMaxFee(B,  5 ether, troveDebtRequest,  50e16); 
       
        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // check there's pending agg. interest
        assertGt(activePool.calcPendingAggInterest(), 0);

        // B closes Trove
        closeTrove(B);
    
        // // Check pending agg. interest reduced to 0
        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    // Increases agg recorded debt by pending agg interest

    function testCloseTroveAddsPendingAggInterestAndSubtractsRecordedDebtPlusInterestFromAggRecordedDebt() public {
        uint256 troveDebtRequest = 2000e18;
         // A, B open Troves 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        openTroveNoHints100pctMaxFee(B,  5 ether, troveDebtRequest,  50e16); 
       
        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Check the agg recorded debt is non-zero
        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);

        // Check there's pending agg. interest
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(activePool.calcPendingAggInterest(), 0);

        // Check Trove's entire debt is larger than their recorded debt:
        (uint256 entireTroveDebt_B, , , , )= troveManager.getEntireDebtAndColl(B);
        assertGt(entireTroveDebt_B, troveManager.getTroveDebt(B));

        // B closes Trove
        closeTrove(B);

        // // Check agg. recorded debt increased by pending agg. interest less the closed Trove's entire debt
        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest - entireTroveDebt_B);
    }

    // Updates last agg update time to now
    function testCloseTroveUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 2000e18;
         // A, B open Troves 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        openTroveNoHints100pctMaxFee(B,  5 ether, troveDebtRequest,  50e16); 
       
        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // B closes Trove
        closeTrove(B);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    // mints interest to interest router
    function testCloseTroveMintsInterestToInterestRouter() public {
        uint256 troveDebtRequest = 2000e18;
         // A, B open Troves 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        openTroveNoHints100pctMaxFee(B,  5 ether, troveDebtRequest,  50e16); 
       
        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get I-router balance
        uint256 boldBalRouter_1 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_1, 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // B closes Trove
        closeTrove(B);

        // Check I-router Bold bal has increased as expected from 3rd trove opening
        uint256 boldBalRouter_2 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_2, pendingAggInterest);
    }

    // Reduces agg. weighted sum by the Trove's recorded debt

    function testCloseTroveReducesAggWeightedDebtSumByTrovesWeightedRecordedDebt() public {
        uint256 troveDebtRequest = 2000e18;
         // A, B open Troves 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        openTroveNoHints100pctMaxFee(B,  5 ether, troveDebtRequest,  50e16); 
       
        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_B = troveManager.getTroveDebt(B);
        uint256 annualInterestRate_B = troveManager.getTroveAnnualInterestRate(B);
        assertGt(recordedTroveDebt_B, 0);
        assertGt(annualInterestRate_B, 0);
        uint256 weightedTroveDebt = recordedTroveDebt_B * annualInterestRate_B;
        
        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // B closes Trove
        closeTrove(B);
        assertEq(activePool.aggWeightedDebtSum(), aggWeightedDebtSum_1 - weightedTroveDebt);
    }

    function testCloseTroveReducesRecordedDebtSumByInitialRecordedDebt() public {
        uint256 troveDebtRequest = 2000e18;
        // A, B open Troves 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        openTroveNoHints100pctMaxFee(B,  5 ether, troveDebtRequest,  50e16); 
        uint256 recordedDebt_B = troveManager.getTroveDebt(B);
       
        uint256 activePoolRecordedDebt_1 = activePool.getRecordedDebtSum();
        assertGt(activePoolRecordedDebt_1, 0);
        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

          // B closes Trove
        closeTrove(B);

        // Check recorded debt sum reduced by B's recorded debt
        assertEq(activePool.getRecordedDebtSum(), activePoolRecordedDebt_1 - recordedDebt_B);
    }

    function testCloseTroveReducesBorrowerBoldBalByEntireTroveDebtLessGasComp() public {
         uint256 troveDebtRequest = 2000e18;
        // A, B opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        openTroveNoHints100pctMaxFee(B,  5 ether, troveDebtRequest,  50e16); 
       
        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));
        uint256 bal_B = boldToken.balanceOf(B);
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);
        
        // Get the up-to-date entire debt
        (uint256 entireDebt_B, , , , ) = troveManager.getEntireDebtAndColl(B);

        // B closes Trove
        closeTrove(B);

        // Check balance of B reduces by the Trove's entire debt less gas comp
        assertEq(boldToken.balanceOf(B), bal_B - (entireDebt_B - troveManager.BOLD_GAS_COMPENSATION()));
    }

    // --- adjustTroveInterestRate ---

    function testAdjustTroveInterestRateWithNoPendingDebtGainIncreasesAggRecordedDebtByPendingAggInterest() public {
         uint256 troveDebtRequest = 2000e18;
        // A opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 

        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        changeInterestRateNoHints(A, 75e16);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest);
    }

    function testAdjustTroveInterestRateReducesPendingAggInterestTo0() public {
          uint256 troveDebtRequest = 2000e18;
        // A opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 

        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.calcPendingAggInterest(), 0);

        changeInterestRateNoHints(A, 75e16);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    // Update last agg. update time to now
    function testAdjustTroveInterestRateUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 2000e18;
        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A changes interest rate
        changeInterestRateNoHints(A, 75e16);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    // mints interest to router
    function testAdjustTroveInterestRateMintsAggInterestToRouter() public {
        uint256 troveDebtRequest = 2000e18;
        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get I-router balance
        uint256 boldBalRouter_1 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_1, 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A changes interest rate
        changeInterestRateNoHints(A, 75e16);

        // Check I-router Bold bal has increased as expected
        uint256 boldBalRouter_2 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_2, pendingAggInterest);
    }

    // updates weighted debt sum: removes old and adds new
    function testAdjustTroveInterestRateAdjustsWeightedDebtSumCorrectly() public {
        uint256 troveDebtRequest = 2000e18;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 
        
        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(A);
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        (uint256 entireTroveDebt, , , , ) = troveManager.getEntireDebtAndColl(A);

        uint256 newAnnualInterestRate = 75e16;
        uint256 expectedNewRecordedWeightedDebt = entireTroveDebt * newAnnualInterestRate;

        // A changes interest rate
        changeInterestRateNoHints(A, newAnnualInterestRate);

        // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(activePool.aggWeightedDebtSum(), aggWeightedDebtSum_1 - oldRecordedWeightedDebt + expectedNewRecordedWeightedDebt);
    }

    function testAdjustTroveInterestRateWithNoPendingDebtRewardIncreasesRecordedDebtSumByTrovesAccruedInterest() public {
        uint256 troveDebtRequest = 2000e18;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  2 ether, troveDebtRequest,  25e16); 

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 pendingRedistDebtGain = troveManager.getPendingBoldDebtReward(A);
        assertEq(pendingRedistDebtGain, 0);
        uint256 pendingInterest = troveManager.calcTroveAccruedInterest(A);
        assertGt(pendingInterest, 0);

        // Get current recorded active debt
        uint256 recordedDebtSum_1 = activePool.getRecordedDebtSum();

        // A changes interest rate
        changeInterestRateNoHints(A, 75e16);

        // Check recorded debt sum increases by the pending interest
        assertEq(activePool.getRecordedDebtSum(), recordedDebtSum_1 + pendingInterest);
    }

    // TODO: getEntireDebt and getTCR basic tests


    // --- withdrawBold tests ---

    function testWithdrawBoldWithNoPendingRewardIncreasesAggRecordedDebtByPendingAggInterestPlusBorrowerDebtChange() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 debtIncrease =  500e18;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A draws more debt
        withdrawBold100pctMaxFee(A, debtIncrease);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest + debtIncrease);
    }

    function testWithdrawBoldReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 debtIncrease =  500e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.calcPendingAggInterest(), 0);

        // A draws more debt
        withdrawBold100pctMaxFee(A, debtIncrease);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    function testWithdrawBoldMintsAggInterestToRouter() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 debtIncrease =  500e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        vm.warp(block.timestamp + 1 days);

        // Check I-router balance is 0
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        uint256 aggInterest = activePool.calcPendingAggInterest();
        assertGt(aggInterest, 0);

        // A draws more debt
        withdrawBold100pctMaxFee(A, debtIncrease);

        assertEq(boldToken.balanceOf(address(mockInterestRouter)), aggInterest);
    }

    // Updates last agg update time to now
    function testWithdrawBoldUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 debtIncrease =  500e18;
        
        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A draws more debt
        withdrawBold100pctMaxFee(A, debtIncrease);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    // With no redist gain, increases recorded debt sum by the borrower's debt change plus Trove's accrued interest

    function testWithdrawBoldWithNoPendingDebtRewardIncreasesRecordedDebtSumByTrovesAccruedInterestPlusDebtChange() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 debtIncrease =  500e18;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 pendingRedistDebtGain = troveManager.getPendingBoldDebtReward(A);
        assertEq(pendingRedistDebtGain, 0);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(A);
        assertGt(accruedTroveInterest, 0);

        // Get current recorded active debt
        uint256 recordedDebtSum_1 = activePool.getRecordedDebtSum();

        // A draws more debt
        withdrawBold100pctMaxFee(A, debtIncrease);

        // Check recorded debt sum increases by the accrued interest plus debt change
        assertEq(activePool.getRecordedDebtSum(), recordedDebtSum_1 + accruedTroveInterest + debtIncrease);
    }

    function testWithdrawBoldAdjustsWeightedDebtSumCorrectly() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 debtIncrease =  500e18;
        uint256 interestRate = 25e16;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate); 
        
        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(A);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // A draws more debt
        withdrawBold100pctMaxFee(A, debtIncrease);

        (uint256 entireTroveDebt, , , , ) = troveManager.getEntireDebtAndColl(A);
        uint256 expectedNewRecordedWeightedDebt = entireTroveDebt * interestRate;

        // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(activePool.aggWeightedDebtSum(), aggWeightedDebtSum_1 - oldRecordedWeightedDebt + expectedNewRecordedWeightedDebt);
    }

    // --- repayBold tests ---

    function testRepayBoldWithNoPendingRewardIncreasesAggRecordedDebtByPendingAggInterestMinusBorrowerDebtChange() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 debtDecrease =  500e18;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A repays bold
        repayBold(A, debtDecrease);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest - debtDecrease);
    }

    function testRepayBoldReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 debtDecrease =  500e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.calcPendingAggInterest(), 0);

        // A repays debt
        repayBold(A, debtDecrease);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

     function testRepayBoldMintsAggInterestToRouter() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 debtDecrease =  500e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        vm.warp(block.timestamp + 1 days);
        
        // Check I-router balance is 0
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A repays debt
        repayBold(A, debtDecrease);

        assertEq(boldToken.balanceOf(address(mockInterestRouter)), pendingAggInterest);
    }

    function testRepayBoldUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 debtDecrease =  500e18;
        
        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

      // A repays debt
        repayBold(A, debtDecrease);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

      function testRepayBoldWithNoPendingDebtRewardIncreasesRecordedDebtSumByTrovesAccruedInterestMinusDebtChange() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 debtDecrease =  500e18;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 pendingRedistDebtGain = troveManager.getPendingBoldDebtReward(A);
        assertEq(pendingRedistDebtGain, 0);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(A);
        assertGt(accruedTroveInterest, 0);

        // Get current recorded active debt
        uint256 recordedDebtSum_1 = activePool.getRecordedDebtSum();

        // A repays debt
        repayBold(A, debtDecrease);

        // Check recorded debt sum increases by the accrued interest plus debt change
        assertEq(activePool.getRecordedDebtSum(), recordedDebtSum_1 + accruedTroveInterest - debtDecrease);
    }

    function testRepayBoldAdjustsWeightedDebtSumCorrectly() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 debtDecrease =  500e18;
        uint256 interestRate = 25e16;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate); 
        
        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(A);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // A repays debt
        repayBold(A, debtDecrease);

        (uint256 entireTroveDebt, , , , ) = troveManager.getEntireDebtAndColl(A);
        uint256 expectedNewRecordedWeightedDebt = entireTroveDebt * interestRate;

        // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(activePool.aggWeightedDebtSum(), aggWeightedDebtSum_1 - oldRecordedWeightedDebt + expectedNewRecordedWeightedDebt);
    }

    //  --- addColl tests ---

    function testAddCollWithNoPendingRewardIncreasesAggRecordedDebtByPendingAggInterest() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 collIncrease = 1 ether;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A  adds coll
        addColl(A, collIncrease);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest);
    }

    function testAddCollReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 collIncrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.calcPendingAggInterest(), 0);

        // A adds coll
        addColl(A, collIncrease);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

      function testAddCollMintsAggInterestToRouter() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 collIncrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        vm.warp(block.timestamp + 1 days);

        // Check I-router balance is 0
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        uint256 aggInterest = activePool.calcPendingAggInterest();
        assertGt(aggInterest, 0);

        // A adds coll
        addColl(A, collIncrease);

        assertEq(boldToken.balanceOf(address(mockInterestRouter)), aggInterest);
    }

    function testAddCollUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 collIncrease = 1 ether;
        
        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A adds coll
        addColl(A, collIncrease);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    function testAddCollWithNoPendingDebtRewardIncreasesRecordedDebtSumByTrovesAccruedInterest() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 collIncrease = 1 ether;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 pendingRedistDebtGain = troveManager.getPendingBoldDebtReward(A);
        assertEq(pendingRedistDebtGain, 0);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(A);
        assertGt(accruedTroveInterest, 0);

        // Get current recorded active debt
        uint256 recordedDebtSum_1 = activePool.getRecordedDebtSum();

        // A adds coll
        addColl(A, collIncrease);

        // Check recorded debt sum increases by the accrued interest
        assertEq(activePool.getRecordedDebtSum(), recordedDebtSum_1 + accruedTroveInterest);
    }

    function testAddCollAdjustsWeightedDebtSumCorrectly() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 collIncrease = 1 ether;
        uint256 interestRate = 25e16;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate); 
        
        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(A);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // A adds coll
        addColl(A, collIncrease);

        (uint256 entireTroveDebt, , , , ) = troveManager.getEntireDebtAndColl(A);
        uint256 expectedNewRecordedWeightedDebt = entireTroveDebt * interestRate;

        // Weighted debt should have increased due to interest being applied
        assertGt(expectedNewRecordedWeightedDebt, oldRecordedWeightedDebt);

        // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(activePool.aggWeightedDebtSum(), aggWeightedDebtSum_1 - oldRecordedWeightedDebt + expectedNewRecordedWeightedDebt);
    }

    // --- withdrawColl ---

    function testWithdrawCollWithNoPendingRewardIncreasesAggRecordedDebtByPendingAggInterest() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 collDecrease = 1 ether;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A  withdraws coll
        withdrawColl(A, collDecrease);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest);
    }

    function testWithdrawCollReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 collDecrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.calcPendingAggInterest(), 0);

         // A  withdraws coll
        withdrawColl(A, collDecrease);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    function testWithdrawCollMintsAggInterestToRouter() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 collDecrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        vm.warp(block.timestamp + 1 days);

        // Check I-router balance is 0
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        uint256 aggInterest = activePool.calcPendingAggInterest();
        assertGt(aggInterest, 0);

        // A withdraws coll
        withdrawColl(A, collDecrease);

        assertEq(boldToken.balanceOf(address(mockInterestRouter)), aggInterest);
    }

    function testWithdrawCollUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 collDecrease = 1 ether;
        
        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A withdraw coll
        withdrawColl(A, collDecrease);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    function testWithdrawCollWithNoPendingDebtRewardIncreasesRecordedDebtSumByTrovesAccruedInterest() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 collDecrease = 1 ether;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 pendingRedistDebtGain = troveManager.getPendingBoldDebtReward(A);
        assertEq(pendingRedistDebtGain, 0);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(A);
        assertGt(accruedTroveInterest, 0);

        // Get current recorded active debt
        uint256 recordedDebtSum_1 = activePool.getRecordedDebtSum();

        // A withdraw coll
        withdrawColl(A, collDecrease);

        // Check recorded debt sum increases by the accrued interest
        assertEq(activePool.getRecordedDebtSum(), recordedDebtSum_1 + accruedTroveInterest);
    }

    function testWithdrawCollAdjustsWeightedDebtSumCorrectly() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 collDecrease = 1 ether;
        uint256 interestRate = 25e16;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate); 
        
        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(A);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // A withdraw coll
        withdrawColl(A, collDecrease);

        (uint256 entireTroveDebt, , , , ) = troveManager.getEntireDebtAndColl(A);
        uint256 expectedNewRecordedWeightedDebt = entireTroveDebt * interestRate;

        // Weighted debt should have increased due to interest being applied
        assertGt(expectedNewRecordedWeightedDebt, oldRecordedWeightedDebt);

        // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(activePool.aggWeightedDebtSum(), aggWeightedDebtSum_1 - oldRecordedWeightedDebt + expectedNewRecordedWeightedDebt);
    }
    
    // --- applyTroveInterestPermissionless ---

    function testApplyTroveInterestPermissionlessWithNoPendingRewardIncreasesAggRecordedDebtByPendingAggInterest() public {
        uint256 troveDebtRequest = 2000e18;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        // fast-forward past such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(A));

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, A);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest);
    }

    function testApplyTroveInterestPermissionlessReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 collDecrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        // fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(A));

        assertGt(activePool.calcPendingAggInterest(), 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, A);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    function testApplyTroveInterestPermissionlessMintsPendingAggInterestToRouter() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 collDecrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        // fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(A));

        // Check I-router balance is 0
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, A);

        // Check I-router Bold bal has increased by the pending agg interest
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), pendingAggInterest);
    }

    function testApplyTroveInterestPermissionlessUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 2000e18;
        
        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 
        
        // fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(A));

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, A);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    function testApplyTroveInterestPermissionlessWithNoPendingDebtRewardIncreasesRecordedDebtSumByTrovesAccruedInterest() public {
        uint256 troveDebtRequest = 2000e18;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest,  25e16); 

        // fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(A));

        uint256 pendingRedistDebtGain = troveManager.getPendingBoldDebtReward(A);
        assertEq(pendingRedistDebtGain, 0);
        uint256 accruedTroveInterest = troveManager.calcTroveAccruedInterest(A);
        assertGt(accruedTroveInterest, 0);

        // Get current recorded active debt
        uint256 recordedDebtSum_1 = activePool.getRecordedDebtSum();

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, A);

        // Check recorded debt sum increases by the accrued interest
        assertEq(activePool.getRecordedDebtSum(), recordedDebtSum_1 + accruedTroveInterest);
    }

    function testApplyTroveInterestPermissionlessAdjustsWeightedDebtSumCorrectly() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        // A opens Trove 
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A,  3 ether, troveDebtRequest, interestRate); 
        
        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(A);

        // fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(A));

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, A);

        (uint256 entireTroveDebt, , , , ) = troveManager.getEntireDebtAndColl(A);
        uint256 expectedNewRecordedWeightedDebt = entireTroveDebt * interestRate;

        // Weighted debt should have increased due to interest being applied
        assertGt(expectedNewRecordedWeightedDebt, oldRecordedWeightedDebt);

        // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(activePool.aggWeightedDebtSum(), aggWeightedDebtSum_1 - oldRecordedWeightedDebt + expectedNewRecordedWeightedDebt);
    }

    // --- getTotalSystemDebt tests ---

    function testGetEntireSystemDebtReturns0For0TrovesOpen() public {
        uint256 entireSystemDebt_1 = troveManager.getEntireSystemDebt();
        assertEq(entireSystemDebt_1, 0);

        vm.warp(block.timestamp + 1 days);

        uint256 entireSystemDebt_2 = troveManager.getEntireSystemDebt();
        assertEq(entireSystemDebt_2, 0);
    }
    function testGetEntireSystemDebtWithNoInterestAndNoRedistGainsReturnsSumOfTroveRecordedDebts() public {
        uint256 troveDebtRequest_A = 2000e18;
        uint256 troveDebtRequest_B = 3000e18;
        uint256 troveDebtRequest_C = 4000e18;
        uint256 interestRate = 5e17;

        priceFeed.setPrice(2000e18);

        openTroveNoHints100pctMaxFee(A,  20 ether, troveDebtRequest_A, interestRate); 
        openTroveNoHints100pctMaxFee(B,  20 ether, troveDebtRequest_B, interestRate); 
        openTroveNoHints100pctMaxFee(C,  20 ether, troveDebtRequest_C, interestRate); 

        uint256 recordedDebt_A = troveManager.getTroveDebt(A);
        uint256 recordedDebt_B = troveManager.getTroveDebt(B);
        uint256 recordedDebt_C = troveManager.getTroveDebt(C);
        assertGt(recordedDebt_A, 0);
        assertGt(recordedDebt_B, 0);
        assertGt(recordedDebt_C, 0);

        uint256 entireSystemDebt = troveManager.getEntireSystemDebt();
        console.log(entireSystemDebt);
        console.log(recordedDebt_A + recordedDebt_B + recordedDebt_C);

        assertEq(entireSystemDebt, recordedDebt_A + recordedDebt_B + recordedDebt_C);
    }

    function testGetEntireSystemDebtWithNoRedistGainsReturnsSumOfTroveRecordedDebtsPlusIndividualInterests() public {
        uint256 troveDebtRequest_A = 2000e18;
        uint256 troveDebtRequest_B = 3000e18;
        uint256 troveDebtRequest_C = 4000e18;
        uint256 interestRate = 5e17;

        priceFeed.setPrice(2000e18);

        openTroveNoHints100pctMaxFee(A,  20 ether, troveDebtRequest_A, interestRate); 
        openTroveNoHints100pctMaxFee(B,  20 ether, troveDebtRequest_B, interestRate); 
        openTroveNoHints100pctMaxFee(C,  20 ether, troveDebtRequest_C, interestRate); 

        // Fast-forward time, accrue interest
        vm.warp(block.timestamp + 1 days);

        uint256 recordedDebt_A = troveManager.getTroveDebt(A);
        uint256 recordedDebt_B = troveManager.getTroveDebt(B);
        uint256 recordedDebt_C = troveManager.getTroveDebt(C);
        assertGt(recordedDebt_A, 0);
        assertGt(recordedDebt_B, 0);
        assertGt(recordedDebt_C, 0);

        uint256 accruedInterest_A = troveManager.calcTroveAccruedInterest(A);
        uint256 accruedInterest_B = troveManager.calcTroveAccruedInterest(B);
        uint256 accruedInterest_C = troveManager.calcTroveAccruedInterest(C);
        assertGt(accruedInterest_A, 0);
        assertGt(accruedInterest_B, 0);
        assertGt(accruedInterest_C, 0);

        uint256 entireSystemDebt = troveManager.getEntireSystemDebt();

        uint256 sumIndividualTroveDebts = 
        recordedDebt_A + accruedInterest_A +
        recordedDebt_B + accruedInterest_B + 
        recordedDebt_C + accruedInterest_C;

        console.log(entireSystemDebt, "entireSystemDebt");
        console.log(sumIndividualTroveDebts, "sumIndividualTroveDebts");

        assertApproximatelyEqual(entireSystemDebt, sumIndividualTroveDebts, 10);
    }
    
    // TODO: more thorough invariant test

    // --- withdrawETHGainToTrove ---

    function testWithdrawETHGainToTroveIncreasesAggRecordedDebtByAggInterest() public {
        _setupForWithdrawETHGainToTrove();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);
       
        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A withdraws ETH gain to Trove
        withdrawETHGainToTrove(A);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest);
    }

    function testWithdrawETHGainToTroveReducesPendingAggInterestTo0() public {
        _setupForWithdrawETHGainToTrove();

       // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        // check there's pending agg. interest
        assertGt(activePool.calcPendingAggInterest(), 0);

        // A withdraws ETH gain to Trove
        withdrawETHGainToTrove(A);

        // Check pending agg. interest reduced to 0
        assertEq(activePool.calcPendingAggInterest(), 0);
    }

      function testWithdrawETHGainToTroveMintsInterestToRouter() public {
        _setupForWithdrawETHGainToTrove();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        // Get I-router balance
        uint256 boldBalRouter_1 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_1, 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A withdraws ETH gain to Trove
        withdrawETHGainToTrove(A);

        // Check I-router Bold bal has increased as expected from SP deposit
        uint256 boldBalRouter_2 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_2, pendingAggInterest);
    }

    function testWithdrawETHGainToTroveUpdatesLastAggUpdateTimeToNow() public {
        _setupForWithdrawETHGainToTrove();
        
        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A withdraws ETH gain to Trove
        withdrawETHGainToTrove(A);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    function testWithdrawETHGainToTroveChangesAggWeightedDebtSumCorrectly() public {
        _setupForWithdrawETHGainToTrove();
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get weighted sum before
        uint256 weightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(weightedDebtSum_1, 0);

        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(A);
        assertGt(oldRecordedWeightedDebt, 0);

       // A withdraws ETH gain to Trove
        withdrawETHGainToTrove(A);

       // Expect recorded weighted debt to have increased due to accrued Trove interest being applied
        uint256 newRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(A);
        assertGt(newRecordedWeightedDebt, oldRecordedWeightedDebt);
    
       // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(activePool.aggWeightedDebtSum(), weightedDebtSum_1 - oldRecordedWeightedDebt + newRecordedWeightedDebt);
    }

    function testWithdrawETHGainToTroveChangesRecordedDebtSumCorrectly() public {
        _setupForWithdrawETHGainToTrove();
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get recorded sum before
        uint256 recordedDebt_1 = activePool.getRecordedDebtSum();
        assertGt(recordedDebt_1, 0);

        uint256 oldTroveRecordedDebt = troveManager.getTroveDebt(A);
        assertGt(oldTroveRecordedDebt, 0);

        // A withdraws ETH gain to Trove
        withdrawETHGainToTrove(A);

        // Expect recorded debt to have increased due to accrued Trove interest being applied
        uint256 newTroveRecordedDebt = troveManager.getTroveDebt(A);
        assertGt(newTroveRecordedDebt, oldTroveRecordedDebt);

        // Get recorded sum after, check no change
        assertEq(activePool.getRecordedDebtSum(), recordedDebt_1  - oldTroveRecordedDebt + newTroveRecordedDebt);
    }

    // TODO: mixed collateral & debt adjustment opps
    // TODO: tests with pending debt redist. gain >0
    // TODO: tests that show total debt change under user ops
    // TODO: Basic TCR and ICR getter tests
    // TODO: Test total debt invariant holds i.e. (D + S * delta_T) == sum_of_all_entire_trove_debts.

    // --- batchLiquidateTroves (Normal Mode) ---

    function testBatchLiquidateTrovesPureOffsetChangesAggRecordedInterestCorrectly() public {
        _setupForBatchLiquidateTrovesPureOffset();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);
    
        uint256 recordedDebt_C = troveManager.getTroveDebt(C);
        uint256 recordedDebt_D = troveManager.getTroveDebt(D);
        assertGt(recordedDebt_C, 0);
        assertGt(recordedDebt_D, 0);
        uint256 recordedDebtInLiq = recordedDebt_C + recordedDebt_D;
        
        uint256 accruedInterest_C = troveManager.calcTroveAccruedInterest(C);
        uint256 accruedInterest_D = troveManager.calcTroveAccruedInterest(D);
        assertGt(accruedInterest_C, 0);
        assertGt(accruedInterest_D, 0);
        uint256 accruedInterestInLiq = accruedInterest_C + accruedInterest_D;
       
        // A liquidates C and D
        address[] memory trovesToLiq = new address[](2); 
        trovesToLiq[0] = C;
        trovesToLiq[1] = D;
        batchLiquidateTroves(A, trovesToLiq);

        // Check both Troves were closed by liquidation
        assertEq(troveManager.getTroveStatus(C), 3);
        assertEq(troveManager.getTroveStatus(D), 3);
    
        // // changes agg. recorded debt by: agg_accrued_interest - liq'd_troves_recorded_trove_debts - liq'd_troves_accrued_interest
        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest - recordedDebtInLiq - accruedInterestInLiq);
    }

   function testBatchLiquidateTrovesReducesAggPendingInterestTo0() public {
        _setupForBatchLiquidateTrovesPureOffset();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.calcPendingAggInterest(), 0);

        // A liquidates C and D
        address[] memory trovesToLiq = new address[](2); 
        trovesToLiq[0] = C;
        trovesToLiq[1] = D;
        batchLiquidateTroves(A, trovesToLiq);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }


    // Mints interest to Router
    function testBatchLiquidateTrovesMintsAggInterestToRouter() public {
        _setupForBatchLiquidateTrovesPureOffset();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        uint256 boldBalRouter_1 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_1, 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

       // A liquidates C and D
        address[] memory trovesToLiq = new address[](2); 
        trovesToLiq[0] = C;
        trovesToLiq[1] = D;
        batchLiquidateTroves(A, trovesToLiq);

        // Check I-router Bold bal has increased as expected from liquidation
        uint256 boldBalRouter_2 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_2, pendingAggInterest);
    }

    function testBatchLiquidateTrovesUpdatesLastAggInterestUpdateTimeToNow() public {
        _setupForBatchLiquidateTrovesPureOffset();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A liquidates C and D
        address[] memory trovesToLiq = new address[](2); 
        trovesToLiq[0] = C;
        trovesToLiq[1] = D;
        batchLiquidateTroves(A, trovesToLiq);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);

    }

    // Removes liq'd troves' weighted recorded debts from the weighted recorded debt sum
    function testBatchLiquidateTrovesRemovesLiquidatedTrovesWeightedRecordedDebtsFromWeightedRecordedDebtSum() public {
         _setupForBatchLiquidateTrovesPureOffset();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_C = troveManager.getTroveDebt(C);
        uint256 annualInterestRate_C = troveManager.getTroveAnnualInterestRate(C);
        assertGt(recordedTroveDebt_C, 0);
        assertGt(annualInterestRate_C, 0);
        uint256 weightedTroveDebt_C = recordedTroveDebt_C * annualInterestRate_C;

        uint256 recordedTroveDebt_D = troveManager.getTroveDebt(D);
        uint256 annualInterestRate_D = troveManager.getTroveAnnualInterestRate(D);
        assertGt(recordedTroveDebt_D, 0);
        assertGt(annualInterestRate_D, 0);
        uint256 weightedTroveDebt_D = recordedTroveDebt_D * annualInterestRate_D;
        
        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // A liquidates C and D
        address[] memory trovesToLiq = new address[](2); 
        trovesToLiq[0] = C;
        trovesToLiq[1] = D;
        batchLiquidateTroves(A, trovesToLiq);

        // Check weighted recorded debt sum reduced by C and D's weighted recorded debt
        assertEq(activePool.aggWeightedDebtSum(), aggWeightedDebtSum_1 - (weightedTroveDebt_C + weightedTroveDebt_D));
    }

    function testBatchLiquidateTrovesWithNoRedistGainRemovesLiquidatedTrovesRecordedDebtsFromRecordedDebtSum() public {
        _setupForBatchLiquidateTrovesPureOffset();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);


        uint256 recordedTroveDebt_C = troveManager.getTroveDebt(C);
        assertGt(recordedTroveDebt_C, 0);
    
        uint256 recordedTroveDebt_D = troveManager.getTroveDebt(D);
        assertGt(recordedTroveDebt_D, 0);
        
        uint256 recordedDebtSum_1 = activePool.getRecordedDebtSum();

        // A liquidates C and D
        address[] memory trovesToLiq = new address[](2); 
        trovesToLiq[0] = C;
        trovesToLiq[1] = D;
        batchLiquidateTroves(A, trovesToLiq);

        // Check recorded debt sum reduced by C and D's recorded debt
        assertEq(activePool.getRecordedDebtSum(), recordedDebtSum_1 - (recordedTroveDebt_C + recordedTroveDebt_D));
    }
}
