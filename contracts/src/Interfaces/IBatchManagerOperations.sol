// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ISortedTroves.sol";
import "./ITroveManager.sol";

interface IBatchManagerOperations {
    error IsShutDown();
    error InterestNotInRange();
    error BatchInterestRateChangePeriodNotPassed();
    error InvalidInterestBatchManager();
    error BatchManagerExists();
    error NewFeeNotLower();
    error AnnualManagementFeeTooHigh();
    error MinInterestRateChangePeriodTooLow();
    error MinGeMax();
    error NotBorrower();
    error TroveNotActive();
    error TroveNotInBatch();
    error TroveNotOpen();
    error ICRBelowMCRPlusBCR();
    error TCRBelowCCR();
    error ICRBelowMCR();
    error UpfrontFeeTooHigh();
    error InterestRateTooLow();
    error InterestRateTooHigh();
    error BatchSharesRatioTooLow();

    struct LocalVariables_setInterestBatchManager {
        ITroveManager troveManager;
        IActivePool activePool;
        ISortedTroves sortedTroves;
        LatestTroveData trove;
        LatestBatchData newBatch;
    }

    struct LocalVariables_removeFromBatch {
        ITroveManager troveManager;
        ISortedTroves sortedTroves;
        address batchManager;
        LatestTroveData trove;
        LatestBatchData batch;
        uint256 batchFutureDebt;
        TroveChange batchChange;
    }

    function registerBatchManager(
        uint128 _minInterestRate,
        uint128 _maxInterestRate,
        uint128 _currentInterestRate,
        uint128 _annualManagementFee,
        uint128 _minInterestRateChangePeriod
    ) external;

    function lowerBatchManagementFee(uint256 _newAnnualManagementFee) external;

    function setBatchManagerAnnualInterestRate(
        uint128 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee,
        uint256 _minInterestRateChangePeriod
    ) external;

    function setInterestBatchManager(
        uint256 _troveId,
        address _newBatchManager,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external;

    function kickFromBatch(uint256 _troveId, uint256 _upperHint, uint256 _lowerHint) external;

    function removeFromBatch(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external;
}
