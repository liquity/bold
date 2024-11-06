import type { CollateralSymbol, CollIndex } from "@/src/types";
import type { Address } from "@liquity2/uikit";

import { ActivePool } from "@/src/abi/ActivePool";
import { BorrowerOperations } from "@/src/abi/BorrowerOperations";
import { CollateralRegistry } from "@/src/abi/CollateralRegistry";
import { DefaultPool } from "@/src/abi/DefaultPool";
import { Governance } from "@/src/abi/Governance";
import { HintHelpers } from "@/src/abi/HintHelpers";
import { LeverageLSTZapper } from "@/src/abi/LeverageLSTZapper";
import { LeverageWETHZapper } from "@/src/abi/LeverageWETHZapper";
import { LqtyStaking } from "@/src/abi/LqtyStaking";
import { LqtyToken } from "@/src/abi/LqtyToken";
import { MultiTroveGetter } from "@/src/abi/MultiTroveGetter";
import { PriceFeed } from "@/src/abi/PriceFeed";
import { SortedTroves } from "@/src/abi/SortedTroves";
import { StabilityPool } from "@/src/abi/StabilityPool";
import { TroveManager } from "@/src/abi/TroveManager";
import { TroveNFT } from "@/src/abi/TroveNFT";
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
import { erc20Abi, zeroAddress } from "viem";

const protocolAbis = {
  BoldToken: erc20Abi,
  CollateralRegistry,
  Governance,
  HintHelpers,
  LqtyStaking,
  LqtyToken,
  MultiTroveGetter,
  WETH: erc20Abi,
} as const;

const BorrowerOperationsErrorsAbi = BorrowerOperations.filter((f) => f.type === "error");

const collateralAbis = {
  ActivePool,
  BorrowerOperations,
  CollToken: erc20Abi,
  DefaultPool,
  LeverageLSTZapper: [
    ...LeverageLSTZapper,
    ...BorrowerOperationsErrorsAbi,
  ],
  LeverageWETHZapper: [
    ...LeverageWETHZapper,
    ...BorrowerOperationsErrorsAbi,
  ],
  PriceFeed,
  SortedTroves,
  StabilityPool,
  TroveManager,
  TroveNFT,
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
  collIndex: CollIndex;
  contracts: CollateralContracts;
  symbol: CollateralSymbol;
}>;

export type Contracts = ProtocolContractMap & {
  collaterals: Collaterals;
};

const CONTRACTS: Contracts = {
  BoldToken: { abi: abis.BoldToken, address: CONTRACT_BOLD_TOKEN },
  CollateralRegistry: { abi: abis.CollateralRegistry, address: CONTRACT_COLLATERAL_REGISTRY },
  Governance: { abi: abis.Governance, address: zeroAddress },
  HintHelpers: { abi: abis.HintHelpers, address: CONTRACT_HINT_HELPERS },
  LqtyStaking: { abi: abis.LqtyStaking, address: CONTRACT_LQTY_STAKING },
  LqtyToken: { abi: abis.LqtyToken, address: CONTRACT_LQTY_TOKEN },
  MultiTroveGetter: { abi: abis.MultiTroveGetter, address: CONTRACT_MULTI_TROVE_GETTER },
  WETH: { abi: abis.WETH, address: CONTRACT_WETH },

  collaterals: COLLATERAL_CONTRACTS.map(({ collIndex, symbol, contracts }) => ({
    collIndex,
    symbol,
    contracts: {
      ActivePool: { address: contracts.ACTIVE_POOL, abi: abis.ActivePool },
      BorrowerOperations: { address: contracts.BORROWER_OPERATIONS, abi: abis.BorrowerOperations },
      CollToken: { address: contracts.COLL_TOKEN, abi: abis.CollToken },
      DefaultPool: { address: contracts.DEFAULT_POOL, abi: abis.DefaultPool },
      LeverageLSTZapper: {
        address: symbol === "ETH" ? zeroAddress : contracts.LEVERAGE_ZAPPER,
        abi: abis.LeverageLSTZapper,
      },
      LeverageWETHZapper: {
        address: symbol === "ETH" ? contracts.LEVERAGE_ZAPPER : zeroAddress,
        abi: abis.LeverageWETHZapper,
      },
      PriceFeed: { address: contracts.PRICE_FEED, abi: abis.PriceFeed },
      SortedTroves: { address: contracts.SORTED_TROVES, abi: abis.SortedTroves },
      StabilityPool: { address: contracts.STABILITY_POOL, abi: abis.StabilityPool },
      TroveManager: { address: contracts.TROVE_MANAGER, abi: abis.TroveManager },
      TroveNFT: { address: contracts.TROVE_NFT, abi: abis.TroveNFT },
    },
  })),
};

export function getContracts(): Contracts {
  return CONTRACTS;
}

export function getProtocolContract<CN extends ProtocolContractName>(
  name: CN,
): ProtocolContractMap[CN] {
  return CONTRACTS[name];
}

export function getCollateralContracts(
  collIndexOrSymbol: CollateralSymbol | CollIndex | null,
): CollateralContracts | null {
  if (collIndexOrSymbol === null) {
    return null;
  }
  const { collaterals } = getContracts();
  const collateral = typeof collIndexOrSymbol === "number"
    ? collaterals[collIndexOrSymbol]
    : collaterals.find((c) => c.symbol === collIndexOrSymbol);
  return collateral?.contracts ?? null;
}

export function getCollateralContract<CN extends CollateralContractName>(
  collIndexOrSymbol: CollateralSymbol | CollIndex | null,
  contractName: CN,
): Contract<CN> | null {
  const contracts = getCollateralContracts(collIndexOrSymbol);
  return contracts?.[contractName] ?? null;
}
