"use client";

import { isAddress } from "@/src/eth-utils";
import { AccountScreen } from "@/src/screens/AccountScreen/AccountScreen";
import { notFound, useSearchParams } from "next/navigation";

export default function Page() {
  const searchParams = useSearchParams();
  const accountAddress = searchParams.get("address") ?? searchParams.get("a");

  if (!isAddress(accountAddress)) {
    notFound();
  }

  return <AccountScreen address={accountAddress} />;
}
