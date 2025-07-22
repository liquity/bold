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
import {StyBoldOracle} from "src/PriceFeeds/USDaf/StyBoldOracle.sol";
import {CrvUsdFallbackOracle} from "src/PriceFeeds/USDaf/Fallbacks/CrvUsdFallbackOracle.sol";
import {ScrvUsdOracle} from "src/PriceFeeds/USDaf/ScrvUsdOracle.sol";
import {SusdsOracle} from "src/PriceFeeds/USDaf/SusdsOracle.sol";
import {SfrxUsdOracle} from "src/PriceFeeds/USDaf/SfrxUsdOracle.sol";
import {TbtcFallbackOracle} from "src/PriceFeeds/USDaf/Fallbacks/TbtcFallbackOracle.sol";
import {TbtcOracle} from "src/PriceFeeds/USDaf/TbtcOracle.sol";
import {WbtcFallbackOracle} from "src/PriceFeeds/USDaf/Fallbacks/WbtcFallbackOracle.sol";
import {WbtcOracle} from "src/PriceFeeds/USDaf/WbtcOracle.sol";
import {WrappedWbtc} from "src/WrappedWbtc.sol";
import {ZapperAsFuck} from "src/Zappers/ZapperAsFuck.sol";
import {WbtcZapper} from "src/Zappers/WbtcZapper.sol";
import {BTCPriceFeed} from "src/PriceFeeds/USDaf/BTCPriceFeed.sol";

import {DeployGovernance} from "./DeployGovernance.s.sol";

// ---- Usage ----
// forge script script/DeployUSDaf.s.sol:DeployUsdAsFuckScript -g 250 --slow --verify --legacy --etherscan-api-key $KEY --rpc-url $RPC_URL --broadcast

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

    WrappedWbtc wrappedWbtc;

    string constant DEPLOYMENT_MODE_COMPLETE = "complete";
    string constant DEPLOYMENT_MODE_BOLD_ONLY = "bold-only";
    string constant DEPLOYMENT_MODE_USE_EXISTING_BOLD = "use-existing-bold";

    uint256 constant NUM_BRANCHES = 6;

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

    uint256 constant _24_HOURS = 86400 * 2; // actually 48 hours
    uint256 constant _1_HOUR = 3600 * 24; // actually 24 hours
    address constant STYBOLD = 0x23346B04a7f55b8760E5860AA5A77383D63491cD;
    address constant SCRVUSD = 0x0655977FEb2f289A4aB78af67BAB0d17aAb84367;
    address constant TBTC = 0x18084fbA666a33d37592fA2633fD49a74DD93a88;
    address constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
    // address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant SUSDS = 0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD;
    address constant SFRXUSD = 0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6;

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
        troveManagerParamsArray[0] = TroveManagerParams(120e16, 110e16, 105e16, BCR_ALL, 5e16, 10e16); // st-yBOLD
        troveManagerParamsArray[1] = TroveManagerParams(120e16, 110e16, 105e16, BCR_ALL, 5e16, 10e16); // scrvUSD
        troveManagerParamsArray[2] = TroveManagerParams(120e16, 110e16, 105e16, BCR_ALL, 5e16, 10e16); // sUSDS
        troveManagerParamsArray[3] = TroveManagerParams(120e16, 110e16, 105e16, BCR_ALL, 5e16, 10e16); // sfrxUSD
        troveManagerParamsArray[4] = TroveManagerParams(150e16, 120e16, 110e16, BCR_ALL, 5e16, 10e16); // tBTC
        troveManagerParamsArray[5] = TroveManagerParams(150e16, 120e16, 110e16, BCR_ALL, 5e16, 10e16); // WBTC

        string[] memory collNames = new string[](NUM_BRANCHES);
        string[] memory collSymbols = new string[](NUM_BRANCHES);
        collNames[0] = "Staked yBOLD";
        collNames[1] = "Savings crvUSD";
        collNames[2] = "Savings USDS";
        collNames[3] = "Staked Frax USD";
        collNames[4] = "tBTC v2";
        collNames[5] = "Wrapped WBTC";
        collSymbols[0] = "ysyBOLD";
        collSymbols[1] = "scrvUSD";
        collSymbols[2] = "sUSDS";
        collSymbols[3] = "sfrxUSD";
        collSymbols[4] = "tBTC";
        collSymbols[5] = "WBTC18";

        wrappedWbtc = new WrappedWbtc();

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
        vars.collaterals[0] = IERC20Metadata(STYBOLD);
        vars.collaterals[1] = IERC20Metadata(SCRVUSD);
        vars.collaterals[2] = IERC20Metadata(SUSDS);
        vars.collaterals[3] = IERC20Metadata(SFRXUSD);
        vars.collaterals[4] = IERC20Metadata(TBTC);
        vars.collaterals[5] = IERC20Metadata(wrappedWbtc);

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
        } else if (_collTokenAddress == STYBOLD) {
            _stalenessThreshold = type(uint256).max; // Never stale!
            _oracle = address(new StyBoldOracle());
        } else if (_collTokenAddress == SUSDS) {
            _stalenessThreshold = _24_HOURS; // CL USDS/USD heartbeat. No Fallback
            _oracle = address(new SusdsOracle());
        } else if (_collTokenAddress == SFRXUSD) {
            _stalenessThreshold = _24_HOURS; // CL frxUSD/USD heartbeat. No Fallback
            _oracle = address(new SfrxUsdOracle());
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
        } else {
            revert("Collateral not supported");
        }

        return new WETHPriceFeed(_oracle, _stalenessThreshold, _borroweOperationsAddress);
    }

    function _deployZappersAF(IERC20 _collToken, IAddressesRegistry _addressesRegistry) internal returns (address) {
        if (address(_collToken) == address(wrappedWbtc)) {
            return address(new WbtcZapper(_addressesRegistry));
        } else {
            return address(new ZapperAsFuck(_addressesRegistry));
        }
    }

    function _deployCurvePool(IBoldToken _boldToken, IERC20Metadata _otherToken)
        internal
        returns (ICurveStableswapNGPool)
    {
        // address basePool = address(0x4f493B7dE8aAC7d55F71853688b1F7C8F0243C85); // USDC/USDT Reserves Pool
        // string memory name = "AF Power Pool Strategic Reserve";
        // string memory symbol = "crv2USDaf";
        // address coin = address(_boldToken);
        // uint256 A = 200;
        // uint256 fee = 2000000;
        // uint256 offpeg_fee_multiplier = 50000000000;
        // uint256 ma_exp_time = 866;
        // uint256 implementation_id = 0;
        // uint8 asset_type = 0;
        // bytes4 method_id = 0x00000000;
        // address oracle = address(0);

        // ICurveStableswapNGPool curvePool = curveStableswapFactory.deploy_metapool(
        //     basePool,
        //     name,
        //     symbol,
        //     coin,
        //     A,
        //     fee,
        //     offpeg_fee_multiplier,
        //     ma_exp_time,
        //     implementation_id,
        //     asset_type,
        //     method_id,
        //     oracle
        // );

        // return curvePool;
        return ICurveStableswapNGPool(address(0));
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

// deployed: struct DeployUsdAsFuckScript.DeploymentResult DeploymentResult({ contractsArray: [LiquityContracts({ addressesRegistry: 0x3414bd84dfF0900a9046a987f4dF2e0eF08Fa1ce, activePool: 0xB87E1e1c4CC2DEcaDa13025a8DC8A94bdB77fB63, borrowerOperations: 0x57bd20aE68F845b35B76FE6e0239C9929EB48469, collSurplusPool: 0x6d013Fd94B789Ab98470c1860527DD5718A3DA2F, defaultPool: 0x27F539Ec3Fa3e548e10D4aC883534ebA891BB212, sortedTroves: 0x98d9b02b41cc2F8e72775Da528401A33765bC166, stabilityPool: 0x83e5BDe77d7477eCd972E338541b90Af57675536, troveManager: 0xF8a25a2E4c863bb7CEa7e4B4eeb3866BB7f11718, troveNFT: 0x63321Ee523a8D4E23c65a9206Da5A755Dd6a72fe, metadataNFT: 0x8f59b57B0Ef481E922679A78ff4a073602D76C43, priceFeed: 0x7F575323DDEDFbad449fEf5459FaD031FE49520b, gasPool: 0xD8C2a43fFbc2dF5d9514fDee80AA6758a3ed8C80, interestRouter: 0x1771f4De6836b10b59dD66990b0190985df6673c, collToken: 0x23346B04a7f55b8760E5860AA5A77383D63491cD, zapper: 0x9F69960304183768a01e0bA9f8A0164b556642d2, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x0C7B6C6a60ae2016199d393695667c1482719C82, activePool: 0x244c422663328233A5D1BD5045Ff943BA97d046E, borrowerOperations: 0x9e601005deaaEE8294c686e28E1AFfd04Cc13830, collSurplusPool: 0x0F7E2640aEf5373D79BffBfA6798D64dAfB93802, defaultPool: 0xC20a51F66c917fEff80D1E089199f727060C0369, sortedTroves: 0x233817bd6970F2Ec7F6963B02ab941dEC0A87A70, stabilityPool: 0xd48dC7cDdc481F596BD9A97755c7Ac696aD4eA87, troveManager: 0x7aFf0173e3D7C5416D8cAa3433871Ef07568220d, troveNFT: 0x5AaD68387CEc384dc4d7aF6bFc23F4F05E424D85, metadataNFT: 0x9DE6745F04Acb02C67310588353a70A10Ae865Dd, priceFeed: 0xF125C72aE447eFDF3fA3601Eda9AC0Ebec06CBB8, gasPool: 0xc5454328A03eAD90cF5700997040998e454fd577, interestRouter: 0x1771f4De6836b10b59dD66990b0190985df6673c, collToken: 0x0655977FEb2f289A4aB78af67BAB0d17aAb84367, zapper: 0x547d14F2E230cda0B99A17A1e396dC5B1e5D0920, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x330A0fDfc1818Be022FEDCE96A041293E16dc6d1, activePool: 0x08EAafd8FbB12cF12D6765E80C5b0FF8490C232D, borrowerOperations: 0x336D9C5ecb9D6ce79C8C077D35426e714969b41d, collSurplusPool: 0x2C56dd3A83D583810Ce1dDAE103660E46f0274a6, defaultPool: 0xFAb7396E2A6a3364e02ED26D2f80A354Aa923B88, sortedTroves: 0x1D9Cc5A514368E6f28EBA79B2DB8FA5C9484B058, stabilityPool: 0xb571781CEdf07257d60d6b252a3D8b24150Ded97, troveManager: 0x53ce82AC43660AaB1F80FEcd1D74Afe7a033D505, troveNFT: 0x0f462915322Cc2cA01f2e1E3DC7c598C43929B55, metadataNFT: 0x8bBED56077d5e1dE85C22b28682f25E8463204f7, priceFeed: 0x2113468843CF2d0FD976690F4Ec6e4213Df46911, gasPool: 0x31EF8a70F1f80d59B1c37592215c0287cD73CA3E, interestRouter: 0x1771f4De6836b10b59dD66990b0190985df6673c, collToken: 0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD, zapper: 0xE1DDE16f0dc85E05893B20131EB49DeeD543d68D, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x0ad1C302203F0fbB6Ca34641BDFeF0Bf4182377c, activePool: 0x20f29569566020d8E49c9843033c370772A93774, borrowerOperations: 0x2538cD346429eA59902e02448BB7A7c098e4554E, collSurplusPool: 0x4F3d778a6182Fe0c3e1723C1432Ce0Bf5EFf5526, defaultPool: 0xFe6F765e77FD8F17EC3a985ac36C3c3eA92c946D, sortedTroves: 0x7C1765fD1Ab5afaeD4A0A0aC74b2E4c45F5A5572, stabilityPool: 0x446F358e3a927cc68F342141d78Aa2d1C54e18F0, troveManager: 0x478E7c27193Aca052964C3306D193446027630b0, troveNFT: 0x6563200449414F8d147d34D0f043045e48ddc89f, metadataNFT: 0xc67b1883aBbe62bcC241f8F5f89e84846C04a00e, priceFeed: 0x653DF748Bf7A692555dCdbF4c504a8c84807f7C7, gasPool: 0x1E61cc99A573ad78960D9bcc80005abf7A93Ad9B, interestRouter: 0x1771f4De6836b10b59dD66990b0190985df6673c, collToken: 0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6, zapper: 0x54867De8786Dbd761463729F570B76172733f010, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0xbd9f75471990041A3e7C22872c814A273485E999, activePool: 0xb00d1d5dfd72a440b8C04A5f7b5Bc3C8159a7f44, borrowerOperations: 0xDA9af112eDfD837EebC1780433481426a52556e0, collSurplusPool: 0x60eEf55574EF687381D965eaCF7cDe0c8b61ca38, defaultPool: 0x254A6A3E172A81d5825122403E1bC4d47F264a07, sortedTroves: 0xD7a4d09680B8211940f19E1D1D25dc6568a4E0d0, stabilityPool: 0x545a7dDFd863bd7EA0BFc689125169598085f75e, troveManager: 0xfb17d0402ae557e3Efa549812b95e931B2B63bCE, troveNFT: 0x7fF33EF1a2dCB95c711Cc13b890be183f6288e6b, metadataNFT: 0xd85a27D9D1eEdD0fB75067f981284D7cd6196C0b, priceFeed: 0xeaF3b36748D89d64EF1B6B3E1d7637C3E4745094, gasPool: 0x62b9EB030Ba4cd6Fddc6cF48f60E5bcA454CB2f2, interestRouter: 0x1771f4De6836b10b59dD66990b0190985df6673c, collToken: 0x18084fbA666a33d37592fA2633fD49a74DD93a88, zapper: 0x14300f754C11aC4C848732151D80aFfb12F90374, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x2C5A85a3fd181857D02baff169D1e1cB220ead6d, activePool: 0xf507E264d507ef64a72aeaf4CC8C270D008FC48a, borrowerOperations: 0x664507f1445657D36D8064663653B7810971F411, collSurplusPool: 0xb81Cb6DB86D2AA95D2239F849E548C38aaD403d1, defaultPool: 0x01e37634CBd25Ec7Ffe680EcE5EEC178ff51ef2d, sortedTroves: 0x4B677B2c2bdAA64BcA08c62c4596d526e319Ea7b, stabilityPool: 0x922faA141e95e43A9deEab8DaDe3Ac8d4a32AD5c, troveManager: 0x7bd47Eca45ee18609D3D64Ba683Ce488ca9320A3, troveNFT: 0xcc47dA99965e3c8DD89b6e9305bb10232a314d23, metadataNFT: 0xb1866e385f8B17060b1249708D4BdaCe09de1624, priceFeed: 0x4B74D043336678D2F62dae6595bc42DcCabC3BB1, gasPool: 0xc89c160099090598EE3F570DEF29804DA2f969A2, interestRouter: 0x1771f4De6836b10b59dD66990b0190985df6673c, collToken: 0xe065Bc161b90C9C4Bba2de7F1E194b70A3267c47, zapper: 0xf8853A3C8FeD7e3ef145816B98F15278fCC2AA1C, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 })], collateralRegistry: 0x33D68055Cd54061991B2e98b9ab326fFCE4d60Fe, boldToken: 0x9Cf12ccd6020b6888e4D4C4e4c7AcA33c1eB91f8, usdcCurvePool: 0x0000000000000000000000000000000000000000, hintHelpers: 0x838a1F38c361Ffa1B23201640752149AdB4e865a, multiTroveGetter: 0xb3683A407bddDDFB126Cf06Fb52d974a08fD7E80, exchangeHelpers: 0x0000000000000000000000000000000000000000 })