"use client";

import type { ReactNode } from "react";

import content from "@/src/content";
import {
  CHAIN_BLOCK_EXPLORER,
  CHAIN_CONTRACT_ENS_REGISTRY,
  CHAIN_CONTRACT_ENS_RESOLVER,
  CHAIN_CONTRACT_MULTICALL,
  CHAIN_CURRENCY,
  CHAIN_ID,
  CHAIN_NAME,
  CHAIN_RPC_URL,
  WALLET_CONNECT_PROJECT_ID,
} from "@/src/env";
import { isAddress, shortenAddress } from "@liquity2/uikit";
import { WagmiAdapter as ReownWagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { AdapterBlueprint } from "@reown/appkit/adapters";
import { createAppKit as createReownAppKit } from "@reown/appkit/react";
import { blo } from "blo";
import { cookieStorage, createStorage, WagmiProvider } from "wagmi";
import { getEnsName } from "wagmi/actions";

const network = {
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: CHAIN_CURRENCY,
  rpcUrls: {
    default: { http: [CHAIN_RPC_URL] },
  },
  blockExplorers: CHAIN_BLOCK_EXPLORER && {
    default: CHAIN_BLOCK_EXPLORER,
  },
  contracts: {
    ensRegistry: CHAIN_CONTRACT_ENS_REGISTRY ?? undefined,
    ensUniversalResolver: CHAIN_CONTRACT_ENS_RESOLVER ?? undefined,
    multicall3: { address: CHAIN_CONTRACT_MULTICALL },
  },
};

class ReownWagmiAdapterWithBlockies extends ReownWagmiAdapter {
  public async getProfile(
    { address }: AdapterBlueprint.GetProfileParams,
  ): Promise<AdapterBlueprint.GetProfileResult> {
    if (!isAddress(address)) {
      throw new Error("Invalid address");
    }
    const profileImage = blo(address);
    try {
      const ensName = await getEnsName(this.wagmiConfig, { address });
      if (!ensName) {
        throw new Error("No ENS name");
      }
      return { profileImage, profileName: ensName };
    } catch (_) {
      return { profileImage, profileName: shortenAddress(address, 4) };
    }
  }
}

export const reownWagmiAdapter = new ReownWagmiAdapterWithBlockies({
  networks: [network],
  projectId: WALLET_CONNECT_PROJECT_ID,
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

export const reownModal = createReownAppKit({
  adapters: [reownWagmiAdapter],
  projectId: WALLET_CONNECT_PROJECT_ID,
  networks: [network],
  defaultNetwork: network,
  metadata: {
    name: content.appName,
    description: content.appDescription,
    url: content.appUrl,
    icons: [content.appIcon],
  },
  themeMode: "light",
  features: {
    analytics: false,
    swaps: false,
    send: false,
    onramp: false,
    history: false,
    email: false,
    socials: false,
  },
});

export function Ethereum({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WagmiProvider config={reownWagmiAdapter.wagmiConfig}>
      {children}
    </WagmiProvider>
  );
}
