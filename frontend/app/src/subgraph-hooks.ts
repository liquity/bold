import type { Address, CollIndex, Delegate, PositionEarn, PositionLoanCommitted, PrefixedTroveId } from "@/src/types";

import { getBuiltGraphSDK } from "@/.graphclient";
import { DATA_REFRESH_INTERVAL } from "@/src/constants";
import { ACCOUNT_POSITIONS, BORROW_STATS } from "@/src/demo-mode";
import { dnum18 } from "@/src/dnum-utils";
import { DEMO_MODE } from "@/src/env";
import { isCollIndex, isPositionLoanCommitted, isPrefixedtroveId, isTroveId } from "@/src/types";
import { sleep } from "@/src/utils";
import { isAddress, shortenAddress } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";

const graph = getBuiltGraphSDK();

export type GraphTrove = Awaited<
  ReturnType<typeof graph.TrovesByAccount>
>["troves"][number];

export type GraphStabilityPoolDeposit = NonNullable<
  Awaited<
    ReturnType<typeof graph.StabilityPoolDeposit>
  >["stabilityPoolDeposit"]
>;

export type GraphInterestBatch = NonNullable<
  Awaited<
    ReturnType<typeof graph.InterestBatch>
  >["interestBatch"]
>;

type SubgraphHookOptions = {
  refetchInterval?: number;
};

function prepareOptions(options?: SubgraphHookOptions) {
  return {
    refetchInterval: DATA_REFRESH_INTERVAL,
    ...options,
  };
}

export function useTroveCount(account?: Address, collIndex?: CollIndex, options?: SubgraphHookOptions) {
  const { refetchInterval } = prepareOptions(options);
  return useQuery({
    queryKey: ["TrovesCount", account, collIndex],
    queryFn: DEMO_MODE
      ? async () => {
        if (!account) {
          return null;
        }
        return Object.values(ACCOUNT_POSITIONS)
          .filter(isPositionLoanCommitted)
          .length;
      }
      : async () => {
        if (!account) {
          return null;
        }
        const { borrowerInfo } = await graph.TrovesCount({ id: account.toLowerCase() });
        return collIndex === undefined
          ? borrowerInfo?.troves ?? 0
          : borrowerInfo?.trovesByCollateral[collIndex] ?? null;
      },
    refetchInterval,
  });
}

export function useTotalDeposited(options?: SubgraphHookOptions) {
  const { refetchInterval } = prepareOptions(options);
  return useQuery({
    queryKey: ["TotalDeposited"],
    queryFn: DEMO_MODE
      ? () => Object.values(BORROW_STATS)
      : async () => {
        const { collaterals } = await graph.TotalDeposited();
        return collaterals.map(({ collIndex, totalDeposited }) => {
          if (!isCollIndex(collIndex)) {
            throw new Error(`Invalid collateral index: ${collIndex}`);
          }
          return {
            collIndex,
            totalDeposited: dnum18(totalDeposited),
          };
        });
      },
    refetchInterval,
  });
}

export function useLoansByAccount(account?: Address | null, options?: SubgraphHookOptions) {
  const { refetchInterval } = prepareOptions(options);
  return useQuery({
    queryKey: ["TrovesByAccount", account],
    queryFn: DEMO_MODE
      ? () => account ? ACCOUNT_POSITIONS.filter(isPositionLoanCommitted) : null
      : async () => {
        if (!account) {
          return null;
        }
        const { troves } = await graph.TrovesByAccount({ account });
        return troves.map(subgraphTroveToLoan);
      },
    refetchInterval,
  });
}

export function useInterestBatchDelegate(
  collIndex: null | CollIndex,
  address: null | Address,
  options?: SubgraphHookOptions,
) {
  const id = address && collIndex !== null ? `${collIndex}:${address.toLowerCase()}` : null;
  const { refetchInterval } = prepareOptions(options);
  return useQuery({
    queryKey: ["InterestBatch", id],
    queryFn: async () => {
      if (!id) {
        return null;
      }
      const { interestBatch } = await graph.InterestBatch({ id });
      if (!interestBatch || !isAddress(interestBatch.batchManager)) {
        return null;
      }
      return subgraphBatchToDelegate(interestBatch);
    },
    refetchInterval,
    enabled: id !== null,
  });
}

export function useLoanById(id?: null | PrefixedTroveId, options?: SubgraphHookOptions) {
  const { refetchInterval } = prepareOptions(options);
  return useQuery<PositionLoanCommitted | null>({
    queryKey: ["TroveById", id],
    queryFn: DEMO_MODE
      ? async () => {
        if (!isPrefixedtroveId(id)) {
          return null;
        }
        await sleep(500);
        for (const pos of ACCOUNT_POSITIONS) {
          if (isPositionLoanCommitted(pos) && `${pos.collIndex}:${pos.troveId}` === id) {
            return pos;
          }
        }
        return null;
      }
      : async () => {
        if (!isPrefixedtroveId(id)) {
          return null;
        }
        const { trove } = await graph.TroveById({ id });
        return trove ? subgraphTroveToLoan(trove) : null;
      },
    refetchInterval,
  });
}

export function useStabilityPoolDeposits(
  account: null | Address,
  options?: SubgraphHookOptions,
) {
  const { refetchInterval } = prepareOptions(options);
  return useQuery<GraphStabilityPoolDeposit[]>({
    queryKey: ["StabilityPoolDepositsByAccount", account],
    queryFn: DEMO_MODE
      ? async () => {
        if (!account) {
          return [];
        }
        return ACCOUNT_POSITIONS
          .filter((position) => position.type === "earn")
          .map((position) => ({
            id: `${position.collIndex}:${account}`.toLowerCase(),
            collateral: { collIndex: position.collIndex },
            deposit: position.deposit[0],
            depositor: account,
            snapshot: { B: 0n, P: 0n, S: 0n, epoch: 0n, scale: 0n },
          }));
      }
      : async () => {
        if (!account) {
          return [];
        }
        const { stabilityPoolDeposits } = await graph.StabilityPoolDepositsByAccount({ account });
        return stabilityPoolDeposits.map((deposit) => ({
          id: `${deposit.collateral.collIndex}:${account}`.toLowerCase(),
          collateral: deposit.collateral,
          deposit: BigInt(deposit.deposit),
          depositor: account,
          snapshot: {
            B: BigInt(deposit.snapshot.B),
            P: BigInt(deposit.snapshot.P),
            S: BigInt(deposit.snapshot.S),
            epoch: BigInt(deposit.snapshot.epoch),
            scale: BigInt(deposit.snapshot.scale),
          },
        }));
      },
    refetchInterval,
  });
}

export function useStabilityPoolDeposit(
  collIndex: null | number,
  account: null | Address,
  options?: SubgraphHookOptions,
) {
  const { refetchInterval } = prepareOptions(options);
  return useQuery<GraphStabilityPoolDeposit | null>({
    queryKey: ["StabilityPoolDeposit", account, collIndex],
    queryFn: DEMO_MODE
      ? async () => {
        if (account === null || collIndex === null) {
          return null;
        }
        const position = ACCOUNT_POSITIONS.find((position): position is PositionEarn => (
          position.type === "earn" && position.collIndex === collIndex
        ));
        return !position ? null : {
          id: `${collIndex}:${account}`.toLowerCase(),
          collateral: { collIndex },
          deposit: position.deposit[0],
          depositor: account,
          snapshot: { B: 0n, P: 0n, S: 0n, epoch: 0n, scale: 0n },
        };
      }
      : async () => {
        if (account === null || collIndex === null) {
          return null;
        }
        const { stabilityPoolDeposit } = await graph.StabilityPoolDeposit({
          id: `${collIndex}:${account}`.toLowerCase(),
        });
        return !stabilityPoolDeposit ? null : {
          id: `${collIndex}:${account}`.toLowerCase(),
          collateral: { collIndex },
          deposit: BigInt(stabilityPoolDeposit.deposit),
          depositor: account,
          snapshot: {
            B: BigInt(stabilityPoolDeposit.snapshot.B),
            P: BigInt(stabilityPoolDeposit.snapshot.P),
            S: BigInt(stabilityPoolDeposit.snapshot.S),
            epoch: BigInt(stabilityPoolDeposit.snapshot.epoch),
            scale: BigInt(stabilityPoolDeposit.snapshot.scale),
          },
        };
      },
    refetchInterval,
  });
}

export function useStabilityPool(collIndex?: number, options?: SubgraphHookOptions) {
  const { refetchInterval } = prepareOptions(options);
  return useQuery({
    queryKey: ["StabilityPool", collIndex],
    queryFn: DEMO_MODE
      ? async () => {
        return {
          apr: dnum18(0),
          totalDeposited: dnum18(0),
        };
      }
      : async () => {
        const { stabilityPool } = await graph.StabilityPool({ id: `${collIndex}` });
        return {
          apr: dnum18(0),
          totalDeposited: dnum18(stabilityPool?.totalDeposited ?? 0),
        };
      },
    refetchInterval,
  });
}

export function useStabilityPoolEpochScale(
  collIndex: null | number,
  epoch: null | bigint,
  scale: null | bigint,
  options?: SubgraphHookOptions,
) {
  const { refetchInterval } = prepareOptions(options);
  return useQuery<{ B: bigint; S: bigint }>({
    queryKey: ["StabilityPoolEpochScale", collIndex, String(epoch), String(scale)],
    queryFn: DEMO_MODE
      ? async () => ({ B: 0n, S: 0n })
      : async () => {
        const { stabilityPoolEpochScale } = await graph.StabilityPoolEpochScale({
          id: `${collIndex}:${epoch}:${scale}`,
        });
        return {
          B: BigInt(stabilityPoolEpochScale?.B ?? 0n),
          S: BigInt(stabilityPoolEpochScale?.S ?? 0n),
        };
      },
    refetchInterval,
  });
}

export function useEarnPositionsByAccount(account?: null | Address, options?: SubgraphHookOptions) {
  const { refetchInterval } = prepareOptions(options);
  return useQuery({
    queryKey: ["StabilityPoolDepositsByAccount", account],
    queryFn: DEMO_MODE
      ? () => account ? ACCOUNT_POSITIONS.filter((position) => position.type === "earn") : []
      : async () => {
        if (!account) {
          return null;
        }
        const { stabilityPoolDeposits } = await graph.StabilityPoolDepositsByAccount({ account });
        return stabilityPoolDeposits.map(subgraphStabilityPoolDepositToEarnPosition);
      },
    refetchInterval,
  });
}

export function useInterestRateBrackets(collIndex: null | CollIndex, options?: SubgraphHookOptions) {
  const { refetchInterval } = prepareOptions(options);
  return useQuery({
    queryKey: ["InterestRateBrackets", collIndex],
    queryFn: DEMO_MODE
      ? async () => {
        return [];
      }
      : async () => {
        if (collIndex === null) {
          return [];
        }
        const { interestRateBrackets } = await graph.InterestRateBrackets({ collId: String(collIndex) });
        return [...interestRateBrackets]
          .sort((a, b) => (a.rate > b.rate ? 1 : -1))
          .map((bracket) => ({
            rate: dnum18(bracket.rate),
            totalDebt: dnum18(bracket.totalDebt),
          }));
      },
    refetchInterval,
  });
}

function subgraphTroveToLoan(trove: GraphTrove): PositionLoanCommitted {
  if (!isTroveId(trove.troveId)) {
    throw new Error(`Invalid trove ID: ${trove.id} / ${trove.troveId}`);
  }

  const collIndex = trove.collateral.collIndex;
  if (!isCollIndex(collIndex)) {
    throw new Error(`Invalid collateral index: ${collIndex}`);
  }

  if (!isAddress(trove.borrower)) {
    throw new Error(`Invalid borrower: ${trove.borrower}`);
  }

  return {
    type: trove.usedLeverageZapper ? "leverage" : "borrow",
    batchManager: isAddress(trove.interestBatch?.batchManager) ? trove.interestBatch.batchManager : null,
    borrowed: dnum18(trove.debt),
    borrower: trove.borrower,
    collIndex,
    createdAt: Number(trove.createdAt) * 1000,
    deposit: dnum18(trove.deposit),
    interestRate: dnum18(trove.interestBatch?.annualInterestRate ?? trove.interestRate),
    troveId: trove.troveId,
    updatedAt: Number(trove.updatedAt) * 1000,
  };
}

function subgraphStabilityPoolDepositToEarnPosition(spDeposit: GraphStabilityPoolDeposit): PositionEarn {
  const collIndex = spDeposit.collateral.collIndex;
  if (!isCollIndex(collIndex)) {
    throw new Error(`Invalid collateral index: ${collIndex}`);
  }
  if (!isAddress(spDeposit.depositor)) {
    throw new Error(`Invalid depositor address: ${spDeposit.depositor}`);
  }
  return {
    type: "earn",
    owner: spDeposit.depositor,
    collIndex,
    deposit: dnum18(spDeposit.deposit),
    rewards: {
      bold: dnum18(0),
      coll: dnum18(0),
    },
  };
}

function subgraphBatchToDelegate(batch: GraphInterestBatch): Delegate {
  if (!isAddress(batch.batchManager)) {
    throw new Error(`Invalid batch manager: ${batch.batchManager}`);
  }
  return {
    id: batch.batchManager,
    address: batch.batchManager,
    name: shortenAddress(batch.batchManager, 4),
    interestRate: dnum18(batch.annualInterestRate),
    followers: 0,
    boldAmount: dnum18(batch.debt),
    lastDays: 0,
    redemptions: dnum18(0),
    interestRateChange: [dn.from(0.015), dn.from(0.05)],
    fee: dnum18(batch.annualManagementFee),
  };
}
