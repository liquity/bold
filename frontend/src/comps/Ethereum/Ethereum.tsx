"use client";

import type { Address } from "@/src/types";
import type { ReactNode } from "react";
import type { Chain } from "wagmi/chains";

import { useConfig } from "@/src/comps/Config/Config";
import { WALLET_CONNECT_PROJECT_ID } from "@/src/env";
import { css } from "@/styled-system/css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { useMemo } from "react";
import { createConfig, http, useChainId, useSwitchChain, WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";

const queryClient = new QueryClient();

export function Ethereum({ children }: { children: ReactNode }) {
  const wagmiConfig = useWagmiConfig();

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <EnforceChain>
            {children}
          </EnforceChain>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function EnforceChain({ children }: { children: ReactNode }) {
  const currentChainId = useChainId();
  const { chains: [chain], switchChain } = useSwitchChain();

  if (!currentChainId || chain.id === currentChainId) {
    return children;
  }

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        height: "100vh",
      })}
    >
      <p>
        Please switch to the {chain.name} network.
      </p>
      <button
        onClick={() => {
          switchChain({ chainId: chain.id });
        }}
        className={css({
          height: 40,
          padding: "8px 16px",
          color: "white",
          fontSize: 14,
          background: "blue",
          borderRadius: 20,
          cursor: "pointer",
          whiteSpace: "nowrap",
          _disabled: {
            background: "rain",
            cursor: "not-allowed",
          },
          _active: {
            _enabled: {
              translate: "0 1px",
            },
          },
        })}
      >
        Switch to {chain.name}
      </button>
    </div>
  );
}

function useWagmiConfig() {
  const { config } = useConfig();

  return useMemo(() => {
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
      chains: [chain, mainnet],
      transports: {
        [mainnet.id]: http(mainnet.rpcUrls.default.http[0]),
        [chain.id]: http(config.chainRpcUrl),
      },
      ssr: true,
      walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,
    });

    return createConfig(configParams);
  }, [config]);
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
