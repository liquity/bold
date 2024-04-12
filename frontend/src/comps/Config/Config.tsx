"use client";

import type { ReactNode } from "react";

import {
  CHAIN_BLOCK_EXPLORER,
  CHAIN_CONTRACT_ENS_REGISTRY,
  CHAIN_CONTRACT_ENS_RESOLVER,
  CHAIN_CONTRACT_MULTICALL,
  CHAIN_CURRENCY,
  CHAIN_ID,
  CHAIN_NAME,
  CHAIN_RPC_URL,
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
  chainName: z.string(),
  chainCurrency: z.object({
    name: z.string(),
    symbol: z.string(),
    decimals: z.number(),
  }),
  chainBlockExplorer: z.object({
    name: z.string(),
    url: z.string(),
  }).optional(),
  chainContractEnsRegistry: z.object({
    address: zAddress(),
    block: z.number().optional(),
  }).optional(),
  chainContractEnsResolver: z.object({
    address: zAddress(),
    block: z.number().optional(),
  }).optional(),
  chainContractMulticall: z.object({
    address: zAddress(),
    block: z.number().optional(),
  }).optional(),
  chainRpcUrl: z.string(),
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
  chainName: CHAIN_NAME,
  chainCurrency: CHAIN_CURRENCY,
  chainBlockExplorer: CHAIN_BLOCK_EXPLORER,
  chainContractEnsRegistry: CHAIN_CONTRACT_ENS_REGISTRY,
  chainContractEnsResolver: CHAIN_CONTRACT_ENS_RESOLVER,
  chainContractMulticall: CHAIN_CONTRACT_MULTICALL,
  chainRpcUrl: CHAIN_RPC_URL,
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
