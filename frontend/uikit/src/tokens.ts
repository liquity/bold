import type { Token } from "./types";

import tokenUSDN from "./token-icons/USDN.svg";
import tokenEth from "./token-icons/eth.svg";
import tokenLusd from "./token-icons/lusd.svg";
import tokenReth from "./token-icons/reth.svg";
import tokenSteth from "./token-icons/wsteth.svg";

export type CollateralSymbol = "ETH" | "RETH" | "WSTETH";

export function isCollateralSymbol(symbol: string): symbol is CollateralSymbol {
  return symbol === "ETH" || symbol === "RETH" || symbol === "WSTETH";
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

export const USDN: Token = {
  icon: tokenUSDN,
  name: "USDN",
  symbol: "USDN" as const,
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
  USDN,
  ETH,
  RETH,
  WSTETH,
  LUSD,
} as const;
