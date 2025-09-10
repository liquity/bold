import type {
  InterestBatchQuery as InterestBatchQueryType,
  TrovesByAccountQuery as TrovesByAccountQueryType,
} from "@/src/graphql/graphql";
import type { Address, CollIndex, Delegate, PositionEarn, PositionLoanCommitted, PrefixedTroveId, ReturnCombinedTroveReadCallData, ReturnTroveReadCallData } from "@/src/types";

import { DATA_REFRESH_INTERVAL } from "@/src/constants";
import { ACCOUNT_POSITIONS } from "@/src/demo-mode";
import { dnum18 } from "@/src/dnum-utils";
import { DEMO_MODE, SUBGRAPH_URL } from "@/src/env";
import { isCollIndex, isPositionLoanCommitted, isPrefixedtroveId, isTroveId, TroveStatus } from "@/src/types";
import { sleep } from "@/src/utils";
import { isAddress, shortenAddress } from "@liquity2/uikit";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import { useCallback } from "react";
import {
  AllInterestRateBracketsQuery,
  BorrowerInfoQuery,
  GovernanceInitiatives,
  GovernanceStats,
  GovernanceUser,
  graphQuery,
  InterestBatchQuery,
  StabilityPoolDepositQuery,
  StabilityPoolDepositsByAccountQuery,
  StabilityPoolScaleQuery,
  // StabilityPoolEpochScaleQuery,
  StabilityPoolsQuery,
  TroveByIdQuery,
  TrovesByAccountQuery,
  TrovesByAccountsQuery,
} from "./subgraph-queries";
import { getContracts } from "./contracts";
import { getAllDebtPerInterestRate, getTroveById, getTrovesByAccount } from "./liquity-read-calls";
import { useSubgraphStatus } from "./services/SubgraphStatus";

type Options = {
  refetchInterval?: number;
};

function prepareOptions(options?: Options) {
  return {
    refetchInterval: DATA_REFRESH_INTERVAL,
    ...options,
  };
}

export function useNextOwnerIndex(
  borrower: null | Address,
  collIndex: null | CollIndex,
  options?: Options,
) {
  let queryFn = async () => {
    if (!borrower || collIndex === null) {
      return null;
    }

    const { borrowerInfo } = await graphQuery(
      BorrowerInfoQuery,
      { id: borrower.toLowerCase() },
    );

    // if borrowerInfo doesn’t exist, start at 0
    return borrowerInfo?.nextOwnerIndexes[collIndex] ?? 0;
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
    queryKey: ["NextTroveId", borrower, collIndex],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useLoansByAccount(
  account?: Address | null,
  options?: Options,
) {
  const { setError, clearError } = useSubgraphStatus();
  let queryFn = async () => {
    if (!account) return null;
    try {
      const { troves } = await graphQuery(
        TrovesByAccountQuery,
        { account: account.toLowerCase() },
      );
      clearError("trovesByAccount");
      return troves.map(subgraphTroveToLoan);
    } catch (error) {
      setError("trovesByAccount", error as Error);
      console.error("Error fetching troves by account from the subgraph, using read calls instead\n\n", error);
      const troves = await getTrovesByAccount(account);
      return troves.map(readCallTroveToLoan);
    }
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

export function useLoansByAccounts(
  accounts?: Address[],
  options?: Options,
) {
  let queryFn = async () => {
    if (!accounts || accounts.length === 0) return null;
    const { troves } = await graphQuery(
      TrovesByAccountsQuery,
      { accounts: accounts.map(account => account.toLowerCase()) },
    );
    return troves.map(subgraphTroveToLoan);
  }

  return useQuery({
    queryKey: ["TrovesByAccounts", accounts],
    queryFn,
    ...prepareOptions(options),
  });
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
    boldAmount: dnum18(batch.debt),
    interestRateChange: [dn.from(0.015), dn.from(0.05)],
    fee: dnum18(batch.annualManagementFee),

    // not available in the subgraph yet
    followers: 0,
    lastDays: 0,
    redemptions: dnum18(0),
  };
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
  const { setError, clearError } = useSubgraphStatus();
  let queryFn = async () => {
    if (!isPrefixedtroveId(id)) return null;
    try {
      const { trove } = await graphQuery(TroveByIdQuery, { id });
      clearError("troveById");
      return trove ? subgraphTroveToLoan(trove) : null;
    } catch (error) {
      setError("troveById", error as Error);
      console.error("Error fetching trove by id from the subgraph, using read calls instead\n\n", error);
      const trove = await getTroveById(id);
      return trove ? readCallTroveToLoan(trove) : null;
    }
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
        // epoch: BigInt(deposit.snapshot.epoch),
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
          depositor: account.toLowerCase(),
          snapshot: {
            B: 0n,
            P: 0n,
            S: 0n,
            // epoch: 0n,
            scale: 0n,
          },
        }));
    };
  }

  return useQuery<{
    id: string;
    collateral: { collIndex: number };
    deposit: bigint;
    depositor: string;
    snapshot: {
      B: bigint;
      P: bigint;
      S: bigint;
      scale: bigint;
    };
  }[]>({
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
      depositor: account.toLowerCase(),
      snapshot: {
        B: BigInt(stabilityPoolDeposit.snapshot.B),
        P: BigInt(stabilityPoolDeposit.snapshot.P),
        S: BigInt(stabilityPoolDeposit.snapshot.S),
        // epoch: BigInt(stabilityPoolDeposit.snapshot.epoch),
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
        depositor: account.toLowerCase(),
        snapshot: {
          B: 0n,
          P: 0n,
          S: 0n,
          // epoch: 0n,
          scale: 0n,
        },
      };
    };
  }

  return useQuery<
    | null
    | {
        id: string;
        collateral: { collIndex: number };
        deposit: bigint;
        depositor: string;
        snapshot: {
          B: bigint;
          P: bigint;
          S: bigint;
          scale: bigint;
        };
      }
  >({
    queryKey: ["StabilityPoolDeposit", account, collIndex],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useStabilityPool(
  collIndex?: null | number,
  options?: Options,
) {
  let queryFn = async () => {
    const { stabilityPools } = await graphQuery(
      StabilityPoolsQuery,
    );
    return stabilityPools.map((stabilityPool) => ({
      collIndex: parseInt(stabilityPool.id, 10),
      apr: dnum18(0),
      totalDeposited: dnum18(stabilityPool.totalDeposited),
    }));
  };

  if (DEMO_MODE) {
    queryFn = async () =>
      Array.from({ length: 10 }, (_, collIndex) => ({
        collIndex,
        apr: dnum18(0),
        totalDeposited: dnum18(0),
      }));
  }

  return useQuery({
    queryKey: ["StabilityPool"],
    queryFn,
    select: (pools) => {
      if (typeof collIndex !== "number") {
        return null;
      }
      const pool = pools.find((pool) => pool.collIndex === collIndex);
      if (pool === undefined) {
        throw new Error(`Stability pool not found: ${collIndex}`);
      }
      return pool;
    },
    ...prepareOptions(options),
  });
}

export function useStabilityPoolScale(
  collIndex: null | number,
  // epoch: null | bigint,
  scale: null | bigint,
  options?: Options,
) {
  let queryFn = async () => {
    const { stabilityPoolScale } = await graphQuery(
      StabilityPoolScaleQuery,
      { id: `${collIndex}:${scale}` },
    );
    return {
      B: BigInt(stabilityPoolScale?.B ?? 0n),
      S: BigInt(stabilityPoolScale?.S ?? 0n),
    };
  };

  if (DEMO_MODE) {
    queryFn = async () => ({ B: 0n, S: 0n });
  }

  return useQuery<{ B: bigint; S: bigint }>({
    queryKey: ["StabilityPoolScale", collIndex, String(scale)],
    queryFn,
    ...prepareOptions(options),
  });
}

// export function useEarnPositionsByAccount(
//   account?: null | Address,
//   options?: Options,
// ) {
//   let queryFn = async () => {
//     if (!account) return null;
//     const { stabilityPoolDeposits } = await graphQuery(
//       StabilityPoolDepositsByAccountQuery,
//       { account: account.toLowerCase() },
//     );
//     return stabilityPoolDeposits.map(subgraphStabilityPoolDepositToEarnPosition);
//   };

//   if (DEMO_MODE) {
//     queryFn = async () =>
//       account
//         ? ACCOUNT_POSITIONS.filter((position) => position.type === "earn")
//         : null;
//   }

//   return useQuery({
//     queryKey: ["StabilityPoolDepositsByAccount", account],
//     queryFn,
//     ...prepareOptions(options),
//   });
// }

export function useInterestRateBrackets(
  collIndex: null | CollIndex,
  options?: Options,
) {
  const { setError, clearError } = useSubgraphStatus();
  const { collaterals } = getContracts();

  let queryFn = async () => {
    try {
      const brackets = (await graphQuery(AllInterestRateBracketsQuery)).interestRateBrackets
      clearError("allInterestRateBrackets");
      return brackets;
    } catch (error) {
      setError("allInterestRateBrackets", error as Error);
      console.error("Error fetching interest rate brackets from the subgraph, using read calls instead\n\n", error);
      const debtPerInterestRate = await getAllDebtPerInterestRate();
      return Object.entries(debtPerInterestRate).flatMap(([collIndex, list]) => {
        return list.map((data) => ({
          rate: data.interestRate,
          totalDebt: data.debt,
          collateral: collaterals[Number(collIndex) as CollIndex]!,
        }));
      });
    }
  };

  if (DEMO_MODE) {
    queryFn = async () => [];
  }

  return useQuery({
    queryKey: ["AllInterestRateBrackets"],
    queryFn,
    select: useCallback((brackets: Awaited<ReturnType<typeof queryFn>>) => {
      // only filter by collIndex in the select()
      // so that we can query all the brackets at once
      return brackets
        .filter((bracket) => bracket.collateral.collIndex === collIndex)
        .sort((a, b) => (a.rate > b.rate ? 1 : -1))
        .map((bracket) => ({
          rate: dnum18(bracket.rate),
          totalDebt: dnum18(bracket.totalDebt),
        }));
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
    return governanceStats;
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

export function useTroveCount(options?: Options) {
  let queryFn = async () => {
    // Manual GraphQL query to avoid codegen issues
    const query = `
      query TroveStats {
        troves(where: { status: active }) {
          id
          collateral {
            collIndex
          }
        }
      }
    `;
    
    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/graphql-response+json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error("Error while fetching trove count from the subgraph");
    }

    const result = await response.json();
    if (!result.data) {
      throw new Error("Invalid response from the subgraph");
    }

    // Count troves by collateral index
    const countByCollateral: Record<number, number> = {};
    
    for (const trove of result.data.troves) {
      const collIndex = trove.collateral.collIndex;
      countByCollateral[collIndex] = (countByCollateral[collIndex] || 0) + 1;
    }
    
    // Return total count across all collaterals
    return Object.values(countByCollateral).reduce((sum, count) => sum + count, 0);
  };

  if (DEMO_MODE) {
    queryFn = async () => {
      return ACCOUNT_POSITIONS.filter(isPositionLoanCommitted).length;
    };
  }

  return useQuery({
    queryKey: ["TroveCount"],
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
    type: trove.mightBeLeveraged ? "multiply" : "borrow",
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
    status: trove.status,
  };
}

function readCallTroveToLoan(
  trove: ReturnCombinedTroveReadCallData | ReturnTroveReadCallData,
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
    // type: trove.mightBeLeveraged ? "multiply" : "borrow",
    type: "borrow", // TODO: replace with real value
    batchManager: isAddress(trove.interestBatch?.batchManager)
      ? trove.interestBatch.batchManager
      : null,
    borrowed: dnum18(trove.debt),
    borrower: trove.borrower,
    collIndex,
    // createdAt: Number(trove.createdAt) * 1000,
    createdAt: 0, // TODO: replace with real value
    deposit: dnum18(trove.deposit),
    interestRate: dnum18(trove.interestBatch?.annualInterestRate ?? trove.interestRate),
    troveId: trove.troveId,
    // updatedAt: Number(trove.updatedAt) * 1000,
    updatedAt: 0, // TODO: replace with real value
    // status: trove.status,
    status: enumToLoanStatus(trove.status),
  };
}

export function enumToLoanStatus(status: TroveStatus): "active" | "closed" | "liquidated" | "redeemed" {
  switch (status) {
    case TroveStatus.active:
      return "active";
    case TroveStatus.closedByOwner:
      return "closed";
    case TroveStatus.closedByLiquidation:
      return "liquidated";
    case TroveStatus.zombie:
      return "redeemed";
    default:
      return "closed"; // loan is non-existent so we'll pretend it's closed
  }
}

// function subgraphStabilityPoolDepositToEarnPosition(
//   spDeposit: NonNullable<
//     StabilityPoolDepositQueryType["stabilityPoolDeposit"]
//   >,
// ): PositionEarn {
//   const collIndex = spDeposit.collateral.collIndex;
//   if (!isCollIndex(collIndex)) {
//     throw new Error(`Invalid collateral index: ${collIndex}`);
//   }
//   if (!isAddress(spDeposit.depositor)) {
//     throw new Error(`Invalid depositor address: ${spDeposit.depositor}`);
//   }
//   return {
//     type: "earn",
//     owner: spDeposit.depositor,
//     collIndex,
//     deposit: dnum18(spDeposit.deposit),
//     rewards: {
//       usnd: dnum18(0),
//       coll: dnum18(0),
//     },
//   };
// }
