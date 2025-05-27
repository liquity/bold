export type Address = `0x${string}`;

export type Direction = -1 | 1;

export type TokenSymbol =
  | "BOLD"
  | "ETH"
  | "LQTY"
  | "LUSD"
  | "RETH"
  | "SBOLD"
  | "WSTETH";

export type Token = {
  icon: string;
  name: string;
  symbol: TokenSymbol;
};

export type StatusMode = "positive" | "warning" | "negative" | "neutral";
