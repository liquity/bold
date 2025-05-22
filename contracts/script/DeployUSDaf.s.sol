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
import {BTCPriceFeed} from "src/PriceFeeds/USDaf/BTCPriceFeed.sol";

import {DeployGovernance} from "./DeployGovernance.s.sol";

// ---- Usage ----
// forge script script/DeployUSDaf.s.sol:DeployUsdAsFuckScript --verify --legacy --etherscan-api-key $KEY --rpc-url $RPC_URL --broadcast

// verify:
// --constructor-args $(cast abi-encode "constructor(address,address,address)" 0xbACBBefda6fD1FbF5a2d6A79916F4B6124eD2D49 0x6A16CFA0dF474f3cB1BF5bBa595248EEfb404e2b 0x318d0059efE546b5687FA6744aF4339391153981)
// forge verify-contract --etherscan-api-key $KEY --watch --chain-id 42161 --compiler-version v0.8.18+commit.87f61d96 --verifier-url https://api.arbiscan.io/api 0x9a5eca1b228e47a15BD9fab07716a9FcE9Eebfb5 src/ERC404/BaseERC404.sol:BaseERC404

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

    // Curve
    ICurveStableswapNGFactory curveStableswapFactory;
    // https://docs.curve.fi/deployments/amm/#stableswap-ng
    // Mainnet
    ICurveStableswapNGFactory constant curveStableswapFactoryMainnet =
        ICurveStableswapNGFactory(0x6A8cbed756804B16E05E741eDaBd5cB544AE21bf);

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
            return new BTCPriceFeed(_oracle, _stalenessThreshold, _borroweOperationsAddress);
        } else if (_collTokenAddress == address(wrappedWbtc)) {
            _stalenessThreshold = _24_HOURS; // CL WBTC/BTC heartbeat. Fallback is block.timestamp
            WbtcFallbackOracle fallbackOracle = new WbtcFallbackOracle();
            _oracle = address(new WbtcOracle(address(fallbackOracle)));
            wbtcFallbackOracle = fallbackOracle;
            return new BTCPriceFeed(_oracle, _stalenessThreshold, _borroweOperationsAddress);
        } else if (_collTokenAddress == address(wrappedCbbtc)) {
            _stalenessThreshold = _24_HOURS; // CL cbBTC/BTC heartbeat. Fallback is block.timestamp
            CbbtcFallbackOracle fallbackOracle = new CbbtcFallbackOracle();
            _oracle = address(new CbbtcOracle(address(fallbackOracle)));
            cbbtcFallbackOracle = fallbackOracle;
            return new BTCPriceFeed(_oracle, _stalenessThreshold, _borroweOperationsAddress);
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


// deployed: struct DeployUsdAsFuckScript.DeploymentResult DeploymentResult({ contractsArray: [LiquityContracts({ addressesRegistry: 0xB91297d23f1d0e8Ba75d5A985CeBccB7F2078930, activePool: 0xB3937F68F86aAe4F9Fe20dDcB80F97d87A703696, borrowerOperations: 0x9fD699F2aB7760863Aa292606e34625aaFE7db0c, collSurplusPool: 0xB59D7Fe2D8DA53d0055D560570BA239f6b0661C6, defaultPool: 0xdAa23Af9BA99AB2f3266e3c988E1d9AAaA74a8c8, sortedTroves: 0x813F3bEcAEEb380A25A4be1B80602BFe5e2070F2, stabilityPool: 0x1Fdf421331B371C4cc3F3b48C6803b912c2EdA30, troveManager: 0x510a3e4A9aFe93154667F141b911A37d10e74B9A, troveNFT: 0x8B26db04607f82AFCf26EF239ff345f1Be91B486, metadataNFT: 0x67e1eB0bFdbC835CBDedCdB8EA34c4fb2453694D, priceFeed: 0x10b94088c318e29Aa6Ffb592741945AA92132809, gasPool: 0xaf9ABF061A17Cc80719374a7f5cAF08B8fcEFD8C, interestRouter: 0xB841eFE7cD6112FB1e74eE95F6Be65b95A23B910, collToken: 0x0655977FEb2f289A4aB78af67BAB0d17aAb84367, zapper: 0x68f434cDFD586e9acA681b55c2Bc77dd553Fc592, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0xd3B7BC894675219E8a0a0eB3095984F9B32Af240, activePool: 0xbaFCD51fc62d49D3f98F13c83024a1603eB369Bb, borrowerOperations: 0x29Cf879Ebde0738318646360B00C383c323a61Db, collSurplusPool: 0xa5A06c3d90C18637e01883Bd93763bc67696cB38, defaultPool: 0x0E9b2dA1be3C6B0D3cf83Dc62dEAAED019DC4eC4, sortedTroves: 0x378a86B1b456d93A748aF946eC6228f8D252d613, stabilityPool: 0x696f5F196BeBAe19483fDE92C5caacb72eE30e5E, troveManager: 0x6eaEeC79023a407feA0a15f29b8D8B83aCaDc457, troveNFT: 0xFb1F011D825f8B0cB6F18da7EFb24d5EB04376E6, metadataNFT: 0xD3b7Bb040149ef284006a8E4eb2c6f7639Ed646B, priceFeed: 0x7749748aAc9231E183640D9E78cd9B5412deB10b, gasPool: 0x7a34F677128A5Db676702ef0f0BEE7d5FFb4CC9C, interestRouter: 0xB841eFE7cD6112FB1e74eE95F6Be65b95A23B910, collToken: 0x83F20F44975D03b1b09e64809B757c47f942BEeA, zapper: 0x5dD187119112f2B375a8d4bbB756C28eD9b09Aa5, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0xa42A10646510950DD24043490473cA74639FA7Ef, activePool: 0x8D1Cf71687B8b2fb2f3c35B6241981002873017d, borrowerOperations: 0xAEA2DF5dCa3b923e646d2d1fcFcFf11A4Ca27687, collSurplusPool: 0xd78Bb1007094Dfc1b76Faff976C90bc7A1749407, defaultPool: 0xBf995BA323742eAc0b21971fC42CF006DDd72a0a, sortedTroves: 0x8B3B87BB0D9bF95A392976c60B554315F0627AC1, stabilityPool: 0xEC8Dd7EC66D4C8da3f9aD3E359546A4272086c54, troveManager: 0x2E47A690B9d1461BEc57f3c9C0059Ef8B35C6d5C, troveNFT: 0xb8DbF4B7A2cc2c02Bf99d6Bd6B416E6549d685Fd, metadataNFT: 0xd48F864C36A7C1f1ad2042b5a286b60532c17460, priceFeed: 0x56d63B862a53A91a25a0bDAD042A2e401Fc0bb8F, gasPool: 0xDf8bD0d630248E611E8F5d9Fa7dee82B542B8143, interestRouter: 0xB841eFE7cD6112FB1e74eE95F6Be65b95A23B910, collToken: 0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD, zapper: 0x27ae0B20c0B4878D52c4c01544412BD3973E336F, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0xE9b4fc950244C25664a5B2C87a7014001F7A1021, activePool: 0x46D24C77CeA11a3601489b15B70391856bFf5f73, borrowerOperations: 0xCb337e0F10e09F570ff2E90e2d7f27908Bc686f5, collSurplusPool: 0xa6214b1068093268Cd93C4f80ECC1Cd4A68c26f6, defaultPool: 0xEFE096c805ff1fB73BD1735b2c68789D2fE4ceb2, sortedTroves: 0xe018fa94c8e89c8530ac84961b6e727Ef7c7D0F8, stabilityPool: 0xcf50a58F0B1a9F343fCF3879505Da972f6314aFc, troveManager: 0x05E4364B36D1Ea081cdbF8861Aaf344C4Ddc1703, troveNFT: 0x08AdB73CE823b7B9099268231888DD84194d93E1, metadataNFT: 0x2C706F89b0076E93899AaB20849F7D361eF636C2, priceFeed: 0x76D15914B1275c278Ca60373F07FD4f683ec7572, gasPool: 0x03805b0691368CF239e136793321927c1276fc62, interestRouter: 0xB841eFE7cD6112FB1e74eE95F6Be65b95A23B910, collToken: 0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6, zapper: 0x7B86A8513210c8559c335e097124FC1cC5487f14, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x136Dac76EEB80E0E2C0ED13f1aE416f2FaEeF5a4, activePool: 0x704ef7898cE1f175B9964c4C64991315D08eCA26, borrowerOperations: 0xe46b2555220797d65C018853b25280B8c979a5f7, collSurplusPool: 0xc471a4b23B0e9f6d5028EF4df3aA235c83B4Fb54, defaultPool: 0xDFa8f33f72ee5106F1BF960BE8EC841aC2a04461, sortedTroves: 0xa18550e2a4C3Ab9D87DBbfF0D9F71D3ED5C51e96, stabilityPool: 0xF07fA95A89e868376a135f7F8A65b006696c3B85, troveManager: 0x391d3bfD8B5940CE2512c2ADDcd8BeBf41A520b8, troveNFT: 0x82e5c493bb47309c5483d93Ea30025dE3a7c0331, metadataNFT: 0x92EBf95349BE92666feCA49937D29fc7801e64Dd, priceFeed: 0x50F5cd484Fd70af485464b2E9ff4dA49ddb4521F, gasPool: 0xfD78830e05f48Fd4B2b664B7E888f7c2347EB63a, interestRouter: 0xB841eFE7cD6112FB1e74eE95F6Be65b95A23B910, collToken: 0x9D39A5DE30e57443BfF2A8307A4256c8797A3497, zapper: 0x18D2075a69824e10fA4c978cBd29cD9b35692db3, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x91a30Ac56Db5628B3F23aA4A0E722F1f725fC0Ee, activePool: 0x3236193CAb52e308642D5247304da483f982E3e4, borrowerOperations: 0x45CD1879959097d9516a28EF4F27d5E48b7baa86, collSurplusPool: 0xAB31E6956c7380ca1636Bf99bd5F32AE189f1527, defaultPool: 0x3E0E0B6e7354C8453F427b11E3a95691a656E24A, sortedTroves: 0x029cc38948f5B449AFefcaE2147994af31bB7dfB, stabilityPool: 0x41Cc172b148A6991dA55a2bf31a2088A58bA9D3e, troveManager: 0x447f598058897DE80871aaCd4C4b4B2607562073, troveNFT: 0x92E0b4269fb121cf2358AD6C5e7E9f1382f4fc17, metadataNFT: 0xfca54a2DF4Daf0f3BEa90b5Ee73013C73E7CfC6b, priceFeed: 0x7bca4c220CFcF1DfAa7F164037a5F046bde56Ce5, gasPool: 0x49341bC9B19F000ab2B08b19c2171A810391F10b, interestRouter: 0xB841eFE7cD6112FB1e74eE95F6Be65b95A23B910, collToken: 0x18084fbA666a33d37592fA2633fD49a74DD93a88, zapper: 0x9b004df2d4F16f0Dbdebbc5e4d21EE3753ea0c6E, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0xb3D1111A80D5F1e244Da51Bb11168E2169c759e1, activePool: 0x9460C2A258bA24aC82B5B92122BA6E35BB1dCe56, borrowerOperations: 0x47C78dc4FaF092B2a8Fd260b359ac6C8ED389900, collSurplusPool: 0xF63764E19dA3a1Aaf5f7cFE85918629c24Ec9E5D, defaultPool: 0x4a0307f735B7163C360F7dCD1728aB4bDC6Cc023, sortedTroves: 0x66cb7fc3E85b59D887dC5C2EB1CC10367a9d4fba, stabilityPool: 0x2264Caa0eC0Aef27edC7a243ae1460CeC30C3a04, troveManager: 0xfD287eb65530228097bBff73F5D7787C025a1C89, troveNFT: 0xe131075F4744b04dD92AB7B459fad9D4cD059Cd4, metadataNFT: 0x9b55012A730E2194F1eeB55a840B7A20A5DA0050, priceFeed: 0x9e425B65Dde01ECa9d519d219A0049A716719d48, gasPool: 0x71e8eed7e66c0AC1bE666DA5F8030A5D9ADD79E2, interestRouter: 0xB841eFE7cD6112FB1e74eE95F6Be65b95A23B910, collToken: 0x7FCd772fC9363b6233D5cAEfBA43FcAf157a2783, zapper: 0x0B9655f38DCcAbBa0be6D1080Bb9bD6694f20bac, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x7F5CF9D64509F424e20Db9bF2024249C5Fee214f, activePool: 0x590c71D85ad4E704589E08B20dD042d1475F8861, borrowerOperations: 0xdA6Ad441e59168d5Ea158daF2131bb12f0aFED75, collSurplusPool: 0xbd2F36f9fdabFd2011accF4c0E501a4002344bE2, defaultPool: 0x81Ac7583B341d2081c0003F9aE85322EB10201c5, sortedTroves: 0x35750D2452e9b4216ea84E330C3bF3bFbc35395E, stabilityPool: 0x704b2554C512C789E1685F635dB902B24EB906a3, troveManager: 0x41E79dbd7e222b5A14970790303775A67be6b953, troveNFT: 0x47eA146fA290Bc7c2be3D8d88Ad919B5AFC4EDC2, metadataNFT: 0x1c48C4b767E6104287D27e97E551B1D418F2aF01, priceFeed: 0x2735aae1a56A5DbaC1a951B92bd9faD0f33eeFB4, gasPool: 0x60aD7d19f945c12f0D9c687ba0D8E9f7CF9395Cc, interestRouter: 0xB841eFE7cD6112FB1e74eE95F6Be65b95A23B910, collToken: 0x71D33511D53EE8a89724Ec9CBBDDf9cFD5fd086c, zapper: 0xaF26366736674319102B3E9B143e4760aca9Aa19, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 })], collateralRegistry: 0x5Fe5202e4C706405d57a6ac860db1839dd116979, boldToken: 0x46768200F4A78eC38c7dDCB18982AB3F5850cc8a, usdcCurvePool: 0x56322Cd77bb0c695cE7bE058327A309283A2342D, hintHelpers: 0xb57e0A3F1366bB34558ffbf41a473DBc5F022cE9, multiTroveGetter: 0xB7d29CE626B3B268f9D65e4120F45F6B11D8404d, exchangeHelpers: 0x0000000000000000000000000000000000000000 })