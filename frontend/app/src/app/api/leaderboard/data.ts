import { getAllUsers } from "@/src/shellpoints/lib";
import { formatUnits, type Address } from "viem";
import type { LeaderboardEntry, LeaderboardActivity, LeaderboardData } from "@/src/shellpoints/leaderboard";
// import { getMainnetPublicClient } from "@/src/shellpoints/utils/client";
// import { getEnsName } from "viem/ens";
import { NULL_ADDRESS } from "@/src/shellpoints/utils/constants";

export function getLeaderboardActivityName(activity: LeaderboardActivity): string {
  switch (activity) {
    case "shellpoints":
      return "Shellpoints";
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
  console.log("Getting leaderboard data");
  const users = await getAllUsers();
  console.log("Retrieved users");
  // const client = getMainnetPublicClient();
  console.log("Retrieved client");

  let lastMintBlock = 0n;

  const shellpoints: Omit<LeaderboardEntry, 'rank'>[] = await Promise.all(users.shellPoints.map(async (user) => {
    const lastMint = user.receivedOn.length > 0 ? user.receivedOn.reduce((max, current) => current.blockNumber > max.blockNumber && current.from === NULL_ADDRESS ? current : max) : null;
    const mostRecent = user.receivedOn.length > 0 ? user.receivedOn.reduce((max, current) => current.blockNumber > max.blockNumber ? current : max) : null;
    if (lastMint && lastMint.blockNumber > lastMintBlock) {
      lastMintBlock = lastMint.blockNumber;
    }
    return {
      address: user.holder,
      // ensName: await getEnsName(client, { address: user.holder }),
      ensName: null,
      shellpoints: {
        total: Number(formatUnits(user.balance, 18)),
        mostRecent: mostRecent ? {
          amount: Number(formatUnits(mostRecent.amount, 18)),
          blockNumber: Number(mostRecent.blockNumber),
          // blockTimestamp: Number((await client.getBlock({ blockNumber: mostRecent.blockNumber })).timestamp)
        } : null,
      },
      activities: getLeaderboardActivities(users, user.holder).map(activity => getLeaderboardActivityName(activity)),
    }
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
  
  if (users.shellPoints.some(user => user.holder === address)) activities.push("shellpoints");
  if (users.yusnd.some(user => user.holder === address)) activities.push("yusnd");
  if (users.camelot.some(user => user.holder === address)) activities.push("camelot");
  if (users.bunni.some(user => user.holder === address)) activities.push("bunni");
  if (users.spectra.some(user => user.holder === address)) activities.push("spectra");
  if (users.goSlowNft.some(user => user.holder === address)) activities.push("goSlowNft");
  if (users.troves.some(trove => trove.borrower === address)) activities.push("trove");
  if (users.stabilityPoolDepositors.includes(address)) activities.push("stabilityPool");
  
  return activities;
}