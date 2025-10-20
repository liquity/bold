export const SUBGRAPH_QUERY_LIMIT = 1000;

export const graphql = String.raw;

export type GraphQLQueryParams = {
  operationName: string;
  query: string;
  variables: Record<string, unknown>;
};

export type GraphQLResponse<T> =
  | { data: T | null }
  | { data: T | null; errors: unknown[] }
  | { errors: unknown[] };

export const query = async <T extends {}>(url: string, params: GraphQLQueryParams) => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const json: GraphQLResponse<T> = await res.json();

  if (!("data" in json) || json.data === null || "errors" in json) {
    const error = new Error("GraphQL error");

    if ("errors" in json) {
      throw Object.assign(error, { errors: json.errors });
    } else {
      throw error;
    }
  }

  return json.data;
};
