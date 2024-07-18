// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../Interfaces/ICollateralRegistry.sol";
import "../../TroveManager.sol";
import "./Interfaces/ITroveManagerTester.sol";

/* Tester contract inherits from TroveManager, and provides external functions
for testing the parent's internal functions. */

contract TroveManagerTester is ITroveManagerTester, TroveManager {
    constructor(
        uint256 _mcr,
        uint256 _scr,
        uint256 _liquidationPenaltySP,
        uint256 _liquidationPenaltyRedistribution,
        IWETH _weth
    ) TroveManager(_mcr, _scr, _liquidationPenaltySP, _liquidationPenaltyRedistribution, _weth) {}

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
        return ICollateralRegistry(collateralRegistryAddress).getEffectiveRedemptionFeeInBold(_redeemAmount)
            * DECIMAL_PRECISION / _price;
    }

    function callInternalRemoveTroveId(uint256 _troveId) external {
        uint256 troveOwnersArrayLength = TroveIds.length;
        _removeTroveId(_troveId, troveOwnersArrayLength);
    }
}
