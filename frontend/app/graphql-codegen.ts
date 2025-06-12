import type { CodegenConfig } from "@graphql-codegen/cli";

function findSubgraphUrl(envFile: string, key: string) {
  console.log("envFile: ", envFile);
  const fs = require("fs");
  const path = require("path");
  const envPath = path.resolve(process.cwd(), envFile);
  console.log("envPath: ", envPath);
  try {
    const envContent = fs.readFileSync(envPath, "utf-8");
    console.log("envContent: ", envContent);

    for (const line of envContent.split("\n")) {
      if (line.trim().startsWith(`${key}=`)) {
        console.log("line: ", line.slice(`${key}=`.length));
        return line.slice(`${key}=`.length);
      }
    }
    return null;
  } catch (error) {
    console.error("Error reading env file: ", error);
    return null;
  }
}

const subgraphUrl = findSubgraphUrl(".env.local", "NEXT_PUBLIC_SUBGRAPH_URL") ?? findSubgraphUrl(".env", "NEXT_PUBLIC_SUBGRAPH_URL");
const subgraphApiKey = findSubgraphUrl(".env.local", "NEXT_PUBLIC_SUBGRAPH_API_KEY") ?? findSubgraphUrl(".env", "NEXT_PUBLIC_SUBGRAPH_API_KEY");

if (!subgraphUrl) {
  throw new Error(
    "Subgraph URL not found in .env or .env.local. Please set NEXT_PUBLIC_SUBGRAPH_URL.",
  );
}

console.log("Using subgraph URL:", subgraphUrl, "\n");

const config: CodegenConfig = {
  schema: {
    [subgraphUrl]: {
      headers: {
        Authorization: `Bearer ${subgraphApiKey}`
      },
    },
  },
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
          BigInt: "bigint",
          Bytes: "string",
          Int8: "number",
          Timestamp: "string",
        },
      },
    },
  },
};

export default config;
