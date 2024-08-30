import { $, echo, fs, minimist } from "zx";

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
  --debug                                  Show debug output.
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

const argv = minimist(process.argv.slice(2), {
  alias: {
    h: "help",
  },
  boolean: [
    "debug",
    "help",
    "open-demo-troves",
    "verify",
  ],
  string: [
    "chain-id",
    "deployer",
    "etherscan-api-key",
    "ledger-path",
    "rpc-url",
    "verifier",
    "verifier-url",
  ],
});

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

  process.env.DEPLOYER = options.deployer;

  if (options.openDemoTroves) {
    process.env.OPEN_DEMO_TROVES = "true";
  }

  if ("CI" in process.env) {
    echo("Workaround: deleting variable 'CI' from environment"); // See https://github.com/liquity/bold/pull/113
    delete process.env.CI;
  }

  // deploy
  const deploymentOutput = await $`forge ${forgeArgs}`;
  if (options.debug) {
    console.log(deploymentOutput.text());
  }

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

type Transaction = { transactionType: string };

function isDeploymentLog(log: unknown): log is { transactions: Transaction[] } {
  return (
    typeof log === "object"
    && log !== null
    && "transactions" in log
    && Array.isArray(log.transactions)
    && (log.transactions as unknown[])
      .every((tx) => (
        typeof tx === "object"
        && tx !== null
        && "transactionType" in tx
        && typeof tx.transactionType === "string"
      ))
  );
}

type ContractCreation = {
  transactionType: "CREATE" | "CREATE2";
  contractName: string;
  contractAddress: string;
};

function isContractCreation(tx: Transaction): tx is ContractCreation {
  return (
    (tx.transactionType === "CREATE" || tx.transactionType === "CREATE2")
    && "contractName" in tx
    && typeof tx.contractName === "string"
    && "contractAddress" in tx
    && typeof tx.contractAddress === "string"
  );
}

async function getDeployedContracts(jsonPath: string) {
  const latestRun = await fs.readJson(jsonPath);

  if (isDeploymentLog(latestRun)) {
    return latestRun.transactions
      .filter(isContractCreation)
      .map((tx) => [tx.contractName, tx.contractAddress]);
  }

  throw new Error("Invalid deployment log: " + JSON.stringify(latestRun));
}

function safeParseInt(value: string) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

async function parseArgs() {
  const options = {
    chainId: safeParseInt(argv["chain-id"]),
    debug: argv["debug"],
    deployer: argv["deployer"],
    etherscanApiKey: argv["etherscan-api-key"],
    help: argv["help"],
    ledgerPath: argv["ledger-path"],
    openDemoTroves: argv["open-demo-troves"],
    rpcUrl: argv["rpc-url"],
    verify: argv["verify"],
    verifier: argv["verifier"],
    verifierUrl: argv["verifier-url"],
  };

  const [networkPreset] = argv._;

  options.chainId ??= safeParseInt(process.env.CHAIN_ID ?? "");
  options.debug ??= Boolean(
    process.env.DEBUG && process.env.DEBUG !== "false",
  );
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
