import type { CollateralSymbol, CollIndex } from "@/src/types";

import { getContracts } from "@/src/contracts";

export const DISABLED_COLLATERAL_SYMBOLS = new Set<CollateralSymbol>([
  "RSETH",
]);

export function isVisibleCollateralSymbol(
  symbol: CollateralSymbol | null | undefined,
): symbol is CollateralSymbol {
  return Boolean(symbol && !DISABLED_COLLATERAL_SYMBOLS.has(symbol));
}

export function isVisibleCollIndex(
  collIndex: CollIndex | null | undefined,
): collIndex is CollIndex {
  if (collIndex === null || collIndex === undefined) {
    return false;
  }
  return isVisibleCollateralSymbol(getContracts().collaterals[collIndex]?.symbol);
}

export function getVisibleContractCollaterals() {
  return getContracts().collaterals.filter(({ symbol }) => (
    isVisibleCollateralSymbol(symbol)
  ));
}
