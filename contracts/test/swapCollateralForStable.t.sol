// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";
import "../src/StabilityPool.sol";
import "../src/Interfaces/IStabilityPoolEvents.sol";

contract SwapCollateralForStableTest is DevTestSetup {
    struct SwapTestVars {
        uint256 spBoldBalance;
        uint256 spCollBalance;
        uint256 lsBoldBalance;
        uint256 lsCollBalance;
        uint256 depositor1CollBalance;
        uint256 depositor1BoldBalance;
        uint256 depositor2CollBalance;
        uint256 depositor2BoldBalance;
        uint256 depositor3CollBalance;
        uint256 depositor3BoldBalance;
    }

    address public liquidityStrategy = makeAddr("liquidityStrategy");

    event P_Updated(uint256 _P);
    event S_Updated(uint256 _S, uint256 _scale);
    event ScaleUpdated(uint256 _currentScale);
    event StabilityPoolCollBalanceUpdated(uint256 _newBalance);
    event StabilityPoolBoldBalanceUpdated(uint256 _newBalance);

    function setUp() public override {
        super.setUp();

        deal(address(collToken), liquidityStrategy, 10_000e18);

        vm.prank(liquidityStrategy);
        collToken.approve(address(stabilityPool), type(uint256).max);

    }
    
    function testLiquidityStrategy() public view {
        assertEq(stabilityPool.liquidityStrategy(), liquidityStrategy);
    }


    function testSwapCollateralForStableRevertsWhenNotLiquidityStrategy() public {
        vm.expectRevert("StabilityPool: Caller is not LiquidityStrategy");
        stabilityPool.swapCollateralForStable(1e18, 1e18);
    }

    function testSwapCollateralForStableRevertsWhenSystemIsShutDown() public {
        vm.mockCall(
            address(troveManager),
            abi.encodeWithSelector(ITroveManager.shutdownTime.selector),
            abi.encode(block.timestamp - 1)
        );


        vm.expectRevert("StabilityPool: System is shut down");
        vm.startPrank(liquidityStrategy);
        stabilityPool.swapCollateralForStable(1e18, 1e18);
        vm.stopPrank();
    }

    function testSwapCollateralForStableRevertsWithInsufficientStableLiquidity() public {
        uint256 stableAmount = 1000e18;
        
        deal(address(boldToken), A, stableAmount);

        makeSPDepositAndClaim(A, stableAmount);
        
        uint256 collSwapAmount = 1e18;
        uint256 stableSwapAmount = stableAmount;

        
        vm.startPrank(liquidityStrategy);
        vm.expectRevert("P must never decrease to 0");
        stabilityPool.swapCollateralForStable(collSwapAmount, stableSwapAmount);


        vm.expectRevert("Total Bold deposits must be >= MIN_BOLD_AFTER_REBALANCE");
        stabilityPool.swapCollateralForStable(collSwapAmount, stableSwapAmount - .1e18);
        vm.stopPrank();
    }

    function testSwapCollateralForStableWithSurplus() public {
        SwapTestVars memory initialValues;

        priceFeed.setPrice(2000e18);
        vm.startPrank(A);

        borrowerOperations.openTrove(
            A,
            0,
            2e18,
            2000e18,
            0,
            0,
            MIN_ANNUAL_INTEREST_RATE,
            1000e18,
            address(0),
            address(0),
            address(0)
        );
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.openTrove(
            B,
            0,
            4e18,
            4000e18,
            0,
            0,
            MIN_ANNUAL_INTEREST_RATE,
            1000e18,
            address(0),
            address(0),
            address(0)
        );
        vm.stopPrank();


        // B deposits to SP
        makeSPDepositAndClaim(B, 4000e18);

        initialValues.depositor1CollBalance = collToken.balanceOf(B);
        initialValues.depositor1BoldBalance = boldToken.balanceOf(B);
        initialValues.spBoldBalance = stabilityPool.getTotalBoldDeposits();
        initialValues.spCollBalance = stabilityPool.getCollBalance();
        initialValues.lsBoldBalance = boldToken.balanceOf(liquidityStrategy);
        initialValues.lsCollBalance = collToken.balanceOf(liquidityStrategy);

        // Check SP has deposits
        assertEq(initialValues.spBoldBalance, 4000e18, "SP should have Bold deposits");
        
        uint256 collSwapAmount = 1e18;
        uint256 stableSwapAmount = 2000e18;

        // Simulate a rebalance by calling swapCollateralForStable as liquidity strategy
        vm.startPrank(liquidityStrategy);
        stabilityPool.swapCollateralForStable(collSwapAmount, stableSwapAmount);
        vm.stopPrank();

        // Check SP Bold has decreased by swap amount
        uint256 finalSPBoldBalance = stabilityPool.getTotalBoldDeposits();
        assertEq(
            finalSPBoldBalance,
            initialValues.spBoldBalance - stableSwapAmount,
            "SP Bold balance should decrease by swap amount"
        );
        
        // Check SP Coll has increased
        uint256 finalSPCollBalance = stabilityPool.getCollBalance();
        assertEq(
            finalSPCollBalance,
            initialValues.spCollBalance + collSwapAmount,
            "SP Coll balance should increase by swapped collateral"
        );

        // Check LP has received Bold
        uint256 finalLSBoldBalance = boldToken.balanceOf(liquidityStrategy);
        assertEq(finalLSBoldBalance, initialValues.lsBoldBalance + stableSwapAmount);

        // Check LP has sent Coll
        uint256 finalLSCollBalance = collToken.balanceOf(liquidityStrategy);
        assertEq(finalLSCollBalance, initialValues.lsCollBalance - collSwapAmount);
        
        vm.prank(B);
        stabilityPool.withdrawFromSP(finalSPBoldBalance - 1000e18, true); // subtract 1000e18 to avoid MIN_BOLD_AFTER_REBALANCE

        // Check B has received Bold
        // Received bold is less than the initial deposit because of the rebalance
        assertApproxEqAbs(boldToken.balanceOf(B), initialValues.depositor1BoldBalance + 1000e18, 1e18);

        // Check B has received Coll
        // Even though the collateral was never deposited, depositor should have received the collateral from the rebalance
        assertEq(collToken.balanceOf(B), initialValues.depositor1CollBalance + collSwapAmount);
       
    }

    function testSwapCollateralForStableWithLargerAmounts() public {
        uint256 stableAmount = 1e32; 
        
        deal(address(collToken), address(liquidityStrategy), 1e32);
        deal(address(boldToken), A, stableAmount);

        makeSPDepositAndClaim(A, stableAmount);
        
        uint256 collSwapAmount = 1e30;
        uint256 stableSwapAmount = stableAmount - 1000e18; // avoid MIN_BOLD_AFTER_REBALANCE
        
        SwapTestVars memory initialValues;
        initialValues.spBoldBalance = stabilityPool.getTotalBoldDeposits();
        initialValues.spCollBalance = stabilityPool.getCollBalance();
        initialValues.lsBoldBalance = boldToken.balanceOf(liquidityStrategy);
        initialValues.lsCollBalance = collToken.balanceOf(liquidityStrategy);


        
        vm.startPrank(liquidityStrategy);
        stabilityPool.swapCollateralForStable(collSwapAmount, stableSwapAmount);
        vm.stopPrank();
        
        // Verify balances updated correctly with larger amounts
        assertEq(stabilityPool.getTotalBoldDeposits(), initialValues.spBoldBalance - stableSwapAmount);
        assertEq(stabilityPool.getCollBalance(), initialValues.spCollBalance + collSwapAmount);
        assertEq(boldToken.balanceOf(liquidityStrategy), initialValues.lsBoldBalance + stableSwapAmount);
        assertEq(collToken.balanceOf(liquidityStrategy), initialValues.lsCollBalance - collSwapAmount);
    }

    function testSwapCollateralForStableWithMultipleDepositors() public {
        uint256 depositA = 1000e18; // 1/6
        uint256 depositB = 2000e18; // 1/3
        uint256 depositC = 3000e18; // 1/2

        deal(address(boldToken), A, depositA);
        deal(address(boldToken), B, depositB);
        deal(address(boldToken), C, depositC);
        
        // Multiple depositors
        makeSPDepositAndClaim(A, depositA);
        makeSPDepositAndClaim(B, depositB);
        makeSPDepositAndClaim(C, depositC);
        

        SwapTestVars memory initialValues;
        initialValues.spBoldBalance = stabilityPool.getTotalBoldDeposits();
        initialValues.spCollBalance = stabilityPool.getCollBalance();
        initialValues.lsBoldBalance = boldToken.balanceOf(liquidityStrategy);
        initialValues.lsCollBalance = collToken.balanceOf(liquidityStrategy);
        initialValues.depositor1CollBalance = collToken.balanceOf(A);
        initialValues.depositor1BoldBalance = boldToken.balanceOf(A);
        initialValues.depositor2CollBalance = collToken.balanceOf(B);
        initialValues.depositor2BoldBalance = boldToken.balanceOf(B);
        initialValues.depositor3CollBalance = collToken.balanceOf(C);
        initialValues.depositor3BoldBalance = boldToken.balanceOf(C);


        uint256 collSwapAmount = 1e18;
        uint256 stableSwapAmount = 1000e18;
        
        
        vm.startPrank(liquidityStrategy);
        stabilityPool.swapCollateralForStable(collSwapAmount, stableSwapAmount);
        vm.stopPrank();
        
        // Verify SP balances
        assertEq(stabilityPool.getTotalBoldDeposits(), initialValues.spBoldBalance - stableSwapAmount);
        assertEq(stabilityPool.getCollBalance(), initialValues.spCollBalance + collSwapAmount);
        
        // Verify liquidity strategy balances
        assertEq(boldToken.balanceOf(liquidityStrategy), initialValues.lsBoldBalance + stableSwapAmount);
        assertEq(collToken.balanceOf(liquidityStrategy), initialValues.lsCollBalance - collSwapAmount);
        
        // Withdraw from all depositors to check they receive proportional collateral gains
        vm.startPrank(A);
        stabilityPool.withdrawFromSP(depositA, true);
        vm.stopPrank();
        
        vm.startPrank(B);
        stabilityPool.withdrawFromSP(depositB, true);
        vm.stopPrank();

        vm.startPrank(C);
        // since this is the last depositor, we need to take depriciation and MIN_BOLD_IN_SP into account
        stabilityPool.withdrawFromSP(depositC - (stableSwapAmount / 2 + 1e18), true);
        vm.stopPrank();

        // A should gain 1/6 of the collateral because they deposited 1/6 of the total deposits
        assertApproxEqAbs(collToken.balanceOf(A), initialValues.depositor1CollBalance + collSwapAmount / 6, 1e18);

        // A should loose 1/6 of the Bold because they deposited 1/6 of the total deposits
        assertApproxEqAbs(boldToken.balanceOf(A), depositA - (initialValues.depositor1BoldBalance + stableSwapAmount / 6), 1e18);

        // B should receive 1/3 of the collateral because they deposited 1/3 of the total deposits
        assertApproxEqAbs(collToken.balanceOf(B), initialValues.depositor2CollBalance + collSwapAmount / 3, 1e18);

        // B should loose 1/3 of the Bold because they deposited 1/3 of the total deposits
        assertApproxEqAbs(boldToken.balanceOf(B), depositB - (initialValues.depositor2BoldBalance + stableSwapAmount / 3), 1e18);

        // C should receive 1/2 of the collateral because they deposited 1/2 of the total deposits
        assertApproxEqAbs(collToken.balanceOf(C), initialValues.depositor3CollBalance + collSwapAmount / 2, 1e18);

        // C should loose 1/2 of the Bold because they deposited 1/2 of the total deposits
        assertApproxEqAbs(boldToken.balanceOf(C), depositC - (initialValues.depositor3BoldBalance + stableSwapAmount / 2 + 1e18), 1e18);
    }

    function testSwapCollateralForStableAfterLiquidation() public {
        uint256 stableAmount = 2000e18;
        uint256 collAmount = 2e18;
        
        priceFeed.setPrice(2000e18);
        
        // Create troves
        vm.startPrank(A);
        uint256 ATroveId = borrowerOperations.openTrove(
            A,
            0,
            collAmount,
            stableAmount,
            0,
            0,
            MIN_ANNUAL_INTEREST_RATE,
            1000e18,
            address(0),
            address(0),
            address(0)
        );
        vm.stopPrank();
        
        vm.startPrank(B);
        borrowerOperations.openTrove(
            B,
            0,
            2 * collAmount,
            stableAmount + 100e18,
            0,
            0,
            MIN_ANNUAL_INTEREST_RATE,
            1000e18,
            address(0),
            address(0),
            address(0)
        );
        vm.stopPrank();
        
        uint256 cBoldDeposit = 20_000e18;
        deal(address(boldToken), C, cBoldDeposit);
        // C deposits to SP
        makeSPDepositAndClaim(C, cBoldDeposit);

        uint256 initialSPBold = stabilityPool.getTotalBoldDeposits();
        uint256 initialSPColl = stabilityPool.getCollBalance();
        
        // Perform a swap first
        uint256 collSwapAmount = 0.5e18;
        uint256 stableSwapAmount = 1000e18;
        
        vm.startPrank(liquidityStrategy);
        stabilityPool.swapCollateralForStable(collSwapAmount, stableSwapAmount);
        vm.stopPrank();

        // Now perform a liquidation
        priceFeed.setPrice(900e18); // Drop price to trigger liquidation

        vm.startPrank(A);
        troveManager.liquidate(ATroveId);
        vm.stopPrank();
        
        // Check that the liquidation worked correctly after the swap
        uint256 finalSPBold = stabilityPool.getTotalBoldDeposits();
        uint256 finalSPColl = stabilityPool.getCollBalance();
        
        // SP should have less Bold (due to liquidation offset + swap out) and more Coll (from liquidation + swap in)
        assertApproxEqAbs(finalSPBold, initialSPBold - stableAmount - stableSwapAmount, 1e18);
        assertApproxEqAbs(finalSPColl, initialSPColl + collAmount + collSwapAmount, 1e18);
        
        uint256 initialCColl = collToken.balanceOf(C);

        uint256 compoundedBoldDeposit = stabilityPool.getCompoundedBoldDeposit(C);
        // C should be able to withdraw and receive both swap and liquidation gains
        vm.startPrank(C);
        stabilityPool.withdrawFromSP(compoundedBoldDeposit - 1e18, true);
        vm.stopPrank();
        
        // C should have received collateral from both the swap and the liquidation
        assertApproxEqAbs(collToken.balanceOf(C), initialCColl + collSwapAmount + collAmount, 1e18);

        // C should have less Bold than deposited 
        assertApproxEqAbs(boldToken.balanceOf(C), cBoldDeposit - (stableSwapAmount + stableAmount), 1e18);
    }

    function testSwapCollateralForStableEmitsCorrectEvents() public {
        uint256 stableAmount = 10_000e18;

        uint256 collSwapAmount = 1000e18;
        uint256 stableSwapAmount = stableAmount / 2;
        

        deal(address(boldToken), A, stableAmount);
        deal(address(collToken), liquidityStrategy, collSwapAmount);

        makeSPDepositAndClaim(A, stableAmount);
        

        // Record initial balances for event verification
        uint256 initialSPBold = stabilityPool.getTotalBoldDeposits();
        uint256 initialSPColl = stabilityPool.getCollBalance();
        
        vm.startPrank(liquidityStrategy);
        
        // Expect events to be emitted in the correct order
        // First: S_Updated (from _updateTrackingVariables)
        // S_Updated value = P * _amountCollIn / totalBoldDeposits
        // = 1e36 * 1000e18 / 10_000e18 = 1e35
        vm.expectEmit(true, true, true, true);
        emit S_Updated(1e35, 0);
        
        // Second: P_Updated (from _updateTrackingVariables)
        // P_Updated value = P * (totalBoldDeposits - _amountStableOut) / totalBoldDeposits
        // = 1e36 * (10000e18 - 10000e18 / 2) / 10000e18 = 5e35
        vm.expectEmit(true, true, true, true);
        emit P_Updated(5e35);
        
        // Third: StabilityPoolBoldBalanceUpdated (from _swapCollateralForStable)
        vm.expectEmit(true, true, true, true);
        emit StabilityPoolBoldBalanceUpdated(initialSPBold - stableSwapAmount);
        
        // Fourth: StabilityPoolCollBalanceUpdated (from _swapCollateralForStable)
        vm.expectEmit(true, true, true, true);
        emit StabilityPoolCollBalanceUpdated(initialSPColl + collSwapAmount);
        
        stabilityPool.swapCollateralForStable(collSwapAmount, stableSwapAmount);
        vm.stopPrank();
    }

    function testSwapCollateralForStableWithScaleChanges() public {
        // Create a scenario that will trigger scale change
        uint256 stableAmount = 10_000_000_000_000e18;
        uint256 collSwapAmount = 1_000_000e18;
        uint256 stableSwapAmount = stableAmount - 1000e18; // Swap out all liquidity - MIN_BOLD_AFTER_REBALANCE

        deal(address(boldToken), A, stableAmount/2);
        deal(address(boldToken), B, stableAmount/2);
        deal(address(collToken), liquidityStrategy, collSwapAmount);

        makeSPDepositAndClaim(A, stableAmount/2);
        makeSPDepositAndClaim(B, stableAmount/2);
        
        
        uint256 initialScale = stabilityPool.currentScale();

        
        vm.startPrank(liquidityStrategy);
        stabilityPool.swapCollateralForStable(collSwapAmount, stableSwapAmount);
        vm.stopPrank();

        // 1e36 * (1e18 / 1e28) = 1e26 
        // 1e26 < 1e27, so the scale should increase
        
        uint256 finalScale = stabilityPool.currentScale();
        assertGt(finalScale, initialScale);
        assertEq(finalScale, 1);

        // P should be scaled back up 1e26 * 1e9 = 1e35
        assertEq(stabilityPool.P(), 1e35);
        
        // // Verify the swap still worked correctly regardless of scale changes
        assertEq(stabilityPool.getTotalBoldDeposits(), stableAmount - stableSwapAmount);
        assertEq(stabilityPool.getCollBalance(), collSwapAmount);

        uint256 compundedBoldDeposit = stabilityPool.getCompoundedBoldDeposit(A);
        assertEq(compundedBoldDeposit, (stableAmount - stableSwapAmount) / 2);

        uint256 depositorCollGain = stabilityPool.getDepositorCollGain(A);
        assertEq(depositorCollGain, collSwapAmount / 2 );
    }


    function testSwapCollateralForStableAtMinimumDeposit() public {
        uint256 stableAmount = 2000e18;

        deal(address(boldToken), A, stableAmount);
        makeSPDepositAndClaim(A, stableAmount);
        
        uint256 collSwapAmount = 1e18;
        uint256 stableSwapAmount = 1000e18;
        
        vm.startPrank(liquidityStrategy);
        stabilityPool.swapCollateralForStable(collSwapAmount, stableSwapAmount);
        vm.stopPrank();
        
        // Should still work and leave at least MIN_BOLD_IN_SP
        assertEq(stabilityPool.getTotalBoldDeposits(), 1_000e18);
        assertEq(stabilityPool.getCollBalance(), collSwapAmount);
    }

    function testSwapCollateralForStableWithYieldGains() public {
        uint256 stableAmount = 2000e18;
        uint256 yieldAmount = 100e18;
        uint256 collSwapAmount = 1e18;
        uint256 stableSwapAmount = 1000e18;

        // Setup initial deposits
        deal(address(boldToken), A, stableAmount);
        makeSPDepositAndClaim(A, stableAmount);

        deal(address(boldToken), B, stableAmount);
        makeSPDepositAndClaim(B, stableAmount);

        // Generate some yield gains
        vm.prank(address(activePool));
        stabilityPool.triggerBoldRewards(yieldAmount);

        uint256 initialYieldGainA = stabilityPool.getDepositorYieldGain(A);
        assertEq(initialYieldGainA, yieldAmount / 2);

        uint256 initialYieldGainB = stabilityPool.getDepositorYieldGain(B);
        assertEq(initialYieldGainB, yieldAmount / 2);

        // Perform rebalance
        vm.prank(liquidityStrategy);
        stabilityPool.swapCollateralForStable(collSwapAmount, stableSwapAmount);

        // Verify yield gain is preserved after swap
        uint256 finalYieldGainA = stabilityPool.getDepositorYieldGain(A);
        assertEq(finalYieldGainA, initialYieldGainA);

        uint256 finalYieldGainB = stabilityPool.getDepositorYieldGain(B);
        assertEq(finalYieldGainB, initialYieldGainB);

        // Verify depositors can still claim yield gains
        uint256 preBoldBalance = boldToken.balanceOf(A);
        vm.prank(A);
        stabilityPool.withdrawFromSP(0, true);
        
        uint256 postBoldBalance = boldToken.balanceOf(A);
        assertEq(postBoldBalance - preBoldBalance, initialYieldGainA);


        preBoldBalance = boldToken.balanceOf(B);
        vm.prank(B);
        stabilityPool.withdrawFromSP(0, true);
        postBoldBalance = boldToken.balanceOf(B);
        
        assertEq(postBoldBalance - preBoldBalance, initialYieldGainB);
    }
}
