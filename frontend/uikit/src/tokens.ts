import type { Token } from "./types";

import tokenBold from "./token-icons/bold.svg";
import tokenEth from "./token-icons/eth.svg";
 
export type CollateralSymbol = "ETH";

export function isCollateralSymbol(symbol: string): symbol is CollateralSymbol {
  return symbol === "ETH";
}

export type CollateralToken = Token & {
  collateralRatio: number;
  symbol: CollateralSymbol;
};

export const bvUSD: Token = {
  icon: tokenBold,
  name: "bvUSD",
  symbol: "bvUSD" as const,
} as const;

export const ETH: CollateralToken = {
  collateralRatio: 1.1,
  icon: tokenEth,
  name: "ETH",
  symbol: "ETH" as const,
} as const;

// export const RETH: CollateralToken = {
//   collateralRatio: 1.2,
//   icon: tokenReth,
//   name: "rETH",
//   symbol: "RETH" as const,
// } as const;

// export const WSTETH: CollateralToken = {
//   collateralRatio: 1.2,
//   icon: tokenSteth,
//   name: "wstETH",
//   symbol: "WSTETH" as const,
// } as const;

export const COLLATERALS: CollateralToken[] = [
  ETH,
];

export const TOKENS_BY_SYMBOL = {
  bvUSD,
  ETH,
} as const;
