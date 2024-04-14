"use client";

import type { Address } from "@/src/types";
import type { ReactNode } from "react";
import type { Chain } from "wagmi/chains";

import { useConfig } from "@/src/comps/Config/Config";
import { WALLET_CONNECT_PROJECT_ID } from "@/src/env";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { useMemo } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";

const queryClient = new QueryClient();

export function Ethereum({ children }: { children: ReactNode }) {
  const { config } = useConfig();

  const wagmiConfig = useMemo(() => {
    const chain = createChain({
      id: config.chainId,
      name: config.chainName,
      currency: config.chainCurrency,
      rpcUrl: config.chainRpcUrl,
      blockExplorer: config.chainBlockExplorer,
      contractEnsRegistry: config.chainContractEnsRegistry,
      contractEnsResolver: config.chainContractEnsResolver,
      contractMulticall: config.chainContractMulticall,
    });

    const configParams = getDefaultConfig({
      appName: "Liquity v2",
      chains: [chain],
      transports: {
        [config.chainId]: http(config.chainRpcUrl),
      },
      ssr: true,
      walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,
    });

    return createConfig(configParams);
  }, [config]);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
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
