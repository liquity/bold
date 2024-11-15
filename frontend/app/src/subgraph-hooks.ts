import type {
  InterestBatchQuery as InterestBatchQueryType,
  StabilityPoolDepositQuery as StabilityPoolDepositQueryType,
  TrovesByAccountQuery as TrovesByAccountQueryType,
} from "@/src/graphql/graphql";
import type { Address, CollIndex, Delegate, PositionEarn, PositionLoanCommitted, PrefixedTroveId } from "@/src/types";

import { DATA_REFRESH_INTERVAL } from "@/src/constants";
import { ACCOUNT_POSITIONS, BORROW_STATS } from "@/src/demo-mode";
import { dnum18 } from "@/src/dnum-utils";
import { DEMO_MODE } from "@/src/env";
import { isCollIndex, isPositionLoanCommitted, isPrefixedtroveId, isTroveId } from "@/src/types";
import { sleep } from "@/src/utils";
import { isAddress, shortenAddress } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import {
  graphQuery,
  InterestBatchQuery,
  InterestRateBracketsQuery,
  StabilityPoolDepositQuery,
  StabilityPoolDepositsByAccountQuery,
  StabilityPoolEpochScaleQuery,
  StabilityPoolQuery,
  TotalDepositedQuery,
  TroveByIdQuery,
  TrovesByAccountQuery,
  TrovesCountQuery,
} from "./subgraph-queries";

type Options = {
  refetchInterval?: number;
};

function prepareOptions(options?: Options) {
  return {
    refetchInterval: DATA_REFRESH_INTERVAL,
    ...options,
  };
}

export function useTrovesCount(
  borrower: null | Address,
  collIndex?: CollIndex,
  options?: Options,
) {
  let queryFn = async () => {
    if (!borrower) {
      return null;
    }
    const { borrowerInfo } = await graphQuery(
      TrovesCountQuery,
      { id: borrower },
    );
    return collIndex === undefined
      ? borrowerInfo?.troves ?? 0
      : borrowerInfo?.trovesByCollateral[collIndex] ?? null;
  };

  if (DEMO_MODE) {
    queryFn = async () => (
      borrower
        ? Object.values(ACCOUNT_POSITIONS)
          .filter(isPositionLoanCommitted)
          .length
        : null
    );
  }

  return useQuery({
    queryKey: ["TrovesCount", borrower, collIndex],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useTotalDeposited(options?: Options) {
  let queryFn = async () => {
    const { collaterals } = await graphQuery(TotalDepositedQuery);
    return collaterals.map(({ collIndex, totalDeposited }) => {
      if (!isCollIndex(collIndex)) {
        throw new Error(`Invalid collateral index: ${collIndex}`);
      }
      return {
        collIndex,
        totalDeposited: dnum18(totalDeposited),
      };
    });
  };

  if (DEMO_MODE) {
    queryFn = async () => Object.values(BORROW_STATS);
  }

  return useQuery({
    queryKey: ["TotalDeposited"],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useLoansByAccount(
  account?: Address | null,
  options?: Options,
) {
  let queryFn = async () => {
    if (!account) return null;
    const { troves } = await graphQuery(TrovesByAccountQuery, { account });
    return troves.map(subgraphTroveToLoan);
  };

  if (DEMO_MODE) {
    queryFn = async () =>
      account
        ? ACCOUNT_POSITIONS.filter(isPositionLoanCommitted)
        : null;
  }

  return useQuery({
    queryKey: ["TrovesByAccount", account],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useInterestBatchDelegate(
  collIndex: null | CollIndex,
  address: null | Address,
  options?: Options,
) {
  const id = address && collIndex !== null
    ? `${collIndex}:${address.toLowerCase()}`
    : null;

  let queryFn = async () => {
    if (!id) return null;
    const { interestBatch } = await graphQuery(InterestBatchQuery, { id });
    return isAddress(interestBatch?.batchManager)
      ? subgraphBatchToDelegate(interestBatch)
      : null;
  };

  if (DEMO_MODE) {
    queryFn = async () => null;
  }

  return useQuery({
    queryKey: ["InterestBatch", id],
    queryFn,
    ...prepareOptions(options),
    enabled: id !== null,
  });
}

export function useLoanById(
  id?: null | PrefixedTroveId,
  options?: Options,
) {
  let queryFn = async () => {
    if (!isPrefixedtroveId(id)) return null;
    const { trove } = await graphQuery(TroveByIdQuery, { id });
    return trove ? subgraphTroveToLoan(trove) : null;
  };

  if (DEMO_MODE) {
    queryFn = async () => {
      if (!isPrefixedtroveId(id)) return null;
      await sleep(500);
      for (const pos of ACCOUNT_POSITIONS) {
        if (isPositionLoanCommitted(pos) && `${pos.collIndex}:${pos.troveId}` === id) {
          return pos;
        }
      }
      return null;
    };
  }

  return useQuery<PositionLoanCommitted | null>({
    queryKey: ["TroveById", id],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useStabilityPoolDeposits(
  account: null | Address,
  options?: Options,
) {
  let queryFn = async () => {
    if (!account) return [];
    const { stabilityPoolDeposits } = await graphQuery(
      StabilityPoolDepositsByAccountQuery,
      { account },
    );
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
  };

  if (DEMO_MODE) {
    queryFn = async () => {
      if (!account) return [];
      return ACCOUNT_POSITIONS
        .filter((position) => position.type === "earn")
        .map((position) => ({
          id: `${position.collIndex}:${account}`.toLowerCase(),
          collateral: { collIndex: position.collIndex },
          deposit: position.deposit[0],
          depositor: account,
          snapshot: { B: 0n, P: 0n, S: 0n, epoch: 0n, scale: 0n },
        }));
    };
  }

  return useQuery<NonNullable<
    StabilityPoolDepositQueryType["stabilityPoolDeposit"]
  >[]>({
    queryKey: ["StabilityPoolDepositsByAccount", account],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useStabilityPoolDeposit(
  collIndex: null | number,
  account: null | Address,
  options?: Options,
) {
  let queryFn = async () => {
    if (account === null || collIndex === null) return null;
    const { stabilityPoolDeposit } = await graphQuery(StabilityPoolDepositQuery, {
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
  };

  if (DEMO_MODE) {
    queryFn = async () => {
      if (account === null || collIndex === null) return null;
      const position = ACCOUNT_POSITIONS.find(
        (position): position is PositionEarn => (
          position.type === "earn" && position.collIndex === collIndex
        ),
      );
      return !position ? null : {
        id: `${collIndex}:${account}`.toLowerCase(),
        collateral: { collIndex },
        deposit: position.deposit[0],
        depositor: account,
        snapshot: { B: 0n, P: 0n, S: 0n, epoch: 0n, scale: 0n },
      };
    };
  }

  return useQuery<
    | null
    | NonNullable<
      StabilityPoolDepositQueryType["stabilityPoolDeposit"]
    >
  >({
    queryKey: ["StabilityPoolDeposit", account, collIndex],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useStabilityPool(
  collIndex?: number,
  options?: Options,
) {
  let queryFn = async () => {
    const { stabilityPool } = await graphQuery(
      StabilityPoolQuery,
      { id: `${collIndex}` },
    );
    return {
      apr: dnum18(0),
      totalDeposited: dnum18(stabilityPool?.totalDeposited ?? 0),
    };
  };

  if (DEMO_MODE) {
    queryFn = async () => ({
      apr: dnum18(0),
      totalDeposited: dnum18(0),
    });
  }

  return useQuery({
    queryKey: ["StabilityPool", collIndex],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useStabilityPoolEpochScale(
  collIndex: null | number,
  epoch: null | bigint,
  scale: null | bigint,
  options?: Options,
) {
  let queryFn = async () => {
    const { stabilityPoolEpochScale } = await graphQuery(
      StabilityPoolEpochScaleQuery,
      { id: `${collIndex}:${epoch}:${scale}` },
    );
    return {
      B: BigInt(stabilityPoolEpochScale?.B ?? 0n),
      S: BigInt(stabilityPoolEpochScale?.S ?? 0n),
    };
  };

  if (DEMO_MODE) {
    queryFn = async () => ({ B: 0n, S: 0n });
  }

  return useQuery<{ B: bigint; S: bigint }>({
    queryKey: ["StabilityPoolEpochScale", collIndex, String(epoch), String(scale)],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useEarnPositionsByAccount(
  account?: null | Address,
  options?: Options,
) {
  let queryFn = async () => {
    if (!account) return null;
    const { stabilityPoolDeposits } = await graphQuery(
      StabilityPoolDepositsByAccountQuery,
      { account },
    );
    return stabilityPoolDeposits.map(subgraphStabilityPoolDepositToEarnPosition);
  };

  if (DEMO_MODE) {
    queryFn = async () =>
      account
        ? ACCOUNT_POSITIONS.filter((position) => position.type === "earn")
        : null;
  }

  return useQuery({
    queryKey: ["StabilityPoolDepositsByAccount", account],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useInterestRateBrackets(
  collIndex: null | CollIndex,
  options?: Options,
) {
  let queryFn = async () => {
    if (collIndex === null) return [];
    const { interestRateBrackets } = await graphQuery(
      InterestRateBracketsQuery,
      { collId: String(collIndex) },
    );
    return [...interestRateBrackets]
      .sort((a, b) => (a.rate > b.rate ? 1 : -1))
      .map((bracket) => ({
        rate: dnum18(bracket.rate),
        totalDebt: dnum18(bracket.totalDebt),
      }));
  };

  if (DEMO_MODE) {
    queryFn = async () => [];
  }

  return useQuery({
    queryKey: ["InterestRateBrackets", collIndex],
    queryFn,
    ...prepareOptions(options),
  });
}

function subgraphTroveToLoan(
  trove: TrovesByAccountQueryType["troves"][number],
): PositionLoanCommitted {
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
    batchManager: isAddress(trove.interestBatch?.batchManager)
      ? trove.interestBatch.batchManager
      : null,
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

function subgraphStabilityPoolDepositToEarnPosition(
  spDeposit: NonNullable<
    StabilityPoolDepositQueryType["stabilityPoolDeposit"]
  >,
): PositionEarn {
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

function subgraphBatchToDelegate(
  batch: NonNullable<
    InterestBatchQueryType["interestBatch"]
  >,
): Delegate {
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
