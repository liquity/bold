import { fs } from "zx";
import { graphql, query, SUBGRAPH_QUERY_LIMIT } from "./graphql";

const ONE_YEAR_D18 = 365n * 24n * 60n * 60n * BigInt(1e18);

const queryInterestRateBrackets = graphql`
  query InterestRateBrackets($cursor: ID!, $limit: Int) {
    interestRateBrackets(where: { id_gt: $cursor }, orderBy: id, first: $limit) {
      id
      totalDebt
      sumDebtTimesRateD36
      pendingDebtTimesOneYearD36
      updatedAt
    }
  }
`;

interface InterestRateBracket {
  id: string;
  totalDebt: string;
  sumDebtTimesRateD36: string;
  pendingDebtTimesOneYearD36: string;
  updatedAt: string;
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
    totalDebt: BigInt(bracket.totalDebt),
    sumDebtTimesRateD36: BigInt(bracket.sumDebtTimesRateD36),
    pendingDebtTimesOneYearD36: BigInt(bracket.pendingDebtTimesOneYearD36),
    updatedAt: BigInt(bracket.updatedAt),
  }));
};

export const main = async () => {
  const subgraphUrl = process.argv[2];
  if (!subgraphUrl) throw new Error("Missing argument: subgraph URL");

  const interestRateBrackets = await getInterestRateBrackets(subgraphUrl);
  const now = BigInt(Math.floor(Date.now() / 1000));

  const totalDebt = interestRateBrackets.reduce(
    (totalDebtTimesOneYearD36, bracket) =>
      totalDebtTimesOneYearD36
      + bracket.totalDebt * ONE_YEAR_D18
      + bracket.pendingDebtTimesOneYearD36
      + bracket.sumDebtTimesRateD36 * (now - bracket.updatedAt),
    0n,
  ) / ONE_YEAR_D18;

  console.log(totalDebt);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
