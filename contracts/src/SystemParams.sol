// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {ISystemParams} from "./Interfaces/ISystemParams.sol";
import {
    _100pct,
    _1pct,
    MAX_LIQUIDATION_PENALTY_REDISTRIBUTION,
    MAX_ANNUAL_INTEREST_RATE
} from "./Dependencies/Constants.sol";

/**
 * @title System Parameters
 * @author Mento Labs
 * @notice This contract manages the system-wide parameters for the protocol.
 */
contract SystemParams is ISystemParams {
    /* ========== DEBT PARAMETERS ========== */

    uint256 public MIN_DEBT;

    /* ========== LIQUIDATION PARAMETERS ========== */

    uint256 public LIQUIDATION_PENALTY_SP;
    uint256 public LIQUIDATION_PENALTY_REDISTRIBUTION;

    /* ========== GAS COMPENSATION PARAMETERS ========== */

    uint256 public COLL_GAS_COMPENSATION_DIVISOR;
    uint256 public COLL_GAS_COMPENSATION_CAP;
    uint256 public ETH_GAS_COMPENSATION;

    /* ========== COLLATERAL PARAMETERS ========== */

    uint256 public CCR;
    uint256 public SCR;
    uint256 public MCR;
    uint256 public BCR;

    /* ========== INTEREST PARAMETERS ========== */

    uint256 public MIN_ANNUAL_INTEREST_RATE;

    /* ========== REDEMPTION PARAMETERS ========== */

    uint256 public REDEMPTION_FEE_FLOOR;
    uint256 public INITIAL_BASE_RATE;
    uint256 public REDEMPTION_MINUTE_DECAY_FACTOR;
    uint256 public REDEMPTION_BETA;

    /* ========== STABILITY POOL PARAMETERS ========== */

    uint256 public SP_YIELD_SPLIT;
    uint256 public MIN_BOLD_IN_SP;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        DebtParams memory _debtParams,
        LiquidationParams memory _liquidationParams,
        GasCompParams memory _gasCompParams,
        CollateralParams memory _collateralParams,
        InterestParams memory _interestParams,
        RedemptionParams memory _redemptionParams,
        StabilityPoolParams memory _poolParams
    ) {
        // Validate debt parameters
        if (_debtParams.minDebt == 0 || _debtParams.minDebt > 10000e18) revert InvalidMinDebt();

        // Validate liquidation parameters
        // Hardcoded validation bounds: MIN_LIQUIDATION_PENALTY_SP = 5%
        if (_liquidationParams.liquidationPenaltySP < 5 * _1pct)
            revert SPPenaltyTooLow();
        if (_liquidationParams.liquidationPenaltySP > _liquidationParams.liquidationPenaltyRedistribution)
            revert SPPenaltyGtRedist();
        if (_liquidationParams.liquidationPenaltyRedistribution > MAX_LIQUIDATION_PENALTY_REDISTRIBUTION)
            revert RedistPenaltyTooHigh();

        // Validate gas compensation parameters
        if (
            _gasCompParams.collGasCompensationDivisor == 0 ||
            _gasCompParams.collGasCompensationDivisor > 1000
        ) revert InvalidGasCompensation();
        if (_gasCompParams.collGasCompensationCap == 0 || _gasCompParams.collGasCompensationCap > 10 ether)
            revert InvalidGasCompensation();
        if (_gasCompParams.ethGasCompensation == 0 || _gasCompParams.ethGasCompensation > 1 ether)
            revert InvalidGasCompensation();

        // Validate collateral parameters
        if (_collateralParams.ccr <= _100pct || _collateralParams.ccr >= 2 * _100pct) revert InvalidCCR();
        if (_collateralParams.mcr <= _100pct || _collateralParams.mcr >= 2 * _100pct) revert InvalidMCR();
        if (_collateralParams.bcr < 5 * _1pct || _collateralParams.bcr >= 50 * _1pct) revert InvalidBCR();
        if (_collateralParams.scr <= _100pct || _collateralParams.scr >= 2 * _100pct) revert InvalidSCR();

        // Validate interest parameters
        if (_interestParams.minAnnualInterestRate > MAX_ANNUAL_INTEREST_RATE)
            revert MinInterestRateGtMax();

        // Validate redemption parameters
        if (_redemptionParams.redemptionFeeFloor > _100pct) revert InvalidFeeValue();
        if (_redemptionParams.initialBaseRate > 10 * _100pct) revert InvalidFeeValue();

        // Validate stability pool parameters
        if (_poolParams.spYieldSplit > _100pct) revert InvalidFeeValue();
        if (_poolParams.minBoldInSP == 0) revert InvalidMinDebt();

        // Set debt parameters
        MIN_DEBT = _debtParams.minDebt;

        // Set liquidation parameters
        LIQUIDATION_PENALTY_SP = _liquidationParams.liquidationPenaltySP;
        LIQUIDATION_PENALTY_REDISTRIBUTION = _liquidationParams.liquidationPenaltyRedistribution;

        // Set gas compensation parameters
        COLL_GAS_COMPENSATION_DIVISOR = _gasCompParams.collGasCompensationDivisor;
        COLL_GAS_COMPENSATION_CAP = _gasCompParams.collGasCompensationCap;
        ETH_GAS_COMPENSATION = _gasCompParams.ethGasCompensation;

        // Set collateral parameters
        CCR = _collateralParams.ccr;
        SCR = _collateralParams.scr;
        MCR = _collateralParams.mcr;
        BCR = _collateralParams.bcr;

        // Set interest parameters
        MIN_ANNUAL_INTEREST_RATE = _interestParams.minAnnualInterestRate;

        // Set redemption parameters
        REDEMPTION_FEE_FLOOR = _redemptionParams.redemptionFeeFloor;
        INITIAL_BASE_RATE = _redemptionParams.initialBaseRate;
        REDEMPTION_MINUTE_DECAY_FACTOR = _redemptionParams.redemptionMinuteDecayFactor;
        REDEMPTION_BETA = _redemptionParams.redemptionBeta;

        // Set stability pool parameters
        SP_YIELD_SPLIT = _poolParams.spYieldSplit;
        MIN_BOLD_IN_SP = _poolParams.minBoldInSP;
    }
}
