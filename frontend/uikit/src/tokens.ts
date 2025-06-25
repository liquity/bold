import tokenBold from "./token-icons/bold.svg";
import tokenEth from "./token-icons/eth.svg";
import tokenLqty from "./token-icons/lqty.svg";
import tokenLusd from "./token-icons/lusd.svg";
import tokenReth from "./token-icons/reth.svg";
import tokenSbold from "./token-icons/sbold.svg";
import tokenSteth from "./token-icons/wsteth.svg";

// any external token, without a known symbol
export type ExternalToken = {
  icon: string;
  name: string;
  symbol: string;
};

// a token with a known symbol (TokenSymbol)
export type Token = ExternalToken & {
  icon: string;
  name: string;
  symbol: TokenSymbol;
};

export type TokenSymbol =
  | "BOLD"
  | "ETH"
  | "LQTY"
  | "LUSD"
  | "RETH"
  | "SBOLD"
  | "WSTETH";

export type CollateralSymbol =
  & TokenSymbol
  & (
    | "ETH"
    | "RETH"
    | "WSTETH"
  );

export function isTokenSymbol(symbolOrUrl: string): symbolOrUrl is TokenSymbol {
  return (
    symbolOrUrl === "BOLD"
    || symbolOrUrl === "ETH"
    || symbolOrUrl === "LQTY"
    || symbolOrUrl === "LUSD"
    || symbolOrUrl === "RETH"
    || symbolOrUrl === "SBOLD"
    || symbolOrUrl === "WSTETH"
  );
}

export function isCollateralSymbol(symbol: string): symbol is CollateralSymbol {
  return (
    symbol === "ETH"
    || symbol === "RETH"
    || symbol === "WSTETH"
  );
}

export type CollateralToken = Token & {
  collateralRatio: number;
  symbol: CollateralSymbol;
};

export const LUSD: Token = {
  icon: tokenLusd,
  name: "LUSD",
  symbol: "LUSD" as const,
} as const;

export const BOLD: Token = {
  icon: tokenBold,
  name: "BOLD",
  symbol: "BOLD" as const,
} as const;

export const LQTY: Token = {
  icon: tokenLqty,
  name: "LQTY",
  symbol: "LQTY" as const,
} as const;

export const SBOLD: Token = {
  icon: tokenSbold,
  name: "sBOLD",
  symbol: "SBOLD" as const,
} as const;

export const ETH: CollateralToken = {
  collateralRatio: 1.1,
  icon: tokenEth,
  name: "ETH",
  symbol: "ETH" as const,
} as const;

export const RETH: CollateralToken = {
  collateralRatio: 1.2,
  icon: tokenReth,
  name: "rETH",
  symbol: "RETH" as const,
} as const;

export const WSTETH: CollateralToken = {
  collateralRatio: 1.2,
  icon: tokenSteth,
  name: "wstETH",
  symbol: "WSTETH" as const,
} as const;

export const COLLATERALS: CollateralToken[] = [
  ETH,
  RETH,
  WSTETH,
];

export const TOKENS_BY_SYMBOL = {
  BOLD,
  ETH,
  LQTY,
  LUSD,
  RETH,
  SBOLD,
  WSTETH,
} as const;
