# Liquity V2 Development & Deployment Guide

This guide will walk you through setting up, building, and deploying the Liquity application locally.

## Prerequisites

Before you begin, ensure you have the following tools installed:

- [Node.js](https://nodejs.org/) (v20 or later)
- [pnpm](https://pnpm.io/) (v8)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (required for contract development)

## Getting started

Clone the repository:

```bash
git clone git@github.com:liquity/bold.git
cd bold
```

Install the npm dependencies for all the packages in the repo:

```bash
pnpm install
```

If you are developing contracts, install the Foundry dependencies:

```bash
cd contracts
forge install
```

## Build the app for production

To build the app for production, start by copying the `.env` file (provided as an example) to `.env.local`:

```sh
cd frontend/app
cp .env .env.local
```

Edit the newly created `.env.local` to set the app [environment variables](./frontend/app/README.md#environment). The `NEXT_PUBLIC_SUBGRAPH_URL` need to be set manually. You might want to create a [GraphSeer](https://beta.graphseer.com/) account to get an API key.

Optional: you can generate a set of contract addresses for the `.env.local` file by running the following command:

```bash
cd contracts
# Replace the address file with the one you want to use
pnpm tsx ./utils/deployment-manifest-to-app-env.ts ./addresses/11155111.json
```

This is useful if you want to use a different set of contracts than the ones provided in the default `.env` file.

You can now build the app for production:

```bash
cd frontend/app
pnpm build-deps # only needed the first time
pnpm build
```

The app will be built in the `out/` directory which can be deployed to any static hosting service.

Note: your server must be configured to serve .html files by default. If you are using Vercel, this is done automatically. If your server does not support this, you can build the app with a separate directory for each route:

```bash
NEXT_TRAILING_SLASH=1 pnpm build
```

## Local development setup

Follow these steps to set up your local development environment:

#### Start the local node

```bash
# In a separate terminal window
anvil
```

#### Deploy the contracts

```bash
cd contracts
./deploy local --open-demo-troves  # Creates test troves for first 8 anvil accounts
```

#### Get the contract addresses

```bash
pnpm tsx utils/deployment-manifest-to-app-env.ts deployment-manifest.json
```

> **Note:** Save the output - you’ll need these addresses for the next step.

#### Configure the frontend

```bash
cd frontend/app
cp .env .env.local
```

Edit `.env.local`:

- Uncomment the Hardhat / Anvil section
- Add the contract addresses from the previous step

#### Start the development server

```bash
pnpm dev
```

> Your app should now be running at [https://localhost:3000](https://localhost:3000)

For more detailed information about app development, refer to the [app README](./frontend/app/README.md).
