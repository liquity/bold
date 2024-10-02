import type { CollIndex, PrefixedTroveId, TroveId } from "@/src/types";
import type { Address, CollateralSymbol, CollateralToken } from "@liquity2/uikit";

import { useCollateralContracts } from "@/src/contracts";
import { isCollIndex, isTroveId } from "@/src/types";
import { COLLATERALS } from "@liquity2/uikit";
import { match } from "ts-pattern";
import { encodeAbiParameters, keccak256, parseAbiParameters } from "viem";

// As defined in ITroveManager.sol
export type TroveStatus =
  | "nonExistent"
  | "active"
  | "closedByOwner"
  | "closedByLiquidation"
  | "unredeemable";

export function shortenTroveId(troveId: TroveId, chars = 4) {
  return troveId.length < chars * 2 + 2
    ? troveId
    : troveId.slice(0, chars + 2) + "…" + troveId.slice(-chars);
}

export function troveStatusFromNumber(value: number): TroveStatus {
  return match<number, TroveStatus>(value)
    .with(0, () => "nonExistent")
    .with(1, () => "active")
    .with(2, () => "closedByOwner")
    .with(3, () => "closedByLiquidation")
    .with(4, () => "unredeemable")
    .otherwise(() => {
      throw new Error(`Unknown trove status number: ${value}`);
    });
}

export function troveStatusToLabel(status: TroveStatus) {
  return match(status)
    .with("nonExistent", () => "Non-existent")
    .with("active", () => "Active")
    .with("closedByOwner", () => "Closed by owner")
    .with("closedByLiquidation", () => "Closed by liquidation")
    .with("unredeemable", () => "Unredeemable")
    .exhaustive();
}

export function getTroveId(owner: Address, ownerIndex: bigint | number) {
  return BigInt(keccak256(encodeAbiParameters(
    parseAbiParameters("address, uint256"),
    [owner, BigInt(ownerIndex)],
  )));
}

export function getCollateralFromTroveSymbol(symbol: string): null | CollateralSymbol {
  symbol = symbol.toUpperCase();
  if (symbol === "ETH" || symbol === "WETH") {
    return "ETH";
  }
  // this is to handle symbols used for testing, like stETH1, stETH2, etc.
  if (symbol.startsWith("RETH")) {
    return "RETH";
  }
  if (symbol.startsWith("STETH")) {
    return "STETH";
  }
  return null;
}

export function parsePrefixedTroveId(value: PrefixedTroveId): {
  collIndex: CollIndex;
  troveId: TroveId;
} {
  const [collIndex_, troveId] = value.split(":");
  const collIndex = parseInt(collIndex_, 10);
  if (!isCollIndex(collIndex) || !isTroveId(troveId)) {
    throw new Error(`Invalid prefixed trove ID: ${value}`);
  }
  return { collIndex, troveId };
}

export function getPrefixedTroveId(collIndex: CollIndex, troveId: TroveId): PrefixedTroveId {
  return `${collIndex}:${troveId}`;
}

export function useCollateral(collIndex: null | number): null | CollateralToken {
  const collContracts = useCollateralContracts();
  if (collIndex === null) {
    return null;
  }
  return collContracts.map(({ symbol }) => {
    const collateral = COLLATERALS.find((c) => c.symbol === symbol);
    if (!collateral) {
      throw new Error(`Unknown collateral symbol: ${symbol}`);
    }
    return collateral;
  })[collIndex];
}

export function useCollIndexFromSymbol(symbol: CollateralSymbol | null): CollIndex | null {
  const collContracts = useCollateralContracts();
  if (symbol === null) {
    return null;
  }
  const collIndex = collContracts.findIndex((coll) => coll.symbol === symbol);
  return isCollIndex(collIndex) ? collIndex : null;
}
