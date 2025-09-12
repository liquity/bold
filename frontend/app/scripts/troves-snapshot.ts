import * as v from "valibot";
import { argv, echo } from "zx";

const INSTRUCTIONS = `
Usage:
  pnpm tsx troves-snapshot.ts <subgraph_url>

Example:
  pnpm tsx troves-snapshot.ts https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{SUBGRAPH_ID} > troves-snapshot.json

Options:
  --help, -h  Show this help message.
`;

const HELP = `
Generates a JSON snapshot of the currently opened Troves.
${INSTRUCTIONS}
`;

const QueryTrovesResultSchema = v.pipe(
  v.object({
    troves: v.array(
      v.object({
        id: v.string(),
        borrower: v.string(),
      }),
    ),
  }),
  v.transform(({ troves }) => {
    const trovesByBorrower: Record<string, string[]> = {};
    for (const { borrower, id } of troves) {
      if (!trovesByBorrower[borrower]) {
        trovesByBorrower[borrower] = [];
      }
      trovesByBorrower[borrower].push(id);
    }
    return trovesByBorrower;
  }),
);

async function queryTroves(subgraphUrl: string) {
  const result = await fetch(subgraphUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `{
        troves(where: { borrower_not: "0x0000000000000000000000000000000000000000"}) {
          id
          borrower
        }
      }`,
      operationName: "Subgraphs",
    }),
  });

  const { data } = await result.json();

  return v.parse(QueryTrovesResultSchema, data);
}

export async function main() {
  const options = {
    help: "help" in argv || "h" in argv,
  };

  if (options.help) {
    echo`${HELP}`;
    process.exit(0);
  }

  const [subgraphUrl] = argv._;

  if (!subgraphUrl) {
    console.error("");
    console.error("Error: missing subgraph URL.");
    console.error(INSTRUCTIONS);
    process.exit(1);
  }

  console.log(
    JSON.stringify(await queryTroves(subgraphUrl), null, 2),
  );
}
main();
