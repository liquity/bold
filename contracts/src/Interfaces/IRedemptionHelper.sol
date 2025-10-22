// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRedemptionHelper {
    struct SimulationContext {
        address troveManager;
        address sortedTroves;
        bool redeemable;
        uint256 price;
        uint256 proportion;
        uint256 attemptedBold;
        uint256 redeemedBold;
        uint256 iterations;
    }

    struct Redeemed {
        uint256 bold;
        uint256 coll;
    }

    function simulateRedemption(uint256 _bold, uint256 _maxIterationsPerCollateral)
        external
        returns (SimulationContext[] memory branch, uint256 totalProportions);

    function truncateRedemption(uint256 _bold, uint256 _maxIterationsPerCollateral)
        external
        returns (uint256 truncatedBold, uint256 feePct, Redeemed[] memory redeemed);

    function redeemCollateral(
        uint256 _bold,
        uint256 _maxIterationsPerCollateral,
        uint256 _maxFeePct,
        uint256[] memory _minCollRedeemed
    ) external;
}
