import type { TypedDocumentString } from "@/src/graphql/graphql";

import { SUBGRAPH_URL } from "@/src/env";
import { graphql } from "@/src/graphql";

export async function graphQuery<TResult, TVariables>(
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
) {
  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/graphql-response+json",
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
    throw new Error("Invalid response from the subgraph");
  }

  return result.data as TResult;
}

export const BorrowerInfoQuery = graphql(`
  query BorrowerInfo($id: ID!) {
    borrowerInfo(id: $id) {
      nextOwnerIndexes
      troves
      trovesByCollateral
    }
  }
`);

export const TroveStatusesByAccountQuery = graphql(`
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

export const TroveStatusByIdQuery = graphql(`
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

export const InterestBatchesQuery = graphql(`
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

export const AllInterestRateBracketsQuery = graphql(`
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

export const GovernanceInitiatives = graphql(`
  query GovernanceInitiatives {
    governanceInitiatives {
      id
    }
  }
`);

export const GovernanceUser = graphql(`
  query GovernanceUser($id: ID!) {
    governanceUser(id: $id) {
      id
      allocatedLQTY
      stakedLQTY
      stakedOffset
      allocations {
        id
        atEpoch
        vetoLQTY
        voteLQTY
        initiative {
          id
        }
      }
    }
  }
`);

export const GovernanceStats = graphql(`
  query GovernanceStats {
    governanceStats(id: "stats") {
      id
      totalLQTYStaked
      totalOffset
      totalInitiatives
    }
  }
`);

export const GovernanceUserAllocated = graphql(`
  query GovernanceUserAllocations($id: ID!) {
    governanceUser(id: $id) {
      allocated
    }
  }
`);

export const BlockNumberQuery = graphql(`
  query BlockNumber {
    _meta {
      block {
        number
      }
    }
  }
`);
