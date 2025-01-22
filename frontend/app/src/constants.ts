"use client";

import type { CollateralSymbol, RiskLevel } from "@/src/types";

import { norm } from "@liquity2/uikit";
import * as dn from "dnum";

export const LOCAL_STORAGE_PREFIX = "liquity2:";

export const LEVERAGE_FACTOR_MIN = 1.1;

export const MAX_LTV_ALLOWED_RATIO = 0.916; // ratio of the max LTV allowed by the app (when opening a position)
export const MAX_LTV_RESERVE_RATIO = 0.04; // ratio of the max LTV in non-limited mode (e.g. when updating a position), to prevent reaching the max LTV

export const ETH_MAX_RESERVE = dn.from(0.1, 18); // leave 0.1 ETH when users click on "max" to deposit from their account

export const ETH_GAS_COMPENSATION = dn.from(0.0375, 18); // see contracts/src/Dependencies/Constants.sol
export const MIN_ANNUAL_INTEREST_RATE = dn.from(0.005, 18); // 0.5% see contracts/src/Dependencies/Constants.sol
export const MAX_ANNUAL_INTEREST_RATE = dn.from(2.5, 18); // 250% see contracts/src/Dependencies/Constants.sol

export const INTEREST_RATE_MIN = 0.5; // 0.5% annualized
export const INTEREST_RATE_MAX = 25; // 25% annualized
export const INTEREST_RATE_DEFAULT = 10;
export const INTEREST_RATE_INCREMENT = 0.1;

export const ONE_DAY_IN_SECONDS = 24n * 60n * 60n;
export const ONE_YEAR_IN_SECONDS = 365n * ONE_DAY_IN_SECONDS;
export const UPFRONT_INTEREST_PERIOD = 7n * ONE_DAY_IN_SECONDS;

export const SP_YIELD_SPLIT = 72n * 10n ** 16n; // 72%

export const DATA_REFRESH_INTERVAL = 30_000;
export const PRICE_REFRESH_INTERVAL = 60_000;

export const LEVERAGE_MAX_SLIPPAGE = 0.05; // 5%
export const CLOSE_FROM_COLLATERAL_SLIPPAGE = 0.05; // 5%
export const MAX_UPFRONT_FEE = 1000n * 10n ** 18n;
export const MIN_DEBT = dn.from(2000, 18);

export const MAX_COLLATERAL_DEPOSITS: Record<CollateralSymbol, dn.Dnum> = {
  ETH: dn.from(100_000_000n, 18),
  WSTETH: dn.from(100_000_000n, 18),
  RETH: dn.from(100_000_000n, 18),
};

// LTV factor suggestions, as ratios of the multiply factor range
export const LEVERAGE_FACTOR_SUGGESTIONS = [
  norm(1.5, 1.1, 11), // 1.5x multiply with a 1.1x => 11x range
  norm(2.5, 1.1, 11),
  norm(5, 1.1, 11),
];

// DEBT suggestions, as ratios of the max LTV
export const DEBT_SUGGESTIONS = [
  0.3,
  0.6,
  0.8,
];

// ltv risk levels, as ratios of the max ltv
export const LTV_RISK: Record<Exclude<RiskLevel, "low">, number> = {
  medium: 0.54,
  high: 0.73,
};

// redemption risk levels, as interest rate ratios
export const REDEMPTION_RISK: Record<Exclude<RiskLevel, "high">, number> = {
  medium: 3.5 / 100,
  low: 5 / 100,
};
