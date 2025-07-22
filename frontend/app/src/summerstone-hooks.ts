import type { Address, CollIndex } from "@/src/types";

import { DATA_REFRESH_INTERVAL } from "@/src/constants";
import { useQuery } from "@tanstack/react-query";
import {
  graphQuery,
  BatchManagersQuery,
} from "./summerstone-queries";

type Options = {
  refetchInterval?: number;
};

function prepareOptions(options?: Options) {
  return {
    refetchInterval: DATA_REFRESH_INTERVAL,
    ...options,
  };
}

export function useBatchManagers(
  delegateAddresses?: Address[],
  branchIds?: CollIndex[],
  options?: Options,
) {
  let queryFn = async () => {
    const { batchManagers } = await graphQuery(
      BatchManagersQuery,
      { collateralIn: branchIds?.map(String), batchManagerIn: delegateAddresses },
    );

    return batchManagers;
  };

  return useQuery({
    queryKey: ["BatchManagers", branchIds, delegateAddresses],
    queryFn,
    ...prepareOptions(options),
  });
}
