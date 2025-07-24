"use client";

import "@rainbow-me/rainbowkit/styles.css";

import type { Token } from "@/src/types";
import type { Address } from "@liquity2/uikit";
import type { ComponentProps, ReactNode } from "react";
import type { Chain } from "wagmi/chains";

import { getContracts } from "@/src/contracts";
import { ACCOUNT_BALANCES } from "@/src/demo-mode";
import { useDemoMode } from "@/src/demo-mode";
import { dnum18 } from "@/src/dnum-utils";
import {
  CHAIN_BLOCK_EXPLORER,
  CHAIN_CONTRACT_ENS_REGISTRY,
  CHAIN_CONTRACT_ENS_RESOLVER,
  CHAIN_CONTRACT_MULTICALL,
  CHAIN_RPC_URL,
  CONTRACT_BOLD_TOKEN,
  CONTRACT_LQTY_TOKEN,
  CONTRACT_LUSD_TOKEN,
  WALLET_CONNECT_PROJECT_ID,
} from "@/src/env";
import { getSafeStatus } from "@/src/safe-utils";
import { noop } from "@/src/utils";
import { isCollateralSymbol, useTheme } from "@liquity2/uikit";
import {
  getDefaultConfig,
  lightTheme,
  RainbowKitProvider,
  useAccountModal,
  useConnectModal,
} from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { match } from "ts-pattern";
import { erc20Abi } from "viem";
import {
  http,
  useAccount as useAccountWagmi,
  useBalance as useBalanceWagmi,
  useEnsName,
  useReadContract,
  WagmiProvider,
} from "wagmi";

const arbitrumChain: Chain = {
  id: 42161,
  name: "Arbitrum One",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [CHAIN_RPC_URL] },
  },
  blockExplorers: CHAIN_BLOCK_EXPLORER && {
    default: CHAIN_BLOCK_EXPLORER,
  },
  contracts: {
    ensRegistry: CHAIN_CONTRACT_ENS_REGISTRY
      ? {
          address: CHAIN_CONTRACT_ENS_REGISTRY as unknown as Address,
        }
      : undefined,
    ensUniversalResolver: CHAIN_CONTRACT_ENS_RESOLVER
      ? {
          address: CHAIN_CONTRACT_ENS_RESOLVER as unknown as Address,
        }
      : undefined,
    multicall3: {
      address: CHAIN_CONTRACT_MULTICALL as Address,
    },
  },
};

export const CHAIN = arbitrumChain;

export function Arbitrum({ children }: { children: ReactNode }) {
  const wagmiConfig = useWagmiConfig();
  const rainbowKitProps = useRainbowKitProps();
  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider {...rainbowKitProps}>{children}</RainbowKitProvider>
    </WagmiProvider>
  );
}

export function useAccount(): Omit<
  ReturnType<typeof useAccountWagmi>,
  "connector"
> & {
  connect: () => void;
  disconnect: () => void;
  ensName: string | undefined;
  safeStatus: Awaited<ReturnType<typeof getSafeStatus>> | null;
} {
  const demoMode = useDemoMode();
  const account = useAccountWagmi();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const ensName = useEnsName({ address: account?.address });

  const safeStatus = useQuery({
    queryKey: ["safeStatus", account.address],
    enabled: Boolean(account.address),
    queryFn: () => {
      if (!account.address) {
        throw new Error("No account address");
      }
      return getSafeStatus(account.address);
    },
    staleTime: Infinity,
    refetchInterval: false,
  });

  if (demoMode.enabled) {
    return demoMode.account;
  }

  return {
    ...account,
    connect: openConnectModal || noop,
    disconnect: (account.isConnected && openAccountModal) || noop,
    ensName: ensName.data ?? undefined,
    safeStatus: safeStatus.data ?? null,
  };
}

export function useBalance(
  address: Address | undefined,
  token: Token["symbol"] | undefined
) {
  const demoMode = useDemoMode();
  const contracts = getContracts();

  const tokenAddress = match(token)
    .when(
      (symbol) =>
        Boolean(symbol && isCollateralSymbol(symbol) && symbol !== "ETH"),
      (symbol) => {
        if (!symbol || !isCollateralSymbol(symbol) || symbol === "ETH") {
          return null;
        }
        const collateral = contracts.collaterals.find(
          (c) => c.symbol === symbol
        );
        return collateral?.contracts.CollToken.address ?? null;
      }
    )
    .with("LUSD", () => CONTRACT_LUSD_TOKEN)
    .with("USND", () => CONTRACT_BOLD_TOKEN)
    .with("LQTY", () => CONTRACT_LQTY_TOKEN)
    .with("NERI", () => CONTRACT_LQTY_TOKEN)
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

  const ethBalance = useBalanceWagmi({
    address,
    query: {
      select: ({ value }) => dnum18(value ?? 0n),
      enabled: Boolean(!demoMode.enabled && address && token === "ETH"),
    },
  });

  return demoMode.enabled && token
    ? { data: ACCOUNT_BALANCES[token], isLoading: false }
    : token === "ETH"
    ? ethBalance
    : tokenBalance;
}

function useRainbowKitProps(): Omit<
  ComponentProps<typeof RainbowKitProvider>,
  "children"
> {
  const theme = useTheme();
  return {
    modalSize: "compact",
    theme: lightTheme({
      accentColor: theme.color("accent"),
    }),
  };
}

export function useWagmiConfig() {
  return useMemo(() => {
    return getDefaultConfig({
      appName: "Nerite",
      projectId: WALLET_CONNECT_PROJECT_ID,
      chains: [arbitrumChain],
      wallets: [
        {
          groupName: "Suggested",
          wallets: [
            injectedWallet,
            rabbyWallet,
            metaMaskWallet,
            coinbaseWallet,
            safeWallet,
            walletConnectWallet,
          ],
        },
      ],
      transports: {
        [arbitrumChain.id]: http(CHAIN_RPC_URL),
      },
      ssr: true,
    });
  }, []);
}
