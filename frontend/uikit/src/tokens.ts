import type { Token } from "./types";

import tokenNeri from "./token-icons/neri.svg"; // TODO: Clone of USND SVG (MUST REPLACE)
import tokenUsnd from "./token-icons/usnd.svg";
import tokenArb from "./token-icons/arb.svg";
import tokenComp from "./token-icons/comp.svg";
import tokenEth from "./token-icons/eth.svg";
import tokenLqty from "./token-icons/lqty.svg";
import tokenLusd from "./token-icons/lusd.svg";
import tokenReth from "./token-icons/reth.svg";
import tokenRsEth from "./token-icons/rseth.svg";
import tokenSteth from "./token-icons/wsteth.svg";
import tokenTbtc from "./token-icons/tbtc.svg";
import tokenWeth from "./token-icons/weth.svg";
import tokenWeeth from "./token-icons/weeth.svg";
import tokenYusnd from "./token-icons/yusnd.svg";
import tokenSup from "./token-icons/sup.svg";
import tokenShellpoint from "./token-icons/shellpoint.svg";

export type CollateralSymbol = 
  | "ETH" 
  | "WETH" 
  | "WSTETH"
  | "RETH" 
  | "RSETH"
  | "WEETH"
  | "ARB" 
  | "COMP"
  | "TBTC" 

export function isCollateralSymbol(symbol: string): symbol is CollateralSymbol {
  return (
    symbol === "ETH" 
    || symbol === "WETH" 
    || symbol === "WSTETH"
    || symbol === "RETH" 
    || symbol === "RSETH" 
    || symbol === "WEETH" 
    || symbol === "ARB" 
    || symbol === "COMP" 
    || symbol === "TBTC" 
  );
}

export type CollateralToken = Token & {
  collateralRatio: number;
  symbol: CollateralSymbol;
};

// Tokens

export const NERI: Token = {
  icon: tokenNeri,
  name: "NERI",
  symbol: "NERI" as const,
} as const;

export const USND: Token = {
  icon: tokenUsnd,
  name: "USND",
  symbol: "USND" as const,
} as const;

export const LQTY: Token = {
  icon: tokenLqty,
  name: "LQTY",
  symbol: "LQTY" as const,
} as const;

export const LUSD: Token = {
  icon: tokenLusd,
  name: "LUSD",
  symbol: "LUSD" as const,
} as const;

export const YUSND: Token = {
  icon: tokenYusnd,
  name: "yUSND",
  symbol: "YUSND" as const,
} as const;

export const SUP: Token = {
  icon: tokenSup,
  name: "SUP",
  symbol: "SUP" as const,
} as const;

export const SHELL: Token = {
  icon: tokenShellpoint,
  name: "Shellpoint",
  symbol: "SHELL" as const,
} as const;

// Collaterals

export const ETH: CollateralToken = {
  collateralRatio: 1.1,
  icon: tokenEth,
  name: "ETH",
  symbol: "ETH" as const,
} as const;

export const WETH: CollateralToken = {
  collateralRatio: 1.1,
  icon: tokenWeth,
  name: "WETH",
  symbol: "WETH" as const,
} as const;

export const WSTETH: CollateralToken = {
  collateralRatio: 1.1,
  icon: tokenSteth,
  name: "wstETH",
  symbol: "WSTETH" as const,
} as const;

export const RETH: CollateralToken = {
  collateralRatio: 1.1,
  icon: tokenReth,
  name: "rETH",
  symbol: "RETH" as const,
} as const;

export const RSETH: CollateralToken = {
  collateralRatio: 1.3,
  icon: tokenRsEth,
  name: "rsETH",
  symbol: "RSETH" as const,
} as const;

export const WEETH: CollateralToken = {
  collateralRatio: 1.3,
  icon: tokenWeeth,
  name: "weETH",
  symbol: "WEETH" as const,
} as const;

export const ARB: CollateralToken = {
  collateralRatio: 1.4,
  icon: tokenArb,
  name: "ARB",
  symbol: "ARB" as const,
} as const;

export const COMP: CollateralToken = {
  collateralRatio: 1.4,
  icon: tokenComp,
  name: "COMP",
  symbol: "COMP" as const,
} as const;

export const TBTC: CollateralToken = {
  collateralRatio: 1.15,
  icon: tokenTbtc,
  name: "tBTC",
  symbol: "TBTC" as const,
} as const;

export const COLLATERALS: CollateralToken[] = [
  ETH,
  WETH,
  WSTETH,
  RETH,
  RSETH,
  WEETH,
  ARB,
  COMP,
  TBTC,
];

export const TOKENS_BY_SYMBOL = {
  NERI,
  USND,
  LQTY,
  LUSD,
  YUSND,
  SUP,
  ETH,
  WETH,
  WSTETH,
  RETH,
  RSETH,
  WEETH,
  ARB,
  COMP,
  TBTC,
  SHELL,
} as const;
