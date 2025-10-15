// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";

contract StabilityScalingTest is DevTestSetup {
    address liquidityStrategy;

    function setUp() public override {
        super.setUp();
        liquidityStrategy = addressesRegistry.liquidityStrategy();
        deal(address(collToken), liquidityStrategy, 1e60);
        vm.prank(liquidityStrategy);
        collToken.approve(address(stabilityPool), type(uint256).max);
    }

    function _setupStabilityPool(uint256 magnitude) internal {
        uint256 amount = 1e18 * 10 ** magnitude;
        deal(address(boldToken), A, amount);
        deal(address(boldToken), B, amount);
        makeSPDepositAndClaim(A, amount);
        makeSPDepositAndClaim(B, amount);
    }

    function _topUpStabilityPoolBold(uint256 amount) internal {
        deal(address(boldToken), D, amount);
        makeSPDepositAndClaim(D, amount);
    }

    function _openLiquidatableTroves(
        uint256 numTroves,
        uint256 collAmount,
        uint256 debtAmount,
        uint256 interestRate,
        uint256 liquidationPrice
    ) internal returns (uint256[] memory) {
        uint256[] memory troveIds = new uint256[](numTroves);

        // Set initial price high enough for troves to be opened safely
        priceFeed.setPrice(4000e18);

        // Open troves for additional accounts
        for (uint256 i = 0; i < numTroves; i++) {
            address account = vm.addr(1000 + i); // Generate unique addresses

            // Fund and approve collateral
            giveAndApproveColl(account, collAmount);

            deal(address(WETH), account, 1000e18);

            vm.startPrank(account);
            WETH.approve(address(borrowerOperations), type(uint256).max);
            vm.stopPrank();

            // Open trove
            uint256 troveId = openTroveNoHints100pct(
                account,
                collAmount,
                debtAmount,
                interestRate
            );
            troveIds[i] = troveId;
        }

        // Drop price to make troves liquidatable
        if (liquidationPrice > 0) {
            priceFeed.setPrice(liquidationPrice);
        }

        return troveIds;
    }

    function _openLiquidatableTrovesDefault(
        uint256 numTroves
    ) internal returns (uint256[] memory) {
        uint256 collAmount = 1 ether;
        uint256 debtAmount = 2000e18;
        uint256 interestRate = 5e16; // 5%
        uint256 liquidationPrice = 2000e18; // Makes troves liquidatable at 2000 price

        return
            _openLiquidatableTroves(
                numTroves,
                collAmount,
                debtAmount,
                interestRate,
                liquidationPrice
            );
    }

    function testWithdrawalsWithLargeNumberOfScaleChanges() public {
        // Users each deposit 1M bold to SP
        _setupStabilityPool(6);

        uint256 previousScale = stabilityPool.currentScale();
        uint256 previousP = stabilityPool.P();
        uint256 previousTotalDeposits = stabilityPool.getTotalBoldDeposits();

        // Open 200 liquidatable troves
        uint256[] memory troveIds = _openLiquidatableTrovesDefault(200);
        // liquidate 50 of them
        for (uint256 j = 0; j < 50; j++) {
            liquidate(D, troveIds[j]);
        }
        // Scale won't change
        assertEq(stabilityPool.currentScale(), previousScale);
        // P should decrease
        assertGt(previousP, stabilityPool.P());
        // Total deposits should decrease
        assertGt(previousTotalDeposits, stabilityPool.getTotalBoldDeposits());

        // Update previous values
        previousScale = stabilityPool.currentScale();
        previousP = stabilityPool.P();
        previousTotalDeposits = stabilityPool.getTotalBoldDeposits();

        // Simulate rebalance 1000 times
        for (uint256 i = 1; i <= 1000; i++) {
            uint boldBalance = stabilityPool.getTotalBoldDeposits();
            uint256 stableOut = (boldBalance) / 2;
            // Swap out half of the bold in SP
            vm.prank(liquidityStrategy);
            stabilityPool.swapCollateralForStable(stableOut / 2000, stableOut);
            // Top up SP with the same amount of bold swapped out
            _topUpStabilityPoolBold(stableOut);
        }

        // Scale will increase
        assertGt(stabilityPool.currentScale(), previousScale);
        // Total deposits will stay the same because we top up SP with the same amount of bold swapped out
        assertEq(previousTotalDeposits, stabilityPool.getTotalBoldDeposits());
        // Update previous values
        previousScale = stabilityPool.currentScale();
        previousP = stabilityPool.P();
        previousTotalDeposits = stabilityPool.getTotalBoldDeposits();

        // Liquidate the remaining troves - 1
        for (uint256 j = 50; j < 199; j++) {
            liquidate(D, troveIds[j]);
        }
        // Scale won't change
        assertEq(stabilityPool.currentScale(), previousScale);
        // P should decrease
        assertGt(previousP, stabilityPool.P());
        // Total deposits should decrease
        assertGt(previousTotalDeposits, stabilityPool.getTotalBoldDeposits());

        // Withdraw A and B from SP to observe the withdrawals
        uint256 boldBalanceA = boldToken.balanceOf(A);
        uint256 collBalanceA = collToken.balanceOf(A);

        // A deposited 1M bold to SP initially
        assertEq(stabilityPool.deposits(A), 1_000_000e18);

        vm.startPrank(A);
        // A tries to withdraw all their bold from SP
        stabilityPool.withdrawFromSP(stabilityPool.deposits(A), true);
        vm.stopPrank();

        uint256 boldWithdrawA = boldToken.balanceOf(A) - boldBalanceA;
        uint256 collWithdrawA = collToken.balanceOf(A) - collBalanceA;

        // A's full bold position is diminished by the rebalances and liquidations
        // There is a small amount of bold left because of the Yield gain
        assertLt(boldWithdrawA, 500e18);

        // A's coll gain is a combination of rebalance and liquidations
        // In exchange for the 1M bold they lost, they should receive almost the same amount of collateral
        // * because we executed swaps and liquidations at the same price (2000e18)
        assertApproxEqAbs(collWithdrawA, 1_000_000e18 / 2000, 1e18);
    }

    function testHowScaleChangesAffectsCollGains() public {
        _setupStabilityPool(6);

        uint256 previousScale = stabilityPool.currentScale();
        uint256 previousCollGain = stabilityPool.getDepositorCollGain(A);
        uint256 previousDeposit = stabilityPool.getCompoundedBoldDeposit(A);

        // Open 200 liquidatable troves
        uint256[] memory troveIds = _openLiquidatableTrovesDefault(200);

        // liquidate 50 of them
        for (uint256 j = 0; j < 50; j++) {
            liquidate(D, troveIds[j]);
        }

        // 50 troves were liquidated, each with 2000e18 debt
        // Half of the total debt is offsetted by A's deposit since it had the half of the total deposits
        uint256 deptOffset = (50 * 2_000e18) / 2;
        // Liquidation price is 2000e18, so each trove has 1 ether of collateral
        uint256 collGain = (50 * 1 ether) / 2;
        assertApproxEqRel(
            stabilityPool.getCompoundedBoldDeposit(A),
            previousDeposit - deptOffset,
            1e16
        );
        assertApproxEqRel(
            stabilityPool.getDepositorCollGain(A),
            collGain - previousCollGain,
            1e16
        );

        previousScale = stabilityPool.currentScale();
        previousCollGain = stabilityPool.getDepositorCollGain(A);
        previousDeposit = stabilityPool.getCompoundedBoldDeposit(A);

        // Simulate rebalance until the edge of a scale change
        for (uint256 i = 1; i <= 29; i++) {
            uint boldBalance = stabilityPool.getTotalBoldDeposits();
            uint256 stableOut = (boldBalance) / 2;
            // Swap out half of the bold in SP
            vm.prank(liquidityStrategy);
            stabilityPool.swapCollateralForStable(stableOut / 2000, stableOut);
            // Top up SP with the same amount of bold swapped out
            _topUpStabilityPoolBold(stableOut);
        }

        assertEq(stabilityPool.currentScale(), previousScale);

        // at this point, initial depositors almost lost all their deposits
        assertLt(stabilityPool.getCompoundedBoldDeposit(A), 1e18);
        // their positions moved to collateral almost completely =~ 500e18
        assertApproxEqRel(
            stabilityPool.getDepositorCollGain(A),
            1_000_000e18 / 2000,
            1e16
        );

        // Deposit again
        _setupStabilityPool(6);

        previousScale = stabilityPool.currentScale();
        previousCollGain = stabilityPool.getDepositorCollGain(A);
        previousDeposit = stabilityPool.getCompoundedBoldDeposit(A);

        // Simulate rebalance until scale changes
        for (uint256 i = 1; i <= 10; i++) {
            uint boldBalance = stabilityPool.getTotalBoldDeposits();
            uint256 stableOut = (boldBalance) / 10;
            // Swap out half of the bold in SP
            vm.prank(liquidityStrategy);
            stabilityPool.swapCollateralForStable(stableOut / 2000, stableOut);
            // Top up SP with the same amount of bold swapped out
            if (stabilityPool.currentScale() > previousScale) {
                break;
            }
        }

        previousCollGain = stabilityPool.getDepositorCollGain(A);
        previousDeposit = stabilityPool.getCompoundedBoldDeposit(A);

        // liquidate 50 more troves
        // coll gains will be received for a positon that is opened on 1 scale above
        for (uint256 j = 50; j < 100; j++) {
            liquidate(D, troveIds[j]);
        }
        // depositors should have less deposits and more coll gain
        assertLt(stabilityPool.getCompoundedBoldDeposit(A), previousDeposit);
        assertGt(stabilityPool.getDepositorCollGain(A), previousCollGain);

        previousScale = stabilityPool.currentScale();


        // Simulate rebalance until scale changes
        for (uint256 i = 1; i <= 100; i++) {
            uint boldBalance = stabilityPool.getTotalBoldDeposits();
            uint256 stableOut = (boldBalance) / 2;
            // Swap out half of the bold in SP
            vm.prank(liquidityStrategy);
            stabilityPool.swapCollateralForStable(stableOut / 2000, stableOut);
            // Top up SP with the same amount of bold swapped out
            _topUpStabilityPoolBold(stableOut);
            if (stabilityPool.currentScale() > previousScale) {
                break;
            }
        }


        previousCollGain = stabilityPool.getDepositorCollGain(A);
        previousDeposit = stabilityPool.getCompoundedBoldDeposit(A);

        // liquidate 50 more troves
        // coll gains will be received for a positon that is opened on 2 scale above
        for (uint256 j = 100; j < 150; j++) {
            liquidate(D, troveIds[j]);
        }
        // depositors should have less deposits and more coll gain
        // changes will be minimal since the share of the depositor is small now
        assertLt(stabilityPool.getCompoundedBoldDeposit(A), previousDeposit);
        assertGt(stabilityPool.getDepositorCollGain(A), previousCollGain);

        previousScale = stabilityPool.currentScale();

        // Simulate rebalance until scale changes
        for (uint256 i = 1; i <= 100; i++) {
            uint boldBalance = stabilityPool.getTotalBoldDeposits();
            uint256 stableOut = (boldBalance) / 2;
            // Swap out half of the bold in SP
            vm.prank(liquidityStrategy);
            stabilityPool.swapCollateralForStable(stableOut / 2000, stableOut);
            // Top up SP with the same amount of bold swapped out
            _topUpStabilityPoolBold(stableOut);
            if (stabilityPool.currentScale() > previousScale) {
                break;
            }
        }

        previousCollGain = stabilityPool.getDepositorCollGain(A);
        previousDeposit = stabilityPool.getCompoundedBoldDeposit(A);

        // liquidate 50 more troves
        // positions will stop gaining coll because they are opened on 2 scale above
        // and now too small to gain any coll
        for (uint256 j = 150; j < 199; j++) {
            liquidate(D, troveIds[j]);
        }
        // depositors should have less deposits and coll gain should be the same
        assertLt(stabilityPool.getCompoundedBoldDeposit(A), previousDeposit);
        assertEq(stabilityPool.getDepositorCollGain(A), previousCollGain);
    }

    function testStabilityScaling_hugeDepositorDoesntLooseBold() public {
      address depositor = makeAddr("earthUsdReserve");
      uint256 depositAmount = 2.417 ether * 1e12; // Total USD in circulation: 2.417 T
      deal(address(boldToken), depositor, depositAmount);
      makeSPDepositAndClaim(depositor, depositAmount);

      for (uint256 i = 0; i < 9; ++i) {
        uint256 spBalance = boldToken.balanceOf(address(stabilityPool));
        uint256 boldOut = spBalance - 1_000e18;
        uint256 collIn = boldOut / 2000;
        vm.prank(liquidityStrategy);
        stabilityPool.swapCollateralForStable(collIn, boldOut);
        _topUpStabilityPoolBold(boldOut);
      }

      uint256 collGain = stabilityPool.getDepositorCollGain(depositor);
      uint256 compoundedBold = stabilityPool.getCompoundedBoldDeposit(depositor);
      assertEq(stabilityPool.currentScale(), 9);

      assertEq(compoundedBold, 0);
      assertApproxEqAbs(collGain, depositAmount / 2000, 1);
    }
}
