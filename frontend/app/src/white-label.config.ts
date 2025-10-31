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
        symbol: "WETH" as const,
        name: "WETH",
        icon: "eth",
        decimals: 18,
        collateralRatio: 1.1, // 110% MCR
        maxDeposit: "100000000", // $100M initial debt limit
        maxLTV: 0.9091, // 90.91% max LTV
        // Deployment info (per chain)
        deployments: {
          5464: { // Saga EVM
            collToken: "0xeb41D53F14Cb9a67907f2b8b5DBc223944158cCb",
            addressesRegistry: "0x4c2d21407e917c290f4336d5bc1db6df0b5f18f1",
            activePool: "0xcb0f20f6cc2d72f635af6fab739c87ee2e30462c",
            borrowerOperations: "0xd1abdcdaebce8fe6d8c9da3c557cad2d0d0f0dd7",
            collSurplusPool: "0x4d69f1a8e6878999fcb1f02e8ddd343ce0617fe0",
            defaultPool: "0xc1ae9987367eb1cad327e7633dca02b511bd76a7",
            sortedTroves: "0x0140f36f34f497b1bfd4cdce9a7349719c96523b",
            stabilityPool: "0xde6dc2fb3a26a791b0f9cfa83166be729860b0ee",
            troveManager: "0x13e9927901c3cec3234172addf47581077ccba0b",
            troveNFT: "0x90955e36c36568a2a6ca42bfd22a489a3f64d85b",
            metadataNFT: "0x094b784f50f3692cd69c9315492f1c31e64b59b1",
            priceFeed: "0x633530744e745f483beb3b70f7fdfb1249aee7df",
            gasPool: "0x22f05c86344bb7f2580e48b33aa6e5d141e47292",
            leverageZapper: "0xeb2c4fa3240a8f45933417b258fcb544eb70c0c2",
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
        name: "yETH",
        icon: "yeth",
        decimals: 18,
        collateralRatio: 1.2, // 120% MCR
        maxDeposit: "50000000", // $50M initial debt limit (placeholder)
        maxLTV: 0.8333, // 83.33% max LTV
        deployments: {
          5464: { // Saga EVM - placeholder for future deployment
            collToken: "0xA6F89de43315B444114258f6E6700765D08bcd56",
            addressesRegistry: "0x7d63ab7531d8b1190a5b89ae1a38b0088e27dbdb",
            activePool: "0xd0e0f75a53ae486eb124c6e181b0252c805f26c0",
            borrowerOperations: "0x70e1f01ce47c966d3bd98aed927c5ed0d54efb6a",
            collSurplusPool: "0x2d843efd6f39ed2c6db88a8cabedf6de58db9dc6",
            defaultPool: "0x4da6793c24e54b8b6ee0e20712c6ccd72b45c2d9",
            sortedTroves: "0xe1e4eedbfb60222727ea148c9bde2193b5da6675",
            stabilityPool: "0xa999817b8371b504ea9c13d3fd4d10ae45db7d86",
            troveManager: "0xfe474264e7d65005719bac266190db1f8ba8ed64",
            troveNFT: "0x2961f681424ed5bced819ecad73e6e02378882f9",
            metadataNFT: "0xc16ba743c88b79be5d3122068b28c05612e0f4e7",
            priceFeed: "0xc0ba91e9b39d44040534de5e2834f19ce6ad5f4c",
            gasPool: "0xcd2da7ccf448896c818035c7a1b2201d61d02699",
            leverageZapper: "0x109a5e350c767ea393e94071af0ebf2cb22ff344",
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
        icon: "tbtc",
        decimals: 18,
        collateralRatio: 1.1, // 110% MCR
        maxDeposit: "100000000", // $100M initial debt limit
        maxLTV: 0.9091, // 90.91% max LTV
        deployments: {
          5464: { // Saga EVM
            collToken: "0xa740E6758e309840ffFfe58f749F018386A3b70b",
            addressesRegistry: "0x54b4dfd03181504672a0ba775c349e1d31cd9649",
            activePool: "0x9e3bb586b8f410210835fd132c78ebc156d9fca0",
            borrowerOperations: "0x677a5c863490dd6b674b92410c69688135f2d9e1",
            collSurplusPool: "0x02472d413251750db1bd6bbd1b9e84d419a4e76c",
            defaultPool: "0xa1dbe43b1220bc9f3367c29ed1003a7c01aec7dc",
            sortedTroves: "0x27de1849a74f868d57f960546acc76eabb59b6f1",
            stabilityPool: "0x50a1b3b63b27219ebb363a5ee4d9e24ef0fc23b1",
            troveManager: "0x0a66df058fb462458a10f01393d6f2118104fe8a",
            troveNFT: "0x2f1f3efc79c4a7def428c0cd5b22f0e3586593b7",
            metadataNFT: "0x99aaf05a6fc91592b5bbd344f8c2e76df1a61b15",
            priceFeed: "0x41a6323e7d7469b555c89b8aba301ac42432f9e4",
            gasPool: "0x4d16679409d4dae2b71dc9d4eb22333a2b8b92cb",
            leverageZapper: "0x0f9375c6819018d2e1433a7e65e16d914b989c24",
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
        icon: "saga",
        decimals: 6,
        collateralRatio: 1.5, // 150% MCR (higher volatility)
        maxDeposit: "1000000", // $1M initial debt limit
        maxLTV: 0.6667, // 66.67% max LTV
        deployments: {
          5464: { // Saga EVM
            collToken: "0xA19377761FED745723B90993988E04d641c2CfFE", // Wrapped SAGA token on Saga EVM
            addressesRegistry: "0xce85847bd75f9f126e3b3efdc987c895a48614b5",
            activePool: "0x30cb9e6cdcc749cf5805deb4f209cc4b95e4fbea",
            borrowerOperations: "0xb349f0225752380d0a1b6463799bf8f099b4e11e",
            collSurplusPool: "0x2ad2fa004ad1280a48691e2a8d50fc295bda5fad",
            defaultPool: "0x70f00a209e2a30b363b396357a13a0b7bb14e1b4",
            sortedTroves: "0xd11efdd6f4811e5c67b8d0c9978606e097930bca",
            stabilityPool: "0x638e183dcf7913374addc1330d0c020ca9459c11",
            troveManager: "0x4eafce7e6054bce0868678802ec61f9ab075ca1a",
            troveNFT: "0xd594e7961f64c49d1eb01321f7c57509e4b97169",
            metadataNFT: "0x2ea18402ca9abdaebfdef8df7699cd150af04e16",
            priceFeed: "0x006db9341a2f747684d31ace72a77c994dfb64f8",
            gasPool: "0xab8d9e04b99d6b5055137e7be7e30aa2d3f1a0f7",
            leverageZapper: "0xa71a15a5376c409254a9bbf852eeb5355483d9b4",
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
        name: "stATOM",
        icon: "statom",
        decimals: 6,
        collateralRatio: 1.25, // 125% MCR
        maxDeposit: "1000000", // $1M initial debt limit
        maxLTV: 0.8, // 80.00% max LTV
        deployments: {
          5464: { // Saga EVM - will be deployed in upcoming PR
            collToken: "0xDaF9d9032b5d5C92528d6aFf6a215514B7c21056",
            addressesRegistry: "0xcf7e28abb54b7c306061b83058fb8c3f535a921a",
            activePool: "0x4abdee73201a47d31528b34e43f53381846e7183",
            borrowerOperations: "0xf9339df2bf05a3548afe304c7992480c7701a754",
            collSurplusPool: "0xca809ed097349c7f707c4cf0ec29e1e9ed749e68",
            defaultPool: "0xee28ddffbbc322eb08b0bc0d4544c4bb4444e861",
            sortedTroves: "0xf2a8cb619daa589a964f912ae138324c3743301d",
            stabilityPool: "0xd624541380cbc7ccfd50de071cf415453a5d9e9f",
            troveManager: "0xdcd96430e273ec8764ae3f50c67a150bd9bb3390",
            troveNFT: "0x5d5e93100f494efb1410b737b58ed8098898c379",
            metadataNFT: "0xa45350f5ceacd2ef14b035faecd4d42281e5a642",
            priceFeed: "0x4cb650983800723fe13ce1483c89c1d22ba85aa9",
            gasPool: "0x73377be318c5c9961538d16748d501d46d4c197f",
            leverageZapper: "0x7a348acd40155794def1951cc21d369c1cd19641",
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
        name: "KING",
        icon: "king",
        decimals: 18,
        collateralRatio: 1.5, // 150% MCR (higher volatility)
        maxDeposit: "500000", // $500K initial debt limit
        maxLTV: 0.6667, // 66.67% max LTV
        deployments: {
          5464: { // Saga EVM - placeholder for future deployment
            collToken: "0x58d9fbBc6037dedfBA99cAfA28e4C371b795ad97",
            addressesRegistry: "0xe6f3f507b044fd92680a02fb87e0913fda37ad20",
            activePool: "0x90c1e0de750b0287f2dd5a4c065eb950b5792f19",
            borrowerOperations: "0xc86a2221fb969f50914666222c7a2420dae793e0",
            collSurplusPool: "0x0cd19d190eaf8e4780093e69b9208579ce20a9b6",
            defaultPool: "0xec8c02deadde926ed1e0f269a8a4552a4df238ab",
            sortedTroves: "0xe460a878061637cdf13b1205231234f7d215e25f",
            stabilityPool: "0x711e0c24c5c7a8b07ee58db6638348189b74f61b",
            troveManager: "0xa8fc7de1015c113b8f2dba58cc5e0e846fbaf74a",
            troveNFT: "0x8ad64e9a10da54d18af5152e45b3b833cd7aba8c",
            metadataNFT: "0xd37b9edb362539a7ab14174f68d6049dc71879e8",
            priceFeed: "0x8824680c771813421210ef39bb5e56586208d40d",
            gasPool: "0x2ca89111ee03c829aadaa1debc169eea71b40105",
            leverageZapper: "0x45f7ccd8062ad129d26dc8ad4d0eed179b315cc7",
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
        name: "yUSD",
        icon: "yusd",
        decimals: 18,
        collateralRatio: 1.15, // 115% MCR
        maxDeposit: "5000000", // $5M initial debt limit
        maxLTV: 0.8696, // 86.96% max LTV
        deployments: {
          5464: { // Saga EVM - placeholder for future deployment
            collToken: "0x839e7e610108Cf3DCc9b40329db33b6E6bc9baCE",
            addressesRegistry: "0x6e3c69c548c2c96bd81f6ff7383314cf2de0e957",
            activePool: "0xb1da53a9869c555dd7bc8e1f7cd81bfde6dd2bf7",
            borrowerOperations: "0x2d221d3368a935a0d6f5eea6dca9be1f16963e35",
            collSurplusPool: "0xbdccd84bdc6ae92dd97ac70ee6f2db06f091d203",
            defaultPool: "0xfafce30c8dfbb005b98ba27667f6b7c3d543aa19",
            sortedTroves: "0xb3cdd548c90508f112248ef24b56ce69fac8d09a",
            stabilityPool: "0xdb1304a9739f9b2e9578ecbb52cef53ee10f0165",
            troveManager: "0x6a08df8ffc74baac2ad49317f1972be5c5cb28c6",
            troveNFT: "0x1ff471e1f88c7f42c7f1be5ab980e27b9e08224c",
            metadataNFT: "0x7f5c494026495060ce5922530d12628162e2c784",
            priceFeed: "0x7fd478468e272168601dcfcdc57474692adaf422",
            gasPool: "0xb0eb75cbe453d69ae7283b0e6f1388bc19c9c0a8",
            leverageZapper: "0x87d781e632c1da292c2526bbbed84d8d785dec53",
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
  
  return pools
    .filter((pool) => pool.symbol.toLowerCase() !== "tbtc") // TODO: remove this once tBTC is supported
}

export function getEarnPoolSymbols() {
  return getAvailableEarnPools().map(pool => pool.symbol);
}

export function getCollateralSymbols() {
  return WHITE_LABEL_CONFIG.tokens.collaterals.map(collateral => collateral.symbol.toLowerCase());
}