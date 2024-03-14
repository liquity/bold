"use client";

import type { ReactNode } from "react";

import { CHAIN_ID, WALLET_CONNECT_PROJECT_ID } from "@/src/env";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { match } from "ts-pattern";
import { createConfig, http, WagmiProvider } from "wagmi";
import { hardhat, mainnet } from "wagmi/chains";

const [chains, transports] = match(CHAIN_ID)
  // Hardhat
  .with(31337, () => ([
    [hardhat],
    { [hardhat.id]: http("http://localhost:8545") },
  ] as const))
  // Default to mainnet
  .otherwise(() => ([
    [mainnet],
    { [mainnet.id]: http() },
  ] as const));

const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: "Liquity 2",
    chains,
    transports,
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
