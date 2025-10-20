import { fs } from "zx";
import { graphql, query, SUBGRAPH_QUERY_LIMIT } from "./graphql";

const queryInterestRateBrackets = graphql`
  query InterestRateBrackets($cursor: ID!, $limit: Int) {
    interestRateBrackets(where: { id_gt: $cursor }, orderBy: id, first: $limit) {
      id
      totalDebt
    }
  }
`;

interface InterestRateBracket {
  id: string;
  totalDebt: string;
}

interface InterestRateBrackets {
  interestRateBrackets: InterestRateBracket[];
}

const getInterestRateBrackets = async (subgraphUrl: string) => {
  const interestRateBrackets: InterestRateBracket[] = [];
  let cursor = "";

  for (;;) {
    const result = await query<InterestRateBrackets>(subgraphUrl, {
      operationName: "InterestRateBrackets",
      query: queryInterestRateBrackets,
      variables: {
        cursor,
        limit: SUBGRAPH_QUERY_LIMIT,
      },
    });

    interestRateBrackets.push(...result.interestRateBrackets);
    if (result.interestRateBrackets.length < SUBGRAPH_QUERY_LIMIT) break;
    cursor = interestRateBrackets[interestRateBrackets.length - 1].id;
  }

  return interestRateBrackets.map((bracket) => ({
    id: bracket.id,
    totalDebt: bracket.totalDebt,
  }));
};

export const main = async () => {
  const subgraphUrl = process.argv[2];
  if (!subgraphUrl) throw new Error("Missing argument: subgraph URL");

  const interestRateBrackets = await getInterestRateBrackets(subgraphUrl);
  fs.writeJSON("brackets.json", interestRateBrackets, { spaces: 2 });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
