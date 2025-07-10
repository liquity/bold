import type { CodegenConfig } from "@graphql-codegen/cli";

function findSubgraphUrl(envFile: string) {
  const fs = require("fs");
  const path = require("path");
  const envPath = path.resolve(process.cwd(), envFile);
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    if (line.trim().startsWith("NEXT_PUBLIC_SUBGRAPH_URL=")) {
      return line.slice("NEXT_PUBLIC_SUBGRAPH_URL=".length);
    }
  }
  return null;
}

const subgraphUrl = findSubgraphUrl(".env.local") ?? findSubgraphUrl(".env");

if (!subgraphUrl) {
  throw new Error(
    "Subgraph URL not found in .env or .env.local. Please set NEXT_PUBLIC_SUBGRAPH_URL.",
  );
}

console.log("Using subgraph URL:", subgraphUrl, "\n");

const config: CodegenConfig = {
  schema: subgraphUrl,
  documents: "src/**/*.{ts,tsx}",
  ignoreNoDocuments: true,
  generates: {
    "./src/graphql/": {
      preset: "client",
      config: {
        dedupeFragments: true,
        documentMode: "string",
        strictScalars: true,
        scalars: {
          BigDecimal: "string",
          BigInt: "string",
          Bytes: "string",
          Int8: "number",
          Timestamp: "string",
        },
      },
    },
  },
};

export default config;
