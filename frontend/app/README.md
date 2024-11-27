# Nerite App

## Preview

<https://liquity2.vercel.app/>

## Requirements

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)

## Setup

```sh
git clone git@github.com:liquity/bold.git
cd bold
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
cd bold/frontend/app
pnpm build-deps # only needed once
pnpm dev
```

You can now open <http://localhost:3000/> in your browser.

See also `contracts/hardhatAccountsList2k.js` to import the accounts into MetaMask (the deployment script opens troves for the first six accounts).

## Scripts

```sh
pnpm build                  # build the static app in out/
pnpm build-deps             # build all the dependencies needed by the app
pnpm build-graphql          # update the code generated from the GraphQL queries
pnpm build-panda            # update the code generated from the Panda CSS config
pnpm build-uikit            # builds the UI kit in ../uikit
pnpm dev                    # run the development server
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

<details>
<summary>Supported Variables</summary>

### `NEXT_PUBLIC_CHAIN_ID`

The Ethereum network to connect to.

```dosini
# Example
NEXT_PUBLIC_CHAIN_ID=1
```

### `NEXT_PUBLIC_CHAIN_NAME`

The name of the Ethereum network.

```dosini
# Example
NEXT_PUBLIC_CHAIN_NAME=Ethereum
```

### `NEXT_PUBLIC_CHAIN_CURRENCY`

The currency of the Ethereum network.

```dosini
# Format
NEXT_PUBLIC_CHAIN_CURRENCY=name|symbol|decimals

# Example
NEXT_PUBLIC_CHAIN_CURRENCY=Ether|ETH|18
```

### `NEXT_PUBLIC_CHAIN_RPC_URL`

The RPC URL for the Ethereum network.

```dosini
# Example
NEXT_PUBLIC_CHAIN_RPC_URL=https://cloudflare-eth.com
```

### `NEXT_PUBLIC_CHAIN_BLOCK_EXPLORER`

The block explorer for the Ethereum network. Optional.

```dosini
# Format
NEXT_PUBLIC_CHAIN_BLOCK_EXPLORER=name|url

# Example
NEXT_PUBLIC_CHAIN_BLOCK_EXPLORER=Etherscan|https://etherscan.io
```

### `NEXT_PUBLIC_CHAIN_CONTRACT_ENS_REGISTRY`

The address of the ENS registry contract. Optional.

```dosini
# Format
NEXT_PUBLIC_CHAIN_CONTRACT_ENS_REGISTRY=address

# Example
NEXT_PUBLIC_CHAIN_CONTRACT_ENS_REGISTRY=0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
```

### `NEXT_PUBLIC_CHAIN_CONTRACT_ENS_RESOLVER`

The address of the ENS resolver contract. Optional.

```dosini
# Format
NEXT_PUBLIC_CHAIN_CONTRACT_ENS_RESOLVER=address|blockCreated

# Example
NEXT_PUBLIC_CHAIN_CONTRACT_ENS_RESOLVER=0xce01f8eee7E479C928F8919abD53E553a36CeF67|19258213
```

### `NEXT_PUBLIC_CHAIN_CONTRACT_MULTICALL`

The address of the Multicall contract. Optional.

```dosini
# Format
NEXT_PUBLIC_CHAIN_CONTRACT_MULTICALL=address|blockCreated

# Example
NEXT_PUBLIC_CHAIN_CONTRACT_MULTICALL=0xca11bde05977b3631167028862be2a173976ca11|14353601
```

### `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`

A WalletConnect project ID which can be obtained by [creating a WalletConnect project](https://cloud.walletconnect.com/app).

### `NEXT_PUBLIC_CONTRACT_…`

Addresses of the Liquity contracts.

</details>

## Folder Structure

```
src/
  abi/         # ABIs of the Liquity contracts
  app/         # The Next.js app (mostly routing only)
  comps/       # UI Components
  demo-mode/   # Files related to the app running in demo mode
  screens/     # App Screens (used by /app routing components)
  services/    # Service Components
  tx-flows/    # Transaction Flows
```
