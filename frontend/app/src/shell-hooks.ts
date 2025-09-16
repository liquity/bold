import type { Address } from "@/src/types";

import { DATA_REFRESH_INTERVAL } from "@/src/constants";
import { useQuery } from "@tanstack/react-query";
import {
  graphQuery,
  BalancesByTokenQuery,
  BalancesForHoldersQuery,
} from "./shell-queries";
import { CONTRACT_SHELL_TOKEN } from "./env";
import { getUniswapPositionsByOwners, PoolKey } from "./uniswap-hooks";
import { readContracts } from "@wagmi/core";
import { useWagmiConfig } from "@/src/services/Arbitrum";
import { CONTRACT_ADDRESSES } from "./contracts";
import { UniswapV4PositionManager } from "./abi/UniswapV4PositionManager";
import { Abi } from "abitype";
import { isAddressEqual, zeroAddress } from "viem";

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
  const config = useWagmiConfig();

  return useQuery({
    queryKey: ["ShellActivitiesOfHolders", holders],
    queryFn: async () => {
      const { balances } = await graphQuery(
        BalancesForHoldersQuery,
        { token: CONTRACT_SHELL_TOKEN as string, holders: holders?.map(String) ?? [] },
      );

      const positions = await getUniswapPositionsByOwners(holders ?? []);
      console.log("positions", positions);

      const existingOwners = new Set<string>();
      const uniswapV4Positions = positions ? (await readContracts(config, {
        allowFailure: false,
        contracts: positions.map((position) => ({
          address: CONTRACT_ADDRESSES.strategies.UniswapV4 as Address,
          abi: UniswapV4PositionManager as Abi,
          functionName: "getPoolAndPositionInfo",
          args: [position.tokenId],
        })),
      }) as [PoolKey, bigint][])
        .map(([poolKey], i) => ({
          poolKey,
          ...positions[i]
        }))
        .filter(
          ({ poolKey, owner }) => {
            const valid = (isAddressEqual(poolKey.currency0, CONTRACT_ADDRESSES.BoldToken) || isAddressEqual(poolKey.currency1, CONTRACT_ADDRESSES.BoldToken))
              && owner !== zeroAddress
            if (valid && owner && !existingOwners.has(owner.toLowerCase())) {
              existingOwners.add(owner.toLowerCase());
              return true;
            }
            return false;
          }
        ) : []

      return balances.concat(uniswapV4Positions.map(({ owner, tokenId }) => ({
        __typename: "Balance",
        holder: owner!,
        token: CONTRACT_ADDRESSES.strategies.UniswapV4,
        balance: tokenId!,
      })));
    },
    enabled: Boolean(holders && holders.length > 0),
    ...prepareOptions(options),
  });
}