import type { TypedDocumentString } from "@/src/shell-graphql/graphql";

import { SHELL_SUBGRAPH_URL } from "@/src/env";
import { graphql } from "@/src/shell-graphql";

export async function graphQuery<TResult, TVariables>(
  query: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
) {
  const response = await fetch(SHELL_SUBGRAPH_URL, {
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
    throw new Error("Error while fetching data from the Shell Subgraph");
  }

  const result = await response.json();

  if (!result.data) {
    throw new Error("Invalid response from the Shell Subgraph");
  }

  return result.data as TResult;
}

export const BalancesByTokenQuery = graphql(`
  query BalancesByToken($token: Bytes!) {
    balances(
      where: { token: $token }
      orderBy: balance
      orderDirection: desc
    ) {
      holder
      token
      balance
    }
  }
`)

export const BalancesForHoldersQuery = graphql(`
  query BalancesForHolders($token: Bytes!, $holders: [Bytes!]!) {
    balances(
      where: {
        token_not: $token
        holder_in: $holders
      }
    ) {
      holder
      token
      balance
    }
  }
`)