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
          token: "0xf4e4f7b7a09c50d3cc710151536b88b48422f48b",
          collateralRegistry: "0x04920e4abbf8a0173f2545f83bfb62beb98aaadd",
          governance: "0x0000000000000000000000000000000000000000",
          hintHelpers: "0xece3fa12e6bcbc34291060febf0428855ceb805b",
          multiTroveGetter: "0x0213a091fdba1e8a67a37f5fbb47f7c93cb61c46",
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
        decimals: 18,
        collateralRatio: 1.1, // 110% MCR
        maxDeposit: "100000000", // $100M initial debt limit
        maxLTV: 0.9091, // 90.91% max LTV
        // Deployment info (per chain)
        deployments: {
          5464: { // Saga EVM
            collToken: "0xeb41D53F14Cb9a67907f2b8b5DBc223944158cCb", // WETH on Saga EVM
            leverageZapper: "0xeb2c4fa3240a8f45933417b258fcb544eb70c0c2",
            stabilityPool: "0xde6dc2fb3a26a791b0f9cfa83166be729860b0ee",
            troveManager: "0x13e9927901c3cec3234172addf47581077ccba0b",
          },
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
        },
      },
      {
        symbol: "YETH" as const,
        name: "yETH",
        icon: "yeth",
        decimals: 18,
        collateralRatio: 1.2, // 120% MCR
        maxDeposit: "50000000", // $50M initial debt limit (placeholder)
        maxLTV: 0.8333, // 83.33% max LTV
        deployments: {
          5464: { // Saga EVM - placeholder for future deployment
            collToken: "0xA6F89de43315B444114258f6E6700765D08bcd56", // TBD
            leverageZapper: "0x109a5e350c767ea393e94071af0ebf2cb22ff344", // TBD
            stabilityPool: "0xa999817b8371b504ea9c13d3fd4d10ae45db7d86", // TBD
            troveManager: "0xfe474264e7d65005719bac266190db1f8ba8ed64", // TBD
          },
          1: {
            collToken: "0x8464f6ecae1ea58ec816c13f964030eab8ec123a", // Ethereum yETH address from spreadsheet
            leverageZapper: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
          },
          11155111: {
            collToken: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
          },
        },
      },   
      // === BTC-based collaterals (120% MCR, 83.33% max LTV) ===
      {
        symbol: "TBTC" as const,
        name: "tBTC",
        icon: "btc",
        decimals: 18,
        collateralRatio: 1.2, // 120% MCR
        maxDeposit: "100000000", // $100M initial debt limit
        maxLTV: 0.8333, // 83.33% max LTV
        deployments: {
          5464: { // Saga EVM
            collToken: "0xa740E6758e309840ffFfe58f749F018386A3b70b",
            leverageZapper: "0x0f9375c6819018d2e1433a7e65e16d914b989c24",
            stabilityPool: "0x50a1b3b63b27219ebb363a5ee4d9e24ef0fc23b1",
            troveManager: "0x0a66df058fb462458a10f01393d6f2118104fe8a",
          },
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
        },
      },
      {
        symbol: "SAGA" as const,
        name: "SAGA",
        icon: "saga",
        decimals: 6,
        collateralRatio: 1.4, // 140% MCR (higher volatility)
        maxDeposit: "5000000", // $5M initial debt limit
        maxLTV: 0.7143, // 71.43% max LTV
        deployments: {
          5464: { // Saga EVM
            collToken: "0xA19377761FED745723B90993988E04d641c2CfFE", // Wrapped SAGA token on Saga EVM
            leverageZapper: "0xa71a15a5376c409254a9bbf852eeb5355483d9b4",
            stabilityPool: "0x638e183dcf7913374addc1330d0c020ca9459c11",
            troveManager: "0x4eafce7e6054bce0868678802ec61f9ab075ca1a",
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
      },
      {
        symbol: "STATOM" as const,
        name: "stATOM",
        icon: "statom",
        decimals: 6,
        collateralRatio: 1.2, // 120% MCR
        maxDeposit: "25000000", // $25M initial debt limit (placeholder)
        maxLTV: 0.8333, // 83.33% max LTV
        deployments: {
          5464: { // Saga EVM - will be deployed in upcoming PR
            collToken: "0xDaF9d9032b5d5C92528d6aFf6a215514B7c21056",
            leverageZapper: "0x7a348acd40155794def1951cc21d369c1cd19641", // TBD
            stabilityPool: "0xd624541380cbc7ccfd50de071cf415453a5d9e9f", // TBD
            troveManager: "0xdcd96430e273ec8764ae3f50c67a150bd9bb3390", // TBD
          },
          1: {
            collToken: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
          },
          11155111: {
            collToken: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
          },
        },
      },
      {
        symbol: "KING" as const,
        name: "KING",
        icon: "king",
        decimals: 18,
        collateralRatio: 1.6, // 160% MCR (higher volatility)
        maxDeposit: "10000000", // $10M initial debt limit (placeholder)
        maxLTV: 0.625, // 62.5% max LTV
        deployments: {
          5464: { // Saga EVM - placeholder for future deployment
            collToken: "0x58d9fbBc6037dedfBA99cAfA28e4C371b795ad97", // TBD
            leverageZapper: "0x45f7ccd8062ad129d26dc8ad4d0eed179b315cc7", // TBD
            stabilityPool: "0x711e0c24c5c7a8b07ee58db6638348189b74f61b", // TBD
            troveManager: "0xa8fc7de1015c113b8f2dba58cc5e0e846fbaf74a", // TBD
          },
          1: {
            collToken: "0x8f08b70456eb22f6109f57b8fafe862ed28e6040", // Ethereum KING address from spreadsheet
            leverageZapper: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
          },
          11155111: {
            collToken: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
          },
        },
      },
      {
        symbol: "YUSD" as const,
        name: "yUSD",
        icon: "yusd",
        decimals: 18,
        collateralRatio: 1.2, // 120% MCR
        maxDeposit: "50000000", // $50M initial debt limit (placeholder)
        maxLTV: 0.8333, // 83.33% max LTV
        deployments: {
          5464: { // Saga EVM - placeholder for future deployment
            collToken: "0x839e7e610108Cf3DCc9b40329db33b6E6bc9baCE", // TBD
            leverageZapper: "0x87d781e632c1da292c2526bbbed84d8d785dec53", // TBD
            stabilityPool: "0xdb1304a9739f9b2e9578ecbb52cef53ee10f0165", // TBD
            troveManager: "0x6a08df8ffc74baac2ad49317f1972be5c5cb28c6", // TBD
          },
          1: {
            collToken: "0x8464f6ecae1ea58ec816c13f964030eab8ec123a", // Ethereum yETH address from spreadsheet
            leverageZapper: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
          },
          11155111: {
            collToken: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
          },
        },
      },   
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