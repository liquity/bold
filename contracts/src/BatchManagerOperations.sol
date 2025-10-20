// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/IAddressesRegistry.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IActivePool.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/ITroveNFT.sol";
import "./Interfaces/ISystemParams.sol";
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IBatchManagerOperations.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/LiquityMath.sol";
import "./Dependencies/Constants.sol";
import "./Types/LatestTroveData.sol";
import "./Types/LatestBatchData.sol";

/**
 * @title BatchManagerOperations
 * @notice Handles batch manager operations for BorrowerOperations
 * @dev This contract is extracted to reduce the size of the main BorrowerOperations contract.
 *      It contains the batch management functions. BorrowerOperations delegates calls here.
 */
contract BatchManagerOperations is IBatchManagerOperations {
    IActivePool private immutable activePool;
    IDefaultPool private immutable defaultPool;
    IPriceFeed private immutable priceFeed;
    ITroveManager private immutable troveManager;
    ISortedTroves private immutable sortedTroves;
    ITroveNFT private immutable troveNFT;
    ISystemParams private immutable systemParams;

    constructor(IAddressesRegistry _addressesRegistry, ISystemParams _systemParams) {
        activePool = _addressesRegistry.activePool();
        defaultPool = _addressesRegistry.defaultPool();
        priceFeed = _addressesRegistry.priceFeed();
        troveManager = _addressesRegistry.troveManager();
        sortedTroves = _addressesRegistry.sortedTroves();
        troveNFT = _addressesRegistry.troveNFT();
        systemParams = _systemParams;
    }

    // --- Batch Manager Operations ---

    function registerBatchManager(
        uint128 _minInterestRate,
        uint128 _maxInterestRate,
        uint128 _currentInterestRate,
        uint128 _annualManagementFee,
        uint128 _minInterestRateChangePeriod
    ) external {
        _requireValidAnnualInterestRate(_minInterestRate);
        _requireValidAnnualInterestRate(_maxInterestRate);
        // With the check below, it could only be ==
        _requireOrderedRange(_minInterestRate, _maxInterestRate);
        _requireInterestRateInRange(_currentInterestRate, _minInterestRate, _maxInterestRate);
        if (_annualManagementFee > MAX_ANNUAL_BATCH_MANAGEMENT_FEE) {
            revert AnnualManagementFeeTooHigh();
        }
        if (_minInterestRateChangePeriod < MIN_INTEREST_RATE_CHANGE_PERIOD) {
            revert MinInterestRateChangePeriodTooLow();
        }
    }

    function lowerBatchManagementFee(uint256 _newAnnualManagementFee) external {
        LatestBatchData memory batch = troveManager.getLatestBatchData(msg.sender);
        if (_newAnnualManagementFee >= batch.annualManagementFee) {
            revert NewFeeNotLower();
        }

        // Lower batch fee on TM
        troveManager.onLowerBatchManagerAnnualFee(
            msg.sender,
            batch.entireCollWithoutRedistribution,
            batch.entireDebtWithoutRedistribution,
            _newAnnualManagementFee
        );

        // active pool mint
        TroveChange memory batchChange;
        batchChange.batchAccruedManagementFee = batch.accruedManagementFee;
        batchChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
        batchChange.newWeightedRecordedDebt = batch.entireDebtWithoutRedistribution * batch.annualInterestRate;
        batchChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
        batchChange.newWeightedRecordedBatchManagementFee =
            batch.entireDebtWithoutRedistribution * _newAnnualManagementFee;

        activePool.mintAggInterestAndAccountForTroveChange(batchChange, msg.sender);
    }

    function setBatchManagerAnnualInterestRate(
        uint128 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee,
        uint256 _minInterestRateChangePeriod
    ) external {
        LatestBatchData memory batch = troveManager.getLatestBatchData(msg.sender);
        _requireBatchInterestRateChangePeriodPassed(
            uint256(batch.lastInterestRateAdjTime), _minInterestRateChangePeriod
        );

        uint256 newDebt = batch.entireDebtWithoutRedistribution;

        TroveChange memory batchChange;
        batchChange.batchAccruedManagementFee = batch.accruedManagementFee;
        batchChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
        batchChange.newWeightedRecordedDebt = newDebt * _newAnnualInterestRate;
        batchChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
        batchChange.newWeightedRecordedBatchManagementFee = newDebt * batch.annualManagementFee;

        // Apply upfront fee on premature adjustments
        if (
            batch.annualInterestRate != _newAnnualInterestRate
                && block.timestamp < batch.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN
        ) {
            uint256 price = priceFeed.fetchPrice();

            uint256 avgInterestRate = activePool.getNewApproxAvgInterestRateFromTroveChange(batchChange);
            batchChange.upfrontFee = _calcUpfrontFee(newDebt, avgInterestRate);
            _requireUserAcceptsUpfrontFee(batchChange.upfrontFee, _maxUpfrontFee);

            newDebt += batchChange.upfrontFee;

            // Recalculate the batch's weighted terms, now taking into account the upfront fee
            batchChange.newWeightedRecordedDebt = newDebt * _newAnnualInterestRate;
            batchChange.newWeightedRecordedBatchManagementFee = newDebt * batch.annualManagementFee;

            // Disallow a premature adjustment if it would result in TCR < CCR
            // (which includes the case when TCR is already below CCR before the adjustment).
            uint256 newTCR = _getNewTCRFromTroveChange(batchChange, price);
            _requireNewTCRisAboveCCR(newTCR);
        }

        activePool.mintAggInterestAndAccountForTroveChange(batchChange, msg.sender);

        // Check batch is not empty, and then reinsert in sorted list
        if (!sortedTroves.isEmptyBatch(BatchId.wrap(msg.sender))) {
            sortedTroves.reInsertBatch(BatchId.wrap(msg.sender), _newAnnualInterestRate, _upperHint, _lowerHint);
        }

        troveManager.onSetBatchManagerAnnualInterestRate(
            msg.sender, batch.entireCollWithoutRedistribution, newDebt, _newAnnualInterestRate, batchChange.upfrontFee
        );
    }

    function setInterestBatchManager(
        uint256 _troveId,
        address _newBatchManager,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external {
        LocalVariables_setInterestBatchManager memory vars;
        vars.troveManager = troveManager;
        vars.activePool = activePool;
        vars.sortedTroves = sortedTroves;

        vars.trove = vars.troveManager.getLatestTroveData(_troveId);
        vars.newBatch = vars.troveManager.getLatestBatchData(_newBatchManager);

        TroveChange memory newBatchTroveChange;
        newBatchTroveChange.appliedRedistBoldDebtGain = vars.trove.redistBoldDebtGain;
        newBatchTroveChange.appliedRedistCollGain = vars.trove.redistCollGain;
        newBatchTroveChange.batchAccruedManagementFee = vars.newBatch.accruedManagementFee;
        newBatchTroveChange.oldWeightedRecordedDebt =
            vars.newBatch.weightedRecordedDebt + vars.trove.weightedRecordedDebt;
        newBatchTroveChange.newWeightedRecordedDebt =
            (vars.newBatch.entireDebtWithoutRedistribution + vars.trove.entireDebt) * vars.newBatch.annualInterestRate;

        // An upfront fee is always charged upon joining a batch to ensure that borrowers can not game the fee logic
        // and gain free interest rate updates (e.g. if they also manage the batch they joined)
        // It checks the resulting ICR
        vars.trove.entireDebt =
            _applyUpfrontFee(vars.trove.entireColl, vars.trove.entireDebt, newBatchTroveChange, _maxUpfrontFee, true);

        // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
        newBatchTroveChange.newWeightedRecordedDebt =
            (vars.newBatch.entireDebtWithoutRedistribution + vars.trove.entireDebt) * vars.newBatch.annualInterestRate;

        // Add batch fees
        newBatchTroveChange.oldWeightedRecordedBatchManagementFee = vars.newBatch.weightedRecordedBatchManagementFee;
        newBatchTroveChange.newWeightedRecordedBatchManagementFee =
            (vars.newBatch.entireDebtWithoutRedistribution + vars.trove.entireDebt) * vars.newBatch.annualManagementFee;
        vars.activePool.mintAggInterestAndAccountForTroveChange(newBatchTroveChange, _newBatchManager);

        vars.troveManager.onSetInterestBatchManager(
            ITroveManager.OnSetInterestBatchManagerParams({
                troveId: _troveId,
                troveColl: vars.trove.entireColl,
                troveDebt: vars.trove.entireDebt,
                troveChange: newBatchTroveChange,
                newBatchAddress: _newBatchManager,
                newBatchColl: vars.newBatch.entireCollWithoutRedistribution,
                newBatchDebt: vars.newBatch.entireDebtWithoutRedistribution
            })
        );

        vars.sortedTroves.remove(_troveId);
        vars.sortedTroves.insertIntoBatch(
            _troveId, BatchId.wrap(_newBatchManager), vars.newBatch.annualInterestRate, _upperHint, _lowerHint
        );
    }

    function kickFromBatch(uint256 _troveId, uint256 _upperHint, uint256 _lowerHint) external {
        _removeFromBatchInternal(
            _troveId,
            0, // ignored when kicking
            _upperHint,
            _lowerHint,
            0, // will use the batch's existing interest rate, so no fee
            true
        );
    }

    function removeFromBatch(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external {
        _removeFromBatchInternal(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint, _maxUpfrontFee, false);
    }

    function _removeFromBatchInternal(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee,
        bool _kick
    ) internal {
        LocalVariables_removeFromBatch memory vars;
        vars.troveManager = troveManager;
        vars.sortedTroves = sortedTroves;

        if (_kick) {
            _requireTroveIsOpen(vars.troveManager, _troveId);
        } else {
            _requireTroveIsActive(vars.troveManager, _troveId);
            _requireCallerIsBorrower(_troveId);
            _requireValidAnnualInterestRate(_newAnnualInterestRate);
        }

        vars.batchManager = _requireIsInBatch(_troveId);
        vars.trove = vars.troveManager.getLatestTroveData(_troveId);
        vars.batch = vars.troveManager.getLatestBatchData(vars.batchManager);

        if (_kick) {
            if (vars.batch.totalDebtShares * MAX_BATCH_SHARES_RATIO >= vars.batch.entireDebtWithoutRedistribution) {
                revert BatchSharesRatioTooLow();
            }
            _newAnnualInterestRate = vars.batch.annualInterestRate;
        }

        if (!_checkTroveIsZombie(vars.troveManager, _troveId)) {
            // Remove trove from Batch in SortedTroves
            vars.sortedTroves.removeFromBatch(_troveId);
            // Reinsert as single trove
            vars.sortedTroves.insert(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint);
        }

        vars.batchFutureDebt =
            vars.batch.entireDebtWithoutRedistribution - (vars.trove.entireDebt - vars.trove.redistBoldDebtGain);

        vars.batchChange.appliedRedistBoldDebtGain = vars.trove.redistBoldDebtGain;
        vars.batchChange.appliedRedistCollGain = vars.trove.redistCollGain;
        vars.batchChange.batchAccruedManagementFee = vars.batch.accruedManagementFee;
        vars.batchChange.oldWeightedRecordedDebt = vars.batch.weightedRecordedDebt;
        vars.batchChange.newWeightedRecordedDebt =
            vars.batchFutureDebt * vars.batch.annualInterestRate + vars.trove.entireDebt * _newAnnualInterestRate;

        // Apply upfront fee on premature adjustments. It checks the resulting ICR
        if (
            vars.batch.annualInterestRate != _newAnnualInterestRate
                && block.timestamp < vars.trove.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN
        ) {
            vars.trove.entireDebt =
                _applyUpfrontFee(vars.trove.entireColl, vars.trove.entireDebt, vars.batchChange, _maxUpfrontFee, false);
        }

        // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
        vars.batchChange.newWeightedRecordedDebt =
            vars.batchFutureDebt * vars.batch.annualInterestRate + vars.trove.entireDebt * _newAnnualInterestRate;
        // Add batch fees
        vars.batchChange.oldWeightedRecordedBatchManagementFee = vars.batch.weightedRecordedBatchManagementFee;
        vars.batchChange.newWeightedRecordedBatchManagementFee = vars.batchFutureDebt * vars.batch.annualManagementFee;

        activePool.mintAggInterestAndAccountForTroveChange(vars.batchChange, vars.batchManager);

        vars.troveManager.onRemoveFromBatch(
            _troveId,
            vars.trove.entireColl,
            vars.trove.entireDebt,
            vars.batchChange,
            vars.batchManager,
            vars.batch.entireCollWithoutRedistribution,
            vars.batch.entireDebtWithoutRedistribution,
            _newAnnualInterestRate
        );
    }

    // --- Helper Functions ---

    function _calcUpfrontFee(uint256 _debt, uint256 _avgInterestRate) internal pure returns (uint256) {
        return _calcInterest(_debt * _avgInterestRate, UPFRONT_INTEREST_PERIOD);
    }

    // Duplicated internal function from BorrowerOperations but calls to getEntireBranchColl and getEntireBranchDebt
    // are replaced with their implementations
    function _getNewTCRFromTroveChange(TroveChange memory _troveChange, uint256 _price)
        internal
        view
        returns (uint256 newTCR)
    {
        uint256 activeColl = activePool.getCollBalance();
        uint256 liquidatedColl = defaultPool.getCollBalance();
        uint256 totalColl = activeColl + liquidatedColl + _troveChange.collIncrease - _troveChange.collDecrease;

        uint256 activeDebt = activePool.getBoldDebt();
        uint256 closedDebt = defaultPool.getBoldDebt();
        uint256 totalDebt =
            activeDebt + closedDebt + _troveChange.debtIncrease + _troveChange.upfrontFee - _troveChange.debtDecrease;

        newTCR = LiquityMath._computeCR(totalColl, totalDebt, _price);
    }

    function _applyUpfrontFee(
        uint256 _troveEntireColl,
        uint256 _troveEntireDebt,
        TroveChange memory _troveChange,
        uint256 _maxUpfrontFee,
        bool _isTroveInBatch
    ) internal returns (uint256) {
        uint256 price = priceFeed.fetchPrice();

        uint256 avgInterestRate = activePool.getNewApproxAvgInterestRateFromTroveChange(_troveChange);
        _troveChange.upfrontFee = _calcUpfrontFee(_troveEntireDebt, avgInterestRate);
        _requireUserAcceptsUpfrontFee(_troveChange.upfrontFee, _maxUpfrontFee);

        _troveEntireDebt += _troveChange.upfrontFee;

        // ICR is based on the requested Bold amount + upfront fee.
        uint256 newICR = LiquityMath._computeCR(_troveEntireColl, _troveEntireDebt, price);
        if (_isTroveInBatch) {
            _requireICRisAboveMCRPlusBCR(newICR);
        } else {
            _requireICRisAboveMCR(newICR);
        }

        // Disallow a premature adjustment if it would result in TCR < CCR
        // (which includes the case when TCR is already below CCR before the adjustment).
        uint256 newTCR = _getNewTCRFromTroveChange(_troveChange, price);
        _requireNewTCRisAboveCCR(newTCR);

        return _troveEntireDebt;
    }

    function _checkTroveIsZombie(ITroveManager _troveManager, uint256 _troveId) internal view returns (bool) {
        ITroveManager.Status status = _troveManager.getTroveStatus(_troveId);
        return status == ITroveManager.Status.zombie;
    }

    function _calcInterest(uint256 _weightedDebt, uint256 _period) internal pure returns (uint256) {
        return _weightedDebt * _period / ONE_YEAR / DECIMAL_PRECISION;
    }

    // --- Validation Functions ---

    function _requireValidAnnualInterestRate(uint256 _annualInterestRate) internal view {
        if (_annualInterestRate < systemParams.MIN_ANNUAL_INTEREST_RATE()) {
            revert InterestRateTooLow();
        }
        if (_annualInterestRate > MAX_ANNUAL_INTEREST_RATE) {
            revert InterestRateTooHigh();
        }
    }

    function _requireOrderedRange(uint256 _minInterestRate, uint256 _maxInterestRate) internal pure {
        if (_minInterestRate >= _maxInterestRate) revert MinGeMax();
    }

    function _requireInterestRateInRange(
        uint256 _annualInterestRate,
        uint256 _minInterestRate,
        uint256 _maxInterestRate
    ) internal pure {
        if (_minInterestRate > _annualInterestRate || _annualInterestRate > _maxInterestRate) {
            revert InterestNotInRange();
        }
    }

    function _requireBatchInterestRateChangePeriodPassed(
        uint256 _lastInterestRateAdjTime,
        uint256 _minInterestRateChangePeriod
    ) internal view {
        if (block.timestamp < _lastInterestRateAdjTime + _minInterestRateChangePeriod) {
            revert BatchInterestRateChangePeriodNotPassed();
        }
    }

    function _requireUserAcceptsUpfrontFee(uint256 _fee, uint256 _maxFee) internal pure {
        if (_fee > _maxFee) {
            revert UpfrontFeeTooHigh();
        }
    }

    function _requireNewTCRisAboveCCR(uint256 _newTCR) internal view {
        if (_newTCR < systemParams.CCR()) {
            revert TCRBelowCCR();
        }
    }

    function _requireTroveIsActive(ITroveManager _troveManager, uint256 _troveId) internal view {
        ITroveManager.Status status = _troveManager.getTroveStatus(_troveId);
        if (status != ITroveManager.Status.active) {
            revert TroveNotActive();
        }
    }

    function _requireTroveIsOpen(ITroveManager _troveManager, uint256 _troveId) internal view {
        ITroveManager.Status status = _troveManager.getTroveStatus(_troveId);
        if (status != ITroveManager.Status.active && status != ITroveManager.Status.zombie) {
            revert TroveNotOpen();
        }
    }

    function _requireCallerIsBorrower(uint256 _troveId) internal view {
        if (msg.sender != troveNFT.ownerOf(_troveId)) {
            revert NotBorrower();
        }
    }

    function _requireIsInBatch(uint256 _troveId) internal view returns (address) {
        address batchManager = IBorrowerOperations(address(this)).interestBatchManagerOf(_troveId);
        if (batchManager == address(0)) {
            revert TroveNotInBatch();
        }
        return batchManager;
    }

    function _requireICRisAboveMCR(uint256 _newICR) internal view {
        if (_newICR < systemParams.MCR()) {
            revert ICRBelowMCR();
        }
    }

    function _requireICRisAboveMCRPlusBCR(uint256 _newICR) internal view {
        if (_newICR < systemParams.MCR() + systemParams.BCR()) {
            revert ICRBelowMCRPlusBCR();
        }
    }
}
