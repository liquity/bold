// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

address constant ZERO_ADDRESS = address(0);

uint256 constant MAX_UINT256 = type(uint256).max;

uint256 constant DECIMAL_PRECISION = 1e18;
uint256 constant _100pct = DECIMAL_PRECISION;
uint256 constant _1pct = DECIMAL_PRECISION / 100;

// Critical system collateral ratio. If the system's total collateral ratio (TCR) falls below the CCR, some borrowing operation restrictions are applied
uint256 constant CCR = 150 * _1pct; // 150%

// Amount of Bold to be locked in gas pool on opening troves
uint256 constant BOLD_GAS_COMPENSATION = 200e18;

// Fraction of collateral awarded to liquidator
uint256 constant COLL_GAS_COMPENSATION_DIVISOR = 200; // dividing by 200 yields 0.5%

// Minimum amount of net Bold debt a trove must have
uint256 constant MIN_NET_DEBT = 1800e18;
uint256 constant MIN_DEBT = MIN_NET_DEBT + BOLD_GAS_COMPENSATION;

uint256 constant MAX_ANNUAL_INTEREST_RATE = _100pct;

uint256 constant REDEMPTION_FEE_FLOOR = _1pct / 2; // 0.5%

// Half-life of 12h. 12h = 720 min
// (1/2) = d^720 => d = (1/2)^(1/720)
uint256 constant REDEMPTION_MINUTE_DECAY_FACTOR = 999037758833783000;

// BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction, in order to calc the new base rate from a redemption.
// Corresponds to (1 / ALPHA) in the white paper.
uint256 constant REDEMPTION_BETA = 2;

// To prevent redemptions unless Bold depegs below 0.95 and allow the system to take off
uint256 constant INITIAL_REDEMPTION_RATE = 5 * _1pct; // 5%

uint256 constant ONE_MINUTE = 1 minutes;
uint256 constant ONE_YEAR = 365 days;
uint256 constant UPFRONT_INTEREST_PERIOD = 7 days;
uint256 constant INTEREST_RATE_ADJ_COOLDOWN = 3 days;
uint256 constant STALE_TROVE_DURATION = 90 days;

uint256 constant SP_YIELD_SPLIT = 72 * _1pct; // 72%

// Dummy contract that lets legacy Hardhat tests query some of the constants
contract Constants {
    uint256 public constant _CCR = CCR;
    uint256 public constant _BOLD_GAS_COMPENSATION = BOLD_GAS_COMPENSATION;
    uint256 public constant _MIN_NET_DEBT = MIN_NET_DEBT;
}
