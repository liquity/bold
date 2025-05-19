export const WhitelistAbi = [
  {
    "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
    "stateMutability": "nonpayable",
    "type": "constructor",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "oldOwner",
        "type": "address",
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "newOwner",
        "type": "address",
      },
    ],
    "name": "OwnerChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "newOwner",
        "type": "address",
      },
    ],
    "name": "OwnerNominated",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "callingContract",
        "type": "address",
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "user",
        "type": "address",
      },
    ],
    "name": "WhitelistRemoved",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "callingContract",
        "type": "address",
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "user",
        "type": "address",
      },
    ],
    "name": "Whitelisted",
    "type": "event",
  },
  {
    "inputs": [],
    "name": "acceptOwnership",
    outputs: [],
    "stateMutability": "nonpayable",
    "type": "function",
  },
  {
    "inputs": [
      { "internalType": "address", "name": "callingContract", "type": "address" },
      { "internalType": "address", "name": "user", "type": "address" },
    ],
    "name": "addToWhitelist",
    outputs: [],
    "stateMutability": "nonpayable",
    "type": "function",
  },
  {
    "inputs": [
      { "internalType": "address", "name": "callingContract", "type": "address" },
      { "internalType": "address", "name": "user", "type": "address" },
    ],
    "name": "isWhitelisted",
    outputs: [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [{ "internalType": "address", "name": "_owner", "type": "address" }],
    "name": "nominateNewOwner",
    outputs: [],
    "stateMutability": "nonpayable",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "nominatedOwner",
    outputs: [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "owner",
    outputs: [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [
      { "internalType": "address", "name": "callingContract", "type": "address" },
      { "internalType": "address", "name": "user", "type": "address" },
    ],
    "name": "removeFromWhitelist",
    outputs: [],
    "stateMutability": "nonpayable",
    "type": "function",
  },
] as const;
