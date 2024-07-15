// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../Interfaces/ICollateralRegistry.sol";
import "../../TroveManager.sol";
import "./Interfaces/ITroveManagerTester.sol";

/* Tester contract inherits from TroveManager, and provides external functions
for testing the parent's internal functions. */

contract TroveManagerTester is ITroveManagerTester, TroveManager {
    constructor(ConstructorVars memory _vars) TroveManager(_vars) {}

    function get_MCR() external view returns (uint256) {
        return MCR;
    }

    function get_SCR() external view returns (uint256) {
        return SCR;
    }

    function get_LIQUIDATION_PENALTY_SP() external view returns (uint256) {
        return LIQUIDATION_PENALTY_SP;
    }

    function get_LIQUIDATION_PENALTY_REDISTRIBUTION() external view returns (uint256) {
        return LIQUIDATION_PENALTY_REDISTRIBUTION;
    }

    function computeICR(uint256 _coll, uint256 _debt, uint256 _price) external pure returns (uint256) {
        return LiquityMath._computeCR(_coll, _debt, _price);
    }

    function getCollGasCompensation(uint256 _coll) external pure returns (uint256) {
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

    function getTroveStatus(uint256 _troveId) external view override returns (Status) {
        return Troves[_troveId].status;
    }

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

    function getBatchAnnualInterestRate(address _batchAddress) external view returns (uint256) {
        return batches[_batchAddress].annualInterestRate;
    }

    function getBatchLastDebtUpdateTime(address _batchAddress) external view returns (uint256) {
        return batches[_batchAddress].lastDebtUpdateTime;
    }
}
