import type { Address } from "@liquity2/uikit";

import { isAddress } from "@/src/eth-utils";
import * as v from "valibot";

export function vAddress() {
  return v.custom<Address>(isAddress, "not a valid Ethereum address");
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
