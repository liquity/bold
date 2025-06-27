import type { Address, Dnum, Initiative } from "@/src/types";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Config as WagmiConfig } from "wagmi";

import { BribeInitiative } from "@/src/abi/BribeInitiative";
import { getProtocolContract } from "@/src/contracts";
import { dnum18, DNUM_0, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { KNOWN_INITIATIVES_URL } from "@/src/env";
import { getIndexedInitiatives } from "@/src/subgraph";
import { jsonStringifyWithBigInt } from "@/src/utils";
import { vAddress } from "@/src/valibot-utils";
import { useRaf } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import * as v from "valibot";
import { erc20Abi } from "viem";
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

export async function getKnownInitiatives(knownInitiativesUrl: string): Promise<
  | v.InferOutput<typeof KnownInitiativesSchema>
  | null
> {
  try {
    const response = await fetch(knownInitiativesUrl);
    const data = await response.json();
    return v.parse(KnownInitiativesSchema, data);
  } catch (_) {
    return null;
  }
}

export function useNamedInitiatives() {
  return useQuery({
    queryKey: ["useNamedInitiatives"],
    queryFn: async () => {
      const [initiatives, knownInitiatives] = await Promise.all([
        getIndexedInitiatives(),
        KNOWN_INITIATIVES_URL
          ? getKnownInitiatives(KNOWN_INITIATIVES_URL)
          : null,
      ]);
      return initiatives.map((address): Initiative => {
        const ki = knownInitiatives?.[address];
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

export function useInitiativesStates(initiatives: Address[]) {
  const wagmiConfig = useWagmiConfig();

  const Governance = getProtocolContract("Governance");

  return useQuery({
    queryKey: ["initiativesStates", initiatives.join("")],
    queryFn: async () => {
      const results = await readContracts(wagmiConfig, {
        contracts: initiatives.map((address) => ({
          ...Governance,
          functionName: "getInitiativeState",
          args: [address],
        } as const)),
      });

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

export function useInitiativesVoteTotals(initiatives: Address[]) {
  const wagmiConfig = useWagmiConfig();
  const Governance = getProtocolContract("Governance");

  return useQuery({
    queryKey: ["initiativesVoteTotals", initiatives.join("")],
    queryFn: async () => {
      const voteTotals: Record<Address, {
        totalVotes: Dnum;
        totalVetos: Dnum;
      }> = {};

      const results = await readContracts(wagmiConfig, {
        contracts: initiatives.map((address) => ({
          ...Governance,
          functionName: "getInitiativeSnapshotAndState",
          args: [address],
        } as const)),
      });

      for (const [i, { result }] of results.entries()) {
        if (result && initiatives[i]) {
          const [{ votes, vetos }] = result;
          voteTotals[initiatives[i]] = {
            totalVotes: dnum18(votes),
            totalVetos: dnum18(vetos),
          };
        }
      }

      return voteTotals;
    },
  });
}

export async function getUserAllocations(
  wagmiConfig: WagmiConfig,
  account: Address,
  initiatives?: Address[],
) {
  if (!initiatives) {
    initiatives = await getIndexedInitiatives();
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
    const [voteLQTY, _, vetoLQTY] = allocation;
    return { vetoLQTY, voteLQTY, initiative };
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
    unallocatedLQTY,
    unallocatedOffset,
  };
}

export function useGovernanceUser(account: Address | null) {
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
    claimData: Array<{
      epoch: number;
      prevLQTYAllocationEpoch: number;
      prevTotalLQTYAllocationEpoch: number;
    }>;
  }>;
  totalBold: Dnum;
};

// represents an initiative bribe for a given epoch
type InitiativeBribe = {
  boldAmount: Dnum;
  tokenAmount: Dnum;
  tokenAddress: Address;
  tokenSymbol: string;
};

export function useCurrentEpochBribes(
  initiatives: Address[],
): UseQueryResult<Record<Address, InitiativeBribe>> {
  const wagmiConfig = useWagmiConfig();
  const govState = useGovernanceState();

  return useQuery({
    queryKey: [
      "currentEpochBribes",
      initiatives.join(""),
      String(govState.data?.epoch),
    ],
    queryFn: async () => {
      if (!govState.data || initiatives.length === 0) {
        return {};
      }

      const bribeTokens = await readContracts(wagmiConfig, {
        contracts: initiatives.map((initiative) => ({
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
        if (bribeTokenResult.result && initiatives[index]) {
          bribeInitiatives.push({
            initiative: initiatives[index],
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

// limit checks to the last 52 epochs
const BRIBING_CHECK_EPOCH_LIMIT = 52;

export function useBribingClaim(
  account: Address | null,
): UseQueryResult<BribeClaim | null> {
  const wagmiConfig = useWagmiConfig();
  const govState = useGovernanceState();
  const govUser = useGovernanceUser(account);

  return useQuery({
    queryKey: [
      "bribingClaim",
      account,
      String(govState.data?.epoch),
      jsonStringifyWithBigInt(govUser.data),
    ],
    queryFn: async () => {
      if (!account || !govState.data || !govUser.data) {
        return null;
      }

      const currentEpoch = govState.data.epoch;
      const epochDuration = govState.data.epochEnd - govState.data.epochStart;

      const initiativesToCheck = govUser.data.allocations
        .filter(({ voteLQTY, vetoLQTY }) => (voteLQTY + vetoLQTY) > 0n)
        .map(({ initiative }) => initiative);

      if (initiativesToCheck.length === 0) {
        return {
          bribeTokens: [],
          claimableInitiatives: [],
          totalBold: DNUM_0,
        };
      }

      const bribeChecks = await readContracts(wagmiConfig, {
        contracts: initiativesToCheck.map((initiative) => ({
          abi: BribeInitiative,
          address: initiative,
          functionName: "bribeToken",
        } as const)),
        allowFailure: true,
      });

      const bribeInitiatives: Array<{
        address: Address;
        bribeToken: Address;
      }> = [];

      for (const [index, token] of bribeChecks.entries()) {
        const address = initiativesToCheck[index];
        if (address && token.result) {
          bribeInitiatives.push({
            address,
            bribeToken: token.result,
          });
        }
      }

      // should not happen since we check for initiativesToCheck.length above
      if (bribeInitiatives.length === 0) {
        throw new Error("No bribe initiatives found for the user");
      }

      // for each bribe initiative, check claimable epochs
      const claimableInitiatives: BribeClaim["claimableInitiatives"] = [];
      const bribeTokenData = new Map<Address, { amount: Dnum; symbol?: string }>();

      const bribeDetailsPerInitiative = await Promise.all(
        bribeInitiatives.map(async ({ address, bribeToken }) => {
          const completedEpochs = Number(currentEpoch) - 1; // exclude current epoch

          // no completed epochs yet
          if (completedEpochs < 1) {
            return null;
          }

          const epochsToCheck = Math.min(completedEpochs, BRIBING_CHECK_EPOCH_LIMIT);
          const startEpoch = Math.max(1, completedEpochs - epochsToCheck + 1);

          const results = await readContracts(wagmiConfig, {
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
              }, {
                ...BribeContract,
                functionName: "lqtyAllocatedByUserAtEpoch",
                args: [account, epoch],
              }, {
                ...BribeContract,
                functionName: "totalLQTYAllocatedByEpoch",
                args: [epoch],
              }] as const;
            }).flat(),
            allowFailure: false,
          });

          const claimableEpochs: number[] = [];
          let initiativeBold = DNUM_0;
          let initiativeBribeToken = DNUM_0;

          // process results in groups of 4 (one per epoch)
          for (let epochIndex = 0; epochIndex < epochsToCheck; epochIndex++) {
            const epoch = startEpoch + epochIndex;
            const resultIndex = epochIndex * 4;

            const hasClaimed = results[resultIndex] as boolean;
            const [
              remainingBold,
              remainingBribeToken,
              claimedVotes,
            ] = results[resultIndex + 1] as [bigint, bigint, bigint];
            const [userLqty, userOffset] = results[resultIndex + 2] as [bigint, bigint];
            const [totalLqty, totalOffset] = results[resultIndex + 3] as [bigint, bigint];

            // skip if already claimed or no bribes available
            if (hasClaimed || (remainingBold === 0n && remainingBribeToken === 0n) || userLqty === 0n) {
              continue;
            }

            const epochEnd = govState.data.epochStart
              - ((currentEpoch - BigInt(epoch)) * epochDuration)
              + epochDuration;

            // voting power at the end of the epoch
            const userVP = votingPower(userLqty, userOffset, epochEnd);
            const totalVP = votingPower(totalLqty, totalOffset, epochEnd);

            const remainingVP = totalVP - claimedVotes;

            if (remainingVP > 0n && userVP > 0n) {
              const userShare = userVP <= remainingVP ? userVP : remainingVP;
              const shareRatio = dn.div(dnum18(userShare), dnum18(remainingVP));

              const boldClaim = dn.mul(dnum18(remainingBold), shareRatio);
              const bribeTokenClaim = dn.mul(dnum18(remainingBribeToken), shareRatio);

              initiativeBold = dn.add(initiativeBold, boldClaim);
              initiativeBribeToken = dn.add(initiativeBribeToken, bribeTokenClaim);
              claimableEpochs.push(epoch);
            }
          }

          if (claimableEpochs.length === 0) {
            return null;
          }

          // fetch claim data for each claimable epoch
          const claimDataResults = await readContracts(wagmiConfig, {
            contracts: claimableEpochs.flatMap(() => ([{
              abi: BribeInitiative,
              address,
              functionName: "getMostRecentUserEpoch",
              args: [account],
            }, {
              abi: BribeInitiative,
              address,
              functionName: "getMostRecentTotalEpoch",
              args: [],
            }] as const)),
            allowFailure: false,
          });

          const claimData = claimableEpochs.map((epoch, index) => {
            const userEpochIndex = index * 2;
            const totalEpochIndex = index * 2 + 1;
            return {
              epoch,
              prevLQTYAllocationEpoch: Number(claimDataResults[userEpochIndex]),
              prevTotalLQTYAllocationEpoch: Number(claimDataResults[totalEpochIndex]),
            };
          });

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
