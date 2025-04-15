import type { Address, Dnum, Initiative } from "@/src/types";
import type { Config as WagmiConfig } from "wagmi";

import { DATA_REFRESH_INTERVAL } from "@/src/constants";
import { getProtocolContract } from "@/src/contracts";
import { dnum18, DNUM_0, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { KNOWN_INITIATIVES_URL } from "@/src/env";
import { useGovernanceInitiatives } from "@/src/subgraph-hooks";
import { vAddress } from "@/src/valibot-utils";
import { useRaf } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
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
        const cutoffStart = epochStart + epochVotingCutoff;

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
      const response = await fetch(KNOWN_INITIATIVES_URL);
      return v.parse(KnownInitiativesSchema, await response.json());
    },
    enabled: KNOWN_INITIATIVES_URL !== undefined,
  });
}

export async function getUserAllocations(
  wagmiConfig: WagmiConfig,
  account: Address,
  initiatives: Initiative[],
) {
  const Governance = getProtocolContract("Governance");

  const allocationsByInitiative = await readContracts(wagmiConfig, {
    allowFailure: false,
    contracts: initiatives.map((initiative) => ({
      ...Governance,
      functionName: "lqtyAllocatedByUserToInitiative",
      args: [account, initiative.address],
    } as const)),
  });

  return allocationsByInitiative.map((allocation, index) => {
    const initiative = initiatives[index]?.address;
    if (!initiative) throw new Error(); // should never happen
    const [voteLQTY, _voteOffset, vetoLQTY, _vetoOffset] = allocation;
    return { vetoLQTY, voteLQTY, initiative };
  });
}

export async function getUserState(
  wagmiConfig: WagmiConfig,
  account: Address,
) {
  const userState = await readContract(wagmiConfig, {
    ...getProtocolContract("Governance"),
    functionName: "userStates",
    args: [account],
  });

  const [
    unallocatedLQTY,
    unallocatedOffset,
    allocatedLQTY,
    allocatedOffset,
  ] = userState;

  return {
    id: account,
    allocatedLQTY,
    allocatedOffset,
    stakedLQTY: unallocatedLQTY,
    stakedOffset: unallocatedOffset,
  };
}

export function useGovernanceUser(account: Address | null) {
  const initiatives = useInitiatives();
  const wagmiConfig = useWagmiConfig();

  let queryFn = async () => {
    if (!account || !initiatives.data) return null;

    const [userState, allocations] = await Promise.all([
      getUserStates(wagmiConfig, account),
      getUserAllocations(wagmiConfig, account, initiatives.data),
    ]);

    return { ...userState, allocations };
  };

  return useQuery({
    queryKey: [
      "GovernanceUser",
      account,
      jsonStringifyWithDnum(initiatives.data),
    ],
    queryFn,
    refetchInterval: DATA_REFRESH_INTERVAL,
  });
}

// votingPower(t) = lqty * t - offset
export function votingPower(
  stakedLQTY: bigint,
  offset: bigint,
  timestampInSeconds: bigint,
) {
  return stakedLQTY * timestampInSeconds - offset;
}

export function useVotingPower(
  account: Address | null,
  callback: (share: Dnum | null) => void,
  updatesPerSecond: number = 30,
) {
  const govStats = useGovernanceStats();
  const govUser = useGovernanceUser(account);

  useRaf(() => {
    const { totalLQTYStaked, totalOffset } = govStats.data ?? {};
    const { allocatedLQTY, allocatedOffset } = govUser.data ?? {};

    if (
      allocatedLQTY === undefined
      || allocatedOffset === undefined
      || totalLQTYStaked === undefined
      || totalOffset === undefined
    ) {
      callback(null);
      return;
    }

    const now = Date.now();
    const nowInSeconds = BigInt(Math.floor(now / 1000));

    const userVp = votingPower(allocatedLQTY, allocatedOffset, nowInSeconds);
    const userVpNext = votingPower(allocatedLQTY, allocatedOffset, nowInSeconds + 1n);
    const totalVP = votingPower(totalLQTYStaked, totalOffset, nowInSeconds);
    const totalVPNext = votingPower(totalLQTYStaked, totalOffset, nowInSeconds + 1n);

    // progress of current second, scaled to 1000
    const progressScaled = BigInt(Math.floor(((now % 1000) / 1000) * 1000));

    const userVpLive = userVp + (userVpNext - userVp) * progressScaled / 1000n;
    const totalVpLive = totalVP + (totalVPNext - totalVP) * progressScaled / 1000n;

    // pctShare(t) = userVotingPower(t) / totalVotingPower(t)
    callback(
      totalVpLive === 0n ? DNUM_0 : dn.div(
        dnum18(userVpLive),
        dnum18(totalVpLive),
      ),
    );
  }, updatesPerSecond);
}

export function useGovernanceStats() {
  return useReadContract({
    ...getProtocolContract("Governance"),
    functionName: "globalState",
    query: {
      select: ([countedVoteLQTY, countedVoteOffset]) => ({
        totalLQTYStaked: countedVoteLQTY,
        totalOffset: countedVoteOffset,
      }),
    },
  });
}
