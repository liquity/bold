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
import { useConfig as useWagmiConfig } from "wagmi";
import { readContract } from "wagmi/actions";

type PriceToken = "LQTY" | "BOLD" | "LUSD" | CollateralSymbol;

async function fetchCollateralPrice(
  symbol: CollateralSymbol,
  config: ReturnType<typeof useWagmiConfig>,
): Promise<Dnum> {
  const PriceFeed = getBranchContract(symbol, "PriceFeed");

  const FetchPriceAbi = PriceFeed.abi.find((fn) => fn.name === "fetchPrice");
  if (!FetchPriceAbi) {
    throw new Error("fetchPrice ABI not found");
  }

  const [price] = await readContract(config, {
    abi: [{ ...FetchPriceAbi, stateMutability: "view" }] as const,
    address: PriceFeed.address,
    functionName: "fetchPrice",
  });

  return dnum18(price);
}

type CoinGeckoSymbol = TokenSymbol & ("LQTY" | "LUSD");
const coinGeckoTokenIds: {
  [key in CoinGeckoSymbol]: string;
} = {
  "LQTY": "liquity",
  "LUSD": "liquity-usd",
};

async function fetchCoinGeckoPrice(symbol: CoinGeckoSymbol): Promise<Dnum> {
  const tokenId = coinGeckoTokenIds[symbol];

  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("vs_currencies", "usd");
  url.searchParams.set("ids", tokenId);

  const headers: HeadersInit = { accept: "application/json" };

  if (COINGECKO_API_KEY?.apiType === "demo") {
    headers["x-cg-demo-api-key"] = COINGECKO_API_KEY.apiKey;
  }
  if (COINGECKO_API_KEY?.apiType === "pro") {
    headers["x-cg-pro-api-key"] = COINGECKO_API_KEY.apiKey;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch price for ${symbol}`);
  }

  const result = v.parse(
    v.object({
      [tokenId]: v.object({ "usd": v.number() }),
    }),
    await response.json(),
  );

  return dn.from(result[tokenId]?.usd ?? 0, 18);
}

export function usePrice(symbol: PriceToken | null): UseQueryResult<Dnum> {
  const config = useWagmiConfig();
  return useQuery({
    queryKey: ["usePrice", symbol],
    queryFn: async () => {
      if (!symbol) {
        throw new Error("Symbol is null");
      }

      // BOLD = $1
      if (symbol === "BOLD") {
        return dn.from(1, 18);
      }

      // LQTY, LUSD = CoinGecko price
      if (symbol === "LQTY" || symbol === "LUSD") {
        return fetchCoinGeckoPrice(symbol);
      }

      // Collateral token = PriceFeed price
      if (isCollateralSymbol(symbol)) {
        return fetchCollateralPrice(symbol, config);
      }

      throw new Error(`Unsupported token: ${symbol}`);
    },
    enabled: symbol !== null,
    refetchInterval: PRICE_REFRESH_INTERVAL,
  });
}
