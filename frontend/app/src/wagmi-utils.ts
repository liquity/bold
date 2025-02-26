import type { Token } from "@/src/types";
import type { Address } from "@liquity2/uikit";

import { ACCOUNT_BALANCES, useDemoMode } from "@/src/demo-mode";
import { dnum18 } from "@/src/dnum-utils";
import { CONTRACT_BOLD_TOKEN, CONTRACT_LQTY_TOKEN, CONTRACT_LUSD_TOKEN } from "@/src/env";
import { getBranch } from "@/src/liquity-utils";
import { getSafeStatus } from "@/src/safe-utils";
import { isCollateralSymbol } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import { useModal as useConnectKitModal } from "connectkit";
import { match } from "ts-pattern";
import { erc20Abi } from "viem";
import { useAccount as useWagmiAccount, useBalance as useWagmiBalance, useEnsName, useReadContract } from "wagmi";

export function useBalance(
  address: Address | undefined,
  token: Token["symbol"] | undefined,
) {
  const demoMode = useDemoMode();

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

  const tokenBalance = useReadContract({
    address: tokenAddress ?? undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address && [address],
    query: {
      select: (value) => dnum18(value ?? 0n),
      enabled: Boolean(!demoMode.enabled && address && token !== "ETH"),
    },
  });

  const ethBalance = useWagmiBalance({
    address,
    query: {
      select: ({ value }) => dnum18(value ?? 0n),
      enabled: Boolean(!demoMode.enabled && address && token === "ETH"),
    },
  });

  return demoMode.enabled && token
    ? { data: ACCOUNT_BALANCES[token], isLoading: false }
    : (token === "ETH" ? ethBalance : tokenBalance);
}

export function useAccount():
  & Omit<ReturnType<typeof useWagmiAccount>, "connector">
  & {
    connect: () => void;
    ensName: string | undefined;
    safeStatus: Awaited<ReturnType<typeof getSafeStatus>> | null;
  }
{
  const demoMode = useDemoMode();
  const account = useWagmiAccount();
  const connectKitModal = useConnectKitModal();
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

  if (demoMode.enabled) {
    return demoMode.account;
  }

  return {
    ...account,
    connect: () => {
      connectKitModal.setOpen(true);
    },
    ensName: ensName.data ?? undefined,
    safeStatus: safeStatus.data ?? null,
  };
}
