# Liquity V2 App

## Preview

<https://liquity2-sepolia.vercel.app/>

## Requirements

- [Node.js](https://nodejs.org/) (v20 or later)
- [pnpm](https://pnpm.io/) (v8)

## Dependencies

```sh
git clone git@github.com:liquity/bold.git
cd bold
pnpm install # install dependencies for all packages
```

## How to develop

Copy the `.env` file to `.env.local`:

```sh
cp .env .env.local
```

Edit the `.env.local` file to set the environment variables.

Run the development server:

```sh
cd bold/frontend/app
pnpm build-deps # only needed once
pnpm dev
```

You can now open <http://localhost:3000/> in your browser.

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

### `NEXT_PUBLIC_ACCOUNT_SCREEN`

Enable or disable the account screen (meant for testing purposes).

```dosini
# Example
NEXT_PUBLIC_ACCOUNT_SCREEN=false
```

### `NEXT_PUBLIC_APP_COMMIT_URL`

The URL template for linking to specific app commits in the repository. Set to `false` to disable.

```dosini
# Format
NEXT_PUBLIC_APP_COMMIT_URL=https://url_template_with_{commit}

# Example (default)
NEXT_PUBLIC_APP_COMMIT_URL=https://github.com/liquity/bold/tree/{commit}
```

### `NEXT_PUBLIC_APP_VERSION_URL`

The URL template for linking to specific app version releases. Set to `false` to disable.

```dosini
# Format
NEXT_PUBLIC_APP_VERSION_URL=https://url_template_with_{version}

# Example (default)
NEXT_PUBLIC_APP_VERSION_URL=https://github.com/liquity/bold/releases/tag/%40liquity2%2Fapp-v{version}
```

### `NEXT_PUBLIC_CONTRACTS_COMMIT_URL`

The URL template for linking to specific contract commits in the repository. Set to `false` to disable.

```dosini
# Format
NEXT_PUBLIC_CONTRACTS_COMMIT_URL=https://url_template_with_{commit}

# Example (default)
NEXT_PUBLIC_CONTRACTS_COMMIT_URL=https://github.com/liquity/bold/tree/{commit}
```

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

### `NEXT_PUBLIC_BLOCKING_LIST`

Smart contract address for the blocking list implementation. The contract must implement `isBlackListed(address)(bool)`.

```dosini
# Example
NEXT_PUBLIC_BLOCKING_LIST=0x97044531D0fD5B84438499A49629488105Dc58e6
```

### `NEXT_PUBLIC_BLOCKING_VPNAPI`

VPNAPI.io detection to only allow certain country codes.

```dosini
# Format
NEXT_PUBLIC_BLOCKING_VPNAPI=key|countryCodes

# Example
NEXT_PUBLIC_BLOCKING_VPNAPI=1234|US,CA
```

### `NEXT_PUBLIC_DELEGATE_AUTO`

The default delegate address to use for the interest rate automated strategy.

```dosini
# Example
NEXT_PUBLIC_DELEGATE_AUTO=0x0000000000000000000000000000000000000000
```

### `NEXT_PUBLIC_DEPLOYMENT_FLAVOR`

Indicates a specific deployment variant (e.g., "preview"). This will be displayed in the app header.

```dosini
# Example
NEXT_PUBLIC_DEPLOYMENT_FLAVOR=preview
```

### `NEXT_PUBLIC_KNOWN_INITIATIVES_URL`

URL for fetching known initiatives data (optional).

### `NEXT_PUBLIC_LIQUITY_STATS_URL`

URL for fetching Liquity protocol statistics.

```dosini
# Example
NEXT_PUBLIC_LIQUITY_STATS_URL=https://api.liquity.org/v2/testnet/sepolia.json
```

### `NEXT_PUBLIC_LIQUITY_GOVERNANCE_URL`

Optional base URL for fetching Liquity governance allocation snapshots, such as those generated by [api.liquity.org](https://github.com/liquity/api.liquity.org/blob/main/src/snapshot.ts). Defaults to `https://api.liquity.org/v2/governance` when undefined. When set to an empty string, the data will be fetched from the subgraph.

```dosini
# Example
NEXT_PUBLIC_LIQUITY_GOVERNANCE_URL=https://api.liquity.org/v2/governance
```

### `NEXT_PUBLIC_SAFE_API_URL`

URL for the Safe transaction service API.

```dosini
# Example
NEXT_PUBLIC_SAFE_API_URL=https://safe-transaction-mainnet.safe.global/api
```

### `NEXT_PUBLIC_SUBGRAPH_URL`

URL for The Graph protocol subgraph queries.

```dosini
# Example
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/…
```

### `NEXT_PUBLIC_VERCEL_ANALYTICS`

Enable or disable Vercel Analytics for tracking application metrics.

```dosini
# Example
NEXT_PUBLIC_VERCEL_ANALYTICS=false
```

### `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`

A WalletConnect project ID which can be obtained by [creating a WalletConnect project](https://cloud.walletconnect.com/app).

### `NEXT_PUBLIC_TROVE_EXPLORER_<N>`

An optional set of names and URLs (of the form `<name>|<url>`) of external apps capable of showing a Trove's history. May include the parameters `{branch}` and `{troveId}`, which will be replaced by the name of the Trove's collateral type (`ETH`, `wstETH` or `rETH`) and its numeric ID (the NFT's token ID), respectively.

Currently, only the indices `_0` and `_1` are supported.

Defaults to the following values:
```dosini
NEXT_PUBLIC_TROVE_EXPLORER_0=DeFi Explore|https://liquityv2.defiexplore.com/trove/{branch}/{troveId}
NEXT_PUBLIC_TROVE_EXPLORER_1=Rails|https://rails.finance/explorer/trove/{troveId}/{branch}
```

To disable a Trove explorer, set the corresponding variable to an empty string in `.env.local`.

### `NEXT_PUBLIC_CONTRACT_…`

Addresses of the Liquity contracts.

</details>

## Folder Structure

```
src/
  abi/         # ABIs of the Liquity contracts
  app/         # The Next.js app (mostly routing only)
  comps/       # UI Components
  screens/     # App Screens (used by /app routing components)
  services/    # Service Components
  tx-flows/    # Transaction Flows
```
