"use client";

import type { CollateralSymbol, TokenSymbol } from "@/src/types";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Dnum } from "dnum";

import { PRICE_REFRESH_INTERVAL } from "@/src/constants";
import { getBranchContract } from "@/src/contracts";
import { dnum18 } from "@/src/dnum-utils";
import { COINGECKO_API_KEY } from "@/src/env";
import { isCollateralSymbol } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import * as v from "valibot";
import { useReadContract } from "wagmi";

type PriceToken = "bvUSD" | "BOLD" | CollateralSymbol | "sbvUSD" | "VCRAFT";

function useCollateralPrice(
  symbol: null | CollateralSymbol
): UseQueryResult<Dnum> {
  // "ETH" is a fallback when null is passed, so we can return a standard
  // query object from the PriceFeed ABI, while the query stays disabled
  const PriceFeed = getBranchContract(symbol ?? "WETH", "PriceFeed");

  if (!PriceFeed) {
    throw new Error(`Price feed contract not found for ${symbol}`);
  }
  
  // TODO: fix this
  // @ts-ignore
  return useReadContract({
    ...PriceFeed,
    // TODO: fix this
    // @ts-ignore
    functionName: "fetchPrice",
    allowFailure: false,
    query: {
      enabled: symbol !== null,
      refetchInterval: PRICE_REFRESH_INTERVAL,
      select: (price) => dnum18(price),
    },
  });
}

type CoinGeckoSymbol = TokenSymbol & ("WETH" | "BTCB");
const coinGeckoTokenIds: {
  [key in CoinGeckoSymbol]: string;
} = {
  WETH: "ethereum",
  BTCB: "bitcoin",
};

function useCoinGeckoPrice(
  supportedSymbol: null | CoinGeckoSymbol
): UseQueryResult<Dnum> {
  return useQuery({
    queryKey: ["coinGeckoPrice", ...Object.keys(coinGeckoTokenIds)],
    queryFn: async () => {
      if (supportedSymbol === null) {
        throw new Error("Unsupported symbol");
      }

      const url = new URL("https://api.coingecko.com/api/v3/simple/price");
      url.searchParams.set("vs_currencies", "usd");
      url.searchParams.set("ids", Object.values(coinGeckoTokenIds).join(","));

      const headers: HeadersInit = { accept: "application/json" };

      if (COINGECKO_API_KEY?.apiType === "demo") {
        headers["x-cg-demo-api-key"] = COINGECKO_API_KEY.apiKey;
      } else if (COINGECKO_API_KEY?.apiType === "pro") {
        headers["x-cg-pro-api-key"] = COINGECKO_API_KEY.apiKey;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch price for ${Object.keys(coinGeckoTokenIds).join(
            ","
          )}`
        );
      }

      const result = v.parse(
        v.object(
          v.entriesFromList(
            Object.values(coinGeckoTokenIds),
            v.object({ usd: v.number() })
          )
        ),
        await response.json()
      );

      const prices = {} as { [key in CoinGeckoSymbol]: Dnum | null };

      for (const key of Object.keys(coinGeckoTokenIds) as CoinGeckoSymbol[]) {
        const value = result[coinGeckoTokenIds[key]];
        if (value) {
          prices[key] = value.usd ? dn.from(value.usd, 18) : null;
        }
      }

      return prices;
    },
    select: (data) => {
      if (supportedSymbol === null || !data[supportedSymbol]) {
        throw new Error("Unsupported symbol");
      }
      return data[supportedSymbol];
    },
    enabled: supportedSymbol !== null,
    refetchInterval: PRICE_REFRESH_INTERVAL,
  });
}

export function usePrice<PT extends PriceToken>(
  symbol: PT | null
): UseQueryResult<Dnum> {
  const fromCoinGecko = symbol === "WETH" || symbol === "BTCB";
  const fromPriceFeed =
    !fromCoinGecko && symbol !== null && isCollateralSymbol(symbol);

  const collPrice = useCollateralPrice(fromPriceFeed ? symbol : null);
  const coinGeckoPrice = useCoinGeckoPrice(fromCoinGecko ? symbol : null);
  const bvusdPrice = useQuery({
    queryKey: ["bvusdPrice"],
    queryFn: () => dn.from(1, 18),
    enabled: symbol === "bvUSD",
  });
  const sbvusdPrice = useQuery({
    queryKey: ["sbvusdPrice"],
    queryFn: () => dn.from(1, 18),
    enabled: symbol === "sbvUSD",
  });
  const vcraftPrice = useQuery({
    queryKey: ["vcraftPrice"],
    queryFn: () => dn.from(0.02, 18),
    enabled: symbol === "VCRAFT",
  });

  // could be any of the three, we just need
  // to return a disabled query result object
  if (symbol === null) {
    return bvusdPrice;
  }

  if (fromCoinGecko) {
    return coinGeckoPrice;
  }

  if (fromPriceFeed) {
    return collPrice;
  }

  if (symbol === "bvUSD") {
    return bvusdPrice;
  }

  if (symbol === "sbvUSD") {
    return sbvusdPrice;
  }

  if (symbol === "VCRAFT") {
    return vcraftPrice;
  }

  throw new Error(`Unsupported token: ${symbol}`);
}
