import type { Address, CollateralSymbol, Token } from "@liquity2/uikit";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

export type { Address, CollateralSymbol, Dnum, Token };

export type RiskLevel = "low" | "medium" | "high";

export type TroveId = `0x${string}`;

export function isTroveId(value: unknown): value is TroveId {
  return typeof value === "string" && /^0x[0-9a-f]+$/.test(value);
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
  collateral: CollateralSymbol;
  deposit: Dnum;
  rewards: {
    bold: Dnum;
    eth: Dnum;
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
