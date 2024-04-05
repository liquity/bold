"use client";

import type { ReactNode } from "react";

import {
  CHAIN_ID,
  CONTRACT_ACTIVE_POOL,
  CONTRACT_BOLD_TOKEN,
  CONTRACT_BORROWER_OPERATIONS,
  CONTRACT_COLL_SURPLUS_POOL,
  CONTRACT_DEFAULT_POOL,
  CONTRACT_FUNCTION_CALLER,
  CONTRACT_GAS_POOL,
  CONTRACT_HINT_HELPERS,
  CONTRACT_PRICE_FEED_TESTNET,
  CONTRACT_SORTED_TROVES,
  CONTRACT_STABILITY_POOL,
  CONTRACT_TROVE_MANAGER,
} from "@/src/env";
import { zAddress } from "@/src/zod-utils";
import { createContext, useCallback, useContext, useState } from "react";
import { z } from "zod";

export const ConfigSchema = z.object({
  chainId: z.number(),
  contractActivePool: zAddress(),
  contractBoldToken: zAddress(),
  contractBorrowerOperations: zAddress(),
  contractCollSurplusPool: zAddress(),
  contractDefaultPool: zAddress(),
  contractFunctionCaller: zAddress(),
  contractGasPool: zAddress(),
  contractHintHelpers: zAddress(),
  contractPriceFeedTestnet: zAddress(),
  contractSortedTroves: zAddress(),
  contractStabilityPool: zAddress(),
  contractTroveManager: zAddress(),
});

type Config = z.infer<typeof ConfigSchema>;

const defaultConfig: Config = {
  chainId: CHAIN_ID,
  contractActivePool: CONTRACT_ACTIVE_POOL,
  contractBoldToken: CONTRACT_BOLD_TOKEN,
  contractBorrowerOperations: CONTRACT_BORROWER_OPERATIONS,
  contractCollSurplusPool: CONTRACT_COLL_SURPLUS_POOL,
  contractDefaultPool: CONTRACT_DEFAULT_POOL,
  contractFunctionCaller: CONTRACT_FUNCTION_CALLER,
  contractGasPool: CONTRACT_GAS_POOL,
  contractHintHelpers: CONTRACT_HINT_HELPERS,
  contractPriceFeedTestnet: CONTRACT_PRICE_FEED_TESTNET,
  contractSortedTroves: CONTRACT_SORTED_TROVES,
  contractStabilityPool: CONTRACT_STABILITY_POOL,
  contractTroveManager: CONTRACT_TROVE_MANAGER,
};

export const ConfigContext = createContext<{
  config: Config;
  setConfig: (config: Config) => void;
}>({
  config: defaultConfig,
  setConfig: () => {},
});

export function Config({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config>(() => {
    const storedConfig = typeof localStorage !== "undefined"
      ? localStorage.getItem("liquity2:config")
      : null;
    if (storedConfig) {
      try {
        return ConfigSchema.parse(JSON.parse(storedConfig));
      } catch {
        return defaultConfig;
      }
    }
    return defaultConfig;
  });

  const setAndSaveConfig = useCallback((config: Config) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("liquity2:config", JSON.stringify(config));
    }
    setConfig(config);
  }, []);

  return (
    <ConfigContext.Provider value={{ config, setConfig: setAndSaveConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}
