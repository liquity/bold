import type { Address, CollIndex } from "@/src/types";

import { isCollIndex } from "@/src/types";
import { vAddress, vEnvAddressAndBlock, vEnvCurrency, vEnvFlag, vEnvLink } from "@/src/valibot-utils";
import * as v from "valibot";

export const CollateralSymbolSchema = v.union([
  v.literal("ETH"),
  v.literal("RETH"),
  v.literal("WSTETH"),
]);

export const EnvSchema = v.pipe(
  v.object({
    APP_VERSION: v.string(),
    CHAIN_ID: v.pipe(
      v.string(),
      v.transform((value) => {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed)) {
          throw new Error(`Invalid chain ID: ${value}`);
        }
        return parsed;
      }),
    ),
    CHAIN_NAME: v.string(),
    CHAIN_CURRENCY: vEnvCurrency(),
    CHAIN_RPC_URL: v.pipe(v.string(), v.url()),
    CHAIN_BLOCK_EXPLORER: v.optional(vEnvLink()),
    CHAIN_CONTRACT_ENS_REGISTRY: v.optional(vEnvAddressAndBlock()),
    CHAIN_CONTRACT_ENS_RESOLVER: v.optional(vEnvAddressAndBlock()),
    CHAIN_CONTRACT_MULTICALL: vAddress(),
    COMMIT_HASH: v.string(),
    SUBGRAPH_URL: v.string(),

    DELEGATE_AUTO: vAddress(),

    CONTRACT_LUSD_TOKEN: vAddress(),
    CONTRACT_GOVERNANCE: vAddress(),

    CONTRACT_BOLD_TOKEN: vAddress(),
    CONTRACT_COLLATERAL_REGISTRY: vAddress(),
    CONTRACT_EXCHANGE_HELPERS: vAddress(),
    CONTRACT_HINT_HELPERS: vAddress(),
    CONTRACT_MULTI_TROVE_GETTER: vAddress(),
    CONTRACT_WETH: vAddress(),

    COLL_0_CONTRACT_ACTIVE_POOL: v.optional(vAddress()),
    COLL_0_CONTRACT_BORROWER_OPERATIONS: v.optional(vAddress()),
    COLL_0_CONTRACT_COLL_SURPLUS_POOL: v.optional(vAddress()),
    COLL_0_CONTRACT_COLL_TOKEN: v.optional(vAddress()),
    COLL_0_CONTRACT_DEFAULT_POOL: v.optional(vAddress()),
    COLL_0_CONTRACT_LEVERAGE_ZAPPER: v.optional(vAddress()),
    COLL_0_CONTRACT_PRICE_FEED: v.optional(vAddress()),
    COLL_0_CONTRACT_SORTED_TROVES: v.optional(vAddress()),
    COLL_0_CONTRACT_STABILITY_POOL: v.optional(vAddress()),
    COLL_0_CONTRACT_TROVE_MANAGER: v.optional(vAddress()),
    COLL_0_CONTRACT_TROVE_NFT: v.optional(vAddress()),
    COLL_0_TOKEN_ID: v.optional(CollateralSymbolSchema),

    COLL_1_CONTRACT_ACTIVE_POOL: v.optional(vAddress()),
    COLL_1_CONTRACT_BORROWER_OPERATIONS: v.optional(vAddress()),
    COLL_1_CONTRACT_COLL_SURPLUS_POOL: v.optional(vAddress()),
    COLL_1_CONTRACT_COLL_TOKEN: v.optional(vAddress()),
    COLL_1_CONTRACT_DEFAULT_POOL: v.optional(vAddress()),
    COLL_1_CONTRACT_LEVERAGE_ZAPPER: v.optional(vAddress()),
    COLL_1_CONTRACT_PRICE_FEED: v.optional(vAddress()),
    COLL_1_CONTRACT_SORTED_TROVES: v.optional(vAddress()),
    COLL_1_CONTRACT_STABILITY_POOL: v.optional(vAddress()),
    COLL_1_CONTRACT_TROVE_MANAGER: v.optional(vAddress()),
    COLL_1_CONTRACT_TROVE_NFT: v.optional(vAddress()),
    COLL_1_TOKEN_ID: v.optional(CollateralSymbolSchema),

    COLL_2_CONTRACT_ACTIVE_POOL: v.optional(vAddress()),
    COLL_2_CONTRACT_BORROWER_OPERATIONS: v.optional(vAddress()),
    COLL_2_CONTRACT_COLL_SURPLUS_POOL: v.optional(vAddress()),
    COLL_2_CONTRACT_COLL_TOKEN: v.optional(vAddress()),
    COLL_2_CONTRACT_DEFAULT_POOL: v.optional(vAddress()),
    COLL_2_CONTRACT_LEVERAGE_ZAPPER: v.optional(vAddress()),
    COLL_2_CONTRACT_PRICE_FEED: v.optional(vAddress()),
    COLL_2_CONTRACT_SORTED_TROVES: v.optional(vAddress()),
    COLL_2_CONTRACT_STABILITY_POOL: v.optional(vAddress()),
    COLL_2_CONTRACT_TROVE_MANAGER: v.optional(vAddress()),
    COLL_2_CONTRACT_TROVE_NFT: v.optional(vAddress()),
    COLL_2_TOKEN_ID: v.optional(CollateralSymbolSchema),

    DEMO_MODE: vEnvFlag(),
    WALLET_CONNECT_PROJECT_ID: v.string(),
  }),
  v.transform((data) => {
    const env = { ...data };

    const contractsEnvNames = [
      "ACTIVE_POOL",
      "BORROWER_OPERATIONS",
      "COLL_SURPLUS_POOL",
      "COLL_TOKEN",
      "DEFAULT_POOL",
      "LEVERAGE_ZAPPER",
      "PRICE_FEED",
      "SORTED_TROVES",
      "STABILITY_POOL",
      "TROVE_MANAGER",
      "TROVE_NFT",
    ] as const;

    type ContractEnvName = typeof contractsEnvNames[number];

    const collateralContracts: Array<{
      collIndex: CollIndex;
      symbol: v.InferOutput<typeof CollateralSymbolSchema>;
      contracts: Record<ContractEnvName, Address>;
    }> = [];

    for (const index of Array(10).keys()) {
      const collEnvName = `COLL_${index}`;
      const contracts: Partial<Record<ContractEnvName, Address>> = {};

      for (const name of contractsEnvNames) {
        const fullKey = `${collEnvName}_CONTRACT_${name}` as keyof typeof env;
        if (fullKey in env) {
          contracts[name] = env[fullKey] as Address;
          delete env[fullKey];
        }
      }

      const contractsCount = Object.values(contracts).filter((v) => v).length;
      if (contractsCount === 0) {
        break;
      }
      if (contractsCount !== contractsEnvNames.length) {
        throw new Error(`Incomplete contracts for collateral ${index} (${contractsCount}/${contractsEnvNames.length})`);
      }

      if (!isCollIndex(index)) {
        throw new Error(`Invalid collateral index: ${index}`);
      }

      collateralContracts[index] = {
        collIndex: index,
        contracts: contracts as Record<ContractEnvName, Address>,
        symbol: env[`${collEnvName}_TOKEN_ID` as keyof typeof env] as v.InferOutput<typeof CollateralSymbolSchema>,
      };
    }

    return {
      ...env,
      COLLATERAL_CONTRACTS: collateralContracts,
    };
  }),
);

export type Env = v.InferOutput<typeof EnvSchema>;

const parsedEnv = v.parse(EnvSchema, {
  APP_VERSION: process.env.APP_VERSION, // set in next.config.js
  CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  CHAIN_NAME: process.env.NEXT_PUBLIC_CHAIN_NAME,
  CHAIN_CURRENCY: process.env.NEXT_PUBLIC_CHAIN_CURRENCY,
  CHAIN_RPC_URL: process.env.NEXT_PUBLIC_CHAIN_RPC_URL,
  CHAIN_BLOCK_EXPLORER: process.env.NEXT_PUBLIC_CHAIN_BLOCK_EXPLORER,
  CHAIN_CONTRACT_ENS_REGISTRY: process.env.NEXT_PUBLIC_CHAIN_CONTRACT_ENS_REGISTRY,
  CHAIN_CONTRACT_ENS_RESOLVER: process.env.NEXT_PUBLIC_CHAIN_CONTRACT_ENS_RESOLVER,
  CHAIN_CONTRACT_MULTICALL: process.env.NEXT_PUBLIC_CHAIN_CONTRACT_MULTICALL,
  COMMIT_HASH: process.env.COMMIT_HASH, // set in next.config.js
  SUBGRAPH_URL: process.env.NEXT_PUBLIC_SUBGRAPH_URL,

  DELEGATE_AUTO: process.env.NEXT_PUBLIC_DELEGATE_AUTO,

  CONTRACT_BOLD_TOKEN: process.env.NEXT_PUBLIC_CONTRACT_BOLD_TOKEN,
  CONTRACT_COLLATERAL_REGISTRY: process.env.NEXT_PUBLIC_CONTRACT_COLLATERAL_REGISTRY,
  CONTRACT_EXCHANGE_HELPERS: process.env.NEXT_PUBLIC_CONTRACT_EXCHANGE_HELPERS,
  CONTRACT_HINT_HELPERS: process.env.NEXT_PUBLIC_CONTRACT_HINT_HELPERS,
  CONTRACT_MULTI_TROVE_GETTER: process.env.NEXT_PUBLIC_CONTRACT_MULTI_TROVE_GETTER,
  CONTRACT_WETH: process.env.NEXT_PUBLIC_CONTRACT_WETH,

  CONTRACT_GOVERNANCE: process.env.NEXT_PUBLIC_CONTRACT_GOVERNANCE,
  CONTRACT_LUSD_TOKEN: process.env.NEXT_PUBLIC_CONTRACT_LUSD_TOKEN,

  COLL_0_TOKEN_ID: process.env.NEXT_PUBLIC_COLL_0_TOKEN_ID,
  COLL_1_TOKEN_ID: process.env.NEXT_PUBLIC_COLL_1_TOKEN_ID,
  COLL_2_TOKEN_ID: process.env.NEXT_PUBLIC_COLL_2_TOKEN_ID,

  COLL_0_CONTRACT_ACTIVE_POOL: process.env.NEXT_PUBLIC_COLL_0_CONTRACT_ACTIVE_POOL,
  COLL_0_CONTRACT_BORROWER_OPERATIONS: process.env.NEXT_PUBLIC_COLL_0_CONTRACT_BORROWER_OPERATIONS,
  COLL_0_CONTRACT_COLL_SURPLUS_POOL: process.env.NEXT_PUBLIC_COLL_0_CONTRACT_COLL_SURPLUS_POOL,
  COLL_0_CONTRACT_COLL_TOKEN: process.env.NEXT_PUBLIC_COLL_0_CONTRACT_COLL_TOKEN,
  COLL_0_CONTRACT_DEFAULT_POOL: process.env.NEXT_PUBLIC_COLL_0_CONTRACT_DEFAULT_POOL,
  COLL_0_CONTRACT_LEVERAGE_ZAPPER: process.env.NEXT_PUBLIC_COLL_0_CONTRACT_LEVERAGE_ZAPPER,
  COLL_0_CONTRACT_PRICE_FEED: process.env.NEXT_PUBLIC_COLL_0_CONTRACT_PRICE_FEED,
  COLL_0_CONTRACT_SORTED_TROVES: process.env.NEXT_PUBLIC_COLL_0_CONTRACT_SORTED_TROVES,
  COLL_0_CONTRACT_STABILITY_POOL: process.env.NEXT_PUBLIC_COLL_0_CONTRACT_STABILITY_POOL,
  COLL_0_CONTRACT_TROVE_MANAGER: process.env.NEXT_PUBLIC_COLL_0_CONTRACT_TROVE_MANAGER,
  COLL_0_CONTRACT_TROVE_NFT: process.env.NEXT_PUBLIC_COLL_0_CONTRACT_TROVE_NFT,

  COLL_1_CONTRACT_ACTIVE_POOL: process.env.NEXT_PUBLIC_COLL_1_CONTRACT_ACTIVE_POOL,
  COLL_1_CONTRACT_BORROWER_OPERATIONS: process.env.NEXT_PUBLIC_COLL_1_CONTRACT_BORROWER_OPERATIONS,
  COLL_1_CONTRACT_COLL_SURPLUS_POOL: process.env.NEXT_PUBLIC_COLL_1_CONTRACT_COLL_SURPLUS_POOL,
  COLL_1_CONTRACT_COLL_TOKEN: process.env.NEXT_PUBLIC_COLL_1_CONTRACT_COLL_TOKEN,
  COLL_1_CONTRACT_DEFAULT_POOL: process.env.NEXT_PUBLIC_COLL_1_CONTRACT_DEFAULT_POOL,
  COLL_1_CONTRACT_LEVERAGE_ZAPPER: process.env.NEXT_PUBLIC_COLL_1_CONTRACT_LEVERAGE_ZAPPER,
  COLL_1_CONTRACT_PRICE_FEED: process.env.NEXT_PUBLIC_COLL_1_CONTRACT_PRICE_FEED,
  COLL_1_CONTRACT_SORTED_TROVES: process.env.NEXT_PUBLIC_COLL_1_CONTRACT_SORTED_TROVES,
  COLL_1_CONTRACT_STABILITY_POOL: process.env.NEXT_PUBLIC_COLL_1_CONTRACT_STABILITY_POOL,
  COLL_1_CONTRACT_TROVE_MANAGER: process.env.NEXT_PUBLIC_COLL_1_CONTRACT_TROVE_MANAGER,
  COLL_1_CONTRACT_TROVE_NFT: process.env.NEXT_PUBLIC_COLL_1_CONTRACT_TROVE_NFT,

  COLL_2_CONTRACT_ACTIVE_POOL: process.env.NEXT_PUBLIC_COLL_2_CONTRACT_ACTIVE_POOL,
  COLL_2_CONTRACT_BORROWER_OPERATIONS: process.env.NEXT_PUBLIC_COLL_2_CONTRACT_BORROWER_OPERATIONS,
  COLL_2_CONTRACT_COLL_SURPLUS_POOL: process.env.NEXT_PUBLIC_COLL_2_CONTRACT_COLL_SURPLUS_POOL,
  COLL_2_CONTRACT_COLL_TOKEN: process.env.NEXT_PUBLIC_COLL_2_CONTRACT_COLL_TOKEN,
  COLL_2_CONTRACT_DEFAULT_POOL: process.env.NEXT_PUBLIC_COLL_2_CONTRACT_DEFAULT_POOL,
  COLL_2_CONTRACT_LEVERAGE_ZAPPER: process.env.NEXT_PUBLIC_COLL_2_CONTRACT_LEVERAGE_ZAPPER,
  COLL_2_CONTRACT_PRICE_FEED: process.env.NEXT_PUBLIC_COLL_2_CONTRACT_PRICE_FEED,
  COLL_2_CONTRACT_SORTED_TROVES: process.env.NEXT_PUBLIC_COLL_2_CONTRACT_SORTED_TROVES,
  COLL_2_CONTRACT_STABILITY_POOL: process.env.NEXT_PUBLIC_COLL_2_CONTRACT_STABILITY_POOL,
  COLL_2_CONTRACT_TROVE_MANAGER: process.env.NEXT_PUBLIC_COLL_2_CONTRACT_TROVE_MANAGER,
  COLL_2_CONTRACT_TROVE_NFT: process.env.NEXT_PUBLIC_COLL_2_CONTRACT_TROVE_NFT,

  DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
  WALLET_CONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
});

export const {
  APP_VERSION,
  CHAIN_BLOCK_EXPLORER,
  CHAIN_CONTRACT_ENS_REGISTRY,
  CHAIN_CONTRACT_ENS_RESOLVER,
  CHAIN_CONTRACT_MULTICALL,
  CHAIN_CURRENCY,
  CHAIN_ID,
  CHAIN_NAME,
  CHAIN_RPC_URL,
  COLLATERAL_CONTRACTS,
  COMMIT_HASH,
  SUBGRAPH_URL,
  CONTRACT_BOLD_TOKEN,
  CONTRACT_COLLATERAL_REGISTRY,
  CONTRACT_EXCHANGE_HELPERS,
  CONTRACT_GOVERNANCE,
  CONTRACT_HINT_HELPERS,
  CONTRACT_LUSD_TOKEN,
  CONTRACT_MULTI_TROVE_GETTER,
  CONTRACT_WETH,
  DELEGATE_AUTO,
  DEMO_MODE,
  WALLET_CONNECT_PROJECT_ID,
} = parsedEnv;
