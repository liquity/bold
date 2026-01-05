#!/bin/bash
set -e

echo "🧹 Cleaning up existing processes..."
pkill -9 anvil 2>/dev/null || true
pkill -9 node 2>/dev/null || true
docker compose -f subgraph/docker-compose.yml down 2>/dev/null || true

echo ""
echo "⚡ Starting Anvil blockchain..."
anvil --host 0.0.0.0 --gas-limit 100000000000 --base-fee 1 > /dev/null 2>&1 &
ANVIL_PID=$!
sleep 3

echo "✓ Anvil running on http://localhost:8545"
echo ""

echo "📝 Deploying contracts..."
cd contracts
echo "y" | ./deploy local --open-demo-troves
echo "✓ Contracts deployed"
echo ""

echo "🔧 Updating frontend environment..."
cd ../frontend/app
# Clean and recreate .env.local
cp .env .env.local
echo "NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=local-development-placeholder" >> .env.local
echo "NEXT_PUBLIC_SUBGRAPH_CHECK=false" >> .env.local
cd ../../contracts
pnpm tsx utils/deployment-manifest-to-app-env.ts deployment-manifest.json >> ../frontend/app/.env.local
echo "✓ Environment configured"
echo ""

echo "🐳 Starting Graph Node (Docker)..."
cd ../subgraph
echo "n" | ./start-graph > /dev/null 2>&1 &
GRAPH_PID=$!
echo "⏳ Waiting 30 seconds for Graph Node to initialize..."
sleep 30
echo "✓ Graph Node running"
echo ""

echo "📊 Deploying subgraph..."
./deploy-subgraph local --version v1 --create
echo "✓ Subgraph deployed"
echo ""

echo "🚀 Starting frontend..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ LOCAL ENVIRONMENT READY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Access Points:"
echo "   Frontend:    http://localhost:3000"
echo "   Anvil RPC:   http://localhost:8545"
echo "   GraphQL:     http://localhost:8000/subgraphs/name/liquity2/liquity2"
echo "   Graph Node:  http://localhost:8020"
echo ""
echo "📝 Running processes:"
echo "   Anvil PID:   $ANVIL_PID"
echo "   Graph PID:   $GRAPH_PID"
echo ""
echo "Press Ctrl+C to stop all services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd ../frontend/app
pnpm dev

# Cleanup on exit
trap "echo ''; echo '🛑 Shutting down...'; kill $ANVIL_PID 2>/dev/null || true; docker compose -f ../../subgraph/docker-compose.yml down 2>/dev/null || true; echo '✓ Cleanup complete'" EXIT
