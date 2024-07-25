"use client";

import { CollateralIdSchema } from "@/src/constants";
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
  COLLATERAL_CONTRACTS,
  CONTRACT_BOLD_TOKEN,
  CONTRACT_COLLATERAL_REGISTRY,
  CONTRACT_FUNCTION_CALLER,
  CONTRACT_HINT_HELPERS,
  CONTRACT_MULTI_TROVE_GETTER,
  CONTRACT_WETH,
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
  contracts: v.object({
    boldToken: vAddress(),
    collateralRegistry: vAddress(),
    functionCaller: vAddress(),
    hintHelpers: vAddress(),
    multiTroveGetter: vAddress(),
    weth: vAddress(),
    collaterals: v.record(
      CollateralIdSchema,
      v.object({
        activePool: vAddress(),
        borrowerOperations: vAddress(),
        defaultPool: vAddress(),
        priceFeed: vAddress(),
        sortedTroves: vAddress(),
        stabilityPool: vAddress(),
        token: vAddress(),
        troveManager: vAddress(),
      }),
    ),
  }),
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
  contracts: {
    boldToken: CONTRACT_BOLD_TOKEN,
    collateralRegistry: CONTRACT_COLLATERAL_REGISTRY,
    functionCaller: CONTRACT_FUNCTION_CALLER,
    hintHelpers: CONTRACT_HINT_HELPERS,
    multiTroveGetter: CONTRACT_MULTI_TROVE_GETTER,
    weth: CONTRACT_WETH,

    collaterals: Object.fromEntries(
      Object.entries(COLLATERAL_CONTRACTS).map(([name, collateral]) => [
        name,
        collateral
          ? {
            activePool: collateral.ACTIVE_POOL,
            borrowerOperations: collateral.BORROWER_OPERATIONS,
            defaultPool: collateral.DEFAULT_POOL,
            priceFeed: collateral.PRICE_FEED,
            sortedTroves: collateral.SORTED_TROVES,
            stabilityPool: collateral.STABILITY_POOL,
            token: collateral.TOKEN,
            troveManager: collateral.TROVE_MANAGER,
          }
          : null,
      ]),
    ),
  },
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
