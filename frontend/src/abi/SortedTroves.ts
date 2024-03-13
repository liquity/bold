export const SortedTroves = [
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
    "name": "borrowerOperationsAddress",
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
    "name": "contains",
    "inputs": [
      {
        "name": "_id",
        "type": "address",
        "internalType": "address"
      }
    ],
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
    "name": "data",
    "inputs": [],
    "outputs": [
      {
        "name": "head",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "tail",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "maxSize",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "size",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "findInsertPosition",
    "inputs": [
      {
        "name": "_annualInterestRate",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_prevId",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_nextId",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
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
    "name": "getFirst",
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
    "name": "getLast",
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
    "name": "getMaxSize",
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
    "name": "getNext",
    "inputs": [
      {
        "name": "_id",
        "type": "address",
        "internalType": "address"
      }
    ],
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
    "name": "getPrev",
    "inputs": [
      {
        "name": "_id",
        "type": "address",
        "internalType": "address"
      }
    ],
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
    "name": "getSize",
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
    "name": "insert",
    "inputs": [
      {
        "name": "_id",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_annualInterestRate",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_prevId",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_nextId",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isEmpty",
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
    "name": "isFull",
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
    "name": "reInsert",
    "inputs": [
      {
        "name": "_id",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_newAnnualInterestRate",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_prevId",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_nextId",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "remove",
    "inputs": [
      {
        "name": "_id",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setParams",
    "inputs": [
      {
        "name": "_size",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_troveManagerAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_borrowerOperationsAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
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
    "name": "validInsertPosition",
    "inputs": [
      {
        "name": "_annualInterestRate",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_prevId",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_nextId",
        "type": "address",
        "internalType": "address"
      }
    ],
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
    "type": "event",
    "name": "BorrowerOperationsAddressChanged",
    "inputs": [
      {
        "name": "_borrowerOperationsAddress",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "NodeAdded",
    "inputs": [
      {
        "name": "_id",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "_annualInterestRate",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "NodeRemoved",
    "inputs": [
      {
        "name": "_id",
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