import type { Address } from "./types";

export const ADDRESS_ZERO: Address = `0x${"0".repeat(40)}`;

// shorten an address to look like 0x1234…5678
// `chars` is the number of characters to show on each side.
export function shortenAddress(address: Address, chars: number) {
  return address.length < chars * 2 + 2
    ? address
    : address.slice(0, chars + 2) + "…" + address.slice(-chars);
}

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
export function isAddress(address: unknown): address is Address {
  return typeof address === "string" && ADDRESS_RE.test(address);
}

export function addressesEqual(a: Address, b: Address) {
  return a.toLowerCase() === b.toLowerCase();
}
