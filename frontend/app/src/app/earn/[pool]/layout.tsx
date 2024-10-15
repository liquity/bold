import { EarnPoolScreen } from "@/src/screens/EarnPoolScreen/EarnPoolScreen";

export function generateStaticParams() {
  return [
    { pool: "eth" },
    { pool: "reth" },
    { pool: "steth" },
  ];
}

export default function Layout() {
  return <EarnPoolScreen />;
}
