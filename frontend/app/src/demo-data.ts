import type { Position, PositionLoan, RiskLevel } from "@/src/types";

import * as dn from "dnum";

export const LQTY_PRICE = dn.from(1.54832, 18);
export const ETH_PRICE = dn.from(3_839.293872, 18);
export const BOLD_PRICE = dn.from(1.0031, 18);

export const STAKED_LQTY_TOTAL = [43_920_716_739_092_664_364_409_174n, 18] as const;

// ltv risk levels
export const LTV_RISK: Record<RiskLevel, number> = {
  low: 0,
  medium: 0.5,
  high: 0.7,
};

// redemption risk levels
export const REDEMPTION_RISK: Record<RiskLevel, number> = {
  high: 0,
  medium: 3.5,
  low: 5.0,
};

export const ACCOUNT_STAKED_LQTY = {
  deposit: [100n * 10n ** 18n, 18] as const,
  rewardEth: dn.from(0.0054, 18),
  rewardLusd: dn.from(234.24, 18),
} as const;

export const ACCOUNT_BALANCES = {
  BOLD: dn.from(3_987, 18),
  ETH: dn.from(2.429387, 18),
  LQTY: dn.from(208.987, 18),
  RETH: dn.from(1.3732, 18),
  WSTETH: dn.from(17.912, 18),
} as const;

function addLtv(loan: Omit<PositionLoan, "ltv">): PositionLoan {
  const depositUsd = dn.mul(loan.deposit, ETH_PRICE);
  return {
    ...loan,
    ltv: dn.div(loan.borrowed, depositUsd),
  };
}

export const ACCOUNT_POSITIONS: Position[] = [
  addLtv({
    type: "loan",
    borrowed: dn.from(25_789, 18),
    collateral: "RETH",
    deposit: dn.from(5.5, 18),
    interestRate: dn.from(0.057, 18),
    troveId: 1n,
  }),
  addLtv({
    type: "loan",
    borrowed: dn.from(1000, 18),
    collateral: "ETH",
    deposit: dn.from(1, 18),
    interestRate: dn.from(0.057, 18),
    troveId: 2n,
  }),
  {
    type: "earn",
    apy: dn.from(0.078, 18),
    collateral: "WSTETH",
    deposit: dn.from(5_000, 18),
    rewards: {
      bold: dn.from(25_789, 18),
      eth: dn.from(0.943, 18),
    },
  },
];

export const BORROW_STATS = {
  ETH: {
    borrowRate: dn.from(0.05, 18),
    tvl: dn.from(75_000_000, 18),
  },
  RETH: {
    borrowRate: dn.from(0.04, 18),
    tvl: dn.from(55_000_000, 18),
  },
  WSTETH: {
    borrowRate: dn.from(0.055, 18),
    tvl: dn.from(45_000_000, 18),
  },
} as const;

export const EARN_POOLS = {
  ETH: {
    apy: dn.from(0.068, 18),
    boldQty: [65_700_000n, 0],
  },
  RETH: {
    apy: dn.from(0.057, 18),
    boldQty: [44_100_000n, 0],
  },
  WSTETH: {
    apy: dn.from(0.054, 18),
    boldQty: [25_700_000n, 0],
  },
} as const;

export const POOLS = [
  {
    symbol: "ETH",
    token: "ETH",
    apy: "6.8%",
    boldQty: "65.7M BOLD",
    deposit: "21,453.00 BOLD",
    rewards: {
      bold: "234.24",
      eth: "0.0054",
    },
  },
  {
    symbol: "RETH",
    token: "rETH",
    apy: "5.7%",
    boldQty: "65.7M BOLD",
    deposit: null,
    rewards: null,
  },
  {
    symbol: "WSTETH",
    token: "wstETH",
    apy: "5.4%",
    boldQty: "65.7M BOLD",
    deposit: null,
    rewards: null,
  },
] as const;
