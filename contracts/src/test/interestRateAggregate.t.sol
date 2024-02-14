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

    // --- calcPendingTroveInterest

    // returns 0 for non-existent trove
      function testCalcPendingTroveInterestReturns0When0AggRecordedDebt() public {
        priceFeed.setPrice(2000e18);

        assertEq(troveManager.calcPendingTroveInterest(A), 0);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  25e16); 
        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  75e16); 

        vm.warp(block.timestamp + 1 days);

        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));

        closeTrove(B);

        assertEq(troveManager.calcPendingTroveInterest(B), 0);
    }
    // returns 0 for 0 time passed

    function testCalcPendingTroveInterestReturns0For0TimePassed() public {
        priceFeed.setPrice(2000e18);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  25e16); 
        assertEq(troveManager.calcPendingTroveInterest(A), 0);

        vm.warp(block.timestamp +  1 days);

        openTroveNoHints100pctMaxFee(B,  2 ether, 2000e18,  75e16); 
        assertEq(troveManager.calcPendingTroveInterest(B), 0);
    }

    function testCalcPendingTroveInterestReturns0For0InterestRate() public {
        priceFeed.setPrice(2000e18);

        openTroveNoHints100pctMaxFee(A,  2 ether, 2000e18,  0); 

        assertEq(troveManager.calcPendingTroveInterest(A), 0);

        vm.warp(block.timestamp +  1 days);

        assertEq(troveManager.calcPendingTroveInterest(A), 0);
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
        assertEq(troveManager.calcPendingTroveInterest(A), 0);

        vm.warp(block.timestamp +  duration);

        uint256 expectedInterest_A = annualRate_A * debt_A * duration / 1e18 / SECONDS_IN_1_YEAR;
        assertEq(troveManager.calcPendingTroveInterest(A), expectedInterest_A);
       
        openTroveNoHints100pctMaxFee(B,  2 ether, debtRequest_B,  annualRate_B); 
        uint256 debt_B = troveManager.getTroveDebt(B);
        assertGt(debt_B, 0);
        assertEq(troveManager.calcPendingTroveInterest(B), 0);

        vm.warp(block.timestamp +  duration);

        uint256 expectedInterest_B = annualRate_B * debt_B * duration / 1e18 / SECONDS_IN_1_YEAR;
        assertEq(troveManager.calcPendingTroveInterest(B), expectedInterest_B);
    }

    // --- mintAggInterest ---

    function testMintAggInterestRevertsWhenNotCalledByBOorSP() public {
       // pass positive debt change
        int256 debtChange = 37e18;
        vm.startPrank(A);
        vm.expectRevert();
        activePool.mintAggInterest(debtChange);
        vm.stopPrank();

        vm.startPrank(address(borrowerOperations));  
        activePool.mintAggInterest(debtChange);
        vm.stopPrank();

        vm.startPrank(address(stabilityPool));  
        activePool.mintAggInterest(debtChange);
        vm.stopPrank();
       
        // pass negative debt change
        debtChange = -37e18;
        vm.startPrank(A);
        vm.expectRevert();
        activePool.mintAggInterest(debtChange);
        vm.stopPrank();

        vm.startPrank(address(borrowerOperations));  
        activePool.mintAggInterest(debtChange);
        vm.stopPrank();

        vm.startPrank(address(stabilityPool));  
        activePool.mintAggInterest(debtChange);
        vm.stopPrank();

        // pass 0 debt change
        vm.startPrank(A);
        vm.expectRevert();
        activePool.mintAggInterest(0);
        vm.stopPrank();

        vm.startPrank(address(borrowerOperations));  
        activePool.mintAggInterest(0);
        vm.stopPrank();

        vm.startPrank(address(stabilityPool));  
        activePool.mintAggInterest(0);
        vm.stopPrank();
    }

    // --- openTrove impact on aggregates ---

    // openTrove increases recorded aggregate debt by correct amount
    function testOpenTroveIncreasesRecordedAggDebtByAggPendingInterestPlusNewDebt() public {
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

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // Make SP deposit
        makeSPDeposit(A, sPdeposit);

        // Get weighted sum after, check no change
        uint256 weightedDebtSum_2 = activePool.aggWeightedDebtSum();
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
        
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get weighted sum before
        uint256 weightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(weightedDebtSum_1, 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // Make SP deposit
        makeSPDeposit(A, sPdeposit);

        // Get weighted sum after, check no change
        uint256 weightedDebtSum_2 = activePool.aggWeightedDebtSum();
        assertEq(weightedDebtSum_2, weightedDebtSum_1);
    }

    // --- closeTrove ---

    // Reduces pending agg interest to 0
    function testcloseTroveReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;
        // A, B opens Trove to obtain BOLD  and makes SP deposit
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

    function testCloseTroveAddsPendingAggInterestAndSubtractsEntireTroveDebtFromAggRecordedDebt() public {
        uint256 troveDebtRequest = 2000e18;
        // A, B opens Trove to obtain BOLD  and makes SP deposit
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
        // A, B opens Trove to obtain BOLD  and makes SP deposit
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
        // A, B opens Trove to obtain BOLD  and makes SP deposit
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
        // A, B opens Trove to obtain BOLD  and makes SP deposit
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

    // TODO:
    // getEntireDebt and getTCR basic tests, for pending agg interest

    // get



  

}
