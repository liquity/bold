import type { Dnum, RiskLevel } from "@/src/types";

import * as dn from "dnum";
import { match, P } from "ts-pattern";

// Dnum formatting options
const dnFormatOptions = {
  "1z": { digits: 1, trailingZeros: true },
  "2z": { digits: 2, trailingZeros: true },
  "full": undefined, // dnum defaults
} as const;

function isDnFormatName(value: unknown): value is keyof typeof dnFormatOptions {
  return typeof value === "string" && value in dnFormatOptions;
}

export function fmtnum(
  value: Dnum | number | null,
  optionsOrFormatName:
    | keyof typeof dnFormatOptions
    | Parameters<typeof dn.format>[1] = "2z",
) {
  if (value === null) {
    return "";
  }
  if (typeof value === "number") {
    value = dn.from(value);
  }
  if (isDnFormatName(optionsOrFormatName)) {
    optionsOrFormatName = dnFormatOptions[optionsOrFormatName];
  }
  return dn.format(value, optionsOrFormatName);
}

export function formatLiquidationRisk(liquidationRisk: RiskLevel | null) {
  return match(liquidationRisk)
    .with(P.nullish, () => "Liquidation risk")
    .with("low", () => "Low liquidation risk")
    .with("medium", () => "Medium liquidation risk")
    .with("high", () => "High liquidation risk")
    .exhaustive();
}

export function formatRedemptionRisk(redemptionRisk: RiskLevel | null) {
  return match(redemptionRisk)
    .with(P.nullish, () => "Redemption risk")
    .with("low", () => "Low redemption risk")
    .with("medium", () => "Medium redemption risk")
    .with("high", () => "High redemption risk")
    .exhaustive();
}

export function formatRisk(risk: RiskLevel | null) {
  return match(risk)
    .with(P.nullish, () => null)
    .with("low", () => "Low")
    .with("medium", () => "Medium")
    .with("high", () => "High")
    .exhaustive();
}
