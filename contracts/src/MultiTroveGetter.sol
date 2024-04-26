// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;
pragma experimental ABIEncoderV2;

import "./TroveManager.sol";
import "./SortedTroves.sol";

/*  Helper contract for grabbing Trove data for the front end. Not part of the core Liquity system. */
contract MultiTroveGetter {
    struct CombinedTroveData {
        uint256 id;
        uint256 debt;
        uint256 coll;
        uint256 stake;
        uint256 snapshotETH;
        uint256 snapshotBoldDebt;
    }

    TroveManager public troveManager; // XXX Troves missing from ITroveManager?
    ISortedTroves public sortedTroves;

    constructor(TroveManager _troveManager, ISortedTroves _sortedTroves) {
        troveManager = _troveManager;
        sortedTroves = _sortedTroves;
    }

    function getMultipleSortedTroves(int256 _startIdx, uint256 _count)
        external
        view
        returns (CombinedTroveData[] memory _troves)
    {
        uint256 startIdx;
        bool descend;

        if (_startIdx >= 0) {
            startIdx = uint256(_startIdx);
            descend = true;
        } else {
            startIdx = uint256(-(_startIdx + 1));
            descend = false;
        }

        uint256 sortedTrovesSize = sortedTroves.getSize();

        if (startIdx >= sortedTrovesSize) {
            _troves = new CombinedTroveData[](0);
        } else {
            uint256 maxCount = sortedTrovesSize - startIdx;

            if (_count > maxCount) {
                _count = maxCount;
            }

            if (descend) {
                _troves = _getMultipleSortedTrovesFromHead(startIdx, _count);
            } else {
                _troves = _getMultipleSortedTrovesFromTail(startIdx, _count);
            }
        }
    }

    function _getMultipleSortedTrovesFromHead(uint256 _startIdx, uint256 _count)
        internal
        view
        returns (CombinedTroveData[] memory _troves)
    {
        uint256 currentTroveId = sortedTroves.getFirst();

        for (uint256 idx = 0; idx < _startIdx; ++idx) {
            currentTroveId = sortedTroves.getNext(currentTroveId);
        }

        _troves = new CombinedTroveData[](_count);

        for (uint256 idx = 0; idx < _count; ++idx) {
            _troves[idx].id = currentTroveId;
            (
                _troves[idx].debt,
                _troves[idx].coll,
                _troves[idx].stake,
                /* status */
                ,
                /* arrayIndex */
                ,
                /* annualInterestRate */
                ,
                /* lastDebtUpdateTime */
            ) = troveManager.Troves(currentTroveId);
            (_troves[idx].snapshotETH, _troves[idx].snapshotBoldDebt) = troveManager.rewardSnapshots(currentTroveId);

            currentTroveId = sortedTroves.getNext(currentTroveId);
        }
    }

    function _getMultipleSortedTrovesFromTail(uint256 _startIdx, uint256 _count)
        internal
        view
        returns (CombinedTroveData[] memory _troves)
    {
        uint256 currentTroveId = sortedTroves.getLast();

        for (uint256 idx = 0; idx < _startIdx; ++idx) {
            currentTroveId = sortedTroves.getPrev(currentTroveId);
        }

        _troves = new CombinedTroveData[](_count);

        for (uint256 idx = 0; idx < _count; ++idx) {
            _troves[idx].id = currentTroveId;
            (
                _troves[idx].debt,
                _troves[idx].coll,
                _troves[idx].stake,
                /* status */
                ,
                /* arrayIndex */
                ,
                /* annualInterestRate */
                ,
                /* lastDebtUpdateTime */
            ) = troveManager.Troves(currentTroveId);
            (_troves[idx].snapshotETH, _troves[idx].snapshotBoldDebt) = troveManager.rewardSnapshots(currentTroveId);

            currentTroveId = sortedTroves.getPrev(currentTroveId);
        }
    }
}
