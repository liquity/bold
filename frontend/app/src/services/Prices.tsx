"use client";

import type { CollateralSymbol } from "@/src/types";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Dnum } from "dnum";

import { PRICE_REFRESH_INTERVAL } from "@/src/constants";
import { getBranchContract } from "@/src/contracts";
import { dnum18, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { useLiquityStats } from "@/src/liquity-utils";
import { isCollateralSymbol } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import { useConfig as useWagmiConfig } from "wagmi";
import { readContract } from "wagmi/actions";

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

export function usePrice(symbol: string): UseQueryResult<Dnum>;
export function usePrice(symbol: null): UseQueryResult<null>;
export function usePrice(symbol: string | null): UseQueryResult<Dnum | null>;
export function usePrice(symbol: string | null): UseQueryResult<Dnum | null> {
  const stats = useLiquityStats();
  const config = useWagmiConfig();
  const statsPrices = stats.data?.prices;
  return useQuery({
    queryKey: ["usePrice", symbol, jsonStringifyWithDnum(statsPrices)],
    queryFn: async () => {
      if (symbol === null) {
        return null;
      }

      // Collateral token = PriceFeed price
      if (isCollateralSymbol(symbol)) {
        return fetchCollateralPrice(symbol, config);
      }

      // Stats API prices (CoinGecko)
      const priceFromStats = statsPrices?.[symbol] ?? null;
      if (priceFromStats !== null) {
        return priceFromStats;
      }

      throw new Error(`The price for ${symbol} could not be found.`);
    },
    enabled: symbol !== null,
    refetchInterval: PRICE_REFRESH_INTERVAL,
  });
}
