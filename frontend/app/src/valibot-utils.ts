import type { PrefixedTroveId } from "@/src/types";
import type { Address } from "@liquity2/uikit";
import type { Dnum } from "dnum";

import { isAddress } from "@/src/eth-utils";
import { isDnum } from "dnum";
import * as v from "valibot";

export function vAddress() {
  return v.custom<Address>(isAddress, "not a valid Ethereum address");
}

export function vDnum() {
  return v.custom<Dnum>(isDnum, "not a Dnum");
}

export function vCollIndex() {
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

export function vPrefixedTroveId() {
  return v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^[0-9]:0x[0-9a-f]+$/),
    v.transform((value) => value as PrefixedTroveId),
  );
}

// Env var link, e.g. Etherscan|https://etherscan.io
export function vEnvLink() {
  return v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^[^|]+\|https?:\/\/[^|]+$/),
    v.transform<
      string,
      { name: string; url: string }
    >((value) => {
      const [name, url] = value.split("|");
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
      const [address, block] = value.split("|");
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
      const [name, symbol, decimals] = value.split("|");
      return {
        decimals: parseInt(decimals, 10),
        name,
        symbol,
      };
    }),
  );
}
