import { EARN_POOLS } from "@/src/demo-mode";
import { EarnPoolScreen } from "@/src/screens/EarnPoolScreen/EarnPoolScreen";

export function generateStaticParams() {
  return Object.keys(EARN_POOLS).map((symbol) => ({
    pool: symbol.toLowerCase(),
  }));
}

export default function Layout() {
  return <EarnPoolScreen />;
}
