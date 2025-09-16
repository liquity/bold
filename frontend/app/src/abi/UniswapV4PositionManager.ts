export const UniswapV4PositionManager = [
  {
    "inputs": [
      { "internalType": "contract IPoolManager", "name": "_poolManager", "type": "address" },
      { "internalType": "contract IAllowanceTransfer", "name": "_permit2", "type": "address" },
      { "internalType": "uint256", "name": "_unsubscribeGasLimit", "type": "uint256" },
      { "internalType": "contract IPositionDescriptor", "name": "_tokenDescriptor", "type": "address" },
      { "internalType": "contract IWETH9", "name": "_weth9", "type": "address" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "address", "name": "subscriber", "type": "address" }
    ],
    "name": "AlreadySubscribed",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "subscriber", "type": "address" },
      { "internalType": "bytes", "name": "reason", "type": "bytes" }
    ],
    "name": "BurnNotificationReverted",
    "type": "error"
  },
  { "inputs": [], "name": "ContractLocked", "type": "error" },
  {
    "inputs": [
      { "internalType": "uint256", "name": "deadline", "type": "uint256" }
    ],
    "name": "DeadlinePassed",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "Currency", "name": "currency", "type": "address" }
    ],
    "name": "DeltaNotNegative",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "Currency", "name": "currency", "type": "address" }
    ],
    "name": "DeltaNotPositive",
    "type": "error"
  },
  { "inputs": [], "name": "GasLimitTooLow", "type": "error" },
  { "inputs": [], "name": "InputLengthMismatch", "type": "error" },
  { "inputs": [], "name": "InsufficientBalance", "type": "error" },
  { "inputs": [], "name": "InvalidContractSignature", "type": "error" },
  { "inputs": [], "name": "InvalidEthSender", "type": "error" },
  { "inputs": [], "name": "InvalidSignature", "type": "error" },
  { "inputs": [], "name": "InvalidSignatureLength", "type": "error" },
  { "inputs": [], "name": "InvalidSigner", "type": "error" },
  {
    "inputs": [
      { "internalType": "uint128", "name": "maximumAmount", "type": "uint128" },
      { "internalType": "uint128", "name": "amountRequested", "type": "uint128" }
    ],
    "name": "MaximumAmountExceeded",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "uint128", "name": "minimumAmount", "type": "uint128" },
      { "internalType": "uint128", "name": "amountReceived", "type": "uint128" }
    ],
    "name": "MinimumAmountInsufficient",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "subscriber", "type": "address" },
      { "internalType": "bytes", "name": "reason", "type": "bytes" }
    ],
    "name": "ModifyLiquidityNotificationReverted",
    "type": "error"
  },
  { "inputs": [], "name": "NoCodeSubscriber", "type": "error" },
  { "inputs": [], "name": "NoSelfPermit", "type": "error" },
  { "inputs": [], "name": "NonceAlreadyUsed", "type": "error" },
  {
    "inputs": [
      { "internalType": "address", "name": "caller", "type": "address" }
    ],
    "name": "NotApproved",
    "type": "error"
  },
  { "inputs": [], "name": "NotPoolManager", "type": "error" },
  { "inputs": [], "name": "NotSubscribed", "type": "error" },
  { "inputs": [], "name": "PoolManagerMustBeLocked", "type": "error" },
  { "inputs": [], "name": "SignatureDeadlineExpired", "type": "error" },
  {
    "inputs": [
      { "internalType": "address", "name": "subscriber", "type": "address" },
      { "internalType": "bytes", "name": "reason", "type": "bytes" }
    ],
    "name": "SubscriptionReverted",
    "type": "error"
  },
  { "inputs": [], "name": "Unauthorized", "type": "error" },
  {
    "inputs": [
      { "internalType": "uint256", "name": "action", "type": "uint256" }
    ],
    "name": "UnsupportedAction",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "spender", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" }
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "operator", "type": "address" },
      { "indexed": false, "internalType": "bool", "name": "approved", "type": "bool" }
    ],
    "name": "ApprovalForAll",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "subscriber", "type": "address" }
    ],
    "name": "Subscription",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "id", "type": "uint256" }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "subscriber", "type": "address" }
    ],
    "name": "Unsubscription",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "DOMAIN_SEPARATOR",
    "outputs": [
      { "internalType": "bytes32", "name": "", "type": "bytes32" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "WETH9",
    "outputs": [
      { "internalType": "contract IWETH9", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "id", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" }
    ],
    "name": "balanceOf",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "getApproved",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "getPoolAndPositionInfo",
    "outputs": [
      {
        "components": [
          { "internalType": "Currency", "name": "currency0", "type": "address" },
          { "internalType": "Currency", "name": "currency1", "type": "address" },
          { "internalType": "uint24", "name": "fee", "type": "uint24" },
          { "internalType": "int24", "name": "tickSpacing", "type": "int24" },
          { "internalType": "contract IHooks", "name": "hooks", "type": "address" }
        ],
        "internalType": "struct PoolKey",
        "name": "poolKey",
        "type": "tuple"
      },
      { "internalType": "PositionInfo", "name": "info", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "getPositionLiquidity",
    "outputs": [
      { "internalType": "uint128", "name": "liquidity", "type": "uint128" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          { "internalType": "Currency", "name": "currency0", "type": "address" },
          { "internalType": "Currency", "name": "currency1", "type": "address" },
          { "internalType": "uint24", "name": "fee", "type": "uint24" },
          { "internalType": "int24", "name": "tickSpacing", "type": "int24" },
          { "internalType": "contract IHooks", "name": "hooks", "type": "address" }
        ],
        "internalType": "struct PoolKey",
        "name": "key",
        "type": "tuple"
      },
      { "internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160" }
    ],
    "name": "initializePool",
    "outputs": [
      { "internalType": "int24", "name": "", "type": "int24" }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "name": "isApprovedForAll",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes", "name": "unlockData", "type": "bytes" },
      { "internalType": "uint256", "name": "deadline", "type": "uint256" }
    ],
    "name": "modifyLiquidities",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes", "name": "actions", "type": "bytes" },
      { "internalType": "bytes[]", "name": "params", "type": "bytes[]" }
    ],
    "name": "modifyLiquiditiesWithoutUnlock",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "msgSender",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes[]", "name": "data", "type": "bytes[]" }
    ],
    "name": "multicall",
    "outputs": [
      { "internalType": "bytes[]", "name": "results", "type": "bytes[]" }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextTokenId",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "uint256", "name": "word", "type": "uint256" }
    ],
    "name": "nonces",
    "outputs": [
      { "internalType": "uint256", "name": "bitmap", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "id", "type": "uint256" }
    ],
    "name": "ownerOf",
    "outputs": [
      { "internalType": "address", "name": "owner", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "uint256", "name": "deadline", "type": "uint256" },
      { "internalType": "uint256", "name": "nonce", "type": "uint256" },
      { "internalType": "bytes", "name": "signature", "type": "bytes" }
    ],
    "name": "permit",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      {
        "components": [
          {
            "components": [
              { "internalType": "address", "name": "token", "type": "address" },
              { "internalType": "uint160", "name": "amount", "type": "uint160" },
              { "internalType": "uint48", "name": "expiration", "type": "uint48" },
              { "internalType": "uint48", "name": "nonce", "type": "uint48" }
            ],
            "internalType": "struct IAllowanceTransfer.PermitDetails",
            "name": "details",
            "type": "tuple"
          },
          { "internalType": "address", "name": "spender", "type": "address" },
          { "internalType": "uint256", "name": "sigDeadline", "type": "uint256" }
        ],
        "internalType": "struct IAllowanceTransfer.PermitSingle",
        "name": "permitSingle",
        "type": "tuple"
      },
      { "internalType": "bytes", "name": "signature", "type": "bytes" }
    ],
    "name": "permit",
    "outputs": [
      { "internalType": "bytes", "name": "err", "type": "bytes" }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "permit2",
    "outputs": [
      { "internalType": "contract IAllowanceTransfer", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      {
        "components": [
          {
            "components": [
              { "internalType": "address", "name": "token", "type": "address" },
              { "internalType": "uint160", "name": "amount", "type": "uint160" },
              { "internalType": "uint48", "name": "expiration", "type": "uint48" },
              { "internalType": "uint48", "name": "nonce", "type": "uint48" }
            ],
            "internalType": "struct IAllowanceTransfer.PermitDetails[]",
            "name": "details",
            "type": "tuple[]"
          },
          { "internalType": "address", "name": "spender", "type": "address" },
          { "internalType": "uint256", "name": "sigDeadline", "type": "uint256" }
        ],
        "internalType": "struct IAllowanceTransfer.PermitBatch",
        "name": "_permitBatch",
        "type": "tuple"
      },
      { "internalType": "bytes", "name": "signature", "type": "bytes" }
    ],
    "name": "permitBatch",
    "outputs": [
      { "internalType": "bytes", "name": "err", "type": "bytes" }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "operator", "type": "address" },
      { "internalType": "bool", "name": "approved", "type": "bool" },
      { "internalType": "uint256", "name": "deadline", "type": "uint256" },
      { "internalType": "uint256", "name": "nonce", "type": "uint256" },
      { "internalType": "bytes", "name": "signature", "type": "bytes" }
    ],
    "name": "permitForAll",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes25", "name": "poolId", "type": "bytes25" }
    ],
    "name": "poolKeys",
    "outputs": [
      { "internalType": "Currency", "name": "currency0", "type": "address" },
      { "internalType": "Currency", "name": "currency1", "type": "address" },
      { "internalType": "uint24", "name": "fee", "type": "uint24" },
      { "internalType": "int24", "name": "tickSpacing", "type": "int24" },
      { "internalType": "contract IHooks", "name": "hooks", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "poolManager",
    "outputs": [
      { "internalType": "contract IPoolManager", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "positionInfo",
    "outputs": [
      { "internalType": "PositionInfo", "name": "info", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nonce", "type": "uint256" }
    ],
    "name": "revokeNonce",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "from", "type": "address" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "id", "type": "uint256" }
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "from", "type": "address" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "id", "type": "uint256" },
      { "internalType": "bytes", "name": "data", "type": "bytes" }
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "operator", "type": "address" },
      { "internalType": "bool", "name": "approved", "type": "bool" }
    ],
    "name": "setApprovalForAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "address", "name": "newSubscriber", "type": "address" },
      { "internalType": "bytes", "name": "data", "type": "bytes" }
    ],
    "name": "subscribe",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "subscriber",
    "outputs": [
      { "internalType": "contract ISubscriber", "name": "subscriber", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes4", "name": "interfaceId", "type": "bytes4" }
    ],
    "name": "supportsInterface",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "tokenDescriptor",
    "outputs": [
      { "internalType": "contract IPositionDescriptor", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "tokenURI",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "from", "type": "address" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "id", "type": "uint256" }
    ],
    "name": "transferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes", "name": "data", "type": "bytes" }
    ],
    "name": "unlockCallback",
    "outputs": [
      { "internalType": "bytes", "name": "", "type": "bytes" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "unsubscribe",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unsubscribeGasLimit",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
];