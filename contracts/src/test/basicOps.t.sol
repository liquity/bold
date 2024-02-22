pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract BasicOps is DevTestSetup {

    function testOpenTrove() public {
        priceFeed.setPrice(2000e18);
        uint256 trovesCount = troveManager.getTroveOwnersCount();
        assertEq(trovesCount, 0);

        vm.startPrank(A);
        borrowerOperations.openTrove(1e18, 2e18, 2000e18, ZERO_ADDRESS, ZERO_ADDRESS, 0);

        trovesCount = troveManager.getTroveOwnersCount();
        assertEq(trovesCount, 1);
    }

     function testCloseTrove() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(1e18, 2e18, 2000e18, ZERO_ADDRESS, ZERO_ADDRESS, 0);
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.openTrove(1e18, 2e18, 2000e18, ZERO_ADDRESS, ZERO_ADDRESS, 0);

        uint256 trovesCount = troveManager.getTroveOwnersCount();
        assertEq(trovesCount, 2);
       
        vm.startPrank(B);
        borrowerOperations.closeTrove();
        vm.stopPrank();
    
        // Check Troves count reduced by 1
        trovesCount = troveManager.getTroveOwnersCount();
        assertEq(trovesCount, 1);
    }

    function testAdjustTrove() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(1e18, 2e18, 2000e18, ZERO_ADDRESS, ZERO_ADDRESS, 0);

        // Check Trove coll and debt
        uint256 debt_1 = troveManager.getTroveDebt(A);
        assertGt(debt_1, 0);
        uint256 coll_1 = troveManager.getTroveColl(A);
        assertGt(coll_1, 0);
 
        // Adjust trove
        borrowerOperations.adjustTrove(1e18, 1e18, true, 500e18,  true);

        // Check coll and debt altered
        uint256 debt_2 = troveManager.getTroveDebt(A);
        assertGt(debt_2, debt_1);
        uint256 coll_2 = troveManager.getTroveColl(A);
        assertGt(coll_2, coll_1);
    }

    function testRedeem() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(1e18, 5e18, 5_000e18, ZERO_ADDRESS, ZERO_ADDRESS, 0);
        vm.stopPrank();

        uint256 debt_1 = troveManager.getTroveDebt(A);
        assertGt(debt_1, 0);
        uint256 coll_1 = troveManager.getTroveColl(A);
        assertGt(coll_1, 0);

        vm.startPrank(B);
        borrowerOperations.openTrove(1e18, 5e18, 4_000e18, ZERO_ADDRESS, ZERO_ADDRESS, 0);
        
        vm.warp(block.timestamp + troveManager.BOOTSTRAP_PERIOD() + 1);

        uint256 redemptionAmount = 1000e18;  // 1k BOLD
        uint256 expectedCollReduction = redemptionAmount * 1e18 / priceFeed.fetchPrice();

        uint256 expectedColl_A = troveManager.getTroveColl(A) - expectedCollReduction;
        uint256 expectedDebt_A = troveManager.getTroveDebt(A) - redemptionAmount;
        uint256 expectedNICR = LiquityMath._computeNominalCR(expectedColl_A,expectedDebt_A); 
      
        // B redeems 1k BOLD
        troveManager.redeemCollateral(
            redemptionAmount,
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            expectedNICR,
            10,
            1e18
        );
       
        // Check A's coll and debt reduced
        uint256 debt_2 = troveManager.getTroveDebt(A);
        assertLt(debt_2, debt_1);
        uint256 coll_2 = troveManager.getTroveColl(A);
        assertLt(coll_2, coll_1);
    }

    function testLiquidation() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(1e18, 2e18, 2000e18, ZERO_ADDRESS, ZERO_ADDRESS, 0);
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.openTrove(1e18, 10e18, 2000e18, ZERO_ADDRESS, ZERO_ADDRESS, 0);

       // Price drops
        priceFeed.setPrice(1200e18);
        uint256 price = priceFeed.fetchPrice();

        // Check CR_A < MCR and TCR > CCR
        assertLt(troveManager.getCurrentICR(A, price), MCR);
        assertGt(troveManager.getTCR(price), CCR);

        uint256 trovesCount = troveManager.getTroveOwnersCount();
        assertEq(trovesCount, 2);

        troveManager.liquidate(A);

        // Check Troves count reduced by 1
        trovesCount = troveManager.getTroveOwnersCount();
        assertEq(trovesCount, 1);
    }

    function testSPDeposit() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(1e18, 2e18, 2000e18, ZERO_ADDRESS, ZERO_ADDRESS, 0);

        // A makes an SP deposit
        stabilityPool.provideToSP(100e18);

        // time passes
        vm.warp(block.timestamp + 7 days);

        // A tops up their SP deposit
        stabilityPool.provideToSP(100e18);

        // Check A's balance decreased and SP deposit increased
        assertEq(boldToken.balanceOf(A), 1800e18);
        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 200e18);
    }

    function testSPWithdrawal() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(1e18, 2e18, 2000e18, ZERO_ADDRESS, ZERO_ADDRESS, 0);

        // A makes an SP deposit
        stabilityPool.provideToSP(100e18);

        // time passes
        vm.warp(block.timestamp + 7 days);

        // Check A's balance decreased and SP deposit increased
        assertEq(boldToken.balanceOf(A), 1900e18);
        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 100e18);

        // A withdraws their full SP deposit
        stabilityPool.withdrawFromSP(100e18);

        // Check A's balance increased and SP deposit decreased to 0
        assertEq(boldToken.balanceOf(A), 2000e18);
        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 0);
    }
}
