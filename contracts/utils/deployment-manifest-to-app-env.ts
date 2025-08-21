import { z } from "zod";
import { echo, fs, minimist } from "zx";

const HELP = `
Converts the deployment manifest created by scripts/DeployLiquity2.s.sol into 
environment variables meant to be used by the Next.js app located in frontend/app.

Usage:
  ./deployment-manifest-to-app-env.ts <MANIFEST_JSON> [OUTPUT_ENV] [OPTIONS]

Arguments:
  MANIFEST_JSON                            Path to the manifest file.
  OUTPUT_ENV                               Path to the environment variables
                                           file to write. If not provided, they
                                           will be printed to stdout.

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

const ZERO_ADDRESS = "0x" + "0".repeat(40);

const ZAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const ZDeploymentManifest = z.object({
  collateralRegistry: ZAddress,
  boldToken: ZAddress,
  hintHelpers: ZAddress,
  multiTroveGetter: ZAddress,
  debtInFrontHelper: ZAddress,
  exchangeHelpers: ZAddress,

  governance: z.object({
    LUSDToken: ZAddress,
    LQTYToken: ZAddress,
    stakingV1: ZAddress,
    governance: ZAddress,
  }),

  branches: z.array(
    z.object({
      activePool: ZAddress,
      addressesRegistry: ZAddress,
      borrowerOperations: ZAddress,
      collSurplusPool: ZAddress,
      collToken: ZAddress,
      defaultPool: ZAddress,
      gasPool: ZAddress,
      leverageZapper: ZAddress,
      metadataNFT: ZAddress,
      priceFeed: ZAddress,
      sortedTroves: ZAddress,
      stabilityPool: ZAddress,
      troveManager: ZAddress,
      troveNFT: ZAddress,
    }),
  ),
});

type DeploymentManifest = z.infer<typeof ZDeploymentManifest>;

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

  const manifest = parseDeploymentManifest(
    fs.readFileSync(options.inputJsonPath, "utf-8"),
  );

  const outputEnv = objectToEnvironmentVariables(
    deployedContractsToAppEnvVariables(manifest),
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

function deployedContractsToAppEnvVariables(manifest: DeploymentManifest) {
  if (manifest.branches.length === 0) {
    console.error("\nNo collateral contracts found in the deployment manifest.\n");
    process.exit(1);
  }

  const appEnvVariables: Record<string, string> = {
    // WETH is always the first collateral token
    NEXT_PUBLIC_CONTRACT_WETH: manifest.branches[0].collToken,
  };

  const { branches, governance, ...protocol } = manifest;

  // protocol contracts
  for (const [contractName, address] of Object.entries(protocol)) {
    const envVarName = contractNameToAppEnvVariable(contractName, "CONTRACT");
    if (envVarName) {
      appEnvVariables[envVarName] = address;
    }
  }

  // branches contracts
  for (const [index, contract] of Object.entries(branches)) {
    for (const [contractName, address] of Object.entries(contract)) {
      const envVarName = contractNameToAppEnvVariable(contractName, `COLL_${index}_CONTRACT`);
      if (envVarName) {
        appEnvVariables[envVarName] = address;
      }
    }
  }

  // governance contracts
  for (const [contractName, address] of Object.entries(governance)) {
    const envVarName = contractNameToAppEnvVariable(
      contractName,
      contractName.endsWith("Initiative") ? "INITIATIVE" : "CONTRACT",
    );
    if (envVarName) {
      appEnvVariables[envVarName] = address;
    }
  }

  return appEnvVariables;
}

function contractNameToAppEnvVariable(contractName: string, prefix: string = "") {
  prefix = `NEXT_PUBLIC_${prefix}`;
  switch (contractName) {
    // protocol contracts
    case "boldToken":
      return `${prefix}_BOLD_TOKEN`;
    case "collateralRegistry":
      return `${prefix}_COLLATERAL_REGISTRY`;
    case "hintHelpers":
      return `${prefix}_HINT_HELPERS`;
    case "multiTroveGetter":
      return `${prefix}_MULTI_TROVE_GETTER`;
    case "debtInFrontHelper":
      return `${prefix}_DEBT_IN_FRONT_HELPER`;
    case "exchangeHelpers":
      return `${prefix}_EXCHANGE_HELPERS`;

    // collateral contracts
    case "activePool":
      return `${prefix}_ACTIVE_POOL`;
    case "addressesRegistry":
      return `${prefix}_ADDRESSES_REGISTRY`;
    case "borrowerOperations":
      return `${prefix}_BORROWER_OPERATIONS`;
    case "collSurplusPool":
      return `${prefix}_COLL_SURPLUS_POOL`;
    case "collToken":
      return `${prefix}_COLL_TOKEN`;
    case "defaultPool":
      return `${prefix}_DEFAULT_POOL`;
    case "leverageZapper":
      return `${prefix}_LEVERAGE_ZAPPER`;
    case "priceFeed":
      return `${prefix}_PRICE_FEED`;
    case "sortedTroves":
      return `${prefix}_SORTED_TROVES`;
    case "stabilityPool":
      return `${prefix}_STABILITY_POOL`;
    case "troveManager":
      return `${prefix}_TROVE_MANAGER`;
    case "troveNFT":
      return `${prefix}_TROVE_NFT`;

    // governance contracts
    case "LUSDToken":
      return `${prefix}_LUSD_TOKEN`;
    case "LQTYToken":
      return `${prefix}_LQTY_TOKEN`;
    case "stakingV1":
      return `${prefix}_LQTY_STAKING`;
    case "governance":
      return `${prefix}_GOVERNANCE`;
  }
  return null;
}

function parseDeploymentManifest(content: string) {
  if (!content.trim()) {
    console.error("\nNo deployment manifest provided.\n");
    process.exit(1);
  }

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch (error) {
    console.error("\nInvalid format provided.\n");
    process.exit(1);
  }

  const manifest = ZDeploymentManifest.safeParse(json);
  if (!manifest.success) {
    console.error("\nInvalid deployment manifest provided.\n");
    console.error(
      manifest.error.errors.map((error) => {
        return `${error.path.join(".")}: ${error.message} (${error.code})`;
      }).join("\n"),
    );
    console.error("");
    console.error("Received:");
    console.error(JSON.stringify(json, null, 2));

    process.exit(1);
  }

  return manifest.data;
}

main();
