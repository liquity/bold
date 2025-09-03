import { type Address } from "viem";
import type { LeaderboardData, LeaderboardEntry } from "@/src/shellpoints/leaderboard";
// import { getPublicClient } from "@/src/shellpoints/utils/client";
// import { ORIGIN_BLOCK } from "@/src/shellpoints/utils/constants";

// Mock calculation function - replace with actual backend integration
export async function getMockLeaderboardData(): Promise<LeaderboardData> {
  // const client = getPublicClient();

  // const originBlock = await client.getBlock({ blockNumber: ORIGIN_BLOCK });
  // const originTimestamp = Number(originBlock.timestamp);

  // function getRandomTimestamp(min: number, max: number) {
  //   return Math.floor(Math.random() * (max - min + 1)) + min;
  // }

  // This would normally call your backend services to get real data
  const mockData: Omit<LeaderboardEntry, 'rank'>[] = [
    {
      address: '0x1234567890123456789012345678901234567890' as Address,
      ensName: "mockuser.eth",
      shellpoints: {
        total: 15420,
        mostRecent: {
          amount: 15420,
          blockNumber: 17332323,
          // blockTimestamp: Date.now() / 1000
        }
      },
      activities: ['Borrowing', 'Stability Pool', 'YUSND Holding']
    },
    {
      address: '0x2345678901234567890123456789012345678901' as Address,
      ensName: "mockuser2.eth",
      shellpoints: {
        total: 12350,
        mostRecent: {
          amount: 12350,
          blockNumber: 17332323,
          // blockTimestamp: Date.now() / 1000
        }
      },
      activities: ['GoSlow NFT', 'Camelot LP', 'Bunni LP']
    },
    {
      address: '0x3456789012345678901234567890123456789012' as Address,
      ensName: null,
      shellpoints: {
        total: 10100,
        mostRecent: {
          amount: 10100,
          blockNumber: 17332323,
          // blockTimestamp: getRandomTimestamp(originTimestamp, Date.now())
        }
      },
      activities: ['Stability Pool', 'Spectra Supply']
    },
    {
      address: '0x4567890123456789012345678901234567890123' as Address,
      ensName: null,
      shellpoints: {
        total: 8750,
        mostRecent: {
          amount: 8750,
          blockNumber: 17332323,
          // blockTimestamp: getRandomTimestamp(originTimestamp, Date.now() / 1000)
        }
      },
      activities: ['Borrowing', 'YUSND Holding']
    },
    {
      address: '0x5678901234567890123456789012345678901234' as Address,
      ensName: null,
      shellpoints: {
        total: 7200,
        mostRecent: {
          amount: 7200,
          blockNumber: 17332323,
          // blockTimestamp: getRandomTimestamp(originTimestamp, Date.now() / 1000)
        }
      },
      activities: ['Camelot LP', 'Stability Pool']
    },
    {
      address: '0x6789012345678901234567890123456789012345' as Address,
      ensName: null,
      shellpoints: {
        total: 6850,
        mostRecent: {
          amount: 6850,
          blockNumber: 17332323,
          // blockTimestamp: getRandomTimestamp(originTimestamp, Date.now() / 1000)
        }
      },
      activities: ['GoSlow NFT', 'Borrowing']
    },
    {
      address: '0x7890123456789012345678901234567890123456' as Address,
      ensName: null,
      shellpoints: {
        total: 5500,
        mostRecent: {
          amount: 5500,
          blockNumber: 17332320,
          // blockTimestamp: getRandomTimestamp(originTimestamp, Date.now() / 1000)
        }
      },
      activities: ['Bunni LP', 'YUSND Holding']
    },
    {
      address: '0x8901234567890123456789012345678901234567' as Address,
      ensName: null,
      shellpoints: {
        total: 4200,
        mostRecent: {
          amount: 4200,
          blockNumber: 17332323,
          // blockTimestamp: getRandomTimestamp(originTimestamp, Date.now() / 1000)
        }
      },
      activities: ['Stability Pool']
    },
    {
      address: '0x9012345678901234567890123456789012345678' as Address,
      ensName: null,
      shellpoints: {
        total: 3800,
        mostRecent: {
          amount: 3800,
          blockNumber: 17332323,
          // blockTimestamp: getRandomTimestamp(originTimestamp, Date.now() / 1000)
        }
      },
      activities: ['Spectra Supply', 'Borrowing']
    },
    {
      address: '0xa123456789012345678901234567890123456789' as Address,
      ensName: null,
      shellpoints: {
        total: 2500,
        mostRecent: {
          amount: 2500,
          blockNumber: 17332320,
          // blockTimestamp: getRandomTimestamp(originTimestamp, Date.now() / 1000)
        }
      },
      activities: ['YUSND Holding']
    }
  ];

  // Sort by shellpoints descending and add ranks
  return {
    entries: mockData
      .sort((a, b) => b.shellpoints.total - a.shellpoints.total)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      })),
    lastMintBlock: {
      blockNumber: 17332323,
      blockTimestamp: Date.now() / 1000
    }
  }
}