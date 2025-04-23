import * as v from "valibot";
import { argv, echo } from "zx";

const INSTRUCTIONS = `
Usage:
  pnpm tsx initiatives-snapshot.ts <subgraph_url>

Example:
  pnpm tsx initiatives-snapshot.ts https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{SUBGRAPH_ID} > initiatives-snapshot.json

Options:
  --help, -h  Show this help message.
`;

const HELP = `
Generates a JSON snapshot of the currently registered initiatives.
${INSTRUCTIONS}
`;

const QueryInitiativesResultSchema = v.pipe(
  v.object({
    governanceInitiatives: v.array(
      v.object({
        id: v.string(),
      }),
    ),
  }),
  v.transform(({ governanceInitiatives }) => (
    governanceInitiatives.map(({ id }) => id)
  )),
);

async function queryInitiatives(subgraphUrl: string) {
  const result = await fetch(subgraphUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `{
        governanceInitiatives {
          id
        }
      }`,
      operationName: "Subgraphs",
    }),
  });

  const { data } = await result.json();

  return v.parse(QueryInitiativesResultSchema, data);
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
    JSON.stringify(await queryInitiatives(subgraphUrl), null, 2),
  );
}
main();
