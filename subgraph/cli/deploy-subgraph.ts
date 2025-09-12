import { $, echo, fs, minimist, path, question } from "zx";

const LATEST_DEPLOYMENT_CONTEXT_PATH = path.join(__dirname, "../../contracts/deployment-context-latest.json");
const NETWORKS_JSON_PATH = path.join(__dirname, "../networks.json");
const GENERATED_NETWORKS_JSON_PATH = path.join(__dirname, "../networks-generated.json");

const HELP = `
deploy-subgraph - deploy the Liquity v2 subgraph

Usage:
  ./deploy-subgraph [NETWORK_PRESET] [OPTIONS]

Arguments:
  NETWORK_PRESET  A network preset, which is a shorthand for setting certain options.
                  Options take precedence over network presets. Available presets:
                  - local: Deploy to a local network
                  - sepolia: Deploy to Ethereum Sepolia
                  - mainnet: Deploy to the Ethereum mainnet (not implemented)
                  - liquity-testnet: Deploy to the Liquity v2 testnet (not implemented)


Options:
  --create                                 Create the subgraph before deploying.
  --debug                                  Show debug output.
  --graph-node <GRAPH_NODE_URL>            The Graph Node URL to use.
  --help, -h                               Show this help message.
  --ipfs-node <IPFS_NODE_URL>              The IPFS node URL to use.
  --name <SUBGRAPH_NAME>                   The subgraph name to use.
  --network <SUBGRAPH_NETWORK>             The subgraph network to use.
  --version <SUBGRAPH_VERSION>             The subgraph version to use.
`;

const argv = minimist(process.argv.slice(2), {
  alias: {
    h: "help",
  },
  boolean: [
    "create",
    "debug",
    "help",
  ],
  string: [
    "graph-node",
    "ipfs-node",
    "name",
    "network",
    "version",
  ],
});

export async function main() {
  const options = {
    debug: argv["debug"],
    help: argv["help"],
    create: argv["create"],
    graphNode: argv["graph-node"],
    ipfsNode: argv["ipfs-node"],
    name: argv["name"],
    network: argv["network"], // subgraph network, not to be confused with the network preset
    version: argv["version"],
  };

  const [networkPreset] = argv._;

  if (options.help) {
    echo`${HELP}`;
    process.exit(0);
  }

  let isLocal = false;

  if (networkPreset === "local") {
    options.name ??= "liquity2/liquity2";
    options.graphNode ??= "http://localhost:8020/";
    options.ipfsNode ??= "http://localhost:5001/";
    options.network ??= "mainnet";
    isLocal = true;
  }
  if (networkPreset === "sepolia") {
    options.name ??= "liquity2-sepolia-preview";
    options.network ??= "sepolia";
  }
  if (networkPreset === "mainnet-relaunch") {
    options.name ??= "liquity-2-relaunch";
    options.network ??= "mainnet";
  }
  if (networkPreset === "mainnet-legacy") {
    options.name ??= "liquity2-mainnet";
    options.network ??= "mainnet";
  }

  if (!options.name) {
    throw new Error("--name <SUBGRAPH_NAME> is required");
  }
  if (!options.network) {
    throw new Error("--network <SUBGRAPH_NETWORK> is required");
  }
  if (!options.graphNode && !options.network) {
    throw new Error("--graph-node <GRAPH_NODE_URL> is required");
  }
  if (!options.ipfsNode && !options.network) {
    throw new Error("--ipfs-node <IPFS_NODE_URL> is required");
  }

  const graphBuildCommand: string[] = [
    "graph",
    "build",
    "--network",
    options.network,
    "--network-file",
    GENERATED_NETWORKS_JSON_PATH,
  ];

  const graphCreateCommand: null | string[] = !options.create ? null : [
    "graph",
    "create",
    ...(options.graphNode ? ["--node", options.graphNode] : []),
    options.name,
  ];

  const graphDeployCommand: string[] = [
    "graph",
    "deploy",
    "--network-file",
    GENERATED_NETWORKS_JSON_PATH,
  ];

  if (options.graphNode) graphDeployCommand.push("--node", options.graphNode);
  if (options.network) graphDeployCommand.push("--network", options.network);
  if (options.version) graphDeployCommand.push("--version-label", options.version);
  if (options.ipfsNode) graphDeployCommand.push("--ipfs", options.ipfsNode);

  graphDeployCommand.push(options.name);

  if (isLocal) {
    await updateNetworksWithLocalBoldToken();
  }

  await generateNetworksJson(isLocal);

  echo`
Deploying subgraph:

  NAME:               ${options.name}
  VERSION:            ${options.version}
  GRAPH NODE:         ${options.graphNode}
  IPFS NODE:          ${options.ipfsNode}
  CREATE:             ${options.create ? "yes" : "no"}
  DEBUG:              ${options.debug ? "yes" : "no"}
`;

  $.verbose = options.debug;

  await $`pnpm ${graphBuildCommand}`;
  echo("");
  echo("Subgraph build complete.");
  echo("");

  if (graphCreateCommand) {
    await $`pnpm ${graphCreateCommand}`;
  }
  echo("");
  echo("Subgraph create complete.");
  echo("");

  await $`pnpm ${graphDeployCommand}`;
  echo("");
  echo("Subgraph deployment complete.");
  echo("");
}

async function generateNetworksJson(isLocal = false) {
  const networksJson = JSON.parse(await fs.readFile(NETWORKS_JSON_PATH, "utf8"));
  return fs.writeFile(
    GENERATED_NETWORKS_JSON_PATH,
    JSON.stringify(
      {
        ...networksJson,
        mainnet: isLocal ? networksJson.local : networksJson.mainnet,
      },
      null,
      2,
    ),
  );
}

async function updateNetworksWithLocalBoldToken() {
  const networksJson = JSON.parse(await fs.readFile(NETWORKS_JSON_PATH, "utf8"));
  const latestDeploymentContext = getLatestDeploymentContext();

  const deployedAddress = latestDeploymentContext?.protocolContracts.BoldToken;
  if (!deployedAddress || (networksJson.local.BoldToken.address === deployedAddress)) {
    return;
  }

  const answer = await question(
    `\nNew BoldToken detected (${deployedAddress}) for local network. Update networks.json? [Y/n] `,
  );

  const confirmed = answer === "" || answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";

  if (!confirmed) {
    return;
  }

  networksJson.local.BoldToken.address = deployedAddress;
  await fs.writeFile(NETWORKS_JSON_PATH, JSON.stringify(networksJson, null, 2));

  console.log("");
  console.log("networks.json updated with local BoldToken:", deployedAddress);
}

function getLatestDeploymentContext() {
  try {
    return JSON.parse(fs.readFileSync(LATEST_DEPLOYMENT_CONTEXT_PATH, "utf8"));
  } catch (_) {
    return null;
  }
}
