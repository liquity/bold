import { z } from "zod";
import { argv, echo, fs } from "zx";

const HELP = `
converts the deployment artifacts created by ./deploy into environment
variables to be used by the Next.js app located in frontend/.

Usage:
  ./deployment-artifacts-to-app-env.ts <INPUT_JSON> <OUTPUT_ENV>

Options:
  --help, -h                               Show this help message.
`;

const ZAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const ZDeploymentContext = z.object({
  options: z.object({
    chainId: z.number(),
    // XXX hotfix: we were leaking Github secrets in "deployer"
    // deployer: z.string(), // can be an address or a private key
    help: z.boolean(),
    openDemoTroves: z.boolean(),
    rpcUrl: z.string(),
    verify: z.boolean(),
    verifier: z.string(),
  }),
  deployedContracts: z.record(ZAddress),
});

type DeploymentContext = z.infer<typeof ZDeploymentContext>;

const NULL_ADDRESS = `0x${"0".repeat(40)}`;

export async function main() {
  if ("help" in argv || "h" in argv || argv._.length !== 2) {
    echo`${HELP}`;
    process.exit(0);
  }

  const deploymentContext = parseDeploymentContext(await fs.readFile(argv._[0], "utf-8"));

  const outputEnv = objectToEnvironmentVariables(
    deploymentContextToAppEnvVariables(deploymentContext)
  );

  await fs.writeFile(argv._[1], outputEnv);
  console.log(outputEnv);
}

function objectToEnvironmentVariables(object: Record<string, unknown>) {
  return Object.entries(object)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
}

function deploymentContextToAppEnvVariables({ deployedContracts, options }: DeploymentContext) {
  const appEnvVariables: Record<string, string> = {
    NEXT_PUBLIC_CHAIN_ID: String(options.chainId),
  };

  for (const [contractName, address] of Object.entries(deployedContracts)) {
    const envVarName = contractNameToAppEnvVariable(contractName);
    if (envVarName) {
      appEnvVariables[envVarName] = address;
    }
  }

  appEnvVariables.NEXT_PUBLIC_CONTRACT_FUNCTION_CALLER = NULL_ADDRESS;
  appEnvVariables.NEXT_PUBLIC_CONTRACT_HINT_HELPERS = NULL_ADDRESS;

  return appEnvVariables;
}

function contractNameToAppEnvVariable(contractName: string) {
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

  const context = ZDeploymentContext.safeParse(json);
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
