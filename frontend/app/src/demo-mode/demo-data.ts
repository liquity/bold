import type { Delegate, Position } from "@/src/types";
import type { CollateralToken } from "@liquity2/uikit";
import type { Dnum } from "dnum";

import { INTEREST_RATE_INCREMENT, INTEREST_RATE_MAX, INTEREST_RATE_MIN } from "@/src/constants";
import * as dn from "dnum";

export const LOAN_SCREEN_MANUAL_LOADING_STATE = false;

export const PRICE_UPDATE_INTERVAL = 15_000;
export const PRICE_UPDATE_VARIATION = 0.003;
export const PRICE_UPDATE_MANUAL = false;

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
  LUSD: dn.from(1_200, 18),
} as const;

export const ACCOUNT_POSITIONS: Position[] = [
  {
    type: "borrow",
    borrowed: dn.from(12_789, 18),
    collateral: "RETH",
    deposit: dn.from(5.5, 18),
    interestRate: dn.from(0.067, 18),
    troveId: "0x01",
    collIndex: 1,
  },
  {
    type: "leverage",
    borrowed: dn.from(28_934.23, 18),
    collateral: "ETH",
    deposit: dn.from(19.20, 18), // 8 ETH @ 2.4 leverage
    interestRate: dn.from(0.045, 18),
    troveId: "0x02",
    collIndex: 0,
  },
  {
    type: "earn",
    apr: dn.from(0.078, 18),
    deposit: dn.from(5_000, 18),
    collIndex: 0,
    rewards: {
      bold: dn.from(789.438, 18),
      coll: dn.from(0.943, 18),
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
  const rate = Math.round(
    (INTEREST_RATE_MIN + i * INTEREST_RATE_INCREMENT) * 10,
  ) / 10;
  const baseFactor = 1 - Math.pow((i / (RATE_STEPS - 1) - 0.5) * 2, 2);
  return [
    rate,
    dn.from(Math.pow(baseFactor * Math.random(), 2) * BUCKET_SIZE_MAX, 18),
  ];
}) as Array<[number, dn.Dnum]>;

export const INTEREST_CHART = INTEREST_RATE_BUCKETS.map(([_, size]) => (
  Math.max(
    0.1,
    dn.toNumber(size) / Math.max(
      ...INTEREST_RATE_BUCKETS.map(([_, size]) => dn.toNumber(size)),
    ),
  )
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

export const DELEGATES: Delegate[] = [
  {
    id: "0x01",
    name: "DeFi Saver",
    interestRate: dn.from(0.065, 18),
    followers: 1202,
    boldAmount: dn.from(25_130_000, 18),
    lastDays: 180,
    redemptions: dn.from(900_000, 18),
    interestRateChange: [
      dn.from(0.028, 18),
      dn.from(0.0812, 18),
    ],
  },
  {
    id: "0x02",
    name: "Yield Harbor",
    interestRate: dn.from(0.041, 18),
    followers: 700,
    boldAmount: dn.from(15_730_000, 18),
    lastDays: 180,
    redemptions: dn.from(2_600_000, 18),
    interestRateChange: [
      dn.from(0.032, 18),
      dn.from(0.069, 18),
    ],
  },
  {
    id: "0x03",
    name: "Crypto Nexus",
    interestRate: dn.from(0.031, 18),
    followers: 500,
    boldAmount: dn.from(12_000_000, 18),
    lastDays: 180,
    redemptions: dn.from(1_200_000, 18),
    interestRateChange: [
      dn.from(0.025, 18),
      dn.from(0.078, 18),
    ],
  },
  {
    id: "0x04",
    name: "Block Ventures",
    interestRate: dn.from(0.021, 18),
    followers: 200,
    boldAmount: dn.from(7_000_000, 18),
    lastDays: 180,
    redemptions: dn.from(1_280_000, 18),
    interestRateChange: [
      dn.from(0.018, 18),
      dn.from(0.065, 18),
    ],
  },
  {
    id: "0x05",
    name: "Chain Gains",
    interestRate: dn.from(0.011, 18),
    followers: 100,
    boldAmount: dn.from(3_000_000, 18),
    lastDays: 47,
    redemptions: dn.from(1_100_000, 18),
    interestRateChange: [
      dn.from(0.009, 18),
      dn.from(0.058, 18),
    ],
  },
  {
    id: "0x06",
    name: "TokenTrust",
    interestRate: dn.from(0.001, 18),
    followers: 50,
    boldAmount: dn.from(1_000_000, 18),
    lastDays: 180,
    redemptions: dn.from(334_000, 18),
    interestRateChange: [
      dn.from(0.001, 18),
      dn.from(0.043, 18),
    ],
  },
  {
    id: "0x07",
    name: "Yield Maximizer",
    interestRate: dn.from(0.072, 18),
    followers: 1500,
    boldAmount: dn.from(30_000_000, 18),
    lastDays: 180,
    redemptions: dn.from(750_000, 18),
    interestRateChange: [
      dn.from(0.035, 18),
      dn.from(0.089, 18),
    ],
  },
  {
    id: "0x08",
    name: "Stable Growth",
    interestRate: dn.from(0.055, 18),
    followers: 980,
    boldAmount: dn.from(22_500_000, 18),
    lastDays: 180,
    redemptions: dn.from(1_100_000, 18),
    interestRateChange: [
      dn.from(0.041, 18),
      dn.from(0.072, 18),
    ],
  },
  {
    id: "0x09",
    name: "Risk Taker",
    interestRate: dn.from(0.089, 18),
    followers: 750,
    boldAmount: dn.from(18_000_000, 18),
    lastDays: 180,
    redemptions: dn.from(2_200_000, 18),
    interestRateChange: [
      dn.from(0.038, 18),
      dn.from(0.102, 18),
    ],
  },
  {
    id: "0x0a",
    name: "Conservative Gains",
    interestRate: dn.from(0.038, 18),
    followers: 620,
    boldAmount: dn.from(14_800_000, 18),
    lastDays: 180,
    redemptions: dn.from(500_000, 18),
    interestRateChange: [
      dn.from(0.029, 18),
      dn.from(0.061, 18),
    ],
  },
  {
    id: "0x0b",
    name: "Crypto Innovator",
    interestRate: dn.from(0.062, 18),
    followers: 890,
    boldAmount: dn.from(20_500_000, 18),
    lastDays: 180,
    redemptions: dn.from(1_500_000, 18),
    interestRateChange: [
      dn.from(0.033, 18),
      dn.from(0.085, 18),
    ],
  },
  {
    id: "0x0c",
    name: "DeFi Pioneer",
    interestRate: dn.from(0.075, 18),
    followers: 1100,
    boldAmount: dn.from(26_000_000, 18),
    lastDays: 180,
    redemptions: dn.from(1_800_000, 18),
    interestRateChange: [
      dn.from(0.037, 18),
      dn.from(0.091, 18),
    ],
  },
  {
    id: "0x0d",
    name: "Steady Returns",
    interestRate: dn.from(0.049, 18),
    followers: 780,
    boldAmount: dn.from(17_500_000, 18),
    lastDays: 180,
    redemptions: dn.from(600_000, 18),
    interestRateChange: [
      dn.from(0.036, 18),
      dn.from(0.067, 18),
    ],
  },
  {
    id: "0x0e",
    name: "Blockchain Believer",
    interestRate: dn.from(0.058, 18),
    followers: 850,
    boldAmount: dn.from(19_800_000, 18),
    lastDays: 180,
    redemptions: dn.from(1_300_000, 18),
    interestRateChange: [
      dn.from(0.031, 18),
      dn.from(0.076, 18),
    ],
  },
  {
    id: "0x0f",
    name: "Crypto Sage",
    interestRate: dn.from(0.069, 18),
    followers: 1300,
    boldAmount: dn.from(28_500_000, 18),
    lastDays: 180,
    redemptions: dn.from(950_000, 18),
    interestRateChange: [
      dn.from(0.034, 18),
      dn.from(0.088, 18),
    ],
  },
  {
    id: "0x10",
    name: "Bold Strategist",
    interestRate: dn.from(0.082, 18),
    followers: 970,
    boldAmount: dn.from(23_000_000, 18),
    lastDays: 180,
    redemptions: dn.from(2_500_000, 18),
    interestRateChange: [
      dn.from(0.039, 18),
      dn.from(0.098, 18),
    ],
  },
];

export const IC_STRATEGIES: Delegate[] = [
  {
    id: "0x11",
    name: "Conservative",
    interestRate: dn.from(0.065, 18),
    followers: 1202,
    boldAmount: dn.from(25_130_000, 18),
    lastDays: 180,
    redemptions: dn.from(900_000, 18),
    interestRateChange: [
      dn.from(0.028, 18),
      dn.from(0.0812, 18),
    ],
    fee: dn.from(0.00003, 18),
  },
];

// Delegates + IC strategies
export const DELEGATES_FULL = DELEGATES.concat(IC_STRATEGIES);
