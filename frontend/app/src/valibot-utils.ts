import type { Address, IcStrategy, PrefixedTroveId, TroveId } from "@/src/types";
import type { Dnum } from "dnum";

import { isPrefixedtroveId, isTroveId } from "@/src/types";
import { isDnum } from "dnum";
import * as v from "valibot";

// this is duplicated from the UI kit rather than being imported,
// to make valibot-utils.ts RSC-compatible.
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
function isAddress(address: unknown): address is Address {
  return typeof address === "string" && ADDRESS_RE.test(address);
}

export function vAddress() {
  return v.custom<Address>(isAddress, "not a valid Ethereum address");
}

export function vHash() {
  return v.custom<`0x${string}`>(
    (value) => typeof value === "string" && value.startsWith("0x"),
    "not a valid transaction hash",
  );
}

export function vDnum() {
  return v.custom<Dnum>(isDnum, "not a Dnum");
}

export function vBranchId() {
  return v.union([
    v.literal(0),
    v.literal(1),
    v.literal(2),
    v.literal(3),
    v.literal(4),
    v.literal(5),
    v.literal(6),
    v.literal(7),
    v.literal(8),
    v.literal(9),
  ]);
}

export function vTroveId() {
  return v.pipe(
    v.string(),
    v.trim(),
    v.custom<TroveId>(isTroveId, "not a valid Trove ID"),
  );
}

export function vPrefixedTroveId() {
  return v.pipe(
    v.string(),
    v.trim(),
    v.custom<PrefixedTroveId>(isPrefixedtroveId, "not a valid prefixed Trove ID"),
  );
}

// accepts a URL or a vEnvFlag to use the default or disable
export function vEnvUrlOrDefault(defaultValue: `https://${string}`) {
  return v.pipe(
    // true = use default
    // false = disable
    // string = custom URL
    v.optional(
      v.union([
        v.pipe(v.string(), v.url()),
        vEnvFlag(),
      ]),
      "true",
    ),
    v.transform((value) => {
      if (typeof value === "string") {
        if (value.startsWith("https://")) {
          return value;
        }
        throw new Error(`URL must start with "https://", got "${value}"`);
      }
      return value ? defaultValue : null;
    }),
  );
}

// Env var link, e.g. Etherscan|https://etherscan.io
export function vEnvLink(addFinalSlash = false) {
  return v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^[^|]+\|https?:\/\/[^|]+$/),
    v.transform<string, {
      name: string;
      url: string;
    }>((value) => {
      let [name, url] = value.split("|") as [string, string];
      if (addFinalSlash && !url.endsWith("/")) {
        url += "/";
      }
      return { name, url };
    }),
  );
}

// Env var flag, true/false or 1/0
export function vEnvFlag() {
  return v.union([
    v.pipe(
      v.string(),
      v.trim(),
      v.regex(/^(true|false)$/),
      v.transform((value) => value === "true"),
    ),
    v.pipe(
      v.number(),
      v.transform((value) => value !== 0),
    ),
  ]);
}

// Env var address + creation block, e.g. 0xca11bde05977b3631167028862be2a173976ca11|14353601
export function vEnvAddressAndBlock() {
  return v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^0x[0-9a-fA-F]{40}\|[0-9]+$/),
    v.transform<
      string,
      { address: Address; blockCreated?: number }
    >((value) => {
      const [address, block] = value.split("|") as [string, string];
      const parsedBlock = parseInt(block, 10);
      if (!isAddress(address)) {
        throw new Error(`${address} is not a valid Ethereum address`);
      }
      return {
        address,
        blockCreated: isNaN(parsedBlock) ? undefined : parsedBlock,
      };
    }),
  );
}

// Env var currency, e.g. Ether|ETH|18
export function vEnvCurrency() {
  return v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^[^|]+\|[^|]+\|[0-9]+$/),
    v.transform<
      string,
      { decimals: number; name: string; symbol: string }
    >((value) => {
      const [name, symbol, decimals] = value.split("|") as [string, string, string];
      return {
        decimals: parseInt(decimals, 10),
        name,
        symbol,
      };
    }),
  );
}

export function vPositionStake() {
  return v.object({
    type: v.literal("stake"),
    owner: vAddress(),
    deposit: vDnum(),
    rewards: v.object({
      lusd: vDnum(),
      eth: vDnum(),
    }),
  });
}

const VPositionLoanBase = v.object({
  type: v.union([
    v.literal("borrow"),
    v.literal("multiply"),
  ]),
  batchManager: v.union([v.null(), vAddress()]),
  borrowed: vDnum(),
  borrower: vAddress(),
  branchId: vBranchId(),
  deposit: vDnum(),
  interestRate: vDnum(),
  status: v.union([
    v.literal("active"),
    v.literal("closed"),
    v.literal("liquidated"),
    v.literal("redeemed"),
  ]),
});

export function vPositionLoanCommited() {
  return v.intersect([
    VPositionLoanBase,
    v.object({
      troveId: vTroveId(),
      createdAt: v.number(),
      lastUserActionAt: v.number(),
      isZombie: v.boolean(),
      indexedDebt: vDnum(),
      redemptionCount: v.number(),
      redeemedColl: vDnum(),
      redeemedDebt: vDnum(),
    }),
  ]);
}

export function vPositionLoanUncommited() {
  return v.intersect([
    VPositionLoanBase,
    v.object({
      troveId: v.null(),
    }),
  ]);
}

export function vPositionLoan() {
  return v.intersect([
    vPositionLoanCommited(),
    vPositionLoanUncommited(),
  ]);
}

export function vPositionEarn() {
  return v.object({
    type: v.literal("earn"),
    owner: vAddress(),
    branchId: vBranchId(),
    deposit: vDnum(),
    rewards: v.object({
      bold: vDnum(),
      coll: vDnum(),
    }),
  });
}

export function vPositionSbold() {
  return v.object({
    type: v.literal("sbold"),
    owner: vAddress(),
    bold: vDnum(),
    sbold: vDnum(),
  });
}

export function vVote() {
  return v.union([
    v.literal("for"),
    v.literal("against"),
  ]);
}

export function vVoteAllocation() {
  return v.object({
    vote: v.union([v.null(), vVote()]),
    value: vDnum(),
  });
}

export function vVoteAllocations() {
  return v.record(vAddress(), vVoteAllocation());
}

export function vCollateralSymbol() {
  return v.union([
    v.literal("ETH"),
    v.literal("RETH"),
    v.literal("WSTETH"),
  ]);
}

export function vTokenSymbol() {
  return v.union([
    vCollateralSymbol(),
    v.literal("BOLD"),
    v.literal("LEGACY_BOLD"),
    v.literal("LQTY"),
    v.literal("LUSD"),
    v.literal("SBOLD"),
  ]);
}

export function vEnvLegacyCheck() {
  return v.union([
    vEnvFlag(),
    v.pipe(
      v.string(),
      v.transform((value) => JSON.parse(value)),
      v.object({
        BOLD_TOKEN: vAddress(),
        COLLATERAL_REGISTRY: vAddress(),
        GOVERNANCE: vAddress(),
        INITIATIVES_SNAPSHOT_URL: v.string(),
        TROVES_SNAPSHOT_URL: v.string(),
        BRANCHES: v.array(
          v.object({
            symbol: vCollateralSymbol(),
            name: v.string(),
            COLL_TOKEN: vAddress(),
            LEVERAGE_ZAPPER: vAddress(),
            STABILITY_POOL: vAddress(),
            TROVE_MANAGER: vAddress(),
          }),
        ),
      }),
    ),
  ]);
}

export function vIcStrategy() {
  return v.union([
    vEnvFlag(),
    v.pipe(
      v.string(),
      v.regex(/^\s?([^:]+:0x[0-9a-fA-F]{40},?)*\s?$/),
      v.transform((value): IcStrategy[] => {
        value = value.trim();
        if (value.endsWith(",")) {
          value = value.slice(0, -1);
        }
        return value.split(",")
          .map((s) => {
            const [name, address_] = s.split(":");
            const address = address_?.trim().toLowerCase();
            if (!name || !isAddress(address)) {
              return null;
            }
            return { address, name };
          })
          .filter((x) => x !== null);
      }),
    ),
  ]);
}
