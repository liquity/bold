import type { ReactNode } from "react";

import { useSubgraphIsDown } from "@/src/indicators/subgraph-indicator";

export function SubgraphDependent({
  children = null,
  fallback = null,
}: {
  children?: ReactNode;
  fallback?: ReactNode;
}) {
  const subgraphIsDown = useSubgraphIsDown();
  return subgraphIsDown ? fallback : <>{children}</>;
}
