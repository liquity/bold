import type { Address } from 'viem';

export interface LeaderboardEntry {
  address: Address;
  ensName: string | null;
  shellpoints: {
    total: number;
    mostRecent: {
      amount: number;
      blockNumber: number;
      // blockTimestamp: number;
    } | null;
  };
  rank: number;
  activities: string[];
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
  lastMintBlock: {
    blockNumber: number;
    blockTimestamp: number;
  };
}

export interface LeaderboardResponse {
  success: boolean;
  data: LeaderboardData;
  lastUpdated: string;
  error?: string;
}

export interface ShellpointAllocation {
  user: Address;
  value: number;
}

export type LeaderboardActivity = 
  | "yusnd" 
  | "balancer"
  | "bunni" 
  | "camelot" 
  | "spectra" 
  | "goSlowNft" 
  | "trove" 
  | "stabilityPool";