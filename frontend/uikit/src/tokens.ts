import type { Token } from "./types";

import tokenBold from "./token-icons/bold.svg";
import tokenEth from "./token-icons/eth.svg";
import tokenBtcb from "./token-icons/btcb.svg";

export type CollateralSymbol = "WETH" | "ETH" | "BTCB";

export function isCollateralSymbol(symbol: string): symbol is CollateralSymbol {
  return symbol === "WETH" || symbol === "ETH" || symbol === "BTCB";
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

export const WETH: CollateralToken = {
  collateralRatio: 1.1,
  icon: tokenEth,
  name: "WETH",
  symbol: "WETH" as const,
} as const;

export const ETH: CollateralToken = {
  collateralRatio: 1.1,
  icon: tokenEth,
  name: "ETH",
  symbol: "ETH" as const,
} as const;

export const BTCB: CollateralToken = {
  collateralRatio: 1.1,
  icon: tokenBtcb,
  name: "BTCB",
  symbol: "BTCB" as const,
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
  WETH,
  ETH,
  BTCB,
];

export const TOKENS_BY_SYMBOL = {
  bvUSD,
  WETH,
  ETH,
  BTCB,
} as const;
