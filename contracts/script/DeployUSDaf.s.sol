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
            _stalenessThreshold = _1_HOUR; // CL DAI/USD heartbeat. No Fallback
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

// deployed: struct DeployUsdAsFuckScript.DeploymentResult DeploymentResult({ contractsArray: [LiquityContracts({ addressesRegistry: 0x16B8111A999A9bDC3181192620A8F7b2439837Dd, activePool: 0xD7954A8c7FA74c97aD2545719cE82EAE915d73f7, borrowerOperations: 0xD55cB395408678cab7ebFDB69F74E461E5307780, collSurplusPool: 0x2CEF516E9db2240F83002fB41A4e883B24E0ffB1, defaultPool: 0xcBB43A0a3fe57CaB5fE4cB29Bf654c4a17cFe3FD, sortedTroves: 0x67453E302D54f9b98C19526ab39DBD14B974d096, stabilityPool: 0x0B656b3aF27E3A9cF143d16ed46466e0Be27Fecc, troveManager: 0xa0290af48d2E43162A1a05Ab9d01a4ca3a8B60CB, troveNFT: 0xbd87cd436de4ee066F146175a283a65Db9973062, metadataNFT: 0xFff2B6d4d6f58d02e07bc6f2D73Fe0E0987c7726, priceFeed: 0x629b6c0DcDf865584FD58a08727ABb9Db7390e28, gasPool: 0x078EaE28A2Bb4A5Eb3CFfD96011606E7e511f05E, interestRouter: 0x0e493F67f568b01C79f6B167aB0ffd3645D25bc2, collToken: 0x0655977FEb2f289A4aB78af67BAB0d17aAb84367, zapper: 0x07011C1CDEBC84fD5bbC64db6Ce5CA9B92ca598A, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x65799d1368Ed24125179dd6Bf5e9b845797Ca1Ba, activePool: 0x46B7180721Eb35983d97e6f819BcEdbe77ebcc03, borrowerOperations: 0x7C0eaAA7749B2c703A828407adA186dfc8866E1E, collSurplusPool: 0xC18e1867707B6186B3548a73c62077775e88602f, defaultPool: 0x3bCA1380BCAB9889f440406a3c2F493bE31c3aE2, sortedTroves: 0x3eccE7bFe668A1aF0c520661ca79859d4C5605A9, stabilityPool: 0xD95692Af0A30d936287Bc7dc3837d3fbf7415f8a, troveManager: 0x7F1171686e6028c321517EdB6DD70321164b6343, troveNFT: 0x822A91C2B394051A32dDDd3A0E4a657E908b6049, metadataNFT: 0xa46D2dCA358ef789586f292C132BFF3372e2cDd6, priceFeed: 0xC470A1574B469A562fb237e289FDb217f8C14dc9, gasPool: 0xf0A383222057BfB603Dd3289BcA0c51CF24d95B4, interestRouter: 0x0e493F67f568b01C79f6B167aB0ffd3645D25bc2, collToken: 0x83F20F44975D03b1b09e64809B757c47f942BEeA, zapper: 0xFf2736078E4a42c9f8fc7247412A724945A0E5aE, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x7f32320669e22380d00b28492E4479b93872d568, activePool: 0x8450Fb582063c1A1A7C68Fe5cA4fc3DBf2Ad969e, borrowerOperations: 0x05d1b7cef2D8AD38Cb867bDEEd1E9674Ad2E5b31, collSurplusPool: 0x6223d9EC34F379fB649FFF5FabB96A593aFb5431, defaultPool: 0x3E40bB108350A449C19DD11a842637566215C43b, sortedTroves: 0xb456F5852C35505f119B60C28438bF488289ca1f, stabilityPool: 0x6F35f38D93165b67edc6aBcD4B8ac5fef5ea86e0, troveManager: 0x2ba8e31b6C1C9f46046315406E840dBabeA803a8, troveNFT: 0xcF64A6a17BD6aeA1B7834e66DBD696F81bd8a10C, metadataNFT: 0x7eD60C6E3B1ab0a7743f226e2C9649af15B4f684, priceFeed: 0x806B2921E394b3f84A549AB89CF73e57F0C882c5, gasPool: 0xA0211636d2d90d47fAB14f968b1a49c7d3128EE0, interestRouter: 0x0e493F67f568b01C79f6B167aB0ffd3645D25bc2, collToken: 0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD, zapper: 0xB6e58F716EA885A26a1B7E6Ee7Ca779efAb32dAE, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x4B3eb2b1bBb0134D5ED5DAA35FeA78424B9481cd, activePool: 0xD344626AaDB84A23781B14B2F1FF01E40910A44A, borrowerOperations: 0x8bf82598fB8424cA59FfbFe88543820d05b0d425, collSurplusPool: 0x08feD38DE1035288C0f142a40fdc23f5df120025, defaultPool: 0xD369aAbDD62c7627Bf7c041144862c780f56cBf2, sortedTroves: 0x07ac2Ba2aa4A7223dD5A63583808A3d79d8a979e, stabilityPool: 0x001fDD4f3405F97Ed61C7dc817208dFEB8F6cB70, troveManager: 0x53A5DE1b94d7409F75FFF49fd81A823fb874BF71, troveNFT: 0x2C659500f95560645AA45820f17949aafC393929, metadataNFT: 0x069f91FeE9ddff23E017a9D152087d2c7481bDb4, priceFeed: 0xcDA8ccA990afF26fD8298e0d30304E4d01F7B387, gasPool: 0xF7f8Db72700c40cE84fB01D3b1fbdafED81dc51f, interestRouter: 0x0e493F67f568b01C79f6B167aB0ffd3645D25bc2, collToken: 0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6, zapper: 0x1f4F32fBC1e6D3460bD33B88E035Aa0795cc2949, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x20E3630D9ce22c7f3A4aee735fa007C06f4709dF, activePool: 0xdEE8A9AC2C2819fe6A3Bae45a12bff70c604805a, borrowerOperations: 0x783da97a2fEb06fc3a302041bf1Ae096B8eF0019, collSurplusPool: 0x8F409d86D1433979eB142e37D3e74F46257C7C9a, defaultPool: 0x4c4d2fF3d49a3A0785Cced6C79dEafF27ffB5d49, sortedTroves: 0xfBa97F86967FeACd3e62a0FcAC5C19D7B60Fb7D4, stabilityPool: 0x38b5C7A506fFf3d3DaFd2d013E969D6E99cd9B73, troveManager: 0x9dc845b500853F17E238C36Ba120400dBEa1D02A, troveNFT: 0x0bDC2d83051d6dA84E2AE5Cc63BB6EF7aE60581f, metadataNFT: 0x5C1dB629f4dAC3334bB486E467003C762abD3177, priceFeed: 0x0DAaFdDcf74451caec724Bcd2f0d7E4025C95B94, gasPool: 0x743eE66DAC0B3b1BD3A7ac99312393eC5A290eE6, interestRouter: 0x0e493F67f568b01C79f6B167aB0ffd3645D25bc2, collToken: 0x9D39A5DE30e57443BfF2A8307A4256c8797A3497, zapper: 0x58D1a68F882EEd25A63Cd4C2c5b574066a78F961, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0xc693C91c855f4B51957f8ea221534538232F0f98, activePool: 0x03eD0485b586Db818AB02e95EEeB5921b418a124, borrowerOperations: 0x40785101e6BB3c546A7B07b8F883ef79763932EF, collSurplusPool: 0x1FDB7AAe1d7676FF88e23b2799383ED6A14d63e2, defaultPool: 0x576EBA782D9B5F8bAb2DC729BB430849B9B5e1FE, sortedTroves: 0x2BD5a16F63480454A8302aD640323AB765A96930, stabilityPool: 0x76365e44314C048A924314C3Bd9bF59d6FA9e243, troveManager: 0x64454C84Dc289C7CDe7E2eE2F87Ae1196bC9cD36, troveNFT: 0x994927921e9ad789CC3788fd8E46a2F28a2EF225, metadataNFT: 0x8A99bEe720F80601d28f8dfE958BC12ddBd86741, priceFeed: 0xCe1Ca28e54fD3BD431F893DDFFFa1bd619C0517e, gasPool: 0xb585c432b77F8fBba53ed3ebD8B588F0f8C16096, interestRouter: 0x0e493F67f568b01C79f6B167aB0ffd3645D25bc2, collToken: 0x18084fbA666a33d37592fA2633fD49a74DD93a88, zapper: 0x1F18afBD0A055fe05AcFE22CE951dFC556F0bBa4, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x2AFF30744843aF04F68286Fa4818d44e93b80561, activePool: 0xC9E524C90598D679B6d1fD46Cd1dECfd20E353f3, borrowerOperations: 0xfc72d7301c323A5BcfD10FfDE35908CE201B6c52, collSurplusPool: 0x22d75A999ddef194E049f4d9E8885Bd2aa1d0f75, defaultPool: 0xFD256Da1Aa42695351C08B2ff4A91ebbA1A07f7f, sortedTroves: 0x26e6307CA1F7Ba57BeDb16a80E366b01e814eD77, stabilityPool: 0xE9a258F362FC7f8003a39B087046F64815CC9c56, troveManager: 0x085AbEe74F74E343647bdD2D68927e59163A0904, troveNFT: 0x70896A8Da8aa770D70f44F18b9106d6EcD1d7105, metadataNFT: 0x3535A5551bB0F1A41e15Eb2bf75B0dC8D57058CB, priceFeed: 0x4d349971C23d6142e8dE9dEbbfdBB045B7AAbA49, gasPool: 0xFa0033783210731b8587432ffbb366fF98Bc52BB, interestRouter: 0x0e493F67f568b01C79f6B167aB0ffd3645D25bc2, collToken: 0xF53bb90bd20c2a3Eb3eB01e8233130a69Db58324, zapper: 0x2aE50916b4467c681689069Bb54E94fD0246ba65, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 }), LiquityContracts({ addressesRegistry: 0x0F7Eb92d20e9624601D7dD92122AEd80Efa8ec6a, activePool: 0xada317bDAbb3c78f581ec2E056d5557663669fd0, borrowerOperations: 0xD00182E777f6DA3220355965412c9605Fcd80aA5, collSurplusPool: 0xcd3579a7FB0a46f20A3317d649Af07e9651175C5, defaultPool: 0xe8E0924fcACC3642aa7D28B7a0c3E8799498FC62, sortedTroves: 0x2e937bbf06AD085e98D6EDdeC887589D61EDD3B7, stabilityPool: 0x7F5D15f4053F1E34025907F0741F2abc4353c65c, troveManager: 0x0291C873838F7B62D743952D268BEbe9ace1efa4, troveNFT: 0x274D12Cc490d93371e36E1204AE4988cB83d26A5, metadataNFT: 0x6296d175e605978370168C97221468ab22175444, priceFeed: 0xAF99E6Cf5832222C0E22eF6bf0868C4Ed7f2953F, gasPool: 0x019d8Fd94a8947c12f96B7B52B6161d46e706Ca7, interestRouter: 0x0e493F67f568b01C79f6B167aB0ffd3645D25bc2, collToken: 0x7fd713FE57FCD0A7636C152Faba6bDC2D3B27d15, zapper: 0x1666Ee2dBb308c1ee321cc6F1575afCeaAd9b1e5, gasCompZapper: 0x0000000000000000000000000000000000000000, leverageZapper: 0x0000000000000000000000000000000000000000 })], collateralRegistry: 0xCFf0DcAb01563e5324ef9D0AdB0677d9C167d791, boldToken: 0x85E30b8b263bC64d94b827ed450F2EdFEE8579dA, usdcCurvePool: 0x95591348FE9718bE8bfa3afcC9b017D9Ec18A7fa, hintHelpers: 0x9E690678B7d2c2F5C094AD89d5c742CFcB02Ed8F, multiTroveGetter: 0xeC2302866D7bD20B4959318189b26E56Eb1edcA5, exchangeHelpers: 0x0000000000000000000000000000000000000000 })