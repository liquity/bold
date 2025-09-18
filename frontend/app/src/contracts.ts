import type { CollateralSymbol, CollIndex } from "@/src/types";
import type { Address } from "@liquity2/uikit";

import { ActivePool } from "@/src/abi/ActivePool";
import { BorrowerOperations } from "@/src/abi/BorrowerOperations";
import { CollateralRegistry } from "@/src/abi/CollateralRegistry";
import { CollSurplusPool } from "@/src/abi/CollSurplusPool";
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
  COLLATERAL_CONTRACTS,
  CONTRACT_BOLD_TOKEN,
  CONTRACT_COLLATERAL_REGISTRY,
  CONTRACT_EXCHANGE_HELPERS,
  CONTRACT_GOVERNANCE,
  CONTRACT_HINT_HELPERS,
  CONTRACT_LQTY_STAKING,
  CONTRACT_LQTY_TOKEN,
  CONTRACT_LUSD_TOKEN,
  CONTRACT_MULTI_TROVE_GETTER,
  CONTRACT_WETH,
  CONTRACT_YUSND,
  CONTRACT_SHELL_TOKEN
} from "@/src/env";
import { erc20Abi, zeroAddress } from "viem";
import { YearnV3Vault } from "./abi/YearnV3Vault";

const protocolAbis = {
  BoldToken: erc20Abi,
  CollateralRegistry,
  ExchangeHelpers,
  Governance,
  HintHelpers,
  LqtyStaking,
  LqtyToken,
  LusdToken: erc20Abi,
  MultiTroveGetter,
  WETH: erc20Abi,
  YUSND: YearnV3Vault,
  ShellToken: erc20Abi,
} as const;

const BorrowerOperationsErrorsAbi = BorrowerOperations.filter((f) => f.type === "error");

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

export type CollateralContracts = {
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
  Governance: { abi: abis.Governance, address: CONTRACT_GOVERNANCE },
  ExchangeHelpers: { abi: abis.ExchangeHelpers, address: CONTRACT_EXCHANGE_HELPERS },
  HintHelpers: { abi: abis.HintHelpers, address: CONTRACT_HINT_HELPERS },
  LqtyStaking: { abi: abis.LqtyStaking, address: CONTRACT_LQTY_STAKING },
  LqtyToken: { abi: abis.LqtyToken, address: CONTRACT_LQTY_TOKEN },
  LusdToken: { abi: abis.LusdToken, address: CONTRACT_LUSD_TOKEN },
  MultiTroveGetter: { abi: abis.MultiTroveGetter, address: CONTRACT_MULTI_TROVE_GETTER },
  WETH: { abi: abis.WETH, address: CONTRACT_WETH },
  YUSND: { abi: abis.YUSND, address: CONTRACT_YUSND },
  ShellToken: { abi: abis.ShellToken, address: CONTRACT_SHELL_TOKEN },

  collaterals: COLLATERAL_CONTRACTS.map(({ collIndex, symbol, contracts }) => ({
    collIndex,
    symbol,
    contracts: {
      ActivePool: { address: contracts.ACTIVE_POOL, abi: abis.ActivePool },
      BorrowerOperations: { address: contracts.BORROWER_OPERATIONS, abi: abis.BorrowerOperations },
      CollSurplusPool: { address: contracts.COLL_SURPLUS_POOL, abi: abis.CollSurplusPool },
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

export const CONTRACT_ADDRESSES = {
  BoldToken: CONTRACT_BOLD_TOKEN,
  CollateralRegistry: CONTRACT_COLLATERAL_REGISTRY,
  Governance: CONTRACT_GOVERNANCE,
  ExchangeHelpers: CONTRACT_EXCHANGE_HELPERS,
  HintHelpers: CONTRACT_HINT_HELPERS,
  LqtyStaking: CONTRACT_LQTY_STAKING,
  LqtyToken: CONTRACT_LQTY_TOKEN,
  LusdToken: CONTRACT_LUSD_TOKEN,
  MultiTroveGetter: CONTRACT_MULTI_TROVE_GETTER,
  WETH: CONTRACT_WETH,
  YUSND: CONTRACT_YUSND,
  ShellToken: CONTRACT_SHELL_TOKEN,
  GoSlowNft: "0x6da3c02293c96dfa5747b1739ebb492619222a8a",

  strategies: {
    Balancer: "0xc11d4777d0bcc257bba293b90522f5d6bd875228",
    Balancer2: "0x483bc7fe92fc392305dd97d4d3363e0e0a7f144d",
    Balancer3: "0xa0d9b4e8d6470e965977571661134ce8c0d9eb73",
    Bunni: "0x7fbd42c058b97d906b2c0e67d8ee288f851935c7",
    Camelot: "0xA20723963Fb33297a3F5491831742f9B63EFe4f2",
    Spectra: "0xdbfdad05d2d280195331582516813358f41d1cc4",
    UniswapV4: "0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869", // Position Manager contract
  },

  collaterals: COLLATERAL_CONTRACTS.map(({ collIndex, symbol, contracts }) => ({
    collIndex,
    symbol,
    contracts: {
      ActivePool: contracts.ACTIVE_POOL,
      BorrowerOperations: contracts.BORROWER_OPERATIONS,
      CollSurplusPool: contracts.COLL_SURPLUS_POOL,
      CollToken: contracts.COLL_TOKEN,
      DefaultPool: contracts.DEFAULT_POOL,
      LeverageLSTZapper: symbol === "ETH" ? zeroAddress : contracts.LEVERAGE_ZAPPER,
      LeverageWETHZapper: symbol === "ETH" ? contracts.LEVERAGE_ZAPPER : zeroAddress,
      PriceFeed: contracts.PRICE_FEED,
      SortedTroves: contracts.SORTED_TROVES,
      StabilityPool: contracts.STABILITY_POOL,
      TroveManager: contracts.TROVE_MANAGER,
      TroveNFT: contracts.TROVE_NFT,
    },
  })),
};

export function getContracts(): Contracts {
  return CONTRACTS;
}

export function getContractAddresses() {
  return CONTRACT_ADDRESSES;
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
