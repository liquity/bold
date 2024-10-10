import type { CollateralSymbol } from "@/src/types";
import type { Address } from "@liquity2/uikit";

import { ActivePool } from "@/src/abi/ActivePool";
import { BorrowerOperations } from "@/src/abi/BorrowerOperations";
import { CollateralRegistry } from "@/src/abi/CollateralRegistry";
import { DefaultPool } from "@/src/abi/DefaultPool";
import { GasCompZapper } from "@/src/abi/GasCompZapper";
import { HintHelpers } from "@/src/abi/HintHelpers";
import { LqtyStaking } from "@/src/abi/LqtyStaking";
import { LqtyToken } from "@/src/abi/LqtyToken";
import { MultiTroveGetter } from "@/src/abi/MultiTroveGetter";
import { PriceFeed } from "@/src/abi/PriceFeed";
import { SortedTroves } from "@/src/abi/SortedTroves";
import { StabilityPool } from "@/src/abi/StabilityPool";
import { TroveManager } from "@/src/abi/TroveManager";
import { WETH } from "@/src/abi/WETH";
import { WETHZapper } from "@/src/abi/WETHZapper";
import {
  COLLATERAL_CONTRACTS,
  CONTRACT_BOLD_TOKEN,
  CONTRACT_COLLATERAL_REGISTRY,
  CONTRACT_HINT_HELPERS,
  CONTRACT_LQTY_STAKING,
  CONTRACT_LQTY_TOKEN,
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
  WETH,
  LqtyToken,
  LqtyStaking,
} as const;

const collateralAbis = {
  ActivePool,
  BorrowerOperations,
  CollToken: erc20Abi,
  DefaultPool,
  PriceFeed,
  SortedTroves,
  StabilityPool,
  TroveManager,
  GasCompZapper: [
    ...GasCompZapper,
    ...BorrowerOperations.filter((f) => f.type === "error"),
  ],
  WETHZapper: [
    ...WETHZapper,
    ...BorrowerOperations.filter((f) => f.type === "error"),
  ],
} as const;

const abis = {
  ...protocolAbis,
  ...collateralAbis,
} as const;

type ProtocolContractMap = {
  [K in keyof typeof protocolAbis]: Contract<K>;
};

type ProtocolContractName = keyof ProtocolContractMap;
type CollateralContractName = keyof typeof collateralAbis;
type ContractName = ProtocolContractName | CollateralContractName;

// A contract represented by its ABI and address
type Contract<T extends ContractName> = {
  abi: T extends ProtocolContractName ? typeof protocolAbis[T]
    : T extends CollateralContractName ? typeof collateralAbis[T]
    : never;
  address: Address;
};

type CollateralContracts = {
  [K in CollateralContractName]: Contract<K>;
};

type Collaterals = Array<{
  symbol: CollateralSymbol;
  contracts: CollateralContracts;
}>;

export type Contracts = ProtocolContractMap & {
  collaterals: Collaterals;
};

// Note: even though the contracts related data is coming from the environment,
// hooks are being used so that we could later change these at runtime.
export function useContracts(): Contracts {
  return useMemo(() => {
    return {
      BoldToken: { abi: abis.BoldToken, address: CONTRACT_BOLD_TOKEN },
      CollateralRegistry: { abi: abis.CollateralRegistry, address: CONTRACT_COLLATERAL_REGISTRY },
      HintHelpers: { abi: abis.HintHelpers, address: CONTRACT_HINT_HELPERS },
      MultiTroveGetter: { abi: abis.MultiTroveGetter, address: CONTRACT_MULTI_TROVE_GETTER },
      WETH: { abi: abis.WETH, address: CONTRACT_WETH },
      LqtyToken: { abi: abis.LqtyToken, address: CONTRACT_LQTY_TOKEN },
      LqtyStaking: { abi: abis.LqtyStaking, address: CONTRACT_LQTY_STAKING },

      collaterals: COLLATERAL_CONTRACTS.map(({ symbol, contracts }) => ({
        symbol,
        contracts: {
          ActivePool: { address: contracts.ACTIVE_POOL, abi: abis.ActivePool },
          BorrowerOperations: { address: contracts.BORROWER_OPERATIONS, abi: abis.BorrowerOperations },
          CollToken: { address: contracts.COLL_TOKEN, abi: abis.CollToken },
          DefaultPool: { address: contracts.DEFAULT_POOL, abi: abis.DefaultPool },
          GasCompZapper: { address: contracts.GAS_COMP_ZAPPER, abi: abis.GasCompZapper },
          PriceFeed: { address: contracts.PRICE_FEED, abi: abis.PriceFeed },
          SortedTroves: { address: contracts.SORTED_TROVES, abi: abis.SortedTroves },
          StabilityPool: { address: contracts.STABILITY_POOL, abi: abis.StabilityPool },
          TroveManager: { address: contracts.TROVE_MANAGER, abi: abis.TroveManager },
          WETHZapper: { address: contracts.WETH_ZAPPER, abi: abis.WETHZapper },
        },
      })),
    };
  }, []);
}

export function useCollateralContracts() {
  return useContracts().collaterals;
}

export function useProtocolContract<CN extends ProtocolContractName>(
  name: CN,
): ProtocolContractMap[CN] {
  const contracts = useContracts();
  return contracts[name];
}

export function useCollateralContract<CN extends CollateralContractName>(
  symbol: CollateralSymbol | null,
  name: CN,
): Contract<CN> | null {
  const { collaterals } = useContracts();
  const contracts = symbol && getCollateralContracts(symbol, collaterals);
  return contracts?.[name] ?? null;
}

export function getCollateralContracts(
  symbol: CollateralSymbol,
  collaterals: Collaterals,
): CollateralContracts | null {
  return collaterals.find((c) => c.symbol === symbol)?.contracts ?? null;
}
