pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract InterestRateAggregate is DevTestSetup {
    // ---  Pending aggregate interest calculator ---

    function testCalcPendingAggInterestReturns0For0TimePassedSinceLastUpdate() public {
        priceFeed.setPrice(2000e18);
        assertEq(activePool.lastAggUpdateTime(), 0);
        assertEq(activePool.calcPendingAggInterest(), 0);

        openTroveNoHints100pctMaxFee(A, 2 ether, 2000e18, 0);
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
        assertEq(activePool.calcPendingAggInterest(), 0);

        openTroveNoHints100pctMaxFee(B, 2 ether, 2000e18, 5e17);
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
        openTroveNoHints100pctMaxFee(A, 2 ether, 2000e18, 0);
        openTroveNoHints100pctMaxFee(B, 2 ether, 2000e18, 0);

        assertEq(activePool.calcPendingAggInterest(), 0);

        vm.warp(block.timestamp + 1000);

        assertEq(activePool.calcPendingAggInterest(), 0);

        openTroveNoHints100pctMaxFee(C, 2 ether, 2000e18, 0);

        assertEq(activePool.calcPendingAggInterest(), 0);

        vm.warp(block.timestamp + 1000);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    // TODO: create additional fuzz test
    function testCalcPendingAggInterestReturnsCorrectInterestForGivenPeriod() public {
        priceFeed.setPrice(2000e18);
        uint256 _duration = 1 days;

        uint256 troveDebtRequest = 2000e18;
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16); // 25% annual interest
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 2 ether, troveDebtRequest, 75e16); // 75% annual interest

        uint256 expectedTroveDebt = troveDebtRequest + troveManager.BOLD_GAS_COMPENSATION();
        assertEq(troveManager.getTroveDebt(ATroveId), expectedTroveDebt);
        assertEq(troveManager.getTroveDebt(BTroveId), expectedTroveDebt);

        vm.warp(block.timestamp + _duration);

        // Expect weighted average of 2 * troveDebt debt at 50% interest
        uint256 expectedPendingAggInterest = expectedTroveDebt * 2 * 5e17 * _duration / SECONDS_IN_1_YEAR / 1e18;

        assertEq(expectedPendingAggInterest, activePool.calcPendingAggInterest());
    }

    // --- calcTroveAccruedInterest

    // returns 0 for non-existent trove
    function testCalcTroveAccruedInterestReturns0When0AggRecordedDebt() public {
        priceFeed.setPrice(2000e18);

        assertEq(troveManager.calcTroveAccruedInterest(addressToTroveId(A)), 0);

        openTroveNoHints100pctMaxFee(A, 2 ether, 2000e18, 25e16);
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 2 ether, 2000e18, 75e16);

        vm.warp(block.timestamp + 1 days);

        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));

        closeTrove(B, BTroveId);

        assertEq(troveManager.calcTroveAccruedInterest(BTroveId), 0);
    }
    // returns 0 for 0 time passed

    function testCalcTroveAccruedInterestReturns0For0TimePassed() public {
        priceFeed.setPrice(2000e18);

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 2 ether, 2000e18, 25e16);
        assertEq(troveManager.calcTroveAccruedInterest(ATroveId), 0);

        vm.warp(block.timestamp + 1 days);

        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 2 ether, 2000e18, 75e16);
        assertEq(troveManager.calcTroveAccruedInterest(BTroveId), 0);
    }

    function testCalcTroveAccruedInterestReturns0For0InterestRate() public {
        priceFeed.setPrice(2000e18);

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 2 ether, 2000e18, 0);

        assertEq(troveManager.calcTroveAccruedInterest(ATroveId), 0);

        vm.warp(block.timestamp + 1 days);

        assertEq(troveManager.calcTroveAccruedInterest(ATroveId), 0);
    }

    // TODO: create additional corresponding fuzz test
    function testCalcTroveAccruedInterestReturnsCorrectInterestForGivenPeriod() public {
        priceFeed.setPrice(2000e18);

        uint256 annualRate_A = 1e18;
        uint256 annualRate_B = 37e16;
        uint256 debtRequest_A = 2000e18;
        uint256 debtRequest_B = 2500e18;

        uint256 duration = 42 days;

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 2 ether, debtRequest_A, annualRate_A);
        uint256 debt_A = troveManager.getTroveDebt(ATroveId);
        assertGt(debt_A, 0);
        assertEq(troveManager.calcTroveAccruedInterest(ATroveId), 0);

        vm.warp(block.timestamp + duration);

        uint256 expectedInterest_A = annualRate_A * debt_A * duration / 1e18 / SECONDS_IN_1_YEAR;
        assertEq(troveManager.calcTroveAccruedInterest(ATroveId), expectedInterest_A);

        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 2 ether, debtRequest_B, annualRate_B);
        uint256 debt_B = troveManager.getTroveDebt(BTroveId);
        assertGt(debt_B, 0);
        assertEq(troveManager.calcTroveAccruedInterest(BTroveId), 0);

        vm.warp(block.timestamp + duration);

        uint256 expectedInterest_B = annualRate_B * debt_B * duration / 1e18 / SECONDS_IN_1_YEAR;
        assertEq(troveManager.calcTroveAccruedInterest(BTroveId), expectedInterest_B);
    }

    // --- mintAggInterest ---

    function testMintAggInterestRevertsWhenNotCalledByBOorTM() public {
        // pass positive debt change
        uint256 debtChange = 37e18;
        vm.startPrank(A);
        vm.expectRevert();
        activePool.mintAggInterestAndAccountForTroveChange(debtChange, 0, 0, 0);
        vm.stopPrank();

        vm.startPrank(address(borrowerOperations));
        activePool.mintAggInterestAndAccountForTroveChange(debtChange, 0, 0, 0);
        vm.stopPrank();

        vm.startPrank(address(troveManager));
        activePool.mintAggInterestAndAccountForTroveChange(debtChange, 0, 0, 0);
        vm.stopPrank();

        // pass negative debt change
        vm.startPrank(A);
        vm.expectRevert();
        activePool.mintAggInterestAndAccountForTroveChange(0, debtChange, 0, 0);
        vm.stopPrank();

        vm.startPrank(address(borrowerOperations));
        activePool.mintAggInterestAndAccountForTroveChange(0, debtChange, 0, 0);
        vm.stopPrank();

        vm.startPrank(address(troveManager));
        activePool.mintAggInterestAndAccountForTroveChange(0, debtChange, 0, 0);
        vm.stopPrank();

        // pass 0 debt change
        vm.startPrank(A);
        vm.expectRevert();
        activePool.mintAggInterestAndAccountForTroveChange(0, 0, 0, 0);
        vm.stopPrank();

        vm.startPrank(address(borrowerOperations));
        activePool.mintAggInterestAndAccountForTroveChange(0, 0, 0, 0);
        vm.stopPrank();

        vm.startPrank(address(troveManager));
        activePool.mintAggInterestAndAccountForTroveChange(0, 0, 0, 0);
        vm.stopPrank();
    }

    // --- openTrove impact on aggregates ---

    // openTrove increases recorded aggregate debt by correct amount
    function testOpenTroveIncreasesRecordedAggDebtByAggPendingInterestPlusTroveDebt() public {
        priceFeed.setPrice(2000e18);
        assertEq(activePool.aggRecordedDebt(), 0);

        uint256 troveDebtRequest = 2000e18;
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16); // 25% annual interest

        // Check aggregate recorded debt increased to non-zero
        uint256 aggREcordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggREcordedDebt_1, 0);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // check there's pending interest
        uint256 pendingInterest = activePool.calcPendingAggInterest();
        assertGt(pendingInterest, 0);

        uint256 expectedTroveDebt_B = troveDebtRequest + troveManager.BOLD_GAS_COMPENSATION();
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 2 ether, troveDebtRequest, 25e16);
        assertEq(troveManager.getTroveDebt(BTroveId), expectedTroveDebt_B);

        // check that opening Trove B increased the agg. recorded debt by the pending agg. interest plus Trove B's debt
        assertEq(activePool.aggRecordedDebt(), aggREcordedDebt_1 + pendingInterest + expectedTroveDebt_B);
    }

    function testOpenTroveReducesPendingAggInterestTo0() public {
        priceFeed.setPrice(2000e18);

        uint256 troveDebtRequest = 2000e18;
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16); // 25% annual interest

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // check there's pending agg. interest
        assertGt(activePool.calcPendingAggInterest(), 0);

        openTroveNoHints100pctMaxFee(B, 2 ether, troveDebtRequest, 25e16);

        // Check pending agg. interest reduced to 0
        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    function testOpenTroveUpdatesTheLastAggUpdateTime() public {
        priceFeed.setPrice(2000e18);
        assertEq(activePool.lastAggUpdateTime(), 0);

        vm.warp(block.timestamp + 1 days);
        openTroveNoHints100pctMaxFee(A, 2 ether, 2000e18, 25e16); // 25% annual interest

        assertEq(activePool.lastAggUpdateTime(), block.timestamp);

        vm.warp(block.timestamp + 1 days);

        openTroveNoHints100pctMaxFee(B, 2 ether, 2000e18, 25e16); // 25% annual interest

        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    function testOpenTroveMintsInterestToInterestRouter() public {
        priceFeed.setPrice(2000e18);
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        // Open initial Trove so that aggregate interest begins accruing
        openTroveNoHints100pctMaxFee(A, 5 ether, 3000e18, 25e16);

        vm.warp(block.timestamp + 1 days);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);

        // Open 2nd trove
        openTroveNoHints100pctMaxFee(B, 2 ether, 2000e18, 25e16);

        // Check I-router Bold bal has increased as expected from 2nd trove opening
        uint256 boldBalRouter_1 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_1, pendingAggInterest_1);

        vm.warp(block.timestamp + 1 days);

        uint256 pendingAggInterest_2 = activePool.calcPendingAggInterest();

        // Open 3rd trove
        openTroveNoHints100pctMaxFee(C, 2 ether, 2000e18, 25e16);

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
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 5 ether, troveDebtRequest_A, annualInterest_A);
        uint256 troveDebt_A = troveManager.getTroveDebt(ATroveId);
        assertGt(troveDebt_A, 0);

        // // Trove's debt should be weighted by its annual interest rate
        uint256 expectedWeightedDebt_A = troveDebt_A * annualInterest_A;

        assertEq(activePool.aggWeightedDebtSum(), expectedWeightedDebt_A);

        vm.warp(block.timestamp + 1000);

        // B opens Trove
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 5 ether, troveDebtRequest_B, annualInterest_B);
        uint256 troveDebt_B = troveManager.getTroveDebt(BTroveId);
        assertGt(troveDebt_B, 0);

        uint256 expectedWeightedDebt_B = troveDebt_B * annualInterest_B;

        assertEq(activePool.aggWeightedDebtSum(), expectedWeightedDebt_A + expectedWeightedDebt_B);
    }

    // --- SP deposits ---

    function testSPDepositReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;
        // A opens Trove to obtain BOLD
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);

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
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);

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
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);

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
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);

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
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);

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

    // --- SP Withdrawals ---

    function testSPWithdrawalReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 sPdeposit = 100e18;
        // A opens Trove to obtain BOLD  and makes SP deposit
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);
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
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);
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
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);
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
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);
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
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);
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

    // --- closeTrove ---

    // Reduces pending agg interest to 0
    function testCloseTroveReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;
        // A, B open Troves
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 5 ether, troveDebtRequest, 50e16);

        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // check there's pending agg. interest
        assertGt(activePool.calcPendingAggInterest(), 0);

        // B closes Trove
        closeTrove(B, BTroveId);

        // // Check pending agg. interest reduced to 0
        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    // Increases agg recorded debt by pending agg interest

    function testCloseTroveAddsPendingAggInterestAndSubtractsRecordedDebtPlusInterestFromAggRecordedDebt() public {
        uint256 troveDebtRequest = 2000e18;
        // A, B open Troves
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 5 ether, troveDebtRequest, 50e16);

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
        (uint256 entireTroveDebt_B,,,,) = troveManager.getEntireDebtAndColl(BTroveId);
        assertGt(entireTroveDebt_B, troveManager.getTroveDebt(BTroveId));

        // B closes Trove
        closeTrove(B, BTroveId);

        // // Check agg. recorded debt increased by pending agg. interest less the closed Trove's entire debt
        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest - entireTroveDebt_B);
    }

    // Updates last agg update time to now
    function testCloseTroveUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 2000e18;
        // A, B open Troves
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 5 ether, troveDebtRequest, 50e16);

        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // B closes Trove
        closeTrove(B, BTroveId);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    // mints interest to interest router
    function testCloseTroveMintsInterestToInterestRouter() public {
        uint256 troveDebtRequest = 2000e18;
        // A, B open Troves
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 5 ether, troveDebtRequest, 50e16);

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
        closeTrove(B, BTroveId);

        // Check I-router Bold bal has increased as expected from 3rd trove opening
        uint256 boldBalRouter_2 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_2, pendingAggInterest);
    }

    // Reduces agg. weighted sum by the Trove's recorded debt

    function testCloseTroveReducesAggWeightedDebtSumByTrovesWeightedRecordedDebt() public {
        uint256 troveDebtRequest = 2000e18;
        // A, B open Troves
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 5 ether, troveDebtRequest, 50e16);

        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_B = troveManager.getTroveDebt(BTroveId);
        uint256 annualInterestRate_B = troveManager.getTroveAnnualInterestRate(BTroveId);
        assertGt(recordedTroveDebt_B, 0);
        assertGt(annualInterestRate_B, 0);
        uint256 weightedTroveDebt = recordedTroveDebt_B * annualInterestRate_B;

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // B closes Trove
        closeTrove(B, BTroveId);
        assertEq(activePool.aggWeightedDebtSum(), aggWeightedDebtSum_1 - weightedTroveDebt);
    }

    function testCloseTroveReducesBorrowerBoldBalByEntireTroveDebtLessGasComp() public {
        uint256 troveDebtRequest = 2000e18;
        // A, B opens Trove
        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 5 ether, troveDebtRequest, 50e16);

        // A sends Bold to B so B can cover their interest and close their Trove
        transferBold(A, B, boldToken.balanceOf(A));
        uint256 bal_B = boldToken.balanceOf(B);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get the up-to-date entire debt
        (uint256 entireDebt_B,,,,) = troveManager.getEntireDebtAndColl(BTroveId);

        // B closes Trove
        closeTrove(B, BTroveId);

        // Check balance of B reduces by the Trove's entire debt less gas comp
        assertEq(boldToken.balanceOf(B), bal_B - (entireDebt_B - troveManager.BOLD_GAS_COMPENSATION()));
    }

    // --- adjustTroveInterestRate ---

    function testAdjustTroveInterestRateWithNoPendingDebtGainIncreasesAggRecordedDebtByPendingAggInterest() public {
        uint256 troveDebtRequest = 2000e18;
        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);

        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        changeInterestRateNoHints(A, ATroveId, 75e16);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest);
    }

    function testAdjustTroveInterestRateReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;
        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);

        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.calcPendingAggInterest(), 0);

        changeInterestRateNoHints(A, ATroveId, 75e16);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    // Update last agg. update time to now
    function testAdjustTroveInterestRateUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 2000e18;
        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A changes interest rate
        changeInterestRateNoHints(A, ATroveId, 75e16);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    // mints interest to router
    function testAdjustTroveInterestRateMintsAggInterestToRouter() public {
        uint256 troveDebtRequest = 2000e18;
        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get I-router balance
        uint256 boldBalRouter_1 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_1, 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A changes interest rate
        changeInterestRateNoHints(A, ATroveId, 75e16);

        // Check I-router Bold bal has increased as expected
        uint256 boldBalRouter_2 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_2, pendingAggInterest);
    }

    // updates weighted debt sum: removes old and adds new
    function testAdjustTroveInterestRateAdjustsWeightedDebtSumCorrectly() public {
        uint256 troveDebtRequest = 2000e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 2 ether, troveDebtRequest, 25e16);

        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(ATroveId);
        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        (uint256 entireTroveDebt,,,,) = troveManager.getEntireDebtAndColl(ATroveId);

        uint256 newAnnualInterestRate = 75e16;
        uint256 expectedNewRecordedWeightedDebt = entireTroveDebt * newAnnualInterestRate;

        // A changes interest rate
        changeInterestRateNoHints(A, ATroveId, newAnnualInterestRate);

        // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(
            activePool.aggWeightedDebtSum(),
            aggWeightedDebtSum_1 - oldRecordedWeightedDebt + expectedNewRecordedWeightedDebt
        );
    }

    // --- withdrawBold tests ---

    function testWithdrawBoldWithNoRedistGainsIncreasesAggRecordedDebtByPendingAggInterestPlusBorrowerDebtChange()
        public
    {
        uint256 troveDebtRequest = 2000e18;
        uint256 debtIncrease = 500e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A draws more debt
        withdrawBold100pctMaxFee(A, ATroveId, debtIncrease);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest + debtIncrease);
    }

    function testWithdrawBoldReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 debtIncrease = 500e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.calcPendingAggInterest(), 0);

        // A draws more debt
        withdrawBold100pctMaxFee(A, ATroveId, debtIncrease);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    function testWithdrawBoldMintsAggInterestToRouter() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 debtIncrease = 500e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        vm.warp(block.timestamp + 1 days);

        // Check I-router balance is 0
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        uint256 aggInterest = activePool.calcPendingAggInterest();
        assertGt(aggInterest, 0);

        // A draws more debt
        withdrawBold100pctMaxFee(A, ATroveId, debtIncrease);

        assertEq(boldToken.balanceOf(address(mockInterestRouter)), aggInterest);
    }

    // Updates last agg update time to now
    function testWithdrawBoldUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 debtIncrease = 500e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A draws more debt
        withdrawBold100pctMaxFee(A, ATroveId, debtIncrease);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    function testWithdrawBoldAdjustsWeightedDebtSumCorrectly() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 debtIncrease = 500e18;
        uint256 interestRate = 25e16;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, interestRate);

        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(ATroveId);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // A draws more debt
        withdrawBold100pctMaxFee(A, ATroveId, debtIncrease);

        (uint256 entireTroveDebt,,,,) = troveManager.getEntireDebtAndColl(ATroveId);
        uint256 expectedNewRecordedWeightedDebt = entireTroveDebt * interestRate;

        // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(
            activePool.aggWeightedDebtSum(),
            aggWeightedDebtSum_1 - oldRecordedWeightedDebt + expectedNewRecordedWeightedDebt
        );
    }

    // --- repayBold tests ---

    function testRepayBoldWithNoRedistGainsIncreasesAggRecordedDebtByPendingAggInterestMinusBorrowerDebtChange()
        public
    {
        uint256 troveDebtRequest = 3000e18;
        uint256 debtDecrease = 500e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A repays bold
        repayBold(A, ATroveId, debtDecrease);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest - debtDecrease);
    }

    function testRepayBoldReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 debtDecrease = 500e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.calcPendingAggInterest(), 0);

        // A repays debt
        repayBold(A, ATroveId, debtDecrease);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    function testRepayBoldMintsAggInterestToRouter() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 debtDecrease = 500e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        vm.warp(block.timestamp + 1 days);

        // Check I-router balance is 0
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A repays debt
        repayBold(A, ATroveId, debtDecrease);

        assertEq(boldToken.balanceOf(address(mockInterestRouter)), pendingAggInterest);
    }

    function testRepayBoldUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 debtDecrease = 500e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A repays debt
        repayBold(A, ATroveId, debtDecrease);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    function testRepayBoldAdjustsWeightedDebtSumCorrectly() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 debtDecrease = 500e18;
        uint256 interestRate = 25e16;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, interestRate);

        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(ATroveId);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // A repays debt
        repayBold(A, ATroveId, debtDecrease);

        (uint256 entireTroveDebt,,,,) = troveManager.getEntireDebtAndColl(ATroveId);
        uint256 expectedNewRecordedWeightedDebt = entireTroveDebt * interestRate;

        // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(
            activePool.aggWeightedDebtSum(),
            aggWeightedDebtSum_1 - oldRecordedWeightedDebt + expectedNewRecordedWeightedDebt
        );
    }

    //  --- addColl tests ---

    function testAddCollWithNoRedistGainsIncreasesAggRecordedDebtByPendingAggInterest() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 collIncrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A  adds coll
        addColl(A, ATroveId, collIncrease);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest);
    }

    function testAddCollReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 collIncrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.calcPendingAggInterest(), 0);

        // A adds coll
        addColl(A, ATroveId, collIncrease);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    function testAddCollMintsAggInterestToRouter() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 collIncrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        vm.warp(block.timestamp + 1 days);

        // Check I-router balance is 0
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        uint256 aggInterest = activePool.calcPendingAggInterest();
        assertGt(aggInterest, 0);

        // A adds coll
        addColl(A, ATroveId, collIncrease);

        assertEq(boldToken.balanceOf(address(mockInterestRouter)), aggInterest);
    }

    function testAddCollUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 collIncrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A adds coll
        addColl(A, ATroveId, collIncrease);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    function testAddCollAdjustsWeightedDebtSumCorrectly() public {
        uint256 troveDebtRequest = 3000e18;
        uint256 collIncrease = 1 ether;
        uint256 interestRate = 25e16;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, interestRate);

        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(ATroveId);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // A adds coll
        addColl(A, ATroveId, collIncrease);

        (uint256 entireTroveDebt,,,,) = troveManager.getEntireDebtAndColl(ATroveId);
        uint256 expectedNewRecordedWeightedDebt = entireTroveDebt * interestRate;

        // Weighted debt should have increased due to interest being applied
        assertGt(expectedNewRecordedWeightedDebt, oldRecordedWeightedDebt);

        // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(
            activePool.aggWeightedDebtSum(),
            aggWeightedDebtSum_1 - oldRecordedWeightedDebt + expectedNewRecordedWeightedDebt
        );
    }

    // --- withdrawColl ---

    function testWithdrawCollWithNoRedistGainsIncreasesAggRecordedDebtByPendingAggInterest() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 collDecrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A  withdraws coll
        withdrawColl(A, ATroveId, collDecrease);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest);
    }

    function testWithdrawCollReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 collDecrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.calcPendingAggInterest(), 0);

        // A  withdraws coll
        withdrawColl(A, ATroveId, collDecrease);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    function testWithdrawCollMintsAggInterestToRouter() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 collDecrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        vm.warp(block.timestamp + 1 days);

        // Check I-router balance is 0
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        uint256 aggInterest = activePool.calcPendingAggInterest();
        assertGt(aggInterest, 0);

        // A withdraws coll
        withdrawColl(A, ATroveId, collDecrease);

        assertEq(boldToken.balanceOf(address(mockInterestRouter)), aggInterest);
    }

    function testWithdrawCollUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 collDecrease = 1 ether;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A withdraw coll
        withdrawColl(A, ATroveId, collDecrease);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    function testWithdrawCollAdjustsWeightedDebtSumCorrectly() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 collDecrease = 1 ether;
        uint256 interestRate = 25e16;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, interestRate);

        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(ATroveId);

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // A withdraw coll
        withdrawColl(A, ATroveId, collDecrease);

        (uint256 entireTroveDebt,,,,) = troveManager.getEntireDebtAndColl(ATroveId);
        uint256 expectedNewRecordedWeightedDebt = entireTroveDebt * interestRate;

        // Weighted debt should have increased due to interest being applied
        assertGt(expectedNewRecordedWeightedDebt, oldRecordedWeightedDebt);

        // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(
            activePool.aggWeightedDebtSum(),
            aggWeightedDebtSum_1 - oldRecordedWeightedDebt + expectedNewRecordedWeightedDebt
        );
    }

    // --- applyTroveInterestPermissionless ---

    function testApplyTroveInterestPermissionlessWithNoRedistGainsIncreasesAggRecordedDebtByPendingAggInterest()
        public
    {
        uint256 troveDebtRequest = 2000e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        // fast-forward past such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(ATroveId));

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, ATroveId);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest);
    }

    function testApplyTroveInterestPermissionlessReducesPendingAggInterestTo0() public {
        uint256 troveDebtRequest = 2000e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        // fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(ATroveId));

        assertGt(activePool.calcPendingAggInterest(), 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, ATroveId);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    function testApplyTroveInterestPermissionlessMintsPendingAggInterestToRouter() public {
        uint256 troveDebtRequest = 2000e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        // fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(ATroveId));

        // Check I-router balance is 0
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, ATroveId);

        // Check I-router Bold bal has increased by the pending agg interest
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), pendingAggInterest);
    }

    function testApplyTroveInterestPermissionlessUpdatesLastAggUpdateTimeToNow() public {
        uint256 troveDebtRequest = 2000e18;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, 25e16);

        // fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(ATroveId));

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, ATroveId);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    function testApplyTroveInterestPermissionlessAdjustsWeightedDebtSumCorrectly() public {
        uint256 troveDebtRequest = 2000e18;
        uint256 interestRate = 25e16;

        // A opens Trove
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 3 ether, troveDebtRequest, interestRate);

        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(ATroveId);

        // fast-forward time such that trove is Stale
        vm.warp(block.timestamp + 90 days + 1);
        // Confirm Trove is stale
        assertTrue(troveManager.troveIsStale(ATroveId));

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // B applies A's pending interest
        applyTroveInterestPermissionless(B, ATroveId);

        (uint256 entireTroveDebt,,,,) = troveManager.getEntireDebtAndColl(ATroveId);
        uint256 expectedNewRecordedWeightedDebt = entireTroveDebt * interestRate;

        // Weighted debt should have increased due to interest being applied
        assertGt(expectedNewRecordedWeightedDebt, oldRecordedWeightedDebt);

        // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(
            activePool.aggWeightedDebtSum(),
            aggWeightedDebtSum_1 - oldRecordedWeightedDebt + expectedNewRecordedWeightedDebt
        );
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

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 20 ether, troveDebtRequest_A, interestRate);
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 20 ether, troveDebtRequest_B, interestRate);
        uint256 CTroveId = openTroveNoHints100pctMaxFee(C, 20 ether, troveDebtRequest_C, interestRate);

        uint256 recordedDebt_A = troveManager.getTroveDebt(ATroveId);
        uint256 recordedDebt_B = troveManager.getTroveDebt(BTroveId);
        uint256 recordedDebt_C = troveManager.getTroveDebt(CTroveId);
        assertGt(recordedDebt_A, 0);
        assertGt(recordedDebt_B, 0);
        assertGt(recordedDebt_C, 0);

        uint256 entireSystemDebt = troveManager.getEntireSystemDebt();

        assertEq(entireSystemDebt, recordedDebt_A + recordedDebt_B + recordedDebt_C);
    }

    function testGetEntireSystemDebtWithNoRedistGainsReturnsSumOfTroveRecordedDebtsPlusIndividualInterests() public {
        uint256 troveDebtRequest_A = 2000e18;
        uint256 troveDebtRequest_B = 3000e18;
        uint256 troveDebtRequest_C = 4000e18;
        uint256 interestRate = 5e17;

        priceFeed.setPrice(2000e18);

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 20 ether, troveDebtRequest_A, interestRate);
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 20 ether, troveDebtRequest_B, interestRate);
        uint256 CTroveId = openTroveNoHints100pctMaxFee(C, 20 ether, troveDebtRequest_C, interestRate);

        // Fast-forward time, accrue interest
        vm.warp(block.timestamp + 1 days);

        uint256 recordedDebt_A = troveManager.getTroveDebt(ATroveId);
        uint256 recordedDebt_B = troveManager.getTroveDebt(BTroveId);
        uint256 recordedDebt_C = troveManager.getTroveDebt(CTroveId);
        assertGt(recordedDebt_A, 0);
        assertGt(recordedDebt_B, 0);
        assertGt(recordedDebt_C, 0);

        uint256 accruedInterest_A = troveManager.calcTroveAccruedInterest(ATroveId);
        uint256 accruedInterest_B = troveManager.calcTroveAccruedInterest(BTroveId);
        uint256 accruedInterest_C = troveManager.calcTroveAccruedInterest(CTroveId);
        assertGt(accruedInterest_A, 0);
        assertGt(accruedInterest_B, 0);
        assertGt(accruedInterest_C, 0);

        uint256 entireSystemDebt = troveManager.getEntireSystemDebt();

        uint256 sumIndividualTroveDebts =
            recordedDebt_A + accruedInterest_A + recordedDebt_B + accruedInterest_B + recordedDebt_C + accruedInterest_C;

        assertApproximatelyEqual(entireSystemDebt, sumIndividualTroveDebts, 10);
    }

    // TODO: more thorough invariant test

    // --- withdrawETHGainToTrove ---

    function testWithdrawETHGainToTroveIncreasesAggRecordedDebtByAggInterest() public {
        (uint256 ATroveId,,) = _setupForWithdrawETHGainToTrove();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A withdraws ETH gain to Trove
        withdrawETHGainToTrove(A, ATroveId);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest);
    }

    function testWithdrawETHGainToTroveReducesPendingAggInterestTo0() public {
        (uint256 ATroveId,,) = _setupForWithdrawETHGainToTrove();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        // check there's pending agg. interest
        assertGt(activePool.calcPendingAggInterest(), 0);

        // A withdraws ETH gain to Trove
        withdrawETHGainToTrove(A, ATroveId);

        // Check pending agg. interest reduced to 0
        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    function testWithdrawETHGainToTroveMintsInterestToRouter() public {
        (uint256 ATroveId,,) = _setupForWithdrawETHGainToTrove();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        // Get I-router balance
        uint256 boldBalRouter_1 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_1, 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A withdraws ETH gain to Trove
        withdrawETHGainToTrove(A, ATroveId);

        // Check I-router Bold bal has increased as expected from SP deposit
        uint256 boldBalRouter_2 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_2, pendingAggInterest);
    }

    function testWithdrawETHGainToTroveUpdatesLastAggUpdateTimeToNow() public {
        (uint256 ATroveId,,) = _setupForWithdrawETHGainToTrove();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A withdraws ETH gain to Trove
        withdrawETHGainToTrove(A, ATroveId);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    function testWithdrawETHGainToTroveChangesAggWeightedDebtSumCorrectly() public {
        (uint256 ATroveId,,) = _setupForWithdrawETHGainToTrove();

        // fast-forward time
        vm.warp(block.timestamp + 1 days);

        // Get weighted sum before
        uint256 weightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(weightedDebtSum_1, 0);

        uint256 oldRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(ATroveId);
        assertGt(oldRecordedWeightedDebt, 0);

        // A withdraws ETH gain to Trove
        withdrawETHGainToTrove(A, ATroveId);

        // Expect recorded weighted debt to have increased due to accrued Trove interest being applied
        uint256 newRecordedWeightedDebt = troveManager.getTroveWeightedRecordedDebt(ATroveId);
        assertGt(newRecordedWeightedDebt, oldRecordedWeightedDebt);

        // Expect weighted sum decreases by the old and increases by the new individual weighted Trove debt.
        assertEq(activePool.aggWeightedDebtSum(), weightedDebtSum_1 - oldRecordedWeightedDebt + newRecordedWeightedDebt);
    }

    // --- batchLiquidateTroves (Normal Mode, offset) ---

    function testBatchLiquidateTrovesPureOffsetChangesAggRecordedInterestCorrectly() public {
        (,, uint256 CTroveId, uint256 DTroveId) = _setupForBatchLiquidateTrovesPureOffset();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 recordedDebt_C = troveManager.getTroveDebt(CTroveId);
        uint256 recordedDebt_D = troveManager.getTroveDebt(DTroveId);
        assertGt(recordedDebt_C, 0);
        assertGt(recordedDebt_D, 0);
        uint256 recordedDebtInLiq = recordedDebt_C + recordedDebt_D;

        uint256 accruedInterest_C = troveManager.calcTroveAccruedInterest(CTroveId);
        uint256 accruedInterest_D = troveManager.calcTroveAccruedInterest(DTroveId);
        assertGt(accruedInterest_C, 0);
        assertGt(accruedInterest_D, 0);
        uint256 accruedInterestInLiq = accruedInterest_C + accruedInterest_D;

        // A liquidates C and D
        uint256[] memory trovesToLiq = new uint256[](2);
        trovesToLiq[0] = CTroveId;
        trovesToLiq[1] = DTroveId;
        batchLiquidateTroves(A, trovesToLiq);

        // Check both Troves were closed by liquidation
        assertEq(troveManager.getTroveStatus(CTroveId), 3);
        assertEq(troveManager.getTroveStatus(DTroveId), 3);

        // // changes agg. recorded debt by: agg_accrued_interest - liq'd_troves_recorded_trove_debts - liq'd_troves_accrued_interest
        assertEq(
            activePool.aggRecordedDebt(),
            aggRecordedDebt_1 + pendingAggInterest - recordedDebtInLiq - accruedInterestInLiq
        );
    }

    function testBatchLiquidateTrovesPureOffsetReducesAggPendingInterestTo0() public {
        (,, uint256 CTroveId, uint256 DTroveId) = _setupForBatchLiquidateTrovesPureOffset();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.calcPendingAggInterest(), 0);

        // A liquidates C and D
        uint256[] memory trovesToLiq = new uint256[](2);
        trovesToLiq[0] = CTroveId;
        trovesToLiq[1] = DTroveId;
        batchLiquidateTroves(A, trovesToLiq);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    // Mints interest to Router
    function testBatchLiquidateTrovesPureOffsetMintsAggInterestToRouter() public {
        (,, uint256 CTroveId, uint256 DTroveId) = _setupForBatchLiquidateTrovesPureOffset();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        uint256 boldBalRouter_1 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_1, 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A liquidates C and D
        uint256[] memory trovesToLiq = new uint256[](2);
        trovesToLiq[0] = CTroveId;
        trovesToLiq[1] = DTroveId;
        batchLiquidateTroves(A, trovesToLiq);

        // Check I-router Bold bal has increased as expected from liquidation
        uint256 boldBalRouter_2 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_2, pendingAggInterest);
    }

    function testBatchLiquidateTrovesPureOffsetUpdatesLastAggInterestUpdateTimeToNow() public {
        (,, uint256 CTroveId, uint256 DTroveId) = _setupForBatchLiquidateTrovesPureOffset();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A liquidates C and D
        uint256[] memory trovesToLiq = new uint256[](2);
        trovesToLiq[0] = CTroveId;
        trovesToLiq[1] = DTroveId;
        batchLiquidateTroves(A, trovesToLiq);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    // Removes liq'd troves' weighted recorded debts from the weighted recorded debt sum
    function testBatchLiquidateTrovesPureOffsetRemovesLiquidatedTrovesWeightedRecordedDebtsFromWeightedRecordedDebtSum()
        public
    {
        (,, uint256 CTroveId, uint256 DTroveId) = _setupForBatchLiquidateTrovesPureOffset();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_C = troveManager.getTroveDebt(CTroveId);
        uint256 annualInterestRate_C = troveManager.getTroveAnnualInterestRate(CTroveId);
        assertGt(recordedTroveDebt_C, 0);
        assertGt(annualInterestRate_C, 0);
        uint256 weightedTroveDebt_C = recordedTroveDebt_C * annualInterestRate_C;

        uint256 recordedTroveDebt_D = troveManager.getTroveDebt(DTroveId);
        uint256 annualInterestRate_D = troveManager.getTroveAnnualInterestRate(DTroveId);
        assertGt(recordedTroveDebt_D, 0);
        assertGt(annualInterestRate_D, 0);
        uint256 weightedTroveDebt_D = recordedTroveDebt_D * annualInterestRate_D;

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // A liquidates C and D
        uint256[] memory trovesToLiq = new uint256[](2);
        trovesToLiq[0] = CTroveId;
        trovesToLiq[1] = DTroveId;
        batchLiquidateTroves(A, trovesToLiq);

        // Check weighted recorded debt sum reduced by C and D's weighted recorded debt
        assertEq(activePool.aggWeightedDebtSum(), aggWeightedDebtSum_1 - (weightedTroveDebt_C + weightedTroveDebt_D));
    }

    // ---  // --- batchLiquidateTroves (Normal Mode, redistribution) ---

    function testBatchLiquidateTrovesPureRedistChangesAggRecordedInterestCorrectly() public {
        (uint256 ATroveId,, uint256 CTroveId, uint256 DTroveId) = _setupForBatchLiquidateTrovesPureRedist();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 recordedDebt_C = troveManager.getTroveDebt(CTroveId);
        uint256 recordedDebt_D = troveManager.getTroveDebt(DTroveId);
        assertGt(recordedDebt_C, 0);
        assertGt(recordedDebt_D, 0);
        uint256 recordedDebtInLiq = recordedDebt_C + recordedDebt_D;

        uint256 accruedInterest_C = troveManager.calcTroveAccruedInterest(CTroveId);
        uint256 accruedInterest_D = troveManager.calcTroveAccruedInterest(DTroveId);
        assertGt(accruedInterest_C, 0);
        assertGt(accruedInterest_D, 0);
        uint256 accruedInterestInLiq = accruedInterest_C + accruedInterest_D;

        // A liquidates C and D
        uint256[] memory trovesToLiq = new uint256[](2);
        trovesToLiq[0] = CTroveId;
        trovesToLiq[1] = DTroveId;
        batchLiquidateTroves(A, trovesToLiq);
        // Check for redist. gains
        assertTrue(troveManager.hasRedistributionGains(ATroveId));

        // Check both Troves were closed by liquidation
        assertEq(troveManager.getTroveStatus(CTroveId), 3);
        assertEq(troveManager.getTroveStatus(DTroveId), 3);

        // // changes agg. recorded debt by: agg_accrued_interest - liq'd_troves_recorded_trove_debts - liq'd_troves_accrued_interest
        assertEq(
            activePool.aggRecordedDebt(),
            aggRecordedDebt_1 + pendingAggInterest - recordedDebtInLiq - accruedInterestInLiq
        );
    }

    function testBatchLiquidateTrovesPureRedistReducesAggPendingInterestTo0() public {
        (uint256 ATroveId,, uint256 CTroveId, uint256 DTroveId) = _setupForBatchLiquidateTrovesPureRedist();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.calcPendingAggInterest(), 0);

        // A liquidates C and D
        uint256[] memory trovesToLiq = new uint256[](2);
        trovesToLiq[0] = CTroveId;
        trovesToLiq[1] = DTroveId;
        batchLiquidateTroves(A, trovesToLiq);
        // Check for redist. gains
        assertTrue(troveManager.hasRedistributionGains(ATroveId));

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    // Mints interest to Router
    function testBatchLiquidateTrovesPureRedistMintsAggInterestToRouter() public {
        (uint256 ATroveId,, uint256 CTroveId, uint256 DTroveId) = _setupForBatchLiquidateTrovesPureRedist();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        uint256 boldBalRouter_1 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_1, 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // A liquidates C and D
        uint256[] memory trovesToLiq = new uint256[](2);
        trovesToLiq[0] = CTroveId;
        trovesToLiq[1] = DTroveId;
        batchLiquidateTroves(A, trovesToLiq);
        // Check for redist. gains
        assertTrue(troveManager.hasRedistributionGains(ATroveId));

        // Check I-router Bold bal has increased as expected from liquidation
        uint256 boldBalRouter_2 = boldToken.balanceOf(address(mockInterestRouter));
        assertEq(boldBalRouter_2, pendingAggInterest);
    }

    function testBatchLiquidateTrovesPureRedistUpdatesLastAggInterestUpdateTimeToNow() public {
        (uint256 ATroveId,, uint256 CTroveId, uint256 DTroveId) = _setupForBatchLiquidateTrovesPureRedist();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        // A liquidates C and D
        uint256[] memory trovesToLiq = new uint256[](2);
        trovesToLiq[0] = CTroveId;
        trovesToLiq[1] = DTroveId;
        batchLiquidateTroves(A, trovesToLiq);
        // Check for redist. gains
        assertTrue(troveManager.hasRedistributionGains(ATroveId));

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    // Removes liq'd troves' weighted recorded debts from the weighted recorded debt sum
    function testBatchLiquidateTrovesPureRedistRemovesLiquidatedTrovesWeightedRecordedDebtsFromWeightedRecordedDebtSum()
        public
    {
        (uint256 ATroveId,, uint256 CTroveId, uint256 DTroveId) = _setupForBatchLiquidateTrovesPureRedist();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_C = troveManager.getTroveDebt(CTroveId);
        uint256 annualInterestRate_C = troveManager.getTroveAnnualInterestRate(CTroveId);
        assertGt(recordedTroveDebt_C, 0);
        assertGt(annualInterestRate_C, 0);
        uint256 weightedTroveDebt_C = recordedTroveDebt_C * annualInterestRate_C;

        uint256 recordedTroveDebt_D = troveManager.getTroveDebt(DTroveId);
        uint256 annualInterestRate_D = troveManager.getTroveAnnualInterestRate(DTroveId);
        assertGt(recordedTroveDebt_D, 0);
        assertGt(annualInterestRate_D, 0);
        uint256 weightedTroveDebt_D = recordedTroveDebt_D * annualInterestRate_D;

        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();
        assertGt(aggWeightedDebtSum_1, 0);

        // A liquidates C and D
        uint256[] memory trovesToLiq = new uint256[](2);
        trovesToLiq[0] = CTroveId;
        trovesToLiq[1] = DTroveId;
        batchLiquidateTroves(A, trovesToLiq);
        // Check for redist. gains
        assertTrue(troveManager.hasRedistributionGains(ATroveId));

        // Check weighted recorded debt sum reduced by C and D's weighted recorded debt
        assertEq(activePool.aggWeightedDebtSum(), aggWeightedDebtSum_1 - (weightedTroveDebt_C + weightedTroveDebt_D));
    }

    function testBatchLiquidateTrovesPureRedistWithNoRedistGainAddsLiquidatedTrovesEntireDebtsToDefaultPoolDebtSum()
        public
    {
        (uint256 ATroveId,, uint256 CTroveId, uint256 DTroveId) = _setupForBatchLiquidateTrovesPureRedist();

        // fast-forward time so interest accrues
        vm.warp(block.timestamp + 1 days);

        uint256 recordedTroveDebt_C = troveManager.getTroveDebt(CTroveId);
        uint256 accruedInterest_C = troveManager.calcTroveAccruedInterest(CTroveId);
        assertGt(recordedTroveDebt_C, 0);
        assertGt(accruedInterest_C, 0);

        uint256 recordedTroveDebt_D = troveManager.getTroveDebt(DTroveId);
        uint256 accruedInterest_D = troveManager.calcTroveAccruedInterest(CTroveId);
        assertGt(recordedTroveDebt_D, 0);
        assertGt(accruedInterest_D, 0);

        uint256 debtInLiq = recordedTroveDebt_C + accruedInterest_C + recordedTroveDebt_D + accruedInterest_D;

        uint256 defaultPoolDebt = defaultPool.getBoldDebt();
        assertEq(defaultPoolDebt, 0);

        // A liquidates C and D
        uint256[] memory trovesToLiq = new uint256[](2);
        trovesToLiq[0] = CTroveId;
        trovesToLiq[1] = DTroveId;
        batchLiquidateTroves(A, trovesToLiq);
        // Check for redist. gains
        assertTrue(troveManager.hasRedistributionGains(ATroveId));

        // Check recorded debt sum reduced by C and D's entire debts
        assertEq(defaultPool.getBoldDebt(), debtInLiq);
    }

    // --- TCR tests ---

    function testGetTCRReturnsMaxUint256ForEmptySystem() public {
        uint256 price = priceFeed.fetchPrice();
        uint256 TCR = troveManager.getTCR(price);

        assertEq(TCR, MAX_UINT256);
    }

    function testGetTCRReturnsICRofTroveForSystemWithOneTrove() public {
        uint256 price = priceFeed.fetchPrice();
        uint256 troveDebtRequest = 2000e18;
        uint256 coll = 20 ether;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, coll, troveDebtRequest, interestRate);

        uint256 compositeDebt = troveDebtRequest + borrowerOperations.BOLD_GAS_COMPENSATION();
        uint256 expectedICR = coll * price / compositeDebt;
        assertEq(expectedICR, troveManager.getCurrentICR(ATroveId, price));

        assertEq(expectedICR, troveManager.getTCR(price));
    }

    function testGetTCRReturnsSizeWeightedRatioForSystemWithMultipleTroves() public {
        uint256 price = priceFeed.fetchPrice();
        uint256 troveDebtRequest_A = 2000e18;
        uint256 troveDebtRequest_B = 3000e18;
        uint256 troveDebtRequest_C = 5000e18;
        uint256 coll_A = 20 ether;
        uint256 coll_B = 30 ether;
        uint256 coll_C = 40 ether;
        uint256 interestRate = 25e16;

        openTroveNoHints100pctMaxFee(A, coll_A, troveDebtRequest_A, interestRate);
        openTroveNoHints100pctMaxFee(B, coll_B, troveDebtRequest_B, interestRate);
        openTroveNoHints100pctMaxFee(C, coll_C, troveDebtRequest_C, interestRate);

        uint256 compositeDebt_A = troveDebtRequest_A + borrowerOperations.BOLD_GAS_COMPENSATION();
        uint256 compositeDebt_B = troveDebtRequest_B + borrowerOperations.BOLD_GAS_COMPENSATION();
        uint256 compositeDebt_C = troveDebtRequest_C + borrowerOperations.BOLD_GAS_COMPENSATION();

        uint256 sizeWeightedCR =
            (coll_A + coll_B + coll_C) * price / (compositeDebt_A + compositeDebt_B + compositeDebt_C);

        assertEq(sizeWeightedCR, troveManager.getTCR(price));
    }

    function testGetTCRIncorporatesTroveInterestForSystemWithSingleTrove() public {
        uint256 price = priceFeed.fetchPrice();
        uint256 troveDebtRequest = 2000e18;
        uint256 coll = 20 ether;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, coll, troveDebtRequest, interestRate);

        // Fast-forward time
        vm.warp(block.timestamp + 14 days);

        uint256 troveInterest = troveManager.calcTroveAccruedInterest(ATroveId);
        assertGt(troveInterest, 0);

        uint256 compositeDebt = troveDebtRequest + borrowerOperations.BOLD_GAS_COMPENSATION() + troveInterest;
        uint256 expectedICR = coll * price / compositeDebt;
        assertEq(expectedICR, troveManager.getCurrentICR(ATroveId, price));

        assertEq(expectedICR, troveManager.getTCR(price));
    }

    function testGetTCRIncorporatesAllTroveInterestForSystemWithMultipleTroves() public {
        // Use structs to bi-pass "stack-too-deep" error
        TroveDebtRequests memory troveDebtRequests;
        TroveCollAmounts memory troveCollAmounts;
        TroveInterestRates memory troveInterestRates;
        TroveAccruedInterests memory troveInterests;

        troveDebtRequests.A = 2000e18;
        troveDebtRequests.B = 4000e18;
        troveDebtRequests.C = 5000e18;
        troveCollAmounts.A = 20 ether;
        troveCollAmounts.B = 30 ether;
        troveCollAmounts.C = 40 ether;

        troveInterestRates.A = 25e16;
        troveInterestRates.B = 25e16;
        troveInterestRates.C = 25e16;

        uint256 ATroveId =
            openTroveNoHints100pctMaxFee(A, troveCollAmounts.A, troveDebtRequests.A, troveInterestRates.A);
        // Fast-forward time
        vm.warp(block.timestamp + 14 days);
        uint256 BTroveId =
            openTroveNoHints100pctMaxFee(B, troveCollAmounts.B, troveDebtRequests.B, troveInterestRates.B);
        // Fast-forward time
        vm.warp(block.timestamp + 14 days);
        uint256 CTroveId =
            openTroveNoHints100pctMaxFee(C, troveCollAmounts.C, troveDebtRequests.C, troveInterestRates.C);
        // Fast-forward time
        vm.warp(block.timestamp + 14 days);

        troveInterests.A = troveManager.calcTroveAccruedInterest(ATroveId);
        assertGt(troveInterests.A, 0);
        troveInterests.B = troveManager.calcTroveAccruedInterest(BTroveId);
        assertGt(troveInterests.B, 0);
        troveInterests.C = troveManager.calcTroveAccruedInterest(CTroveId);
        assertGt(troveInterests.C, 0);

        /*
         * stack too deep
        uint256 compositeDebt_A = troveDebtRequests.A + borrowerOperations.BOLD_GAS_COMPENSATION() + troveInterest_A;
        uint256 compositeDebt_B = troveDebtRequests.B + borrowerOperations.BOLD_GAS_COMPENSATION() + troveInterest_B;
        uint256 compositeDebt_C = troveDebtRequests.C + borrowerOperations.BOLD_GAS_COMPENSATION() + troveInterest_C;

        uint256 expectedTCR = (troveCollAmounts.A + troveCollAmounts.B + troveCollAmounts.C) * price / (compositeDebt_A + compositeDebt_B + compositeDebt_C);
        */
        uint256 gasCompensation = borrowerOperations.BOLD_GAS_COMPENSATION();
        uint256 expectedTCR = (troveCollAmounts.A + troveCollAmounts.B + troveCollAmounts.C) * priceFeed.fetchPrice()
            / (
                troveDebtRequests.A + troveDebtRequests.B + troveDebtRequests.C + 3 * gasCompensation + troveInterests.A
                    + troveInterests.B + troveInterests.C
            );

        assertEq(expectedTCR, troveManager.getTCR(priceFeed.fetchPrice()));
    }

    // --- ICR tests ---

    // - 0 for non-existent Trove

    function testGetCurrentICRReturnsInfinityForNonExistentTrove() public {
        uint256 price = priceFeed.fetchPrice();
        uint256 ICR = troveManager.getCurrentICR(addressToTroveId(A), price);

        assertEq(ICR, MAX_UINT256);
    }

    function testGetCurrentICRReturnsCorrectValueForNoInterest() public {
        uint256 price = priceFeed.fetchPrice();
        uint256 troveDebtRequest = 2000e18;
        uint256 coll = 20 ether;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, coll, troveDebtRequest, interestRate);

        uint256 compositeDebt = troveDebtRequest + borrowerOperations.BOLD_GAS_COMPENSATION();
        uint256 expectedICR = coll * price / compositeDebt;
        assertEq(expectedICR, troveManager.getCurrentICR(ATroveId, price));
    }

    function testGetCurrentICRReturnsCorrectValueWithAccruedInterest() public {
        uint256 price = priceFeed.fetchPrice();
        uint256 troveDebtRequest = 2000e18;
        uint256 coll = 20 ether;
        uint256 interestRate = 25e16;

        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, coll, troveDebtRequest, interestRate);

        // Fast-forward time
        vm.warp(block.timestamp + 14 days);

        uint256 troveInterest = troveManager.calcTroveAccruedInterest(ATroveId);
        assertGt(troveInterest, 0);

        uint256 compositeDebt = troveDebtRequest + borrowerOperations.BOLD_GAS_COMPENSATION() + troveInterest;
        uint256 expectedICR = coll * price / compositeDebt;
        assertEq(expectedICR, troveManager.getCurrentICR(ATroveId, price));
    }

    //  --- redemption tests ---

    function testRedemptionWithNoRedistGainsChangesAggRecordedDebtCorrectly() public {
        (,, TroveIDs memory troveIDs) = _setupForRedemption();

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);

        uint256 aggRecordedDebt_1 = activePool.aggRecordedDebt();
        assertGt(aggRecordedDebt_1, 0);
        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        // E redeems
        redeem(E, debt_A);

        assertEq(activePool.aggRecordedDebt(), aggRecordedDebt_1 + pendingAggInterest - debt_A);
    }

    function testRedemptionReducesPendingAggInterestTo0() public {
        (,, TroveIDs memory troveIDs) = _setupForRedemption();

        assertGt(activePool.calcPendingAggInterest(), 0);

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        // E redeems
        redeem(E, debt_A);

        assertEq(activePool.calcPendingAggInterest(), 0);
    }

    function testRedemptionMintsPendingAggInterestToRouter() public {
        (,, TroveIDs memory troveIDs) = _setupForRedemption();

        // Check I-router balance is 0
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), 0);

        uint256 pendingAggInterest = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest, 0);

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        // E redeems
        redeem(E, debt_A);

        // Check I-router Bold bal has increased by the pending agg interest
        assertEq(boldToken.balanceOf(address(mockInterestRouter)), pendingAggInterest);
    }

    function testRedemptionUpdatesLastAggUpdateTimeToNow() public {
        (,, TroveIDs memory troveIDs) = _setupForRedemption();

        assertGt(activePool.lastAggUpdateTime(), 0);
        assertLt(activePool.lastAggUpdateTime(), block.timestamp);

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        // E redeems
        redeem(E, debt_A);

        // Check last agg update time increased to now
        assertEq(activePool.lastAggUpdateTime(), block.timestamp);
    }

    function testRedemptionWithNoRedistGainsChangesWeightedDebtSumCorrectly() public {
        (,, TroveIDs memory troveIDs) = _setupForRedemption();

        // Get weighted recorded active debt
        uint256 aggWeightedDebtSum_1 = activePool.aggWeightedDebtSum();

        // Get A and B's weighted debts before
        uint256 oldWeightedRecordedDebt_A = troveManager.getTroveWeightedRecordedDebt(troveIDs.A);
        uint256 oldWeightedRecordedDebt_B = troveManager.getTroveWeightedRecordedDebt(troveIDs.B);
        assertGt(oldWeightedRecordedDebt_A, 0);
        assertGt(oldWeightedRecordedDebt_B, 0);

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);
        uint256 debt_C = troveManager.getTroveEntireDebt(troveIDs.C);
        // E redeems, hitting A fully and B partially
        redeem(E, debt_A + debt_B / 2);

        // Confirm C wasn't touched
        assertEq(troveManager.getTroveEntireDebt(troveIDs.C), debt_C);

        uint256 newWeightedRecordedDebt_A = troveManager.getTroveWeightedRecordedDebt(troveIDs.A);
        uint256 newWeightedRecordedDebt_B = troveManager.getTroveWeightedRecordedDebt(troveIDs.B);
        assertNotEq(oldWeightedRecordedDebt_A, newWeightedRecordedDebt_A);
        assertNotEq(oldWeightedRecordedDebt_B, newWeightedRecordedDebt_B);

        uint256 expectedAggWeightedRecordedDebt = aggWeightedDebtSum_1 + newWeightedRecordedDebt_A
            + newWeightedRecordedDebt_B - oldWeightedRecordedDebt_A - oldWeightedRecordedDebt_B;

        // Check recorded debt sum has changed correctly
        assertEq(activePool.aggWeightedDebtSum(), expectedAggWeightedRecordedDebt);
    }

    // TODO: mixed collateral & debt adjustment opps
    // TODO: tests with pending debt redist. gain >0
    // TODO: tests that show total debt change under user ops
    // TODO: Test total debt invariant holds i.e. (D + S * delta_T) == sum_of_all_entire_trove_debts in
    // more complex sequences of borrower ops and time passing
}
