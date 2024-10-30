import { EarnPoolScreen } from "@/src/screens/EarnPoolScreen/EarnPoolScreen";

export function generateStaticParams() {
  return [
    { pool: "eth" },
    { pool: "reth" },
    { pool: "wsteth" },
  ];
}

export default function Layout() {
  return <EarnPoolScreen />;
}
