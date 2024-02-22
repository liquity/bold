import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { createConfig, WagmiProvider } from "wagmi";
import { localhost, mainnet } from "wagmi/chains";
import { WALLET_CONNECT_PROJECT_ID } from "../env";

const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [mainnet, localhost],
    walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,
    appName: "Bold",
  }),
);

const queryClient = new QueryClient();

export const Web3Provider = ({ children }: React.PropsWithChildren) => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
