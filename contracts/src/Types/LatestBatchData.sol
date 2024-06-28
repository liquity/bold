// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

struct LatestBatchData {
    uint256 entireDebt;
    uint256 entireColl;
    uint256 accruedInterest;
    uint256 recordedDebt;
    uint256 annualInterestRate;
    uint256 weightedRecordedDebt;
    uint256 annualFee;
    uint256 accruedFee;
    uint256 weightedRecordedBatchFee;
    uint256 lastDebtUpdateTime;
    uint256 lastInterestRateAdjTime;
}
