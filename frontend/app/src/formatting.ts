import type { Dnum, RiskLevel } from "@/src/types";

import { DNUM_0, DNUM_1 } from "@/src/dnum-utils";
import * as dn from "dnum";
import { match, P } from "ts-pattern";

// formatting presets
const fmtnumPresets = {
  "1z": { digits: 1, trailingZeros: true },
  "2z": { digits: 2, trailingZeros: true },
  "12z": { digits: 12, trailingZeros: true },
  "2diff": { digits: 2, signDisplay: "exceptZero" },
  "4diff": { digits: 4, signDisplay: "exceptZero" },
  "pct1z": { scale: 100, digits: 1, trailingZeros: true },
  "pct2": { scale: 100, digits: 2 },
  "pct2z": { scale: 100, digits: 2, trailingZeros: true },
  "pctfull": { scale: 100, digits: undefined },
  "compact": { compact: true, digits: 2 },
  "full": {},
} satisfies Record<
  string,
  Exclude<DnumFormatOptions, number> & FmtnumExclusiveOptions
>;

type DnumFormatOptions =
  | number
  | Parameters<typeof dn.format>[1];

export type FmtnumPresetName = keyof typeof fmtnumPresets;

export type FmtnumExclusiveOptions = {
  dust?: boolean;
  prefix?: string;
  preset?: FmtnumPresetName;
  scale?: number; // pass e.g. 100 to format as percentage
  suffix?: string;
};

export type FmtnumOptions =
  | FmtnumPresetName // alias for { preset: FmtnumPresetName }
  | (DnumFormatOptions & FmtnumExclusiveOptions);

function isFmtnumPresetName(value: unknown): value is FmtnumPresetName {
  return typeof value === "string" && value in fmtnumPresets;
}

export function fmtnum(
  value: Dnum | number | null | undefined,
  optionsOrPreset: FmtnumOptions = "2z",
) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    value = dn.from(value);
  }

  // resolve alias for options.digits
  if (typeof optionsOrPreset === "number") {
    optionsOrPreset = { digits: optionsOrPreset };
  }

  // resolve alias for options.preset
  if (isFmtnumPresetName(optionsOrPreset)) {
    optionsOrPreset = { preset: optionsOrPreset };
  }

  // apply options.preset
  if (optionsOrPreset.preset) {
    optionsOrPreset = {
      ...fmtnumPresets[optionsOrPreset.preset],
      ...optionsOrPreset,
    };
  }

  const {
    dust = true,
    prefix = "",
    preset,
    scale = 1,
    suffix = "",
    ...dnOptions
  } = optionsOrPreset;

  // apply scale
  if (scale !== 1) {
    value = dn.mul(value, scale);
  }

  const formatted = dn.format(value, {
    ...dnOptions,
    locale: "en-US",
  });

  // show eg. 0.0001 as <0.01 rather than 0.00
  if (
    dust
    && dnOptions.signDisplay === undefined // don’t use with +- signs
    && dnOptions.digits !== undefined // don’t use with full precision
    && dnOptions.compact !== true // don’t use with compact
    && dnOptions.digits > 0 // no dust for integers
    && value[0] > 0n // only positive numbers
    && (formatted === "0" || formatted === `0.${"0".repeat(dnOptions.digits)}`)
  ) {
    return `<${prefix}0.${"0".repeat(dnOptions.digits - 1)}1${suffix}`;
  }

  return prefix + formatted + suffix;
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

export function formatDate(date: Date, format: "full" | "iso" = "full") {
  if (format === "full") {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
  }
  if (format === "iso") {
    return date.toISOString();
  }
  throw new Error(`Invalid date format: ${format}`);
}
