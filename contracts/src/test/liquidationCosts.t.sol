// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract LiquidationCostsTest is DevTestSetup {
    uint256 public constant N_TROVES = 100;

    function testBatchLiquidationsOffset() public {
        priceFeed.setPrice(2000e18);

        // Healthy troves
        for (uint256 i = 0; i < N_TROVES; i++) {
            openTroveNoHints100pctWithIndex(A, i, 10 ether, 5000e18, 1e16);
        }
        // Deposit to SP
        makeSPDepositAndClaim(A, N_TROVES * 5000e18);

        uint256[] memory trovesToLiq = new uint256[](N_TROVES);
        // To be liquidated troves
        for (uint256 i = 0; i < N_TROVES; i++) {
            uint256 troveId = openTroveNoHints100pctWithIndex(B, i, 219e16, 2000e18, 1e16);
            trovesToLiq[i] = troveId;
        }

        // Price drops
        priceFeed.setPrice(1000e18);
        uint256 price = priceFeed.fetchPrice();

        // Check not RM
        assertEq(troveManager.checkBelowCriticalThreshold(price), false, "System should not be below CT");

        batchLiquidateTroves(A, trovesToLiq);

        // Check all troves were liquidated
        for (uint256 i = 0; i < N_TROVES; i++) {
            assertEq(
                uint8(troveManager.getTroveStatus(trovesToLiq[i])),
                uint8(ITroveManager.Status.closedByLiquidation),
                "Trove should have been liquidated"
            );
        }
    }

    function testBatchLiquidationsRedistribution() public {
        priceFeed.setPrice(2000e18);

        // Healthy troves
        for (uint256 i = 0; i < N_TROVES; i++) {
            openTroveNoHints100pctWithIndex(A, i, 10 ether, 5000e18, 1e16);
        }

        uint256[] memory trovesToLiq = new uint256[](N_TROVES);
        // To be liquidated troves
        for (uint256 i = 0; i < N_TROVES; i++) {
            uint256 troveId = openTroveNoHints100pctWithIndex(B, i, 219e16, 2000e18, 1e16);
            trovesToLiq[i] = troveId;
        }

        // Price drops
        priceFeed.setPrice(1000e18);
        uint256 price = priceFeed.fetchPrice();

        // Check not RM
        assertEq(troveManager.checkBelowCriticalThreshold(price), false, "System should not be below CT");

        batchLiquidateTroves(A, trovesToLiq);

        // Check all troves were liquidated
        for (uint256 i = 0; i < N_TROVES; i++) {
            assertEq(
                uint8(troveManager.getTroveStatus(trovesToLiq[i])),
                uint8(ITroveManager.Status.closedByLiquidation),
                "Trove should have been liquidated"
            );
        }
    }
}
