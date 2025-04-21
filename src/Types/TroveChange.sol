// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

struct TroveChange {
    uint256 appliedRedistBoldDebtGain;
    uint256 appliedRedistCollGain;
    uint256 collIncrease;
    uint256 collDecrease;
    uint256 debtIncrease;
    uint256 debtDecrease;
    uint256 newWeightedRecordedDebt;
    uint256 oldWeightedRecordedDebt;
    uint256 upfrontFee;
    uint256 batchAccruedManagementFee;
    uint256 newWeightedRecordedBatchManagementFee;
    uint256 oldWeightedRecordedBatchManagementFee;
}
