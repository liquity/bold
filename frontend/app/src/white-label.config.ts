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
          token: "0x541ed792855719d0b88a4274f1cd7f47ff9ec80b",
          collateralRegistry: "0x04870daa52b05981974732ba0ac464bd2067de12",
          governance: "0x0000000000000000000000000000000000000000",
          hintHelpers: "0x79ff931208c432866795ed6b5c02de157900e5fd",
          multiTroveGetter: "0x49fe9cfa4030e24207602888d7d1201ff3e9db80",
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
            addressesRegistry: "0x8b5869e67351df545612b65d9141f1e8370e94e2",
            activePool: "0x79971d6cc9a8c70784d4d7930a19a33b5d0ef51c",
            borrowerOperations: "0x9e54923469fbadde2eae63fea2a13bdc1e9b97ef",
            collSurplusPool: "0x89b0ce41fa9178c2abf677518af006748966b396",
            defaultPool: "0x928eafb5fe8649d5576aafc25a975e1e42bc469d",
            sortedTroves: "0xeae0ee6b833ff6d8500d92703dbdf1b3bf9fea3f",
            stabilityPool: "0x736c85cb1e30ebdbc25bce1204d1118d3b0b9db6",
            troveManager: "0xad29692f867d167840689308b84b991df8b72891",
            troveNFT: "0xe694323a46892683a3fb169a6d83de7bf572f665",
            metadataNFT: "0x08543452d773879bd5f6bb4df938c2ce322affa3",
            priceFeed: "0x74356978abc3b22ad2318f6ad507891b40fa1ad4",
            gasPool: "0x0c8a1b0f8e3d6f745ca9cf01720e48ae3011b758",
            leverageZapper: "0x4F026FaC6747CC7f4C33f0691900088D3028f6D0",
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
            addressesRegistry: "0x28fb159ab5e4650d923377f659b0cf1eebd2cc5b",
            activePool: "0x9549201642c8d4b61cd439c119e2651e4199cfed",
            borrowerOperations: "0xb2ef9759674872fb0e110bb5f53014b4662e8325",
            collSurplusPool: "0xb21e420afba924d4bd21732ce4d52aff3b6dc6db",
            defaultPool: "0xc7e4ab27a5c349f8f2d470edaa1622e12cb233a0",
            sortedTroves: "0x6ed6eb60407022785e0a3641891d1a6657925a29",
            stabilityPool: "0x48998c6c99762e304853213635b7527db3db885a",
            troveManager: "0x5a318e3a37240ed2a88410169bee2ef775a42754",
            troveNFT: "0x8b27556957aaeafdccb329fd42140db46fa521d9",
            metadataNFT: "0xaf2cb36068d98e33b20b8bbf6d44fab42be0be4a",
            priceFeed: "0x3ee4b46c35268801ea22fd86f6844f7840cf6ed3",
            gasPool: "0x206e40b312d44c71d7452cb2375c38c9c5e4342b",
            leverageZapper: "0xAAF36295a0a6916CBc52268b0D1fE247626C4A4A",
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
            addressesRegistry: "0xb7a736bfcb095193fbfe1c1a63db85e4b05bd8bc",
            activePool: "0x5b1ea033ced0fd440473756eff8afd1c18232438",
            borrowerOperations: "0xf5b44b09c4db928b189d67d6ed608ef9bd3c81fe",
            collSurplusPool: "0xfde8f40b62c3461d5247d8955eda0d3e6ba548de",
            defaultPool: "0x9134681170d93e540b5e388f990e9f26b5fdc91b",
            sortedTroves: "0xb9ea6aa59f377cda5d4244531537c2ddff02d6f2",
            stabilityPool: "0xdddd9e64ffd57bfdbe67f94fff55ba3492a00ee8",
            troveManager: "0xd4311c2bdcfa4ee91640765d9f388b7f9cdfbc56",
            troveNFT: "0x66bb25c553b65e95b16bcd999b86ded7b20fc71e",
            metadataNFT: "0x63606ce1b16fe27c0ed156dfe8358cfb9f5601bf",
            priceFeed: "0x3fa3b50e0e4f15978abeb93a59d26202dd13f8c5",
            gasPool: "0xc7c1c86c817ea69611e80819c7fb681dc1931d28",
            leverageZapper: "0x1Fc3C7bC9812FD9DF88D7A3cC32eE634821c22C7",
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
            addressesRegistry: "0x2a14abe6a3fc35aff513cf0bfd26c84cdd545371",
            activePool: "0x090add8144785e4ca6f95e38bd34ab61f0c94b5d",
            borrowerOperations: "0xc71e328dc401ee6b11a5470d4b137e91b281a8e9",
            collSurplusPool: "0x4f093bbb30f9d849e020fa2b22b197e472bc5458",
            defaultPool: "0x44e4415b5ffe7f6ffeffa0a5468e65bd9eb03cd6",
            sortedTroves: "0xffc0c54eff11a76100c4e4417d10868e14633530",
            stabilityPool: "0x87952e261a8bb0958e44c67bb5027848dccad433",
            troveManager: "0xd2bd3cf8f7c5a3d6169308e5dfb6076710b61b4b",
            troveNFT: "0x45dbad5a78841c8838eab149a2afc8a93af10af7",
            metadataNFT: "0x4e9970e6419e83b02d3cf9b068f880bacbc2b629",
            priceFeed: "0xb28020f09b5ea9132ee7c7872b4f628648d5e609",
            gasPool: "0xac80c422110fc07f0844f0e4645120858d7c713c",
            leverageZapper: "0xf4ae7336ab0fa33c3fc9b289612072c8928ee512",
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
            addressesRegistry: "0x481c18f93b81f1fdded9f1f93804e0c0b8b123e3",
            activePool: "0xadbd40810081aeed2d2cdd68a58c9fe6cee57c70",
            borrowerOperations: "0x07cfcf7a3cf2e94bec4e82b0980bc8646118ee61",
            collSurplusPool: "0xbba7362f656eb3802c415fe72fb3168d65f507a9",
            defaultPool: "0x4352b0503bba36b592e86cf81ad793e9fbe3be63",
            sortedTroves: "0xa4d934d850418976b11f8174f738999d13e8a67f",
            stabilityPool: "0x5c5812ac6f709340cf470800f65460e83e7d3006",
            troveManager: "0xfbf57eaf937e2bf67276beddf14e983265ea9d79",
            troveNFT: "0x07efc6a20c7029d00541b38b2d0f0ef2408c6a18",
            metadataNFT: "0xc849b9365f975833f5fb01454c566af258261ce1",
            priceFeed: "0xd0411b017e7c1cde98a3ebe5ea889b8da4eaecdb",
            gasPool: "0xb3f2361b306b7101b9782681c941383c49ce6cf5",
            leverageZapper: "0xc94ba8e5a7071299140a69793721fa1e57377757",
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
            addressesRegistry: "0xaaf53ae065c4e1b0adbcaa42f9948741d8c0aa5b",
            activePool: "0x77406e2d03d1c0140fd79cbefe0b743bb1f550ff",
            borrowerOperations: "0x307ad2e5aab1dbc933dd80c954ac2fd91e349a5e",
            collSurplusPool: "0x44e7f0b2a8bf1592396390ed7c980e9991e588be",
            defaultPool: "0xcad1dcd5309549a49fca334fe8170cf1c2c6efda",
            sortedTroves: "0x4598cab94a464561aeb4fc242ce9adec76f606f9",
            stabilityPool: "0x9243f88c502d9cd8c79c622b0b3efe098e61bdd4",
            troveManager: "0xb190c50e374a457cfa8eba284d11107479e92a37",
            troveNFT: "0x40ac226b62e670e870ad2361dca61a506d01e6ad",
            metadataNFT: "0x1630527f0f9582e7dd76aae0a5316e28eb10f136",
            priceFeed: "0xec9c947c870b49d4d939af3cf6c35ca7eb8aa0dd",
            gasPool: "0x6456f3e5defa2474a70ae4e9e1dc6a4e74164f51",
            leverageZapper: "0xc9977216C6a31790a7C462F7B668f5B410C1C14A",
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
            addressesRegistry: "0xf5aafddf99e799c935be3b170840e392c715e8fe",
            activePool: "0x36043d06791719c4e61277dd0e1fd021d9ca4208",
            borrowerOperations: "0xc2bd38e2f82efa1ae4291aec65a6b39931c9663b",
            collSurplusPool: "0x69e5086214418acde3a6dc8fa879114419469a80",
            defaultPool: "0x3647c21f8427c02ff5bb808ecb59689c67fbb3e1",
            sortedTroves: "0x4dcf0de50f98b2475a180b75044a1c6dfc9ea526",
            stabilityPool: "0x8bd21044e623e57050e598a01ad143a3bfc33b45",
            troveManager: "0xa4b191a4266f8973fd157b86c0454283a30d215a",
            troveNFT: "0x0f506944a0ea051af7c6c10080b1bbc0c5a1d1dd",
            metadataNFT: "0xec17283ff00707d54fc6c5a140293fcf78228048",
            priceFeed: "0x1997a7fc5ca87f8b6cf3495e5a6eb633cfdd6886",
            gasPool: "0x28e597434ebf7130454b1932595cd3c0af79398e",
            leverageZapper: "0xD4ce8FAd7371eDE9807870993022A11bec3E8BAD",
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
    // .filter((pool) => pool.symbol.toLowerCase() !== "tbtc") // TODO: remove this once tBTC is supported
}

export function getEarnPoolSymbols() {
  return getAvailableEarnPools().map(pool => pool.symbol);
}

export function getCollateralSymbols() {
  return WHITE_LABEL_CONFIG.tokens.collaterals.map(collateral => collateral.symbol.toLowerCase());
}