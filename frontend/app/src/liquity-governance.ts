import type { Address, Dnum, Initiative } from "@/src/types";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Config as WagmiConfig } from "wagmi";

import { BribeInitiative } from "@/src/abi/BribeInitiative";
import { getProtocolContract } from "@/src/contracts";
import { dnum18, DNUM_0, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { CHAIN_CONTRACT_MULTICALL, KNOWN_INITIATIVES_URL, LIQUITY_GOVERNANCE_URL } from "@/src/env";
import {
  getGovernanceGlobalData,
  getTotalAllocationHistoryFromSubgraph,
  getUserAllocationHistoryFromSubgraph,
} from "@/src/subgraph";
import { jsonStringifyWithBigInt } from "@/src/utils";
import { vAddress } from "@/src/valibot-utils";
import { useRaf } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import { useMemo } from "react";
import * as v from "valibot";
import { erc20Abi, parseAbi } from "viem";
import { useConfig as useWagmiConfig, useReadContract, useReadContracts } from "wagmi";
import { readContract, readContracts } from "wagmi/actions";
import { InferOutput } from 'valibot';

export type InitiativeStatus =
  | "nonexistent"
  | "warm up"
  | "skip"
  | "claimable"
  | "claimed"
  | "unregisterable"
  | "disabled";

export function initiativeStatusFromNumber(status: number): InitiativeStatus {
  const statuses: Record<number, InitiativeStatus> = {
    0: "nonexistent",
    1: "warm up",
    2: "skip",
    3: "claimable",
    4: "claimed",
    5: "unregisterable",
    6: "disabled",
  };
  return statuses[status] || "nonexistent";
}

export interface GovernanceState {
  countedVoteLQTY: bigint;
  countedVoteOffset: bigint;
  cutoffStart: bigint;
  daysLeft: number;
  daysLeftRounded: number;
  epoch: bigint;
  epochEnd: bigint;
  epochStart: bigint;
  period: "cutoff" | "voting";
  secondsWithinEpoch: bigint | undefined;
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
      functionName: "globalState",
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
        globalState,
        secondsWithinEpoch,
        GOVERNANCE_EPOCH_DURATION,
        GOVERNANCE_EPOCH_VOTING_CUTOFF,
      ]): GovernanceState => {
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

        const data: GovernanceState = {
          countedVoteLQTY: globalState.result?.[0] ?? 0n,
          countedVoteOffset: globalState.result?.[1] ?? 0n,
          cutoffStart,
          daysLeft,
          daysLeftRounded,
          epoch,
          epochEnd: epochStart + epochDuration,
          epochStart,
          period,
          secondsWithinEpoch: secondsWithinEpoch.result,
        };

        return data;
      },
    },
  });
}

const KnownInitiativesSchema = v.record(
  v.pipe(
    vAddress(),
    v.transform((address) => address.toLowerCase()),
  ),
  v.pipe(
    v.object({
      name: v.string(),
      name_link: v.optional(v.pipe(v.string(), v.url())),
      group: v.string(),
    }),
    v.transform(({ name_link = null, ...initiative }) => ({
      ...initiative,
      url: name_link,
    })),
  ),
);

export type KnownInitiatives = InferOutput<typeof KnownInitiativesSchema>;

function useKnownInitiatives(): UseQueryResult<KnownInitiatives | null> {
  return useQuery({
    queryKey: ["knownInitiatives"],
    queryFn: async () => {
      if (!KNOWN_INITIATIVES_URL) return null;

      const response = await fetch(KNOWN_INITIATIVES_URL);
      const data = await response.json();
      return v.parse(KnownInitiativesSchema, data);
    },
  });
}

function useGovernanceGlobalData() {
  return useQuery({
    queryKey: ["governanceGlobalData"],
    queryFn: getGovernanceGlobalData,
  });
}

export function useNamedInitiatives() {
  const knownInitiatives = useKnownInitiatives();
  const governanceGlobal = useGovernanceGlobalData();

  return useQuery({
    queryKey: ["namedInitiatives"],
    enabled: (
      knownInitiatives.isSuccess && governanceGlobal.isSuccess
      || knownInitiatives.isError
      || governanceGlobal.isError
    ),
    queryFn: () => {
      if (knownInitiatives.isError) throw knownInitiatives.error;
      if (governanceGlobal.isError) throw governanceGlobal.error;
      if (knownInitiatives.isPending || governanceGlobal.isPending) throw new Error("should not happen"); // see enabled

      return governanceGlobal.data.registeredInitiatives.map((address): Initiative => {
        const ki = knownInitiatives.data?.[address];
        return {
          address,
          name: ki?.name ?? null,
          pairVolume: null,
          protocol: ki?.group ?? null,
          tvl: null,
          url: ki?.url ?? null,
          votesDistribution: null,
        };
      });
    },
  });
}

export type InitiativeState = Record<Address, {
  status: InitiativeStatus;
  lastEpochClaim: bigint;
  claimableAmount: bigint;
}>

export function useInitiativesStates(initiatives: Address[]) {
  const wagmiConfig = useWagmiConfig();

  const Governance = getProtocolContract("Governance");

  // stabilize the order of addresses (cache improvement and predictable)
  const sortedAddress = useMemo(
    () => [...initiatives].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [initiatives]
  );

  return useQuery({
    enabled: sortedAddress.length > 0,
    queryKey: ["initiativesStates", sortedAddress.join("")],
    queryFn: async () => {
      const results = await readContracts(wagmiConfig, {
        contracts: sortedAddress.map((address) => ({
          ...Governance,
          functionName: "getInitiativeState",
          args: [address],
        } as const)),
      });

      const initiativesStates: InitiativeState = {};

      for (const [i, { result }] of results.entries()) {
        if (result && sortedAddress[i]) {
          initiativesStates[sortedAddress[i]] = {
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

export type VoteTotals = {
  voteLQTY: bigint;
  voteOffset: bigint;
  vetoLQTY: bigint;
  vetoOffset: bigint;
};

export function useInitiativesVoteTotals(initiatives: Address[]) {
  const wagmiConfig = useWagmiConfig();
  const Governance = getProtocolContract("Governance");

  // stabilize the order of addresses (cache improvement and predictable)
  const sortedAddress = useMemo(
    () => [...initiatives].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [initiatives]
  );

  return useQuery({
    queryKey: ["initiativesVoteTotals", sortedAddress.join("")],
    queryFn: async () => {
      const voteTotals: Record<Address, VoteTotals> = {};

      const results = await readContracts(wagmiConfig, {
        contracts: sortedAddress.map((address) => ({
          ...Governance,
          functionName: "initiativeStates",
          args: [address],
        } as const)),
      });

      for (const [i, { result }] of results.entries()) {
        if (result && sortedAddress[i]) {
          const [voteLQTY, voteOffset, vetoLQTY, vetoOffset] = result;
          voteTotals[sortedAddress[i]] = {
            voteLQTY,
            voteOffset,
            vetoLQTY,
            vetoOffset,
          };
        }
      }

      return voteTotals;
    },
  });
}

export interface UserAllocation {
  voteLQTY: bigint;
  voteOffset: bigint;
  vetoLQTY: bigint;
  vetoOffset: bigint;
  initiative: Address;
}

export async function getUserAllocations(
  wagmiConfig: WagmiConfig,
  account: Address,
  initiatives?: Address[],
): Promise<UserAllocation[]> {
  if (!initiatives) {
    initiatives = (await getGovernanceGlobalData()).registeredInitiatives;
  }

  const Governance = getProtocolContract("Governance");

  const allocationsByInitiative = await readContracts(wagmiConfig, {
    allowFailure: false,
    contracts: initiatives.map((address) => ({
      ...Governance,
      functionName: "lqtyAllocatedByUserToInitiative",
      args: [account, address],
    } as const)),
  });

  return allocationsByInitiative.map((allocation, index) => {
    const initiative = initiatives[index];
    if (!initiative) throw new Error(); // should never happen

    const [voteLQTY, voteOffset, vetoLQTY, vetoOffset] = allocation;
    return { voteLQTY, voteOffset, vetoLQTY, vetoOffset, initiative };
  });
}

export async function getUserAllocatedInitiatives(
  wagmiConfig: WagmiConfig,
  account: Address,
  initiatives?: Address[],
) {
  const allocations = await getUserAllocations(wagmiConfig, account, initiatives);
  return allocations
    .filter(({ voteLQTY, vetoLQTY }) => (voteLQTY + vetoLQTY) > 0n)
    .map(({ initiative }) => initiative);
}

export interface UserState {
  unallocatedLQTY: bigint;
  unallocatedOffset: bigint;
  allocatedLQTY: bigint;
  allocatedOffset: bigint;
  stakedLQTY: bigint;
  stakedOffset: bigint;
}

export async function getUserStates(
  wagmiConfig: WagmiConfig,
  account: Address,
): Promise<UserState> {
  const Governance = getProtocolContract("Governance");
  const result = await readContract(wagmiConfig, {
    ...Governance,
    functionName: "userStates",
    args: [account],
  });

  const [
    unallocatedLQTY,
    unallocatedOffset,
    allocatedLQTY,
    allocatedOffset,
  ] = result;

  return {
    allocatedLQTY,
    allocatedOffset,
    stakedLQTY: allocatedLQTY + unallocatedLQTY,
    stakedOffset: allocatedOffset + unallocatedOffset,
    unallocatedLQTY,
    unallocatedOffset,
  };
}

export interface GovernanceUserState extends UserState {
  allocations: UserAllocation[];
}

export function useGovernanceUser(account: Address | null): UseQueryResult<GovernanceUserState | null> {
  const initiatives = useNamedInitiatives();
  const wagmiConfig = useWagmiConfig();

  let queryFn = async () => {
    if (!account || !initiatives.data) return null;

    const [userState, allocations] = await Promise.all([
      getUserStates(wagmiConfig, account),
      getUserAllocations(
        wagmiConfig,
        account,
        initiatives.data.map((i) => i.address),
      ),
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
  });
}

function useLatestBlockTimestampInMilliseconds() {
  return useReadContract({
    address: CHAIN_CONTRACT_MULTICALL,
    abi: parseAbi(["function getCurrentBlockTimestamp() view returns (uint256)"]),
    functionName: "getCurrentBlockTimestamp",
    query: { select: (blockTimestamp) => blockTimestamp * 1000n },
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

function votingPowerMs(
  stakedLQTY: bigint,
  offset: bigint,
  timestampInMilliseconds: bigint,
) {
  return (stakedLQTY * timestampInMilliseconds - offset * 1000n) / 1000n;
}

export function useVotingPower(
  account: Address | null,
  callback: (share: Dnum | null) => void,
  updatesPerSecond: number = 30,
) {
  const govStats = useGovernanceStats();
  const govUser = useGovernanceUser(account);
  const blockTimestamp = useLatestBlockTimestampInMilliseconds();
  const startTime = useMemo(() => BigInt(Date.now()), []);

  useRaf(() => {
    if (!govStats.data || !govUser.data || !blockTimestamp.data) {
      callback(null);
      return;
    }

    const { totalLQTYStaked, totalOffset } = govStats.data;
    const userLQTYStaked = govUser.data.allocatedLQTY + govUser.data.unallocatedLQTY;
    const userOffset = govUser.data.allocatedOffset + govUser.data.unallocatedOffset;

    const timeElapsed = BigInt(Date.now()) - startTime;
    const correctedStartTime = startTime > blockTimestamp.data ? startTime : blockTimestamp.data;
    const timestamp = correctedStartTime + timeElapsed;
    const userVp = votingPowerMs(userLQTYStaked, userOffset, timestamp);
    const totalVP = votingPowerMs(totalLQTYStaked, totalOffset, timestamp);

    // pctShare(t) = userVotingPower(t) / totalVotingPower(t)
    callback(
      totalVP === 0n ? DNUM_0 : dn.div(
        dnum18(userVp),
        dnum18(totalVP),
      ),
    );
  }, updatesPerSecond);
}

export function useGovernanceStats() {
  const governanceGlobal = useGovernanceGlobalData();

  return useQuery({
    queryKey: ["governanceStats"],
    enabled: !governanceGlobal.isPending,
    queryFn: () => {
      if (governanceGlobal.isError) throw governanceGlobal.error;
      if (governanceGlobal.isPending) throw new Error("should not happen"); // see enabled

      return {
        totalLQTYStaked: (
          governanceGlobal.data.totalVotingPower.allocatedLQTY
          + governanceGlobal.data.totalVotingPower.unallocatedLQTY
        ),
        totalOffset: (
          governanceGlobal.data.totalVotingPower.allocatedOffset
          + governanceGlobal.data.totalVotingPower.unallocatedOffset
        ),
      };
    },
  });
}

type ClaimData = {
  epoch: number;
  prevLQTYAllocationEpoch: number;
  prevTotalLQTYAllocationEpoch: number;
};

type BribeClaim = {
  bribeTokens: Array<{
    address: Address;
    symbol: string;
    amount: Dnum;
  }>;
  claimableInitiatives: Array<{
    initiative: Address;
    boldAmount: Dnum;
    bribeTokenAmount: Dnum;
    bribeTokenAddress: Address;
    epochs: number[];
    claimData: ClaimData[];
  }>;
  totalBold: Dnum;
};

// represents an initiative bribe for a given epoch
export type InitiativeBribe = {
  boldAmount: Dnum;
  tokenAmount: Dnum;
  tokenAddress: Address;
  tokenSymbol: string;
};

export type InitiativeBribeResult = Record<Address, InitiativeBribe>;

export function useCurrentEpochBribes(
  initiatives: Address[],
): UseQueryResult<InitiativeBribeResult> {
  const wagmiConfig = useWagmiConfig();
  const govState = useGovernanceState();

  // stabilize the order of addresses (cache improvement and predictable)
  const sortedAddress = useMemo(
    () => [...initiatives].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [initiatives]
  );

  return useQuery({
    queryKey: [
      "currentEpochBribes",
      sortedAddress.join(""),
      String(govState.data?.epoch),
    ],
    queryFn: async () => {
      if (!govState.data || sortedAddress.length === 0) {
        return {};
      }

      const bribeTokens = await readContracts(wagmiConfig, {
        contracts: sortedAddress.map((initiative) => ({
          abi: BribeInitiative,
          address: initiative,
          functionName: "bribeToken",
        } as const)),
        // this is needed because some initiatives may revert if they don't have a bribe token
        allowFailure: true,
      });

      // initiatives with a bribe token
      const bribeInitiatives: Array<{
        initiative: Address;
        bribeToken: Address;
      }> = [];

      for (const [index, bribeTokenResult] of bribeTokens.entries()) {
        if (bribeTokenResult.result && sortedAddress[index]) {
          bribeInitiatives.push({
            initiative: sortedAddress[index],
            bribeToken: bribeTokenResult.result,
          });
        }
      }

      if (bribeInitiatives.length === 0) {
        return {};
      }

      const bribeAmounts = await readContracts(wagmiConfig, {
        contracts: bribeInitiatives.map(({ initiative }) => ({
          abi: BribeInitiative,
          address: initiative,
          functionName: "bribeByEpoch",
          args: [govState.data.epoch],
        } as const)),
        allowFailure: false,
      });

      const tokenSymbols = await readContracts(wagmiConfig, {
        contracts: bribeInitiatives.map(({ bribeToken }) => ({
          abi: erc20Abi,
          address: bribeToken,
          functionName: "symbol",
        } as const)),
        allowFailure: false,
      });

      const bribes: Record<Address, InitiativeBribe> = {};

      for (const [index, [remainingBold, remainingBribeToken]] of bribeAmounts.entries()) {
        const bribeInitiative = bribeInitiatives[index];
        if (!bribeInitiative) continue;

        const { initiative, bribeToken } = bribeInitiative;

        bribes[initiative] = {
          boldAmount: dnum18(remainingBold),
          tokenAmount: dnum18(remainingBribeToken),
          tokenAddress: bribeToken,
          tokenSymbol: tokenSymbols[index] ?? "Unknown",
        };
      }

      return bribes;
    },
    enabled: Boolean(govState.data && initiatives.length > 0),
  });
}

const AllocationSchema = v.object({
  epoch: v.number(),
  voteLQTY: v.pipe(v.string(), v.transform((x) => BigInt(x))),
  vetoLQTY: v.pipe(v.string(), v.transform((x) => BigInt(x))),
  voteOffset: v.pipe(v.string(), v.transform((x) => BigInt(x))),
  vetoOffset: v.pipe(v.string(), v.transform((x) => BigInt(x))),
});

const TotalAllocationHistorySchema = v.array(AllocationSchema);

const UserAllocationSchema = v.object({
  ...AllocationSchema.entries,
  initiative: v.string(),
});

const UserAllocationHistorySchema = v.array(UserAllocationSchema);

// A user's allocation history ordered by descending epoch
async function getUserAllocationHistory(user: Address) {
  if (LIQUITY_GOVERNANCE_URL) {
    const response = await fetch(`${LIQUITY_GOVERNANCE_URL}/allocation/user/${user.toLowerCase()}.json`);
    return v.parse(UserAllocationHistorySchema, await response.json()).sort((a, b) => b.epoch - a.epoch);
  } else {
    return getUserAllocationHistoryFromSubgraph(user);
  }
}

// An initiative's total allocation history ordered by descending epoch
async function getTotalAllocationHistory(initiative: Address) {
  if (LIQUITY_GOVERNANCE_URL) {
    const response = await fetch(`${LIQUITY_GOVERNANCE_URL}/allocation/total/${initiative.toLowerCase()}.json`);
    return v.parse(TotalAllocationHistorySchema, await response.json()).sort((a, b) => b.epoch - a.epoch);
  } else {
    return getTotalAllocationHistoryFromSubgraph(initiative);
  }
}

async function getLatestCompletedEpoch(currentEpoch: bigint) {
  if (LIQUITY_GOVERNANCE_URL) {
    const response = await fetch(`${LIQUITY_GOVERNANCE_URL}/latest_completed_epoch.json`);
    return v.parse(v.number(), await response.json());
  } else {
    return Number(currentEpoch) - 1;
  }
}

// limit checks to the last 52 epochs
const BRIBING_CHECK_EPOCH_LIMIT = 52;

export function useBribingClaim(
  account: Address | null,
): UseQueryResult<BribeClaim | null> {
  const wagmiConfig = useWagmiConfig();
  const govState = useGovernanceState();
  const govUser = useGovernanceUser(account);
  const initiatives = useNamedInitiatives();

  return useQuery({
    queryKey: [
      "bribingClaim",
      account,
      String(govState.data?.epoch),
      jsonStringifyWithBigInt(govUser.data),
    ],
    queryFn: async () => {
      if (!account || !govState.data || !govUser.data || !initiatives.data) {
        return null;
      }

      const currentEpoch = govState.data.epoch;
      const epochDuration = govState.data.epochEnd - govState.data.epochStart;
      const initiativesToCheck = initiatives.data.map(({ address }) => address);

      if (initiativesToCheck.length === 0) {
        return {
          bribeTokens: [],
          claimableInitiatives: [],
          totalBold: DNUM_0,
        };
      }

      const [completedEpochs, userAllocations, bribeChecks] = await Promise.all([
        getLatestCompletedEpoch(currentEpoch),
        getUserAllocationHistory(account),
        readContracts(wagmiConfig, {
          contracts: initiativesToCheck.map((initiative) => ({
            abi: BribeInitiative,
            address: initiative,
            functionName: "bribeToken",
          } as const)),
          allowFailure: true,
        }),
      ]);

      const bribeInitiatives: Array<{
        address: Address;
        bribeToken: Address;
      }> = [];

      for (const [index, token] of bribeChecks.entries()) {
        const address = initiativesToCheck[index]?.toLowerCase() as Address | undefined;
        if (
          address
          && token.result
          && userAllocations.find((allocation) => allocation.initiative === address && allocation.voteLQTY > 0n)
        ) {
          bribeInitiatives.push({
            address,
            bribeToken: token.result,
          });
        }
      }

      if (bribeInitiatives.length === 0) {
        return {
          bribeTokens: [],
          claimableInitiatives: [],
          totalBold: DNUM_0,
        };
      }

      // for each bribe initiative, check claimable epochs
      const claimableInitiatives: BribeClaim["claimableInitiatives"] = [];
      const bribeTokenData = new Map<Address, { amount: Dnum; symbol?: string }>();

      const bribeDetailsPerInitiative = await Promise.all(
        bribeInitiatives.map(async ({ address, bribeToken }) => {
          // no completed epochs yet
          if (completedEpochs < 1) {
            return null;
          }

          const epochsToCheck = Math.min(completedEpochs, BRIBING_CHECK_EPOCH_LIMIT);
          const startEpoch = Math.max(1, completedEpochs - epochsToCheck + 1);
          const userAllocationsToInitiative = userAllocations.filter((allocation) => allocation.initiative === address);

          const [totalAllocationsToInitiative, results] = await Promise.all([
            getTotalAllocationHistory(address),
            readContracts(wagmiConfig, {
              contracts: Array.from({ length: epochsToCheck }, (_, index) => {
                const BribeContract = { abi: BribeInitiative, address } as const;
                const epoch = BigInt(startEpoch + index);
                return [{
                  ...BribeContract,
                  functionName: "claimedBribeAtEpoch",
                  args: [account, epoch],
                }, {
                  ...BribeContract,
                  functionName: "bribeByEpoch",
                  args: [epoch],
                }] as const;
              }).flat(),
              allowFailure: false,
            }),
          ]);

          const claimableEpochs: number[] = [];
          const claimData: ClaimData[] = [];
          let initiativeBold = DNUM_0;
          let initiativeBribeToken = DNUM_0;

          // process results in groups of 2 (one per epoch)
          for (let epochIndex = 0; epochIndex < epochsToCheck; epochIndex++) {
            const epoch = startEpoch + epochIndex;
            const resultIndex = epochIndex * 2;

            const hasClaimed = results[resultIndex] as boolean;
            const [
              remainingBold,
              remainingBribeToken,
              claimedVotes,
            ] = results[resultIndex + 1] as [bigint, bigint, bigint];

            // allocations are ordered by descending epoch,
            // so this finds the most recent one at the time of `epoch`
            const userAllocation = userAllocationsToInitiative.find((allocation) => allocation.epoch <= epoch);
            const totalAllocation = totalAllocationsToInitiative.find((allocation) => allocation.epoch <= epoch);

            // skip if already claimed or no bribes available
            if (
              hasClaimed
              || (remainingBold === 0n && remainingBribeToken === 0n)
              || !totalAllocation
              || !userAllocation || userAllocation.voteLQTY === 0n
            ) {
              continue;
            }

            const epochEnd = govState.data.epochStart
              - ((currentEpoch - BigInt(epoch)) * epochDuration)
              + epochDuration;

            // voting power at the end of the epoch
            const userVP = votingPower(userAllocation.voteLQTY, userAllocation.voteOffset, epochEnd);
            const totalVP = votingPower(totalAllocation.voteLQTY, totalAllocation.voteOffset, epochEnd);
            const remainingVP = totalVP - claimedVotes;

            if (remainingVP > 0n && userVP > 0n) {
              const userShare = userVP <= remainingVP ? userVP : remainingVP;
              const shareRatio = dn.div(dnum18(userShare), dnum18(remainingVP));

              const boldClaim = dn.mul(dnum18(remainingBold), shareRatio);
              const bribeTokenClaim = dn.mul(dnum18(remainingBribeToken), shareRatio);

              initiativeBold = dn.add(initiativeBold, boldClaim);
              initiativeBribeToken = dn.add(initiativeBribeToken, bribeTokenClaim);
              claimableEpochs.push(epoch);
              claimData.push({
                epoch,
                prevLQTYAllocationEpoch: Number(userAllocation.epoch),
                prevTotalLQTYAllocationEpoch: Number(totalAllocation.epoch),
              });
            }
          }

          if (claimableEpochs.length === 0) {
            return null;
          }

          return {
            boldAmount: initiativeBold,
            bribeTokenAddress: bribeToken,
            bribeTokenAmount: initiativeBribeToken,
            epochs: claimableEpochs,
            initiative: address,
            claimData,
          };
        }),
      );

      // filter out null results and prepare final data
      let totalBold = DNUM_0;
      for (const details of bribeDetailsPerInitiative) {
        if (!details) continue;
        claimableInitiatives.push(details);
        bribeTokenData.set(details.bribeTokenAddress, {
          amount: dn.add(
            bribeTokenData.get(details.bribeTokenAddress)?.amount ?? DNUM_0,
            details.bribeTokenAmount,
          ),
        });
        totalBold = dn.add(totalBold, details.boldAmount);
      }

      // fetch token symbols for all bribe tokens
      const tokenAddresses = Array.from(bribeTokenData.keys());
      if (tokenAddresses.length > 0) {
        const symbols = await readContracts(wagmiConfig, {
          contracts: tokenAddresses.map((tokenAddress) => ({
            abi: erc20Abi,
            address: tokenAddress,
            functionName: "symbol",
          } as const)),
          allowFailure: false,
        });

        for (const [index, symbol] of symbols.entries()) {
          const tokenAddress = tokenAddresses[index];
          if (!tokenAddress) {
            // should not happen since symbols is derived from tokenAddresses
            throw new Error("Unexpected undefined token address in bribe token data");
          }
          const current = bribeTokenData.get(tokenAddress);
          if (current) {
            bribeTokenData.set(tokenAddress, { ...current, symbol });
          }
        }
      }

      return {
        bribeTokens: [...bribeTokenData.entries()].map(
          ([address, { amount, symbol }]) => {
            if (!symbol) {
              throw new Error(`Failed to fetch symbol for token ${address}`);
            }
            return { address, symbol, amount };
          },
        ),
        claimableInitiatives,
        totalBold,
      };
    },
    enabled: Boolean(account && govState.isSuccess && govUser.isSuccess),
  });
}
