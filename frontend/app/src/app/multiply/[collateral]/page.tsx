import { getCollateralSymbols } from "@/src/white-label.config";

export function generateStaticParams() {
  return getCollateralSymbols().map(collateral => ({ collateral }));
}

export default function LeverageCollateralPage() {
  // see layout in parent folder
  return null;
}
