// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

import {SignedMath} from "openzeppelin/contracts/utils/math/SignedMath.sol";
import {ICollateralRegistry} from "./Interfaces/ICollateralRegistry.sol";
import {IDebtInFrontHelper} from "./Interfaces/IDebtInFrontHelper.sol";
import {IHintHelpers} from "./Interfaces/IHintHelpers.sol";
import {ISortedTroves} from "./Interfaces/ISortedTroves.sol";
import {ITroveManager} from "./Interfaces/ITroveManager.sol";
import {LatestTroveData} from "./Types/LatestTroveData.sol";

/*
 * Helper contract used by the frontend to calculate debt-in-front precisely.
 * Not part of the core Liquity system.
 */
contract DebtInFrontHelper is IDebtInFrontHelper {
    ICollateralRegistry public immutable collateralRegistry;
    IHintHelpers public immutable hintHelpers;

    constructor(ICollateralRegistry _collateralRegistry, IHintHelpers _hintHelpers) {
        collateralRegistry = _collateralRegistry;
        hintHelpers = _hintHelpers;
    }

    function _findHint(
        ITroveManager _troveManager,
        uint256 _collIndex,
        uint256 _interestRateLo,
        uint256 _hintId,
        uint256 _numTrials,
        uint256 _randomSeed
    ) internal view returns (uint256 hintId) {
        uint256 diff = _hintId != 0
            ? SignedMath.abs(int256(_troveManager.getTroveAnnualInterestRate(_hintId)) - int256(_interestRateLo))
            : type(uint256).max;

        (uint256 newHintId, uint256 newDiff,) =
            hintHelpers.getApproxHint(_collIndex, _interestRateLo, _numTrials, _randomSeed);

        return newDiff < diff ? newHintId : _hintId;
    }

    function _getDebtBetween(
        uint256 _collIndex,
        uint256 _interestRateLo, // inclusive
        uint256 _interestRateHi, // exclusive
        uint256 _excludedTroveId,
        bool _stopAfterExludedTrove,
        uint256 _hintId,
        uint256 _numTrials
    ) internal view returns (uint256 debt, uint256 blockTimestamp) {
        ITroveManager troveManager = collateralRegistry.getTroveManager(_collIndex);
        require(address(troveManager) != address(0), "Invalid collateral index");

        ISortedTroves sortedTroves = troveManager.sortedTroves();
        assert(address(sortedTroves) != address(0));

        if (_numTrials > 0) {
            uint256 randomSeed = uint256(
                keccak256(
                    abi.encode(
                        block.timestamp,
                        _collIndex,
                        _interestRateLo,
                        _interestRateHi,
                        _excludedTroveId,
                        _hintId,
                        _numTrials
                    )
                )
            );

            _hintId = _findHint(troveManager, _collIndex, _interestRateLo, _hintId, _numTrials, randomSeed);
        }

        (uint256 currId,) = sortedTroves.findInsertPosition(_interestRateLo, _hintId, _hintId);

        while (currId != 0) {
            LatestTroveData memory trove = troveManager.getLatestTroveData(currId);
            if (trove.annualInterestRate >= _interestRateHi) break;

            if (currId == _excludedTroveId) {
                if (_stopAfterExludedTrove) break;
            } else {
                debt += trove.entireDebt;
            }

            currId = sortedTroves.getPrev(currId);
        }

        blockTimestamp = block.timestamp;
    }

    function getDebtBetweenInterestRates(
        uint256 _collIndex,
        uint256 _interestRateLo, // inclusive
        uint256 _interestRateHi, // exclusive
        uint256 _excludedTroveId,
        uint256 _hintId,
        uint256 _numTrials
    ) external view returns (uint256 debt, uint256 blockTimestamp) {
        return
            _getDebtBetween(_collIndex, _interestRateLo, _interestRateHi, _excludedTroveId, false, _hintId, _numTrials);
    }

    function getDebtBetweenInterestRateAndTrove(
        uint256 _collIndex,
        uint256 _interestRateLo, // inclusive
        uint256 _interestRateHi, // exclusive
        uint256 _troveIdToStopAt, // excluded
        uint256 _hintId,
        uint256 _numTrials
    ) external view returns (uint256 debt, uint256 blockTimestamp) {
        return
            _getDebtBetween(_collIndex, _interestRateLo, _interestRateHi, _troveIdToStopAt, true, _hintId, _numTrials);
    }
}
