import type { Address, CollateralSymbol, CollateralToken, Token, TokenSymbol } from "@liquity2/uikit";
import type { CollateralContracts } from "@/src/contracts";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

export type { Address, CollateralSymbol, Dnum, Token, TokenSymbol };

export type RiskLevel = "low" | "medium" | "high";

export type CollIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type TroveId = `0x${string}`;
export type PrefixedTroveId = `${CollIndex}:${TroveId}`;

export type Branch = CollateralToken & {
  id: CollIndex;
  contracts: CollateralContracts;
};

export function isCollIndex(value: unknown): value is CollIndex {
  return typeof value === "number" && value >= 0 && value <= 7;
}

export function isTroveId(value: unknown): value is TroveId {
  return typeof value === "string" && /^0x[0-9a-f]+$/.test(value);
}

export function isPrefixedtroveId(value: unknown): value is PrefixedTroveId {
  return typeof value === "string" && /^[0-9]:0x[0-9a-f]+$/.test(value);
}

// Utility type to get type-safe entries of an object,
// to be used like this: Object.entries(o) as Entries<typeof o>)
export type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

export type MenuSection = {
  actions: Array<{
    href: string;
    name: ReactNode;
    secondary: ReactNode;
    token: Token["symbol"];
  }>;
  href: string;
  label: ReactNode;
};

export type PositionLoanBase = {
  // TODO: rename the type to "loan" and move "borrow" | "multiply" to
  // a "mode" field. The two separate types come from a previous design
  // where the two types of positions were having separate types.
  type: "borrow" | "multiply";
  batchManager: null | Address;
  borrowed: Dnum;
  borrower: Address;
  collIndex: CollIndex;
  deposit: Dnum;
  interestRate: Dnum;
  status:
    | "active"
    | "closed"
    | "liquidated"
    | "redeemed";
};

export type PositionLoanCommitted = PositionLoanBase & {
  troveId: TroveId;
  updatedAt: number;
  createdAt: number;
};

export type PositionLoanUncommitted = PositionLoanBase & {
  troveId: null;
};

export type PositionLoan = PositionLoanCommitted | PositionLoanUncommitted;

export function isPositionLoan(position: Position): position is PositionLoan {
  return position.type === "borrow" || position.type === "multiply";
}
export function isPositionLoanCommitted(
  position: Position,
): position is PositionLoanCommitted {
  return isPositionLoan(position) && position.troveId !== null;
}
export function isPositionLoanUncommitted(
  position: Position,
): position is PositionLoanUncommitted {
  return isPositionLoan(position) && position.troveId === null;
}

export type PositionEarn = {
  type: "earn";
  owner: Address;
  collIndex: CollIndex;
  deposit: Dnum;
  rewards: {
    usnd: Dnum;
    coll: Dnum;
  };
};

export type PositionStake = {
  type: "stake";
  owner: Address;
  deposit: Dnum;
  share: Dnum;
  totalStaked: Dnum;
  rewards: {
    lusd: Dnum;
    eth: Dnum;
  };
};

export type PositionYusnd = {
  type: "yusnd";
  usnd: Dnum;
  owner: Address;
  yusnd: Dnum;
};

export type Position = PositionLoan | PositionEarn | PositionStake | PositionYusnd;

export type Delegate = {
  address: Address;
  boldAmount: Dnum;
  fee?: Dnum;
  followers: number;
  id: string;
  interestRate: Dnum;
  interestRateChange: [Dnum, Dnum];
  lastDays: number;
  name: string;
  redemptions: Dnum;
};

export type LoanDetails = {
  collPrice: Dnum | null;
  debt: Dnum | null;
  deposit: Dnum | null;
  depositPreLeverage: Dnum | null;
  depositToZero: Dnum | null;
  depositUsd: Dnum | null;
  interestRate: Dnum | null;
  leverageFactor: number | null;
  liquidationPrice: Dnum | null;
  liquidationRisk: RiskLevel | null;
  ltv: Dnum | null;
  maxDebt: Dnum | null;
  maxDebtAllowed: Dnum | null;
  maxLtv: Dnum;
  maxLtvAllowed: Dnum;
  redemptionRisk: RiskLevel | null;
  status:
    | null
    | "healthy"
    | "at-risk" // above the max LTV allowed by the app when opening
    | "liquidatable" // above the max LTV before liquidation
    | "underwater"; // above 100% LTV
};

// governance
export type Initiative =
  & {
    address: Address;
    name: string | null;
    protocol: string | null;
  }
  & (
    | { tvl: Dnum; pairVolume: Dnum; votesDistribution: Dnum }
    | { tvl: null; pairVolume: null; votesDistribution: null }
  );

export type Vote = "for" | "against";
export type VoteAllocation = { vote: Vote | null; value: Dnum };
export type VoteAllocations = Record<Address, VoteAllocation>;

export interface CombinedTroveData {
  id: bigint;
  entireDebt: bigint;
  entireColl: bigint;
  redistBoldDebtGain: bigint;
  redistCollGain: bigint;
  accruedInterest: bigint;
  recordedDebt: bigint;
  annualInterestRate: bigint;
  accruedBatchManagementFee: bigint;
  lastInterestRateAdjTime: bigint;
  stake: bigint;
  lastDebtUpdateTime: bigint;
  interestBatchManager: Address;
  batchDebtShares: bigint;
  snapshotETH: bigint;
  snapshotBoldDebt: bigint;
}

export interface ReturnCombinedTroveReadCallData {
  id: string;
  troveId: string;
  borrower: Address;
  debt: bigint;
  deposit: bigint;
  interestRate: bigint;
  status: TroveStatus;
  collateral: {
    id: string;
    token: {
      symbol: string;
      name: string;
    };
    minCollRatio: number;
    collIndex: number;
  }
  interestBatch: {
    annualInterestRate: bigint;
    batchManager: Address;
  }
  entireDebt: bigint;
  entireColl: bigint;
  redistBoldDebtGain: bigint;
  redistCollGain: bigint;
  accruedInterest: bigint;
  recordedDebt: bigint;
  annualInterestRate: bigint;
  accruedBatchManagementFee: bigint;
  lastInterestRateAdjTime: bigint;
  stake: bigint;
  lastDebtUpdateTime: bigint;
  interestBatchManager: Address;
  batchDebtShares: bigint;
  snapshotETH: bigint;
  snapshotBoldDebt: bigint;
}

export type DebtPerInterestRate = {
  interestBatchManager: Address;
  interestRate: bigint;
  debt: bigint;
}

export enum TroveStatus {
  nonExistent,
  active,
  closedByOwner,
  closedByLiquidation,
  zombie
}

export interface Trove {
  debt: bigint;
  coll: bigint;
  stake: bigint;
  status: TroveStatus;
  arrayIndex: bigint;
  lastDebtUpdateTime: bigint;
  lastInterestRateAdjTime: bigint;
  annualInterestRate: bigint;
  interestBatchManager: Address;
  batchDebtShares: bigint;
}

export interface ReturnTroveReadCallData extends Trove {
  id: string;
  troveId: string;
  borrower: Address;
  deposit: bigint;
  interestRate: bigint;
  collateral: {
    id: string;
    token: {
      symbol: string;
      name: string;
    };
    minCollRatio: number;
    collIndex: number;
  }
  interestBatch: {
    annualInterestRate: bigint;
    batchManager: Address;
  }
}