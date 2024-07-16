import type { Address } from "@liquity2/uikit";

import { BorrowerOperations } from "@/src/abi/BorrowerOperations";
import { ERC20Faucet } from "@/src/abi/ERC20Faucet";
import { StabilityPool } from "@/src/abi/StabilityPool";
import { TroveManager } from "@/src/abi/TroveManager";
import { useConfig } from "@/src/comps/Config/Config";
import {
  CONTRACT_BOLD_TOKEN,
  CONTRACT_BORROWER_OPERATIONS,
  CONTRACT_COLL_TOKEN,
  CONTRACT_STABILITY_POOL,
  CONTRACT_TROVE_MANAGER,
} from "@/src/env";
import { useMemo } from "react";
import { BoldToken } from "./abi/BoldToken";
import { PriceFeed } from "./abi/PriceFeed";

const abis = {
  BoldToken,
  BorrowerOperations,
  CollToken: ERC20Faucet,
  PriceFeed,
  StabilityPool,
  TroveManager,
} as const;

type ContractName =
  | "BoldToken"
  | "BorrowerOperations"
  | "CollToken"
  | "PriceFeed"
  | "StabilityPool"
  | "TroveManager";

type Contract<T extends ContractName> = {
  abi: typeof abis[T];
  address: Address;
};

function contract<N extends ContractName>(name: N, address: Address): Contract<N> {
  return {
    abi: abis[name],
    address,
  };
}

export function useContracts(): {
  [K in ContractName]: Contract<K>;
} {
  const { config } = useConfig();
  return useMemo(() => ({
    BoldToken: contract("BoldToken", config.contractBoldToken),
    BorrowerOperations: contract("BorrowerOperations", config.contractBorrowerOperations),
    CollToken: contract("CollToken", config.contractCollToken),
    PriceFeed: contract("PriceFeed", config.contractPriceFeed),
    StabilityPool: contract("StabilityPool", config.contractStabilityPool),
    TroveManager: contract("TroveManager", config.contractTroveManager),
  } as const), [config]);
}

export function useContract<N extends ContractName>(name: N): Contract<N> {
  return useContracts()[name];
}

// TODO: remove (replaced by the hooks to be dynamic)
export const TroveManagerContract: Contract<"TroveManager"> = {
  abi: TroveManager,
  address: CONTRACT_TROVE_MANAGER,
};
export const BoldTokenContract: Contract<"BoldToken"> = {
  abi: BoldToken,
  address: CONTRACT_BOLD_TOKEN,
};
export const CollTokenContract: Contract<"CollToken"> = {
  abi: ERC20Faucet,
  address: CONTRACT_COLL_TOKEN,
};
export const BorrowerOperationsContract: Contract<"BorrowerOperations"> = {
  abi: BorrowerOperations,
  address: CONTRACT_BORROWER_OPERATIONS,
};
export const StabilityPoolContract: Contract<"StabilityPool"> = {
  abi: StabilityPool,
  address: CONTRACT_STABILITY_POOL,
};
