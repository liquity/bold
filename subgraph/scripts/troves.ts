import { fs } from "zx";
import { graphql, query, SUBGRAPH_QUERY_LIMIT } from "./graphql";

const queryTroves = graphql`
  query Troves($cursor: ID!, $limit: Int) {
    troves(where: { id_gt: $cursor }, orderBy: id, first: $limit) {
      id
      borrower
      collateral { id }
      closedAt
      createdAt
      mightBeLeveraged
      status
      updatedAt
      lastUserActionAt
      debt
      deposit
      interestBatch { id }
      interestRate
      stake
      troveId
      previousOwner
      redemptionCount
      redeemedColl
      redeemedDebt
    }
  }
`;

interface Trove {
  id: string;
  borrower: string;
  collateral: { id: string };
  closedAt: string | null;
  createdAt: string;
  mightBeLeveraged: boolean;
  status: string;
  updatedAt: string;
  lastUserActionAt: string;
  debt: string;
  deposit: string;
  interestBatch: { id: string } | null;
  interestRate: string;
  stake: string;
  troveId: string;
  previousOwner: string;
  redemptionCount: number;
  redeemedColl: string;
  redeemedDebt: string;
}

interface Troves {
  troves: Trove[];
}

const getTroves = async (subgraphUrl: string) => {
  const troves: Trove[] = [];
  let cursor = "";

  for (;;) {
    const result = await query<Troves>(subgraphUrl, {
      operationName: "Troves",
      query: queryTroves,
      variables: {
        cursor,
        limit: SUBGRAPH_QUERY_LIMIT,
      },
    });

    troves.push(...result.troves);
    if (result.troves.length < SUBGRAPH_QUERY_LIMIT) break;
    cursor = troves[troves.length - 1].id;
  }

  // Stabilize field order
  return troves.map((trove) => ({
    id: trove.id,
    borrower: trove.borrower,
    collateral: trove.collateral.id,
    closedAt: trove.closedAt,
    createdAt: trove.createdAt,
    mightBeLeveraged: trove.mightBeLeveraged,
    status: trove.status,
    updatedAt: trove.updatedAt,
    lastUserActionAt: trove.lastUserActionAt,
    debt: trove.debt,
    deposit: trove.deposit,
    interestBatch: trove.interestBatch?.id ?? null,
    interestRate: trove.interestRate,
    stake: trove.stake,
    troveId: trove.troveId,
    previousOwner: trove.previousOwner,
    redemptionCount: trove.redemptionCount,
    redeemedColl: trove.redeemedColl,
    redeemedDebt: trove.redeemedDebt,
  }));
};

export const main = async () => {
  const subgraphUrl = process.argv[2];
  if (!subgraphUrl) throw new Error("Missing argument: subgraph URL");

  const troves = await getTroves(subgraphUrl);
  await fs.writeJSON("troves.json", troves, { spaces: 2 });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
