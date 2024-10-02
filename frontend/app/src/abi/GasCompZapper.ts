// this file was generated by scripts/update-liquity-abis.ts
// please do not edit it manually
export const GasCompZapper = [
  {
    "type": "constructor",
    "inputs": [{ "name": "_addressesRegistry", "type": "address", "internalType": "contract IAddressesRegistry" }],
    "stateMutability": "nonpayable",
  },
  { "type": "receive", "stateMutability": "payable" },
  {
    "type": "function",
    "name": "WETH",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IWETH" }],
    "stateMutability": "view",
  },
  {
    "type": "function",
    "name": "addColl",
    "inputs": [{ "name": "_troveId", "type": "uint256", "internalType": "uint256" }, {
      "name": "_amount",
      "type": "uint256",
      "internalType": "uint256",
    }],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "addManagerOf",
    "inputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view",
  },
  {
    "type": "function",
    "name": "adjustTroveWithRawETH",
    "inputs": [
      { "name": "_troveId", "type": "uint256", "internalType": "uint256" },
      { "name": "_collChange", "type": "uint256", "internalType": "uint256" },
      { "name": "_isCollIncrease", "type": "bool", "internalType": "bool" },
      { "name": "_boldChange", "type": "uint256", "internalType": "uint256" },
      { "name": "_isDebtIncrease", "type": "bool", "internalType": "bool" },
      { "name": "_maxUpfrontFee", "type": "uint256", "internalType": "uint256" },
    ],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "adjustZombieTroveWithRawETH",
    "inputs": [
      { "name": "_troveId", "type": "uint256", "internalType": "uint256" },
      { "name": "_collChange", "type": "uint256", "internalType": "uint256" },
      { "name": "_isCollIncrease", "type": "bool", "internalType": "bool" },
      { "name": "_boldChange", "type": "uint256", "internalType": "uint256" },
      { "name": "_isDebtIncrease", "type": "bool", "internalType": "bool" },
      { "name": "_upperHint", "type": "uint256", "internalType": "uint256" },
      { "name": "_lowerHint", "type": "uint256", "internalType": "uint256" },
      { "name": "_maxUpfrontFee", "type": "uint256", "internalType": "uint256" },
    ],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "boldToken",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IBoldToken" }],
    "stateMutability": "view",
  },
  {
    "type": "function",
    "name": "borrowerOperations",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IBorrowerOperations" }],
    "stateMutability": "view",
  },
  {
    "type": "function",
    "name": "closeTroveToRawETH",
    "inputs": [{ "name": "_troveId", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "collToken",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IERC20" }],
    "stateMutability": "view",
  },
  {
    "type": "function",
    "name": "openTroveWithRawETH",
    "inputs": [{
      "name": "_params",
      "type": "tuple",
      "internalType": "struct GasCompZapper.OpenTroveParams",
      "components": [
        { "name": "owner", "type": "address", "internalType": "address" },
        { "name": "ownerIndex", "type": "uint256", "internalType": "uint256" },
        { "name": "collAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "boldAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "upperHint", "type": "uint256", "internalType": "uint256" },
        { "name": "lowerHint", "type": "uint256", "internalType": "uint256" },
        { "name": "annualInterestRate", "type": "uint256", "internalType": "uint256" },
        { "name": "maxUpfrontFee", "type": "uint256", "internalType": "uint256" },
        { "name": "addManager", "type": "address", "internalType": "address" },
        { "name": "removeManager", "type": "address", "internalType": "address" },
        { "name": "receiver", "type": "address", "internalType": "address" },
      ],
    }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "payable",
  },
  {
    "type": "function",
    "name": "removeManagerReceiverOf",
    "inputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "outputs": [{ "name": "manager", "type": "address", "internalType": "address" }, {
      "name": "receiver",
      "type": "address",
      "internalType": "address",
    }],
    "stateMutability": "view",
  },
  {
    "type": "function",
    "name": "repayBold",
    "inputs": [{ "name": "_troveId", "type": "uint256", "internalType": "uint256" }, {
      "name": "_boldAmount",
      "type": "uint256",
      "internalType": "uint256",
    }],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "setAddManager",
    "inputs": [{ "name": "_troveId", "type": "uint256", "internalType": "uint256" }, {
      "name": "_manager",
      "type": "address",
      "internalType": "address",
    }],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "setRemoveManager",
    "inputs": [{ "name": "_troveId", "type": "uint256", "internalType": "uint256" }, {
      "name": "_manager",
      "type": "address",
      "internalType": "address",
    }],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "setRemoveManagerWithReceiver",
    "inputs": [{ "name": "_troveId", "type": "uint256", "internalType": "uint256" }, {
      "name": "_manager",
      "type": "address",
      "internalType": "address",
    }, { "name": "_receiver", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "troveManager",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract ITroveManager" }],
    "stateMutability": "view",
  },
  {
    "type": "function",
    "name": "withdrawBold",
    "inputs": [{ "name": "_troveId", "type": "uint256", "internalType": "uint256" }, {
      "name": "_boldAmount",
      "type": "uint256",
      "internalType": "uint256",
    }, { "name": "_maxUpfrontFee", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "withdrawColl",
    "inputs": [{ "name": "_troveId", "type": "uint256", "internalType": "uint256" }, {
      "name": "_amount",
      "type": "uint256",
      "internalType": "uint256",
    }],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "event",
    "name": "TroveNFTAddressChanged",
    "inputs": [{ "name": "_newTroveNFTAddress", "type": "address", "indexed": false, "internalType": "address" }],
    "anonymous": false,
  },
  { "type": "error", "name": "EmptyManager", "inputs": [] },
  { "type": "error", "name": "NotBorrower", "inputs": [] },
  { "type": "error", "name": "NotOwnerNorAddManager", "inputs": [] },
  { "type": "error", "name": "NotOwnerNorRemoveManager", "inputs": [] },
] as const;
