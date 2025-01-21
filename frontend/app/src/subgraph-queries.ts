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

export const FullTroveQueryFragment = graphql(`
  fragment FullTroveFragment on Trove {
    id
    borrower
    closedAt
    createdAt
    debt
    deposit
    interestRate
    mightBeLeveraged
    stake
    status
    troveId
    updatedAt
    collateral {
      id
      token {
        symbol
        name
      }
      minCollRatio
      collIndex
    }
    interestBatch {
      id
      annualInterestRate
      annualManagementFee
      batchManager
    }
  }
`);

export const TrovesByAccountQuery = graphql(`
  query TrovesByAccount($account: Bytes!) {
    troves(
      where: {
        borrower: $account,
        status_in: [active,redeemed,liquidated],
      }
      orderBy: updatedAt
      orderDirection: desc
    ) {
      id
      borrower
      closedAt
      createdAt
      debt
      deposit
      interestRate
      mightBeLeveraged
      stake
      status
      troveId
      updatedAt
      collateral {
        id
        token {
          symbol
          name
        }
        minCollRatio
        collIndex
      }
      interestBatch {
        id
        annualInterestRate
        annualManagementFee
        batchManager
      }
    }
  }
`);

export const TroveByIdQuery = graphql(`
  query TroveById($id: ID!) {
    trove(id: $id) {
      id
      borrower
      closedAt
      createdAt
      debt
      deposit
      interestRate
      mightBeLeveraged
      stake
      status
      troveId
      updatedAt
      collateral {
        id
        token {
          symbol
          name
        }
        minCollRatio
        collIndex
      }
      interestBatch {
        id
        annualInterestRate
        annualManagementFee
        batchManager
      }
    }
  }
`);

export const StabilityPoolsQuery = graphql(`
  query StabilityPools {
    stabilityPools {
      id
      totalDeposited
    }
  }
`);

export const StabilityPoolDepositQueryFragment = graphql(`
  fragment StabilityPoolDepositFragment on StabilityPoolDeposit {
    id
    deposit
    depositor
    collateral {
      collIndex
    }
    snapshot {
      B
      P
      S
      epoch
      scale
    }
  }
`);

export const StabilityPoolDepositsByAccountQuery = graphql(`
  query StabilityPoolDepositsByAccount($account: Bytes!) {
    stabilityPoolDeposits(where: { depositor: $account, deposit_gt: 0 }) {
      id
      deposit
      depositor
      collateral {
        collIndex
      }
      snapshot {
        B
        P
        S
        epoch
        scale
      }
    }
  }
`);

export const StabilityPoolDepositQuery = graphql(`
  query StabilityPoolDeposit($id: ID!) {
    stabilityPoolDeposit(id: $id) {
      id
      deposit
      depositor
      collateral {
        collIndex
      }
      snapshot {
        B
        P
        S
        epoch
        scale
      }
    }
  }
`);

export const StabilityPoolEpochScaleQuery = graphql(`
  query StabilityPoolEpochScale($id: ID!) {
    stabilityPoolEpochScale(id: $id) {
      id
      B
      S
    }
  }
`);

export const InterestBatchQuery = graphql(`
  query InterestBatch($id: ID!) {
    interestBatch(id: $id) {
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
