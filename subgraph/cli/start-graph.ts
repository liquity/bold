import { $, echo, minimist, question } from "zx";

const HELP = `
start-graph - start a Graph Node

Usage:
  ./start-graph [OPTIONS]

Options:
  --reset                                  Remove all containers and volumes.
  --help, -h                               Show this help message.
`;

const argv = minimist(process.argv.slice(2), {
  alias: {
    h: "help",
  },
  boolean: [
    "reset",
    "help",
  ],
});

async function resetCheck() {
  if (argv.reset) {
    return true;
  }
  const response = (
    await question("Do you want to remove all containers and volumes? [y/N] ")
  ).toLowerCase();
  return response === "y" || response === "yes";
}

export async function main() {
  if (argv.help) {
    echo`${HELP}`;
    process.exit(0);
  }

  $.verbose = true;

  if (await resetCheck()) {
    echo``;
    echo`Stopping and removing containers…`;
    echo``;
    await $`docker compose rm -fsv`;

    echo``;
    echo`Removing volumes…`;
    echo``;
    await $`docker volume rm subgraph_ipfs`;
    await $`docker volume rm subgraph_postgres`;
  }

  echo``;
  echo`Starting Graph Node…`;

  // TODO: handle SIGINT
  // process.on("SIGINT", async () => {
  //   echo`Caught interrupt signal. Shutting down containers…`;
  //   await $`docker compose down`;
  //   process.exit();
  // });

  await $`docker compose up`;
}
