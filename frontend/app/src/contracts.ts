import type { Config } from "@/src/services/Config";
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
import { useConfig } from "@/src/services/Config";
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
  [K in ProtocolContractName | "collaterals"]: K extends "collaterals"
    ? Record<keyof Config["contracts"]["collaterals"], CollateralContracts<CollateralContractName> | null>
    : K extends ContractName ? Contract<K>
    : never;
};

function collateralAddressesToContracts(
  collateral: Config["contracts"]["collaterals"][
    keyof Config["contracts"]["collaterals"]
  ],
): CollateralContracts<CollateralContractName> | null {
  return collateral
    ? {
      ActivePool: { abi: abis.ActivePool, address: collateral.activePool },
      BorrowerOperations: { abi: abis.BorrowerOperations, address: collateral.borrowerOperations },
      DefaultPool: { abi: abis.DefaultPool, address: collateral.defaultPool },
      PriceFeed: { abi: abis.PriceFeed, address: collateral.priceFeed },
      SortedTroves: { abi: abis.SortedTroves, address: collateral.sortedTroves },
      StabilityPool: { abi: abis.StabilityPool, address: collateral.stabilityPool },
      Token: { abi: abis.Token, address: collateral.token },
      TroveManager: { abi: abis.TroveManager, address: collateral.troveManager },
    }
    : null;
}

export function useContracts(): Contracts {
  const { config } = useConfig();
  return useMemo(() => {
    const { contracts: c } = config;
    return ({
      BoldToken: { abi: abis.BoldToken, address: c.boldToken },
      CollateralRegistry: { abi: abis.CollateralRegistry, address: c.collateralRegistry },
      HintHelpers: { abi: abis.HintHelpers, address: c.hintHelpers },
      MultiTroveGetter: { abi: abis.MultiTroveGetter, address: c.multiTroveGetter },
      WETH: { abi: abis.WETH, address: c.weth },
      collaterals: {
        ETH: collateralAddressesToContracts(c.collaterals.ETH),
        RETH: collateralAddressesToContracts(c.collaterals.RETH),
        STETH: collateralAddressesToContracts(c.collaterals.STETH),
      },
    } as const);
  }, [abis, config]);
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
