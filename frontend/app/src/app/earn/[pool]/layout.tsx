import { EarnPoolScreen } from "@/src/screens/EarnPoolScreen/EarnPoolScreen";

export function generateStaticParams() {
  return [
    { pool: "btcb" },
    { pool: "weth" },
  ];
}

export default function Layout() {
  return <EarnPoolScreen />;
}
