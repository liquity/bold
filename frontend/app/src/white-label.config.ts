/**
 * WHITE-LABEL CONFIGURATION
 * 
 * This is the master configuration file for customizing the platform for different clients.
 * When creating a new fork, update all values in this file according to the client's requirements.
 */

export const WHITE_LABEL_CONFIG = {
  brandColors: {
    primary: "black:700" as const,
    primaryContent: "white" as const,
    primaryContentAlt: "gray:300" as const,
    
    secondary: "silver:100" as const,
    secondaryContent: "black:700" as const,
    secondaryContentAlt: "black:400" as const,
    
    accent1: "red:500" as const,  
    accent1Content: "white" as const,
    accent1ContentAlt: "red:100" as const,
    
    accent2: "green:500" as const,
    accent2Content: "black:700" as const,
    accent2ContentAlt: "green:800" as const,
  },

  // ===========================
  // TYPOGRAPHY
  // ===========================
  typography: {
    // Font family for CSS (used in Panda config)
    fontFamily: "NeueMontreal, sans-serif",
    // Next.js font import name (should match the import)
    fontImport: "NeueMontreal" as const,
  },

  // ===========================
  // UNIFIED TOKENS CONFIGURATION
  // ===========================
  tokens: {
    // Main protocol stablecoin
    mainToken: {
      name: "MUST Stablecoin",
      symbol: "MUST" as const, 
      ticker: "MUST",
      decimals: 18,
      description: "USD-pegged stablecoin by Saga Protocol",
      icon: "main-token",
      // Core protocol contracts
      deployments: {
        1: { // Mainnet
          token: "0x0000000000000000000000000000000000000000",
          collateralRegistry: "0x0000000000000000000000000000000000000000",
          governance: "0x0000000000000000000000000000000000000000",
          hintHelpers: "0x0000000000000000000000000000000000000000",
          multiTroveGetter: "0x0000000000000000000000000000000000000000",
          exchangeHelpers: "0x0000000000000000000000000000000000000000",
        },
        11155111: { // Sepolia
          token: "0x0000000000000000000000000000000000000000",
          collateralRegistry: "0x0000000000000000000000000000000000000000",
          governance: "0x0000000000000000000000000000000000000000",
          hintHelpers: "0x0000000000000000000000000000000000000000",
          multiTroveGetter: "0x0000000000000000000000000000000000000000",
          exchangeHelpers: "0x0000000000000000000000000000000000000000",
        },
        5464: { // Saga EVM
          token: "0x827e3a34e3e078dc103b11284de68fb5a8ddbe49",
          collateralRegistry: "0xbe5d451db7dda764d2a0f1c94cad11a10c5afa85",
          governance: "0x0000000000000000000000000000000000000000",
          hintHelpers: "0xd4089e6f4c265f4695edf7c1ea423f92ec9603e0",
          multiTroveGetter: "0x6da0be66951460d517ab6fc407f33d12c4e48a9d",
          exchangeHelpers: "0x0000000000000000000000000000000000000000",
        },
      },
    },

    // Collateral tokens (for borrowing)
    collaterals: [
      // === ETH-based collaterals (110% MCR, 90.91% max LTV) ===
      {
        symbol: "ETH" as const,
        name: "ETH",
        icon: "eth",
        collateralRatio: 1.1, // 110% MCR
        maxDeposit: "100000000", // $100M initial debt limit
        maxLTV: 0.9091, // 90.91% max LTV
        // Deployment info (per chain)
        deployments: {
          1: {
            collToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
            leverageZapper: "0x978d7188ae01881d254ad7e94874653b0c268004",
            stabilityPool: "0xf69eb8c0d95d4094c16686769460f678727393cf",
            troveManager: "0x81d78814df42da2cab0e8870c477bc3ed861de66",
          },
          11155111: {
            collToken: "0x8116d0a0e8d4f0197b428c520953f302adca0b50",
            leverageZapper: "0x482bf4d6a2e61d259a7f97ef6aac8b3ce5dd9f99",
            stabilityPool: "0x89fb98c98792c8b9e9d468148c6593fa0fc47b40",
            troveManager: "0x364038750236739e0cd96d5754516c9b8168fb0c",
          },
          5464: { // Saga EVM
            collToken: "0xeb41D53F14Cb9a67907f2b8b5DBc223944158cCb", // WETH on Saga EVM
            leverageZapper: "0x3121c3208ff48e5c0b80831b874e5910f81b52e5",
            stabilityPool: "0xcF902CECf44a0627f0692669016da682e6737835",
            troveManager: "0x7A639C9Ae64998a1Df86d9dF13a3d0ba6E94bD51",
          },
        },
      },
      {
        symbol: "RETH" as const,
        name: "Rocket Pool ETH", 
        icon: "reth",
        collateralRatio: 1.1, // 110% MCR for LSTs
        maxDeposit: "25000000", // $25M initial debt limit
        maxLTV: 0.9091, // 90.91% max LTV
        deployments: {
          1: {
            collToken: "0xae78736cd615f374d3085123a210448e74fc6393",
            leverageZapper: "0x7d5f19a1e48479a95c4eb40fd1a534585026e7e5",
            stabilityPool: "0xc4463b26be1a6064000558a84ef9b6a58abe4f7a",
            troveManager: "0xde026433882a9dded65cac4fff8402fafff40fca",
          },
          11155111: {
            collToken: "0xbdb72f78302e6174e48aa5872f0dd986ed6d98d9",
            leverageZapper: "0x251dfe2078a910c644289f2344fac96bffea7c02",
            stabilityPool: "0x8492ad1df9f89e4b6c54c81149058172592e1c94",
            troveManager: "0x310fa1d1d711c75da45952029861bcf0d330aa81",
          },
          5464: { // Saga EVM
            collToken: "0x679121f168488185eca6Aaa3871687FF6d38Edb6", // rETH on Saga EVM
            leverageZapper: "0x069ba7cb9ca94cde694387b206abd30e890d7528",
            stabilityPool: "0x91252D2f16689D65cc11829904DD530df6598306",
            troveManager: "0x9f479824316c5454529Dcf200D3Ee31e3Ce6eB09",
          },
        },
      },
      // === BTC-based collaterals (110% MCR, 90.91% max LTV) ===
      {
        symbol: "TBTC" as const,
        name: "tBTC",
        icon: "btc", // Need to add BTC icon
        collateralRatio: 1.1, // 110% MCR
        maxDeposit: "100000000", // $100M initial debt limit
        maxLTV: 0.9091, // 90.91% max LTV
        deployments: {
          1: {
            collToken: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
            leverageZapper: "0xc3d864adc2a9b49d52e640b697241408d896179f",
            stabilityPool: "0xcf46dab575c364a8b91bda147720ff4361f4627f",
            troveManager: "0xb47ef60132deabc89580fd40e49c062d93070046",
          },
          11155111: {
            collToken: "0xff9f477b09c6937ff6313ae90e79022609851a9c",
            leverageZapper: "0xea7fb1919bf9bae007df10ad8b748ee75fd5971d",
            stabilityPool: "0x68320bd4bbc16fe14f91501380edaa9ffe5890e1",
            troveManager: "0xa7b57913b5643025a15c80ca3a56eb6fb59d095d",
          },
          5464: { // Saga EVM
            collToken: "0xa740E6758e309840ffFfe58f749F018386A3b70b",
            leverageZapper: "0xed871ea195a059e4a596a21b9ea3f4038b3313e2",
            stabilityPool: "0x5259F6E3D48A2d8a228678AcF01dBd4c8875B3Ed",
            troveManager: "0x2F323070f32858330ac2291B8CE921228Bd2B2C6",
          },
        },
      },
      {
        symbol: "SAGA" as const,
        name: "SAGA",
        icon: "saga",
        collateralRatio: 1.4, // 140% MCR (higher volatility)
        maxDeposit: "5000000", // $5M initial debt limit
        maxLTV: 0.7143, // 71.43% max LTV
        deployments: {
          5464: { // Saga EVM
            collToken: "0x1e34Fb2A338142A501AFf776Da2AD8d919272320", // Wrapped SAGA token on Saga EVM
            leverageZapper: "0xde7d70349661f420ebe3eaea582f0fdc106c6f74",
            stabilityPool: "0xBa8F09aB2b255063b55A00bCD19E61207Fc587C2",
            troveManager: "0xd4a0bFD801c6D8A22393bD596b5Ef60881d57680",
          },
          1: { // Placeholder for Mainnet
            collToken: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
          },
          11155111: { // Placeholder for Sepolia
            collToken: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
          },
        },
      },      // {
      //   symbol: "FBTC" as const,
      //   name: "FBTC",
      //   icon: "btc", // Reuse BTC icon
      //   collateralRatio: 1.1, // 110% MCR
      //   maxDeposit: "100000000", // $100M initial debt limit
      //   maxLTV: 0.9091, // 90.91% max LTV
      //   deployments: {
      //     646: { // Ronin
      //       collToken: "0xC96dE26018A54D51c097160568752c4E3BD6C364",
      //       leverageZapper: "0x0000000000000000000000000000000000000000", // TBD
      //       stabilityPool: "0x0000000000000000000000000000000000000000", // TBD
      //       troveManager: "0x0000000000000000000000000000000000000000", // TBD
      //     },
      //     1: { // Placeholder
      //       collToken: "0x0000000000000000000000000000000000000000",
      //       leverageZapper: "0x0000000000000000000000000000000000000000",
      //       stabilityPool: "0x0000000000000000000000000000000000000000",
      //       troveManager: "0x0000000000000000000000000000000000000000",
      //     },
      //     11155111: { // Placeholder
      //       collToken: "0x0000000000000000000000000000000000000000",
      //       leverageZapper: "0x0000000000000000000000000000000000000000",
      //       stabilityPool: "0x0000000000000000000000000000000000000000",
      //       troveManager: "0x0000000000000000000000000000000000000000",
      //     },
      //   },
      // },
      // // === Native/Platform tokens (higher collateral ratios) ===
      // {
      //   symbol: "SAGA" as const,
      //   name: "SAGA",
      //   icon: "saga", // Need to add SAGA icon
      //   collateralRatio: 1.4, // 140% MCR
      //   maxDeposit: "5000000", // $5M initial debt limit
      //   maxLTV: 0.7143, // 71.43% max LTV
      //   deployments: {
      //     646: { // Ronin
      //       collToken: "0xA19377761FED745723B90993988E04d641c2CfFE",
      //       leverageZapper: "0x0000000000000000000000000000000000000000", // TBD
      //       stabilityPool: "0x0000000000000000000000000000000000000000", // TBD
      //       troveManager: "0x0000000000000000000000000000000000000000", // TBD
      //     },
      //     1: { // Placeholder
      //       collToken: "0x0000000000000000000000000000000000000000",
      //       leverageZapper: "0x0000000000000000000000000000000000000000",
      //       stabilityPool: "0x0000000000000000000000000000000000000000",
      //       troveManager: "0x0000000000000000000000000000000000000000",
      //     },
      //     11155111: { // Placeholder
      //       collToken: "0x0000000000000000000000000000000000000000",
      //       leverageZapper: "0x0000000000000000000000000000000000000000",
      //       stabilityPool: "0x0000000000000000000000000000000000000000",
      //       troveManager: "0x0000000000000000000000000000000000000000",
      //     },
      //   },
      // },
      // {
      //   symbol: "SUI" as const,
      //   name: "SUI",
      //   icon: "sui", // Need to add SUI icon
      //   collateralRatio: 1.4, // 140% MCR
      //   maxDeposit: "5000000", // $5M initial debt limit
      //   maxLTV: 0.7143, // 71.43% max LTV
      //   deployments: {
      //     646: { // Ronin (TBD - SUI bridge/wrapper)
      //       collToken: "0x0000000000000000000000000000000000000002::sui::SUI", // From your data (needs bridge)
      //       leverageZapper: "0x0000000000000000000000000000000000000000", // TBD
      //       stabilityPool: "0x0000000000000000000000000000000000000000", // TBD
      //       troveManager: "0x0000000000000000000000000000000000000000", // TBD
      //     },
      //     // Placeholder deployments for build compatibility
      //     1: { // Placeholder
      //       collToken: "0x0000000000000000000000000000000000000000",
      //       leverageZapper: "0x0000000000000000000000000000000000000000",
      //       stabilityPool: "0x0000000000000000000000000000000000000000",
      //       troveManager: "0x0000000000000000000000000000000000000000",
      //     },
      //     11155111: { // Placeholder
      //       collToken: "0x0000000000000000000000000000000000000000",
      //       leverageZapper: "0x0000000000000000000000000000000000000000",
      //       stabilityPool: "0x0000000000000000000000000000000000000000",
      //       troveManager: "0x0000000000000000000000000000000000000000",
      //     },
      //   },
      // },
      // {
      //   symbol: "KING" as const,
      //   name: "KING",
      //   icon: "king", // Need to add KING icon
      //   collateralRatio: 2.0, // 200% MCR (high volatility asset)
      //   maxDeposit: "500000", // $500K initial debt limit
      //   maxLTV: 0.5, // 50% max LTV
      //   deployments: {
      //     646: { // Ronin
      //       collToken: "0x8f08b70456eb22f6109f57b8fafe862ed28e6040",
      //       leverageZapper: "0x0000000000000000000000000000000000000000", // TBD
      //       stabilityPool: "0x0000000000000000000000000000000000000000", // TBD
      //       troveManager: "0x0000000000000000000000000000000000000000", // TBD
      //     },
      //     1: { // Placeholder
      //       collToken: "0x0000000000000000000000000000000000000000",
      //       leverageZapper: "0x0000000000000000000000000000000000000000",
      //       stabilityPool: "0x0000000000000000000000000000000000000000",
      //       troveManager: "0x0000000000000000000000000000000000000000",
      //     },
      //     11155111: { // Placeholder
      //       collToken: "0x0000000000000000000000000000000000000000",
      //       leverageZapper: "0x0000000000000000000000000000000000000000",
      //       stabilityPool: "0x0000000000000000000000000000000000000000",
      //       troveManager: "0x0000000000000000000000000000000000000000",
      //     },
      //   },
      // },
    ],

    // Other tokens in the protocol
    otherTokens: {
      // ETH for display purposes
      eth: {
        symbol: "ETH" as const,
        name: "ETH",
        icon: "eth",
      },
      // SBOLD - yield-bearing version of the main token
      sbold: {
        symbol: "SBOLD" as const,
        name: "SBOLD",
        icon: "sbold",
      },
      // Staked version of main token
      staked: {
        symbol: "sYOUR" as const,
        name: "Staked YOUR",
        icon: "staked-main-token",
      },
      lusd: {
        symbol: "LUSD" as const,
        name: "LUSD",
        icon: "legacy-stablecoin",
      },
    },
  },

  // ===========================
  // BRANDING & CONTENT
  // ===========================
  branding: {
    // Core app identity
    appName: "Mustang",        // Full app name for titles, about pages
    brandName: "MUSTANG",              // Core brand name for protocol/version references
    appTagline: "Multi-chain stablecoin protocol",
    appDescription: "Borrow MUST against multiple collateral types",
    appUrl: "https://saga.finance/",
    
    // External links
    links: {
      docs: {
        base: "https://docs.saga.finance/",
        redemptions: "https://docs.saga.finance/redemptions",
        liquidations: "https://docs.saga.finance/liquidations",
        delegation: "https://docs.saga.finance/delegation",
        interestRates: "https://docs.saga.finance/interest-rates",
        earn: "https://docs.saga.finance/earn",
      },
      dune: "https://dune.com/saga/saga-protocol",
      discord: "https://discord.gg/saga",
      github: "https://github.com/NeriteOrg/saga",
      x: "https://x.com/sagaprotocol",
      friendlyForkProgram: "https://saga.finance/ecosystem",
    },
    
    // Feature flags and descriptions
    features: {
      showV1Legacy: false, // No V1 legacy content for Saga
      friendlyFork: {
        enabled: true,
        title: "Learn more about the Friendly Fork Program",
        description: "A program for collaborative protocol development",
      },
    },
    
    // Navigation configuration  
    navigation: {
      showBorrow: true,
      showEarn: true,
      showStake: false,
    },
    
    // Menu labels (can be customized per deployment)
    menu: {
      dashboard: "Dashboard",
      borrow: "Borrow",
      multiply: "Multiply", 
      earn: "Earn",
    },
    
    // Common UI text
    ui: {
      connectWallet: "Connect",
      wrongNetwork: "Wrong network",
      loading: "Loading...",
      error: "Error",
    },
  },

  // ===========================
  // EARN POOLS CONFIGURATION
  // ===========================
  earnPools: {
    enableStakedMainToken: false,
    
    // Enable/disable stability pools for collaterals
    enableStabilityPools: true,
    
    // Custom pools configuration (beyond collateral stability pools)
    customPools: [] as Array<{
      symbol: string;
      name: string;
      enabled: boolean;
    }>,
  },
};

// Type exports for TypeScript support
export type WhiteLabelConfig = typeof WHITE_LABEL_CONFIG;

// Utility functions for dynamic configuration
export function getAvailableEarnPools() {
  const pools: Array<{ symbol: string; name: string; type: 'stability' | 'staked' | 'custom' }> = [];
  
  // Add stability pools for enabled collaterals
  if (WHITE_LABEL_CONFIG.earnPools.enableStabilityPools) {
    WHITE_LABEL_CONFIG.tokens.collaterals.forEach(collateral => {
      pools.push({
        symbol: collateral.symbol.toLowerCase(),
        name: `${collateral.name} Stability Pool`,
        type: 'stability',
      });
    });
  }
  
  // Add custom pools
  WHITE_LABEL_CONFIG.earnPools.customPools.forEach(pool => {
    if (pool.enabled) {
      pools.push({
        symbol: pool.symbol.toLowerCase(),
        name: pool.name,
        type: 'custom',
      });
    }
  });
  
  return pools;
}

export function getEarnPoolSymbols() {
  return getAvailableEarnPools().map(pool => pool.symbol);
}

export function getCollateralSymbols() {
  return WHITE_LABEL_CONFIG.tokens.collaterals.map(collateral => collateral.symbol.toLowerCase());
}