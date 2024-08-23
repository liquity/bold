import type { Position } from "@/src/types";
import type { CollateralToken } from "@liquity2/uikit";
import type { Dnum } from "dnum";

import { INTEREST_RATE_INCREMENT, INTEREST_RATE_MAX, INTEREST_RATE_MIN } from "@/src/constants";
import * as dn from "dnum";

export const PRICE_UPDATE_INTERVAL = 15_000;
export const PRICE_UPDATE_VARIATION = 0.003;
export const PRICE_UPDATE_MANUAL = true;

export const LQTY_PRICE = dn.from(0.64832, 18);
export const ETH_PRICE = dn.from(2_580.293872, 18);
export const RETH_PRICE = dn.from(2_884.72294, 18);
export const STETH_PRICE = dn.from(2_579.931, 18);
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
    type: "borrow",
    borrowed: dn.from(12_789, 18),
    collateral: "RETH",
    deposit: dn.from(5.5, 18),
    interestRate: dn.from(0.067, 18),
    troveId: 1n,
  },
  {
    type: "leverage",
    borrowed: dn.from(28_934.23, 18),
    collateral: "ETH",
    deposit: dn.from(19.20, 18), // 8 ETH @ 2.4 leverage
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
  {
    type: "stake",
    deposit: dn.from(3414, 18),
    rewards: {
      lusd: dn.from(789.438, 18),
      eth: dn.from(0.943, 18),
    },
  },
];

export const BORROW_STATS = {
  ETH: {
    borrowRate: dn.from(0.05, 18),
    tvl: dn.from(75_827_387.87, 18),
    maxLtv: dn.div(dn.from(1, 18), 1.1),
  },
  RETH: {
    borrowRate: dn.from(0.04, 18),
    tvl: dn.from(55_782_193.37, 18),
    maxLtv: dn.div(dn.from(1, 18), 1.2),
  },
  STETH: {
    borrowRate: dn.from(0.055, 18),
    tvl: dn.from(45_037_108.91, 18),
    maxLtv: dn.div(dn.from(1, 18), 1.2),
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

const BUCKET_SIZE_MAX = 20_000_000;
const RATE_STEPS = Math.round((INTEREST_RATE_MAX - INTEREST_RATE_MIN) / INTEREST_RATE_INCREMENT) + 1;
export const INTEREST_RATE_BUCKETS = Array.from({ length: RATE_STEPS }, (_, i) => {
  const rate = Math.round((INTEREST_RATE_MIN + i * INTEREST_RATE_INCREMENT) * 10) / 10;
  const baseFactor = 1 - Math.pow((i / (RATE_STEPS - 1) - 0.5) * 2, 2);
  return [rate, dn.from(Math.pow(baseFactor * Math.random(), 2) * BUCKET_SIZE_MAX, 18)];
}) as Array<[number, dn.Dnum]>;

export const INTEREST_CHART = INTEREST_RATE_BUCKETS.map(([_, size]) => (
  Math.max(0.1, dn.toNumber(size) / Math.max(...INTEREST_RATE_BUCKETS.map(([_, size]) => dn.toNumber(size))))
));

export function getDebtBeforeRateBucketIndex(index: number) {
  let debt = dn.from(0, 18);
  for (let i = 0; i < index; i++) {
    if (!INTEREST_RATE_BUCKETS[i]) {
      break;
    }
    debt = dn.add(debt, INTEREST_RATE_BUCKETS[i][1]);
    if (i === index - 1) {
      break;
    }
  }
  return debt;
}
