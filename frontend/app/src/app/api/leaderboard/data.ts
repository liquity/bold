import { queryShellpointsAndActivity } from "@/src/shellpoints/lib";
import { formatUnits, getAddress, isAddressEqual, type Address } from "viem";
import type { LeaderboardEntry, LeaderboardActivity, LeaderboardData } from "@/src/shellpoints/leaderboard";
import { ALCHEMY_API_KEY, GRAPH_TOKEN_API_TOKEN } from "@/src/shellpoints/utils/env";
import { getMainnetPublicClient } from "@/src/shellpoints/utils/client";
import { getEnsName } from "viem/ens";
// import { NULL_ADDRESS } from "@/src/shellpoints/utils/constants";

export function getLeaderboardActivityName(activity: LeaderboardActivity): string {
  switch (activity) {
    case "yusnd":
      return "yUSND";
    case "balancer":
      return "Balancer";
    case "bunni":
      return "Bunni";
    case "camelot":
      return "Camelot";
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
  
  const users = await queryShellpointsAndActivity();

  let lastMintBlock = 0n;
  const client = getMainnetPublicClient();

  const shellpoints: Omit<LeaderboardEntry, 'rank'>[] = await Promise.all(users.shellPoints.map(async (user) => {
    const ensName = (await getEnsName(client, { address: user.holder })) ?? null;
    return {
      address: user.holder,
      ensName,
      // ensName: null,
      shellpoints: {
        total: Number(formatUnits(user.balance!, 18)),
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

  return {
    entries: shellpoints
      .sort((a, b) => b.shellpoints.total - a.shellpoints.total)
      .map((entry, index) => ({
        ...entry,
        shellpoints: {
          total: Math.round(entry.shellpoints.total),
          mostRecent: entry.shellpoints.mostRecent,
        },
        rank: index + 1
      }))
      .filter((entry) => entry.shellpoints.total > 0),
    lastMintBlock: {
      blockNumber: Number(lastMintBlock),
      // blockTimestamp: Number((await client.getBlock({ blockNumber: lastMintBlock })).timestamp)
      blockTimestamp: 0,
    }
  }
}

function getLeaderboardActivities(users: Awaited<ReturnType<typeof queryShellpointsAndActivity>>, address: Address): LeaderboardActivity[] {
  const activities: LeaderboardActivity[] = [];
  
  if (users.activities.yusnd.some(user => isAddressEqual(user.address, address))) activities.push("yusnd");
  if (users.activities.balancer.some(user => isAddressEqual(user.address, address))) activities.push("balancer");
  if (users.activities.bunni.some(user => isAddressEqual(user.address, address))) activities.push("bunni");
  if (users.activities.camelot.some(user => isAddressEqual(user.address, address))) activities.push("camelot");
  if (users.activities.spectra.some(user => isAddressEqual(user.address, address))) activities.push("spectra");
  if (users.activities.goSlowNft.some(user => isAddressEqual(user.holder, address))) activities.push("goSlowNft");
  if (users.activities.troves.some(trove => isAddressEqual(getAddress(trove.borrower), address))) activities.push("trove");
  if (Object.keys(users.activities.stabilityPoolDeposits).some(depositor => isAddressEqual(getAddress(depositor), address))) activities.push("stabilityPool");
  
  if (activities.length === 0) activities.push("trove"); // Assume they have a trove not included in subgraph query limit if no other activity

  return activities;
}