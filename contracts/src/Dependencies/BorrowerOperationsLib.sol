// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "../Types/TroveChange.sol";
import "./LiquityMath.sol";
import "./Constants.sol";

/**
 * @title BorrowerOperationsLib
 * @notice External library containing helper functions for BorrowerOperations
 */
library BorrowerOperationsLib {
    /**
     * @notice Initializes a TroveChange struct with collateral and debt changes
     * @param _troveChange The TroveChange struct to initialize
     * @param _collChange The amount of collateral change
     * @param _isCollIncrease True if collateral is increasing, false if decreasing
     * @param _boldChange The amount of Bold change
     * @param _isDebtIncrease True if debt is increasing, false if decreasing
     */
    function initTroveChange(
        TroveChange memory _troveChange,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease
    ) external pure {
        if (_isCollIncrease) {
            _troveChange.collIncrease = _collChange;
        } else {
            _troveChange.collDecrease = _collChange;
        }

        if (_isDebtIncrease) {
            _troveChange.debtIncrease = _boldChange;
        } else {
            _troveChange.debtDecrease = _boldChange;
        }
    }

    /**
     * @notice Computes the new TCR from a trove change
     * @param _troveChange The trove change to apply
     * @param _price The current price
     * @param _totalColl The current total collateral
     * @param _totalDebt The current total debt
     * @return newTCR The new total collateralization ratio
     */
    function getNewTCRFromTroveChange(
        TroveChange memory _troveChange,
        uint256 _price,
        uint256 _totalColl,
        uint256 _totalDebt
    ) external pure returns (uint256 newTCR) {
        uint256 totalColl = _totalColl;
        totalColl += _troveChange.collIncrease;
        totalColl -= _troveChange.collDecrease;

        uint256 totalDebt = _totalDebt;
        totalDebt += _troveChange.debtIncrease;
        totalDebt += _troveChange.upfrontFee;
        totalDebt -= _troveChange.debtDecrease;

        newTCR = LiquityMath._computeCR(totalColl, totalDebt, _price);
    }

    /**
     * @notice Calculates the upfront fee for a debt amount
     * @param _debt The debt amount
     * @param _avgInterestRate The average interest rate
     * @param _upfrontInterestPeriod The upfront interest period
     * @return The calculated upfront fee
     */
    function calcUpfrontFee(
        uint256 _debt,
        uint256 _avgInterestRate,
        uint256 _upfrontInterestPeriod
    ) external pure returns (uint256) {
        return calcInterest(_debt * _avgInterestRate, _upfrontInterestPeriod);
    }

    /**
     * @notice Calculates interest for a given debt and period
     * @param _weightedDebt The weighted debt
     * @param _period The period in seconds
     * @return The calculated interest
     */
    function calcInterest(
        uint256 _weightedDebt,
        uint256 _period
    ) public pure returns (uint256) {
        return (_weightedDebt * _period) / (DECIMAL_PRECISION * ONE_YEAR);
    }
}
