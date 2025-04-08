// TODO: Remove this file and move the hooks into liquity-*.ts files instead,
// since some need to do more than just fetch data from the subgraph.

import type { StabilityPoolDepositQuery as StabilityPoolDepositQueryType } from "@/src/graphql/graphql";
import type { Address, BranchId, PositionEarn } from "@/src/types";

import { DATA_REFRESH_INTERVAL } from "@/src/constants";
import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { dnum18 } from "@/src/dnum-utils";
import { DEMO_MODE } from "@/src/env";
import { isBranchId, isPositionLoanCommitted } from "@/src/types";
import { isAddress } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  AllInterestRateBracketsQuery,
  BorrowerInfoQuery,
  GovernanceInitiatives,
  GovernanceStats,
  GovernanceUser,
  graphQuery,
  StabilityPoolDepositQuery,
  StabilityPoolDepositsByAccountQuery,
  StabilityPoolEpochScaleQuery,
} from "./subgraph-queries";

type Options = {
  refetchInterval?: number;
};

function prepareOptions(options?: Options): Options {
  return {
    refetchInterval: DATA_REFRESH_INTERVAL,
    ...options,
  };
}

export function useNextOwnerIndex(
  borrower: null | Address,
  branchId: null | BranchId,
  options?: Options,
) {
  let queryFn = async () => {
    if (!borrower || branchId === null) {
      return null;
    }

    const { borrowerInfo } = await graphQuery(
      BorrowerInfoQuery,
      { id: borrower.toLowerCase() },
    );

    // if borrowerInfo doesn’t exist, start at 0
    return borrowerInfo?.nextOwnerIndexes[branchId] ?? 0;
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
    queryKey: ["NextTroveId", borrower, branchId],
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
      { account: account.toLowerCase() },
    );
    return stabilityPoolDeposits.map((deposit) => ({
      id: `${deposit.collateral.collIndex}:${account}`.toLowerCase(),
      collateral: deposit.collateral,
      deposit: BigInt(deposit.deposit),
      depositor: account.toLowerCase(),
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
          id: `${position.branchId}:${account}`.toLowerCase(),
          collateral: { collIndex: position.branchId },
          deposit: position.deposit[0],
          depositor: account.toLowerCase(),
          snapshot: {
            B: 0n,
            P: 0n,
            S: 0n,
            epoch: 0n,
            scale: 0n,
          },
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
  branchId: null | number,
  account: null | Address,
  options?: Options,
) {
  let queryFn = async () => {
    if (account === null || branchId === null) return null;
    const { stabilityPoolDeposit } = await graphQuery(StabilityPoolDepositQuery, {
      id: `${branchId}:${account}`.toLowerCase(),
    });
    return !stabilityPoolDeposit ? null : {
      id: `${branchId}:${account}`.toLowerCase(),
      collateral: { collIndex: branchId },
      deposit: BigInt(stabilityPoolDeposit.deposit),
      depositor: account.toLowerCase(),
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
      if (account === null || branchId === null) return null;
      const position = ACCOUNT_POSITIONS.find(
        (position): position is PositionEarn => (
          position.type === "earn" && position.branchId === branchId
        ),
      );
      return !position ? null : {
        id: `${branchId}:${account}`.toLowerCase(),
        collateral: { collIndex: branchId },
        deposit: position.deposit[0],
        depositor: account.toLowerCase(),
        snapshot: {
          B: 0n,
          P: 0n,
          S: 0n,
          epoch: 0n,
          scale: 0n,
        },
      };
    };
  }

  return useQuery<
    | null
    | NonNullable<
      StabilityPoolDepositQueryType["stabilityPoolDeposit"]
    >
  >({
    queryKey: ["StabilityPoolDeposit", account, branchId],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useStabilityPoolEpochScale(
  branchId: null | number,
  epoch: null | bigint,
  scale: null | bigint,
  options?: Options,
) {
  let queryFn = async () => {
    const { stabilityPoolEpochScale } = await graphQuery(
      StabilityPoolEpochScaleQuery,
      { id: `${branchId}:${epoch}:${scale}` },
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
    queryKey: ["StabilityPoolEpochScale", branchId, String(epoch), String(scale)],
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
      { account: account.toLowerCase() },
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
  branchId: null | BranchId,
  options?: Options,
) {
  let queryFn = async () => (
    (await graphQuery(AllInterestRateBracketsQuery)).interestRateBrackets
  );

  if (DEMO_MODE) {
    queryFn = async () => [];
  }

  return useQuery({
    queryKey: ["AllInterestRateBrackets"],
    queryFn,
    select: useCallback((brackets: Awaited<ReturnType<typeof queryFn>>) => {
      return brackets
        .filter((bracket) => bracket.collateral.collIndex === branchId)
        .sort((a, b) => (a.rate > b.rate ? 1 : -1))
        .map((bracket) => ({
          rate: dnum18(bracket.rate),
          totalDebt: dnum18(bracket.totalDebt),
        }));
    }, [branchId]),
    ...prepareOptions(options),
  });
}

export function useAllInterestRateBrackets(
  options?: Options,
) {
  let queryFn = async () => (
    (await graphQuery(AllInterestRateBracketsQuery)).interestRateBrackets
  );

  if (DEMO_MODE) {
    queryFn = async () => [];
  }

  return useQuery({
    queryKey: ["AllInterestRateBrackets"],
    queryFn,
    select: useCallback((brackets: Awaited<ReturnType<typeof queryFn>>) => {
      const debtByRate: Map<string, bigint> = new Map();
      for (const bracket of brackets) {
        const key = String(bracket.rate);
        debtByRate.set(key, (debtByRate.get(key) ?? 0n) + BigInt(bracket.totalDebt));
      }
      return brackets
        .sort((a, b) => (a.rate > b.rate ? 1 : -1))
        .map((bracket) => {
          const totalDebt = debtByRate.get(String(bracket.rate));
          if (totalDebt === undefined) throw new Error();
          return {
            rate: dnum18(bracket.rate),
            totalDebt: dnum18(totalDebt),
          };
        });
    }, []),
    ...prepareOptions(options),
  });
}

export function useGovernanceInitiatives(options?: Options) {
  let queryFn = async () => {
    const { governanceInitiatives } = await graphQuery(GovernanceInitiatives);
    return governanceInitiatives.map((initiative) => initiative.id as Address);
  };

  if (DEMO_MODE) {
    queryFn = async () => [];
  }

  return useQuery({
    queryKey: ["GovernanceInitiatives"],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useGovernanceUser(account: Address | null, options?: Options) {
  let queryFn = async () => {
    if (!account) return null;
    const { governanceUser } = await graphQuery(GovernanceUser, {
      id: account.toLowerCase(),
    });
    if (!governanceUser) {
      return null;
    }
    return {
      ...governanceUser,
      id: governanceUser.id as Address,
      allocatedLQTY: BigInt(governanceUser.allocatedLQTY),
      stakedLQTY: BigInt(governanceUser.stakedLQTY),
      stakedOffset: BigInt(governanceUser.stakedOffset),
      allocations: governanceUser.allocations.map((allocation) => ({
        ...allocation,
        voteLQTY: BigInt(allocation.voteLQTY),
        vetoLQTY: BigInt(allocation.vetoLQTY),
        initiative: allocation.initiative.id as Address,
      })),
    };
  };

  // TODO: demo mode
  if (DEMO_MODE) {
    queryFn = async () => null;
  }

  return useQuery({
    queryKey: ["GovernanceUser", account],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useGovernanceStats(options?: Options) {
  let queryFn = async () => {
    const { governanceStats } = await graphQuery(GovernanceStats);
    return governanceStats && {
      ...governanceStats,
      totalLQTYStaked: BigInt(governanceStats.totalLQTYStaked),
      totalOffset: BigInt(governanceStats.totalOffset),
      totalInitiatives: BigInt(governanceStats.totalInitiatives),
    };
  };

  // TODO: demo mode
  if (DEMO_MODE) {
    queryFn = async () => null;
  }

  return useQuery({
    queryKey: ["GovernanceStats"],
    queryFn,
    ...prepareOptions(options),
  });
}

function subgraphStabilityPoolDepositToEarnPosition(
  spDeposit: NonNullable<
    StabilityPoolDepositQueryType["stabilityPoolDeposit"]
  >,
): PositionEarn {
  const branchId = spDeposit.collateral.collIndex;
  if (!isBranchId(branchId)) {
    throw new Error(`Invalid branch: ${branchId}`);
  }
  if (!isAddress(spDeposit.depositor)) {
    throw new Error(`Invalid depositor address: ${spDeposit.depositor}`);
  }
  return {
    type: "earn",
    owner: spDeposit.depositor,
    branchId,
    deposit: dnum18(0),
    rewards: {
      bold: dnum18(0),
      coll: dnum18(0),
    },
  };
}
