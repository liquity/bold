import type { Address, CollateralSymbol, Token, TokenSymbol } from "@liquity2/uikit";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";
import type { BranchContracts } from "./contracts";

export type { Address, CollateralSymbol, Dnum, Token, TokenSymbol };

export type RiskLevel = "low" | "medium" | "high";

export type ChainId = number;

export type BranchId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type TroveId = `0x${string}`;
export type PrefixedTroveId = `${BranchId}:${TroveId}`;

export type Branch = {
  id: BranchId;
  contracts: BranchContracts;
  branchId: BranchId; // to be removed, use `id` instead
  symbol: CollateralSymbol;
  strategies: Array<{ address: Address; name: string }>;
};

export type EnvBranch = Omit<Branch, "contracts">;

export function isBranchId(value: unknown): value is BranchId {
  return typeof value === "number" && value >= 0 && value <= 9;
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

export type TroveStatus =
  | "active"
  | "closed"
  | "liquidated"
  | "redeemed";

export type PositionLoanBase = {
  // TODO: rename the type to "loan" and move "borrow" | "multiply" to
  // a "mode" field. The two separate types come from a previous design
  // where the two types of positions were having separate types.
  type: "borrow" | "multiply";
  batchManager: null | Address;
  borrowed: Dnum;
  borrower: Address;
  branchId: BranchId;
  deposit: Dnum;
  interestRate: Dnum;
  status: TroveStatus;
};

export type PositionLoanCommitted = PositionLoanBase & {
  troveId: TroveId;
  createdAt: number;
  lastUserActionAt: number;
  isZombie: boolean;
  indexedDebt: Dnum;
  redemptionCount: number;
  redeemedColl: Dnum;
  redeemedDebt: Dnum;
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
  branchId: BranchId;
  deposit: Dnum;
  rewards: {
    bold: Dnum;
    coll: Dnum;
  };
};

export type PositionStake = {
  type: "stake";
  owner: Address;
  deposit: Dnum;
  rewards: {
    lusd: Dnum;
    eth: Dnum;
  };
};

export type PositionSbold = {
  type: "sbold";
  bold: Dnum;
  owner: Address;
  sbold: Dnum;
};

export type Position =
  | PositionEarn
  | PositionLoan
  | PositionSbold
  | PositionStake;

export type Delegate = {
  address: Address;
  boldAmount: Dnum;
  fee?: Dnum;
  id: string;
  interestRate: Dnum;
  interestRateChange: {
    min: Dnum;
    max: Dnum;
    period: bigint;
  };
  name: string;
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
    url: string | null;
  }
  & (
    | { tvl: Dnum; pairVolume: Dnum; votesDistribution: Dnum }
    | { tvl: null; pairVolume: null; votesDistribution: null }
  );

export type Vote = "for" | "against";
export type VoteAllocation = { vote: Vote | null; value: Dnum };
export type VoteAllocations = Record<Address, VoteAllocation>;

export type IcStrategy = {
  address: Address;
  name: string;
};
