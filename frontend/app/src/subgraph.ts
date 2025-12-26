import * as dn from "dnum";

import type { TypedDocumentString } from "@/src/graphql/graphql";
import type { Address, BranchId, Dnum, TroveId, TroveStatus } from "@/src/types";

import { ONE_YEAR_D18 } from "@/src/constants";
import { dnum18, dnum36 } from "@/src/dnum-utils";
import { SUBGRAPH_URL } from "@/src/env";
import { graphql } from "@/src/graphql";
import { subgraphIndicator } from "@/src/indicators/subgraph-indicator";
import { getPrefixedTroveId } from "@/src/liquity-utils";

export type IndexedTrove = {
  id: string;
  borrower: Address;
  closedAt: number | null;
  createdAt: number;
  lastUserActionAt: number;
  updatedAt: number;
  mightBeLeveraged: boolean;
  status: TroveStatus;
  debt: Dnum;
  redemptionCount: number;
  redeemedColl: Dnum;
  redeemedDebt: Dnum;
  liquidatedColl: Dnum | null;
  liquidatedDebt: Dnum | null;
  collSurplus: Dnum | null;
  priceAtLiquidation: Dnum | null;
};

async function tryFetch(...args: Parameters<typeof fetch>) {
  try {
    return await fetch(...args);
  } catch {
    return null;
  }
}

async function graphQuery<TResult, TVariables>(
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
) {
  if (!SUBGRAPH_URL) {
    subgraphIndicator.setError("Subgraph not configured.");
    throw new Error("Subgraph URL not configured");
  }

  const response = await tryFetch(SUBGRAPH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/graphql-response+json",
    },
    body: JSON.stringify(
      { query, variables },
      (_, value) => typeof value === "bigint" ? String(value) : value,
    ),
  });

  if (response === null || !response.ok) {
    subgraphIndicator.setError("Subgraph error: unable to fetch data.");
    throw new Error("Error while fetching data from the subgraph");
  }

  const result = await response.json();

  if (!result.data) {
    console.error(result);
    subgraphIndicator.setError("Subgraph error: invalid response.");
    throw new Error("Invalid response from the subgraph");
  }

  // successful query: clear previous indicator errors
  subgraphIndicator.clearError();

  return result.data as TResult;
}

const BlockNumberQuery = graphql(`
  query BlockNumber {
    _meta {
      block {
        number
      }
    }
  }
`);

export async function getIndexedBlockNumber() {
  const result = await graphQuery(BlockNumberQuery);
  return BigInt(result._meta?.block.number ?? -1);
}

const NextOwnerIndexesByBorrowerQuery = graphql(`
  query NextOwnerIndexesByBorrower($id: ID!) {
    borrowerInfo(id: $id) {
      nextOwnerIndexes
    }
  }
`);

export async function getNextOwnerIndex(
  branchId: BranchId,
  borrower: Address,
): Promise<number> {
  const { borrowerInfo } = await graphQuery(
    NextOwnerIndexesByBorrowerQuery,
    { id: borrower.toLowerCase() },
  );
  return Number(borrowerInfo?.nextOwnerIndexes[branchId] ?? 0);
}

const TrovesByAccountQuery = graphql(`
  query TrovesByAccount($account: Bytes!) {
    troves(
      where: {
        or: [
          { previousOwner: $account, status: liquidated },
          { borrower: $account, status_in: [active, redeemed] }
        ],
      }
      orderBy: updatedAt
      orderDirection: desc
    ) {
      id
      closedAt
      createdAt
      lastUserActionAt
      updatedAt
      mightBeLeveraged
      status
      debt
      redemptionCount
      redeemedColl
      redeemedDebt
      liquidatedColl
      liquidatedDebt
      collSurplus
      priceAtLiquidation
    }
  }
`);

export async function getIndexedTrovesByAccount(account: Address): Promise<IndexedTrove[]> {
  const { troves } = await graphQuery(TrovesByAccountQuery, {
    account: account.toLowerCase(),
  });
  return troves.map((trove) => ({
    id: trove.id,
    borrower: account,
    // TODO: eliminate conversion to milliseconds
    closedAt: trove.closedAt === null || trove.closedAt === undefined
      ? null
      : Number(trove.closedAt) * 1000,
    createdAt: Number(trove.createdAt) * 1000,
    lastUserActionAt: Number(trove.lastUserActionAt) * 1000,
    updatedAt: Number(trove.updatedAt) * 1000,
    mightBeLeveraged: trove.mightBeLeveraged,
    status: trove.status,
    debt: dnum18(trove.debt),
    redemptionCount: trove.redemptionCount,
    redeemedColl: dnum18(trove.redeemedColl),
    redeemedDebt: dnum18(trove.redeemedDebt),
    liquidatedColl: dnum18(trove.liquidatedColl),
    liquidatedDebt: dnum18(trove.liquidatedDebt),
    collSurplus: dnum18(trove.collSurplus),
    priceAtLiquidation: dnum18(trove.priceAtLiquidation),
  }));
}

const TroveByIdQuery = graphql(`
  query TroveById($id: ID!) {
    trove(id: $id) {
      id
      borrower
      closedAt
      createdAt
      lastUserActionAt
      updatedAt
      mightBeLeveraged
      previousOwner
      status
      debt
      redemptionCount
      redeemedColl
      redeemedDebt
      liquidatedColl
      liquidatedDebt
      collSurplus
      priceAtLiquidation
    }
  }
`);

export async function getIndexedTroveById(
  branchId: BranchId,
  troveId: TroveId,
): Promise<IndexedTrove | null> {
  const prefixedTroveId = getPrefixedTroveId(branchId, troveId);
  const { trove } = await graphQuery(TroveByIdQuery, { id: prefixedTroveId });
  return !trove ? null : {
    id: trove.id,
    borrower: (
      trove.status === "liquidated" ? trove.previousOwner : trove.borrower
    ) as Address,
    closedAt: trove.closedAt === null || trove.closedAt === undefined
      ? null
      : Number(trove.closedAt) * 1000,
    createdAt: Number(trove.createdAt) * 1000,
    lastUserActionAt: Number(trove.lastUserActionAt) * 1000,
    updatedAt: Number(trove.updatedAt) * 1000,
    mightBeLeveraged: trove.mightBeLeveraged,
    status: trove.status,
    debt: dnum18(trove.debt),
    redemptionCount: trove.redemptionCount,
    redeemedColl: dnum18(trove.redeemedColl),
    redeemedDebt: dnum18(trove.redeemedDebt),
    liquidatedColl: dnum18(trove.liquidatedColl),
    liquidatedDebt: dnum18(trove.liquidatedDebt),
    collSurplus: dnum18(trove.collSurplus),
    priceAtLiquidation: dnum18(trove.priceAtLiquidation),
  };
}

const InterestBatchesQuery = graphql(`
  query InterestBatches($ids: [ID!]!) {
    interestBatches(where: { id_in: $ids }) {
      collateral {
        collIndex
      }
      batchManager
      debt
      coll
      annualInterestRate
      annualManagementFee
    }
  }
`);

export async function getInterestBatches(
  branchId: BranchId,
  batchAddresses: Address[],
) {
  const { interestBatches } = await graphQuery(InterestBatchesQuery, {
    ids: batchAddresses.map((addr) => `${branchId}:${addr.toLowerCase()}`),
  });

  return interestBatches.map((batch) => ({
    batchManager: batch.batchManager as Address,
    debt: dnum18(batch.debt),
    coll: dnum18(batch.coll),
    interestRate: dnum18(batch.annualInterestRate),
    fee: dnum18(batch.annualManagementFee),
  }));
}

const AllInterestRateBracketsQuery = graphql(`
  query AllInterestRateBrackets {
    interestRateBrackets(
      first: 1000
      where: { totalDebt_gt: 0 }
      orderBy: rate
    ) {
      collateral {
        collIndex
      }
      rate
      totalDebt
      sumDebtTimesRateD36
      pendingDebtTimesOneYearD36
      updatedAt
    }
  }
`);

export async function getAllInterestRateBrackets() {
  const result = await graphQuery(AllInterestRateBracketsQuery);

  const brackets = result.interestRateBrackets
    .map((bracket) => ({
      branchId: bracket.collateral.collIndex,
      rate: dnum18(bracket.rate),
      totalDebt: BigInt(bracket.totalDebt),
      sumDebtTimesRateD36: BigInt(bracket.sumDebtTimesRateD36),
      pendingDebtTimesOneYearD36: BigInt(bracket.pendingDebtTimesOneYearD36),
      updatedAt: BigInt(bracket.updatedAt),
    }))
    .sort((a, b) => dn.cmp(a.rate, b.rate));

  const lastUpdatedAt = brackets
    .map((bracket) => bracket.updatedAt)
    .reduce((a, b) => a > b ? a : b);

  return {
    lastUpdatedAt,

    brackets: brackets.map((bracket) => ({
      branchId: bracket.branchId,
      rate: bracket.rate,
      totalWeightedRate: dnum36(bracket.sumDebtTimesRateD36),

      totalDebt: (timestamp: bigint) => {
        if (timestamp < lastUpdatedAt) timestamp = lastUpdatedAt;

        return dnum18(
          bracket.totalDebt
            + (
                bracket.pendingDebtTimesOneYearD36
                + bracket.sumDebtTimesRateD36 * (timestamp - bracket.updatedAt)
              ) / ONE_YEAR_D18,
        );
      },
    })),
  };
}

const GovernanceGlobalDataQuery = graphql(`
  query GovernanceGlobalData {
    governanceInitiatives {
      id
    }

    governanceVotingPower(id: "total") {
      allocatedLQTY
      allocatedOffset
      unallocatedLQTY
      unallocatedOffset
    }
  }
`);

export interface GovernanceGlobalData {
  registeredInitiatives: Address[];
  totalVotingPower: {
    allocatedLQTY: bigint;
    allocatedOffset: bigint;
    unallocatedLQTY: bigint;
    unallocatedOffset: bigint;
  };
}

// get all the registered initiatives and total voting power
export async function getGovernanceGlobalData(): Promise<GovernanceGlobalData> {
  const { governanceInitiatives, governanceVotingPower } = await graphQuery(GovernanceGlobalDataQuery);
  return {
    registeredInitiatives: governanceInitiatives.map((initiative) => initiative.id as Address),

    totalVotingPower: {
      allocatedLQTY: BigInt(governanceVotingPower?.allocatedLQTY ?? 0),
      allocatedOffset: BigInt(governanceVotingPower?.allocatedOffset ?? 0),
      unallocatedLQTY: BigInt(governanceVotingPower?.unallocatedLQTY ?? 0),
      unallocatedOffset: BigInt(governanceVotingPower?.unallocatedOffset ?? 0),
    },
  };
}

const UserAllocationHistoryQuery = graphql(`
  query UserAllocationHistory($user: String) {
    governanceAllocations(
      where: { user: $user }
      orderBy: epoch
      orderDirection: desc
      first: 1000
    ) {
      epoch
      initiative { id }
      voteLQTY
      vetoLQTY
      voteOffset
      vetoOffset
    }
  }
`);

const TotalAllocationHistoryQuery = graphql(`
  query TotalAllocationHistory($initiative: String) {
    governanceAllocations(
      where: { initiative: $initiative, user: null }
      orderBy: epoch
      orderDirection: desc
      first: 1000
    ) {
      epoch
      voteLQTY
      vetoLQTY
      voteOffset
      vetoOffset
    }
  }
`);

// A user's allocation history ordered by descending epoch
export async function getUserAllocationHistoryFromSubgraph(user: Address) {
  const { governanceAllocations } = await graphQuery(UserAllocationHistoryQuery, {
    user: user.toLowerCase(),
  });

  return governanceAllocations.map((allocation) => ({
    epoch: Number(allocation.epoch),
    initiative: allocation.initiative.id,
    voteLQTY: BigInt(allocation.voteLQTY),
    vetoLQTY: BigInt(allocation.vetoLQTY),
    voteOffset: BigInt(allocation.voteOffset),
    vetoOffset: BigInt(allocation.vetoOffset),
  }));
}

// An initiative's total allocation history ordered by descending epoch
export async function getTotalAllocationHistoryFromSubgraph(initiative: Address) {
  const { governanceAllocations } = await graphQuery(TotalAllocationHistoryQuery, {
    initiative: initiative.toLowerCase(),
  });

  return governanceAllocations.map((allocation) => ({
    epoch: Number(allocation.epoch),
    voteLQTY: BigInt(allocation.voteLQTY),
    vetoLQTY: BigInt(allocation.vetoLQTY),
    voteOffset: BigInt(allocation.voteOffset),
    vetoOffset: BigInt(allocation.vetoOffset),
  }));
}
