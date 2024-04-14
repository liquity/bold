import { z } from "zod";
import { argv, echo, fs } from "zx";

const HELP = `
Converts the deployment artifacts created by ./deploy into environment variables
to be used by the Next.js app located in frontend/.

Usage:
  ./deployment-artifacts-to-app-env.ts <INPUT_JSON> [OUTPUT_ENV] [OPTIONS]

Arguments:
  INPUT_JSON                               Path to the deployment artifacts
                                           JSON file.
  OUTPUT_ENV                               Path to the environment variables
                                           file to write. If not provided, it
                                           writes to stdout.

Options:
  --help, -h                               Show this help message.
  --append                                 Append to the output file instead of
                                           overwriting it (requires OUTPUT_ENV).
`;

const ZAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const ZDeploymentContext = z.object({
  deployedContracts: z.record(ZAddress),
});

type DeploymentContext = z.infer<typeof ZDeploymentContext>;

const NULL_ADDRESS = `0x${"0".repeat(40)}`;

export async function main() {
  const options = {
    help: "help" in argv || "h" in argv,
    append: "append" in argv,
    inputJsonPath: argv._[0],
    outputEnvPath: argv._[1],
  };

  if (options.help) {
    echo`${HELP}`;
    process.exit(0);
  }

  if (!options.inputJsonPath) {
    console.error("\nPlease provide the path to the deployment artifacts JSON file.\n");
    process.exit(1);
  }

  const { deployedContracts } = parseDeploymentContext(
    await fs.readFile(options.inputJsonPath, "utf-8"),
  );

  const outputEnv = objectToEnvironmentVariables(
    deployedContractsToAppEnvVariables(deployedContracts),
  );

  if (!options.outputEnvPath) {
    console.log(outputEnv);
    process.exit(0);
  }

  await fs.ensureFile(options.outputEnvPath);
  if (options.append) {
    await fs.appendFile(options.outputEnvPath, `\n${outputEnv}\n`);
  } else {
    await fs.writeFile(options.outputEnvPath, `${outputEnv}\n`);
  }

  console.log(`\nEnvironment variables written to ${options.outputEnvPath}.\n`);
}

function objectToEnvironmentVariables(object: Record<string, unknown>) {
  return Object.entries(object)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
}

function deployedContractsToAppEnvVariables(deployedContracts: DeploymentContext["deployedContracts"]) {
  const appEnvVariables: Record<string, string> = {};

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
    case "ERC20Faucet":
      return "NEXT_PUBLIC_CONTRACT_COLL_TOKEN";
    case "GasPool":
      return "NEXT_PUBLIC_CONTRACT_GAS_POOL";
    case "MockInterestRouter":
      return "NEXT_PUBLIC_CONTRACT_INTEREST_ROUTER";
    case "PriceFeedTestnet":
      return "NEXT_PUBLIC_CONTRACT_PRICE_FEED";
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
