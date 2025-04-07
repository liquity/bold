import type { Token } from "@/src/types";
import type { Address } from "@liquity2/uikit";

import { dnum18 } from "@/src/dnum-utils";
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
  const tokenAddress = match(token)
    .when(
      (symbol) => Boolean(symbol),
      (symbol) => {
        if (!symbol) {
          return null;
        }
        if(symbol === "bvUSD") {
          return "0xc6675024FD3A9D37EDF3fE421bbE8ec994D9c262";
        }
        if(symbol === "sbvUSD") {
          return "0xc6675024FD3A9D37EDF3fE421bbE8ec994D9c262";
        }
        if(symbol === "VCRAFT") {
          return "0xc6675024FD3A9D37EDF3fE421bbE8ec994D9c262";
        }
        return getBranch(symbol)?.contracts.CollToken.address ?? null;
      },
    )
    .otherwise(() => null);
  
  // TODO -- find a better solution to parse the balance based on the token decimals
  const tokenBalance = useReadContract({
    address: tokenAddress ?? undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address && [address],
    query: {
      select: (value) => dnum18(value ?? 0n),
      enabled: Boolean(address),
    },
  });

  // const ethBalance = useWagmiBalance({
  //   address,
  //   query: {
  //     select: ({ value }) => dnum18(value ?? 0n),
  //     enabled: Boolean(address && token === "ETH"),
  //   },
  // });

  return (tokenBalance);
}

export function useAccount():
  & Omit<ReturnType<typeof useWagmiAccount>, "connector">
  & {
    connect: () => void;
    ensName: string | undefined;
    safeStatus: Awaited<ReturnType<typeof getSafeStatus>> | null;
  } {
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

  return {
    ...account,
    connect: () => {
      connectKitModal.setOpen(true);
    },
    ensName: ensName.data ?? undefined,
    safeStatus: safeStatus.data ?? null,
  };
}
