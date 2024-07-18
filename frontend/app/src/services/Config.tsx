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
  CONTRACT_COLL_TOKEN,
  CONTRACT_DEFAULT_POOL,
  CONTRACT_FUNCTION_CALLER,
  CONTRACT_GAS_POOL,
  CONTRACT_HINT_HELPERS,
  CONTRACT_INTEREST_ROUTER,
  CONTRACT_PRICE_FEED,
  CONTRACT_SORTED_TROVES,
  CONTRACT_STABILITY_POOL,
  CONTRACT_TROVE_MANAGER,
} from "@/src/env";
import { vAddress } from "@/src/valibot-utils";
import { createContext, useCallback, useContext, useState } from "react";
import * as v from "valibot";

export const ConfigSchema = v.object({
  chainId: v.number(),
  chainName: v.string(),
  chainCurrency: v.object({
    name: v.string(),
    symbol: v.string(),
    decimals: v.number(),
  }),
  chainBlockExplorer: v.optional(v.object({
    name: v.string(),
    url: v.string(),
  })),
  chainContractEnsRegistry: v.optional(v.object({
    address: vAddress(),
    block: v.optional(v.number()),
  })),
  chainContractEnsResolver: v.optional(v.object({
    address: vAddress(),
    block: v.optional(v.number()),
  })),
  chainContractMulticall: v.optional(v.object({
    address: vAddress(),
    block: v.optional(v.number()),
  })),
  chainRpcUrl: v.string(),
  contractActivePool: vAddress(),
  contractBoldToken: vAddress(),
  contractBorrowerOperations: vAddress(),
  contractCollSurplusPool: vAddress(),
  contractCollToken: vAddress(),
  contractDefaultPool: vAddress(),
  contractFunctionCaller: vAddress(),
  contractGasPool: vAddress(),
  contractHintHelpers: vAddress(),
  contractInterestRouter: vAddress(),
  contractPriceFeed: vAddress(),
  contractSortedTroves: vAddress(),
  contractStabilityPool: vAddress(),
  contractTroveManager: vAddress(),
});

export type Config = v.InferOutput<typeof ConfigSchema>;

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
  contractCollToken: CONTRACT_COLL_TOKEN,
  contractDefaultPool: CONTRACT_DEFAULT_POOL,
  contractFunctionCaller: CONTRACT_FUNCTION_CALLER,
  contractGasPool: CONTRACT_GAS_POOL,
  contractHintHelpers: CONTRACT_HINT_HELPERS,
  contractInterestRouter: CONTRACT_INTEREST_ROUTER,
  contractPriceFeed: CONTRACT_PRICE_FEED,
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
        return v.parse(ConfigSchema, JSON.parse(storedConfig));
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
