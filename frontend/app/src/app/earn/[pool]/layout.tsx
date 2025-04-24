import { EarnPoolScreen } from "@/src/screens/EarnPoolScreen/EarnPoolScreen";

export function generateStaticParams() {
  return [
    { pool: "bvbtc" },
    { pool: "weth" },
  ];
}

export default function Layout() {
  return <EarnPoolScreen />;
}
