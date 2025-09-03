// import { getContracts } from "@/src/lib/contracts";
// import { COLLATERALS } from "@/src/lib/tokens";
import type { CollateralSymbol, CollIndex, PrefixedTroveId, TroveId } from "@/src/types";
import { COLLATERALS, type CollateralToken } from "@liquity2/uikit";
import { keccak256, encodeAbiParameters, parseAbiParameters, type Address } from "viem";
import { getContracts } from "@/src/contracts";

export function isCollateralSymbol(symbol: string): symbol is CollateralSymbol {
  return (
    symbol === "ETH" 
    || symbol === "WETH" 
    || symbol === "WSTETH"
    || symbol === "RETH" 
    || symbol === "RSETH" 
    || symbol === "WEETH" 
    || symbol === "ARB" 
    || symbol === "COMP" 
    || symbol === "TBTC" 
  );
}

export function isCollIndex(value: unknown): value is CollIndex {
  return typeof value === "number" && value >= 0 && value <= 7;
}

export function isTroveId(value: unknown): value is TroveId {
  return typeof value === "string" && /^0x[0-9a-f]+$/.test(value);
}

export function isPrefixedtroveId(value: unknown): value is PrefixedTroveId {
  return typeof value === "string" && /^[0-9]:0x[0-9a-f]+$/.test(value);
}

export function getTroveId(owner: Address, ownerIndex: bigint | number) {
  return BigInt(keccak256(encodeAbiParameters(
    parseAbiParameters("address, uint256"),
    [owner, BigInt(ownerIndex)],
  )));
}

export function parsePrefixedTroveId(value: PrefixedTroveId): {
  collIndex: CollIndex;
  troveId: TroveId;
} {
  const [collIndex_, troveId] = value.split(":");
  if (!collIndex_ || !troveId) {
    throw new Error(`Invalid prefixed trove ID: ${value}`);
  }
  const collIndex = parseInt(collIndex_, 10);
  if (!isCollIndex(collIndex) || !isTroveId(troveId)) {
    throw new Error(`Invalid prefixed trove ID: ${value}`);
  }
  return { collIndex, troveId };
}

export function getPrefixedTroveId(collIndex: CollIndex, troveId: TroveId): PrefixedTroveId {
  return `${collIndex}:${troveId}`;
}

export function getCollToken(collIndex: CollIndex | null): CollateralToken | null {
  const { collaterals } = getContracts();
  if (collIndex === null) {
    return null;
  }
  return collaterals.map(({ symbol }) => {
    const collateral = COLLATERALS.find((c) => c.symbol === symbol.toUpperCase());
    if (!collateral) {
      throw new Error(`Unknown collateral symbol: ${symbol}`);
    }
    return collateral;
  })[collIndex] ?? null;
}

export function getCollIndexFromSymbol(symbol: CollateralSymbol | null): CollIndex | null {
  if (symbol === null) return null;
  const { collaterals } = getContracts();
  const collIndex = collaterals.findIndex((coll) => coll.symbol === symbol);
  return isCollIndex(collIndex) ? collIndex : null;
}

/**
 * Formats a timestamp to show how long ago it was
 * @param timestamp Unix timestamp in seconds
 * @returns Formatted string like "2h ago", "3d ago", etc.
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  
  if (diff < 0) return "just now";
  
  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;
  const month = day * 30;
  const year = day * 365;
  
  if (diff < minute) {
    return "just now";
  } else if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes}m ago`;
  } else if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours}h ago`;
  } else if (diff < week) {
    const days = Math.floor(diff / day);
    return `${days}d ago`;
  } else if (diff < month) {
    const weeks = Math.floor(diff / week);
    return `${weeks}w ago`;
  } else if (diff < year) {
    const months = Math.floor(diff / month);
    return `${months}mo ago`;
  } else {
    const years = Math.floor(diff / year);
    return `${years}y ago`;
  }
}