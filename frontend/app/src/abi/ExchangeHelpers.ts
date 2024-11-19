export const ExchangeHelpers = [
  {
    name: "getCollFromBold",
    inputs: [
      { internalType: "uint256", name: "_boldAmount", type: "uint256" },
      { internalType: "address", name: "_collToken", type: "address" },
      { internalType: "uint256", name: "_desiredCollAmount", type: "uint256" },
    ],
    outputs: [
      { internalType: "uint256", name: "collAmount", type: "uint256" },
      { internalType: "uint256", name: "slippage", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
