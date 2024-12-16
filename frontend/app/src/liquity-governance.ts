import type { Address, Initiative } from "@/src/types";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Config as WagmiConfig } from "wagmi";

import { GOVERNANCE_EPOCH_DURATION, GOVERNANCE_EPOCH_VOTING_CUTOFF } from "@/src/constants";
import { getProtocolContract } from "@/src/contracts";
import { INITIATIVE_UNI_V4_DONATIONS } from "@/src/env";
import { useQuery } from "@tanstack/react-query";
import { useReadContract, useReadContracts } from "wagmi";
import { readContract } from "wagmi/actions";

export function useGovernanceState() {
  const Governance = getProtocolContract("Governance");
  return useReadContracts({
    contracts: [{
      ...Governance,
      functionName: "epochStart",
    }, {
      ...Governance,
      functionName: "getTotalVotesAndState",
    }, {
      ...Governance,
      functionName: "secondsWithinEpoch",
    }],
    query: {
      select: ([
        epochStart,
        totalVotesAndState,
        secondsWithinEpoch,
      ]) => {
        const period: "cutoff" | "voting" = (secondsWithinEpoch.result ?? 0n) > GOVERNANCE_EPOCH_VOTING_CUTOFF
          ? "cutoff"
          : "voting";

        const seconds = Number(secondsWithinEpoch.result ?? 0n);
        const daysLeft = (Number(GOVERNANCE_EPOCH_DURATION) - seconds) / (24 * 60 * 60);
        const daysLeftRounded = Math.ceil(daysLeft);

        return {
          countedVoteLQTY: totalVotesAndState.result?.[1].countedVoteLQTY,
          countedVoteOffset: totalVotesAndState.result?.[1].countedVoteOffset,
          epochStart: epochStart.result,
          secondsWithinEpoch: secondsWithinEpoch.result,
          totalVotes: totalVotesAndState.result?.[0],
          period,
          daysLeft,
          daysLeftRounded,
        };
      },
    },
  });
}

type InitiativeStatus =
  | "nonexistent"
  | "warm up"
  | "skip"
  | "claimable"
  | "claimed"
  | "disabled"
  | "unregisterable";

function initiativeStatusFromNumber(status: number): InitiativeStatus {
  const statuses: Record<number, InitiativeStatus> = {
    0: "nonexistent",
    1: "warm up",
    2: "skip",
    3: "claimable",
    4: "claimed",
    5: "disabled",
    6: "unregisterable",
  };
  return statuses[status] || "nonexistent";
}

export function useInitiativeState(initiativeAddress: Address | null) {
  const Governance = getProtocolContract("Governance");

  return useReadContracts({
    contracts: [{
      ...Governance,
      functionName: "getInitiativeState",
      args: [initiativeAddress ?? "0x"],
    }, {
      ...Governance,
      functionName: "getInitiativeSnapshotAndState",
      args: [initiativeAddress ?? "0x"],
    }],
    query: {
      enabled: initiativeAddress !== null,
      select: ([initiativeState, snapshotAndState]) => {
        return {
          status: initiativeStatusFromNumber(initiativeState.result?.[0] ?? 0),
          lastEpochClaim: initiativeState.result?.[1],
          claimableAmount: initiativeState.result?.[2],
          snapshot: snapshotAndState.result?.[0],
          state: snapshotAndState.result?.[1],
          shouldUpdate: snapshotAndState.result?.[2],
        };
      },
    },
  });
}

export function useUserStates(account: Address | null) {
  const Governance = getProtocolContract("Governance");
  const userStates = useReadContract({
    ...Governance,
    functionName: "userStates",
    args: [account ?? "0x"],
    query: {
      enabled: account !== null,
      select: (userStates) => ({
        allocatedLQTY: userStates[2],
        allocatedOffset: userStates[3],
        unallocatedLQTY: userStates[0],
        unallocatedOffset: userStates[1],
      }),
    },
  });

  return userStates;
}

export async function getUserStates(
  wagmiConfig: WagmiConfig,
  account: Address,
) {
  const Governance = getProtocolContract("Governance");
  const result = await readContract(wagmiConfig, {
    ...Governance,
    functionName: "userStates",
    args: [account],
  });

  return {
    allocatedLQTY: result[2],
    allocatedOffset: result[3],
    unallocatedLQTY: result[0],
    unallocatedOffset: result[1],
  };
}

// const INITIATIVES_STATIC: Initiative[] = [
//   {
//     address: "0x0000000000000000000000000000000000000001",
//     name: "WETH-BOLD 0.3%",
//     protocol: "Uniswap V4",
//     tvl: dn.from(2_420_000, 18),
//     pairVolume: dn.from(1_420_000, 18),
//     votesDistribution: dn.from(0.35, 18),
//   },
//   {
//     address: "0x0000000000000000000000000000000000000002",
//     name: "WETH-BOLD 0.3%",
//     protocol: "Uniswap V4",
//     tvl: dn.from(2_420_000, 18),
//     pairVolume: dn.from(1_420_000, 18),
//     votesDistribution: dn.from(0.20, 18),
//   },
//   {
//     address: "0x0000000000000000000000000000000000000003",
//     name: "crvUSD-BOLD 0.01%",
//     protocol: "Curve V2",
//     tvl: dn.from(2_420_000, 18),
//     pairVolume: dn.from(1_420_000, 18),
//     votesDistribution: dn.from(0.15, 18),
//   },
//   {
//     address: "0x0000000000000000000000000000000000000004",
//     name: "3pool-BOLD 0.01%",
//     protocol: "Curve V2",
//     tvl: dn.from(2_420_000, 18),
//     pairVolume: dn.from(1_420_000, 18),
//     votesDistribution: dn.from(0.10, 18),
//   },
//   {
//     address: "0x0000000000000000000000000000000000000005",
//     name: "3pool-BOLD 0.01%",
//     protocol: "Curve V2",
//     tvl: dn.from(2_420_000, 18),
//     pairVolume: dn.from(1_420_000, 18),
//     votesDistribution: dn.from(0.10, 18),
//   },
//   {
//     address: "0x0000000000000000000000000000000000000006",
//     name: "3pool-BOLD 0.01%",
//     protocol: "Curve V2",
//     tvl: dn.from(2_420_000, 18),
//     pairVolume: dn.from(1_420_000, 18),
//     votesDistribution: dn.from(0.05, 18),
//   },
//   {
//     address: "0x0000000000000000000000000000000000000007",
//     name: "DeFi Collective: BOLD incentives on Euler",
//     protocol: "0x5305...1418",
//     tvl: dn.from(0, 18),
//     pairVolume: dn.from(0, 18),
//     votesDistribution: dn.from(0.025, 18),
//   },
//   {
//     address: "0x0000000000000000000000000000000000000008",
//     name: "DeFi Collective: BOLD-USDC on Balancer",
//     protocol: "0x7179...9f8f",
//     tvl: dn.from(0, 18),
//     pairVolume: dn.from(0, 18),
//     votesDistribution: dn.from(0, 18),
//   },
// ];

const INITIATIVES_STATIC: Initiative[] = [
  {
    name: "UNI V4 donations",
    protocol: "Uniswap V4",
    address: INITIATIVE_UNI_V4_DONATIONS,
    tvl: null,
    pairVolume: null,
    votesDistribution: null,
  },
];

export function useInitiatives(): UseQueryResult<Initiative[]> {
  return useQuery({
    queryKey: ["initiatives"],
    queryFn: () => {
      return INITIATIVES_STATIC;
    },
  });
}

// // export function useRegisteredInitiatives() {
// //   const Governance = getProtocolContract("Governance");

// //   return useReadContract({
// //     ...Governance,
// //     functionName: "registeredInitiatives",
// //     query: {
// //       refetchInterval: DATA_REFRESH_INTERVAL,
// //       select: (data: Record<Address, number>) => {
// //         return Object.entries(data)
// //           .filter(([_, epoch]) => epoch > 0)
// //           .map(([address]) => address as Address);
// //       },
// //     },
// //   });
// // }