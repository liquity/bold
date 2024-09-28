import type { Dnum, RiskLevel } from "@/src/types";

import { DNUM_0, DNUM_1 } from "@/src/dnum-utils";
import * as dn from "dnum";
import { match, P } from "ts-pattern";

// Dnum formatting options
const dnFormatOptions = {
  "1z": { digits: 1, trailingZeros: true },
  "2z": { digits: 2, trailingZeros: true },
  "compact": { compact: true, digits: 2 },
  "full": undefined, // dnum defaults
} as const;

function isDnFormatName(value: unknown): value is keyof typeof dnFormatOptions {
  return typeof value === "string" && value in dnFormatOptions;
}

export function fmtnum(
  value: Dnum | number | null | undefined,
  optionsOrFormatName:
    | keyof typeof dnFormatOptions
    | Parameters<typeof dn.format>[1] = "2z",
  scale = 1, // pass 100 here to format as percentage
) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    value = dn.from(value);
  }
  if (isDnFormatName(optionsOrFormatName)) {
    optionsOrFormatName = dnFormatOptions[optionsOrFormatName];
  }
  if (scale > 1) {
    value = dn.mul(value, scale);
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

export function formatAmountCompact(value: Dnum, digits: number = 2) {
  const valueAbs = dn.abs(value);
  if (dn.eq(valueAbs, 1e9) || dn.gt(valueAbs, 1e9)) {
    return dn.format(dn.div(value, 1e9, 18), digits) + "B";
  }
  if (dn.eq(valueAbs, 1e6) || dn.gt(valueAbs, 1e6)) {
    return dn.format(dn.div(value, 1e6, 18), digits) + "M";
  }
  if (dn.eq(valueAbs, 1e3) || dn.gt(valueAbs, 1e3)) {
    return dn.format(dn.div(value, 1e3, 18), digits) + "K";
  }
  return dn.format(value, digits);
}

export function formatPercentage(
  value?: Dnum | number | null,
  {
    clamp = false,
    digits = 2,
    trailingZeros = true,
  }: {
    clamp?: boolean | [Dnum, Dnum];
    digits?: number;
    trailingZeros?: boolean;
  } = {},
) {
  if (typeof value === "number") {
    value = dn.from(value, 18);
  }
  if (!value) {
    return "−";
  }
  if (clamp === true) {
    clamp = [DNUM_0, DNUM_1];
  }
  if (clamp && dn.lte(value, clamp[0])) {
    return "0%";
  }
  if (clamp && dn.gte(value, clamp[1])) {
    return "100%";
  }
  return `${
    dn.format(dn.mul(value, 100), {
      digits,
      trailingZeros,
    })
  }%`;
}
