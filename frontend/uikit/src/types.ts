export type Address = `0x${string}`;

export type Direction = -1 | 1;

export type TokenSymbol =
  | "USND"
  | "NERI"
  | "ETH"
  | "LQTY"
  | "RETH"
  | "LUSD"
  | "WSTETH"
  | "COMP"
  | "ARB"
  | "RSETH"
  | "TBTC"
  | "WETH"
  | "WEETH"
  | "YUSND"
  | "SUP";

export type Token = {
  icon: string;
  name: string;
  symbol: TokenSymbol;
};

export type StatusMode = "positive" | "warning" | "negative" | "neutral";
