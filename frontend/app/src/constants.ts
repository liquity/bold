import type { RiskLevel } from "@/src/types";

import { norm } from "@/src/math-utils";

export const LEVERAGE_FACTOR_MIN = 1.1;
export const MAX_LTV_ALLOWED = 0.916; // percentage of the max LTV

// LTV factor suggestions, as percentages of the leverage factor range
export const LEVERAGE_FACTOR_SUGGESTIONS = [
  norm(1.5, 1.1, 11), // 1.5x leverage with a 1.1x => 11x range
  norm(2.5, 1.1, 11),
  norm(5, 1.1, 11),
];

// ltv risk levels, as percentages of the max ltv
export const LTV_RISK: Record<Exclude<RiskLevel, "low">, number> = {
  medium: 0.54,
  high: 0.73,
};

// redemption risk levels
export const REDEMPTION_RISK: Record<RiskLevel, number> = {
  high: 0,
  medium: 3.5,
  low: 5.0,
};
