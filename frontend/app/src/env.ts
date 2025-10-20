"use client";

import type { Address, Branch } from "@/src/types";

import { DEFAULT_COMMIT_URL, DEFAULT_LEGACY_CHECKS, DEFAULT_STRATEGIES, DEFAULT_VERSION_URL } from "@/src/constants";
import { isBranchId } from "@/src/types";
import {
  vAddress,
  vEnvAddressAndBlock,
  vEnvCurrency,
  vEnvFlag,
  vEnvLegacyCheck,
  vEnvLink,
  vEnvUrlOrDefault,
} from "@/src/valibot-utils";
import * as v from "valibot";
import { WHITE_LABEL_CONFIG } from "./white-label.config";

// Dynamically generate CollateralSymbolSchema from white-label config
export const CollateralSymbolSchema = v.union(
  WHITE_LABEL_CONFIG.tokens.collaterals.map(c => v.literal(c.symbol)) as [
    v.LiteralSchema<string, undefined>,
    ...v.LiteralSchema<string, undefined>[]
  ]
);


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
type BranchEnv = Omit<Branch, "contracts"> & {
  contracts: Record<ContractEnvName, Address>;
};


const vOptionalTroveExplorer = v.pipe(
  v.optional(v.string()),
  v.transform((x) => {
    if (!x) return null;
    const [name, url] = x.split("|");
    return {
      name: v.parse(v.string(), name),
      url: v.parse(
        v.pipe(
          v.string(),
          v.url(),
          v.includes("{branch}", "Trove explorer URL must contain {branch}"),
          v.includes("{troveId}", "Trove explorer URL must contain {troveId}"),
        ),
        url,
      ),
    };
  }),
);

export const EnvSchema = v.pipe(
  v.object({
    ACCOUNT_SCREEN: v.optional(vEnvFlag(), "false"),
    APP_COMMIT_HASH: v.string(),
    APP_COMMIT_URL: v.pipe(
      vEnvUrlOrDefault(DEFAULT_COMMIT_URL),
      v.check(
        (value) => value === null || value.includes("{commit}"),
        `Invalid APP_COMMIT_URL (must contain "{commit}")`,
      ),
    ),
    APP_VERSION: v.string(),
    APP_VERSION_URL: v.pipe(
      vEnvUrlOrDefault(DEFAULT_VERSION_URL),
      v.check(
        (value) => value === null || value.includes("{version}"),
        `Invalid APP_VERSION_URL (must contain "{version}")`,
      ),
    ),
    BLOCKING_LIST: v.optional(
      v.union([vAddress(), v.null()]),
      null,
    ),
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
    CHAIN_BLOCK_EXPLORER: v.optional(vEnvLink(true)),
    CHAIN_CONTRACT_ENS_REGISTRY: v.optional(
      v.union([v.null(), vEnvAddressAndBlock()]),
      null,
    ),
    CHAIN_CONTRACT_ENS_RESOLVER: v.optional(
      v.union([v.null(), vEnvAddressAndBlock()]),
      null,
    ),
    CHAIN_CONTRACT_MULTICALL: vAddress(),
    CONTRACTS_COMMIT_HASH: v.string(),
    CONTRACTS_COMMIT_URL: v.pipe(
      vEnvUrlOrDefault(DEFAULT_COMMIT_URL),
      v.check(
        (value) => value === null || (value.includes("{commit}")),
        `Invalid CONTRACTS_COMMIT_URL (must contain "{commit}")`,
      ),
    ),
    DEPLOYMENT_FLAVOR: v.pipe(
      v.optional(v.string(), ""),
      v.transform((value) => value.trim() || null),
    ),
    KNOWN_INITIATIVES_URL: v.optional(v.pipe(v.string(), v.url())),
    LEGACY_CHECK: v.optional(vEnvLegacyCheck(), "true"),
    LIQUITY_STATS_URL: v.optional(v.pipe(v.string(), v.url())),
    LIQUITY_GOVERNANCE_URL: v.optional(v.union([v.pipe(v.string(), v.url()), v.literal("")])),
    SAFE_API_URL: v.optional(v.union([v.pipe(v.string(), v.url()), v.literal("")])),
    SBOLD: v.optional(v.union([vAddress(), v.literal("")])),
    SUBGRAPH_URL: v.pipe(v.string(), v.url()),
    VERCEL_ANALYTICS: v.optional(vEnvFlag(), "false"),
    WALLET_CONNECT_PROJECT_ID: v.pipe(
      v.string(),
      v.transform((value) => value.trim()),
      v.check(
        (value) => value.length > 0,
        "WALLET_CONNECT_PROJECT_ID must be set",
      ),
    ),
    TROVE_EXPLORER_0: vOptionalTroveExplorer,
    TROVE_EXPLORER_1: vOptionalTroveExplorer,

    CONTRACT_MAIN_TOKEN: vAddress(),
    CONTRACT_COLLATERAL_REGISTRY: vAddress(),
    CONTRACT_DEBT_IN_FRONT_HELPER: vAddress(),
    CONTRACT_EXCHANGE_HELPERS: vAddress(),
    CONTRACT_GOVERNANCE: vAddress(),
    CONTRACT_HINT_HELPERS: vAddress(),
    CONTRACT_LQTY_STAKING: vAddress(),
    CONTRACT_LQTY_TOKEN: vAddress(),
    CONTRACT_LUSD_TOKEN: vAddress(),
    CONTRACT_MULTI_TROVE_GETTER: vAddress(),
    CONTRACT_WETH: vAddress(),

    // Collateral contracts are now loaded directly from white-label.config, not env vars
  }),
  v.transform((data) => {
    const env = { ...data };

    const envBranches: BranchEnv[] = [];

    const defaultIcStrategiesForChain = DEFAULT_STRATEGIES.find(
      ([chainId]) => chainId === env.CHAIN_ID,
    )?.[1] ?? null;

    // Generate branches directly from white-label config instead of environment variables
    WHITE_LABEL_CONFIG.tokens.collaterals.forEach((collateral, index) => {
      if (!isBranchId(index)) {
        throw new Error(`Invalid branch: ${index}`);
      }

      const deployment = (collateral.deployments as any)[env.CHAIN_ID];
      if (!deployment) {
        console.warn(`⚠️  No deployment for ${collateral.symbol} on chain ${env.CHAIN_ID}, skipping...`);
        return;
      }

      const contracts: Record<ContractEnvName, Address> = {
        ACTIVE_POOL: deployment.activePool || "0x0000000000000000000000000000000000000000",
        BORROWER_OPERATIONS: deployment.borrowerOperations || "0x0000000000000000000000000000000000000000",
        COLL_SURPLUS_POOL: deployment.collSurplusPool || "0x0000000000000000000000000000000000000000",
        COLL_TOKEN: deployment.collToken || "0x0000000000000000000000000000000000000000",
        DEFAULT_POOL: deployment.defaultPool || "0x0000000000000000000000000000000000000000",
        LEVERAGE_ZAPPER: deployment.leverageZapper || "0x0000000000000000000000000000000000000000",
        PRICE_FEED: deployment.priceFeed || "0x0000000000000000000000000000000000000000",
        SORTED_TROVES: deployment.sortedTroves || "0x0000000000000000000000000000000000000000",
        STABILITY_POOL: deployment.stabilityPool || "0x0000000000000000000000000000000000000000",
        TROVE_MANAGER: deployment.troveManager || "0x0000000000000000000000000000000000000000",
        TROVE_NFT: deployment.troveNFT || "0x0000000000000000000000000000000000000000",
      };

      const defaultIcStrategies = defaultIcStrategiesForChain?.find(
        ([branchId]) => branchId === index,
      )?.[1];

      envBranches[index] = {
        id: index,
        branchId: index,
        contracts,
        strategies: defaultIcStrategies ?? [],
        symbol: collateral.symbol,
      };
    });

    const legacyCheck = env.LEGACY_CHECK === true
      ? DEFAULT_LEGACY_CHECKS.get(env.CHAIN_ID) ?? null
      : env.LEGACY_CHECK === false
      ? null
      : env.LEGACY_CHECK;

    return {
      ...env,
      ENV_BRANCHES: envBranches,
      LEGACY_CHECK: legacyCheck,
    } as typeof env & { ENV_BRANCHES: BranchEnv[]; LEGACY_CHECK: any };
  }),
);

export type Env = v.InferOutput<typeof EnvSchema>;


const parsedEnv = v.safeParse(EnvSchema, {
  ACCOUNT_SCREEN: process.env.NEXT_PUBLIC_ACCOUNT_SCREEN,
  APP_VERSION: (
    // APP_VERSION_FROM_BUILD is set at build time (see next.config.js)
    // and gets overridden by NEXT_PUBLIC_APP_VERSION if set.
    process.env.NEXT_PUBLIC_APP_VERSION
      ?? process.env.APP_VERSION_FROM_BUILD
  ),
  // APP_COMMIT_HASH_FROM_BUILD is set at build time (see next.config.js)
  // and gets overridden by NEXT_PUBLIC_APP_COMMIT_HASH if set.
  APP_COMMIT_HASH: (
    process.env.NEXT_PUBLIC_APP_COMMIT_HASH
      ?? process.env.APP_COMMIT_HASH_FROM_BUILD
  ),
  APP_COMMIT_URL: process.env.NEXT_PUBLIC_APP_COMMIT_URL,
  APP_VERSION_URL: (
    process.env.NEXT_PUBLIC_APP_VERSION_URL
      ?? DEFAULT_VERSION_URL
  ),
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
  CONTRACTS_COMMIT_HASH: (
    // CONTRACTS_COMMIT_HASH_FROM_BUILD is set at build time (see next.config.js)
    // and gets overridden by NEXT_PUBLIC_CONTRACTS_COMMIT_HASH if set.
    process.env.NEXT_PUBLIC_CONTRACTS_COMMIT_HASH
      ?? process.env.CONTRACTS_COMMIT_HASH_FROM_BUILD
  ),
  CONTRACTS_COMMIT_URL: process.env.NEXT_PUBLIC_CONTRACTS_COMMIT_URL,
  DEPLOYMENT_FLAVOR: process.env.NEXT_PUBLIC_DEPLOYMENT_FLAVOR,
  KNOWN_INITIATIVES_URL: process.env.NEXT_PUBLIC_KNOWN_INITIATIVES_URL,
  LEGACY_CHECK: process.env.NEXT_PUBLIC_LEGACY_CHECK,
  LIQUITY_STATS_URL: process.env.NEXT_PUBLIC_LIQUITY_STATS_URL,
  LIQUITY_GOVERNANCE_URL: process.env.NEXT_PUBLIC_LIQUITY_GOVERNANCE_URL,
  SAFE_API_URL: process.env.NEXT_PUBLIC_SAFE_API_URL,
  SBOLD: process.env.NEXT_PUBLIC_SBOLD,
  SUBGRAPH_URL: process.env.NEXT_PUBLIC_SUBGRAPH_URL,
  VERCEL_ANALYTICS: process.env.NEXT_PUBLIC_VERCEL_ANALYTICS,
  WALLET_CONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
  TROVE_EXPLORER_0: process.env.NEXT_PUBLIC_TROVE_EXPLORER_0,
  TROVE_EXPLORER_1: process.env.NEXT_PUBLIC_TROVE_EXPLORER_1,

  CONTRACT_MAIN_TOKEN: process.env.NEXT_PUBLIC_CONTRACT_MAIN_TOKEN,
  CONTRACT_COLLATERAL_REGISTRY: process.env.NEXT_PUBLIC_CONTRACT_COLLATERAL_REGISTRY,
  CONTRACT_DEBT_IN_FRONT_HELPER: process.env.NEXT_PUBLIC_CONTRACT_DEBT_IN_FRONT_HELPER,
  CONTRACT_EXCHANGE_HELPERS: process.env.NEXT_PUBLIC_CONTRACT_EXCHANGE_HELPERS,
  CONTRACT_GOVERNANCE: process.env.NEXT_PUBLIC_CONTRACT_GOVERNANCE,
  CONTRACT_HINT_HELPERS: process.env.NEXT_PUBLIC_CONTRACT_HINT_HELPERS,
  CONTRACT_LQTY_STAKING: process.env.NEXT_PUBLIC_CONTRACT_LQTY_STAKING,
  CONTRACT_LQTY_TOKEN: process.env.NEXT_PUBLIC_CONTRACT_LQTY_TOKEN,
  CONTRACT_LUSD_TOKEN: process.env.NEXT_PUBLIC_CONTRACT_LUSD_TOKEN,
  CONTRACT_MULTI_TROVE_GETTER: process.env.NEXT_PUBLIC_CONTRACT_MULTI_TROVE_GETTER,
  CONTRACT_WETH: process.env.NEXT_PUBLIC_CONTRACT_WETH,

});

if (!parsedEnv.success) {
  console.error(
    "Invalid environment variable(s):",
    v.flatten<typeof EnvSchema>(parsedEnv.issues).nested,
  );
  throw new Error(
    `Invalid environment variable(s): ${
      JSON.stringify(
        v.flatten<typeof EnvSchema>(parsedEnv.issues).nested,
      )
    }`,
  );
}

export const {
  ACCOUNT_SCREEN,
  APP_COMMIT_HASH,
  APP_COMMIT_URL,
  APP_VERSION,
  APP_VERSION_URL,
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
  ENV_BRANCHES,
  CONTRACTS_COMMIT_HASH,
  CONTRACTS_COMMIT_URL,
  CONTRACT_MAIN_TOKEN,
  CONTRACT_COLLATERAL_REGISTRY,
  CONTRACT_DEBT_IN_FRONT_HELPER,
  CONTRACT_EXCHANGE_HELPERS,
  CONTRACT_GOVERNANCE,
  CONTRACT_HINT_HELPERS,
  CONTRACT_LQTY_STAKING,
  CONTRACT_LQTY_TOKEN,
  CONTRACT_LUSD_TOKEN,
  CONTRACT_MULTI_TROVE_GETTER,
  CONTRACT_WETH,
  DEPLOYMENT_FLAVOR,
  KNOWN_INITIATIVES_URL,
  LEGACY_CHECK,
  LIQUITY_STATS_URL,
  LIQUITY_GOVERNANCE_URL,
  SAFE_API_URL,
  SBOLD,
  SUBGRAPH_URL,
  VERCEL_ANALYTICS,
  WALLET_CONNECT_PROJECT_ID,
  TROVE_EXPLORER_0,
  TROVE_EXPLORER_1,
} = parsedEnv.output;
