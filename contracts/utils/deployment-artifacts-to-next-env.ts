import { z } from "zod";
import { argv, echo, stdin } from "zx";

const HELP = `
converts the deployment artifacts created by ./deploy into next environment variables

Usage:
  ./deployment-artifacts-to-next-env.ts < deployment-latest.json

Options:
  --help, -h                               Show this help message.
`;

const ZAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const DeploymentContext = z.object({
  options: z.object({
    chainId: z.number(),
    deployer: z.string(), // can be an address or a private key
    help: z.boolean(),
    openDemoTroves: z.boolean(),
    rpcUrl: z.string(),
    verify: z.boolean(),
    verifier: z.string(),
  }),
  deployedContracts: z.record(ZAddress),
});

const NULL_ADDRESS = `0x${"0".repeat(40)}`;

export async function main() {
  if ("help" in argv || "h" in argv) {
    echo`${HELP}`;
    process.exit(0);
  }

  const deploymentContext = parseDeploymentContext(await stdin());

  console.log(
    objectToEnvironmentVariables(
      deploymentContextToNextEnvVariables(deploymentContext),
    ),
  );
}

function objectToEnvironmentVariables(object: Record<string, unknown>) {
  return Object.entries(object)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
}

function deploymentContextToNextEnvVariables(deploymentContext: z.infer<typeof DeploymentContext>) {
  const contracts = Object.fromEntries(
    Object
      .entries(deploymentContext.deployedContracts)
      .reduce((entries, [contractName, address]) => {
        const envVar = contractNameToNextEnvVariable(contractName);
        if (envVar) {
          entries.push([envVar, address]);
        }
        return entries;
      }, [] as [string, string][])
      .filter(Boolean),
  );

  contracts.NEXT_PUBLIC_CONTRACT_FUNCTION_CALLER = NULL_ADDRESS;
  contracts.NEXT_PUBLIC_CONTRACT_HINT_HELPERS = NULL_ADDRESS;

  return {
    NEXT_PUBLIC_CHAIN_ID: deploymentContext.options.chainId,
    ...contracts,
  };
}

function contractNameToNextEnvVariable(contractName: string) {
  switch (contractName) {
    case "ActivePool":
      return "NEXT_PUBLIC_CONTRACT_ACTIVE_POOL";
    case "BoldToken":
      return "NEXT_PUBLIC_CONTRACT_BOLD_TOKEN";
    case "BorrowerOperations":
      return "NEXT_PUBLIC_CONTRACT_BORROWER_OPERATIONS";
    case "CollSurplusPool":
      return "NEXT_PUBLIC_CONTRACT_COLL_SURPLUS_POOL";
    case "DefaultPool":
      return "NEXT_PUBLIC_CONTRACT_DEFAULT_POOL";
    case "GasPool":
      return "NEXT_PUBLIC_CONTRACT_GAS_POOL";
    case "PriceFeedTestnet":
      return "NEXT_PUBLIC_CONTRACT_PRICE_FEED_TESTNET";
    case "SortedTroves":
      return "NEXT_PUBLIC_CONTRACT_SORTED_TROVES";
    case "StabilityPool":
      return "NEXT_PUBLIC_CONTRACT_STABILITY_POOL";
    case "TroveManager":
      return "NEXT_PUBLIC_CONTRACT_TROVE_MANAGER";
  }
  return null;
}

function parseDeploymentContext(content: string) {
  if (!content.trim()) {
    console.error("\nNo deployment context provided.\n");
    process.exit(1);
  }

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch (error) {
    console.error("\nInvalid format provided.\n");
    process.exit(1);
  }

  const context = DeploymentContext.safeParse(json);
  if (!context.success) {
    console.error("\nInvalid deployment context provided.\n");
    console.error(
      context.error.errors.map((error) => {
        return `${error.path.join(".")}: ${error.message} (${error.code})`;
      }).join("\n"),
    );
    console.error("");
    process.exit(1);
  }

  return context.data;
}

main();
