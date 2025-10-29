import type { BranchId, CollateralSymbol } from "@/src/types";
import type { Address } from "@liquity2/uikit";

import { ActivePool } from "@/src/abi/ActivePool";
import { BorrowerOperations } from "@/src/abi/BorrowerOperations";
import { CollateralRegistry } from "@/src/abi/CollateralRegistry";
import { CollSurplusPool } from "@/src/abi/CollSurplusPool";
import { DebtInFrontHelper } from "@/src/abi/DebtInFrontHelper";
import { DefaultPool } from "@/src/abi/DefaultPool";
import { ExchangeHelpers } from "@/src/abi/ExchangeHelpers";
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
  CONTRACT_DEBT_IN_FRONT_HELPER,
  CONTRACT_LQTY_STAKING,
  CONTRACT_LQTY_TOKEN,
  CONTRACT_LUSD_TOKEN,
  CONTRACT_WETH,
  CHAIN_ID,
} from "@/src/env";
import { erc20Abi, zeroAddress } from "viem";
import { LeverageWrappedTokenZapper } from "./abi/LeverageWrappedTokenZapper";
import { getDeploymentInfo } from "./white-label-utils";

const protocolAbis = {
  BoldToken: erc20Abi,
  CollateralRegistry,
  DebtInFrontHelper,
  ExchangeHelpers,
  Governance,
  HintHelpers,
  LqtyStaking,
  LqtyToken,
  LusdToken: erc20Abi,
  MultiTroveGetter,
  WETH: erc20Abi,
} as const;

const BorrowerOperationsErrorsAbi = BorrowerOperations.filter(
  (f) => f.type === "error",
);

const collateralAbis = {
  ActivePool,
  BorrowerOperations,
  CollSurplusPool,
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
  LeverageWrappedTokenZapper: [
    ...LeverageWrappedTokenZapper,
    ...BorrowerOperationsErrorsAbi,
  ],
  PriceFeed: PriceFeed.map((f) => (
    f.name !== "fetchPrice" ? f : {
      ...f,
      stateMutability: "view",
    } as const
  )),
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

export type BranchContracts = {
  [K in CollateralContractName]: Contract<K>;
};

export type Contracts = ProtocolContractMap & {
  branches: Array<{
    id: BranchId;
    branchId: BranchId;
    contracts: BranchContracts;
    symbol: CollateralSymbol;
    decimals: number;
  }>;
};

const deployments = getDeploymentInfo(CHAIN_ID);

export const CONTRACTS: Contracts = {
  BoldToken: { abi: abis.BoldToken, address: deployments.BOLD_TOKEN },
  CollateralRegistry: {
    abi: abis.CollateralRegistry,
    address: deployments.COLLATERAL_REGISTRY,
  },
  DebtInFrontHelper: { abi: abis.DebtInFrontHelper, address: CONTRACT_DEBT_IN_FRONT_HELPER },
  Governance: { abi: abis.Governance, address: deployments.GOVERNANCE },
  ExchangeHelpers: {
    abi: abis.ExchangeHelpers,
    address: deployments.EXCHANGE_HELPERS,
  },
  HintHelpers: { abi: abis.HintHelpers, address: deployments.HINT_HELPERS },
  LqtyStaking: { abi: abis.LqtyStaking, address: CONTRACT_LQTY_STAKING },
  LqtyToken: { abi: abis.LqtyToken, address: CONTRACT_LQTY_TOKEN },
  LusdToken: { abi: abis.LusdToken, address: CONTRACT_LUSD_TOKEN },
  MultiTroveGetter: {
    abi: abis.MultiTroveGetter,
    address: deployments.MULTI_TROVE_GETTER,
  },
  WETH: { abi: abis.WETH, address: CONTRACT_WETH },
  branches: deployments.BRANCHES.map((branch) => ({
    id: branch.branchId,
    branchId: branch.branchId,
    symbol: branch.symbol,
    decimals: branch.decimals,
    contracts: {
      ActivePool: { address: branch.ACTIVE_POOL, abi: abis.ActivePool },
      BorrowerOperations: {
        address: branch.BORROWER_OPERATIONS,
        abi: abis.BorrowerOperations,
      },
      CollSurplusPool: {
        address: branch.COLL_SURPLUS_POOL,
        abi: abis.CollSurplusPool,
      },
      CollToken: { address: branch.COLL_TOKEN, abi: abis.CollToken },
      DefaultPool: { address: branch.DEFAULT_POOL, abi: abis.DefaultPool },
      LeverageLSTZapper: {
        address: branch.symbol === "STATOM" || branch.symbol === "SAGA" ? zeroAddress : branch.LEVERAGE_ZAPPER,
        abi: abis.LeverageLSTZapper,
      },
      LeverageWETHZapper: {
        address: zeroAddress,
        abi: abis.LeverageWETHZapper,
      },
      LeverageWrappedTokenZapper: {
        address: branch.symbol === "STATOM" || branch.symbol === "SAGA" ? branch.LEVERAGE_ZAPPER : zeroAddress,
        abi: abis.LeverageWrappedTokenZapper,
      },
      PriceFeed: { address: branch.PRICE_FEED, abi: abis.PriceFeed },
      SortedTroves: { address: branch.SORTED_TROVES, abi: abis.SortedTroves },
      StabilityPool: {
        address: branch.STABILITY_POOL,
        abi: abis.StabilityPool,
      },
      TroveManager: { address: branch.TROVE_MANAGER, abi: abis.TroveManager },
      TroveNFT: { address: branch.TROVE_NFT, abi: abis.TroveNFT },
    },
  })),
};

export function getProtocolContract<
  CN extends ProtocolContractName,
>(name: CN): ProtocolContractMap[CN] {
  return CONTRACTS[name];
}

export function getBranchContract(
  branchIdOrSymbol: null,
  contractName: CollateralContractName,
): null;
export function getBranchContract<CN extends CollateralContractName>(
  branchIdOrSymbol: CollateralSymbol | BranchId,
  contractName: CN,
): Contract<CN>;
export function getBranchContract<CN extends CollateralContractName>(
  branchIdOrSymbol: CollateralSymbol | BranchId | null,
  contractName: CN,
): Contract<CN> | null;
export function getBranchContract<CN extends CollateralContractName>(
  branchIdOrSymbol: CollateralSymbol | BranchId | null,
  contractName: CN,
): Contract<CN> | null {
  if (branchIdOrSymbol === null) {
    return null;
  }
  const { branches } = CONTRACTS;

  const branch = typeof branchIdOrSymbol === "number"
    ? branches[branchIdOrSymbol]
    : branches.find((c) => c.symbol === branchIdOrSymbol);
  if (!branch) {
    throw new Error(`No branch for index or symbol ${branchIdOrSymbol}`);
  }

  const contract = branch.contracts[contractName];
  if (!contract) {
    throw new Error(`No contract ${contractName} for branch ${branchIdOrSymbol}`);
  }

  return contract;
}
