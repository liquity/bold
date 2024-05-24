import type { Token } from "@liquity2/uikit";
import type { ReactNode } from "react";

export type TroveId = bigint;

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
