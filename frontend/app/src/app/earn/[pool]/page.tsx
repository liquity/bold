import { getEarnPoolSymbols } from "@/src/white-label.config";

export function generateStaticParams() {
  return getEarnPoolSymbols().map(pool => ({ pool }));
}

export default function EarnPoolPage() {
  return null;
}
