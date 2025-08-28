import { getAllUsers } from "@/src/shellpoints/lib";
import { formatUnits, type Address } from "viem";
import type { LeaderboardEntry, LeaderboardActivity, LeaderboardData } from "@/src/shellpoints/leaderboard";
import { ALCHEMY_API_KEY, GRAPH_TOKEN_API_TOKEN } from "@/src/shellpoints/utils/env";
// import { getMainnetPublicClient } from "@/src/shellpoints/utils/client";
// import { getEnsName } from "viem/ens";
// import { NULL_ADDRESS } from "@/src/shellpoints/utils/constants";

export function getLeaderboardActivityName(activity: LeaderboardActivity): string {
  switch (activity) {
    case "yusnd":
      return "yUSND";
    case "camelot":
      return "Camelot";
    case "bunni":
      return "Bunni";
    case "spectra":
      return "Spectra";
    case "goSlowNft":
      return "GoSlow NFT";
    case "trove":
      return "Borrowing";
    case "stabilityPool":
      return "Stability Pool";
    default:
      throw new Error(`Unknown leaderboard activity: ${activity}`);
  }
}

export async function getLeaderboardData(): Promise<LeaderboardData> {
  const alchemyApiKey = ALCHEMY_API_KEY;
  if (!alchemyApiKey) {
    throw new Error("ALCHEMY_API_KEY is not set");
  }

  const graphTokenApiToken = GRAPH_TOKEN_API_TOKEN;
  if (!graphTokenApiToken) {
    throw new Error("GRAPH_TOKEN_API_TOKEN is not set");
  }
  
  console.log("Getting leaderboard data");
  const users = await getAllUsers();
  console.log("Retrieved users");
  // const client = getMainnetPublicClient();
  console.log("Retrieved client");

  let lastMintBlock = 0n;

  const shellpoints: Omit<LeaderboardEntry, 'rank'>[] = await Promise.all(users.shellPoints.map(async (user) => {
    return {
      address: user.holder,
      // ensName: await getEnsName(client, { address: user.holder }),
      ensName: null,
      shellpoints: {
        total: Number(formatUnits(user.balance, 18)),
        mostRecent: null,
      },
      activities: getLeaderboardActivities(users, user.holder).map(activity => getLeaderboardActivityName(activity)),
    }
    // return {
    //   address: user.address,
    //   // ensName: await getEnsName(client, { address: user.holder }),
    //   ensName: null,
    //   shellpoints: {
    //     total: Number(formatUnits(user.amount, user.decimals)),
    //     mostRecent: null,
    //   },
    //   activities: getLeaderboardActivities(users, user.address).map(activity => getLeaderboardActivityName(activity)),
    // }
  }));
  console.log("Retrieved shellpoints");

  return {
    entries: shellpoints
      .sort((a, b) => b.shellpoints.total - a.shellpoints.total)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      })),
    lastMintBlock: {
      blockNumber: Number(lastMintBlock),
      // blockTimestamp: Number((await client.getBlock({ blockNumber: lastMintBlock })).timestamp)
      blockTimestamp: 0,
    }
  }
}

function getLeaderboardActivities(users: Awaited<ReturnType<typeof getAllUsers>>, address: Address): LeaderboardActivity[] {
  const activities: LeaderboardActivity[] = [];
  
  if (users.yusnd.some(user => user.address === address)) activities.push("yusnd");
  if (users.camelot.some(user => user.address === address)) activities.push("camelot");
  if (users.bunni.some(user => user.address === address)) activities.push("bunni");
  if (users.spectra.some(user => user.address === address)) activities.push("spectra");
  if (users.goSlowNft.some(user => user.holder === address)) activities.push("goSlowNft");
  // if (users.troves.some(trove => trove.borrower === address)) activities.push("trove");
  // if (users.stabilityPoolDepositors.includes(address)) activities.push("stabilityPool");
  
  return activities;
}