import { Address } from "./types";

// shorten an address to look like 0x1234…5678
// `chars` is the number of characters to show on each side.
export function shortenAddress(address: Address, chars: number) {
  return address.length < chars * 2 + 2
    ? address
    : address.slice(0, chars + 2) + "…" + address.slice(-chars);
}
