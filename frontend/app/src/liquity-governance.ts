import type { Address, Initiative } from "@/src/types";
import type { Config as WagmiConfig } from "wagmi";

import { getProtocolContract } from "@/src/contracts";
import { KNOWN_INITIATIVES_URL } from "@/src/env";
import { useGovernanceInitiatives } from "@/src/subgraph-hooks";
import { vAddress } from "@/src/valibot-utils";
import { useQuery } from "@tanstack/react-query";
import * as v from "valibot";
import { useConfig as useWagmiConfig, useReadContract, useReadContracts } from "wagmi";
import { readContract, readContracts } from "wagmi/actions";

export type InitiativeStatus =
  | "nonexistent"
  | "warm up"
  | "skip"
  | "claimable"
  | "claimed"
  | "disabled"
  | "unregisterable";

export function initiativeStatusFromNumber(status: number): InitiativeStatus {
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

export function useGovernanceState() {
  const Governance = getProtocolContract("Governance");
  return useReadContracts({
    contracts: [{
      ...Governance,
      functionName: "epoch",
    }, {
      ...Governance,
      functionName: "epochStart",
    }, {
      ...Governance,
      functionName: "getTotalVotesAndState",
    }, {
      ...Governance,
      functionName: "secondsWithinEpoch",
    }, {
      ...Governance,
      functionName: "EPOCH_DURATION",
    }, {
      ...Governance,
      functionName: "EPOCH_VOTING_CUTOFF",
    }],
    query: {
      select: ([
        epoch_,
        epochStart_,
        totalVotesAndState,
        secondsWithinEpoch,
        GOVERNANCE_EPOCH_DURATION,
        GOVERNANCE_EPOCH_VOTING_CUTOFF,
      ]) => {
        const epoch = epoch_.result ?? 0n;
        const epochStart = epochStart_.result ?? 0n;
        const epochDuration = GOVERNANCE_EPOCH_DURATION.result ?? 0n;
        const epochVotingCutoff = GOVERNANCE_EPOCH_VOTING_CUTOFF.result ?? 0n;
        const cutoffStart = (epochStart + epochDuration) - epochVotingCutoff;

        const period: "cutoff" | "voting" = (secondsWithinEpoch.result ?? 0n) > epochVotingCutoff
          ? "cutoff"
          : "voting";

        const seconds = Number(secondsWithinEpoch.result ?? 0n);
        const daysLeft = (Number(epochDuration) - seconds) / (24 * 60 * 60);
        const daysLeftRounded = Math.ceil(daysLeft);

        return {
          countedVoteLQTY: totalVotesAndState.result?.[1].countedVoteLQTY,
          countedVoteOffset: totalVotesAndState.result?.[1].countedVoteOffset,
          cutoffStart,
          daysLeft,
          daysLeftRounded,
          epoch,
          epochEnd: epochStart + epochDuration,
          epochStart,
          period,
          secondsWithinEpoch: secondsWithinEpoch.result,
          totalVotes: totalVotesAndState.result?.[0],
        };
      },
    },
  });
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
    stakedLQTY: result[2] + result[0],
    unallocatedLQTY: result[0],
    unallocatedOffset: result[1],
  };
}

export function useInitiatives() {
  const initiatives = useGovernanceInitiatives();
  const knownInitiatives = useKnownInitiatives();
  return {
    ...initiatives,
    data: initiatives.data && knownInitiatives.data
      ? initiatives.data.map((address): Initiative => {
        const knownInitiative = knownInitiatives.data[address];
        return {
          address,
          name: knownInitiative?.name ?? null,
          pairVolume: null,
          protocol: knownInitiative?.group ?? null,
          tvl: null,
          votesDistribution: null,
        };
      })
      : null,
  };
}

export function useInitiativesStates(initiatives: Address[]) {
  const wagmiConfig = useWagmiConfig();

  const Governance = getProtocolContract("Governance");

  return useQuery({
    queryKey: ["initiativesStates", initiatives.join("")],
    queryFn: async () => {
      // Declared explicitly to avoid this TS error:
      // “Type instantiation is excessively deep and possibly infinite”
      const contracts: {
        abi: typeof Governance.abi;
        address: Address;
        functionName: "getInitiativeState";
        args: [Address];
      }[] = initiatives.map((address) => ({
        ...Governance,
        functionName: "getInitiativeState",
        args: [address],
      }));

      const results = await readContracts(wagmiConfig, { contracts });

      const initiativesStates: Record<Address, {
        status: InitiativeStatus;
        lastEpochClaim: bigint;
        claimableAmount: bigint;
      }> = {};

      for (const [i, { result }] of results.entries()) {
        if (result && initiatives[i]) {
          initiativesStates[initiatives[i]] = {
            status: initiativeStatusFromNumber(result[0]),
            lastEpochClaim: result[1],
            claimableAmount: result[2],
          };
        }
      }

      return initiativesStates;
    },
  });
}

const KnownInitiativesSchema = v.record(
  v.pipe(
    vAddress(),
    v.transform((address) => address.toLowerCase()),
  ),
  v.object({
    name: v.string(),
    group: v.string(),
  }),
);

export function useKnownInitiatives() {
  return useQuery({
    queryKey: ["knownInitiatives"],
    queryFn: async () => {
      if (KNOWN_INITIATIVES_URL === undefined) {
        throw new Error("KNOWN_INITIATIVES_URL is not defined");
      }
      const response = await fetch(KNOWN_INITIATIVES_URL, {
        headers: { "Content-Type": "application/json" },
      });
      return v.parse(KnownInitiativesSchema, await response.json());
    },
    enabled: KNOWN_INITIATIVES_URL !== undefined,
  });
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
