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
          token: "0xa8b56ce258a7f55327bde886b0e947ee059ca434",
          collateralRegistry: "0xf39bdcfb55374ddb0948a28af00b6474a566ac22",
          governance: "0x0000000000000000000000000000000000000000",
          hintHelpers: "0xf2a7cab8056bcc477872b34f9be1d1d67a7d109c",
          multiTroveGetter: "0x651d868ef9d04ca0b2a3bf2bc299b92e58aed8c3",
          exchangeHelpers: "0x0000000000000000000000000000000000000000",
        },
      },
    },

    // Collateral tokens (for borrowing)
    collaterals: [
      // === ETH-based collaterals (110% MCR, 90.91% max LTV) ===
      {
        symbol: "WETH" as const,
        name: "Wrapped Ether",
        ticker: "WETH",
        icon: "weth",
        branchId: 0,
        decimals: 18,
        collateralRatio: 1.1, // 110% MCR
        maxDeposit: "100000000", // $100M initial debt limit
        maxLTV: 0.9091, // 90.91% max LTV
        // Deployment info (per chain)
        deployments: {
          5464: { // Saga EVM
            collToken: "0xeb41D53F14Cb9a67907f2b8b5DBc223944158cCb",
            addressesRegistry: "0x58158fbb9da27fe5eb121f5e637a5886746f416f",
            activePool: "0xabd9e344aea0ead8ceb3952f163b37197eef9e09",
            borrowerOperations: "0x5092addcdfa1f74125700ae67d597b1e49314120",
            collSurplusPool: "0x40721101f1de731f34a207f783b2a40026a65f0d",
            defaultPool: "0x3e1cd5a674f09d5b7169a04b86888e07c9dc6a1b",
            sortedTroves: "0xd4570c6a2bd6e18ff7c8ce1341ba8f2e0154a476",
            stabilityPool: "0x6df479f80453c4fd8561cfb7d663ae1c34de0a94",
            troveManager: "0x9fcb3ba3a87357d223f117827bae8d8bbb985ab9",
            troveNFT: "0x3abd5c94f1f1ef448bec40e01d4af0391dd896c4",
            metadataNFT: "0x72fa15d8f87c81acc03304899867f90363f42164",
            priceFeed: "0x080612f74f3c823b0c7f1649136ab8a096d2576f",
            gasPool: "0xcb65e9498d9d2eed03a83c49d918b3084795ac81",
            leverageZapper: "0x31a2552006b47a77c10b18fde3ac35ba2b1c09a0",
          },
          1: {
            collToken: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
            leverageZapper: "0x978d7188ae01881d254ad7e94874653b0c268004",
            stabilityPool: "0xf69eb8c0d95d4094c16686769460f678727393cf",
            troveManager: "0x81d78814df42da2cab0e8870c477bc3ed861de66",
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
          },
          11155111: {
            collToken: "0x8116d0a0e8d4f0197b428c520953f302adca0b50",
            leverageZapper: "0x482bf4d6a2e61d259a7f97ef6aac8b3ce5dd9f99",
            stabilityPool: "0x89fb98c98792c8b9e9d468148c6593fa0fc47b40",
            troveManager: "0x364038750236739e0cd96d5754516c9b8168fb0c",
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
          },
        },
      },
      {
        symbol: "YETH" as const,
        name: "YieldFi yETH",
        ticker: "yETH",
        icon: "yeth",
        branchId: 1,
        decimals: 18,
        collateralRatio: 1.2, // 120% MCR
        maxDeposit: "50000000", // $50M initial debt limit (placeholder)
        maxLTV: 0.8333, // 83.33% max LTV
        deployments: {
          5464: { // Saga EVM - placeholder for future deployment
            collToken: "0xA6F89de43315B444114258f6E6700765D08bcd56",
            addressesRegistry: "0x57fe798fb0d69e7e1e80624e539a05e94f6d6d37",
            activePool: "0x28bf8d53c2f98fd6a5157ad0ea4d016562712420",
            borrowerOperations: "0xf6f919bccad71bef15809f75ec46fa2b87827fd0",
            collSurplusPool: "0x882d8e06d3389a9a1e9db5d407cdf28957605a03",
            defaultPool: "0x812749d9611ad78074edd55c8bb7423a0d3849e1",
            sortedTroves: "0xceea52002f3d226f0162cd8846c0ae5153fb89df",
            stabilityPool: "0x8fa656dd831e6a82740eb614fe6e09b509e7c4ec",
            troveManager: "0xda6c08f4d8f13ac71acedb3ed4bcab5256bd0928",
            troveNFT: "0x63ecb09a72d6852602f80dff41f5c1d7b88e8bb4",
            metadataNFT: "0x42673e96954006f7b71989aea5d0566274d616c8",
            priceFeed: "0x5329e02140e328397b65428be28776e025d08edc",
            gasPool: "0x837ac0a8a523c416bf43843205372c45966bb66f",
            leverageZapper: "0x2e0128f8d160455d1bd90dd7160251f2c4aeec2d",
          },
          1: {
            collToken: "0x8464f6ecae1ea58ec816c13f964030eab8ec123a", // Ethereum yETH address from spreadsheet
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
          },
          11155111: {
            collToken: "0x0000000000000000000000000000000000000000",
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
          },
        },
      },   
      // === BTC-based collaterals (120% MCR, 83.33% max LTV) ===
      {
        symbol: "TBTC" as const,
        name: "tBTC",
        ticker: "tBTC",
        icon: "tbtc",
        branchId: 2,
        decimals: 18,
        collateralRatio: 1.1, // 110% MCR
        maxDeposit: "100000000", // $100M initial debt limit
        maxLTV: 0.9091, // 90.91% max LTV
        deployments: {
          5464: { // Saga EVM
            collToken: "0x7cF468a019C5bf734311D10C3a429bB504CAF3ce",
            addressesRegistry: "0x08503d385062fc141db08f95b09fce8ce3a34ac4",
            activePool: "0xf94cf42e4ad9c49854a0009e6eac8282be868ca1",
            borrowerOperations: "0x95db55721754afb448fc480267a8143785a6fc29",
            collSurplusPool: "0xb5b890b1b12d9a0419931ad613be65f5fe5c7807",
            defaultPool: "0x0270691db7849ead9908a665fb3cc8f2160f8c71",
            sortedTroves: "0xc169c5258b404b1c0c5edc5f11302147180e91c5",
            stabilityPool: "0x6f4a647699bfcb85501946f429e2c8d9ac625774",
            troveManager: "0xd5fd443357956a40f3808d296839502b5db7b45a",
            troveNFT: "0xcbeeeea1e5de468196d398f1508dc481bc2337a3",
            metadataNFT: "0x4e3c8df114b556b3df982c9c49ce9a585d6e36ab",
            priceFeed: "0x2737550dd3d1ae3f3b0461947d413497f1712240",
            gasPool: "0xcb32df9b0bf6cba75893c6fdcff0856eb10007cb",
            leverageZapper: "0xcc17aaa404d76358b84a414735f0d7eda59f6ad8",
          },
          1: {
            collToken: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
          },
          11155111: {
            collToken: "0xff9f477b09c6937ff6313ae90e79022609851a9c",
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
          },
        },
      },
      {
        symbol: "SAGA" as const,
        name: "SAGA",
        ticker: "SAGA",
        icon: "saga",
        branchId: 3,
        decimals: 6,
        collateralRatio: 1.5, // 150% MCR (higher volatility)
        maxDeposit: "999999999999999999", // No limit - max safe integer
        maxLTV: 0.6667, // 66.67% max LTV
        deployments: {
          5464: { // Saga EVM
            collToken: "0xA19377761FED745723B90993988E04d641c2CfFE", // Wrapped SAGA token on Saga EVM
            addressesRegistry: "0x1b6b326655f2d03953ed931948475b3fcf0d0fb2",
            activePool: "0x9f98b8b55f94b617a9a96cc778d8d2ffabd5a746",
            borrowerOperations: "0x0bb7c14d34aa27741790c44835bd12cba8d2d1d2",
            collSurplusPool: "0x50c7afece49b0a88d90425f081a10d1cadd55e88",
            defaultPool: "0xf490982d6e3735f908a999eb00f3e31ac0a2a3ea",
            sortedTroves: "0x05c8742fa874e2080cb48c94a6bf03793f26c685",
            stabilityPool: "0x790faf0c691f5fb3ce717c50c100a5f47ebe334e",
            troveManager: "0x9d0c4b508089c8466e1569c95811f9171da21f56",
            troveNFT: "0xea2d1d947038131f029cb0e4fdee147214461252",
            metadataNFT: "0x3aec73c5902e42b0e626a77a6b409199f2867431",
            priceFeed: "0x93a80cd6de30d096e391d96dddc9c7d078091f36",
            gasPool: "0x5a6f24b6a74a139cfe4110a5f1b0564c7b2b5480",
            leverageZapper: "0x7dc35c44f317125a4e10f8b814989e45886731ad",
          },
          1: { // Placeholder for Mainnet
            collToken: "0x0000000000000000000000000000000000000000",
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
          },
          11155111: { // Placeholder for Sepolia
            collToken: "0x0000000000000000000000000000000000000000",
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
          },
        },
      },
      {
        symbol: "STATOM" as const,
        name: "Stride Staked Atom",
        ticker: "stATOM",
        icon: "statom",
        branchId: 4,
        decimals: 6,
        collateralRatio: 1.25, // 125% MCR
        maxDeposit: "999999999999999999", // No limit - max safe integer
        maxLTV: 0.8, // 80.00% max LTV
        deployments: {
          5464: { // Saga EVM - will be deployed in upcoming PR
            collToken: "0xDaF9d9032b5d5C92528d6aFf6a215514B7c21056",
            addressesRegistry: "0xf671dd2de7a19a49e90f5df1cfea7f921a0f0ae2",
            activePool: "0x345a2515860ce84f6966a214eea786eff628c163",
            borrowerOperations: "0x2ac8eb0d574e137e21e8cf313e23bf4b6078bcf4",
            collSurplusPool: "0xa0b34f50f1926d15cab09b4b975cca0a3442de04",
            defaultPool: "0xb5eb128ca42f5586950fad8bb3eb804e0cff251f",
            sortedTroves: "0x0d9bf6e3eb3bb6fadefe55ec3294066c8d3431c5",
            stabilityPool: "0x0be254f7ec628fc5aec0b6faab2a7dc1b9aafc74",
            troveManager: "0x2300966646832a703c6bb0194eb900a35703125c",
            troveNFT: "0x3646e4f920f27d722fff56cb427ea2e541ba5eb1",
            metadataNFT: "0x6dc77ecbef17e25480f66fa95714534d5c505f72",
            priceFeed: "0xb565638e0ad6904a0eb06718a5da404818fa9a0a",
            gasPool: "0xf65557393d056d2450ef1bb5671fa54d171c0f92",
            leverageZapper: "0xa29ed354b419c0c7f82665c6384cc2eb9cabb7f4",
          },
          1: {
            collToken: "0x0000000000000000000000000000000000000000",
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
          },
          11155111: {
            collToken: "0x0000000000000000000000000000000000000000",
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
          },
        },
      },
      {
        symbol: "KING" as const,
        name: "King Protocol",
        ticker: "KING",
        icon: "king",
        branchId: 5,
        decimals: 18,
        collateralRatio: 1.5, // 150% MCR (higher volatility)
        maxDeposit: "500000", // $500K initial debt limit
        maxLTV: 0.6667, // 66.67% max LTV
        deployments: {
          5464: { // Saga EVM - placeholder for future deployment
            collToken: "0x58d9fbBc6037dedfBA99cAfA28e4C371b795ad97",
            addressesRegistry: "0x9cd90d60fa352ca30978b53d57f9f1b2e1b2f3e2",
            activePool: "0xd874e6b1e259d0cf948928b367cfae2678b43ab7",
            borrowerOperations: "0x6cc01367544e117c092a349cc5f8e52286c2df93",
            collSurplusPool: "0x9abcc04e6392ee6a3131ac873c55fe8adb07ba96",
            defaultPool: "0x2dba20fcbfca9b632aeedb772f368e0da7a46ffe",
            sortedTroves: "0x47f65ef3ebe52fee1ba778095ca5ee67dd9f20dc",
            stabilityPool: "0xe83317567beef3967ab60a062e8327918e7ced48",
            troveManager: "0x2854e8d68cb4cf17980db0756e2b22b7c9b0bea5",
            troveNFT: "0xbcc575a007f8814fd4a029208004884a40dc1370",
            metadataNFT: "0xebafae7620de2385ccc81111a73f59a0eccf818a",
            priceFeed: "0x8e7f799324d888aa94aaa0179370294a496f31fc",
            gasPool: "0x49381b9b5f219beace8287c5d3a57aa07eac8ca2",
            leverageZapper: "0x1b2443df05c8aca7301825d4a1fbcd0d7ac09b14",
          },
          1: {
            collToken: "0x8f08b70456eb22f6109f57b8fafe862ed28e6040", // Ethereum KING address from spreadsheet
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
          },
          11155111: {
            collToken: "0x0000000000000000000000000000000000000000",
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
          },
        },
      },
      {
        symbol: "YUSD" as const,
        name: "YieldFi yUSD",
        ticker: "yUSD",
        icon: "yusd",
        branchId: 6,
        decimals: 18,
        collateralRatio: 1.15, // 115% MCR
        maxDeposit: "5000000", // $5M initial debt limit
        maxLTV: 0.8696, // 86.96% max LTV
        deployments: {
          5464: { // Saga EVM - placeholder for future deployment
            collToken: "0x839e7e610108Cf3DCc9b40329db33b6E6bc9baCE",
            addressesRegistry: "0x4a7fd74d6edf1530d36b8ff781e777e96193ba08",
            activePool: "0xcde75337ce6c94b247fe76753ae9263caa5907cb",
            borrowerOperations: "0xe1e3fc853efb78256d0e617206eea35d06548a16",
            collSurplusPool: "0xd06868531c94ae1ebb6e3637c0f3b33f1782e573",
            defaultPool: "0x1d3cbde978b1e462c2dc7de8d3c8ace655b69e36",
            sortedTroves: "0x54861f1cf3f53932b020d8649d8b3c5a0dbc7c69",
            stabilityPool: "0x71a406d5d18d3712daf57a6b165850c455822e5f",
            troveManager: "0xec729a2871e084e392744570854829cebcee16f3",
            troveNFT: "0x28b633ddc21933a8fed23ee14fd015cf5e24d6ce",
            metadataNFT: "0x6182f3bfb6e1b0e326c72f87f95c65aa4fe8ecbf",
            priceFeed: "0x224b80725fff00fbf06336a93ba94de7b5f88022",
            gasPool: "0x36f12d021b6334848c466e77b14bac7dc1f51aa3",
            leverageZapper: "0xb9cecd6801cfcabe477a9968d0dd389b42a957af",
          },
          1: {
            collToken: "0x8464f6ecae1ea58ec816c13f964030eab8ec123a", // Ethereum yETH address from spreadsheet
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
          },
          11155111: {
            collToken: "0x0000000000000000000000000000000000000000",
            addressesRegistry: "0x0000000000000000000000000000000000000000",
            activePool: "0x0000000000000000000000000000000000000000",
            borrowerOperations: "0x0000000000000000000000000000000000000000",
            collSurplusPool: "0x0000000000000000000000000000000000000000",
            defaultPool: "0x0000000000000000000000000000000000000000",
            sortedTroves: "0x0000000000000000000000000000000000000000",
            stabilityPool: "0x0000000000000000000000000000000000000000",
            troveManager: "0x0000000000000000000000000000000000000000",
            troveNFT: "0x0000000000000000000000000000000000000000",
            metadataNFT: "0x0000000000000000000000000000000000000000",
            priceFeed: "0x0000000000000000000000000000000000000000",
            gasPool: "0x0000000000000000000000000000000000000000",
            leverageZapper: "0x0000000000000000000000000000000000000000",
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
    appUrl: "https://must.finance/",
    
    // External links
    links: {
      docs: {
        base: "https://docs.must.finance/",
        redemptions: "https://docs.must.finance/docs/user-docs/redemption-and-delegation#what-are-redemptions",
        liquidations: "https://docs.must.finance/docs/user-docs/borrowing-and-liquidations",
        delegation: "https://docs.must.finance/docs/user-docs/redemption-and-delegation#what-is-delegation",
        interestRates: "https://docs.must.finance/docs/user-docs/borrowing-and-liquidations",
        earn: "https://docs.must.finance/docs/user-docs/must-and-earn",
      },
      dune: "https://dune.com/saga/saga-protocol",
      discord: "https://discord.gg/saga",
      github: "https://github.com/NeriteOrg/saga",
      x: "https://x.com/sagaprotocol",
      friendlyForkProgram: "https://docs.must.finance/docs/technical-documentation/friendly-fork-program",
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
  
  return pools
    // .filter((pool) => pool.symbol.toLowerCase() !== "tbtc") // TODO: remove this once tBTC is supported
}

export function getEarnPoolSymbols() {
  return getAvailableEarnPools().map(pool => pool.symbol);
}

export function getCollateralSymbols() {
  return WHITE_LABEL_CONFIG.tokens.collaterals.map(collateral => collateral.symbol.toLowerCase());
}