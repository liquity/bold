import type { Dnum, Token } from "@/src/types";
import type { Address } from "@liquity2/uikit";

import { dnum18 } from "@/src/dnum-utils";
import { CONTRACT_BOLD_TOKEN, CONTRACT_LQTY_TOKEN, CONTRACT_LUSD_TOKEN } from "@/src/env";
import { getBranch } from "@/src/liquity-utils";
import { getSafeStatus } from "@/src/safe-utils";
import { isCollateralSymbol } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import { useModal as useConnectKitModal } from "connectkit";
import { match } from "ts-pattern";
import { erc20Abi } from "viem";
import { useAccount as useWagmiAccount, useBalance as useWagmiBalance, useEnsName, useReadContracts } from "wagmi";

export function useBalance(
  address: Address | undefined,
  token: Token["symbol"] | undefined,
) {
  const balances = useBalances(address, token ? [token] : []);

  return token && balances[token]
    ? balances[token]
    : { data: undefined, isLoading: false };
}

export function useBalances(
  address: Address | undefined,
  tokens: Token["symbol"][],
) {
  const tokenConfigs = tokens.map((token) => {
    const tokenAddress = match(token)
      .when(
        (symbol) => Boolean(symbol && isCollateralSymbol(symbol) && symbol !== "ETH"),
        (symbol) => {
          if (!symbol || !isCollateralSymbol(symbol) || symbol === "ETH") {
            return null;
          }
          return getBranch(symbol).contracts.CollToken.address;
        },
      )
      .with("LUSD", () => CONTRACT_LUSD_TOKEN)
      .with("BOLD", () => CONTRACT_BOLD_TOKEN)
      .with("LQTY", () => CONTRACT_LQTY_TOKEN)
      .otherwise(() => null);

    return {
      token,
      tokenAddress,
      isEth: token === "ETH",
    };
  });

  const ethTokens = tokenConfigs.filter((config) => config.isEth);
  const erc20Tokens = tokenConfigs.filter((config) => !config.isEth && config.tokenAddress);

  const erc20Balances = useReadContracts({
    contracts: erc20Tokens.map((config) => ({
      address: config.tokenAddress! as Address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? [address] : undefined,
    })),
    query: {
      enabled: Boolean(address && erc20Tokens.length > 0),
    },
  });

  const ethBalance = useWagmiBalance({
    address,
    query: {
      enabled: Boolean(address && ethTokens.length > 0),
    },
  });

  // combine results
  return tokens.reduce((result, token) => {
    if (token === "ETH") {
      result[token] = {
        data: ethBalance.data ? dnum18(ethBalance.data.value) : undefined,
        isLoading: ethBalance.isLoading,
      };
    } else {
      const erc20Index = erc20Tokens.findIndex((config) => config.token === token);
      if (erc20Index !== -1) {
        const balance = erc20Balances.data?.[erc20Index];
        result[token] = {
          data: balance?.result !== undefined ? dnum18(balance.result) : undefined,
          isLoading: erc20Balances.isLoading,
        };
      }
    }
    return result;
  }, {} as Record<
    Token["symbol"],
    { data: Dnum | undefined; isLoading: boolean }
  >);
}

export function useAccount():
  & Omit<ReturnType<typeof useWagmiAccount>, "connector">
  & {
    connect: () => void;
    ensName: string | undefined;
    safeStatus: Awaited<ReturnType<typeof getSafeStatus>> | null;
  }
{
  const account = useWagmiAccount();
  const ensName = useEnsName({ address: account?.address });

  const safeStatus = useQuery({
    queryKey: ["safeStatus", account.address],
    queryFn: async () => {
      if (!account.address) {
        throw new Error("No account address");
      }
      const status = await getSafeStatus(account.address);
      return status;
    },
    staleTime: Infinity,
    refetchInterval: false, // only needed once
    enabled: Boolean(account.address),
  });

  const connectKitModal = useConnectKitModal();

  return {
    ...account,
    connect: () => {
      connectKitModal.setOpen(true);
    },
    ensName: ensName.data ?? undefined,
    safeStatus: safeStatus.data ?? null,
  };
}
