import type { QueryKey } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useBlockNumber } from "wagmi";
import { hashFn } from "wagmi/query";

export function useWatchQueries(
  queries: Array<{ queryKey: QueryKey }>,
  updateInterval: number = 1, // update every x blocks
) {
  const queryClient = useQueryClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const queriesDep = hashFn(queries.map(({ queryKey }) => queryKey));
  useEffect(() => {
    if (!blockNumber || (blockNumber % BigInt(updateInterval) !== 0n)) {
      return;
    }
    for (const { queryKey } of queries) {
      queryClient.invalidateQueries({ queryKey });
    }
  }, [blockNumber, queryClient, queriesDep, updateInterval]);
}
