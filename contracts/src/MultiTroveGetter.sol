// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;
pragma experimental ABIEncoderV2;

import "./TroveManager.sol";
import "./SortedTroves.sol";

/*  Helper contract for grabbing Trove data for the front end. Not part of the core Liquity system. */
contract MultiTroveGetter {
    struct CombinedTroveData {
        uint256 id;

        uint debt;
        uint coll;
        uint stake;

        uint snapshotETH;
        uint snapshotBoldDebt;
    }

    TroveManager public troveManager; // XXX Troves missing from ITroveManager?
    ISortedTroves public sortedTroves;

    constructor(TroveManager _troveManager, ISortedTroves _sortedTroves) {
        troveManager = _troveManager;
        sortedTroves = _sortedTroves;
    }

    function getMultipleSortedTroves(int _startIdx, uint _count)
        external view returns (CombinedTroveData[] memory _troves)
    {
        uint startIdx;
        bool descend;

        if (_startIdx >= 0) {
            startIdx = uint(_startIdx);
            descend = true;
        } else {
            startIdx = uint(-(_startIdx + 1));
            descend = false;
        }

        uint sortedTrovesSize = sortedTroves.getSize();

        if (startIdx >= sortedTrovesSize) {
            _troves = new CombinedTroveData[](0);
        } else {
            uint maxCount = sortedTrovesSize - startIdx;

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

    function _getMultipleSortedTrovesFromHead(uint _startIdx, uint _count)
        internal view returns (CombinedTroveData[] memory _troves)
    {
        uint256 currentTroveId = sortedTroves.getFirst();

        for (uint idx = 0; idx < _startIdx; ++idx) {
            currentTroveId = sortedTroves.getNext(currentTroveId);
        }

        _troves = new CombinedTroveData[](_count);

        for (uint idx = 0; idx < _count; ++idx) {
            _troves[idx].id = currentTroveId;
            (
                _troves[idx].debt,
                _troves[idx].coll,
                _troves[idx].stake,
                /* status */,
                /* arrayIndex */,
                /* annualInterestRate */,
                /* lastDebtUpdateTime */
            ) = troveManager.Troves(currentTroveId);
            (
                _troves[idx].snapshotETH,
                _troves[idx].snapshotBoldDebt
            ) = troveManager.rewardSnapshots(currentTroveId);

            currentTroveId = sortedTroves.getNext(currentTroveId);
        }
    }

    function _getMultipleSortedTrovesFromTail(uint _startIdx, uint _count)
        internal view returns (CombinedTroveData[] memory _troves)
    {
        uint256 currentTroveId = sortedTroves.getLast();

        for (uint idx = 0; idx < _startIdx; ++idx) {
            currentTroveId = sortedTroves.getPrev(currentTroveId);
        }

        _troves = new CombinedTroveData[](_count);

        for (uint idx = 0; idx < _count; ++idx) {
            _troves[idx].id = currentTroveId;
            (
                _troves[idx].debt,
                _troves[idx].coll,
                _troves[idx].stake,
                /* status */,
                /* arrayIndex */,
                /* annualInterestRate */,
                /* lastDebtUpdateTime */
            ) = troveManager.Troves(currentTroveId);
            (
                _troves[idx].snapshotETH,
                _troves[idx].snapshotBoldDebt
            ) = troveManager.rewardSnapshots(currentTroveId);

            currentTroveId = sortedTroves.getPrev(currentTroveId);
        }
    }
}
