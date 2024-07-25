import type { Address } from "@/src/types";

import { CollateralIdSchema } from "@/src/constants";
import { vAddress, vEnvAddressAndBlock, vEnvCurrency, vEnvFlag, vEnvLink } from "@/src/valibot-utils";
import * as v from "valibot";

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
    CHAIN_CONTRACT_MULTICALL: v.optional(vEnvAddressAndBlock()),
    COMMIT_HASH: v.string(),

    CONTRACT_BOLD_TOKEN: vAddress(),
    CONTRACT_COLLATERAL_REGISTRY: vAddress(),
    CONTRACT_FUNCTION_CALLER: vAddress(),
    CONTRACT_HINT_HELPERS: vAddress(),
    CONTRACT_MULTI_TROVE_GETTER: vAddress(),
    CONTRACT_WETH: vAddress(),

    CONTRACT_COLL_0_TOKEN_ID: v.optional(CollateralIdSchema),
    CONTRACT_COLL_1_TOKEN_ID: v.optional(CollateralIdSchema),
    CONTRACT_COLL_2_TOKEN_ID: v.optional(CollateralIdSchema),

    CONTRACT_COLL_0_ACTIVE_POOL: v.optional(vAddress()),
    CONTRACT_COLL_0_BORROWER_OPERATIONS: v.optional(vAddress()),
    CONTRACT_COLL_0_DEFAULT_POOL: v.optional(vAddress()),
    CONTRACT_COLL_0_PRICE_FEED: v.optional(vAddress()),
    CONTRACT_COLL_0_SORTED_TROVES: v.optional(vAddress()),
    CONTRACT_COLL_0_STABILITY_POOL: v.optional(vAddress()),
    CONTRACT_COLL_0_TOKEN: v.optional(vAddress()),
    CONTRACT_COLL_0_TROVE_MANAGER: v.optional(vAddress()),

    CONTRACT_COLL_1_ACTIVE_POOL: v.optional(vAddress()),
    CONTRACT_COLL_1_BORROWER_OPERATIONS: v.optional(vAddress()),
    CONTRACT_COLL_1_DEFAULT_POOL: v.optional(vAddress()),
    CONTRACT_COLL_1_PRICE_FEED: v.optional(vAddress()),
    CONTRACT_COLL_1_SORTED_TROVES: v.optional(vAddress()),
    CONTRACT_COLL_1_STABILITY_POOL: v.optional(vAddress()),
    CONTRACT_COLL_1_TOKEN: v.optional(vAddress()),
    CONTRACT_COLL_1_TROVE_MANAGER: v.optional(vAddress()),

    CONTRACT_COLL_2_ACTIVE_POOL: v.optional(vAddress()),
    CONTRACT_COLL_2_BORROWER_OPERATIONS: v.optional(vAddress()),
    CONTRACT_COLL_2_DEFAULT_POOL: v.optional(vAddress()),
    CONTRACT_COLL_2_PRICE_FEED: v.optional(vAddress()),
    CONTRACT_COLL_2_SORTED_TROVES: v.optional(vAddress()),
    CONTRACT_COLL_2_STABILITY_POOL: v.optional(vAddress()),
    CONTRACT_COLL_2_TOKEN: v.optional(vAddress()),
    CONTRACT_COLL_2_TROVE_MANAGER: v.optional(vAddress()),

    DEMO_MODE: vEnvFlag(),
    WALLET_CONNECT_PROJECT_ID: v.string(),
  }),
  v.transform((data) => {
    const env = { ...data };

    const contractsEnvNames = [
      "ACTIVE_POOL",
      "BORROWER_OPERATIONS",
      "DEFAULT_POOL",
      "PRICE_FEED",
      "SORTED_TROVES",
      "STABILITY_POOL",
      "TOKEN",
      "TROVE_MANAGER",
    ] as const;

    type ContractEnvName = typeof contractsEnvNames[number];

    const collateralContracts: Record<
      v.InferOutput<typeof CollateralIdSchema>,
      Record<ContractEnvName, Address> | null
    > = {
      ETH: null,
      RETH: null,
      STETH: null,
    };

    for (const index of Array(10).keys()) {
      const collEnvName = `CONTRACT_COLL_${index}`;
      const contracts: Partial<Record<ContractEnvName, Address>> = {};

      for (const name of contractsEnvNames) {
        const fullKey = `${collEnvName}_${name}` as keyof typeof env;
        if (fullKey in env) {
          contracts[name] = env[fullKey] as Address;
          delete env[fullKey];
        }
      }

      const contractsCount = Object.values(contracts).filter((v) => v).length;
      if (contractsCount === contractsEnvNames.length) {
        collateralContracts[
          env[`${collEnvName}_TOKEN_ID` as keyof typeof env] as v.InferOutput<typeof CollateralIdSchema>
        ] = contracts as Record<ContractEnvName, Address>;
      }
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

  CONTRACT_BOLD_TOKEN: process.env.NEXT_PUBLIC_CONTRACT_BOLD_TOKEN,
  CONTRACT_COLLATERAL_REGISTRY: process.env.NEXT_PUBLIC_CONTRACT_COLLATERAL_REGISTRY,
  CONTRACT_FUNCTION_CALLER: process.env.NEXT_PUBLIC_CONTRACT_FUNCTION_CALLER,
  CONTRACT_HINT_HELPERS: process.env.NEXT_PUBLIC_CONTRACT_HINT_HELPERS,
  CONTRACT_MULTI_TROVE_GETTER: process.env.NEXT_PUBLIC_CONTRACT_MULTI_TROVE_GETTER,
  CONTRACT_WETH: process.env.NEXT_PUBLIC_CONTRACT_WETH,

  CONTRACT_COLL_0_TOKEN_ID: process.env.NEXT_PUBLIC_CONTRACT_COLL_0_TOKEN_ID,
  CONTRACT_COLL_0_ACTIVE_POOL: process.env.NEXT_PUBLIC_CONTRACT_COLL_0_ACTIVE_POOL,
  CONTRACT_COLL_0_BORROWER_OPERATIONS: process.env.NEXT_PUBLIC_CONTRACT_COLL_0_BORROWER_OPERATIONS,
  CONTRACT_COLL_0_DEFAULT_POOL: process.env.NEXT_PUBLIC_CONTRACT_COLL_0_DEFAULT_POOL,
  CONTRACT_COLL_0_PRICE_FEED: process.env.NEXT_PUBLIC_CONTRACT_COLL_0_PRICE_FEED,
  CONTRACT_COLL_0_SORTED_TROVES: process.env.NEXT_PUBLIC_CONTRACT_COLL_0_SORTED_TROVES,
  CONTRACT_COLL_0_STABILITY_POOL: process.env.NEXT_PUBLIC_CONTRACT_COLL_0_STABILITY_POOL,
  CONTRACT_COLL_0_TOKEN: process.env.NEXT_PUBLIC_CONTRACT_COLL_0_TOKEN,
  CONTRACT_COLL_0_TROVE_MANAGER: process.env.NEXT_PUBLIC_CONTRACT_COLL_0_TROVE_MANAGER,

  CONTRACT_COLL_1_TOKEN_ID: process.env.NEXT_PUBLIC_CONTRACT_COLL_1_TOKEN_ID,
  CONTRACT_COLL_1_ACTIVE_POOL: process.env.NEXT_PUBLIC_CONTRACT_COLL_1_ACTIVE_POOL,
  CONTRACT_COLL_1_BORROWER_OPERATIONS: process.env.NEXT_PUBLIC_CONTRACT_COLL_1_BORROWER_OPERATIONS,
  CONTRACT_COLL_1_DEFAULT_POOL: process.env.NEXT_PUBLIC_CONTRACT_COLL_1_DEFAULT_POOL,
  CONTRACT_COLL_1_PRICE_FEED: process.env.NEXT_PUBLIC_CONTRACT_COLL_1_PRICE_FEED,
  CONTRACT_COLL_1_SORTED_TROVES: process.env.NEXT_PUBLIC_CONTRACT_COLL_1_SORTED_TROVES,
  CONTRACT_COLL_1_STABILITY_POOL: process.env.NEXT_PUBLIC_CONTRACT_COLL_1_STABILITY_POOL,
  CONTRACT_COLL_1_TOKEN: process.env.NEXT_PUBLIC_CONTRACT_COLL_1_TOKEN,
  CONTRACT_COLL_1_TROVE_MANAGER: process.env.NEXT_PUBLIC_CONTRACT_COLL_1_TROVE_MANAGER,

  CONTRACT_COLL_2_TOKEN_ID: process.env.NEXT_PUBLIC_CONTRACT_COLL_2_TOKEN_ID,
  CONTRACT_COLL_2_ACTIVE_POOL: process.env.NEXT_PUBLIC_CONTRACT_COLL_2_ACTIVE_POOL,
  CONTRACT_COLL_2_BORROWER_OPERATIONS: process.env.NEXT_PUBLIC_CONTRACT_COLL_2_BORROWER_OPERATIONS,
  CONTRACT_COLL_2_DEFAULT_POOL: process.env.NEXT_PUBLIC_CONTRACT_COLL_2_DEFAULT_POOL,
  CONTRACT_COLL_2_PRICE_FEED: process.env.NEXT_PUBLIC_CONTRACT_COLL_2_PRICE_FEED,
  CONTRACT_COLL_2_SORTED_TROVES: process.env.NEXT_PUBLIC_CONTRACT_COLL_2_SORTED_TROVES,
  CONTRACT_COLL_2_STABILITY_POOL: process.env.NEXT_PUBLIC_CONTRACT_COLL_2_STABILITY_POOL,
  CONTRACT_COLL_2_TOKEN: process.env.NEXT_PUBLIC_CONTRACT_COLL_2_TOKEN,
  CONTRACT_COLL_2_TROVE_MANAGER: process.env.NEXT_PUBLIC_CONTRACT_COLL_2_TROVE_MANAGER,

  DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
  WALLET_CONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
});

console.log(parsedEnv);

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
  CONTRACT_BOLD_TOKEN,
  CONTRACT_COLLATERAL_REGISTRY,
  CONTRACT_FUNCTION_CALLER,
  CONTRACT_HINT_HELPERS,
  CONTRACT_MULTI_TROVE_GETTER,
  CONTRACT_WETH,
  DEMO_MODE,
  WALLET_CONNECT_PROJECT_ID,
} = parsedEnv;
