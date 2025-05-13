// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

struct LatestBatchData {
    uint256 totalDebtShares;
    uint256 entireDebtWithoutRedistribution;
    uint256 entireCollWithoutRedistribution;
    uint256 accruedInterest;
    uint256 recordedDebt;
    uint256 annualInterestRate;
    uint256 weightedRecordedDebt;
    uint256 annualManagementFee;
    uint256 accruedManagementFee;
    uint256 weightedRecordedBatchManagementFee;
    uint256 lastDebtUpdateTime;
    uint256 lastInterestRateAdjTime;
}
