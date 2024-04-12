import { $, argv, echo, fs } from "zx";

const HELP = `
deploy - deploy the Liquity contracts.

Usage:
  ./deploy [NETWORK_PRESET] [OPTIONS]

Arguments:
  NETWORK_PRESET  A network preset, which is a shorthand for setting certain options
                  such as the chain ID and RPC URL. Options take precedence over
                  network presets. Available presets:
                  - local: Deploy to a local network
                  - mainnet: Deploy to the Ethereum mainnet
                  - liquity-testnet: Deploy to the Liquity v2 testnet


Options:
  --chain-id <CHAIN_ID>                    Chain ID to deploy to.
  --deployer <DEPLOYER>                    Address or private key to deploy with.
                                           Requires a Ledger if an address is used.
  --ledger-path <LEDGER_PATH>              HD path to use with the Ledger (only used
                                           when DEPLOYER is an address).
  --etherscan-api-key <ETHERSCAN_API_KEY>  Etherscan API key to verify the contracts
                                           (required when verifying with Etherscan).
  --help, -h                               Show this help message.
  --open-demo-troves                       Open demo troves after deployment (local
                                           only).
  --rpc-url <RPC_URL>                      RPC URL to use.
  --verify                                 Verify contracts after deployment.
  --verifier <VERIFIER>                    Verification provider to use.
                                           Possible values: etherscan, sourcify.
  --verifier-url <VERIFIER_URL>            The verifier URL, if using a custom
                                           provider.

Note: options can also be set via corresponding environment variables,
e.g. --chain-id can be set via CHAIN_ID instead. Parameters take precedence over variables.
`;

const ANVIL_FIRST_ACCOUNT = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export async function main() {
  const { networkPreset, options } = await parseArgs();

  if (options.help) {
    echo`${HELP}`;
    process.exit(0);
  }

  // network preset: local
  if (networkPreset === "local") {
    options.chainId ??= 31337;
    options.deployer ??= ANVIL_FIRST_ACCOUNT;
    options.rpcUrl ??= "http://localhost:8545";
  }

  // network preset: liquity-testnet
  if (networkPreset === "liquity-testnet") {
    options.chainId ??= 1337;
    options.rpcUrl ??= "https://testnet.liquity.org/rpc";
    options.verifier ??= "sourcify";
    options.verifierUrl ??= "https://testnet.liquity.org/sourcify/server";
  }

  // network preset: mainnet
  if (networkPreset === "mainnet") {
    options.chainId ??= 1;
  }

  options.verifier ??= "etherscan";

  // handle missing options
  if (!options.chainId) {
    throw new Error("--chain-id <CHAIN_ID> is required");
  }
  if (!options.rpcUrl) {
    throw new Error("--rpc-url <RPC_URL> is required");
  }
  if (!options.deployer) {
    throw new Error("--deployer <DEPLOYER> is required");
  }
  if (options.verify && options.verifier === "etherscan" && !options.etherscanApiKey) {
    throw new Error(
      "Verifying with Etherscan requires --etherscan-api-key <ETHERSCAN_API_KEY>",
    );
  }

  const forgeArgs: string[] = [
    "script",
    "src/scripts/DeployLiquity2.s.sol",
    "--chain-id",
    String(options.chainId),
    "--rpc-url",
    options.rpcUrl,
    "--broadcast",
  ];

  // verify
  if (options.verify) {
    forgeArgs.push("--verify");

    // Etherscan API key
    if (options.etherscanApiKey) {
      forgeArgs.push("--etherscan-api-key");
      forgeArgs.push(options.etherscanApiKey);
    }

    // verifier
    if (options.verifier) {
      forgeArgs.push("--verifier");
      forgeArgs.push(options.verifier);
    }

    // verifier URL
    if (options.verifierUrl) {
      forgeArgs.push("--verifier-url");
      forgeArgs.push(options.verifierUrl);
    }
  }

  // Ledger signing
  if (options.deployer.startsWith("0x") && options.deployer.length === 42) {
    forgeArgs.push("--ledger");
    if (options.ledgerPath) {
      forgeArgs.push("--hd-paths");
      forgeArgs.push(options.ledgerPath);
    }
  }

  echo`
Deploying Liquity contracts with the following settings:

  CHAIN_ID:           ${options.chainId}
  DEPLOYER:           ${options.deployer}
  LEDGER_PATH:        ${options.ledgerPath}
  ETHERSCAN_API_KEY:  ${options.etherscanApiKey && "(secret)"}
  OPEN_DEMO_TROVES:   ${options.openDemoTroves ? "yes" : "no"}
  RPC_URL:            ${options.rpcUrl}
  VERIFY:             ${options.verify ? "yes" : "no"}
  VERIFIER:           ${options.verifier}
  VERIFIER_URL:       ${options.verifierUrl}
`;

  const envVars = [
    `DEPLOYER=${options.deployer}`,
  ];

  if (options.openDemoTroves) {
    envVars.push("OPEN_DEMO_TROVES=true");
  }

  // deploy
  await $`${envVars} forge ${forgeArgs}`;

  const deployedContracts = await getDeployedContracts(
    `broadcast/DeployLiquity2.s.sol/${options.chainId}/run-latest.json`,
  );

  // XXX hotfix: we were leaking Github secrets in "deployer"
  // TODO: check if "deployer" is a private key, and calculate its address and use it instead?
  const { deployer, ...safeOptions } = options;

  // write env file
  await fs.writeJson("deployment-context-latest.json", {
    options: safeOptions,
    deployedContracts: Object.fromEntries(deployedContracts),
  });

  // format deployed contracts
  const longestContractName = Math.max(
    ...deployedContracts.map(([name]) => name.length),
  );
  const deployedContractsFormatted = deployedContracts
    .map(([name, address]) => `${name.padEnd(longestContractName)}  ${address}`)
    .join("\n");

  echo("Contract deployment complete.");
  echo("");
  echo(deployedContractsFormatted);
  echo("");
}

function isDeploymentLog(log: unknown): log is {
  transactions: Array<{
    transactionType: "CREATE";
    contractName: string;
    contractAddress: string;
  }>;
} {
  return (
    typeof log === "object"
    && log !== null
    && "transactions" in log
    && Array.isArray(log.transactions)
    && log.transactions
      .filter((tx) => (
        typeof tx === "object"
        && tx !== null
        && tx.transactionType === "CREATE"
      ))
      .every((tx) => (
        typeof tx.contractName === "string"
        && typeof tx.contractAddress === "string"
      ))
  );
}

async function getDeployedContracts(jsonPath: string) {
  const latestRun = await fs.readJson(jsonPath);

  if (isDeploymentLog(latestRun)) {
    return latestRun.transactions
      .filter((tx) => tx.transactionType === "CREATE")
      .map((tx) => [tx.contractName, tx.contractAddress]);
  }

  throw new Error("Invalid deployment log: " + JSON.stringify(latestRun));
}

function argInt(name: string) {
  return typeof argv[name] === "number" ? parseInt(argv[name], 10) : undefined;
}

function argBoolean(name: string) {
  // allow "false"
  return argv[name] === "false" ? false : Boolean(argv[name]);
}

async function parseArgs() {
  const options = {
    chainId: argInt("chain-id"),
    deployer: argv["deployer"],
    etherscanApiKey: argv["etherscan-api-key"],
    help: "help" in argv || "h" in argv,
    ledgerPath: argv["ledger-path"],
    openDemoTroves: argBoolean("open-demo-troves"),
    rpcUrl: argv["rpc-url"],
    verify: argBoolean("verify"),
    verifier: argv["verifier"],
    verifierUrl: argv["verifier-url"],
  };

  const [networkPreset] = argv._;

  if (options.chainId === undefined) {
    const chainIdEnv = parseInt(process.env.CHAIN_ID ?? "", 10);
    if (chainIdEnv && isNaN(chainIdEnv)) {
      options.chainId = chainIdEnv;
    }
  }
  options.deployer ??= process.env.DEPLOYER;
  options.etherscanApiKey ??= process.env.ETHERSCAN_API_KEY;
  options.ledgerPath ??= process.env.LEDGER_PATH;
  options.openDemoTroves ??= Boolean(
    process.env.OPEN_DEMO_TROVES && process.env.OPEN_DEMO_TROVES !== "false",
  );
  options.rpcUrl ??= process.env.RPC_URL;
  options.verify ??= Boolean(
    process.env.VERIFY && process.env.VERIFY !== "false",
  );
  options.verifier ??= process.env.VERIFIER;
  options.verifierUrl ??= process.env.VERIFIER_URL;

  return { options, networkPreset };
}
