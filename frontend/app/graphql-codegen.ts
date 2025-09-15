import type { CodegenConfig } from "@graphql-codegen/cli";

const SUBGRAPH_URL_ORIGIN = "https://app.nerite.org";

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

function findSummerstoneApiUrl(envFile: string) {
  const fs = require("fs");
  const path = require("path");
  const envPath = path.resolve(process.cwd(), envFile);
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    if (line.trim().startsWith("NEXT_PUBLIC_SUMMERSTONE_API_URL=")) {
      return line.slice("NEXT_PUBLIC_SUMMERSTONE_API_URL=".length);
    }
  }
  return null;
}

function findShellSubgraphUrl(envFile: string) {
  const fs = require("fs");
  const path = require("path");
  const envPath = path.resolve(process.cwd(), envFile);
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    if (line.trim().startsWith("NEXT_PUBLIC_SHELL_SUBGRAPH_URL=")) {
      return line.slice("NEXT_PUBLIC_SHELL_SUBGRAPH_URL=".length);
    }
  }
  return null;
}

function findUniswapV4SubgraphUrl(envFile: string) {
  const fs = require("fs");
  const path = require("path");
  const envPath = path.resolve(process.cwd(), envFile);
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    if (line.trim().startsWith("NEXT_PUBLIC_UNISWAP_V4_SUBGRAPH_URL=")) {
      return line.slice("NEXT_PUBLIC_UNISWAP_V4_SUBGRAPH_URL=".length);
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
const summerstoneApiUrl = findSummerstoneApiUrl(".env.local") ?? findSummerstoneApiUrl(".env");

if (!summerstoneApiUrl) {
  throw new Error(
    "Summerstone API URL not found in .env or .env.local. Please set NEXT_PUBLIC_SUMMERSTONE_API_URL.",
  );
}

const shellSubgraphUrl = findShellSubgraphUrl(".env.local") ?? findShellSubgraphUrl(".env");

if (!shellSubgraphUrl) {
  throw new Error(
    "Shell Subgraph URL not found in .env or .env.local. Please set NEXT_PUBLIC_SHELL_SUBGRAPH_URL.",
  );
}

const uniswapV4SubgraphUrl = findUniswapV4SubgraphUrl(".env.local") ?? findUniswapV4SubgraphUrl(".env");

if (!uniswapV4SubgraphUrl) {
  throw new Error(
    "Uniswap V4 Subgraph URL not found in .env or .env.local. Please set NEXT_PUBLIC_UNISWAP_V4_SUBGRAPH_URL.",
  );
}

console.log(`Using Subgraph URL (with origin ${SUBGRAPH_URL_ORIGIN}):`, subgraphUrl, "\n");
console.log("Using Shell Subgraph URL:", shellSubgraphUrl, "\n");
console.log("Using Summerstone API URL:", summerstoneApiUrl, "\n");
console.log("Using Uniswap V4 Subgraph URL:", uniswapV4SubgraphUrl, "\n");

const config: CodegenConfig = {
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
      presetConfig: {
        fragmentMasking: false,
      },
      schema: {
        [subgraphUrl]: {
          headers: {
            "Origin": SUBGRAPH_URL_ORIGIN
          }
        },
      },
      documents: "src/**/subgraph*.{ts,tsx}",
    },
    "./src/summerstone-graphql/": {
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
      schema: {
        [summerstoneApiUrl]: {},
      },
      documents: "src/**/summerstone*.{ts,tsx}",
    },
    "./src/shell-graphql/": {
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
      schema: {
        [shellSubgraphUrl]: {},
      },
      documents: "src/**/shell*.{ts,tsx}",
    },
    "./src/uniswap-v4-graphql/": {
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
      presetConfig: {
        fragmentMasking: false,
      },
      schema: {
        [uniswapV4SubgraphUrl]: {},
      },
      documents: "src/**/uniswap-v4*.{ts,tsx}",
    },
  },
};

export default config;
