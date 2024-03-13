export const MultiTroveGetter = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_troveManager",
        "type": "address",
        "internalType": "contract TroveManager"
      },
      {
        "name": "_sortedTroves",
        "type": "address",
        "internalType": "contract ISortedTroves"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getMultipleSortedTroves",
    "inputs": [
      {
        "name": "_startIdx",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "_count",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "_troves",
        "type": "tuple[]",
        "internalType": "struct MultiTroveGetter.CombinedTroveData[]",
        "components": [
          {
            "name": "owner",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "debt",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "coll",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "stake",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "snapshotETH",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "snapshotBoldDebt",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
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
        "internalType": "contract TroveManager"
      }
    ],
    "stateMutability": "view"
  }
] as const;