import { POOLS } from "@/src/demo-data";
import { EarnPoolScreen } from "@/src/screens/EarnPoolScreen/EarnPoolScreen";

export function generateStaticParams() {
  return POOLS.map((pool) => ({
    pool: pool.symbol.toLowerCase(),
  }));
}

export default function Layout() {
  return <EarnPoolScreen />;
}
