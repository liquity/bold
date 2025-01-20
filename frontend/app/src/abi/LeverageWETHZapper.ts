// this file was generated by scripts/update-liquity-abis.ts
// please do not edit it manually
export const LeverageWETHZapper = [
  {
    "type": "constructor",
    "inputs": [{ "name": "_addressesRegistry", "type": "address", "internalType": "contract IAddressesRegistry" }, {
      "name": "_flashLoanProvider",
      "type": "address",
      "internalType": "contract IFlashLoanProvider",
    }, { "name": "_exchange", "type": "address", "internalType": "contract IExchange" }],
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
    "name": "addCollWithRawETH",
    "inputs": [{ "name": "_troveId", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "payable",
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
    "stateMutability": "payable",
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
    "name": "closeTroveFromCollateral",
    "inputs": [{ "name": "troveId", "type": "uint256", "internalType": "uint256" }, {
      "name": "flashLoanAmount",
      "type": "uint256",
      "internalType": "uint256",
    }],
    "outputs": [],
    "stateMutability": "nonpayable",
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
    "name": "exchange",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IExchange" }],
    "stateMutability": "view",
  },
  {
    "type": "function",
    "name": "flashLoanProvider",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IFlashLoanProvider" }],
    "stateMutability": "view",
  },
  {
    "type": "function",
    "name": "leverDownTrove",
    "inputs": [{
      "name": "_params",
      "type": "tuple",
      "internalType": "struct ILeverageZapper.LeverDownTroveParams",
      "components": [{ "name": "troveId", "type": "uint256", "internalType": "uint256" }, {
        "name": "flashLoanAmount",
        "type": "uint256",
        "internalType": "uint256",
      }, { "name": "minBoldAmount", "type": "uint256", "internalType": "uint256" }],
    }],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "leverUpTrove",
    "inputs": [{
      "name": "_params",
      "type": "tuple",
      "internalType": "struct ILeverageZapper.LeverUpTroveParams",
      "components": [
        { "name": "troveId", "type": "uint256", "internalType": "uint256" },
        { "name": "flashLoanAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "boldAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "maxUpfrontFee", "type": "uint256", "internalType": "uint256" },
      ],
    }],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "leverageRatioToCollateralRatio",
    "inputs": [{ "name": "_inputRatio", "type": "uint256", "internalType": "uint256" }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "pure",
  },
  {
    "type": "function",
    "name": "openLeveragedTroveWithRawETH",
    "inputs": [{
      "name": "_params",
      "type": "tuple",
      "internalType": "struct ILeverageZapper.OpenLeveragedTroveParams",
      "components": [
        { "name": "owner", "type": "address", "internalType": "address" },
        { "name": "ownerIndex", "type": "uint256", "internalType": "uint256" },
        { "name": "collAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "flashLoanAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "boldAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "upperHint", "type": "uint256", "internalType": "uint256" },
        { "name": "lowerHint", "type": "uint256", "internalType": "uint256" },
        { "name": "annualInterestRate", "type": "uint256", "internalType": "uint256" },
        { "name": "batchManager", "type": "address", "internalType": "address" },
        { "name": "maxUpfrontFee", "type": "uint256", "internalType": "uint256" },
        { "name": "addManager", "type": "address", "internalType": "address" },
        { "name": "removeManager", "type": "address", "internalType": "address" },
        { "name": "receiver", "type": "address", "internalType": "address" },
      ],
    }],
    "outputs": [],
    "stateMutability": "payable",
  },
  {
    "type": "function",
    "name": "openTroveWithRawETH",
    "inputs": [{
      "name": "_params",
      "type": "tuple",
      "internalType": "struct IZapper.OpenTroveParams",
      "components": [
        { "name": "owner", "type": "address", "internalType": "address" },
        { "name": "ownerIndex", "type": "uint256", "internalType": "uint256" },
        { "name": "collAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "boldAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "upperHint", "type": "uint256", "internalType": "uint256" },
        { "name": "lowerHint", "type": "uint256", "internalType": "uint256" },
        { "name": "annualInterestRate", "type": "uint256", "internalType": "uint256" },
        { "name": "batchManager", "type": "address", "internalType": "address" },
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
    "name": "receiveFlashLoanOnCloseTroveFromCollateral",
    "inputs": [{
      "name": "_params",
      "type": "tuple",
      "internalType": "struct IZapper.CloseTroveParams",
      "components": [{ "name": "troveId", "type": "uint256", "internalType": "uint256" }, {
        "name": "flashLoanAmount",
        "type": "uint256",
        "internalType": "uint256",
      }, { "name": "receiver", "type": "address", "internalType": "address" }],
    }, { "name": "_effectiveFlashLoanAmount", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "receiveFlashLoanOnLeverDownTrove",
    "inputs": [{
      "name": "_params",
      "type": "tuple",
      "internalType": "struct ILeverageZapper.LeverDownTroveParams",
      "components": [{ "name": "troveId", "type": "uint256", "internalType": "uint256" }, {
        "name": "flashLoanAmount",
        "type": "uint256",
        "internalType": "uint256",
      }, { "name": "minBoldAmount", "type": "uint256", "internalType": "uint256" }],
    }, { "name": "_effectiveFlashLoanAmount", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "receiveFlashLoanOnLeverUpTrove",
    "inputs": [{
      "name": "_params",
      "type": "tuple",
      "internalType": "struct ILeverageZapper.LeverUpTroveParams",
      "components": [
        { "name": "troveId", "type": "uint256", "internalType": "uint256" },
        { "name": "flashLoanAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "boldAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "maxUpfrontFee", "type": "uint256", "internalType": "uint256" },
      ],
    }, { "name": "_effectiveFlashLoanAmount", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable",
  },
  {
    "type": "function",
    "name": "receiveFlashLoanOnOpenLeveragedTrove",
    "inputs": [{
      "name": "_params",
      "type": "tuple",
      "internalType": "struct ILeverageZapper.OpenLeveragedTroveParams",
      "components": [
        { "name": "owner", "type": "address", "internalType": "address" },
        { "name": "ownerIndex", "type": "uint256", "internalType": "uint256" },
        { "name": "collAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "flashLoanAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "boldAmount", "type": "uint256", "internalType": "uint256" },
        { "name": "upperHint", "type": "uint256", "internalType": "uint256" },
        { "name": "lowerHint", "type": "uint256", "internalType": "uint256" },
        { "name": "annualInterestRate", "type": "uint256", "internalType": "uint256" },
        { "name": "batchManager", "type": "address", "internalType": "address" },
        { "name": "maxUpfrontFee", "type": "uint256", "internalType": "uint256" },
        { "name": "addManager", "type": "address", "internalType": "address" },
        { "name": "removeManager", "type": "address", "internalType": "address" },
        { "name": "receiver", "type": "address", "internalType": "address" },
      ],
    }, { "name": "_effectiveFlashLoanAmount", "type": "uint256", "internalType": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable",
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
    "name": "withdrawCollToRawETH",
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
    "name": "AddManagerUpdated",
    "inputs": [{ "name": "_troveId", "type": "uint256", "indexed": true, "internalType": "uint256" }, {
      "name": "_newAddManager",
      "type": "address",
      "indexed": false,
      "internalType": "address",
    }],
    "anonymous": false,
  },
  {
    "type": "event",
    "name": "RemoveManagerAndReceiverUpdated",
    "inputs": [{ "name": "_troveId", "type": "uint256", "indexed": true, "internalType": "uint256" }, {
      "name": "_newRemoveManager",
      "type": "address",
      "indexed": false,
      "internalType": "address",
    }, { "name": "_newReceiver", "type": "address", "indexed": false, "internalType": "address" }],
    "anonymous": false,
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
