import { EARN_POOLS } from "@/src/types";

export function generateStaticParams() {
  return EARN_POOLS.map((pool) => ({ pool }));
}

export default function EarnPoolPage() {
  return null;
}
