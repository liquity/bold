import { DATA_REFRESH_INTERVAL } from "@/src/constants";
import { useLiquityStats } from "@/src/liquity-utils";
import { useTroveCount } from "@/src/subgraph-hooks";
import { DEMO_MODE, CHAIN_ID } from "@/src/env";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { getAddress } from "viem";
import * as v from "valibot";

// Constants
const ARBITRUM_CHAIN_ID = 42161;
const GO_SLOW_NFT_CONTRACT_ADDRESS = "0x6da3c02293c96dfa5747b1739ebb492619222a8a";

// DefiLlama API schema for TVL data
const DefiLlamaSchema = v.object({
  tvl: v.number(),
  tokensInUsd: v.optional(v.record(v.string(), v.number())),
});

// Stability Pool APR calculation
export function useStabilityPoolAPR() {
  const stats = useLiquityStats();
  
  if (!stats.data?.branch) {
    return {
      data: null,
      isLoading: stats.isLoading,
      error: stats.error,
    };
  }

  let totalTvl = 0;
  let weightedAprSum = 0;

  for (const branch of Object.values(stats.data.branch)) {
    const aprValue = branch.spApyAvg7d?.[0];
    const branchTvl = Number(branch.valueLocked || 0);
    
    if (typeof aprValue === 'bigint') {
      weightedAprSum += Number(aprValue) * branchTvl;
      totalTvl += branchTvl;
    } else if (aprValue) {
      weightedAprSum += aprValue * branchTvl;
      totalTvl += branchTvl;
    }
  }

  const avgAPR = totalTvl > 0 ? weightedAprSum / totalTvl : null;

  return {
    data: avgAPR,
    isLoading: stats.isLoading,
    error: stats.error,
  };
}

// DefiLlama TVL data
export function useDefiLlamaTVL() {
  return useQuery({
    queryKey: ["defillama-tvl"],
    queryFn: async () => {
      const response = await fetch("https://api.llama.fi/protocol/nerite");
      if (!response.ok) {
        throw new Error("Failed to fetch DefiLlama TVL data");
      }
      const data = await response.json();
      return v.parse(DefiLlamaSchema, data);
    },
    refetchInterval: DATA_REFRESH_INTERVAL,
    enabled: true,
  });
}

// Number of vaults (total count of active troves from subgraph)
export function useVaultCount() {
  const troveCount = useTroveCount();

  return {
    data: troveCount.data,
    isLoading: troveCount.isLoading,
    error: troveCount.error,
  };
}

// Go Slow NFT minted count (ERC-1155 on Arbitrum)
export function useGoSlowNFTCount() {
  // Check if calling Arbitrum contract from different chain
  const isChainMismatch = CHAIN_ID !== ARBITRUM_CHAIN_ID;
  
  const contractAddress = getAddress(GO_SLOW_NFT_CONTRACT_ADDRESS);
  
  const result = useReadContract({
    address: contractAddress,
    abi: [
      {
        inputs: [],
        name: "numMinted",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      }
    ] as const,
    functionName: "numMinted",
    chainId: ARBITRUM_CHAIN_ID,
    query: {
      refetchInterval: DATA_REFRESH_INTERVAL,
      enabled: !isChainMismatch, // Try to get real data even in demo mode
      retry: 1,
    },
  });

  // Handle chain mismatch - but still try to get real data in demo mode
  if (isChainMismatch) {
    // In demo mode, show a demo value when we can't access the real chain
    if (DEMO_MODE) {
      return {
        data: 1337, // Demo NFT count when chain mismatch prevents real data
        isLoading: false,
        error: null,
      };
    }
    
    return {
      data: null,
      isLoading: false,
      error: new Error(`Go Slow NFT is on Arbitrum (${ARBITRUM_CHAIN_ID}) but app is configured for chain ${CHAIN_ID}`),
    };
  }

  return {
    data: result.data ? Number(result.data) : null,
    isLoading: result.isLoading,
    error: result.error,
  };
}

// Combined hook for all landing page statistics
export function useLandingPageStats() {
  const stabilityPoolAPR = useStabilityPoolAPR();
  const defiLlamaTVL = useDefiLlamaTVL();
  const vaultCount = useVaultCount();
  const goSlowNFTCount = useGoSlowNFTCount();

  // In demo mode, ignore certain errors since we use mock data
  const relevantError = DEMO_MODE 
    ? null // Ignore all errors in demo mode since we have fallback data
    : (stabilityPoolAPR.error || defiLlamaTVL.error || vaultCount.error || goSlowNFTCount.error);

  return {
    stabilityPoolAPR: stabilityPoolAPR.data,
    tvl: defiLlamaTVL.data?.tvl,
    vaultCount: vaultCount.data,
    goSlowNFTCount: goSlowNFTCount.data,
    isLoading: stabilityPoolAPR.isLoading || defiLlamaTVL.isLoading || vaultCount.isLoading || goSlowNFTCount.isLoading,
    error: relevantError,
  };
}
