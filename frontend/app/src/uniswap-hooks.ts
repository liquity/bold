import type { Address } from "@/src/types";

import { useQuery } from "@tanstack/react-query";
import { graphQuery } from "./uniswap-queries";
import { PositionsByOwnersQuery } from "./uniswap-queries";

export interface PoolKey {
  currency0: Address
  currency1: Address
  fee: bigint
  tickSpacing: bigint
  hooks: Address
}

export function useUniswapPositionsByOwners(
  owners?: Address[]
) {
  return useQuery({
    queryKey: ["UniswapPositionsByOwners", owners],
    queryFn: async () => {
      const positions = await getUniswapPositionsByOwners(owners ?? []);
      return positions;
    },
    enabled: Boolean(owners && owners.length > 0)
  });
}

export async function getUniswapPositionsByOwners(owners: Address[]) {
  const { positions } = await graphQuery(
    PositionsByOwnersQuery,
    { owners },
  );
  return positions;
}