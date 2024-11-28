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
  CHAIN_CURRENCY,
  CHAIN_ID,
  CHAIN_NAME,
  CHAIN_RPC_URL,
  CONTRACT_BOLD_TOKEN,
  CONTRACT_LUSD_TOKEN,
  WALLET_CONNECT_PROJECT_ID,
} from "@/src/env";
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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const queryClient = new QueryClient();

export function ArbitrumProvider({ children }: { children: ReactNode }) {
  const wagmiConfig = useWagmiConfig();
  const rainbowKitProps = useRainbowKitProps();
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider {...rainbowKitProps}>{children}</RainbowKitProvider>
      </QueryClientProvider>
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
} {
  const demoMode = useDemoMode();
  const account = useAccountWagmi();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const ensName = useEnsName({ address: account?.address });
  return demoMode.enabled
    ? demoMode.account
    : {
        ...account,
        connect: openConnectModal || noop,
        disconnect: (account.isConnected && openAccountModal) || noop,
        ensName: ensName.data ?? undefined,
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
    .with("USDN", () => CONTRACT_BOLD_TOKEN)
    .with("LUSD", () => CONTRACT_LUSD_TOKEN)
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
    const chain = createChain({
      id: CHAIN_ID,
      name: CHAIN_NAME,
      currency: CHAIN_CURRENCY,
      rpcUrl: CHAIN_RPC_URL,
      blockExplorer: CHAIN_BLOCK_EXPLORER,
      contractEnsRegistry: CHAIN_CONTRACT_ENS_REGISTRY,
      contractEnsResolver: CHAIN_CONTRACT_ENS_RESOLVER,
      contractMulticall: { address: CHAIN_CONTRACT_MULTICALL },
    });
    return getDefaultConfig({
      appName: "Nerite",
      projectId: WALLET_CONNECT_PROJECT_ID,
      chains: [chain],
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
        [chain.id]: http(CHAIN_RPC_URL),
      },
      ssr: true,
    });
  }, [
    CHAIN_BLOCK_EXPLORER,
    CHAIN_CONTRACT_ENS_REGISTRY,
    CHAIN_CONTRACT_ENS_RESOLVER,
    CHAIN_CONTRACT_MULTICALL,
    CHAIN_CURRENCY,
    CHAIN_ID,
    CHAIN_NAME,
    CHAIN_RPC_URL,
    WALLET_CONNECT_PROJECT_ID,
  ]);
}

function createChain({
  id,
  name,
  currency,
  rpcUrl,
  blockExplorer,
  contractEnsRegistry,
  contractEnsResolver,
  contractMulticall,
}: {
  id: number;
  name: string;
  currency: { name: string; symbol: string; decimals: number };
  rpcUrl: string;
  blockExplorer?: { name: string; url: string };
  contractEnsRegistry?: { address: Address; block?: number };
  contractEnsResolver?: { address: Address; block?: number };
  contractMulticall?: { address: Address; block?: number };
}): Chain {
  return {
    id,
    name,
    nativeCurrency: currency,
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
    blockExplorers: blockExplorer && {
      default: blockExplorer,
    },
    contracts: {
      ensRegistry: contractEnsRegistry,
      ensUniversalResolver: contractEnsResolver,
      multicall3: contractMulticall,
    },
  } satisfies Chain;
}
