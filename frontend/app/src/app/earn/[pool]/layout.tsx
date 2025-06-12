import { EarnPoolScreen } from "@/src/screens/EarnPoolScreen/EarnPoolScreen";

export function generateStaticParams() {
  return [
    { pool: "bvbtc" }
  ];
}

export default function Layout() {
  return <EarnPoolScreen />;
}
