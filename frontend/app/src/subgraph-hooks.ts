// TODO: Remove this file and move the hooks into liquity-*.ts files instead,
// since some need to do more than just fetch data from the subgraph.

import type { Address, BranchId } from "@/src/types";

import { DATA_REFRESH_INTERVAL } from "@/src/constants";
import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { dnum18 } from "@/src/dnum-utils";
import { DEMO_MODE } from "@/src/env";
import { isPositionLoanCommitted } from "@/src/types";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  AllInterestRateBracketsQuery,
  BorrowerInfoQuery,
  GovernanceInitiatives,
  GovernanceStats,
  graphQuery,
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
