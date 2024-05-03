import { POOLS } from "@/src/demo-data";
import { EarnScreen } from "./EarnScreen";

export function generateStaticParams() {
  return POOLS.map((pool) => ({
    pool: pool.symbol.toLowerCase(),
  }));
}

export default function Layout() {
  // We are rendering <EarnScreen /> from the layout,
  // so that we can use animations between route changes.
  return <EarnScreen />;
}
