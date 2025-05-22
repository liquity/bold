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


// deployed: struct DeployUsdAsFuckScript.DeploymentResult DeploymentResult({ contractsArray: [LiquityContracts({ addressesRegistry: 0x901Ea6aB1D7Ac0e23082eFFe14CD6AEB924BfB4F, activePool: 0xd8b9E4feD86012C924ea274f20fD408dF128c994, borrowerOperations: 0x04162A7B04606f21519778eB62b9cE99c3405E49, collSurplusPool: 0x739df1C4d34be023aeda84C94b0c76828824Da63, defaultPool: 0x104E7E99f62C9F4d683d15d9c1999a4C46e93e2C, sortedTroves: 0x1bDc4d23de879FaEa7ACB1f8B13677759acadd45, stabilityPool: 0xFdA0D2F3D5A828Eb2735A38EDF4b4417388dBf3b, troveManager: 0x52e4B2A189C0f10790792859Ab2B558243b11e33, troveNFT: 0x2FfE9C2fD47894c71Ceb1f9525713c5d973065A6, metadataNFT: 0x7727B35252bAacdF7686F936db07396D7d4bCfb0, priceFeed: 0x5c6DEfad2e24169D513428CE8cEE1b3392bD43bC, gasPool: 0xf440c7fCA751c101130E84b5f06306Af1975AbBa, interestRouter: 0x8ae164992F45B85444C95B7D8E256AF0D86c6c86, collToken: 0x0655977FEb2f289A4aB78af67BAB0d17aAb84367, zapper: 0xe991a00754CC4F3Ba91731B5D8D91f0CEA2E7b3E, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0xE28516d2174A50aC3Cf134a0d1e3E654147CdC34, activePool: 0xA46c440efd9Cd1f003f510c560283D8a7c1751C4, borrowerOperations: 0x998A5f3201Ef2865979205865a83aa220A976e3a, collSurplusPool: 0xbc1d1952a5B1Efa6866a0065d96Fc0d7A6Fc9A33, defaultPool: 0x5d3B486357d39A067760ceC14fa4A363810B60c8, sortedTroves: 0xD4C767b3C77f32Da61EA4f0EB34e41eFAeaBe09B, stabilityPool: 0xEa4184ca167A31a90787DAD35408c7fe82981C96, troveManager: 0x8bdafe300A76ea293fB4Dada8225951F4dd1bF86, troveNFT: 0xE93D6397efD7812207D19eeebB6e6bAbb7040Aa4, metadataNFT: 0xA9f56Fe7BE173d0d996957a6F6A5Af1B2d1282cF, priceFeed: 0x08F38675e4bc8B8aa30FDf3F7082a8281d054402, gasPool: 0x569eB9185B0C78da98dA19A2Bf91Ba7114375357, interestRouter: 0x8ae164992F45B85444C95B7D8E256AF0D86c6c86, collToken: 0x83F20F44975D03b1b09e64809B757c47f942BEeA, zapper: 0x7bf88F9CB4F86dFFBa4861502abAa3A4c9357988, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x9dF5e7E2Ae001c513Bcb932Ef3aFE52519BA8Bdc, activePool: 0x17629F9A667AbC8D9D089aF8895261a41DAa5Eb4, borrowerOperations: 0x5426D73A229Ec992A9055d4518e52a2232469F3f, collSurplusPool: 0x13b8dDC6556A82CC9B3c3641A08129cc8459C4dC, defaultPool: 0x084f034249A39598321dE96DF8e78d3689B2aE6d, sortedTroves: 0xB767FAF6CB0FfC451342a11B63e21a3F75e78c5c, stabilityPool: 0xea15AA2Ac952F497F95F20Dd14C7D4f57d908e5E, troveManager: 0xecce0909353280f6a125161C2752D55EFeBA59E9, troveNFT: 0x727a9e5ac62F8ABA329Ea0628f898ccbE4007b25, metadataNFT: 0x3242Da627195b106210039d63b3857765997F2Db, priceFeed: 0xc736551507E746dda359F23ad74943A0ddED7472, gasPool: 0x9d12B5A8D35858E81efdB838f911311657B58ddC, interestRouter: 0x8ae164992F45B85444C95B7D8E256AF0D86c6c86, collToken: 0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD, zapper: 0xF7e4cF2fFAcDd3ca3bF8e1E35C759cd231c1f2d3, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0xF81298f9F45Ba49A76DdAE071B8622766584464e, activePool: 0x65734F53d6f0FEd38D086255E42b31773c4c0960, borrowerOperations: 0x82Ad152685BB41AB3123fd002b624d1db979A891, collSurplusPool: 0xF70d84eA1f12A61291632A2c44584C17974F3400, defaultPool: 0xa4F543F105fB4B435c5853D837EC188d677889C4, sortedTroves: 0xB449C70968beaEE4a068EFb87dcE12e1Fe7897Ef, stabilityPool: 0x53d9BCdc4A805b737E5182E2D7B6613b92b0629A, troveManager: 0xa5b02E17d25f32c5980C4f66a525aDBDf6301ddB, troveNFT: 0x8Ef88A9b9d34BB79e31D13496B5D7e27BF5bf9D3, metadataNFT: 0xc54D1CFeea60276bd2baf75c3A1B8649eC94dBF2, priceFeed: 0x5BdeE7F0F85Be5adEddeba687A77Caac6f412908, gasPool: 0x70230a3C236979749E7bE7FB6982ef4eaF77F7A4, interestRouter: 0x8ae164992F45B85444C95B7D8E256AF0D86c6c86, collToken: 0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6, zapper: 0xA2f1D8433e78E1e7590E80c1ac7E636D0A660852, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x951530bF4a99599dd7Bc5ad4541FD301dc2df669, activePool: 0x60d76A5810705629D89A6dAeeED0309Fd24b654b, borrowerOperations: 0xA1B25B8b6DdA61Ab1C21aa874719c3d5b16b175e, collSurplusPool: 0xF4801E20Dc1318f4F8D5625Ba025Dc73a4142403, defaultPool: 0xA691F8Aa5FecbD81Bd52d0ca89B25ad213daB3d6, sortedTroves: 0xd7fE2660101133c96F5F0770eda488CdA222B7dc, stabilityPool: 0x1A799beaCf0a565732aE066C6c9D406Cf1D248Fb, troveManager: 0xad6DcBC768eF6403AB0AA8719f1B1B1158543069, troveNFT: 0x5Ef76Eb5be75A79AaE6e1Af7476EBeF8aEfFe586, metadataNFT: 0xdEC5Ac65e052474adf8E87638294252B29d4727B, priceFeed: 0x7790609066b0849456f191548baC0D4b72a6f7Ef, gasPool: 0xd8Fbfa4AFddB1C87302aD79DB44fDD1CE7913446, interestRouter: 0x8ae164992F45B85444C95B7D8E256AF0D86c6c86, collToken: 0x9D39A5DE30e57443BfF2A8307A4256c8797A3497, zapper: 0xD85a467c7879B24E7ce599D436ec7DAF9E3Dfa52, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x809501fd65FF781bf5aBc13Aaa802cDB982D39f8, activePool: 0xb22C8785f62Eb6f76D10c3CB96ABcC3e8427f24c, borrowerOperations: 0xdA3DB89B8Fbc904912A23319630202d75B5253dC, collSurplusPool: 0x75179C59EF87A529f0f88c1CA490182479E5b36A, defaultPool: 0x00DD1487A67bf20936C1aE0d27676983f644273E, sortedTroves: 0xbe62287Ef81Ab3a48B3D8638a420380511eD5B83, stabilityPool: 0x2262a102FCB4e24d945A46ba53454C531811d8A4, troveManager: 0xb7e57eEdf15d33CbacE33Cff0db8903Ac4d098a0, troveNFT: 0xDEAA491Bfa30050c23085F10EC1611fBed85796C, metadataNFT: 0x019e0A2504427Afd4a3C89baC8cA1fCA0AcD0981, priceFeed: 0x2EFD16701fD94CAdaE723c20734962AfD36dCacf, gasPool: 0xF3903e239F02D06FD47c3518157cA957e3851968, interestRouter: 0x8ae164992F45B85444C95B7D8E256AF0D86c6c86, collToken: 0x18084fbA666a33d37592fA2633fD49a74DD93a88, zapper: 0xf5F1943e2Ac3565B3950DA8C127B7542345ae82d, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x681c639E727BdFCD1649d0105873B8dFf2EF526d, activePool: 0xBCDc0DE26515dF7B3338De62720e5900e1E8b0dE, borrowerOperations: 0x7d2c7623426C1c680aAE5637E1EE2361D34e3BF4, collSurplusPool: 0x3D094CfB17E079b91ad2435dB244192f9DfE410a, defaultPool: 0xbD3900ceB7E7318F6fBC1D1C95c18B7dEBC5D4E2, sortedTroves: 0x1CA0AEbC6d6eCE4BD5A62a48C3b9C15358F38B18, stabilityPool: 0x2C29AA340dEEE33cDb8224c342ba71e567665244, troveManager: 0x40E5926f20f40aD917ffD947460F653E67F7e4F2, troveNFT: 0xB3360b0502E53D1535356F57af7410BA682c4C66, metadataNFT: 0xca3403E159F5C2B7394747c96C10D638383290c9, priceFeed: 0xAC42fdCdf9B80e4Fd0660924B5C6a9c99BFC9AB0, gasPool: 0xAdDeb01AB804448cE0887A0c2DF8BAC6b1e331D1, interestRouter: 0x8ae164992F45B85444C95B7D8E256AF0D86c6c86, collToken: 0xb1525Db4f6e7F432F9c66A495A88a51277067170, zapper: 0x13fa9c074FEd65205CA7fee11c762f2040EdF131, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0xbe4a0c74f5D4bA26871e7B18a9bc144B006e2a6e, activePool: 0x141108bF2d0aF79e4b2a1f5ee72FD0434bf14416, borrowerOperations: 0x5f88F1Ec6f9d86D3b7FAD1aebF179A44449F56Ca, collSurplusPool: 0x9260bb75D02e1b55116a190C5CdF284f93B2eC83, defaultPool: 0xdBFCc6E3070e0203D06D288c091C61E15631f63c, sortedTroves: 0x6270760D10E3F6510d9eB04B50Fe1605eE2D3321, stabilityPool: 0xD9fD4135067B8BeB11c7C0c042E0F5688Fe30c7B, troveManager: 0x1EfE44bD61c6aE948D422d19d21D2bE1cC369CA1, troveNFT: 0x9cb394d51032d8692CBC3D0c3A55DaACC5184637, metadataNFT: 0xBa4BeDd850c724c87711BDa71F27a0C67eb01F87, priceFeed: 0x3c6897bf58Fe4d3a32f62e41D8a78Be5eF3FA421, gasPool: 0xd520471830723F5B208E4680f86536360Ba22094, interestRouter: 0x8ae164992F45B85444C95B7D8E256AF0D86c6c86, collToken: 0xc2Fdf0E8Cc806b0f8389d22d0DDa2564DD1b4402, zapper: 0xE247ab8Df16789976A42A7E39b5D822706A16A93, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 })], collateralRegistry: 0xd1e96d0D727C3B39BDbdb7C019dC1dF432A29D4d, boldToken: 0x674e149DFfCBC9d1a1FD67Bb78513F7bC02482b1, usdcCurvePool: 0xfB9F0AdA1e89539808308F5a7605b47fC588AfE0, hintHelpers: 0xdf2a04bfa87931E3a1A14A761f1C9095Cdb61421, multiTroveGetter: 0xC54b98E2D49dF36A1Cf2850932eE88D3a91166e0, exchangeHelpers: 0x0000000000000000000000000000000000000000 })