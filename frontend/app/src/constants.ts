"use client";

import type { BranchId, ChainId, CollateralSymbol, IcStrategy, RiskLevel } from "@/src/types";

import { vEnvLegacyCheck } from "@/src/valibot-utils";
import { WHITE_LABEL_CONFIG } from "@/src/white-label.config";
import { getDeploymentInfo } from "@/src/white-label-utils";
import { norm } from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";

// make sure the icons in /public/fork-icons/
// are 54x54px, especially for PNGs.
export const FORKS_INFO = [
  ["Felix", "/fork-icons/felix.png"],
  ["Orki Finance", "/fork-icons/orki.svg"],
  ["Quill Finance", "/fork-icons/quill.svg"],
] as const;

// TODO: make it possible to override this in the env
export const TOKEN_ICON_URL = "https://assets.smold.app/api/token/{chainId}/{tokenAddress}/logo.svg";

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
export const DATA_STALE_TIME = 5_000;

export const LEVERAGE_MAX_SLIPPAGE = 0.05; // 5%
export const CLOSE_FROM_COLLATERAL_SLIPPAGE = 0.05; // 5%
export const MAX_UPFRONT_FEE = 1000n * 10n ** 18n;
export const MIN_DEBT = dn.from(2000, 18);

export const TROVE_STATUS_NONEXISTENT = 0;
export const TROVE_STATUS_ACTIVE = 1;
export const TROVE_STATUS_CLOSED_BY_OWNER = 2;
export const TROVE_STATUS_CLOSED_BY_LIQUIDATION = 3;
export const TROVE_STATUS_ZOMBIE = 4;

// Generate MAX_COLLATERAL_DEPOSITS from config
export const MAX_COLLATERAL_DEPOSITS: Record<CollateralSymbol, dn.Dnum> = Object.fromEntries(
  WHITE_LABEL_CONFIG.tokens.collaterals.map(collateral => [
    collateral.symbol,
    dn.from(BigInt(collateral.maxDeposit), 18),
  ])
) as Record<CollateralSymbol, dn.Dnum>;

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

// redemption risk levels, as debt positioning ratios
export const REDEMPTION_RISK: Record<Exclude<RiskLevel, "high">, number> = {
  medium: 0.05, // 5% of total debt in front
  low: 0.60, // 60% of total debt in front
};

// Generate DEFAULT_LEGACY_CHECKS from white-label config
export const DEFAULT_LEGACY_CHECKS = new Map<
  ChainId,
  Exclude<v.InferOutput<ReturnType<typeof vEnvLegacyCheck>>, boolean>
>([
  // mainnet
  [1, {
    ...getDeploymentInfo(1),
    INITIATIVES_SNAPSHOT_URL: "/initiatives-snapshot-1.json",
    TROVES_SNAPSHOT_URL: "/troves-snapshot-1.json",
  }],
  // sepolia
  [11155111, {
    ...getDeploymentInfo(11155111),
    INITIATIVES_SNAPSHOT_URL: "/initiatives-snapshot-11155111.json",
    TROVES_SNAPSHOT_URL: "/troves-snapshot-11155111.json",
  }],
]);

// default COLL_$INDEX_IC_STRATEGIES values when not set by the env
export const DEFAULT_STRATEGIES: Array<[
  ChainId,
  Array<[BranchId, IcStrategy[]]>,
]> = [
  // mainnet
  [1, [
    // ETH
    [0, [{
      name: "Conservative Strategy",
      address: "0xE507E4d0763851A6287238aadD243948D18AB60a",
    }]],
    // WSTETH
    [1, [{
      name: "Conservative Strategy",
      address: "0x8869a6FB59a8Df330F90D9Fbf46eBfaFf6D4BC14",
    }]],
    // RETH
    [2, [{
      name: "Conservative Strategy",
      address: "0x7700B2D305f47aE82e9598BAb6D7CCb57299A82b",
    }]],
  ]],
];

export const DEFAULT_COMMIT_URL = "https://github.com/liquity/bold/tree/{commit}";
export const DEFAULT_VERSION_URL = "https://github.com/liquity/bold/releases/tag/%40liquity2%2Fapp-v{version}";
