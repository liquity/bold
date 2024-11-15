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
    body: JSON.stringify({ query, variables }),
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

export const TotalDepositedQuery = graphql(`
  query TotalDeposited {
    collaterals {
      collIndex
      totalDeposited
    }
  }
`);

export const TrovesCountQuery = graphql(`
  query TrovesCount($id: ID!) {
    borrowerInfo(id: $id) {
      troves
      trovesByCollateral
    }
  }
`);

export const TrovesByAccountQuery = graphql(`
  query TrovesByAccount($account: Bytes!) {
    troves(
      where: { borrower: $account, closedAt: null }
      orderBy: updatedAt
      orderDirection: desc
    ) {
      id
      borrower
      closedAt
      collateral {
        id
        token {
          symbol
          name
        }
        minCollRatio
        collIndex
      }
      createdAt
      updatedAt
      debt
      deposit
      interestBatch {
        id
        annualInterestRate
        annualManagementFee
        batchManager
      }
      interestRate
      stake
      troveId
      usedLeverageZapper
    }
  }
`);

export const TroveByIdQuery = graphql(`
  query TroveById($id: ID!) {
    trove(id: $id) {
      id
      borrower
      closedAt
      collateral {
        id
        token {
          symbol
          name
        }
        minCollRatio
        collIndex
      }
      createdAt
      updatedAt
      debt
      deposit
      interestBatch {
        id
        annualInterestRate
        annualManagementFee
        batchManager
      }
      interestRate
      stake
      troveId
      usedLeverageZapper
    }
  }
`);

export const StabilityPoolQuery = graphql(`
  query StabilityPool($id: ID!) {
    stabilityPool(id: $id) {
      id
      totalDeposited
    }
  }
`);

export const StabilityPoolDepositsByAccountQuery = graphql(`
  query StabilityPoolDepositsByAccount($account: Bytes!) {
    stabilityPoolDeposits(where: { depositor: $account, deposit_gt: 0 }) {
      id
      collateral {
        collIndex
      }
      deposit
      depositor
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
      collateral {
        collIndex
      }
      deposit
      depositor
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

export const InterestRateBracketsQuery = graphql(`
  query InterestRateBrackets($collId: String!) {
    interestRateBrackets(where: { collateral: $collId }, orderBy: rate) {
      rate
      totalDebt
    }
  }
`);
