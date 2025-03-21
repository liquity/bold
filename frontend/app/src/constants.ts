"use client";

import type { CollateralSymbol, RiskLevel } from "@/src/types";

import { CHAIN_ID, CHECK_LEGACY_POSITIONS } from "@/src/env";
import { norm } from "@liquity2/uikit";
import * as dn from "dnum";

export const ONE_SECOND = 1000;
export const ONE_MINUTE = 60 * ONE_SECOND;
export const ONE_HOUR = 60 * ONE_MINUTE;
export const ONE_DAY = 24 * ONE_HOUR;

export const GAS_MIN_HEADROOM = 100_000;
export const GAS_RELATIVE_HEADROOM = 0.25;
export const GAS_ALLOCATE_LQTY_MIN_HEADROOM = 350_000;

export const LOCAL_STORAGE_PREFIX = "liquity2:";

export const LEVERAGE_FACTOR_MIN = 1.1;

export const MAX_LTV_ALLOWED_RATIO = 0.916; // ratio of the max LTV allowed by the app (when opening a position)
export const MAX_LTV_RESERVE_RATIO = 0.04; // ratio of the max LTV in non-limited mode (e.g. when updating a position), to prevent reaching the max LTV

export const ETH_MAX_RESERVE = dn.from(0.1, 18); // leave 0.1 ETH when users click on "max" to deposit from their account

export const ETH_GAS_COMPENSATION = dn.from(0.0375, 18); // see contracts/src/Dependencies/Constants.sol

export const INTEREST_RATE_ADJ_COOLDOWN = 7 * 24 * 60 * 60; // 7 days in seconds

// interest rate field config
export const INTEREST_RATE_START = 0.005; // 0.5%
export const INTEREST_RATE_END = 0.25; // 25%
export const INTEREST_RATE_DEFAULT = 0.1; // 10%
export const INTEREST_RATE_PRECISE_UNTIL = 0.1; // use precise increments until 10%
export const INTEREST_RATE_INCREMENT_PRECISE = 0.001; // 0.1% increments (precise)
export const INTEREST_RATE_INCREMENT_NORMAL = 0.005; // 0.5% increments (normal)

export const SP_YIELD_SPLIT = 75n * 10n ** 16n; // 75%

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

// TODO: use mainnet addresses
export const LEGACY_CHECK = !CHECK_LEGACY_POSITIONS || CHAIN_ID !== 11155111 ? null : {
  BOLD_TOKEN: "0xb01d32c05f4aa066eef2bfd4d461833fddd56d0a",
  COLLATERAL_REGISTRY: "0x55cefb9c04724ba3c67d92df5e386c6f1585a83b",
  GOVERNANCE: "0xe3f9ca5398cc3d0099c3ad37d3252e37431555b8",
  INITIATIVES_SNAPSHOT_URL: "/initiatives-snapshot-sepolia.json",
  TROVES_SNAPSHOT_URL: "/troves-snapshot-sepolia.json",
  BRANCHES: [{
    symbol: "ETH",
    name: "ETH",
    COLL_TOKEN: "0x8116d0a0e8d4f0197b428c520953f302adca0b50",
    LEVERAGE_ZAPPER: "0x482bf4d6a2e61d259a7f97ef6aac8b3ce5dd9f99",
    STABILITY_POOL: "0x89fb98c98792c8b9e9d468148c6593fa0fc47b40",
    TROVE_MANAGER: "0x364038750236739e0cd96d5754516c9b8168fb0c",
  }, {
    symbol: "WSTETH",
    name: "wstETH",
    COLL_TOKEN: "0xff9f477b09c6937ff6313ae90e79022609851a9c",
    LEVERAGE_ZAPPER: "0xea7fb1919bf9bae007df10ad8b748ee75fd5971d",
    STABILITY_POOL: "0x68320bd4bbc16fe14f91501380edaa9ffe5890e1",
    TROVE_MANAGER: "0xa7b57913b5643025a15c80ca3a56eb6fb59d095d",
  }, {
    symbol: "RETH",
    name: "rETH",
    COLL_TOKEN: "0xbdb72f78302e6174e48aa5872f0dd986ed6d98d9",
    LEVERAGE_ZAPPER: "0x251dfe2078a910c644289f2344fac96bffea7c02",
    STABILITY_POOL: "0x8492ad1df9f89e4b6c54c81149058172592e1c94",
    TROVE_MANAGER: "0x310fa1d1d711c75da45952029861bcf0d330aa81",
  }],
} as const;
