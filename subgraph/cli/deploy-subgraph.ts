import YAML from "yaml";
import { $, echo, fs, minimist, path, question } from "zx";

const SUBGRAPH_PATH = path.join(__dirname, "../subgraph.yaml");
const LATEST_DEPLOYMENT_CONTEXT_PATH = path.join(__dirname, "../../contracts/deployment-context-latest.json");

const HELP = `
deploy-subgraph - deploy the Liquity v2 subgraph

Usage:
  ./deploy-subgraph [NETWORK_PRESET] [OPTIONS]

Arguments:
  NETWORK_PRESET  A network preset, which is a shorthand for setting certain options.
                  Options take precedence over network presets. Available presets:
                  - local: Deploy to a local network
                  - mainnet: Deploy to the Ethereum mainnet (not implemented)
                  - liquity-testnet: Deploy to the Liquity v2 testnet (not implemented)


Options:
  --create                                 Create the subgraph before deploying.
  --debug                                  Show debug output.
  --graph-node <GRAPH_NODE_URL>            The Graph Node URL to use.
  --help, -h                               Show this help message.
  --ipfs-node <IPFS_NODE_URL>              The IPFS node URL to use.
  --name <SUBGRAPH_NAME>                   The subgraph name to use.
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
    "version",
  ],
});

export async function main() {
  const { networkPreset, options } = await parseArgs();

  if (options.help) {
    echo`${HELP}`;
    process.exit(0);
  }

  options.name ??= "liquity2/liquity2";

  // network preset: local
  if (networkPreset === "local") {
    options.graphNode ??= "http://localhost:8020/";
    options.ipfsNode ??= "http://localhost:5001/";
  }

  // network preset: liquity-testnet
  if (networkPreset === "liquity-testnet") {
    // TODO: implement
  }

  // network preset: mainnet
  if (networkPreset === "mainnet") {
    // TODO: implement
  }

  // handle missing options
  if (!options.graphNode) {
    throw new Error("--graph-node <GRAPH_NODE_URL> is required");
  }
  if (!options.name) {
    throw new Error("--name <SUBGRAPH_NAME> is required");
  }
  if (!options.version) {
    throw new Error("--version <SUBGRAPH_VERSION> is required");
  }
  if (!options.ipfsNode) {
    throw new Error("--ipfs-node <IPFS_NODE_URL> is required");
  }

  const graphCreateCommand: null | string[] = !options.create ? null : [
    "graph",
    "create",
    "--node",
    options.graphNode,
    options.name,
  ];

  const graphDeployCommand: string[] = [
    "graph",
    "deploy",
    "--node",
    options.graphNode,
    "--ipfs",
    options.ipfsNode,
    options.name,
    "--version-label",
    options.version,
  ];

  await updateDeclarationWithLatestBoldToken();

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

  if (graphCreateCommand) {
    await $`pnpm ${graphCreateCommand}`;
  }

  await $`pnpm ${graphDeployCommand}`;

  echo("Subgraph deployment complete.");
  echo("");
}

async function parseArgs() {
  const options = {
    debug: argv["debug"],
    help: argv["help"],
    create: argv["create"],
    graphNode: argv["graph-node"],
    ipfsNode: argv["ipfs-node"],
    name: argv["name"],
    version: argv["version"],
  };

  const [networkPreset] = argv._;

  return { options, networkPreset };
}

async function updateDeclarationWithLatestBoldToken() {
  const declaration = subgraphDeclaration();
  const latestDeploymentContext = getLatestDeploymentContext();

  const deployedAddress = latestDeploymentContext?.protocolContracts.BoldToken;
  if (!deployedAddress || (declaration.boldTokenAddress === deployedAddress)) {
    return;
  }

  const answer = await question(
    `\nNew BoldToken detected (${deployedAddress}). Update subgraph.yaml? [Y/n] `,
  );

  const confirmed = answer === "" || answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";

  if (!confirmed) {
    return;
  }

  declaration.updateBoldTokenAddress(deployedAddress);
  console.log("");
  console.log("Subgraph declaration updated with CollateralRegistry:", deployedAddress);
}

function subgraphDeclaration() {
  const declaration = YAML.parse(fs.readFileSync(SUBGRAPH_PATH, "utf8"));
  const boldToken = declaration.dataSources.find((ds: any) => ds.name === "BoldToken");
  return {
    boldTokenAddress: boldToken.source.address,
    updateBoldTokenAddress: (address: string) => {
      const updatedDeclaration = {
        ...declaration,
        dataSources: declaration.dataSources.map((ds: any) => (
          ds.name === "BoldToken"
            ? { ...ds, source: { ...ds.source, address } }
            : ds
        )),
      };
      fs.writeFileSync(
        SUBGRAPH_PATH,
        YAML.stringify(updatedDeclaration, { lineWidth: 120 }),
      );
    },
  };
}

function getLatestDeploymentContext() {
  try {
    return JSON.parse(fs.readFileSync(LATEST_DEPLOYMENT_CONTEXT_PATH, "utf8"));
  } catch (_) {
    return null;
  }
}
