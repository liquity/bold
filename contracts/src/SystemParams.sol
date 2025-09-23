// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {OwnableUpgradeable} from "openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {Initializable} from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";

import {ISystemParams} from "./Interfaces/ISystemParams.sol";
import {_100pct, _1pct} from "./Dependencies/Constants.sol";

/**
 * @title System Parameters
 * @author Mento Labs
 * @notice This contract manages the system-wide parameters for the protocol.
 */
contract SystemParams is Initializable, OwnableUpgradeable, ISystemParams {
    uint256 public version;

    /* ========== DEBT PARAMETERS ========== */

    uint256 public MIN_DEBT;

    /* ========== LIQUIDATION PARAMETERS ========== */

    uint256 public MIN_LIQUIDATION_PENALTY_SP;
    uint256 public MAX_LIQUIDATION_PENALTY_REDISTRIBUTION;
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
    uint256 public MAX_ANNUAL_INTEREST_RATE;
    uint128 public MAX_ANNUAL_BATCH_MANAGEMENT_FEE;
    uint256 public UPFRONT_INTEREST_PERIOD;
    uint256 public INTEREST_RATE_ADJ_COOLDOWN;
    uint128 public MIN_INTEREST_RATE_CHANGE_PERIOD;
    uint256 public MAX_BATCH_SHARES_RATIO;

    /* ========== REDEMPTION PARAMETERS ========== */

    uint256 public REDEMPTION_FEE_FLOOR;
    uint256 public INITIAL_BASE_RATE;
    uint256 public REDEMPTION_MINUTE_DECAY_FACTOR;
    uint256 public REDEMPTION_BETA;
    uint256 public URGENT_REDEMPTION_BONUS;

    /* ========== STABILITY POOL PARAMETERS ========== */

    uint256 public SP_YIELD_SPLIT;
    uint256 public MIN_BOLD_IN_SP;

    /* ========== CONSTRUCTOR ========== */

    /**
     * @notice Contract constructor
     * @param disable Boolean to disable initializers for implementation contract
     */
    constructor(bool disable) {
        if (disable) {
            _disableInitializers();
        }
    }

    /* ========== INITIALIZATION ========== */

    function initialize(address owner_) public initializer {
        __Ownable_init();
        transferOwnership(owner_);

        // Debt parameters
        MIN_DEBT = 2000e18;

        // Liquidation parameters
        MIN_LIQUIDATION_PENALTY_SP = 5 * _1pct; // 5%
        MAX_LIQUIDATION_PENALTY_REDISTRIBUTION = 20 * _1pct; // 20%
        LIQUIDATION_PENALTY_SP = 5e16; // 5%
        LIQUIDATION_PENALTY_REDISTRIBUTION = 10e16; // 10%

        // Gas compensation parameters
        COLL_GAS_COMPENSATION_DIVISOR = 200; // dividing by 200 yields 0.5%
        COLL_GAS_COMPENSATION_CAP = 2 ether; // Max coll gas compensation capped at 2 ETH
        ETH_GAS_COMPENSATION = 0.0375 ether;

        // Collateral parameters
        CCR = 150 * _1pct; // 150%
        SCR = 110 * _1pct; // 110%
        MCR = 110 * _1pct; // 110%
        BCR = 40 * _1pct; // 40%

        // Interest parameters
        MIN_ANNUAL_INTEREST_RATE = _1pct / 2; // 0.5%
        MAX_ANNUAL_INTEREST_RATE = 250 * _1pct; // 250%
        MAX_ANNUAL_BATCH_MANAGEMENT_FEE = uint128(_100pct / 10); // 10%
        UPFRONT_INTEREST_PERIOD = 7 days;
        INTEREST_RATE_ADJ_COOLDOWN = 7 days;
        MIN_INTEREST_RATE_CHANGE_PERIOD = 1 hours; // only applies to batch managers / batched Troves
        MAX_BATCH_SHARES_RATIO = 1e9;

        // Redemption parameters
        REDEMPTION_FEE_FLOOR = _1pct / 2; // 0.5%
        INITIAL_BASE_RATE = _100pct; // 100% initial redemption rate

        // Half-life of 6h. 6h = 360 min
        // (1/2) = d^360 => d = (1/2)^(1/360)
        REDEMPTION_MINUTE_DECAY_FACTOR = 998076443575628800;
        REDEMPTION_BETA = 1;
        URGENT_REDEMPTION_BONUS = 2 * _1pct; // 2%

        // Stability pool parameters
        SP_YIELD_SPLIT = 75 * _1pct; // 75%
        MIN_BOLD_IN_SP = 1e18;

        version = 1;
        emit VersionUpdated(0, 1);
    }

    /* ========== ADMIN FUNCTIONS ========== */

    /// @inheritdoc ISystemParams
    function updateMinDebt(uint256 _minDebt) external onlyOwner {
        if (_minDebt == 0 || _minDebt > 10000e18) revert InvalidMinDebt();

        uint256 oldMinDebt = MIN_DEBT;
        MIN_DEBT = _minDebt;

        emit MinDebtUpdated(oldMinDebt, _minDebt);
    }

    /// @inheritdoc ISystemParams
    function updateLiquidationParams(
        uint256 _minLiquidationPenaltySP,
        uint256 _maxLiquidationPenaltyRedistribution,
        uint256 _liquidationPenaltySP,
        uint256 _liquidationPenaltyRedistribution
    ) external onlyOwner {
        // TODO: Review checks.
        if (_liquidationPenaltySP < _minLiquidationPenaltySP)
            revert SPPenaltyTooLow();
        if (_liquidationPenaltySP > _liquidationPenaltyRedistribution)
            revert SPPenaltyGtRedist();
        if (
            _liquidationPenaltyRedistribution >
            _maxLiquidationPenaltyRedistribution
        ) revert RedistPenaltyTooHigh();

        MIN_LIQUIDATION_PENALTY_SP = _minLiquidationPenaltySP;
        MAX_LIQUIDATION_PENALTY_REDISTRIBUTION = _maxLiquidationPenaltyRedistribution;
        LIQUIDATION_PENALTY_SP = _liquidationPenaltySP;
        LIQUIDATION_PENALTY_REDISTRIBUTION = _liquidationPenaltyRedistribution;

        emit LiquidationParamsUpdated(
            _minLiquidationPenaltySP,
            _maxLiquidationPenaltyRedistribution,
            _liquidationPenaltySP,
            _liquidationPenaltyRedistribution
        );
    }

    /// @inheritdoc ISystemParams
    function updateGasCompParams(
        uint256 _collGasCompensationDivisor,
        uint256 _collGasCompensationCap,
        uint256 _ethGasCompensation
    ) external onlyOwner {
        if (
            _collGasCompensationDivisor == 0 ||
            _collGasCompensationDivisor > 1000
        ) revert InvalidGasCompensation();
        if (_collGasCompensationCap == 0 || _collGasCompensationCap > 10 ether)
            revert InvalidGasCompensation();
        if (_ethGasCompensation == 0 || _ethGasCompensation > 1 ether)
            revert InvalidGasCompensation();

        COLL_GAS_COMPENSATION_DIVISOR = _collGasCompensationDivisor;
        COLL_GAS_COMPENSATION_CAP = _collGasCompensationCap;
        ETH_GAS_COMPENSATION = _ethGasCompensation;

        emit GasCompParamsUpdated(
            _collGasCompensationDivisor,
            _collGasCompensationCap,
            _ethGasCompensation
        );
    }

    /// @inheritdoc ISystemParams
    function updateCollateralParams(
        uint256 _ccr,
        uint256 _scr,
        uint256 _mcr,
        uint256 _bcr
    ) external onlyOwner {
        if (_ccr <= _100pct || _ccr >= 2 * _100pct) revert InvalidCCR();
        if (_mcr <= _100pct || _mcr >= 2 * _100pct) revert InvalidMCR();
        if (_bcr < 5 * _1pct || _bcr >= 50 * _1pct) revert InvalidBCR();
        if (_scr <= _100pct || _scr >= 2 * _100pct) revert InvalidSCR();

        CCR = _ccr;
        SCR = _scr;
        MCR = _mcr;
        BCR = _bcr;

        emit CollateralParamsUpdated(_ccr, _scr, _mcr, _bcr);
    }

    /// @inheritdoc ISystemParams
    function updateInterestParams(
        uint256 _minAnnualInterestRate,
        uint256 _maxAnnualInterestRate,
        uint128 _maxAnnualBatchManagementFee,
        uint256 _upfrontInterestPeriod,
        uint256 _interestRateAdjCooldown,
        uint128 _minInterestRateChangePeriod,
        uint256 _maxBatchSharesRatio
    ) external onlyOwner {
        if (_minAnnualInterestRate > _maxAnnualInterestRate)
            revert MinInterestRateGtMax();
        if (_maxAnnualInterestRate > 10 * _100pct)
            revert InvalidInterestRateBounds(); // Max 1000%
        if (_maxAnnualBatchManagementFee > _100pct) revert InvalidFeeValue();

        if (_upfrontInterestPeriod == 0 || _upfrontInterestPeriod > 365 days)
            revert InvalidTimeValue();
        if (
            _interestRateAdjCooldown == 0 || _interestRateAdjCooldown > 365 days
        ) revert InvalidTimeValue();
        if (
            _minInterestRateChangePeriod == 0 ||
            _minInterestRateChangePeriod > 30 days
        ) revert InvalidTimeValue();

        MIN_ANNUAL_INTEREST_RATE = _minAnnualInterestRate;
        MAX_ANNUAL_INTEREST_RATE = _maxAnnualInterestRate;
        MAX_ANNUAL_BATCH_MANAGEMENT_FEE = _maxAnnualBatchManagementFee;
        UPFRONT_INTEREST_PERIOD = _upfrontInterestPeriod;
        INTEREST_RATE_ADJ_COOLDOWN = _interestRateAdjCooldown;
        MIN_INTEREST_RATE_CHANGE_PERIOD = _minInterestRateChangePeriod;
        MAX_BATCH_SHARES_RATIO = _maxBatchSharesRatio;

        emit InterestParamsUpdated(
            _minAnnualInterestRate,
            _maxAnnualInterestRate,
            _maxAnnualBatchManagementFee,
            _upfrontInterestPeriod,
            _interestRateAdjCooldown,
            _minInterestRateChangePeriod,
            _maxBatchSharesRatio
        );
    }

    /// @inheritdoc ISystemParams
    function updateRedemptionParams(
        uint256 _redemptionFeeFloor,
        uint256 _initialBaseRate,
        uint256 _redemptionMinuteDecayFactor,
        uint256 _redemptionBeta,
        uint256 _urgentRedemptionBonus
    ) external onlyOwner {
        if (_redemptionFeeFloor > _100pct) revert InvalidFeeValue();
        if (_initialBaseRate > 10 * _100pct) revert InvalidFeeValue();
        if (_urgentRedemptionBonus > _100pct) revert InvalidFeeValue();

        REDEMPTION_FEE_FLOOR = _redemptionFeeFloor;
        INITIAL_BASE_RATE = _initialBaseRate;
        REDEMPTION_MINUTE_DECAY_FACTOR = _redemptionMinuteDecayFactor;
        REDEMPTION_BETA = _redemptionBeta;
        URGENT_REDEMPTION_BONUS = _urgentRedemptionBonus;

        emit RedemptionParamsUpdated(
            _redemptionFeeFloor,
            _initialBaseRate,
            _redemptionMinuteDecayFactor,
            _redemptionBeta,
            _urgentRedemptionBonus
        );
    }

    /// @inheritdoc ISystemParams
    function updatePoolParams(
        uint256 _spYieldSplit,
        uint256 _minBoldInSP
    ) external onlyOwner {
        if (_spYieldSplit > _100pct) revert InvalidFeeValue();
        if (_minBoldInSP == 0) revert InvalidMinDebt();

        SP_YIELD_SPLIT = _spYieldSplit;
        MIN_BOLD_IN_SP = _minBoldInSP;

        emit StabilityPoolParamsUpdated(_spYieldSplit, _minBoldInSP);
    }

    /// @inheritdoc ISystemParams
    function updateVersion(uint256 newVersion) external onlyOwner {
        uint256 oldVersion = version;
        version = newVersion;
        emit VersionUpdated(oldVersion, newVersion);
    }
}
