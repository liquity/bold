import type { Token } from "./types";

import tokenBold from "./token-icons/bold.svg";
import tokenEth from "./token-icons/eth.svg";
import tokenLqty from "./token-icons/lqty.svg";
import tokenLusd from "./token-icons/lusd.svg";
import tokenReth from "./token-icons/reth.svg";
import tokenWsteth from "./token-icons/wsteth.svg";

type CollateralToken = Token & {
  symbol: "ETH" | "RETH" | "WSTETH";
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

export const ETH: CollateralToken = {
  icon: tokenEth,
  name: "ETH",
  symbol: "ETH" as const,
} as const;

export const RETH: CollateralToken = {
  icon: tokenReth,
  name: "rETH",
  symbol: "RETH" as const,
} as const;

export const WSTETH: CollateralToken = {
  icon: tokenWsteth,
  name: "stETH",
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
  RETH,
  WSTETH,
  LUSD,
} as const;
