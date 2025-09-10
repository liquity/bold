import type { TypedDocumentString } from "@/src/summerstone-graphql/graphql";

import { SUMMERSTONE_API_URL } from "@/src/env";
import { graphql } from "@/src/summerstone-graphql";

export async function graphQuery<TResult, TVariables>(
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
) {
  const response = await fetch(SUMMERSTONE_API_URL, {
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
    throw new Error("Error while fetching data from the Summerstone API");
  }

  const result = await response.json();

  if (!result.data) {
    throw new Error("Invalid response from the Summerstone API");
  }

  return result.data as TResult;
}

export const BatchManagersQuery = graphql(`
  query BatchManagers($collateralIn: [String!], $batchManagerIn: [String!]) {
    batchManagers(collateralBranchIdIn: $collateralIn, batchManagerIn: $batchManagerIn) {
      collateralBranchId
      batchManagerId
      targetInterestRate
      currentInterestRate
      timeSinceLastAdjustment
      daysToAdjustment
      annualManagementFee
      status
      metadata {
        name
        description
        supersededBy
        riskHint
        link
        collateralToken {
          name
          symbol
          decimals
          address
        }
      }
    }
  }
`);