"use client";

import type { RiskLevel } from "@/src/types";

import { norm } from "@liquity2/uikit";
import * as dn from "dnum";

export const APP_TITLE = "Liquity v2";
export const LOCAL_STORAGE_PREFIX = "liquity2:";

export const LEVERAGE_FACTOR_MIN = 1.1;
export const MAX_LTV_ALLOWED = 0.916; // ratio of the max LTV allowed by the app
export const ETH_MAX_RESERVE = dn.from(0.1, 18); // leave 0.1 ETH when users click on "max" to deposit from their account
export const ETH_GAS_COMPENSATION = dn.from(0.0375, 18); // see contracts/src/Dependencies/Constants.sol

export const LQTY_SUPPLY = dn.from(100_000_000, 18);

export const INTEREST_RATE_MIN = 1;
export const INTEREST_RATE_MAX = 8;
export const INTEREST_RATE_DEFAULT = 4;
export const INTEREST_RATE_INCREMENT = 0.1;

// LTV factor suggestions, as ratios of the leverage factor range
export const LEVERAGE_FACTOR_SUGGESTIONS = [
  norm(1.5, 1.1, 11), // 1.5x leverage with a 1.1x => 11x range
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
