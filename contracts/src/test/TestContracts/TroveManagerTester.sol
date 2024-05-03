// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../TroveManager.sol";

/* Tester contract inherits from TroveManager, and provides external functions 
for testing the parent's internal functions. */

contract TroveManagerTester is TroveManager {
    function computeICR(uint256 _coll, uint256 _debt, uint256 _price) external pure returns (uint256) {
        return LiquityMath._computeCR(_coll, _debt, _price);
    }

    function getCollGasCompensation(uint256 _coll) external pure returns (uint256) {
        return _getCollGasCompensation(_coll);
    }

    function getBoldGasCompensation() external pure returns (uint256) {
        return BOLD_GAS_COMPENSATION;
    }

    function getCompositeDebt(uint256 _debt) external pure returns (uint256) {
        return _getCompositeDebt(_debt);
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

    function getActualDebtFromComposite(uint256 _debtVal) external pure returns (uint256) {
        return _getNetDebt(_debtVal);
    }

    function callInternalRemoveTroveId(uint256 _troveId) external {
        uint256 troveOwnersArrayLength = TroveIds.length;
        _removeTroveId(_troveId, troveOwnersArrayLength);
    }
}
