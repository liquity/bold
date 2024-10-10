import type { Address, CollateralSymbol, Token, TokenSymbol } from "@liquity2/uikit";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

export type { Address, CollateralSymbol, Dnum, Token, TokenSymbol };

export type RiskLevel = "low" | "medium" | "high";

export type CollIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type TroveId = `0x${string}`;
export type PrefixedTroveId = `${CollIndex}:${TroveId}`;

export function isCollIndex(value: unknown): value is CollIndex {
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

export type PositionLoan = {
  type: "borrow" | "leverage";
  borrowed: Dnum;
  collIndex: CollIndex;
  collateral: CollateralSymbol;
  deposit: Dnum;
  interestRate: Dnum;
  troveId: TroveId;
};

export function isPositionLoan(position: Position): position is PositionLoan {
  return position.type === "borrow" || position.type === "leverage";
}

export type PositionEarn = {
  type: "earn";
  apr: Dnum;
  collIndex: CollIndex;
  deposit: Dnum;
  rewards: {
    bold: Dnum;
    coll: Dnum;
  };
};

export type PositionStake = {
  type: "stake";
  deposit: Dnum;
  rewards: {
    lusd: Dnum;
    eth: Dnum;
  };
};

export type Position = PositionLoan | PositionEarn | PositionStake;

export type Delegate = {
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
