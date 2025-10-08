// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

address constant ZERO_ADDRESS = address(0);

uint256 constant MAX_UINT256 = type(uint256).max;

uint256 constant DECIMAL_PRECISION = 1e18;
uint256 constant _100pct = DECIMAL_PRECISION;
uint256 constant _1pct = DECIMAL_PRECISION / 100;

uint256 constant ONE_MINUTE = 1 minutes;
uint256 constant ONE_YEAR = 365 days;

// Interest rate parameters
uint256 constant MAX_ANNUAL_INTEREST_RATE = 250 * _1pct; // 250%
uint128 constant MAX_ANNUAL_BATCH_MANAGEMENT_FEE = uint128(_100pct / 10); // 10%
uint128 constant MIN_INTEREST_RATE_CHANGE_PERIOD = 1 hours;
uint256 constant UPFRONT_INTEREST_PERIOD = 7 days;
uint256 constant INTEREST_RATE_ADJ_COOLDOWN = 7 days;

// Batch parameters
uint256 constant MAX_BATCH_SHARES_RATIO = 1e9;

// Redemption parameters
uint256 constant URGENT_REDEMPTION_BONUS = 1 * _1pct; // 1%

// Liquidation parameters
uint256 constant MAX_LIQUIDATION_PENALTY_REDISTRIBUTION = 20 * _1pct; // 20%
