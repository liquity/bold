// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.18;

import "./Interfaces/ICollateralRegistry.sol";
import "./Interfaces/IMultiTroveGetter.sol";

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
        ITroveManager troveManager = collateralRegistry.troveManagers(_collIndex);
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

        (
            _out.debt,
            _out.coll,
            _out.stake,
            , // status
            , // arrayIndex
            _out.annualInterestRate,
            _out.lastDebtUpdateTime,
            _out.lastInterestRateAdjTime,
            _out.interestBatchManager,
            //_out.batchDebtShares,
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
}
