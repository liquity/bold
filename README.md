# Liquity v2

## Requirements

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

## Setup

```sh
git clone git@github.com:liquity/bold.git
cd bold
pnpm install
```

## How to develop

```sh
# Run the anvil local node
anvil

# Deploy the contracts
cd contracts
./deploy local --open-demo-troves # optionally open troves for the first 8 anvil accounts

# Print the addresses of the deployed contracts
pnpm tsx utils/deployment-artifacts-to-app-env.ts deployment-context-latest.json

# Now, the app:
cd ../frontend

# Copy the example .env file
cp .env .env.local

# Edit the .env.local file:
#  - Make sure the Hardhat / Anvil section is uncommented.
#  - Copy into it the addresses printed by the previous command.

# Run the app development server
pnpm dev

# Open https://localhost:3000 in your browser
```
