import { WagmiProvider, createConfig } from "wagmi";
import { mainnet, localhost } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";

const config = createConfig(
  getDefaultConfig({
    // Your dApps chains
    chains: [mainnet, localhost],

    // transports: {
    //   // RPC URL for each chain
    //   [mainnet.id]: http(),
    // },

    // Required API Keys
    walletConnectProjectId: "1cf43efe77211715ff592034643e76c7", // TODO make this configurable

    appName: "Bold",
    // appDescription: "",
    // appUrl: "",
    // appIcon: "",
  })
);

const queryClient = new QueryClient();

export const Web3Provider = ({ children }: React.PropsWithChildren) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
