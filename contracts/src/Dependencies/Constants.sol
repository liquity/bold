// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

address constant ZERO_ADDRESS = address(0);

uint256 constant MAX_UINT256 = type(uint256).max;

uint256 constant DECIMAL_PRECISION = 1e18;
uint256 constant _100pct = DECIMAL_PRECISION;
uint256 constant _1pct = DECIMAL_PRECISION / 100;

// Amount of ETH to be locked in gas pool on opening troves
uint256 constant ETH_GAS_COMPENSATION = 0 ether; // Saga has no gas requirements for sending transactions, so no deposit is needed by user
//instead of changing the logic and increasing logical complexity, we can just set this to 0

// Liquidation
uint256 constant MIN_LIQUIDATION_PENALTY_SP = 5e16; // 5%
uint256 constant MAX_LIQUIDATION_PENALTY_REDISTRIBUTION = 20e16; // 20%

// Collateral branch parameters (SETH = staked ETH, i.e. wstETH / rETH)
uint256 constant CCR_WETH = 150 * _1pct;
uint256 constant CCR_YETH = 160 * _1pct;
uint256 constant CCR_TBTC = 160 * _1pct;
uint256 constant CCR_SAGA = 170 * _1pct;
uint256 constant CCR_STATOM = 160 * _1pct;
uint256 constant CCR_KING = 160 * _1pct;
uint256 constant CCR_YUSD = 160 * _1pct;

uint256 constant MCR_WETH = 110 * _1pct;
uint256 constant MCR_YETH = 120 * _1pct;
uint256 constant MCR_TBTC = 110 * _1pct;
uint256 constant MCR_SAGA = 150 * _1pct; // saga and king
uint256 constant MCR_STATOM = 125 * _1pct;
uint256 constant MCR_KING = 150 * _1pct;
uint256 constant MCR_YUSD = 115 * _1pct;

uint256 constant SCR_WETH = 110 * _1pct;
uint256 constant SCR_YETH = 120 * _1pct;
uint256 constant SCR_TBTC = 110 * _1pct;
uint256 constant SCR_SAGA = 150 * _1pct;
uint256 constant SCR_STATOM = 125 * _1pct;
uint256 constant SCR_KING = 150 * _1pct;
uint256 constant SCR_YUSD = 115 * _1pct;

// Batch CR buffer (same for all branches for now)
// On top of MCR to join a batch, or adjust inside a batch
uint256 constant BCR_ALL = 10 * _1pct;

// Debt limit for each branch of initial collateral types
uint256 constant WETH_DEBT_LIMIT = 100_000_000e18;
uint256 constant YETH_DEBT_LIMIT = 5_000_000e18;
uint256 constant TBTC_DEBT_LIMIT = 100_000_000e18;
uint256 constant SAGA_DEBT_LIMIT = 1_000_000_000e18; // 1 billion - effectively unlimited
uint256 constant STATOM_DEBT_LIMIT = 1_000_000_000e18; // 1 billion - effectively unlimited
uint256 constant KING_DEBT_LIMIT = 500_000e18;
uint256 constant YUSD_DEBT_LIMIT = 5_000_000e18;

uint256 constant LIQUIDATION_PENALTY_SP_WETH = 5 * _1pct;
uint256 constant LIQUIDATION_PENALTY_SP_YETH = 5 * _1pct;
uint256 constant LIQUIDATION_PENALTY_SP_TBTC = 5 * _1pct;
uint256 constant LIQUIDATION_PENALTY_SP_SAGA = 5 * _1pct;
uint256 constant LIQUIDATION_PENALTY_SP_STATOM = 5 * _1pct;
uint256 constant LIQUIDATION_PENALTY_SP_KING = 5 * _1pct;
uint256 constant LIQUIDATION_PENALTY_SP_YUSD = 5 * _1pct;

uint256 constant LIQUIDATION_PENALTY_REDISTRIBUTION_WETH = 10 * _1pct;
uint256 constant LIQUIDATION_PENALTY_REDISTRIBUTION_YETH = 10 * _1pct;
uint256 constant LIQUIDATION_PENALTY_REDISTRIBUTION_TBTC = 10 * _1pct;
uint256 constant LIQUIDATION_PENALTY_REDISTRIBUTION_SAGA = 20 * _1pct;
uint256 constant LIQUIDATION_PENALTY_REDISTRIBUTION_STATOM = 15 * _1pct;
uint256 constant LIQUIDATION_PENALTY_REDISTRIBUTION_KING = 10 * _1pct;
uint256 constant LIQUIDATION_PENALTY_REDISTRIBUTION_YUSD = 10 * _1pct;

// Fraction of collateral awarded to liquidator
uint256 constant COLL_GAS_COMPENSATION_DIVISOR = 200; // dividing by 200 yields 0.5%
// Default value for COLL_GAS_COMPENSATION_CAP at deployment
uint256 constant COLL_GAS_COMPENSATION_CAP = 500 ether; // Max coll gas compensation capped at 2 ETH

// Recommended value for COLL_GAS_COMPENSATION_CAP for each collateral type
uint256 constant COLL_GAS_COMPENSATION_CAP_WETH = 15e15;
uint256 constant COLL_GAS_COMPENSATION_CAP_YETH = 1e16;
uint256 constant COLL_GAS_COMPENSATION_CAP_TBTC = 6e14;
uint256 constant COLL_GAS_COMPENSATION_CAP_SAGA = 500e18;
uint256 constant COLL_GAS_COMPENSATION_CAP_STATOM = 10e18;
uint256 constant COLL_GAS_COMPENSATION_CAP_KING = 8e16;
uint256 constant COLL_GAS_COMPENSATION_CAP_YUSD = 60e18;

// Minimum amount of net Bold debt a trove must have
uint256 constant MIN_DEBT = 200e18;

uint256 constant MIN_ANNUAL_INTEREST_RATE = _1pct / 2; // 0.5%
uint256 constant MAX_ANNUAL_INTEREST_RATE = 250 * _1pct;

// Batch management params
uint128 constant MAX_ANNUAL_BATCH_MANAGEMENT_FEE = uint128(_100pct / 10); // 10%
uint128 constant MIN_INTEREST_RATE_CHANGE_PERIOD = 1 hours; // only applies to batch managers / batched Troves

uint256 constant REDEMPTION_FEE_FLOOR = 55 * _1pct / 100; // 0.55% -> Floor $0.9945

// For the debt / shares ratio to increase by a factor 1e9
// at a average annual debt increase (compounded interest + fees) of 10%, it would take more than 217 years (log(1e9)/log(1.1))
// at a average annual debt increase (compounded interest + fees) of 50%, it would take more than 51 years (log(1e9)/log(1.5))
// The increase pace could be forced to be higher through an inflation attack,
// but precisely the fact that we have this max value now prevents the attack
uint256 constant MAX_BATCH_SHARES_RATIO = 1e9;

// Half-life of 6h. 6h = 360 min
// (1/2) = d^360 => d = (1/2)^(1/360)
uint256 constant REDEMPTION_MINUTE_DECAY_FACTOR = 998076443575628800;

// BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction, in order to calc the new base rate from a redemption.
// Corresponds to (1 / ALPHA) in the white paper.
uint256 constant REDEMPTION_BETA = 1;

// To prevent redemptions unless Bold depegs below 0.95 and allow the system to take off
uint256 constant INITIAL_BASE_RATE = _100pct; // 100% initial redemption rate

// Discount to be used once the shutdown thas been triggered
uint256 constant URGENT_REDEMPTION_BONUS = 2e16; // 2%

uint256 constant ONE_MINUTE = 1 minutes;
uint256 constant ONE_YEAR = 365 days;
uint256 constant UPFRONT_INTEREST_PERIOD = 7 days;
uint256 constant INTEREST_RATE_ADJ_COOLDOWN = 7 days;

uint256 constant SP_YIELD_SPLIT = 75 * _1pct; // 75%

uint256 constant MIN_BOLD_IN_SP = 1e18;

// Dummy contract that lets legacy Hardhat tests query some of the constants
contract Constants {
    uint256 public constant _ETH_GAS_COMPENSATION = ETH_GAS_COMPENSATION;
    uint256 public constant _MIN_DEBT = MIN_DEBT;
}
