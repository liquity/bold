import { notFound } from "next/navigation";

import { EarnPoolScreen } from "@/src/screens/EarnPoolScreen/EarnPoolScreen";
import { SboldPoolScreen } from "@/src/screens/EarnPoolScreen/SboldPoolScreen";
import { EARN_POOLS, isEarnPoolId } from "@/src/types";

export function generateStaticParams() {
  return EARN_POOLS.map((pool) => ({ pool }));
}

export default async function Layout({
  params,
}: {
  params: Promise<{ pool: string }>;
}) {
  const { pool } = await params;
  if (!isEarnPoolId(pool)) notFound();
  return pool === "sbold"
    ? <SboldPoolScreen />
    : <EarnPoolScreen />;
}
