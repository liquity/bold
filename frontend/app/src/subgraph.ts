import type { TypedDocumentString } from "@/src/graphql/graphql";
import type { Address, BranchId, TroveId } from "@/src/types";

import { dnum18 } from "@/src/dnum-utils";
import { SUBGRAPH_URL } from "@/src/env";
import { graphql } from "@/src/graphql";
import { getPrefixedTroveId } from "@/src/liquity-utils";

async function graphQuery<TResult, TVariables>(
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
) {
  const response = await fetch(SUBGRAPH_URL, {
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

  if (!response.ok) {
    throw new Error("Error while fetching data from the subgraph");
  }

  const result = await response.json();

  if (!result.data) {
    console.error(result);
    throw new Error("Invalid response from the subgraph");
  }

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

const NextOwnerIndexesByBorrower = graphql(`
  query BorrowerInfo($id: ID!) {
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
    NextOwnerIndexesByBorrower,
    { id: borrower.toLowerCase() },
  );
  return Number(borrowerInfo?.nextOwnerIndexes[branchId] ?? 0);
}

const TroveByAccountQuery = graphql(`
  query TroveStatusesByAccount($account: Bytes!) {
    troves(
      where: {
        borrower: $account,
        status_in: [active,redeemed,liquidated],
      }
      orderBy: updatedAt
      orderDirection: desc
    ) {
      id
      closedAt
      createdAt
      mightBeLeveraged
      status
    }
  }
`);

export async function getIndexedTrovesByAccount(
  account: Address,
): Promise<{
  id: string;
  closedAt: number | null;
  createdAt: number;
  mightBeLeveraged: boolean;
  status: string;
}[]> {
  const { troves } = await graphQuery(TroveByAccountQuery, {
    account: account.toLowerCase(),
  });
  return troves.map((trove) => ({
    id: trove.id,
    closedAt: trove.closedAt === null || trove.closedAt === undefined
      ? null
      : Number(trove.closedAt) * 1000,
    createdAt: Number(trove.createdAt) * 1000,
    mightBeLeveraged: trove.mightBeLeveraged,
    status: trove.status,
  }));
}

const TroveByIdQuery = graphql(`
  query TroveStatusById($id: ID!) {
    trove(id: $id) {
      id
      closedAt
      createdAt
      mightBeLeveraged
      status
    }
  }
`);

export async function getIndexedTroveById(branchId: BranchId, troveId: TroveId) {
  const prefixedTroveId = getPrefixedTroveId(branchId, troveId);
  const { trove } = await graphQuery(TroveByIdQuery, { id: prefixedTroveId });
  return !trove ? null : {
    id: trove.id,
    closedAt: trove.closedAt === null || trove.closedAt === undefined
      ? null
      : Number(trove.closedAt) * 1000,
    createdAt: Number(trove.createdAt) * 1000,
    mightBeLeveraged: trove.mightBeLeveraged,
    status: trove.status,
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
    interestRateBrackets(orderBy: rate) {
      collateral {
        collIndex
      }
      rate
      totalDebt
    }
  }
`);

export async function getInterestRateBrackets(branchId: BranchId) {
  const { interestRateBrackets } = await graphQuery(AllInterestRateBracketsQuery);
  return interestRateBrackets
    .filter((bracket) => bracket.collateral.collIndex === branchId)
    .sort((a, b) => (a.rate > b.rate ? 1 : -1))
    .map((bracket) => ({
      rate: dnum18(bracket.rate),
      totalDebt: dnum18(bracket.totalDebt),
    }));
}

export async function getAllInterestRateBrackets() {
  const { interestRateBrackets } = await graphQuery(AllInterestRateBracketsQuery);

  const debtByRate: Map<string, bigint> = new Map();
  for (const bracket of interestRateBrackets) {
    const key = String(bracket.rate);
    debtByRate.set(key, (debtByRate.get(key) ?? 0n) + BigInt(bracket.totalDebt));
  }

  return interestRateBrackets
    .sort((a, b) => (a.rate > b.rate ? 1 : -1))
    .map((bracket) => {
      const totalDebt = debtByRate.get(String(bracket.rate));
      if (totalDebt === undefined) throw new Error();
      return {
        rate: dnum18(bracket.rate),
        totalDebt: dnum18(totalDebt),
      };
    });
}

const GovernanceInitiatives = graphql(`
  query GovernanceInitiatives {
    governanceInitiatives {
      id
    }
  }
`);

// get all the registered initiatives
export async function getIndexedInitiatives() {
  const { governanceInitiatives } = await graphQuery(GovernanceInitiatives);
  return governanceInitiatives.map((initiative) => initiative.id as Address);
}

const GovernanceUserAllocated = graphql(`
  query GovernanceUserAllocations($id: ID!) {
    governanceUser(id: $id) {
      allocated
    }
  }
`);

// get the allocated initiatives for a given account
export async function getIndexedUserAllocated(account: Address) {
  const allocated = await graphQuery(GovernanceUserAllocated, {
    id: account.toLowerCase(),
  });
  return (allocated.governanceUser?.allocated ?? []) as Address[];
}
