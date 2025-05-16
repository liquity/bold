// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {StdCheats} from "forge-std/StdCheats.sol";
import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {IERC20 as IERC20_GOV} from "openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StringFormatting} from "test/Utils/StringFormatting.sol";
import {Accounts} from "test/TestContracts/Accounts.sol";
import {ERC20Faucet} from "test/TestContracts/ERC20Faucet.sol";
import {ETH_GAS_COMPENSATION} from "src/Dependencies/Constants.sol";
import {IBorrowerOperations} from "src/Interfaces/IBorrowerOperations.sol";
import "src/AddressesRegistry.sol";
import "src/ActivePool.sol";
import "src/BoldToken.sol";
import "src/BorrowerOperations.sol";
import "src/TroveManager.sol";
import "src/TroveNFT.sol";
import "src/CollSurplusPool.sol";
import "src/DefaultPool.sol";
import "src/GasPool.sol";
import "src/HintHelpers.sol";
import "src/MultiTroveGetter.sol";
import "src/SortedTroves.sol";
import "src/StabilityPool.sol";
import "src/PriceFeeds/WETHPriceFeed.sol";
import "src/PriceFeeds/WSTETHPriceFeed.sol";
import "src/PriceFeeds/RETHPriceFeed.sol";
import "src/CollateralRegistry.sol";
import "test/TestContracts/PriceFeedTestnet.sol";
import "test/TestContracts/MetadataDeployment.sol";
import "test/Utils/Logging.sol";
import "test/Utils/StringEquality.sol";
import "src/Zappers/WETHZapper.sol";
import "src/Zappers/GasCompZapper.sol";
import "src/Zappers/LeverageLSTZapper.sol";
import "src/Zappers/LeverageWETHZapper.sol";
import "src/Zappers/Modules/Exchanges/HybridCurveUniV3ExchangeHelpers.sol";
import {BalancerFlashLoan} from "src/Zappers/Modules/FlashLoans/BalancerFlashLoan.sol";
import "src/Zappers/Modules/Exchanges/Curve/ICurveStableswapNGFactory.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/ISwapRouter.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/IQuoterV2.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/IUniswapV3Pool.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/IUniswapV3Factory.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/INonfungiblePositionManager.sol";
import "src/Zappers/Modules/Exchanges/UniswapV3/UniPriceConverter.sol";
import "src/Zappers/Modules/Exchanges/HybridCurveUniV3Exchange.sol";
import {WETHTester} from "test/TestContracts/WETHTester.sol";
import "forge-std/console2.sol";
import {IRateProvider, IWeightedPool, IWeightedPoolFactory} from "./Interfaces/Balancer/IWeightedPool.sol";
import {IVault} from "./Interfaces/Balancer/IVault.sol";
import {MockStakingV1} from "V2-gov/test/mocks/MockStakingV1.sol";
import {InterestRouter} from "src/InterestRouter.sol";
import {CrvUsdFallbackOracle} from "src/PriceFeeds/USDaf/Fallbacks/CrvUsdFallbackOracle.sol";
import {ScrvUsdOracle} from "src/PriceFeeds/USDaf/ScrvUsdOracle.sol";
import {SdaiOracle} from "src/PriceFeeds/USDaf/SdaiOracle.sol";
import {SusdsOracle} from "src/PriceFeeds/USDaf/SusdsOracle.sol";
import {SfrxUsdOracle} from "src/PriceFeeds/USDaf/SfrxUsdOracle.sol";
import {SusdeOracle} from "src/PriceFeeds/USDaf/SusdeOracle.sol";
import {TbtcFallbackOracle} from "src/PriceFeeds/USDaf/Fallbacks/TbtcFallbackOracle.sol";
import {TbtcOracle} from "src/PriceFeeds/USDaf/TbtcOracle.sol";
import {WbtcFallbackOracle} from "src/PriceFeeds/USDaf/Fallbacks/WbtcFallbackOracle.sol";
import {WbtcOracle} from "src/PriceFeeds/USDaf/WbtcOracle.sol";
import {CbbtcFallbackOracle} from "src/PriceFeeds/USDaf/Fallbacks/CbbtcFallbackOracle.sol";
import {CbbtcOracle} from "src/PriceFeeds/USDaf/CbbtcOracle.sol";
import {WrappedWbtc} from "src/WrappedWbtc.sol";
import {WrappedCbbtc} from "src/WrappedCbbtc.sol";
import {ZapperAsFuck} from "src/Zappers/ZapperAsFuck.sol";
import {WbtcZapper} from "src/Zappers/WbtcZapper.sol";
import {CbbtcZapper} from "src/Zappers/CbbtcZapper.sol";

import {DeployGovernance} from "./DeployGovernance.s.sol";

contract DeployUsdAsFuckScript is StdCheats, MetadataDeployment, Logging {
    using Strings for *;
    using StringFormatting for *;
    using StringEquality for string;

    CrvUsdFallbackOracle scrvUsdFallbackOracle;
    TbtcFallbackOracle tbtcFallbackOracle;
    WbtcFallbackOracle wbtcFallbackOracle;
    CbbtcFallbackOracle cbbtcFallbackOracle;

    WrappedWbtc wrappedWbtc;
    WrappedCbbtc wrappedCbbtc;

    string constant DEPLOYMENT_MODE_COMPLETE = "complete";
    string constant DEPLOYMENT_MODE_BOLD_ONLY = "bold-only";
    string constant DEPLOYMENT_MODE_USE_EXISTING_BOLD = "use-existing-bold";

    uint256 constant NUM_BRANCHES = 8;

    address WETH_ADDRESS = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address USDC_ADDRESS = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    // used for gas compensation and as collateral of the first branch
    // tapping disallowed
    IWETH WETH;
    IERC20Metadata USDC;
    address WSTETH_ADDRESS = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
    address RETH_ADDRESS = 0xae78736Cd615f374D3085123A210448E74Fc6393;
    address ETH_ORACLE_ADDRESS = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address RETH_ORACLE_ADDRESS = 0x536218f9E9Eb48863970252233c8F271f554C2d0;
    address STETH_ORACLE_ADDRESS = 0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8;
    uint256 ETH_USD_STALENESS_THRESHOLD = 24 hours;
    uint256 STETH_USD_STALENESS_THRESHOLD = 24 hours;
    uint256 RETH_ETH_STALENESS_THRESHOLD = 48 hours;

    uint256 constant _24_HOURS = 86400;
    uint256 constant _1_HOUR = 3600;
    address constant SCRVUSD = 0x0655977FEb2f289A4aB78af67BAB0d17aAb84367;
    address constant SDAI = 0x83F20F44975D03b1b09e64809B757c47f942BEeA;
    address constant TBTC = 0x18084fbA666a33d37592fA2633fD49a74DD93a88;
    address constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    // address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant SUSDS = 0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD;
    address constant SFRXUSD = 0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6;
    address constant SUSDE = 0x9D39A5DE30e57443BfF2A8307A4256c8797A3497;

    // V1
    address LQTY_ADDRESS = 0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D;
    address LQTY_STAKING_ADDRESS = 0x4f9Fbb3f1E99B56e0Fe2892e623Ed36A76Fc605d;
    address LUSD_ADDRESS = 0x5f98805A4E8be255a32880FDeC7F6728C6568bA0;

    address internal lqty;
    address internal stakingV1;
    address internal lusd;

    // Curve
    ICurveStableswapNGFactory curveStableswapFactory;
    // https://docs.curve.fi/deployments/amm/#stableswap-ng
    // Sepolia
    ICurveStableswapNGFactory constant curveStableswapFactorySepolia =
        ICurveStableswapNGFactory(0xfb37b8D939FFa77114005e61CFc2e543d6F49A81);
    // Mainnet
    ICurveStableswapNGFactory constant curveStableswapFactoryMainnet =
        ICurveStableswapNGFactory(0x6A8cbed756804B16E05E741eDaBd5cB544AE21bf);
    uint128 constant BOLD_TOKEN_INDEX = 0;
    uint128 constant OTHER_TOKEN_INDEX = 1;

    // Uni V3
    uint24 constant UNIV3_FEE = 0.3e4;
    uint24 constant UNIV3_FEE_USDC_WETH = 500; // 0.05%
    uint24 constant UNIV3_FEE_WETH_COLL = 100; // 0.01%
    ISwapRouter uniV3Router;
    IQuoterV2 uniV3Quoter;
    IUniswapV3Factory uniswapV3Factory;
    INonfungiblePositionManager uniV3PositionManager;
    // https://docs.uniswap.org/contracts/v3/reference/deployments/ethereum-deployments
    // Sepolia
    ISwapRouter constant uniV3RouterSepolia = ISwapRouter(0x65669fE35312947050C450Bd5d36e6361F85eC12);
    IQuoterV2 constant uniV3QuoterSepolia = IQuoterV2(0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3);
    IUniswapV3Factory constant uniswapV3FactorySepolia = IUniswapV3Factory(0x0227628f3F023bb0B980b67D528571c95c6DaC1c);
    INonfungiblePositionManager constant uniV3PositionManagerSepolia =
        INonfungiblePositionManager(0x1238536071E1c677A632429e3655c799b22cDA52);
    // Mainnet
    ISwapRouter constant uniV3RouterMainnet = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    IQuoterV2 constant uniV3QuoterMainnet = IQuoterV2(0x61fFE014bA17989E743c5F6cB21bF9697530B21e);
    IUniswapV3Factory constant uniswapV3FactoryMainnet = IUniswapV3Factory(0x1F98431c8aD98523631AE4a59f267346ea31F984);
    INonfungiblePositionManager constant uniV3PositionManagerMainnet =
        INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);

    // Balancer
    IVault constant balancerVault = IVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
    IWeightedPoolFactory balancerFactory;
    // Sepolia
    // https://docs.balancer.fi/reference/contracts/deployment-addresses/sepolia.html
    IWeightedPoolFactory constant balancerFactorySepolia =
        IWeightedPoolFactory(0x7920BFa1b2041911b354747CA7A6cDD2dfC50Cfd);
    // Mainnet
    // https://docs.balancer.fi/reference/contracts/deployment-addresses/mainnet.html
    IWeightedPoolFactory constant balancerFactoryMainnet =
        IWeightedPoolFactory(0x897888115Ada5773E02aA29F775430BFB5F34c51);

    bytes32 SALT;
    address deployer;
    bool useTestnetPriceFeeds;

    uint256 lastTroveIndex;

    struct LiquityContracts {
        IAddressesRegistry addressesRegistry;
        IActivePool activePool;
        IBorrowerOperations borrowerOperations;
        ICollSurplusPool collSurplusPool;
        IDefaultPool defaultPool;
        ISortedTroves sortedTroves;
        IStabilityPool stabilityPool;
        ITroveManager troveManager;
        ITroveNFT troveNFT;
        MetadataNFT metadataNFT;
        IPriceFeed priceFeed;
        GasPool gasPool;
        IInterestRouter interestRouter;
        IERC20Metadata collToken;
        address zapper;
        GasCompZapper gasCompZapper;
        ILeverageZapper leverageZapper;
    }

    struct LiquityContractAddresses {
        address activePool;
        address borrowerOperations;
        address collSurplusPool;
        address defaultPool;
        address sortedTroves;
        address stabilityPool;
        address troveManager;
        address troveNFT;
        address metadataNFT;
        address priceFeed;
        address gasPool;
        address interestRouter;
    }

    struct Zappers {
        WETHZapper wethZapper;
        GasCompZapper gasCompZapper;
    }

    struct TroveManagerParams {
        uint256 CCR;
        uint256 MCR;
        uint256 SCR;
        uint256 BCR;
        uint256 LIQUIDATION_PENALTY_SP;
        uint256 LIQUIDATION_PENALTY_REDISTRIBUTION;
    }

    struct DeploymentVars {
        uint256 numCollaterals;
        IERC20Metadata[] collaterals;
        IAddressesRegistry[] addressesRegistries;
        ITroveManager[] troveManagers;
        LiquityContracts contracts;
        bytes bytecode;
        address boldTokenAddress;
        uint256 i;
    }

    struct DemoTroveParams {
        uint256 collIndex;
        uint256 owner;
        uint256 ownerIndex;
        uint256 coll;
        uint256 debt;
        uint256 annualInterestRate;
    }

    struct DeploymentResult {
        LiquityContracts[] contractsArray;
        ICollateralRegistry collateralRegistry;
        IBoldToken boldToken;
        ICurveStableswapNGPool usdcCurvePool;
        HintHelpers hintHelpers;
        MultiTroveGetter multiTroveGetter;
        IExchangeHelpers exchangeHelpers;
    }

    function run() public returns (DeploymentResult memory deployed) {
        string memory saltStr = vm.envOr("SALT", block.timestamp.toString());
        SALT = keccak256(bytes(saltStr));

        uint256 privateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        deployer = vm.addr(privateKey);
        vm.startBroadcast(privateKey);

        _log("Deployer:               ", deployer.toHexString());
        _log("Deployer balance:       ", deployer.balance.decimal());
        _log("CREATE2 salt:           ", 'keccak256(bytes("', saltStr, '")) = ', uint256(SALT).toHexString());

        // Deploy Bold or pick up existing deployment
        bytes memory boldBytecode = bytes.concat(type(BoldToken).creationCode, abi.encode(deployer));
        address boldAddress = vm.computeCreate2Address(SALT, keccak256(boldBytecode));
        BoldToken boldToken = new BoldToken{salt: SALT}(deployer);
        require(address(boldToken) == boldAddress, "BoldToken address mismatch");

        // mainnet
        WETH = IWETH(WETH_ADDRESS);
        USDC = IERC20Metadata(USDC_ADDRESS);
        curveStableswapFactory = curveStableswapFactoryMainnet;

        TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](NUM_BRANCHES);
        troveManagerParamsArray[0] = TroveManagerParams(120e16, 110e16, 105e16, BCR_ALL, 5e16, 10e16); // scrvUSD
        troveManagerParamsArray[1] = TroveManagerParams(120e16, 110e16, 105e16, BCR_ALL, 5e16, 10e16); // sDAI
        troveManagerParamsArray[2] = TroveManagerParams(120e16, 110e16, 105e16, BCR_ALL, 5e16, 10e16); // sUSDS
        troveManagerParamsArray[3] = TroveManagerParams(120e16, 110e16, 105e16, BCR_ALL, 5e16, 10e16); // sfrxUSD
        troveManagerParamsArray[4] = TroveManagerParams(120e16, 110e16, 105e16, BCR_ALL, 5e16, 10e16); // sUSDe
        troveManagerParamsArray[5] = TroveManagerParams(150e16, 120e16, 110e16, BCR_ALL, 5e16, 10e16); // tBTC
        troveManagerParamsArray[6] = TroveManagerParams(150e16, 120e16, 110e16, BCR_ALL, 5e16, 10e16); // WBTC
        troveManagerParamsArray[7] = TroveManagerParams(150e16, 120e16, 110e16, BCR_ALL, 5e16, 10e16); // cbBTC

        string[] memory collNames = new string[](NUM_BRANCHES);
        string[] memory collSymbols = new string[](NUM_BRANCHES);
        collNames[0] = "Savings crvUSD";
        collNames[1] = "Savings DAI";
        collNames[2] = "Savings USDS";
        collNames[3] = "Staked Frax USD";
        collNames[4] = "Staked USDe";
        collNames[5] = "tBTC v2";
        collNames[6] = "Wrapped WBTC";
        collNames[7] = "Wrapped Coinbase BTC";
        collSymbols[0] = "scrvUSD";
        collSymbols[1] = "sDAI";
        collSymbols[2] = "sUSDS";
        collSymbols[3] = "sfrxUSD";
        collSymbols[4] = "sUSDe";
        collSymbols[5] = "tBTC";
        collSymbols[6] = "WBTC18";
        collSymbols[7] = "cbBTC18";

        wrappedWbtc = new WrappedWbtc();
        wrappedCbbtc = new WrappedCbbtc();

        deployed = _deployAndConnectContracts(troveManagerParamsArray, collNames, collSymbols, boldAddress);

        vm.stopBroadcast();

        string memory governanceManifest = "";
        vm.writeFile("deployment-manifest.json", _getManifestJson(deployed, governanceManifest));
    }

    // See: https://solidity-by-example.org/app/create2/
    function getBytecode(bytes memory _creationCode, address _addressesRegistry) public pure returns (bytes memory) {
        return abi.encodePacked(_creationCode, abi.encode(_addressesRegistry));
    }

    function _deployAndConnectContracts(
        TroveManagerParams[] memory troveManagerParamsArray,
        string[] memory _collNames,
        string[] memory _collSymbols,
        // DeployGovernanceParams memory _deployGovernanceParams
        address _boldAddress
    ) internal returns (DeploymentResult memory r) {
        require(_collNames.length == troveManagerParamsArray.length, "collNames");
        require(_collSymbols.length == troveManagerParamsArray.length, "collSymbols");

        DeploymentVars memory vars;
        vars.numCollaterals = troveManagerParamsArray.length;
        r.boldToken = BoldToken(_boldAddress);

        // USDC and USDC-BOLD pool
        r.usdcCurvePool = _deployCurvePool(r.boldToken, USDC);

        r.contractsArray = new LiquityContracts[](vars.numCollaterals);
        vars.collaterals = new IERC20Metadata[](vars.numCollaterals);
        vars.addressesRegistries = new IAddressesRegistry[](vars.numCollaterals);
        vars.troveManagers = new ITroveManager[](vars.numCollaterals);

        // Collaterals
        vars.collaterals[0] = IERC20Metadata(SCRVUSD);
        vars.collaterals[1] = IERC20Metadata(SDAI);
        vars.collaterals[2] = IERC20Metadata(SUSDS);
        vars.collaterals[3] = IERC20Metadata(SFRXUSD);
        vars.collaterals[4] = IERC20Metadata(SUSDE);
        vars.collaterals[5] = IERC20Metadata(TBTC);
        vars.collaterals[6] = IERC20Metadata(wrappedWbtc);
        vars.collaterals[7] = IERC20Metadata(wrappedCbbtc);

        // Deploy AddressesRegistries and get TroveManager addresses
        for (vars.i = 0; vars.i < vars.numCollaterals; vars.i++) {
            (IAddressesRegistry addressesRegistry, address troveManagerAddress) =
                _deployAddressesRegistry(troveManagerParamsArray[vars.i]);
            vars.addressesRegistries[vars.i] = addressesRegistry;
            vars.troveManagers[vars.i] = ITroveManager(troveManagerAddress);
        }

        r.collateralRegistry = new CollateralRegistry(r.boldToken, vars.collaterals, vars.troveManagers);
        r.hintHelpers = new HintHelpers(r.collateralRegistry);
        r.multiTroveGetter = new MultiTroveGetter(r.collateralRegistry);

        InterestRouter interestRouter = new InterestRouter();

        // Deploy per-branch contracts for each branch
        for (vars.i = 0; vars.i < vars.numCollaterals; vars.i++) {
            vars.contracts = _deployAndConnectCollateralContracts(
                vars.collaterals[vars.i],
                r.boldToken,
                r.collateralRegistry,
                r.usdcCurvePool,
                vars.addressesRegistries[vars.i],
                address(vars.troveManagers[vars.i]),
                r.hintHelpers,
                r.multiTroveGetter,
                address(interestRouter)
            );
            r.contractsArray[vars.i] = vars.contracts;
        }

        r.boldToken.setCollateralRegistry(address(r.collateralRegistry));

        // // exchange helpers
        // r.exchangeHelpers = new HybridCurveUniV3ExchangeHelpers(
        //     USDC,
        //     WETH,
        //     r.usdcCurvePool,
        //     OTHER_TOKEN_INDEX, // USDC Curve pool index
        //     BOLD_TOKEN_INDEX, // BOLD Curve pool index
        //     UNIV3_FEE_USDC_WETH,
        //     UNIV3_FEE_WETH_COLL,
        //     uniV3Quoter
        // );
    }

    function _deployAddressesRegistry(TroveManagerParams memory _troveManagerParams)
        internal
        returns (IAddressesRegistry, address)
    {
        IAddressesRegistry addressesRegistry = new AddressesRegistry(
            deployer,
            _troveManagerParams.CCR,
            _troveManagerParams.MCR,
            _troveManagerParams.BCR,
            _troveManagerParams.SCR,
            _troveManagerParams.LIQUIDATION_PENALTY_SP,
            _troveManagerParams.LIQUIDATION_PENALTY_REDISTRIBUTION
        );
        address troveManagerAddress = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(TroveManager).creationCode, address(addressesRegistry)))
        );

        return (addressesRegistry, troveManagerAddress);
    }

    function _deployAndConnectCollateralContracts(
        IERC20Metadata _collToken,
        IBoldToken _boldToken,
        ICollateralRegistry _collateralRegistry,
        ICurveStableswapNGPool _usdcCurvePool,
        IAddressesRegistry _addressesRegistry,
        address _troveManagerAddress,
        IHintHelpers _hintHelpers,
        IMultiTroveGetter _multiTroveGetter,
        address _governance
    ) internal returns (LiquityContracts memory contracts) {
        LiquityContractAddresses memory addresses;
        contracts.collToken = _collToken;

        // Deploy all contracts, using testers for TM and PriceFeed
        contracts.addressesRegistry = _addressesRegistry;

        // Deploy Metadata
        contracts.metadataNFT = deployMetadata(SALT);
        addresses.metadataNFT = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(MetadataNFT).creationCode, address(initializedFixedAssetReader)))
        );
        require(address(contracts.metadataNFT) == addresses.metadataNFT, "shi");

        contracts.interestRouter = IInterestRouter(_governance);
        addresses.borrowerOperations = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(BorrowerOperations).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.troveManager = _troveManagerAddress;
        addresses.troveNFT = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(TroveNFT).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.stabilityPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(StabilityPool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.activePool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(ActivePool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.defaultPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(DefaultPool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.gasPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(GasPool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.collSurplusPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(CollSurplusPool).creationCode, address(contracts.addressesRegistry)))
        );
        addresses.sortedTroves = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(SortedTroves).creationCode, address(contracts.addressesRegistry)))
        );

        contracts.priceFeed = _deployPriceFeed(address(_collToken), addresses.borrowerOperations);

        IAddressesRegistry.AddressVars memory addressVars = IAddressesRegistry.AddressVars({
            collToken: _collToken,
            borrowerOperations: IBorrowerOperations(addresses.borrowerOperations),
            troveManager: ITroveManager(addresses.troveManager),
            troveNFT: ITroveNFT(addresses.troveNFT),
            metadataNFT: IMetadataNFT(addresses.metadataNFT),
            stabilityPool: IStabilityPool(addresses.stabilityPool),
            priceFeed: contracts.priceFeed,
            activePool: IActivePool(addresses.activePool),
            defaultPool: IDefaultPool(addresses.defaultPool),
            gasPoolAddress: addresses.gasPool,
            collSurplusPool: ICollSurplusPool(addresses.collSurplusPool),
            sortedTroves: ISortedTroves(addresses.sortedTroves),
            interestRouter: contracts.interestRouter,
            hintHelpers: _hintHelpers,
            multiTroveGetter: _multiTroveGetter,
            collateralRegistry: _collateralRegistry,
            boldToken: _boldToken,
            WETH: WETH
        });
        contracts.addressesRegistry.setAddresses(addressVars);

        contracts.borrowerOperations = new BorrowerOperations{salt: SALT}(contracts.addressesRegistry);
        contracts.troveManager = new TroveManager{salt: SALT}(contracts.addressesRegistry);
        contracts.troveNFT = new TroveNFT{salt: SALT}(contracts.addressesRegistry);
        contracts.stabilityPool = new StabilityPool{salt: SALT}(contracts.addressesRegistry);
        contracts.activePool = new ActivePool{salt: SALT}(contracts.addressesRegistry);
        contracts.defaultPool = new DefaultPool{salt: SALT}(contracts.addressesRegistry);
        contracts.gasPool = new GasPool{salt: SALT}(contracts.addressesRegistry);
        contracts.collSurplusPool = new CollSurplusPool{salt: SALT}(contracts.addressesRegistry);
        contracts.sortedTroves = new SortedTroves{salt: SALT}(contracts.addressesRegistry);

        assert(address(contracts.borrowerOperations) == addresses.borrowerOperations);
        assert(address(contracts.troveManager) == addresses.troveManager);
        assert(address(contracts.troveNFT) == addresses.troveNFT);
        assert(address(contracts.stabilityPool) == addresses.stabilityPool);
        assert(address(contracts.activePool) == addresses.activePool);
        assert(address(contracts.defaultPool) == addresses.defaultPool);
        assert(address(contracts.gasPool) == addresses.gasPool);
        assert(address(contracts.collSurplusPool) == addresses.collSurplusPool);
        assert(address(contracts.sortedTroves) == addresses.sortedTroves);

        // Connect contracts
        _boldToken.setBranchAddresses(
            address(contracts.troveManager),
            address(contracts.stabilityPool),
            address(contracts.borrowerOperations),
            address(contracts.activePool)
        );

        // deploy zappers
        contracts.zapper = _deployZappersAF(contracts.collToken, contracts.addressesRegistry);
    }

    function _deployPriceFeed(address _collTokenAddress, address _borroweOperationsAddress)
        internal
        returns (IPriceFeed)
    {
        uint256 _stalenessThreshold;
        address _oracle;
        if (_collTokenAddress == SCRVUSD) {
            _stalenessThreshold = _24_HOURS; // CL crvUSD/USD heartbeat. Fallback is block.timestamp
            CrvUsdFallbackOracle fallbackOracle = new CrvUsdFallbackOracle();
            _oracle = address(new ScrvUsdOracle(address(fallbackOracle)));
            scrvUsdFallbackOracle = fallbackOracle;
        } else if (_collTokenAddress == SDAI) {
            _stalenessThreshold = _1_HOUR; // CL DAI/USD heartbeat. No Fallback
            _oracle = address(new SdaiOracle());
        } else if (_collTokenAddress == SUSDS) {
            _stalenessThreshold = _1_HOUR; // CL DAI/USD heartbeat. No Fallback
            _oracle = address(new SusdsOracle());
        } else if (_collTokenAddress == SFRXUSD) {
            _stalenessThreshold = _24_HOURS; // CL frxUSD/USD heartbeat. No Fallback
            _oracle = address(new SfrxUsdOracle());
        } else if (_collTokenAddress == SUSDE) {
            _stalenessThreshold = _24_HOURS; // CL sUSDe/USD heartbeat. No Fallback
            _oracle = address(new SusdeOracle());
        } else if (_collTokenAddress == TBTC) {
            _stalenessThreshold = _24_HOURS; // CL tBTC/USD heartbeat. Fallback is block.timestamp
            TbtcFallbackOracle fallbackOracle = new TbtcFallbackOracle();
            _oracle = address(new TbtcOracle(address(fallbackOracle)));
            tbtcFallbackOracle = fallbackOracle;
        } else if (_collTokenAddress == address(wrappedWbtc)) {
            _stalenessThreshold = _24_HOURS; // CL WBTC/BTC heartbeat. Fallback is block.timestamp
            WbtcFallbackOracle fallbackOracle = new WbtcFallbackOracle();
            _oracle = address(new WbtcOracle(address(fallbackOracle)));
            wbtcFallbackOracle = fallbackOracle;
        } else if (_collTokenAddress == address(wrappedCbbtc)) {
            _stalenessThreshold = _24_HOURS; // CL cbBTC/BTC heartbeat. Fallback is block.timestamp
            CbbtcFallbackOracle fallbackOracle = new CbbtcFallbackOracle();
            _oracle = address(new CbbtcOracle(address(fallbackOracle)));
            cbbtcFallbackOracle = fallbackOracle;
        } else {
            revert("Collateral not supported");
        }

        return new WETHPriceFeed(_oracle, _stalenessThreshold, _borroweOperationsAddress);
    }

    function _deployZappersAF(IERC20 _collToken, IAddressesRegistry _addressesRegistry) internal returns (address) {
        if (address(_collToken) == address(wrappedWbtc)) {
            return address(new WbtcZapper(_addressesRegistry));
        } else if (address(_collToken) == address(wrappedCbbtc)) {
            return address(new CbbtcZapper(_addressesRegistry));
        } else {
            return address(new ZapperAsFuck(_addressesRegistry));
        }
    }

    function _deployCurvePool(IBoldToken _boldToken, IERC20Metadata _otherToken)
        internal
        returns (ICurveStableswapNGPool)
    {
        address basePool = address(0x4f493B7dE8aAC7d55F71853688b1F7C8F0243C85); // USDC/USDT Reserves Pool
        string memory name = "AF Power Pool Strategic Reserve";
        string memory symbol = "crv2USDaf";
        address coin = address(_boldToken);
        uint256 A = 200;
        uint256 fee = 2000000;
        uint256 offpeg_fee_multiplier = 50000000000;
        uint256 ma_exp_time = 866;
        uint256 implementation_id = 0;
        uint8 asset_type = 0;
        bytes4 method_id = 0x00000000;
        address oracle = address(0);

        ICurveStableswapNGPool curvePool = curveStableswapFactory.deploy_metapool(
            basePool,
            name,
            symbol,
            coin,
            A,
            fee,
            offpeg_fee_multiplier,
            ma_exp_time,
            implementation_id,
            asset_type,
            method_id,
            oracle
        );

        return curvePool;
    }

    function _getBranchContractsJson(LiquityContracts memory c) internal view returns (string memory) {
        return string.concat(
            "{",
            string.concat(
                // Avoid stack too deep by chunking concats
                string.concat(
                    string.concat('"collSymbol":"', c.collToken.symbol(), '",'), // purely for human-readability
                    string.concat('"collToken":"', address(c.collToken).toHexString(), '",'),
                    string.concat('"addressesRegistry":"', address(c.addressesRegistry).toHexString(), '",'),
                    string.concat('"activePool":"', address(c.activePool).toHexString(), '",'),
                    string.concat('"borrowerOperations":"', address(c.borrowerOperations).toHexString(), '",'),
                    string.concat('"collSurplusPool":"', address(c.collSurplusPool).toHexString(), '",'),
                    string.concat('"defaultPool":"', address(c.defaultPool).toHexString(), '",'),
                    string.concat('"sortedTroves":"', address(c.sortedTroves).toHexString(), '",')
                ),
                string.concat(
                    string.concat('"stabilityPool":"', address(c.stabilityPool).toHexString(), '",'),
                    string.concat('"troveManager":"', address(c.troveManager).toHexString(), '",'),
                    string.concat('"troveNFT":"', address(c.troveNFT).toHexString(), '",'),
                    string.concat('"metadataNFT":"', address(c.metadataNFT).toHexString(), '",'),
                    string.concat('"priceFeed":"', address(c.priceFeed).toHexString(), '",'),
                    string.concat('"gasPool":"', address(c.gasPool).toHexString(), '",'),
                    string.concat('"interestRouter":"', address(c.interestRouter).toHexString(), '",'),
                    string.concat('"zapper":"', address(c.zapper).toHexString(), '",')
                ),
                string.concat(
                    string.concat('"gasCompZapper":"', address(c.gasCompZapper).toHexString(), '",'),
                    string.concat('"leverageZapper":"', address(c.leverageZapper).toHexString(), '"') // no comma
                )
            ),
            "}"
        );
    }

    function _getDeploymentConstants() internal pure returns (string memory) {
        return string.concat(
            "{",
            string.concat(
                string.concat('"ETH_GAS_COMPENSATION":"', ETH_GAS_COMPENSATION.toString(), '",'),
                string.concat('"INTEREST_RATE_ADJ_COOLDOWN":"', INTEREST_RATE_ADJ_COOLDOWN.toString(), '",'),
                string.concat('"MAX_ANNUAL_INTEREST_RATE":"', MAX_ANNUAL_INTEREST_RATE.toString(), '",'),
                string.concat('"MIN_ANNUAL_INTEREST_RATE":"', MIN_ANNUAL_INTEREST_RATE.toString(), '",'),
                string.concat('"MIN_DEBT":"', MIN_DEBT.toString(), '",'),
                string.concat('"SP_YIELD_SPLIT":"', SP_YIELD_SPLIT.toString(), '",'),
                string.concat('"UPFRONT_INTEREST_PERIOD":"', UPFRONT_INTEREST_PERIOD.toString(), '"') // no comma
            ),
            "}"
        );
    }

    function _getManifestJson(DeploymentResult memory deployed, string memory _governanceManifest)
        internal
        view
        returns (string memory)
    {
        string[] memory branches = new string[](deployed.contractsArray.length);

        // Poor man's .map()
        for (uint256 i = 0; i < branches.length; ++i) {
            branches[i] = _getBranchContractsJson(deployed.contractsArray[i]);
        }

        return string.concat(
            "{",
            string.concat(
                string.concat('"constants":', _getDeploymentConstants(), ","),
                string.concat('"collateralRegistry":"', address(deployed.collateralRegistry).toHexString(), '",'),
                string.concat('"boldToken":"', address(deployed.boldToken).toHexString(), '",'),
                string.concat('"hintHelpers":"', address(deployed.hintHelpers).toHexString(), '",'),
                string.concat('"multiTroveGetter":"', address(deployed.multiTroveGetter).toHexString(), '",'),
                string.concat('"exchangeHelpers":"', address(deployed.exchangeHelpers).toHexString(), '",'),
                string.concat('"branches":[', branches.join(","), "],"),
                string.concat('"governance":', _governanceManifest, "") // no comma
            ),
            "}"
        );
    }
}
