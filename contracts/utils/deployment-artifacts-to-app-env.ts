import { z } from "zod";
import { echo, fs, minimist } from "zx";

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

const argv = minimist(process.argv.slice(2), {
  alias: {
    h: "help",
  },
  boolean: [
    "help",
    "append",
  ],
});

const ZAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const ZDeploymentContext = z.object({
  deployedContracts: z.array(z.tuple([z.string(), ZAddress])),
  collateralContracts: z.array(
    z.object({
      activePool: ZAddress,
      borrowerOperations: ZAddress,
      sortedTroves: ZAddress,
      stabilityPool: ZAddress,
      token: ZAddress,
      troveManager: ZAddress,
    }),
  ),
  protocolContracts: z.object({
    BoldToken: ZAddress,
    CollateralRegistry: ZAddress,
    HintHelpers: ZAddress,
    MultiTroveGetter: ZAddress,
    WETHTester: ZAddress,
  }),
});

type DeploymentContext = z.infer<typeof ZDeploymentContext>;

const NULL_ADDRESS = `0x${"0".repeat(40)}`;

export function main() {
  const options = {
    help: argv["help"],
    append: argv["append"],
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

  const deploymentContext = parseDeploymentContext(
    fs.readFileSync(options.inputJsonPath, "utf-8"),
  );

  const outputEnv = objectToEnvironmentVariables(
    deployedContractsToAppEnvVariables(deploymentContext),
  );

  if (!options.outputEnvPath) {
    console.log(outputEnv);
    process.exit(0);
  }

  fs.ensureFileSync(options.outputEnvPath);
  if (options.append) {
    fs.appendFileSync(options.outputEnvPath, `\n${outputEnv}\n`);
  } else {
    fs.writeFileSync(options.outputEnvPath, `${outputEnv}\n`);
  }

  console.log(`\nEnvironment variables written to ${options.outputEnvPath}.\n`);
}

function objectToEnvironmentVariables(object: Record<string, unknown>) {
  return Object.entries(object)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .sort((a, b) => {
      if (a.includes("_COLL_") && !b.includes("_COLL_")) {
        return -1;
      }
      if (!a.includes("_COLL_") && b.includes("_COLL_")) {
        return 1;
      }
      return 0;
    })
    .join("\n");
}

function deployedContractsToAppEnvVariables(deployedContext: DeploymentContext) {
  const appEnvVariables: Record<string, string> = {};

  // protocol contracts
  for (const [contractName, address] of Object.entries(deployedContext.protocolContracts)) {
    const envVarName = contractNameToAppEnvVariable(contractName, "CONTRACT");
    if (envVarName) {
      appEnvVariables[envVarName] = address;
    }
  }

  appEnvVariables.NEXT_PUBLIC_CONTRACT_FUNCTION_CALLER = NULL_ADDRESS;
  appEnvVariables.NEXT_PUBLIC_CONTRACT_HINT_HELPERS = NULL_ADDRESS;

  // collateral contracts
  for (const [index, contract] of Object.entries(deployedContext.collateralContracts)) {
    for (const [contractName, address] of Object.entries(contract)) {
      const envVarName = contractNameToAppEnvVariable(contractName, `COLL_${index}_CONTRACT`);
      if (envVarName) {
        appEnvVariables[envVarName] = address;
      }
    }
  }

  return appEnvVariables;
}

function contractNameToAppEnvVariable(contractName: string, prefix: string = "") {
  prefix = `NEXT_PUBLIC_${prefix}`;
  switch (contractName) {
    // protocol contracts
    case "BoldToken":
      return `${prefix}_BOLD_TOKEN`;
    case "CollateralRegistry":
      return `${prefix}_COLLATERAL_REGISTRY`;
    case "HintHelpers":
      return `${prefix}_HINT_HELPERS`;
    case "MultiTroveGetter":
      return `${prefix}_MULTI_TROVE_GETTER`;
    case "WETH":
    case "WETHTester":
      return `${prefix}_WETH`;

    // collateral contracts
    case "activePool":
      return `${prefix}_ACTIVE_POOL`;
    case "borrowerOperations":
      return `${prefix}_BORROWER_OPERATIONS`;
    case "sortedTroves":
      return `${prefix}_SORTED_TROVES`;
    case "stabilityPool":
      return `${prefix}_STABILITY_POOL`;
    case "token":
      return `${prefix}_TOKEN`;
    case "troveManager":
      return `${prefix}_TROVE_MANAGER`;
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
    console.error("Received:");
    console.error(JSON.stringify(json, null, 2));

    process.exit(1);
  }

  return context.data;
}

main();
