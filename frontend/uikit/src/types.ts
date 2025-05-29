export type Address = `0x${string}`;

export type Direction = -1 | 1;

export type TokenSymbol =
  | "USDN"
  | "NERI"
  | "ETH"
  | "LQTY"
  | "RETH"
  | "LUSD"
  | "WSTETH"
  | "COMP"
  | "SFRXETH"
  | "TBTC"
  | "TETH"
  | "WETH"
  | "WEETH";

export type Token = {
  icon: string;
  name: string;
  symbol: TokenSymbol;
};

export type StatusMode = "positive" | "warning" | "negative" | "neutral";
