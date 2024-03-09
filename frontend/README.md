# BOLD App

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

## Environment

Create `.env.local` from the `.env` file and fill in the required values (see the description of each variable below).

```sh
cp .env .env.local
```

See [./src/env.ts](./src/env.ts) for details about how the environment variables are being imported by the app.

### `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`

A WalletConnect project ID which can be obtained by [creating a WalletConnect project](https://cloud.walletconnect.com/app).

## Scripts

```sh
pnpm dev     # run the development server
pnpm build   # build the static app in out/
pnpm fmt     # format the code
pnpm lint    # lint the code
pnpm test    # run the tests
```
