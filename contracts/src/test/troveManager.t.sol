pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract TroveManagerTest is DevTestSetup {
    function testRedeemSkipTrovesUnder100pct() public {
        priceFeed.setPrice(2000e18);
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 2 ether, 2001e18, 1e17);
        uint256 BTroveId = openTroveNoHints100pctMaxFee(B, 5 ether, 2000e18, 2e17);
        openTroveNoHints100pctMaxFee(C, 5 ether, 2000e18, 3e17);

        uint256 debtA1 = troveManager.getTroveDebt(ATroveId);
        assertGt(debtA1, 0);
        uint256 collA1 = troveManager.getTroveColl(ATroveId);
        assertGt(collA1, 0);
        uint256 debtB1 = troveManager.getTroveDebt(BTroveId);
        assertGt(debtB1, 0);
        uint256 collB1 = troveManager.getTroveColl(BTroveId);
        assertGt(collB1, 0);

        // Reduce ETH price so A’s ICR goes below 100%
        uint256 newPrice = 1000e18;
        priceFeed.setPrice(newPrice);
        assertLt(troveManager.getCurrentICR(ATroveId, newPrice), _100pct);
        assertGt(troveManager.getCurrentICR(BTroveId, newPrice), _100pct);

        uint256 redemptionAmount = 1000e18; // 1k BOLD

        // C redeems 1k BOLD
        vm.startPrank(C);
        collateralRegistry.redeemCollateral(redemptionAmount, 10, 1e18);
        vm.stopPrank();

        // Check A's coll and debt are the same
        uint256 debtA2 = troveManager.getTroveDebt(ATroveId);
        assertEq(debtA2, debtA1, "A debt mismatch");
        uint256 collA2 = troveManager.getTroveColl(ATroveId);
        assertEq(collA2, collA1, "A coll mismatch");

        // Check B's coll and debt reduced
        uint256 debtB2 = troveManager.getTroveDebt(BTroveId);
        assertLt(debtB2, debtB1, "B debt mismatch");
        uint256 collB2 = troveManager.getTroveColl(BTroveId);
        assertLt(collB2, collB1, "B coll mismatch");
    }

    function testInitialRedemptionBaseRate() public {
        assertEq(collateralRegistry.baseRate(), 5e16);
    }

    function testRedemptionBaseRateAfter2Weeks() public {
        assertEq(collateralRegistry.baseRate(), 5e16);

        // Two weeks go by
        vm.warp(block.timestamp + 14 days);

        priceFeed.setPrice(2000e18);
        openTroveNoHints100pctMaxFee(A, 200 ether, 200000e18, 1e17);
        // A redeems 0.01 BOLD, base rate goes down to almost zero (it’s updated on redemption)
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(1e16, 10, 1e18);
        vm.stopPrank();

        console.log(collateralRegistry.baseRate(), "baseRate");
        assertLt(collateralRegistry.baseRate(), 3e10); // Goes down below 3e-8, i.e., below 0.000003%
    }
}
