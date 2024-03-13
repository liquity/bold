export const BorrowerOperations = [
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
    "name": "addColl",
    "inputs": [],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "adjustTrove",
    "inputs": [
      {
        "name": "_maxFeePercentage",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_collWithdrawal",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_boldChange",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_isDebtIncrease",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "adjustTroveInterestRate",
    "inputs": [
      {
        "name": "_newAnnualInterestRate",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_upperHint",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_lowerHint",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "boldToken",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IBoldToken"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claimCollateral",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "closeTrove",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
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
    "name": "getCompositeDebt",
    "inputs": [
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
    "name": "moveETHGainToTrove",
    "inputs": [
      {
        "name": "_borrower",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "openTrove",
    "inputs": [
      {
        "name": "_maxFeePercentage",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_boldAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_upperHint",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_lowerHint",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_annualInterestRate",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
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
    "name": "repayBold",
    "inputs": [
      {
        "name": "_boldAmount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setAddresses",
    "inputs": [
      {
        "name": "_troveManagerAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_activePoolAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_defaultPoolAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_stabilityPoolAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_gasPoolAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_collSurplusPoolAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_priceFeedAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_sortedTrovesAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_boldTokenAddress",
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
    "type": "function",
    "name": "withdrawBold",
    "inputs": [
      {
        "name": "_maxFeePercentage",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_boldAmount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawColl",
    "inputs": [
      {
        "name": "_collWithdrawal",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "ActivePoolAddressChanged",
    "inputs": [
      {
        "name": "_activePoolAddress",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BoldBorrowingFeePaid",
    "inputs": [
      {
        "name": "_borrower",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "_boldFee",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BoldTokenAddressChanged",
    "inputs": [
      {
        "name": "_boldTokenAddress",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CollSurplusPoolAddressChanged",
    "inputs": [
      {
        "name": "_collSurplusPoolAddress",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DefaultPoolAddressChanged",
    "inputs": [
      {
        "name": "_defaultPoolAddress",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "GasPoolAddressChanged",
    "inputs": [
      {
        "name": "_gasPoolAddress",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
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
    "name": "PriceFeedAddressChanged",
    "inputs": [
      {
        "name": "_newPriceFeedAddress",
        "type": "address",
        "indexed": false,
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
    "name": "StabilityPoolAddressChanged",
    "inputs": [
      {
        "name": "_stabilityPoolAddress",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TroveCreated",
    "inputs": [
      {
        "name": "_borrower",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "arrayIndex",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TroveManagerAddressChanged",
    "inputs": [
      {
        "name": "_newTroveManagerAddress",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TroveUpdated",
    "inputs": [
      {
        "name": "_borrower",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "_debt",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_coll",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "stake",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "operation",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum BorrowerOperations.BorrowerOperation"
      }
    ],
    "anonymous": false
  }
] as const;