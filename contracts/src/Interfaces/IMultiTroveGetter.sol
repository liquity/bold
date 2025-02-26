// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IMultiTroveGetter {
    struct CombinedTroveData {
        uint256 id;
        uint256 entireDebt;
        uint256 entireColl;
        uint256 redistBoldDebtGain;
        uint256 redistCollGain;
        uint256 accruedInterest;
        uint256 recordedDebt;
        uint256 annualInterestRate;
        uint256 accruedBatchManagementFee;
        uint256 lastInterestRateAdjTime;
        uint256 stake;
        uint256 lastDebtUpdateTime;
        address interestBatchManager;
        uint256 batchDebtShares;
        uint256 snapshotETH;
        uint256 snapshotBoldDebt;
    }

    struct DebtPerInterestRate {
        address interestBatchManager;
        uint256 interestRate;
        uint256 debt;
    }

    function getMultipleSortedTroves(uint256 _collIndex, int256 _startIdx, uint256 _count)
        external
        view
        returns (CombinedTroveData[] memory _troves);

    function getDebtPerInterestRateAscending(uint256 _collIndex, uint256 _startId, uint256 _maxIterations)
        external
        view
        returns (DebtPerInterestRate[] memory, uint256 currId);
}
