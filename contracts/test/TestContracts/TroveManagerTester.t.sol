// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "src/Interfaces/IAddressesRegistry.sol";
import "src/Interfaces/ICollateralRegistry.sol";
import "src/TroveManager.sol";
import "./Interfaces/ITroveManagerTester.sol";

/* Tester contract inherits from TroveManager, and provides external functions
for testing the parent's internal functions. */

contract TroveManagerTester is ITroveManagerTester, TroveManager {
    uint256 constant STALE_TROVE_DURATION = 90 days;

    // Extra buffer of collateral ratio to join a batch or adjust a trove inside a batch (on top of MCR)
    uint256 public immutable BCR;

    constructor(IAddressesRegistry _addressesRegistry, uint256 _branchId) TroveManager(_addressesRegistry, _branchId) {
        BCR = _addressesRegistry.BCR();
    }

    // Single liquidation function. Closes the trove if its ICR is lower than the minimum collateral ratio.
    function liquidate(uint256 _troveId) external override {
        uint256[] memory troves = new uint256[](1);
        troves[0] = _troveId;
        batchLiquidateTroves(troves);
    }

    function get_CCR() external view returns (uint256) {
        return CCR();
    }

    function get_MCR() external view returns (uint256) {
        return MCR();
    }

    function get_BCR() external view returns (uint256) {
        return BCR;
    }

    function get_SCR() external view returns (uint256) {
        return SCR();
    }

    function get_LIQUIDATION_PENALTY_SP() external view returns (uint256) {
        return LIQUIDATION_PENALTY_SP;
    }

    function get_LIQUIDATION_PENALTY_REDISTRIBUTION() external view returns (uint256) {
        return LIQUIDATION_PENALTY_REDISTRIBUTION;
    }

    function getBoldToken() external view returns (IBoldToken) {
        return boldToken;
    }

    function getBorrowerOperations() external view returns (IBorrowerOperations) {
        return borrowerOperations;
    }

    function get_L_coll() external view returns (uint256) {
        return L_coll;
    }

    function get_L_boldDebt() external view returns (uint256) {
        return L_boldDebt;
    }

    function getTotalStakes() external view returns (uint256) {
        return totalStakes;
    }

    function getTotalStakesSnapshot() external view returns (uint256) {
        return totalStakesSnapshot;
    }

    function getTotalCollateralSnapshot() external view returns (uint256) {
        return totalCollateralSnapshot;
    }

    function get_lastCollError_Redistribution() external view returns (uint256) {
        return lastCollError_Redistribution;
    }

    function get_lastBoldDebtError_Redistribution() external view returns (uint256) {
        return lastBoldDebtError_Redistribution;
    }

    function getTroveId(uint256 _index) external view returns (uint256) {
        return TroveIds[_index];
    }

    function getTCR(uint256 _price) external view override returns (uint256) {
        return _getTCR(_price);
    }

    function checkBelowCriticalThreshold(uint256 _price) external view override returns (bool) {
        return _checkBelowCriticalThreshold(_price, CCR());
    }

    function computeICR(uint256 _coll, uint256 _debt, uint256 _price) external pure returns (uint256) {
        return LiquityMath._computeCR(_coll, _debt, _price);
    }

    function getCollGasCompensation(uint256 _entireColl, uint256 _entireDebt, uint256 _boldInSPForOffsets)
        external
        view
        returns (uint256)
    {
        uint256 collSubjectToGasCompensation = _entireColl;
        if (_boldInSPForOffsets < _entireDebt) {
            collSubjectToGasCompensation = _entireColl * _boldInSPForOffsets / _entireDebt;
        }
        return _getCollGasCompensation(collSubjectToGasCompensation);
    }

    function getCollGasCompensation(uint256 _coll) external view returns (uint256) {
        return _getCollGasCompensation(_coll);
    }

    function getETHGasCompensation() external pure returns (uint256) {
        return ETH_GAS_COMPENSATION;
    }

    /*
    function unprotectedDecayBaseRateFromBorrowing() external returns (uint256) {
        baseRate = _calcDecayedBaseRate();
        assert(baseRate >= 0 && baseRate <= DECIMAL_PRECISION);

        _updateLastFeeOpTime();
        return baseRate;
    }

    function minutesPassedSinceLastFeeOp() external view returns (uint256) {
        return _minutesPassedSinceLastFeeOp();
    }

    function setLastFeeOpTimeToNow() external {
        lastFeeOperationTime = block.timestamp;
    }

    function setBaseRate(uint256 _baseRate) external {
        baseRate = _baseRate;
    }

    function callGetRedemptionFee(uint256 _ETHDrawn) external view returns (uint256) {
        return _getRedemptionFee(_ETHDrawn);
    }
    */

    function predictOpenTroveUpfrontFee(uint256 borrowedAmount, uint256 interestRate) external view returns (uint256) {
        TroveChange memory openTrove;
        openTrove.debtIncrease = borrowedAmount;
        openTrove.newWeightedRecordedDebt = openTrove.debtIncrease * interestRate;

        uint256 avgInterestRate = activePool.getNewApproxAvgInterestRateFromTroveChange(openTrove);
        return _calcUpfrontFee(openTrove.debtIncrease, avgInterestRate);
    }

    function _calcUpfrontFee(uint256 _debt, uint256 _avgInterestRate) internal pure returns (uint256) {
        return _calcInterest(_debt * _avgInterestRate, UPFRONT_INTEREST_PERIOD);
    }

    function getEffectiveRedemptionFeeInColl(uint256 _redeemAmount, uint256 _price) external view returns (uint256) {
        return collateralRegistry.getEffectiveRedemptionFeeInBold(_redeemAmount) * DECIMAL_PRECISION / _price;
    }

    function callInternalRemoveTroveId(uint256 _troveId) external {
        uint256 troveOwnersArrayLength = TroveIds.length;
        _removeTroveId(_troveId, troveOwnersArrayLength);
    }

    function ownerOf(uint256 _troveId) external view returns (address) {
        return troveNFT.ownerOf(_troveId);
    }

    function balanceOf(address _account) external view returns (uint256) {
        return troveNFT.balanceOf(_account);
    }

    // Trove and batch getters

    function checkTroveIsOpen(uint256 _troveId) public view returns (bool) {
        Status status = Troves[_troveId].status;
        return status == Status.active || status == Status.zombie;
    }

    function checkTroveIsActive(uint256 _troveId) external view returns (bool) {
        Status status = Troves[_troveId].status;
        return status == Status.active;
    }

    function checkTroveIsZombie(uint256 _troveId) external view returns (bool) {
        Status status = Troves[_troveId].status;
        return status == Status.zombie;
    }

    function hasRedistributionGains(uint256 _troveId) external view override returns (bool) {
        /*
         * A Trove has redistribution gains if its snapshot is less than the current rewards per-unit-staked sum:
         * this indicates that rewards have occured since the snapshot was made, and the user therefore has
         * redistribution gains
         */
        if (!checkTroveIsOpen(_troveId)) return false;

        return (rewardSnapshots[_troveId].coll < L_coll);
    }

    // Get the borrower's pending accumulated Coll reward, earned by their stake
    function getPendingCollReward(uint256 _troveId) external view override returns (uint256 redistCollGain) {
        LatestTroveData memory trove;
        _getLatestTroveData(_troveId, trove);
        return trove.redistCollGain;
    }

    // Get the borrower's pending accumulated Bold reward, earned by their stake
    function getPendingBoldDebtReward(uint256 _troveId) external view override returns (uint256 redistBoldDebtGain) {
        LatestTroveData memory trove;
        _getLatestTroveData(_troveId, trove);
        return trove.redistBoldDebtGain;
    }

    function getEntireDebtAndColl(uint256 _troveId)
        external
        view
        returns (
            uint256 entireDebt,
            uint256 entireColl,
            uint256 pendingBoldDebtReward,
            uint256 pendingCollReward,
            uint256 accruedTroveInterest
        )
    {
        LatestTroveData memory trove;
        _getLatestTroveData(_troveId, trove);

        return
            (trove.entireDebt, trove.entireColl, trove.redistBoldDebtGain, trove.redistCollGain, trove.accruedInterest);
    }

    function getTroveEntireDebt(uint256 _troveId) external view returns (uint256) {
        LatestTroveData memory trove;
        _getLatestTroveData(_troveId, trove);
        return trove.entireDebt;
    }

    function getTroveEntireColl(uint256 _troveId) external view returns (uint256) {
        LatestTroveData memory trove;
        _getLatestTroveData(_troveId, trove);
        return trove.entireColl;
    }

    /*
    function getTroveStatus(uint256 _troveId) external view override returns (Status) {
        return Troves[_troveId].status;
    }
    */

    function getTroveStake(uint256 _troveId) external view override returns (uint256) {
        return Troves[_troveId].stake;
    }

    function getTroveDebt(uint256 _troveId) external view override returns (uint256) {
        Trove memory trove = Troves[_troveId];
        address batchAddress = _getBatchManager(trove);
        if (batchAddress != address(0)) {
            Batch memory batch = batches[batchAddress];
            if (batch.totalDebtShares == 0) return 0;
            return batch.debt * trove.batchDebtShares / batch.totalDebtShares;
        }
        return trove.debt;
    }

    function getTroveWeightedRecordedDebt(uint256 _troveId) external view returns (uint256) {
        Trove memory trove = Troves[_troveId];
        address batchAddress = _getBatchManager(trove);
        if (batchAddress != address(0)) {
            Batch memory batch = batches[batchAddress];
            if (batch.totalDebtShares == 0) return 0;
            return batch.debt * trove.batchDebtShares / batch.totalDebtShares * batch.annualInterestRate;
        }
        return trove.debt * trove.annualInterestRate;
    }

    function getTroveColl(uint256 _troveId) external view override returns (uint256) {
        Trove memory trove = Troves[_troveId];
        return trove.coll;
    }

    function getTroveLastDebtUpdateTime(uint256 _troveId) external view returns (uint256) {
        Trove memory trove = Troves[_troveId];
        address batchAddress = _getBatchManager(trove);
        if (batchAddress != address(0)) {
            return batches[batchAddress].lastDebtUpdateTime;
        }
        return trove.lastDebtUpdateTime;
    }

    function troveIsStale(uint256 _troveId) external view returns (bool) {
        Trove memory trove = Troves[_troveId];
        address batchAddress = _getBatchManager(trove);
        if (batchAddress != address(0)) {
            return block.timestamp - batches[batchAddress].lastDebtUpdateTime > STALE_TROVE_DURATION;
        }
        return block.timestamp - trove.lastDebtUpdateTime > STALE_TROVE_DURATION;
    }

    // TODO: analyze precision loss in interest functions and decide upon the minimum granularity
    // (per-second, per-block, etc)
    function calcTroveAccruedInterest(uint256 _troveId) external view returns (uint256) {
        Trove memory trove = Troves[_troveId];

        // If trove belongs to a batch, we fetch the batch and apply its share to obtained values
        address batchAddress = _getBatchManager(_troveId);
        if (batchAddress != address(0)) {
            uint256 batchAccruedInterest = calcBatchAccruedInterest(batchAddress);
            return batchAccruedInterest * trove.batchDebtShares / batches[batchAddress].totalDebtShares;
        }

        uint256 recordedDebt = trove.debt;
        // convert annual interest to per-second and multiply by the principal
        uint256 annualInterestRate = trove.annualInterestRate;

        uint256 period = _getInterestPeriod(trove.lastDebtUpdateTime);

        return _calcInterest(recordedDebt * annualInterestRate, period);
    }

    function calcBatchAccruedInterest(address _batchAddress) public view returns (uint256) {
        Batch memory batch = batches[_batchAddress];
        uint256 recordedDebt = batch.debt;
        // convert annual interest to per-second and multiply by the principal
        uint256 annualInterestRate = batch.annualInterestRate;

        uint256 period = _getInterestPeriod(batch.lastDebtUpdateTime);

        return _calcInterest(recordedDebt * annualInterestRate, period);
    }

    function calcTroveAccruedBatchManagementFee(uint256 _troveId) external view returns (uint256) {
        Trove memory trove = Troves[_troveId];

        // If trove doesn’t belong to a batch, there’s no fee
        address batchAddress = _getBatchManager(_troveId);
        if (batchAddress == address(0)) return 0;

        // If trove belongs to a batch, we fetch the batch and apply its share to obtained values
        Batch memory batch = batches[batchAddress];
        if (batch.totalDebtShares == 0) return 0;
        uint256 batchAccruedManagementFee = calcBatchAccruedManagementFee(batchAddress);
        return batchAccruedManagementFee * trove.batchDebtShares / batch.totalDebtShares;
    }

    function calcBatchAccruedManagementFee(address _batchAddress) public view returns (uint256) {
        Batch memory batch = batches[_batchAddress];
        // convert annual interest to per-second and multiply by the principal
        return _calcInterest(batch.debt * batch.annualManagementFee, block.timestamp - batch.lastDebtUpdateTime);
    }

    function getBatchAnnualInterestRate(address _batchAddress) external view returns (uint256) {
        return batches[_batchAddress].annualInterestRate;
    }

    function getBatchLastDebtUpdateTime(address _batchAddress) external view returns (uint256) {
        return batches[_batchAddress].lastDebtUpdateTime;
    }

    function getBatch(address _batchAddress)
        external
        view
        returns (
            uint256 debt,
            uint256 coll,
            uint64 arrayIndex,
            uint64 lastDebtUpdateTime,
            uint64 lastInterestRateAdjTime,
            uint256 annualInterestRate,
            uint256 annualManagementFee,
            uint256 totalDebtShares
        )
    {
        Batch memory batch = batches[_batchAddress];

        return (
            batch.debt,
            batch.coll,
            batch.arrayIndex,
            batch.lastDebtUpdateTime,
            batch.lastInterestRateAdjTime,
            batch.annualInterestRate,
            batch.annualManagementFee,
            batch.totalDebtShares
        );
    }
}
