# Liquity v2 Subgraph

## Run the subgraph locally

```sh
# 1. Run anvil
anvil --host 0.0.0.0 --gas-limit 100000000000 --base-fee 1

# 2. Deploy the contracts
cd contracts
./deploy-subgraph local
# or with demo troves:
# ./deploy-subgraph local --open-demo-troves

# 3. Run the graph node
cd subgraph
docker-compose up

# 4. Deploy the subgraph
cd subgraph
# Note: this script detects if new versions of the contract it needs
# have been deployed, and will automatically update their addresses in the
# subgraph.yaml file (after confirmation).
./deploy-subgraph local --version v1 --create
```

### Reset the subgraph state

```sh
# 1. Stop docker-compose (Ctrl+C)

# 2. Delete the docker volumes
./docker-cleanup.sh

# 3. Start docker-compose again
cd subgraph
docker-compose up

# 4. Redeploy the subgraph
cd subgraph
./deploy-subgraph local --version v1 --create
```
