// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";

contract RebalancingRedemptions is DevTestSetup {
    using stdStorage for StdStorage;

    function test_redeemCollateralRebalancing_whenCallerIsNotLiquidityStrategy_shouldRevert() public {
        vm.expectRevert("CollateralRegistry: Caller is not LiquidityStrategy");
        collateralRegistry.redeemCollateralRebalancing(100, 10, 1e18);
    }

    function test_redeemCollateralRebalancing_whenAmountIsZero_shouldRevert() public {
        vm.startPrank(collateralRegistry.liquidityStrategy());
        vm.expectRevert("CollateralRegistry: Amount must be greater than zero");
        collateralRegistry.redeemCollateralRebalancing(0, 10, 1e18);
    }

    function test_redeemCollateralRebalancing_whenTroveOwnerFeeIsGreaterThan100_shouldRevert() public {
        vm.startPrank(collateralRegistry.liquidityStrategy());
        vm.expectRevert("CollateralRegistry: Trove owner fee must be between 0% and 100%");
        collateralRegistry.redeemCollateralRebalancing(100, 10, 1e18 + 1);
    }

    function test_redeemCollateralRebalancing_whenCallerIsLiquidityStrategy_shouldRedeemAmountCorrectly() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();
        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);
        uint256 debt_C = troveManager.getTroveEntireDebt(troveIDs.C);

        uint256 coll_A = troveManager.getTroveEntireColl(troveIDs.A);
        uint256 coll_B = troveManager.getTroveEntireColl(troveIDs.B);
        uint256 coll_C = troveManager.getTroveEntireColl(troveIDs.C);

        uint256 debtToRedeem = debt_A + debt_B + debt_C/2;

        deal(address(boldToken), address(collateralRegistry.liquidityStrategy()), debtToRedeem);

        vm.startPrank(collateralRegistry.liquidityStrategy());
        // redemption fee is 50 bps scaled to 1e18
        collateralRegistry.redeemCollateralRebalancing(debtToRedeem, 10, 50 * 1e12);

        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), 0);
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), 0);
        // plus 1 because of rounding down when calculating the debt to redeem
        assertEq(troveManager.getTroveEntireDebt(troveIDs.C), debt_C/2 + 1 );
    }

    function test_redeemCollateralRebalancing_whenCallerIsLiquidityStrategy_shouldLeaveCorrectFeeInTroves() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();
        uint256 price = priceFeed.getPrice();

        // redemption fee is 50 bps scaled to 1e18
        uint256 fee = 50 * 1e12;

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);
        uint256 debt_C = troveManager.getTroveEntireDebt(troveIDs.C);

        uint256 coll_A = troveManager.getTroveEntireColl(troveIDs.A);
        uint256 coll_B = troveManager.getTroveEntireColl(troveIDs.B);
        uint256 coll_C = troveManager.getTroveEntireColl(troveIDs.C);

        uint256 debtToRedeem = debt_A + debt_B + debt_C/2;

        uint256 expectedColl_A_After = calculateCorrespondingCollAfterRedemption(debt_A, coll_A, price, 50 * 1e12);
        uint256 expectedColl_B_After = calculateCorrespondingCollAfterRedemption(debt_B, coll_B, price, 50 * 1e12);
        uint256 expectedColl_C_After = calculateCorrespondingCollAfterRedemption(debt_C/2, coll_C, price, 50 * 1e12);

        deal(address(boldToken), address(collateralRegistry.liquidityStrategy()), debtToRedeem);

        vm.startPrank(collateralRegistry.liquidityStrategy());
        collateralRegistry.redeemCollateralRebalancing(debtToRedeem, 10, fee);


        assertEq(troveManager.getTroveEntireColl(troveIDs.A), expectedColl_A_After);
        assertEq(troveManager.getTroveEntireColl(troveIDs.B), expectedColl_B_After);
        assertEq(troveManager.getTroveEntireColl(troveIDs.C), expectedColl_C_After);
    }

    function test_redeemCollateralRebalancing_whenCallerIsLiquidityStrategyAndCollateralIsNotRedeemable_shouldRevert() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();
        uint256 price = priceFeed.getPrice();

        priceFeed.setPrice((price * 5e17)/1e18); // 50% below the initial price

        vm.startPrank(collateralRegistry.liquidityStrategy());
        vm.expectRevert("CollateralRegistry: Collateral is not redeemable");
        collateralRegistry.redeemCollateralRebalancing(100, 10, 50 * 1e12);
    }

    function test_redeemCollateralRebalancing_whenCallerIsLiquidityStrategyAndFullAmountIsNotRedeemed_shouldRevert() public {
        (,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        uint256 totalDebtSupply = boldToken.totalSupply();

        vm.startPrank(collateralRegistry.liquidityStrategy());
        vm.expectRevert("CollateralRegistry: Redeemed amount does not match requested amount");
        collateralRegistry.redeemCollateralRebalancing(totalDebtSupply + 1, 10, 50 * 1e12);
    }

    function calculateCorrespondingCollAfterRedemption(uint256 debtRedeemed, uint256 collInitial, uint256 price, uint256 fee) public pure returns (uint256 collateralAfter) {
        uint256 correspondingColl = debtRedeemed * DECIMAL_PRECISION / price;
        uint256 correspondingCollFee = (debtRedeemed * fee * DECIMAL_PRECISION) / (1e18 * price);
        return collInitial - correspondingColl + correspondingCollFee;
    }
}
