# Instructions

## Requirements

- [Node.js](https://nodejs.org/) (v20 or later)
- [pnpm](https://pnpm.io/) (v8)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

## Dependencies

```sh
git clone git@github.com:liquity/bold.git
cd bold
pnpm install # install dependencies for all packages
cd contracts
forge install # install the contracts dependencies
```

## Local setup

```sh
# Run the anvil local node (keep it running in a separate terminal):
anvil

# Build & deploy the contracts:
cd contracts
./deploy local --open-demo-troves # optionally open troves for the first 8 anvil accounts

# Print the addresses of the deployed contracts (you will need them later):
pnpm tsx utils/deployment-manifest-to-app-env.ts deployment-manifest.json

# We are now ready to copy the deployed contracts to the app:
cd ../frontend/app

# Copy the example .env file:
cp .env .env.local

# Edit the .env.local file:
#  - Make sure the Hardhat / Anvil section is uncommented.
#  - Paste into it the addresses printed by command above.

# Run the app development server:
pnpm dev

# You can now open https://localhost:3000 in your browser.
```

See [frontend/app/README.md](./frontend/app/README.md) for more details about the app development.
