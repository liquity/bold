// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

address constant ZERO_ADDRESS = address(0);

uint256 constant MAX_UINT256 = type(uint256).max;

uint256 constant DECIMAL_PRECISION = 1e18;
uint256 constant _100pct = DECIMAL_PRECISION;
uint256 constant _1pct = DECIMAL_PRECISION / 100;

// Amount of ETH to be locked in gas pool on opening troves
uint256 constant ETH_GAS_COMPENSATION = 0.0375 ether;

// Fraction of collateral awarded to liquidator
uint256 constant COLL_GAS_COMPENSATION_DIVISOR = 200; // dividing by 200 yields 0.5%
uint256 constant COLL_GAS_COMPENSATION_CAP = 2 ether; // Max coll gas compensation capped at 2 ETH

// Minimum amount of net Bold debt a trove must have
uint256 constant MIN_DEBT = 2000e18;

uint256 constant MIN_ANNUAL_INTEREST_RATE = _1pct / 2; // 0.5%
uint256 constant MAX_ANNUAL_INTEREST_RATE = _100pct;

// Batch management params
uint128 constant MAX_ANNUAL_BATCH_MANAGEMENT_FEE = uint128(_100pct);
uint128 constant MIN_INTEREST_RATE_CHANGE_PERIOD = 1 seconds; // prevents more than one adjustment per block

uint256 constant REDEMPTION_FEE_FLOOR = _1pct / 2; // 0.5%

// Half-life of 12h. 12h = 720 min
// (1/2) = d^720 => d = (1/2)^(1/720)
uint256 constant REDEMPTION_MINUTE_DECAY_FACTOR = 999037758833783000;

// BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction, in order to calc the new base rate from a redemption.
// Corresponds to (1 / ALPHA) in the white paper.
uint256 constant REDEMPTION_BETA = 2;

// To prevent redemptions unless Bold depegs below 0.95 and allow the system to take off
uint256 constant INITIAL_BASE_RATE = 5 * _1pct - REDEMPTION_FEE_FLOOR; // 5% initial redemption rate

// Discount to be used once the shutdown thas been triggered
uint256 constant URGENT_REDEMPTION_BONUS = 1e16; // 1%

uint256 constant ONE_MINUTE = 1 minutes;
uint256 constant ONE_YEAR = 365 days;
uint256 constant UPFRONT_INTEREST_PERIOD = 7 days;
uint256 constant INTEREST_RATE_ADJ_COOLDOWN = 3 days;
uint256 constant STALE_TROVE_DURATION = 90 days;

uint256 constant SP_YIELD_SPLIT = 72 * _1pct; // 72%

// Dummy contract that lets legacy Hardhat tests query some of the constants
contract Constants {
    uint256 public constant _ETH_GAS_COMPENSATION = ETH_GAS_COMPENSATION;
    uint256 public constant _MIN_DEBT = MIN_DEBT;
}
