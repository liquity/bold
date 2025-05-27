import type { Provider } from "@ethersproject/abstract-provider";
import { Networkish, getNetwork } from "@ethersproject/networks";
import { Batched } from "@liquity/providers";

import { AlchemyProvider } from "./AlchemyProvider";

const BatchedAlchemyProvider = Batched(AlchemyProvider);

export interface LiquityConnectionOptions {
  alchemyApiKey?: string;
}

export const getProvider = (
  networkish: Networkish,
  options?: LiquityConnectionOptions
): Provider => {
  const network = getNetwork(networkish);
  const provider = new BatchedAlchemyProvider(network, options?.alchemyApiKey);

  provider.chainId = network.chainId;

  return provider;
};
