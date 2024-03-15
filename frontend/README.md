# BOLD App

## Preview

<https://liquity2.vercel.app/>

## Requirements

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)

## Setup

```sh
git clone git@github.com:liquity/bold.git
cd bold/frontend
pnpm install
```

## How to develop

Run the Hardhat Network local node:

```sh
cd bold/contracts
ACCOUNTS_BALANCE=1000 pnpm hardhat node # ACCOUNTS_BALANCE=1000 is optional but nicer than the default values in the UI
```

Deploy the contracts:

```sh
cd bold/contracts
pnpm hardhat run --network localhost utils/deploymentDev.js
```

Copy the addresses of the deployed contracts to the `.env.local` file.

Run the development server:

```sh
cd bold/frontend
pnpm dev
```

You can now open <http://localhost:3000/> in your browser.

See also `contracts/hardhatAccountsList2k.js` to import the accounts into MetaMask (the deployment script opens troves for the first six accounts).

## Scripts

```sh
pnpm dev                    # run the development server
pnpm build                  # build the static app in out/
pnpm fmt                    # format the code
pnpm lint                   # lint the code
pnpm test                   # run the tests
pnpm update-liquity-abis    # build the contracts and update the ABIs
```

## Environment

Create `.env.local` from the `.env` file and fill in the required values (see the description of each variable below).

```sh
cp .env .env.local
```

See [./src/env.ts](./src/env.ts) for details about how the environment variables are being imported by the app.

### `NEXT_PUBLIC_CHAIN_ID`

The Ethereum network to connect to.

Supports the following IDs:

- `1` (mainnet)
- `31337` (hardhat)

Defaults to `1` (mainnet) if the chain ID is not supported.

### `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`

A WalletConnect project ID which can be obtained by [creating a WalletConnect project](https://cloud.walletconnect.com/app).

### `NEXT_PUBLIC_CONTRACT_…`

Addresses of the Liquity contracts.
