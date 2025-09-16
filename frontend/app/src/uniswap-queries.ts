import type { TypedDocumentString } from "@/src/uniswap-v4-graphql/graphql";

import { UNISWAP_V4_SUBGRAPH_URL } from "@/src/env";
import { graphql } from "@/src/uniswap-v4-graphql";

export async function graphQuery<TResult, TVariables>(
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
) {
  const response = await fetch(UNISWAP_V4_SUBGRAPH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/graphql-response+json",
    },
    body: JSON.stringify(
      { query, variables },
      (_, value) => (typeof value === "bigint" ? String(value) : value)
    ),
  });

  if (!response.ok) {
    throw new Error("Error while fetching data from the Uniswap V4 Subgraph");
  }

  const result = await response.json();

  if (!result.data) {
    throw new Error("Invalid response from the Uniswap V4 Subgraph");
  }

  return result.data as TResult;
}

export const PositionsByOwnersQuery = graphql(`
  query PositionsByOwners($owners: [Bytes!]!) {
    positions(
      where: { owner_in: $owners }
      orderBy: tokenId
      orderDirection: desc
    ) {
      owner
      tokenId
    }
  }
`)