export const AddressesRegistry = [
  {
    "inputs": [
      { "internalType": "address", "name": "_owner", "type": "address" },
      { "internalType": "uint256", "name": "_ccr", "type": "uint256" },
      { "internalType": "uint256", "name": "_mcr", "type": "uint256" },
      { "internalType": "uint256", "name": "_bcr", "type": "uint256" },
      { "internalType": "uint256", "name": "_scr", "type": "uint256" },
      {
        "internalType": "uint256",
        "name": "_liquidationPenaltySP",
        "type": "uint256",
      },
      {
        "internalType": "uint256",
        "name": "_liquidationPenaltyRedistribution",
        "type": "uint256",
      },
    ],
    "stateMutability": "nonpayable",
    "type": "constructor",
  },
  { "inputs": [], "name": "AlreadyInitialized", "type": "error" },
  { "inputs": [], "name": "Cooldown", "type": "error" },
  { "inputs": [], "name": "InvalidBCR", "type": "error" },
  { "inputs": [], "name": "InvalidCCR", "type": "error" },
  { "inputs": [], "name": "InvalidMCR", "type": "error" },
  { "inputs": [], "name": "InvalidSCR", "type": "error" },
  { "inputs": [], "name": "RedistPenaltyTooHigh", "type": "error" },
  { "inputs": [], "name": "SPPenaltyGtRedist", "type": "error" },
  { "inputs": [], "name": "SPPenaltyTooLow", "type": "error" },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_activePoolAddress",
        "type": "address",
      },
    ],
    "name": "ActivePoolAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_boldTokenAddress",
        "type": "address",
      },
    ],
    "name": "BoldTokenAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_borrowerOperationsAddress",
        "type": "address",
      },
    ],
    "name": "BorrowerOperationsAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newCCR",
        "type": "uint256",
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newSCR",
        "type": "uint256",
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newMCR",
        "type": "uint256",
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newBCR",
        "type": "uint256",
      },
    ],
    "name": "CRsChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newCCR",
        "type": "uint256",
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newSCR",
        "type": "uint256",
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newMCR",
        "type": "uint256",
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newBCR",
        "type": "uint256",
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256",
      },
    ],
    "name": "CRsProposal",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_collSurplusPoolAddress",
        "type": "address",
      },
    ],
    "name": "CollSurplusPoolAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_collTokenAddress",
        "type": "address",
      },
    ],
    "name": "CollTokenAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_collateralRegistryAddress",
        "type": "address",
      },
    ],
    "name": "CollateralRegistryAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_defaultPoolAddress",
        "type": "address",
      },
    ],
    "name": "DefaultPoolAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_gasPoolAddress",
        "type": "address",
      },
    ],
    "name": "GasPoolAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_hintHelpersAddress",
        "type": "address",
      },
    ],
    "name": "HintHelpersAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_interestRouterAddress",
        "type": "address",
      },
    ],
    "name": "InterestRouterAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "liquidationPenaltySP",
        "type": "uint256",
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "liquidationPenaltyRedistribution",
        "type": "uint256",
      },
    ],
    "name": "LiquidationValuesChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "liquidationPenaltySP",
        "type": "uint256",
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "liquidationPenaltyRedistribution",
        "type": "uint256",
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256",
      },
    ],
    "name": "LiquidationValuesProposed",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_metadataNFTAddress",
        "type": "address",
      },
    ],
    "name": "MetadataNFTAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_multiTroveGetterAddress",
        "type": "address",
      },
    ],
    "name": "MultiTroveGetterAddressChanged",
    "type": "event",
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
        "name": "_priceFeedAddress",
        "type": "address",
      },
    ],
    "name": "PriceFeedAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_sortedTrovesAddress",
        "type": "address",
      },
    ],
    "name": "SortedTrovesAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_stabilityPoolAddress",
        "type": "address",
      },
    ],
    "name": "StabilityPoolAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_troveManagerAddress",
        "type": "address",
      },
    ],
    "name": "TroveManagerAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_troveNFTAddress",
        "type": "address",
      },
    ],
    "name": "TroveNFTAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_wethAddress",
        "type": "address",
      },
    ],
    "name": "WETHAddressChanged",
    "type": "event",
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "_whitelistAddress",
        "type": "address",
      },
    ],
    "name": "WhitelistChanged",
    "type": "event",
  },
  {
    "inputs": [],
    "name": "BCR",
    outputs: [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "CCR",
    outputs: [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "LIQUIDATION_PENALTY_REDISTRIBUTION",
    outputs: [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "LIQUIDATION_PENALTY_SP",
    outputs: [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "MCR",
    outputs: [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "SCR",
    outputs: [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "WETH",
    outputs: [{ "internalType": "contract IWETH", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "acceptNewCollateralValues",
    outputs: [],
    "stateMutability": "nonpayable",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "acceptNewLiquidationValues",
    outputs: [],
    "stateMutability": "nonpayable",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "acceptOwnership",
    outputs: [],
    "stateMutability": "nonpayable",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "activePool",
    outputs: [
      { "internalType": "contract IActivePool", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "boldToken",
    outputs: [
      { "internalType": "contract IBoldToken", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "borrowerOperations",
    outputs: [
      {
        "internalType": "contract IBorrowerOperations",
        "name": "",
        "type": "address",
      },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "collSurplusPool",
    outputs: [
      { "internalType": "contract ICollSurplusPool", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "collToken",
    outputs: [
      { "internalType": "contract IERC20Metadata", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "collateralRegistry",
    outputs: [
      {
        "internalType": "contract ICollateralRegistry",
        "name": "",
        "type": "address",
      },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "defaultPool",
    outputs: [
      { "internalType": "contract IDefaultPool", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "gasPoolAddress",
    outputs: [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "hintHelpers",
    outputs: [
      { "internalType": "contract IHintHelpers", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "interestRouter",
    outputs: [
      { "internalType": "contract IInterestRouter", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "metadataNFT",
    outputs: [
      { "internalType": "contract IMetadataNFT", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "multiTroveGetter",
    outputs: [
      { "internalType": "contract IMultiTroveGetter", "name": "", "type": "address" },
    ],
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
    "inputs": [],
    "name": "priceFeed",
    outputs: [
      { "internalType": "contract IPriceFeed", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "newCCR", "type": "uint256" },
      { "internalType": "uint256", "name": "newSCR", "type": "uint256" },
      { "internalType": "uint256", "name": "newMCR", "type": "uint256" },
      { "internalType": "uint256", "name": "newBCR", "type": "uint256" },
    ],
    "name": "proposeNewCollateralValues",
    outputs: [],
    "stateMutability": "nonpayable",
    "type": "function",
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "newLiquidationPenaltySP",
        "type": "uint256",
      },
      {
        "internalType": "uint256",
        "name": "newLiquidationPenaltyRedistribution",
        "type": "uint256",
      },
    ],
    "name": "proposeNewLiquidationValues",
    outputs: [],
    "stateMutability": "nonpayable",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "proposedCR",
    outputs: [
      { "internalType": "uint256", "name": "CCR", "type": "uint256" },
      { "internalType": "uint256", "name": "MCR", "type": "uint256" },
      { "internalType": "uint256", "name": "SCR", "type": "uint256" },
      { "internalType": "uint256", "name": "BCR", "type": "uint256" },
      { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "proposedLiquidationValues",
    outputs: [
      {
        "internalType": "uint256",
        "name": "liquidationPenaltySP",
        "type": "uint256",
      },
      {
        "internalType": "uint256",
        "name": "liquidationPenaltyRedistribution",
        "type": "uint256",
      },
      { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [
      {
        components: [
          {
            "internalType": "contract IERC20Metadata",
            "name": "collToken",
            "type": "address",
          },
          {
            "internalType": "contract IBorrowerOperations",
            "name": "borrowerOperations",
            "type": "address",
          },
          {
            "internalType": "contract ITroveManager",
            "name": "troveManager",
            "type": "address",
          },
          {
            "internalType": "contract ITroveNFT",
            "name": "troveNFT",
            "type": "address",
          },
          {
            "internalType": "contract IMetadataNFT",
            "name": "metadataNFT",
            "type": "address",
          },
          {
            "internalType": "contract IStabilityPool",
            "name": "stabilityPool",
            "type": "address",
          },
          {
            "internalType": "contract IPriceFeed",
            "name": "priceFeed",
            "type": "address",
          },
          {
            "internalType": "contract IActivePool",
            "name": "activePool",
            "type": "address",
          },
          {
            "internalType": "contract IDefaultPool",
            "name": "defaultPool",
            "type": "address",
          },
          { "internalType": "address", "name": "gasPoolAddress", "type": "address" },
          {
            "internalType": "contract ICollSurplusPool",
            "name": "collSurplusPool",
            "type": "address",
          },
          {
            "internalType": "contract ISortedTroves",
            "name": "sortedTroves",
            "type": "address",
          },
          {
            "internalType": "contract IInterestRouter",
            "name": "interestRouter",
            "type": "address",
          },
          {
            "internalType": "contract IHintHelpers",
            "name": "hintHelpers",
            "type": "address",
          },
          {
            "internalType": "contract IMultiTroveGetter",
            "name": "multiTroveGetter",
            "type": "address",
          },
          {
            "internalType": "contract ICollateralRegistry",
            "name": "collateralRegistry",
            "type": "address",
          },
          {
            "internalType": "contract IBoldToken",
            "name": "boldToken",
            "type": "address",
          },
          { "internalType": "contract IWETH", "name": "WETH", "type": "address" },
          {
            "internalType": "contract IWhitelist",
            "name": "whitelist",
            "type": "address",
          },
        ],
        "internalType": "struct IAddressesRegistry.AddressVars",
        "name": "_vars",
        "type": "tuple",
      },
    ],
    "name": "setAddresses",
    outputs: [],
    "stateMutability": "nonpayable",
    "type": "function",
  },
  {
    "inputs": [
      {
        "internalType": "contract IWhitelist",
        "name": "_newWhitelist",
        "type": "address",
      },
    ],
    "name": "setWhitelist",
    outputs: [],
    "stateMutability": "nonpayable",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "sortedTroves",
    outputs: [
      { "internalType": "contract ISortedTroves", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "stabilityPool",
    outputs: [
      { "internalType": "contract IStabilityPool", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "troveManager",
    outputs: [
      { "internalType": "contract ITroveManager", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "troveNFT",
    outputs: [
      { "internalType": "contract ITroveNFT", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
  {
    "inputs": [],
    "name": "whitelist",
    outputs: [
      { "internalType": "contract IWhitelist", "name": "", "type": "address" },
    ],
    "stateMutability": "view",
    "type": "function",
  },
] as const;
