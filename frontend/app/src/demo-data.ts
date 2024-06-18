import type { Position } from "@/src/types";
import type { CollateralToken } from "@liquity2/uikit";
import type { Dnum } from "dnum";

import * as dn from "dnum";

export const LQTY_PRICE = dn.from(1.54832, 18);
export const ETH_PRICE = dn.from(3_839.293872, 18);
export const RETH_PRICE = dn.from(4_228.72294, 18);
export const STETH_PRICE = dn.from(4_441.931, 18);
export const BOLD_PRICE = dn.from(1.0031, 18);

export const STAKED_LQTY_TOTAL = [43_920_716_739_092_664_364_409_174n, 18] as const;

export const ACCOUNT_STAKED_LQTY = {
  deposit: dn.from(3414, 18),
  rewardEth: dn.from(0.0054, 18),
  rewardLusd: dn.from(234.24, 18),
} as const;

export const ACCOUNT_BALANCES = {
  BOLD: dn.from(3_987, 18),
  ETH: dn.from(2.429387, 18),
  LQTY: dn.from(2008.217, 18),
  RETH: dn.from(1.3732, 18),
  STETH: dn.from(17.912, 18),
} as const;

export const ACCOUNT_POSITIONS: Position[] = [
  {
    type: "loan",
    borrowed: dn.from(12_789, 18),
    collateral: "RETH",
    deposit: dn.from(5.5, 18),
    interestRate: dn.from(0.067, 18),
    troveId: 1n,
  },
  {
    type: "loan",
    borrowed: dn.from(1000, 18),
    collateral: "ETH",
    deposit: dn.from(1, 18),
    interestRate: dn.from(0.045, 18),
    troveId: 2n,
  },
  {
    type: "earn",
    apr: dn.from(0.078, 18),
    collateral: "STETH",
    deposit: dn.from(5_000, 18),
    rewards: {
      bold: dn.from(789.438, 18),
      eth: dn.from(0.943, 18),
    },
  },
];

export const BORROW_STATS = {
  ETH: {
    borrowRate: dn.from(0.05, 18),
    tvl: dn.from(75_827_387.87, 18),
  },
  RETH: {
    borrowRate: dn.from(0.04, 18),
    tvl: dn.from(55_782_193.37, 18),
  },
  STETH: {
    borrowRate: dn.from(0.055, 18),
    tvl: dn.from(45_037_108.91, 18),
  },
} as const;

export const EARN_POOLS: Record<
  CollateralToken["symbol"],
  { apr: Dnum; boldQty: Dnum }
> = {
  ETH: {
    apr: dn.from(0.068, 18),
    boldQty: [65_700_000n, 0],
  },
  RETH: {
    apr: dn.from(0.057, 18),
    boldQty: [44_100_000n, 0],
  },
  STETH: {
    apr: dn.from(0.054, 18),
    boldQty: [25_700_000n, 0],
  },
};
