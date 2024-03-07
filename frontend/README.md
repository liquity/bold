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

Create `.env.local` from the `.env` file and fill in the required values.

```sh
cp .env .env.local
```

## Scripts

```sh
pnpm dev     # run the development server
pnpm build   # build the static app in out/
pnpm fmt     # format the code
pnpm lint    # lint the code
pnpm test    # run the tests
```
