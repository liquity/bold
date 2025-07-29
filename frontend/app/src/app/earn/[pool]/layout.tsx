import { EarnPoolScreen } from "@/src/screens/EarnPoolScreen/EarnPoolScreen";
import { YusndPoolScreen } from "@/src/screens/EarnPoolScreen/YusndPoolScreen";

export function generateStaticParams() {
  return [
    { pool: "eth" },
    { pool: "wsteth" },
    { pool: "reth" },
    { pool: "rseth" },
    { pool: "weeth" },
    { pool: "arb" },
    { pool: "comp" },
    { pool: "tbtc" },
    { pool: "yusnd" },
  ];
}

export default async function Layout({
  params,
}: {
  params: Promise<{
    pool: "eth" | "wsteth" | "reth" | "rseth" | "weeth" | "arb" | "comp" | "tbtc" | "yusnd";
  }>;
}) {
  const { pool } = await params;
  return pool === "yusnd"
    ? <YusndPoolScreen />
    : <EarnPoolScreen />;
}
