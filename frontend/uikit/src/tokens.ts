import type { Token } from "./types";

import tokenNeri from "./token-icons/neri.svg";
import tokenUSDN from "./token-icons/usdn.svg";
import tokenComp from "./token-icons/comp.svg";
import tokenEth from "./token-icons/eth.svg";
import tokenLqty from "./token-icons/lqty.svg";
import tokenLusd from "./token-icons/lusd.svg";
import tokenPufeth from "./token-icons/pufeth.svg";
import tokenReth from "./token-icons/reth.svg";
import tokenSfrxeth from "./token-icons/sfrxeth.svg";
import tokenSteth from "./token-icons/wsteth.svg";
import tokenTbtc from "./token-icons/tbtc.svg";
import tokenTeth from "./token-icons/teth.svg";
import tokenWeth from "./token-icons/weth.svg";
import tokenWeeth from "./token-icons/weeth.svg";

export type CollateralSymbol = "ETH" | "RETH" | "WSTETH" | "COMP" | "PUFETH" | "SFRXETH" | "TBTC" | "TETH" | "WETH" | "WEETH";

export function isCollateralSymbol(symbol: string): symbol is CollateralSymbol {
  return symbol === "ETH" || symbol === "RETH" || symbol === "WSTETH" || symbol === "COMP" || symbol === "PUFETH" || symbol === "SFRXETH" || symbol === "TBTC" || symbol === "TETH" || symbol === "WETH" || symbol === "WEETH";
}

export type CollateralToken = Token & {
  collateralRatio: number;
  symbol: CollateralSymbol;
};

export const NERI: Token = {
  icon: tokenNeri,
  name: "NERI",
  symbol: "NERI" as const,
} as const;

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

export const LQTY: Token = {
  icon: tokenLqty,
  name: "LQTY",
  symbol: "LQTY" as const,
} as const;

export const COMP: Token = {
  icon: tokenComp,
  name: "COMP",
  symbol: "COMP" as const,
} as const;

export const PUFETH: Token = {
  icon: tokenPufeth,
  name: "pufETH",
  symbol: "PUFETH" as const,
} as const;

export const SFRXETH: Token = {
  icon: tokenSfrxeth,
  name: "sfrxETH",
  symbol: "SFRXETH" as const,
} as const;

export const TBTC: Token = {
  icon: tokenTbtc,
  name: "tBTC",
  symbol: "TBTC" as const,
} as const;

export const TETH: Token = {
  icon: tokenTeth,
  name: "tETH",
  symbol: "TETH" as const,
} as const;

export const WETH: Token = {
  icon: tokenWeth,
  name: "WETH",
  symbol: "WETH" as const,
} as const;

export const WEETH: Token = {
  icon: tokenWeeth,
  name: "weETH",
  symbol: "WEETH" as const,
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
  NERI,
  USDN,
  ETH,
  LQTY,
  RETH,
  WSTETH,
  LUSD,
  COMP,
  PUFETH,
  SFRXETH,
  TBTC,
  TETH,
  WETH,
  WEETH,
} as const;
