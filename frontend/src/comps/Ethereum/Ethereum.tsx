"use client";

import type { ReactNode } from "react";
import type { Chain } from "wagmi/chains";

import { useConfig } from "@/src/comps/Config/Config";
import { WALLET_CONNECT_PROJECT_ID } from "@/src/env";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { useMemo } from "react";
import { match } from "ts-pattern";
import { createConfig, http, WagmiProvider } from "wagmi";
import { hardhat, mainnet } from "wagmi/chains";

const queryClient = new QueryClient();

export function Ethereum({ children }: { children: ReactNode }) {
  const { config } = useConfig();

  const wagmiConfig = useMemo(() => {
    const [chains, transports] = match(config.chainId)
      .returnType<[
        [Chain, ...Chain[]],
        Record<string, ReturnType<typeof http>>,
      ]>()
      // Hardhat
      .with(31337, () => [
        [hardhat],
        { [hardhat.id]: http("http://localhost:8545") },
      ])
      // Defaults to mainnet
      .otherwise(() => [
        [mainnet],
        { [mainnet.id]: http() },
      ]);

    return createConfig(
      getDefaultConfig({
        appName: "Liquity 2",
        chains,
        transports,
        ssr: true,
        walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,
      }),
    );
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
