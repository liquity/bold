import type { Token } from "./types";

import tokenBold from "./token-icons/bold.svg";
import tokenEth from "./token-icons/eth.svg";
import tokenLqty from "./token-icons/lqty.svg";
import tokenLusd from "./token-icons/lusd.svg";
import tokenReth from "./token-icons/reth.svg";
import tokenWsteth from "./token-icons/wsteth.svg";

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

export const WETH: Token = {
  icon: tokenEth,
  name: "ETH",
  symbol: "WETH" as const,
} as const;

export const RETH: Token = {
  icon: tokenReth,
  name: "rETH",
  symbol: "RETH" as const,
} as const;

export const WSTETH: Token = {
  icon: tokenWsteth,
  name: "stETH",
  symbol: "WSTETH" as const,
} as const;

export const COLLATERALS = [
  WETH,
  WSTETH,
  RETH,
] as const;

export const TOKENS_BY_SYMBOL = {
  BOLD,
  LQTY,
  WETH,
  RETH,
  WSTETH,
  LUSD,
} as const;
