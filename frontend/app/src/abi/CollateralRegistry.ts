// this file was generated by scripts/update-liquity-abis.ts
// please do not edit it manually
export const CollateralRegistry = [{
  "type": "constructor",
  "inputs": [{ "name": "_boldToken", "type": "address", "internalType": "contract IBoldToken" }, {
    "name": "_tokens",
    "type": "address[]",
    "internalType": "contract IERC20[]",
  }, { "name": "_troveManagers", "type": "address[]", "internalType": "contract ITroveManager[]" }],
  "stateMutability": "nonpayable",
}, {
  "type": "function",
  "name": "activePool",
  "inputs": [],
  "outputs": [{ "name": "", "type": "address", "internalType": "contract IActivePool" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "baseRate",
  "inputs": [],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "boldToken",
  "inputs": [],
  "outputs": [{ "name": "", "type": "address", "internalType": "contract IBoldToken" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "defaultPool",
  "inputs": [],
  "outputs": [{ "name": "", "type": "address", "internalType": "contract IDefaultPool" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "getEffectiveRedemptionFeeInBold",
  "inputs": [{ "name": "_redeemAmount", "type": "uint256", "internalType": "uint256" }],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "getEntireSystemColl",
  "inputs": [],
  "outputs": [{ "name": "entireSystemColl", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "getEntireSystemDebt",
  "inputs": [],
  "outputs": [{ "name": "entireSystemDebt", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "getRedemptionFeeWithDecay",
  "inputs": [{ "name": "_ETHDrawn", "type": "uint256", "internalType": "uint256" }],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "getRedemptionRate",
  "inputs": [],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "getRedemptionRateForRedeemedAmount",
  "inputs": [{ "name": "_redeemAmount", "type": "uint256", "internalType": "uint256" }],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "getRedemptionRateWithDecay",
  "inputs": [],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "getToken",
  "inputs": [{ "name": "_index", "type": "uint256", "internalType": "uint256" }],
  "outputs": [{ "name": "", "type": "address", "internalType": "contract IERC20" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "getTroveManager",
  "inputs": [{ "name": "_index", "type": "uint256", "internalType": "uint256" }],
  "outputs": [{ "name": "", "type": "address", "internalType": "contract ITroveManager" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "lastFeeOperationTime",
  "inputs": [],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "priceFeed",
  "inputs": [],
  "outputs": [{ "name": "", "type": "address", "internalType": "contract IPriceFeed" }],
  "stateMutability": "view",
}, {
  "type": "function",
  "name": "redeemCollateral",
  "inputs": [{ "name": "_boldAmount", "type": "uint256", "internalType": "uint256" }, {
    "name": "_maxIterationsPerCollateral",
    "type": "uint256",
    "internalType": "uint256",
  }, { "name": "_maxFeePercentage", "type": "uint256", "internalType": "uint256" }],
  "outputs": [],
  "stateMutability": "nonpayable",
}, {
  "type": "function",
  "name": "totalCollaterals",
  "inputs": [],
  "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
  "stateMutability": "view",
}, {
  "type": "event",
  "name": "BaseRateUpdated",
  "inputs": [{ "name": "_baseRate", "type": "uint256", "indexed": false, "internalType": "uint256" }],
  "anonymous": false,
}, {
  "type": "event",
  "name": "LastFeeOpTimeUpdated",
  "inputs": [{ "name": "_lastFeeOpTime", "type": "uint256", "indexed": false, "internalType": "uint256" }],
  "anonymous": false,
}] as const;
