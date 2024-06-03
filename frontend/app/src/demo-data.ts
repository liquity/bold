import type { Position } from "@/src/types";

import * as dn from "dnum";

export const LQTY_PRICE = dn.from(1.54832, 18);
export const ETH_PRICE = dn.from(3_839.293872, 18);
export const STAKED_LQTY_TOTAL = [43_920_716_739_092_664_364_409_174n, 18] as const;

export const ACCOUNT_STAKED_LQTY = {
  deposit: [100n * 10n ** 18n, 18] as const,
  rewardEth: dn.from(0.0054, 18),
  rewardLusd: dn.from(234.24, 18),
};

export const ACCOUNT_BALANCES = {
  eth: dn.from(2.429387, 18),
  lqty: dn.from(208.987, 18),
  bold: dn.from(3_987, 18),
};

export const ACCOUNT_POSITIONS: Position[] = [
  {
    type: "loan",
    borrowed: dn.from(25_789, 18),
    collateral: "RETH",
    deposit: dn.from(5.5, 18),
    interestRate: dn.from(0.057, 18),
    ltv: dn.from(0.61, 18),
    troveId: 1n,
  },
  {
    type: "loan",
    borrowed: dn.from(1000, 18),
    collateral: "ETH",
    deposit: dn.from(1, 18),
    interestRate: dn.from(0.057, 18),
    ltv: dn.from(0.61, 18),
    troveId: 2n,
  },
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

export const BORROW_FROM = {
  ETH: {
    avgIr: "5.6%",
    maxTvl: "91%",
  },
  RETH: {
    avgIr: "4.9%",
    maxTvl: "85%",
  },
  WSTETH: {
    avgIr: "4.1%",
    maxTvl: "80%",
  },
} as const;

export const LEVERAGE_FROM = {
  ETH: {
    avgIr: "4.6%",
    avgLeverage: "5.6x",
    maxLeverage: "7.2x",
  },
  RETH: {
    avgIr: "3.7%",
    avgLeverage: "6.2x",
    maxLeverage: "10.6x",
  },
  WSTETH: {
    avgIr: "3.0%",
    avgLeverage: "3.7x",
    maxLeverage: "3.9x",
  },
} as const;

export const EARN_POOLS = {
  ETH: {
    apy: [6_800n, 3],
    boldQty: [65_700_000n, 0],
  },
  RETH: {
    apy: [5_700n, 3],
    boldQty: [46_100_000n, 0],
  },
  WSTETH: {
    apy: [5_400n, 3],
    boldQty: [55_700_000n, 0],
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
