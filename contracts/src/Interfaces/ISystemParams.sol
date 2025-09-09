// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

interface ISystemParams {
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

    /* ========== EVENTS ========== */

    /// @notice Emitted when min debt is updated.
    event MinDebtUpdated(uint256 oldMinDebt, uint256 newMinDebt);

    /// @notice Emitted when liquidation parameters are updated.
    event LiquidationParamsUpdated(
        uint256 minLiquidationPenaltySP,
        uint256 maxLiquidationPenaltyRedistribution,
        uint256 liquidationPenaltySP,
        uint256 liquidationPenaltyRedistribution
    );

    /// @notice Emitted when gas compensation parameters are updated.
    event GasCompParamsUpdated(
        uint256 collGasCompensationDivisor,
        uint256 collGasCompensationCap,
        uint256 ethGasCompensation
    );

    /// @notice Emitted when collateral parameters are updated.
    event CollateralParamsUpdated(
        uint256 ccr,
        uint256 scr,
        uint256 mcr,
        uint256 bcr,
    );

    /// @notice Emitted when Interest rate parameters are updated.
    event InterestParamsUpdated(
        uint256 minAnnualInterestRate,
        uint256 maxAnnualInterestRate,
        uint128 maxAnnualBatchManagementFee,
        uint256 upfrontInterestPeriod,
        uint256 interestRateAdjCooldown,
        uint128 minInterestRateChangePeriod,
        uint256 maxBatchSharesRatio
    );

    /// @notice Emitted when redemption parameters are updated.
    event RedemptionParamsUpdated(
        uint256 redemptionFeeFloor,
        uint256 initialBaseRate,
        uint256 redemptionMinuteDecayFactor,
        uint256 redemptionBeta,
        uint256 urgentRedemptionBonus
    );

    /// @notice Emitted when stability pool parameters are updated.
    event StabilityPoolParamsUpdated(uint256 spYieldSplit, uint256 minBoldInSP);


    /// @notice Emitted when the version is updated.
    event VersionUpdated(uint256 oldVersion, uint256 newVersion);

    /* ========== DEBT PARAMETERS ========== */

    /// @notice Minimum amount of net debt a trove must have.
    function MIN_DEBT() external view returns (uint256);

    /* ========== LIQUIDATION PARAMETERS ========== */

    // TODO(@bayological): These min and max params are used to validate
    //                     the penalaties are within expected ranges when
    //                     being set. Do we want these to be configurable?
    /// @notice Minimum liquidation penalty for troves offset to the SP
    function MIN_LIQUIDATION_PENALTY_SP() external view returns (uint256);

    /// @notice Maximum liquidation penalty for troves redistributed.
    function MAX_LIQUIDATION_PENALTY_REDISTRIBUTION() external view returns (uint256);

    /// @notice Liquidation penalty for troves offset to the SP
    function LIQUIDATION_PENALTY_SP() external view returns (uint256);

    /// @notice Liquidation penalty for troves redistributed.
    function LIQUIDATION_PENALTY_REDISTRIBUTION()
        external
        view
        returns (uint256);

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

    /// @notice Max annual interest rate for a trove.
    function MAX_ANNUAL_INTEREST_RATE() external view returns (uint256);

    /// @notice Max fee that batch managers can charge.
    function MAX_ANNUAL_BATCH_MANAGEMENT_FEE() external view returns (uint128);

    /// @notice Time period for which interest is charged upfront to prevent rate gaming.
    function UPFRONT_INTEREST_PERIOD() external view returns (uint256);

    /// @notice Wait time in between interest rate adjustments.
    function INTEREST_RATE_ADJ_COOLDOWN() external view returns (uint256);

    /// @notice Minimum time in between interest rate changes triggered by a batch Manager.
    function MIN_INTEREST_RATE_CHANGE_PERIOD() external view returns (uint128);

    /// @notice Maximum ratio between batch debt and shares to prevent inflation attacks.
    function MAX_BATCH_SHARES_RATIO() external view returns (uint256);

    /* ========== REDEMPTION PARAMETERS ========== */

    /// @notice Minimum redemption fee percentage.
    function REDEMPTION_FEE_FLOOR() external view returns (uint256);

    /// @notice The initial redemption fee value.
    function INITIAL_BASE_RATE() external view returns (uint256);

    /// @notice Factor to reduce the redemption fee per minute.
    function REDEMPTION_MINUTE_DECAY_FACTOR() external view returns (uint256);

    /// @notice Divisor controlling base rate sensitivity to redemption volume (higher = less sensitive).
    function REDEMPTION_BETA() external view returns (uint256);

    /// @notice Extra collateral bonus given to redeemers during urgent redemptions after shutdown.
    function URGENT_REDEMPTION_BONUS() external view returns (uint256);

    /* ========== STABILITY POOL PARAMETERS ========== */

    /// @notice Percentage of minted interest yield allocated to Stability Pool depositors.
    function SP_YIELD_SPLIT() external view returns (uint256);

    /// @notice Minimum BOLD that must remain in Stability Pool to prevent complete drainage.
    function MIN_BOLD_IN_SP() external view returns (uint256);

    /* ========== VERSION ========== */

     /// @notice Returns the version of the system params contract.
    function version() external view returns (uint256);

    /* ========== FUNCTIONS ========== */

    /**
     * @notice Update the minimum debt
     * @param _minDebt The new minimum debt amount
     */
    function updateMinDebt(
        uint256 _minDebt
    ) external;

    /**
     * @notice Update the liquidation params.
     * @param _minLiquidationPenaltySP The minimum liquidation penalty for stability pool
     * @param _maxLiquidationPenaltyRedistribution The maximum liquidation penalty for redistribution
     * @param _liquidationPenaltySP The liquidation penalty for stability pool
     * @param _liquidationPenaltyRedistribution The liquidation penalty for redistribution
     */
    function updateLiquidationParams(
        uint256 _minLiquidationPenaltySP,
        uint256 _maxLiquidationPenaltyRedistribution,
        uint256 _liquidationPenaltySP,
        uint256 _liquidationPenaltyRedistribution
    ) external;

    /**
     * @notice Update gas compensation parameters.
     * @param _collGasCompensationDivisor Collateral gas compensation divisor.
     * @param _collGasCompensationCap Collateral gas compensation cap.
     * @param _ethGasCompensation Amount of ETH to be locked in gas pool on opening troves.
     */
    function updateGasCompParams(
        uint256 _collGasCompensationDivisor,
        uint256 _collGasCompensationCap,
        uint256 _ethGasCompensation
    ) external;

    /**
     * @notice Update the collateral related parameters.
     * @param _ccr The critical collateral ratio.
     * @param _scr The shutdown collateral ratio.
     * @param _mcr The minimum collateral ratio.
     * @param _bcr The base collateral ratio.
     */
    function updateCollateralParams(
        uint256 _ccr,
        uint256 _scr,
        uint256 _mcr,
        uint256 _bcr,
    ) external;

    /**
     * @notice Update interest related parameters.
     * @param _minAnnualInterestRate The minimum annual interest rate
     * @param _maxAnnualInterestRate The maximum annual interest rate
     * @param _maxAnnualBatchManagementFee The maximum annual batch management fee
     * @param _upfrontInterestPeriod The upfront interest period
     * @param _interestRateAdjCooldown The interest rate adjustment cooldown
     * @param _minInterestRateChangePeriod The minimum interest rate change period
     * @param _maxBatchSharesRatio The maximum ratio between batch debt and shares to prevent inflation attacks
     */
    function updateInterestParams(
        uint256 _minAnnualInterestRate,
        uint256 _maxAnnualInterestRate,
        uint128 _maxAnnualBatchManagementFee,
        uint256 _upfrontInterestPeriod,
        uint256 _interestRateAdjCooldown,
        uint128 _minInterestRateChangePeriod,
        uint256 _maxBatchSharesRatio
    ) external;

    /**
     * @notice Update redemption related parameters.
     * @param _redemptionFeeFloor The min redemption fee percentage
     * @param _initialBaseRate The initial base rate
     * @param _redemptionMinuteDecayFactor Factor to reduce the redemption fee per minute.
     * @param _redemptionBeta The redemption beta
     * @param _urgentRedemptionBonus The urgent redemption bonus given to redeemers after shutdownn
     */
    function updateRedemptionParams(
        uint256 _redemptionFeeFloor,
        uint256 _initialBaseRate,
        uint256 _redemptionMinuteDecayFactor,
        uint256 _redemptionBeta,
        uint256 _urgentRedemptionBonus
    ) external;
    
    /**
     * @notice Update stability pool related parameters.
     * @param _spYieldSplit Percentage of minted interest yield allocated to Stability Pool depositors.
     * @param _minBoldInSP Minimum BOLD that must remain in Stability Pool to prevent complete drainage.
     */
    function updatePoolParams(
        uint256 _spYieldSplit,
        uint256 _minBoldInSP
    ) external;

    /**
     * @notice Update the version of the system params contract.
     * @param _newVersion The new version number.
     */
    function updateVersion(uint256 _newVersion) external;
}
