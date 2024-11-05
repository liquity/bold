# Liquity v2 Subgraph

## Run the subgraph locally

```sh
# 1. Run anvil
anvil --host 0.0.0.0 --gas-limit 100000000000 --base-fee 1

# 2. Deploy the contracts
cd contracts
./deploy local
# use --open-demo-troves to start with some demo data:
# ./deploy local --open-demo-troves

# 3. Run the graph node
cd subgraph
./start-graph
# use --reset to clear the state:
# ./start-graph --reset

# 4. Deploy the subgraph
cd subgraph
# Note: this script detects if new versions of the contract it needs
# have been deployed, and will automatically update their addresses in the
# subgraph.yaml file (after confirmation).
./deploy-subgraph local --version v1 --create
```

## Contracts addresses

The addresses and networks of the `subgraph.yaml` file are generated from the `networks.json` file.

Addresses of the zapper and initial initiatives should be updated in the `addresses.ts` file.
