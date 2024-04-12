import type { Address } from "@/src/types";

import { isAddress } from "@/src/eth-utils";
import z from "zod";

export function zAddress() {
  return z.string().transform((value: string, { addIssue }) => {
    if (!isAddress(value)) {
      addIssue({
        code: z.ZodIssueCode.custom,
        message: `${value} is not a valid Ethereum address`,
      });
      return z.NEVER;
    }
    return value;
  });
}

// Env var link, e.g. Etherscan|https://etherscan.io
export const EnvLinkSchema = z
  .string()
  .trim()
  .regex(/^[^|]+\|https?:\/\/[^|]+$/)
  .transform((value) => {
    const [name, url] = value.split("|");
    return { name, url };
  });

// Env var address + creation block, e.g. 0xca11bde05977b3631167028862be2a173976ca11|14353601
export const EnvAddressAndBlockSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{40}\|[0-9]+$/)
  .transform((value): { address: Address; blockCreated?: number } => {
    const [address, block] = value.split("|");
    const parsedBlock = parseInt(block, 10);
    if (!isAddress(address)) {
      throw new Error(`${address} is not a valid Ethereum address`);
    }
    return {
      address,
      blockCreated: isNaN(parsedBlock) ? undefined : parsedBlock,
    };
  });

// Env var currency, e.g. Ether|ETH|18
export const EnvCurrencySchema = z
  .string()
  .trim()
  .regex(/^[^|]+\|[^|]+\|[0-9]+$/)
  .transform((value) => {
    const [name, symbol, decimals] = value.split("|");
    return {
      decimals: parseInt(decimals, 10),
      name,
      symbol,
    };
  });
