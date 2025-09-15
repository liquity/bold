// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "./Interfaces/ICollateralRegistry.sol";
import "./Interfaces/IMultiTroveGetter.sol";
import "./Types/BatchId.sol";
import "./Types/LatestTroveData.sol";
import "./Types/LatestBatchData.sol";
import "./Types/TroveChange.sol";
import "./Interfaces/ISortedTroves.sol";

/*  Helper contract for grabbing Trove data for the front end. Not part of the core Liquity system. */
contract MultiTroveGetter is IMultiTroveGetter {
    ICollateralRegistry public immutable collateralRegistry;

    constructor(ICollateralRegistry _collateralRegistry) {
        collateralRegistry = _collateralRegistry;
    }

    function getMultipleSortedTroves(uint256 _collIndex, int256 _startIdx, uint256 _count)
        external
        view
        returns (CombinedTroveData[] memory _troves)
    {
        ITroveManager troveManager = collateralRegistry.allTroveManagerAddresses(_collIndex);
        require(address(troveManager) != address(0), "Invalid collateral index");

        ISortedTroves sortedTroves = troveManager.sortedTroves();
        assert(address(sortedTroves) != address(0));

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
                _troves = _getMultipleSortedTrovesFromHead(troveManager, sortedTroves, startIdx, _count);
            } else {
                _troves = _getMultipleSortedTrovesFromTail(troveManager, sortedTroves, startIdx, _count);
            }
        }
    }

    function _getOneTrove(ITroveManager _troveManager, uint256 _id, CombinedTroveData memory _out) internal view {
        _out.id = _id;

        LatestTroveData memory troveData = _troveManager.getLatestTroveData(_id);
        _out.entireDebt = troveData.entireDebt;
        _out.entireColl = troveData.entireColl;
        _out.redistBoldDebtGain = troveData.redistBoldDebtGain;
        _out.redistCollGain = troveData.redistCollGain;
        _out.accruedInterest = troveData.accruedInterest;
        _out.recordedDebt = troveData.recordedDebt;
        _out.annualInterestRate = troveData.annualInterestRate;
        _out.accruedBatchManagementFee = troveData.accruedBatchManagementFee;
        _out.lastInterestRateAdjTime = troveData.lastInterestRateAdjTime;

        (
            , // debt
            , // coll
            _out.stake,
            , // status
            , // arrayIndex
            _out.lastDebtUpdateTime,
            , // lastInterestRateAdjTime
            , // annualInterestRate
            _out.interestBatchManager,
            _out.batchDebtShares
        ) = _troveManager.Troves(_id);

        (_out.snapshotETH, _out.snapshotBoldDebt) = _troveManager.rewardSnapshots(_id);
    }

    function _getMultipleSortedTrovesFromHead(
        ITroveManager _troveManager,
        ISortedTroves _sortedTroves,
        uint256 _startIdx,
        uint256 _count
    ) internal view returns (CombinedTroveData[] memory _troves) {
        uint256 currentTroveId = _sortedTroves.getFirst();

        for (uint256 idx = 0; idx < _startIdx; ++idx) {
            currentTroveId = _sortedTroves.getNext(currentTroveId);
        }

        _troves = new CombinedTroveData[](_count);

        for (uint256 idx = 0; idx < _count; ++idx) {
            _getOneTrove(_troveManager, currentTroveId, _troves[idx]);
            currentTroveId = _sortedTroves.getNext(currentTroveId);
        }
    }

    function _getMultipleSortedTrovesFromTail(
        ITroveManager _troveManager,
        ISortedTroves _sortedTroves,
        uint256 _startIdx,
        uint256 _count
    ) internal view returns (CombinedTroveData[] memory _troves) {
        uint256 currentTroveId = _sortedTroves.getLast();

        for (uint256 idx = 0; idx < _startIdx; ++idx) {
            currentTroveId = _sortedTroves.getPrev(currentTroveId);
        }

        _troves = new CombinedTroveData[](_count);

        for (uint256 idx = 0; idx < _count; ++idx) {
            _getOneTrove(_troveManager, currentTroveId, _troves[idx]);
            currentTroveId = _sortedTroves.getPrev(currentTroveId);
        }
    }

    function getDebtPerInterestRateAscending(uint256 _collIndex, uint256 _startId, uint256 _maxIterations)
        external
        view
        returns (DebtPerInterestRate[] memory data, uint256 currId)
    {
        ITroveManager troveManager = collateralRegistry.allTroveManagerAddresses(_collIndex);
        require(address(troveManager) != address(0), "Invalid collateral index");

        ISortedTroves sortedTroves = troveManager.sortedTroves();
        assert(address(sortedTroves) != address(0));

        data = new DebtPerInterestRate[](_maxIterations);
        currId = _startId == 0 ? sortedTroves.getLast() : _startId;

        for (uint256 i = 0; i < _maxIterations; ++i) {
            if (currId == 0) break;

            (, uint256 prevId, BatchId interestBatchManager,) = sortedTroves.nodes(currId);
            LatestTroveData memory trove = troveManager.getLatestTroveData(currId);
            data[i].interestBatchManager = BatchId.unwrap(interestBatchManager);
            data[i].interestRate = trove.annualInterestRate;
            data[i].debt = trove.entireDebt;

            currId = prevId;
        }
    }
}
