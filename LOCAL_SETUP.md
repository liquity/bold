# Local Development Setup

## Quick Start (Automated)

The easiest way to start the complete local development environment:

```bash
./start-local.sh
```

This script will automatically:
- ✅ Clean up any existing processes
- ✅ Start Anvil blockchain
- ✅ Deploy smart contracts with demo troves
- ✅ Configure environment variables
- ✅ Start Graph Node (Docker)
- ✅ Deploy and sync subgraph
- ✅ Start frontend development server

**Total startup time:** ~2-3 minutes

Once started, you can access:
- **Frontend:** http://localhost:3000
- **Anvil RPC:** http://localhost:8545
- **GraphQL API:** http://localhost:8000/subgraphs/name/liquity2/liquity2
- **Graph Node:** http://localhost:8020

To stop all services, press `Ctrl+C` in the terminal running the script.

---

## Manual Setup (Step-by-Step)

If you prefer to start services individually:

### 1. Start Anvil (Terminal 1)
```bash
pkill -9 anvil  # Clean up first
anvil --host 0.0.0.0 --gas-limit 100000000000 --base-fee 1
```

### 2. Deploy Contracts (Terminal 2)
```bash
cd contracts
./deploy local --open-demo-troves  # Press 'y' when prompted
pnpm tsx utils/deployment-manifest-to-app-env.ts deployment-manifest.json >> ../frontend/app/.env.local
```

### 3. Start Graph Node (Terminal 3)
```bash
cd subgraph
./start-graph  # Press 'n' when prompted about removing volumes
```

### 4. Deploy Subgraph (Terminal 4)
```bash
cd subgraph
sleep 30  # Wait for Graph Node to initialize
./deploy-subgraph local --version v1 --create
```

### 5. Start Frontend (Terminal 5)
```bash
cd frontend/app
pnpm dev
```

---

## Prerequisites

Ensure you have these installed:
- **Node.js** v18+ (`node --version`)
- **pnpm** (`pnpm --version`)
- **Docker** (`docker --version`)
- **Foundry** with Anvil (`anvil --version`)

---

## Troubleshooting

### "Transaction Failure" when deploying contracts
Anvil has stale state. Kill and restart:
```bash
pkill -9 anvil
anvil --host 0.0.0.0 --gas-limit 100000000000 --base-fee 1
```

### "Module not found: styled-system/css"
Generate PandaCSS types:
```bash
cd frontend/app
pnpm build-panda
```

### "Module not found: @liquity2/uikit"
Build UIKit:
```bash
cd frontend/uikit
pnpm build-panda && pnpm vite build
```

### Subgraph not syncing
Wait 30-60 seconds after deployment. The subgraph needs time to index blocks.

### Graph Node connection refused
Wait 30 seconds after starting Graph Node before deploying subgraph.

---

## Important Notes

1. **Always kill Anvil** before restarting to ensure a fresh blockchain state
2. **Contract addresses change** every time you redeploy, so `.env.local` must be updated
3. **Subgraph takes ~30s** to start syncing after deployment
4. **Graph Node requires Docker** to be running

---

## Key Files Modified During Setup

- `frontend/app/.env.local` - Contains contract addresses and configuration
- `subgraph/networks.json` - Updated with deployed contract addresses
- `subgraph/subgraph.yaml` - Updated with deployed contract addresses

These files are git-ignored as they contain local-specific addresses.
