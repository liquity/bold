"use client";

import type { ReactNode } from "react";

import { WALLET_CONNECT_PROJECT_ID } from "@/src/env";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { createConfig, http, WagmiProvider } from "wagmi";
import { localhost, mainnet } from "wagmi/chains";

const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: "Liquity 2",
    chains: [mainnet, localhost],
    transports: {
      [mainnet.id]: http(),
      [localhost.id]: http(),
    },
    ssr: true,
    walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,
  }),
);

const queryClient = new QueryClient();

export function Ethereum({ children }: { children: ReactNode }) {
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
