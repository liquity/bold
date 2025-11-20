// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

interface ISystemParams {
    /* ========== PARAMETER STRUCTS ========== */

    struct DebtParams {
        uint256 minDebt;
    }

    struct LiquidationParams {
        uint256 liquidationPenaltySP;
        uint256 liquidationPenaltyRedistribution;
    }

    struct GasCompParams {
        uint256 collGasCompensationDivisor;
        uint256 collGasCompensationCap;
        uint256 ethGasCompensation;
    }

    struct CollateralParams {
        uint256 ccr;
        uint256 scr;
        uint256 mcr;
        uint256 bcr;
    }

    struct InterestParams {
        uint256 minAnnualInterestRate;
    }

    struct RedemptionParams {
        uint256 redemptionFeeFloor;
        uint256 initialBaseRate;
        uint256 redemptionMinuteDecayFactor;
        uint256 redemptionBeta;
    }

    struct StabilityPoolParams {
        uint256 spYieldSplit;
        uint256 minBoldInSP;
        uint256 minBoldAfterRebalance;
    }

    /* ========== ERRORS ========== */

    error InvalidMinDebt();
    error InvalidInterestRateBounds();
    error InvalidFeeValue();
    error InvalidTimeValue();
    error InvalidGasCompensation();
    error MinInterestRateGtMax();
    error InvalidCCR();
    error InvalidMCR();
    error InvalidBCR();
    error InvalidSCR();
    error SPPenaltyTooLow();
    error SPPenaltyGtRedist();
    error RedistPenaltyTooHigh();
    error InvalidMinBoldInSP();

    /* ========== DEBT PARAMETERS ========== */

    /// @notice Minimum amount of net debt a trove must have.
    function MIN_DEBT() external view returns (uint256);

    /* ========== LIQUIDATION PARAMETERS ========== */

    /// @notice Liquidation penalty for troves offset to the SP
    function LIQUIDATION_PENALTY_SP() external view returns (uint256);

    /// @notice Liquidation penalty for troves redistributed.
    function LIQUIDATION_PENALTY_REDISTRIBUTION() external view returns (uint256);

    /* ========== GAS COMPENSATION PARAMETERS ========== */

    /// @notice Divisor for calculating collateral gas compensation for liquidators.
    function COLL_GAS_COMPENSATION_DIVISOR() external view returns (uint256);

    /// @notice Maximum collateral gas compensation cap for liquidators.
    function COLL_GAS_COMPENSATION_CAP() external view returns (uint256);

    // TODO(@bayological): Consider rename to native(or just drop eth) if this makes sense
    //              and update comment.
    /// @notice Amount of ETH to be locked in gas pool on opening troves.
    function ETH_GAS_COMPENSATION() external view returns (uint256);

    /* ========== COLLATERAL PARAMETERS ========== */

    /**
     * @notice Critical system collateral ratio.
     * @dev If the system's total collateral ratio (TCR) falls below the CCR, some borrowing
     *      operation restrictions are applied.
     */
    function CCR() external view returns (uint256);

    /**
     * @notice Shutdown system collateral ratio.
     * @dev If the system's total collateral ratio (TCR) for a given collateral falls below the SCR,
     *      the protocol triggers the shutdown of the borrow market and permanently disables all
     *      borrowing operations except for closing Troves.
     */
    function SCR() external view returns (uint256);

    /// @notice Minimum collateral ratio for individual troves.
    function MCR() external view returns (uint256);

    /**
     * @notice Extra buffer of collateral ratio to join a batch or adjust a trove inside
     *         a batch (on top of MCR).
     */
    function BCR() external view returns (uint256);

    /* ========== INTEREST PARAMETERS ========== */

    /// @notice Min annual interest rate for a trove.
    function MIN_ANNUAL_INTEREST_RATE() external view returns (uint256);

    /* ========== REDEMPTION PARAMETERS ========== */

    /// @notice Minimum redemption fee percentage.
    function REDEMPTION_FEE_FLOOR() external view returns (uint256);

    /// @notice The initial redemption fee value.
    function INITIAL_BASE_RATE() external view returns (uint256);

    /// @notice Factor to reduce the redemption fee per minute.
    function REDEMPTION_MINUTE_DECAY_FACTOR() external view returns (uint256);

    /// @notice Divisor controlling base rate sensitivity to redemption volume (higher = less sensitive).
    function REDEMPTION_BETA() external view returns (uint256);

    /* ========== STABILITY POOL PARAMETERS ========== */

    /// @notice Percentage of minted interest yield allocated to Stability Pool depositors.
    function SP_YIELD_SPLIT() external view returns (uint256);

    /// @notice Minimum BOLD that must remain in Stability Pool to prevent complete drainage.
    function MIN_BOLD_IN_SP() external view returns (uint256);

    /// @notice Minimum BOLD that must remain in Stability Pool after a rebalance operation.
    function MIN_BOLD_AFTER_REBALANCE() external view returns (uint256);

    function initialize() external;
}
