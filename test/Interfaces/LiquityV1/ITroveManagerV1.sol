// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITroveManagerV1 {
    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint256);
    function getBorrowingRateWithDecay() external view returns (uint256);

    function getEntireDebtAndColl(address _borrower)
        external
        view
        returns (uint256 debt, uint256 coll, uint256 pendingLUSDDebtReward, uint256 pendingETHReward);

    function redeemCollateral(
        uint256 _LUSDamount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations,
        uint256 _maxFeePercentage
    ) external;

    function liquidateTroves(uint256 _n) external;
}
