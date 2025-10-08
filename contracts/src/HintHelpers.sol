// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "./Interfaces/ICollateralRegistry.sol";
import "./Interfaces/IActivePool.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/ISystemParams.sol";
import "./Dependencies/LiquityMath.sol";
import "./Dependencies/Constants.sol";
import "./Interfaces/IHintHelpers.sol";
import "./Types/LatestTroveData.sol";
import "./Types/TroveChange.sol";
import "./Types/LatestBatchData.sol";

contract HintHelpers is IHintHelpers {
    string public constant NAME = "HintHelpers";

    ICollateralRegistry public immutable collateralRegistry;
    address public immutable systemParamsAddress;

    constructor(ICollateralRegistry _collateralRegistry, ISystemParams _systemParams) {
        systemParamsAddress = address(_systemParams);
        collateralRegistry = _collateralRegistry;
    }

    /* getApproxHint() - return id of a Trove that is, on average, (length / numTrials) positions away in the
    sortedTroves list from the correct insert position of the Trove to be inserted. 
    
    Note: The output id is worst-case O(n) positions away from the correct insert position, however, the function
    is probabilistic. Input can be tuned to guarantee results to a high degree of confidence, e.g:

    Submitting numTrials = k * sqrt(length), with k = 15 makes it very, very likely that the ouput id will
    be <= sqrt(length) positions away from the correct insert position.
    */
    function getApproxHint(uint256 _collIndex, uint256 _interestRate, uint256 _numTrials, uint256 _inputRandomSeed)
        external
        view
        returns (uint256 hintId, uint256 diff, uint256 latestRandomSeed)
    {
        ITroveManager troveManager = collateralRegistry.getTroveManager(_collIndex);
        ISortedTroves sortedTroves = troveManager.sortedTroves();

        uint256 arrayLength = troveManager.getTroveIdsCount();

        if (arrayLength == 0) {
            return (0, 0, _inputRandomSeed);
        }

        hintId = sortedTroves.getLast();
        diff = LiquityMath._getAbsoluteDifference(_interestRate, troveManager.getTroveAnnualInterestRate(hintId));
        latestRandomSeed = _inputRandomSeed;

        for (uint256 i = 1; i < _numTrials; ++i) {
            latestRandomSeed = uint256(keccak256(abi.encodePacked(latestRandomSeed)));

            uint256 arrayIndex = latestRandomSeed % arrayLength;
            uint256 currentId = troveManager.getTroveFromTroveIdsArray(arrayIndex);

            // Skip this Trove if it's zombie and not in the sorted list
            if (!sortedTroves.contains(currentId)) continue;

            uint256 currentInterestRate = troveManager.getTroveAnnualInterestRate(currentId);

            // check if abs(current - IR) > abs(closest - IR), and update closest if current is closer
            uint256 currentDiff = LiquityMath._getAbsoluteDifference(currentInterestRate, _interestRate);

            if (currentDiff < diff) {
                diff = currentDiff;
                hintId = currentId;
            }
        }
    }

    function _calcUpfrontFee(uint256 _debt, uint256 _avgInterestRate) internal view returns (uint256) {
        return _debt * _avgInterestRate * UPFRONT_INTEREST_PERIOD / ONE_YEAR / DECIMAL_PRECISION;
    }

    function predictOpenTroveUpfrontFee(uint256 _collIndex, uint256 _borrowedAmount, uint256 _interestRate)
        external
        view
        returns (uint256)
    {
        ITroveManager troveManager = collateralRegistry.getTroveManager(_collIndex);
        IActivePool activePool = troveManager.activePool();

        TroveChange memory openTrove;
        openTrove.debtIncrease = _borrowedAmount;
        openTrove.newWeightedRecordedDebt = openTrove.debtIncrease * _interestRate;

        uint256 avgInterestRate = activePool.getNewApproxAvgInterestRateFromTroveChange(openTrove);
        return _calcUpfrontFee(openTrove.debtIncrease, avgInterestRate);
    }

    function predictAdjustInterestRateUpfrontFee(uint256 _collIndex, uint256 _troveId, uint256 _newInterestRate)
        external
        view
        returns (uint256)
    {
        ITroveManager troveManager = collateralRegistry.getTroveManager(_collIndex);
        IActivePool activePool = troveManager.activePool();
        LatestTroveData memory trove = troveManager.getLatestTroveData(_troveId);

        if (
            _newInterestRate == trove.annualInterestRate
                || block.timestamp >= trove.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN
        ) {
            return 0;
        }

        return _predictAdjustInterestRateUpfrontFee(activePool, trove, _newInterestRate);
    }

    function forcePredictAdjustInterestRateUpfrontFee(uint256 _collIndex, uint256 _troveId, uint256 _newInterestRate)
        external
        view
        returns (uint256)
    {
        ITroveManager troveManager = collateralRegistry.getTroveManager(_collIndex);
        IActivePool activePool = troveManager.activePool();
        LatestTroveData memory trove = troveManager.getLatestTroveData(_troveId);

        return _predictAdjustInterestRateUpfrontFee(activePool, trove, _newInterestRate);
    }

    function _predictAdjustInterestRateUpfrontFee(
        IActivePool _activePool,
        LatestTroveData memory _trove,
        uint256 _newInterestRate
    ) internal view returns (uint256) {
        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = _trove.redistBoldDebtGain;
        troveChange.newWeightedRecordedDebt = _trove.entireDebt * _newInterestRate;
        troveChange.oldWeightedRecordedDebt = _trove.weightedRecordedDebt;

        uint256 avgInterestRate = _activePool.getNewApproxAvgInterestRateFromTroveChange(troveChange);
        return _calcUpfrontFee(_trove.entireDebt, avgInterestRate);
    }

    function predictAdjustTroveUpfrontFee(uint256 _collIndex, uint256 _troveId, uint256 _debtIncrease)
        external
        view
        returns (uint256)
    {
        if (_debtIncrease == 0) return 0;

        ITroveManager troveManager = collateralRegistry.getTroveManager(_collIndex);
        IActivePool activePool = troveManager.activePool();
        LatestTroveData memory trove = troveManager.getLatestTroveData(_troveId);
        (,,,,,,,, address batchManager,) = troveManager.Troves(_troveId);

        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        troveChange.debtIncrease = _debtIncrease;

        if (batchManager == address(0)) {
            troveChange.newWeightedRecordedDebt = (trove.entireDebt + _debtIncrease) * trove.annualInterestRate;
            troveChange.oldWeightedRecordedDebt = trove.weightedRecordedDebt;
        } else {
            LatestBatchData memory batch = troveManager.getLatestBatchData(batchManager);
            troveChange.batchAccruedManagementFee = batch.accruedManagementFee;
            troveChange.newWeightedRecordedDebt = (
                batch.entireDebtWithoutRedistribution + trove.redistBoldDebtGain + _debtIncrease
            ) * batch.annualInterestRate;
            troveChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
        }

        uint256 avgInterestRate = activePool.getNewApproxAvgInterestRateFromTroveChange(troveChange);
        return _calcUpfrontFee(_debtIncrease, avgInterestRate);
    }

    function predictAdjustBatchInterestRateUpfrontFee(
        uint256 _collIndex,
        address _batchAddress,
        uint256 _newInterestRate
    ) external view returns (uint256) {
        ITroveManager troveManager = collateralRegistry.getTroveManager(_collIndex);
        IActivePool activePool = troveManager.activePool();
        LatestBatchData memory batch = troveManager.getLatestBatchData(_batchAddress);

        if (
            _newInterestRate == batch.annualInterestRate
                || block.timestamp >= batch.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN
        ) {
            return 0;
        }

        TroveChange memory troveChange;
        troveChange.batchAccruedManagementFee = batch.accruedManagementFee;
        troveChange.newWeightedRecordedDebt = batch.entireDebtWithoutRedistribution * _newInterestRate;
        troveChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;

        uint256 avgInterestRate = activePool.getNewApproxAvgInterestRateFromTroveChange(troveChange);
        return _calcUpfrontFee(batch.entireDebtWithoutRedistribution, avgInterestRate);
    }

    function predictOpenTroveAndJoinBatchUpfrontFee(uint256 _collIndex, uint256 _borrowedAmount, address _batchAddress)
        external
        view
        returns (uint256)
    {
        ITroveManager troveManager = collateralRegistry.getTroveManager(_collIndex);
        IActivePool activePool = troveManager.activePool();
        LatestBatchData memory batch = troveManager.getLatestBatchData(_batchAddress);

        TroveChange memory openTrove;
        openTrove.debtIncrease = _borrowedAmount;
        openTrove.batchAccruedManagementFee = batch.accruedManagementFee;
        openTrove.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
        openTrove.newWeightedRecordedDebt =
            (batch.entireDebtWithoutRedistribution + _borrowedAmount) * batch.annualInterestRate;

        uint256 avgInterestRate = activePool.getNewApproxAvgInterestRateFromTroveChange(openTrove);
        return _calcUpfrontFee(_borrowedAmount, avgInterestRate);
    }

    function predictJoinBatchInterestRateUpfrontFee(uint256 _collIndex, uint256 _troveId, address _batchAddress)
        external
        view
        returns (uint256)
    {
        ITroveManager troveManager = collateralRegistry.getTroveManager(_collIndex);
        IActivePool activePool = troveManager.activePool();
        LatestTroveData memory trove = troveManager.getLatestTroveData(_troveId);
        LatestBatchData memory batch = troveManager.getLatestBatchData(_batchAddress);

        TroveChange memory newBatchTroveChange;
        newBatchTroveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        newBatchTroveChange.batchAccruedManagementFee = batch.accruedManagementFee;
        newBatchTroveChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt + trove.weightedRecordedDebt;
        newBatchTroveChange.newWeightedRecordedDebt =
            (batch.entireDebtWithoutRedistribution + trove.entireDebt) * batch.annualInterestRate;

        uint256 avgInterestRate = activePool.getNewApproxAvgInterestRateFromTroveChange(newBatchTroveChange);
        return _calcUpfrontFee(trove.entireDebt, avgInterestRate);
    }

    function predictRemoveFromBatchUpfrontFee(uint256 _collIndex, uint256 _troveId, uint256 _newInterestRate)
        external
        view
        returns (uint256)
    {
        ITroveManager troveManager = collateralRegistry.getTroveManager(_collIndex);
        IActivePool activePool = troveManager.activePool();
        LatestTroveData memory trove = troveManager.getLatestTroveData(_troveId);
        (,,,,,,,, address batchManager,) = troveManager.Troves(_troveId);
        LatestBatchData memory batch = troveManager.getLatestBatchData(batchManager);

        if (
            _newInterestRate == batch.annualInterestRate
                || block.timestamp >= trove.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN
        ) {
            return 0;
        }

        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        troveChange.batchAccruedManagementFee = batch.accruedManagementFee;
        troveChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
        troveChange.newWeightedRecordedDebt = (
            batch.entireDebtWithoutRedistribution - (trove.entireDebt - trove.redistBoldDebtGain)
        ) * batch.annualInterestRate + trove.entireDebt * _newInterestRate;

        uint256 avgInterestRate = activePool.getNewApproxAvgInterestRateFromTroveChange(troveChange);
        return _calcUpfrontFee(trove.entireDebt, avgInterestRate);
    }
}
