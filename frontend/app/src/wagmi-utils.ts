import type { Token } from "@/src/types";
import type { Address } from "@liquity2/uikit";

import { dnum18, dnum8 } from "@/src/dnum-utils";
import { getBranch } from "@/src/liquity-utils";
import { getSafeStatus } from "@/src/safe-utils";
import { useQuery } from "@tanstack/react-query";
import { useModal as useConnectKitModal } from "connectkit";
import { match } from "ts-pattern";
import { erc20Abi } from "viem";
import { useAccount as useWagmiAccount, useEnsName, useReadContract } from "wagmi";

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
          return "0x242a2f669224b225d38514c1785411a6036981f1";
        }
        if(symbol === "sbvUSD") {
          return "0x0471D185cc7Be61E154277cAB2396cD397663da6";
        }
        if(symbol === "VCRAFT") {
          return "0xc6675024FD3A9D37EDF3fE421bbE8ec994D9c262";
        }
        if(symbol === "WBTC") {
          return "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c";
        }
        if(symbol === "USDT") {
          return "0x55d398326f99059fF775485246999027B3197955";
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
      select: (value) => tokenAddress === "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c" ? dnum8(value ?? 0n) : dnum18(value ?? 0n),
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

  return tokenBalance;
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
