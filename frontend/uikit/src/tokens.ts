import type { Token } from "./types";

import tokenBvusd from "./token-icons/bvusd.svg";
import tokenEth from "./token-icons/eth.svg";
import tokenBtcb from "./token-icons/btcb.svg";
import tokenSbvusd from "./token-icons/sbvusd.svg";
import tokenVcraft from "./token-icons/vcraft.svg";

export type CollateralSymbol = "WETH" | "BVBTC";

export function isCollateralSymbol(symbol: string): symbol is CollateralSymbol {
  return symbol === "WETH" || symbol === "BVBTC";
}

export type CollateralToken = Token & {
  collateralRatio: number;
  symbol: CollateralSymbol;
};

export const bvUSD: Token = {
  icon: tokenBvusd,
  name: "bvUSD",
  symbol: "bvUSD" as const,
} as const;

export const sbvUSD: Token = {
  icon: tokenSbvusd,
  name: "sbvUSD",
  symbol: "sbvUSD" as const,
} as const;

export const VCRAFT: Token = {
  icon: tokenVcraft,
  name: "VCRAFT",
  symbol: "VCRAFT" as const,
} as const;

export const WETH: CollateralToken = {
  collateralRatio: 1.2,
  icon: tokenEth,
  name: "WETH",
  symbol: "WETH" as const,
} as const;

export const BVBTC: CollateralToken = {
  collateralRatio: 1.2,
  icon: tokenBtcb,
  name: "BVBTC",
  symbol: "BVBTC" as const,
} as const;

export const WBTC: Token = {
  icon: tokenBtcb,
  name: "WBTC",
  symbol: "WBTC" as const,
} as const;

export const COLLATERALS: CollateralToken[] = [
  WETH,
  BVBTC,
];

export const TOKENS_BY_SYMBOL = {
  bvUSD,
  WETH,
  BVBTC,
  VCRAFT,
  sbvUSD,
  WBTC,
} as const;
