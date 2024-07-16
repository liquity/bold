// EARN_POOLS is imported from demo-mode/demo-data rather than demo-mode (which re-exports it),
// as doing so create an error with `next build` about a missing generateStaticParams().
import { EARN_POOLS } from "@/src/demo-mode/demo-data";
import { EarnPoolScreen } from "@/src/screens/EarnPoolScreen/EarnPoolScreen";

export function generateStaticParams() {
  return Object.keys(EARN_POOLS).map((symbol) => ({
    pool: symbol.toLowerCase(),
  }));
}

export default function Layout() {
  return <EarnPoolScreen />;
}
