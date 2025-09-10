import type { Address } from "@/src/types";

import { DATA_REFRESH_INTERVAL } from "@/src/constants";
import { useQuery } from "@tanstack/react-query";
import {
  graphQuery,
  BalancesByTokenQuery,
  BalancesForHoldersQuery,
} from "./shell-queries";
import { CONTRACT_SHELL_TOKEN } from "./env";

type Options = {
  refetchInterval?: number;
};

function prepareOptions(options?: Options) {
  return {
    refetchInterval: DATA_REFRESH_INTERVAL,
    ...options,
  };
}

export function useShellBalances(
  options?: Options,
) {
  return useBalancesByToken(CONTRACT_SHELL_TOKEN as Address, options);
}

export function useBalancesByToken(
  token?: Address,
  options?: Options,
) {
  let queryFn = async () => {
    const { balances } = await graphQuery(
      BalancesByTokenQuery,
      { token: token as string },
    );

    return balances;
  };

  return useQuery({
    queryKey: ["BalancesByToken", token],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useShellActivitiesOfHolders(
  holders?: Address[],
  options?: Options,
) {
  return useQuery({
    queryKey: ["ShellActivitiesOfHolders", holders],
    queryFn: async () => {
      const { balances } = await graphQuery(
        BalancesForHoldersQuery,
        { token: CONTRACT_SHELL_TOKEN as string, holders: holders?.map(String) ?? [] },
      );
      return balances;
    },
    enabled: Boolean(holders && holders.length > 0),
    ...prepareOptions(options),
  });
}