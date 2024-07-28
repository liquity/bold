import type { CollateralSymbol } from "@/src/types";
import type { Address } from "@liquity2/uikit";

import { ActivePool } from "@/src/abi/ActivePool";
import { BorrowerOperations } from "@/src/abi/BorrowerOperations";
import { CollateralRegistry } from "@/src/abi/CollateralRegistry";
import { DefaultPool } from "@/src/abi/DefaultPool";
import { HintHelpers } from "@/src/abi/HintHelpers";
import { MultiTroveGetter } from "@/src/abi/MultiTroveGetter";
import { PriceFeed } from "@/src/abi/PriceFeed";
import { SortedTroves } from "@/src/abi/SortedTroves";
import { StabilityPool } from "@/src/abi/StabilityPool";
import { TroveManager } from "@/src/abi/TroveManager";
import {
  COLLATERAL_CONTRACTS,
  CONTRACT_BOLD_TOKEN,
  CONTRACT_COLLATERAL_REGISTRY,
  CONTRACT_HINT_HELPERS,
  CONTRACT_MULTI_TROVE_GETTER,
  CONTRACT_WETH,
} from "@/src/env";
import { useMemo } from "react";
import { erc20Abi } from "viem";

const protocolAbis = {
  BoldToken: erc20Abi,
  CollateralRegistry,
  HintHelpers,
  MultiTroveGetter,
  WETH: erc20Abi,
} as const;

const collateralAbis = {
  ActivePool,
  BorrowerOperations,
  DefaultPool,
  PriceFeed,
  SortedTroves,
  StabilityPool,
  Token: erc20Abi,
  TroveManager,
} as const;

const abis = {
  ...protocolAbis,
  ...collateralAbis,
} as const;

type ProtocolContractName = keyof typeof protocolAbis;
type CollateralContractName = keyof typeof collateralAbis;
type ContractName = ProtocolContractName | CollateralContractName;

// A contract represented by its ABI and address
type Contract<T extends ContractName> = {
  abi: T extends ProtocolContractName ? typeof protocolAbis[T]
    : T extends CollateralContractName ? typeof collateralAbis[T]
    : never;
  address: Address;
};

type CollateralContracts<T extends CollateralContractName> = Record<T, Contract<T>>;

type Contracts = {
  [K in ProtocolContractName | "collaterals"]: K extends "collaterals" ? Record<
      keyof typeof COLLATERAL_CONTRACTS,
      CollateralContracts<CollateralContractName> | null
    >
    : K extends ContractName ? Contract<K>
    : never;
};

function collateralAddressesToContracts(
  collateral: typeof COLLATERAL_CONTRACTS[keyof typeof COLLATERAL_CONTRACTS],
): CollateralContracts<CollateralContractName> | null {
  return collateral
    ? {
      ActivePool: { abi: abis.ActivePool, address: collateral.ACTIVE_POOL },
      BorrowerOperations: { abi: abis.BorrowerOperations, address: collateral.BORROWER_OPERATIONS },
      DefaultPool: { abi: abis.DefaultPool, address: collateral.DEFAULT_POOL },
      PriceFeed: { abi: abis.PriceFeed, address: collateral.PRICE_FEED },
      SortedTroves: { abi: abis.SortedTroves, address: collateral.SORTED_TROVES },
      StabilityPool: { abi: abis.StabilityPool, address: collateral.STABILITY_POOL },
      Token: { abi: abis.Token, address: collateral.TOKEN },
      TroveManager: { abi: abis.TroveManager, address: collateral.TROVE_MANAGER },
    }
    : null;
}

export function useContracts(): Contracts {
  return useMemo(() => {
    return ({
      BoldToken: { abi: abis.BoldToken, address: CONTRACT_BOLD_TOKEN },
      CollateralRegistry: { abi: abis.CollateralRegistry, address: CONTRACT_COLLATERAL_REGISTRY },
      HintHelpers: { abi: abis.HintHelpers, address: CONTRACT_HINT_HELPERS },
      MultiTroveGetter: { abi: abis.MultiTroveGetter, address: CONTRACT_MULTI_TROVE_GETTER },
      WETH: { abi: abis.WETH, address: CONTRACT_WETH },
      collaterals: {
        ETH: collateralAddressesToContracts(COLLATERAL_CONTRACTS.ETH),
        RETH: collateralAddressesToContracts(COLLATERAL_CONTRACTS.RETH),
        STETH: collateralAddressesToContracts(COLLATERAL_CONTRACTS.STETH),
      },
    } as const);
  }, [abis]);
}

export function useProtocolContract(name: ProtocolContractName): Contract<ProtocolContractName> {
  return useContracts()[name];
}

export function useCollateralContract(
  symbol: CollateralSymbol,
  name: CollateralContractName,
): Contract<CollateralContractName> | null {
  return useContracts().collaterals[symbol]?.[name] ?? null;
}

export function useActiveCollaterals(): CollateralSymbol[] {
  return Object.keys(useContracts().collaterals) as CollateralSymbol[];
}

export function collIndexToSymbol(collIndex: number): CollateralSymbol {
  const activeCollaterals = useActiveCollaterals();
}
