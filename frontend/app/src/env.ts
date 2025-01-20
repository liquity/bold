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
    BLOCKING_LIST: v.optional(vAddress()),
    BLOCKING_VPNAPI: v.pipe(
      v.optional(v.string(), ""),
      v.transform((value) => {
        if (!value.trim()) {
          return null; // not set
        }

        const [apiKey, countries = ""] = value.split("|");
        if (!apiKey) {
          throw new Error(
            `Invalid BLOCKING_VPNAPI value: ${value}. `
              + `Expected format: API_KEY or API_KEY|COUNTRY,COUNTRY,… `
              + `(e.g. 123456|US,CA)`,
          );
        }
        return {
          apiKey: apiKey.trim(),
          countries: countries.split(",").map((c) => c.trim().toUpperCase()),
        };
      }),
    ),
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
    COINGECKO_API_KEY: v.pipe(
      v.optional(v.string(), ""),
      v.rawTransform(({ dataset, addIssue, NEVER }) => {
        const [apiType, apiKey] = dataset.value.split("|");
        if (!apiKey) {
          return null; // no API key
        }
        if (apiType !== "demo" && apiType !== "pro") {
          addIssue({ message: `Invalid CoinGecko API type: ${apiType}` });
          return NEVER;
        }
        if (!apiKey.trim()) {
          addIssue({ message: `Invalid CoinGecko API key (empty)` });
          return NEVER;
        }
        return {
          apiType: apiType as "demo" | "pro",
          apiKey,
        };
      }),
    ),
    DEMO_MODE: v.optional(vEnvFlag(), "false"),
    DEPLOYMENT_FLAVOR: v.pipe(
      v.optional(v.string(), ""),
      v.transform((value) => value.trim()),
    ),
    INITIATIVE_UNI_V4_DONATIONS: vAddress(),
    KNOWN_INITIATIVES_URL: v.optional(v.pipe(v.string(), v.url())),
    LIQUITY_STATS_URL: v.pipe(v.string(), v.url()),
    SAFE_API_URL: v.optional(v.pipe(v.string(), v.url())),
    SUBGRAPH_URL: v.pipe(v.string(), v.url()),
    VERCEL_ANALYTICS: v.optional(vEnvFlag(), "false"),
    WALLET_CONNECT_PROJECT_ID: v.string(),

    DELEGATE_AUTO: vAddress(),

    CONTRACT_BOLD_TOKEN: vAddress(),
    CONTRACT_COLLATERAL_REGISTRY: vAddress(),
    CONTRACT_EXCHANGE_HELPERS: vAddress(),
    CONTRACT_GOVERNANCE: vAddress(),
    CONTRACT_HINT_HELPERS: vAddress(),
    CONTRACT_LQTY_STAKING: vAddress(),
    CONTRACT_LQTY_TOKEN: vAddress(),
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

const parsedEnv = v.safeParse(EnvSchema, {
  APP_VERSION: process.env.APP_VERSION, // set in next.config.js
  BLOCKING_LIST: process.env.NEXT_PUBLIC_BLOCKING_LIST,
  BLOCKING_VPNAPI: process.env.NEXT_PUBLIC_BLOCKING_VPNAPI,
  CHAIN_BLOCK_EXPLORER: process.env.NEXT_PUBLIC_CHAIN_BLOCK_EXPLORER,
  CHAIN_CONTRACT_ENS_REGISTRY: process.env.NEXT_PUBLIC_CHAIN_CONTRACT_ENS_REGISTRY,
  CHAIN_CONTRACT_ENS_RESOLVER: process.env.NEXT_PUBLIC_CHAIN_CONTRACT_ENS_RESOLVER,
  CHAIN_CONTRACT_MULTICALL: process.env.NEXT_PUBLIC_CHAIN_CONTRACT_MULTICALL,
  CHAIN_CURRENCY: process.env.NEXT_PUBLIC_CHAIN_CURRENCY,
  CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
  CHAIN_NAME: process.env.NEXT_PUBLIC_CHAIN_NAME,
  CHAIN_RPC_URL: process.env.NEXT_PUBLIC_CHAIN_RPC_URL,
  COINGECKO_API_KEY: process.env.NEXT_PUBLIC_COINGECKO_API_KEY,
  COMMIT_HASH: process.env.COMMIT_HASH, // set in next.config.js
  DELEGATE_AUTO: process.env.NEXT_PUBLIC_DELEGATE_AUTO,
  DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
  DEPLOYMENT_FLAVOR: process.env.NEXT_PUBLIC_DEPLOYMENT_FLAVOR,
  INITIATIVE_UNI_V4_DONATIONS: process.env.NEXT_PUBLIC_INITIATIVE_UNI_V4_DONATIONS,
  KNOWN_INITIATIVES_URL: process.env.NEXT_PUBLIC_KNOWN_INITIATIVES_URL,
  LIQUITY_STATS_URL: process.env.NEXT_PUBLIC_LIQUITY_STATS_URL,
  SAFE_API_URL: process.env.NEXT_PUBLIC_SAFE_API_URL,
  SUBGRAPH_URL: process.env.NEXT_PUBLIC_SUBGRAPH_URL,
  VERCEL_ANALYTICS: process.env.NEXT_PUBLIC_VERCEL_ANALYTICS,
  WALLET_CONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,

  CONTRACT_BOLD_TOKEN: process.env.NEXT_PUBLIC_CONTRACT_BOLD_TOKEN,
  CONTRACT_COLLATERAL_REGISTRY: process.env.NEXT_PUBLIC_CONTRACT_COLLATERAL_REGISTRY,
  CONTRACT_EXCHANGE_HELPERS: process.env.NEXT_PUBLIC_CONTRACT_EXCHANGE_HELPERS,
  CONTRACT_GOVERNANCE: process.env.NEXT_PUBLIC_CONTRACT_GOVERNANCE,
  CONTRACT_HINT_HELPERS: process.env.NEXT_PUBLIC_CONTRACT_HINT_HELPERS,
  CONTRACT_LQTY_STAKING: process.env.NEXT_PUBLIC_CONTRACT_LQTY_STAKING,
  CONTRACT_LQTY_TOKEN: process.env.NEXT_PUBLIC_CONTRACT_LQTY_TOKEN,
  CONTRACT_MULTI_TROVE_GETTER: process.env.NEXT_PUBLIC_CONTRACT_MULTI_TROVE_GETTER,
  CONTRACT_WETH: process.env.NEXT_PUBLIC_CONTRACT_WETH,

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
});

if (!parsedEnv.success) {
  console.error(
    "Invalid environment variable(s):",
    v.flatten<typeof EnvSchema>(parsedEnv.issues),
  );
  throw new Error("Invalid environment variable(s)");
}

export const {
  APP_VERSION,
  BLOCKING_LIST,
  BLOCKING_VPNAPI,
  CHAIN_BLOCK_EXPLORER,
  CHAIN_CONTRACT_ENS_REGISTRY,
  CHAIN_CONTRACT_ENS_RESOLVER,
  CHAIN_CONTRACT_MULTICALL,
  CHAIN_CURRENCY,
  CHAIN_ID,
  CHAIN_NAME,
  CHAIN_RPC_URL,
  COINGECKO_API_KEY,
  COLLATERAL_CONTRACTS,
  COMMIT_HASH,
  CONTRACT_BOLD_TOKEN,
  CONTRACT_COLLATERAL_REGISTRY,
  CONTRACT_EXCHANGE_HELPERS,
  CONTRACT_GOVERNANCE,
  CONTRACT_HINT_HELPERS,
  CONTRACT_LQTY_STAKING,
  CONTRACT_LQTY_TOKEN,
  CONTRACT_MULTI_TROVE_GETTER,
  CONTRACT_WETH,
  DELEGATE_AUTO,
  DEMO_MODE,
  DEPLOYMENT_FLAVOR,
  INITIATIVE_UNI_V4_DONATIONS,
  KNOWN_INITIATIVES_URL,
  LIQUITY_STATS_URL,
  SAFE_API_URL,
  SUBGRAPH_URL,
  VERCEL_ANALYTICS,
  WALLET_CONNECT_PROJECT_ID,
} = parsedEnv.output;
