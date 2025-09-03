import type { CodegenConfig } from "@graphql-codegen/cli";
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const subgraphUrl = process.env.NEXT_PUBLIC_SUBGRAPH_URL;
const subgraphOrigin = process.env.NEXT_PUBLIC_SUBGRAPH_ORIGIN;

if (!subgraphUrl) {
  throw new Error(
    "Subgraph URL not found in .env or .env.local. Please set NEXT_PUBLIC_SUBGRAPH_URL.",
  );
}

console.log("Using subgraph URL:", subgraphUrl);
if (subgraphOrigin) console.log("Impersonating origin:", subgraphOrigin);
console.log();

const config: CodegenConfig = {
  customFetch: subgraphOrigin
    ? (url, options) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          "Origin": subgraphOrigin,
        },
      });
    }
    : undefined,

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
