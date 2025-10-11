## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

Run tests with `forge test -vvv` to see the console logs, which will show trove URI data.

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

## System Architecture

### Branch ID vs Array Index

**Important:** The system uses stable `branchId` identifiers for collateral branches rather than volatile array indices. This ensures correct operation even when branches are added or removed.

#### Key Components:
- **CollateralRegistry**: Manages collateral branches using `branchId` as the primary key
- **HintHelpers**: Provides hint calculations for trove operations using `branchId`
- **MultiTroveGetter**: Retrieves trove data using `branchId`

#### API Changes:
All functions that previously accepted `_collIndex` (array index) now accept `_branchId` (stable identifier):

```solidity
// Before (deprecated)
hintHelpers.getApproxHint(_collIndex, _interestRate, _numTrials, _inputRandomSeed)

// After (current)
hintHelpers.getApproxHint(_branchId, _interestRate, _numTrials, _inputRandomSeed)
```

This change prevents incorrect TroveManager lookups when branches are added or removed from the system.

## Slither

Create a local Python env and activate it:

```shell
python3 -m venv .venv
source .venv/bin/activate
```

Install slither:

```shell
pip3 install -r requirements.txt
```

Install and use Solidity compiler:

```shell
solc-select install 0.8.18
solc-select use 0.8.18
```

Run slither:

```shell
slither src
```
