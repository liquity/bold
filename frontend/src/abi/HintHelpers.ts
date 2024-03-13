export const HintHelpers = [
  {
    "type": "function",
    "name": "BOLD_GAS_COMPENSATION",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "BORROWING_FEE_FLOOR",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "CCR",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "DECIMAL_PRECISION",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_ANNUAL_INTEREST_RATE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MCR",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_NET_DEBT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "NAME",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PERCENT_DIVISOR",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "_100pct",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "activePool",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IActivePool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "computeCR",
    "inputs": [
      {
        "name": "_coll",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_debt",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_price",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "computeNominalCR",
    "inputs": [
      {
        "name": "_coll",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_debt",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "defaultPool",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IDefaultPool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getApproxHint",
    "inputs": [
      {
        "name": "_CR",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_numTrials",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_inputRandomSeed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "hintAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "diff",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "latestRandomSeed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEntireSystemColl",
    "inputs": [],
    "outputs": [
      {
        "name": "entireSystemColl",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEntireSystemDebt",
    "inputs": [],
    "outputs": [
      {
        "name": "entireSystemDebt",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRedemptionHints",
    "inputs": [
      {
        "name": "_boldamount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_price",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_maxIterations",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "firstRedemptionHint",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "partialRedemptionHintNICR",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "truncatedBoldamount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isOwner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "priceFeed",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IPriceFeed"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setAddresses",
    "inputs": [
      {
        "name": "_sortedTrovesAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_troveManagerAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "sortedTroves",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ISortedTroves"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "troveManager",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ITroveManager"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SortedTrovesAddressChanged",
    "inputs": [
      {
        "name": "_sortedTrovesAddress",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TroveManagerAddressChanged",
    "inputs": [
      {
        "name": "_troveManagerAddress",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  }
] as const;