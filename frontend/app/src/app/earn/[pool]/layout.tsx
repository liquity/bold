import { EARN_POOLS } from "@/src/demo-data";
import { EarnPoolScreen } from "@/src/screens/EarnPoolScreen/EarnPoolScreen";

export function generateStaticParams() {
  return Object.keys(EARN_POOLS).map((symbol) => ({
    pool: symbol.toLowerCase(),
  }));
}

export default function Layout() {
  return <EarnPoolScreen />;
}
