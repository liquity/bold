// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../AddressesRegistry.sol";
import "../../ActivePool.sol";
import "../../BoldToken.sol";
import "../../BorrowerOperations.sol";
import "../../CollSurplusPool.sol";
import "../../DefaultPool.sol";
import "../../GasPool.sol";
import "../../HintHelpers.sol";
import "../../MultiTroveGetter.sol";
import "../../SortedTroves.sol";
import "../../StabilityPool.sol";
import "./BorrowerOperationsTester.t.sol";
import "./TroveManagerTester.t.sol";
import "../../TroveNFT.sol";
import "../../NFTMetadata/MetadataNFT.sol";
import "../../CollateralRegistry.sol";
import "../../MockInterestRouter.sol";
import "./PriceFeedTestnet.sol";
import "./MetadataDeployment.sol";
import "../../Zappers/WETHZapper.sol";
import "../../Zappers/GasCompZapper.sol";
import "../../Zappers/LeverageLSTZapper.sol";
import "../../Zappers/LeverageWETHZapper.sol";
import "../../Zappers/Modules/FlashLoans/BalancerFlashLoan.sol";
import "../../Zappers/Interfaces/IFlashLoanProvider.sol";
import "../../Zappers/Interfaces/IExchange.sol";
import "../../Zappers/Modules/Exchanges/Curve/ICurveFactory.sol";
import "../../Zappers/Modules/Exchanges/Curve/ICurvePool.sol";
import "../../Zappers/Modules/Exchanges/CurveExchange.sol";
import "../../Zappers/Modules/Exchanges/UniswapV3/ISwapRouter.sol";
import "../../Zappers/Modules/Exchanges/UniswapV3/IQuoterV2.sol";
import "../../Zappers/Modules/Exchanges/UniV3Exchange.sol";
import "../../Zappers/Modules/Exchanges/UniswapV3/INonfungiblePositionManager.sol";
import {WETHTester} from "./WETHTester.sol";
import {ERC20Faucet} from "./ERC20Faucet.sol";

import "../../PriceFeeds/WETHPriceFeed.sol";
import "../../PriceFeeds/WSTETHPriceFeed.sol";
import "../../PriceFeeds/RETHPriceFeed.sol";
import "../../PriceFeeds/OSETHPriceFeed.sol";
import "../../PriceFeeds/ETHXPriceFeed.sol";

import "forge-std/console2.sol";

uint256 constant _24_HOURS = 86400;
uint256 constant _48_HOURS = 172800;

// TODO: Split dev and mainnet
contract TestDeployer is MetadataDeployment {
    ICurveFactory constant curveFactory = ICurveFactory(0x98EE851a00abeE0d95D08cF4CA2BdCE32aeaAF7F);
    ISwapRouter constant uniV3Router = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    IQuoterV2 constant uniV3Quoter = IQuoterV2(0x61fFE014bA17989E743c5F6cB21bF9697530B21e);
    INonfungiblePositionManager constant uniV3PositionManager =
        INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);
    uint24 constant UNIV3_FEE = 3000; // 0.3%

    bytes32 constant SALT = keccak256("LiquityV2");

    struct LiquityContractsDev {
        IAddressesRegistry addressesRegistry;
        IActivePool activePool;
        IBorrowerOperationsTester borrowerOperations; // Tester
        ICollSurplusPool collSurplusPool;
        IDefaultPool defaultPool;
        ISortedTroves sortedTroves;
        IStabilityPool stabilityPool;
        ITroveManagerTester troveManager; // Tester
        ITroveNFT troveNFT;
        IPriceFeedTestnet priceFeed; // Tester
        GasPool gasPool;
        IInterestRouter interestRouter;
        IERC20Metadata collToken;
    }

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
        IPriceFeed priceFeed;
        GasPool gasPool;
        IInterestRouter interestRouter;
        IERC20Metadata collToken;
    }

    struct Zappers {
        WETHZapper wethZapper;
        GasCompZapper gasCompZapper;
        ILeverageZapper leverageZapperCurve;
        ILeverageZapper leverageZapperUniV3;
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

    struct TroveManagerParams {
        uint256 CCR;
        uint256 MCR;
        uint256 SCR;
        uint256 LIQUIDATION_PENALTY_SP;
        uint256 LIQUIDATION_PENALTY_REDISTRIBUTION;
    }

    struct DeploymentVarsDev {
        uint256 numCollaterals;
        IERC20Metadata[] collaterals;
        IAddressesRegistry[] addressesRegistries;
        ITroveManager[] troveManagers;
        bytes bytecode;
        address boldTokenAddress;
        uint256 i;
    }

    struct DeploymentResultMainnet {
        LiquityContracts[] contractsArray;
        ExternalAddresses externalAddresses;
        ICollateralRegistry collateralRegistry;
        IBoldToken boldToken;
        HintHelpers hintHelpers;
        MultiTroveGetter multiTroveGetter;
        Zappers[] zappersArray;
    }

    struct DeploymentVarsMainnet {
        OracleParams oracleParams;
        uint256 numCollaterals;
        IERC20Metadata[] collaterals;
        IAddressesRegistry[] addressesRegistries;
        ITroveManager[] troveManagers;
        IPriceFeed[] priceFeeds;
        bytes bytecode;
        address boldTokenAddress;
        uint256 i;
    }

    struct ExternalAddresses {
        address ETHOracle;
        address STETHOracle;
        address RETHOracle;
        address ETHXOracle;
        address OSETHOracle;
        address WSTETHToken;
        address RETHToken;
        address StaderOracle; // "StaderOracle" is the ETHX contract that manages the canonical exchange rate. Not a market pricacle.
        address OsTokenVaultController;
    }

    struct OracleParams {
        uint256 ethUsdStalenessThreshold;
        uint256 stEthUsdStalenessThreshold;
        uint256 rEthEthStalenessThreshold;
        uint256 ethXEthStalenessThreshold;
        uint256 osEthEthStalenessThreshold;
    }

    // See: https://solidity-by-example.org/app/create2/
    function getBytecode(bytes memory _creationCode, address _addressesRegistry) public pure returns (bytes memory) {
        return abi.encodePacked(_creationCode, abi.encode(_addressesRegistry));
    }

    function getAddress(address _deployer, bytes memory _bytecode, bytes32 _salt) public pure returns (address) {
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), _deployer, _salt, keccak256(_bytecode)));

        // NOTE: cast last 20 bytes of hash to address
        return address(uint160(uint256(hash)));
    }

    function deployAndConnectContracts()
        external
        returns (
            LiquityContractsDev memory contracts,
            ICollateralRegistry collateralRegistry,
            IBoldToken boldToken,
            HintHelpers hintHelpers,
            MultiTroveGetter multiTroveGetter,
            IWETH WETH, // for gas compensation
            Zappers memory zappers
        )
    {
        return deployAndConnectContracts(TroveManagerParams(150e16, 110e16, 110e16, 5e16, 10e16));
    }

    function deployAndConnectContracts(TroveManagerParams memory troveManagerParams)
        public
        returns (
            LiquityContractsDev memory contracts,
            ICollateralRegistry collateralRegistry,
            IBoldToken boldToken,
            HintHelpers hintHelpers,
            MultiTroveGetter multiTroveGetter,
            IWETH WETH, // for gas compensation
            Zappers memory zappers
        )
    {
        LiquityContractsDev[] memory contractsArray;
        TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](1);
        Zappers[] memory zappersArray;

        troveManagerParamsArray[0] = troveManagerParams;

        (contractsArray, collateralRegistry, boldToken, hintHelpers, multiTroveGetter, WETH, zappersArray) =
            deployAndConnectContractsMultiColl(troveManagerParamsArray);
        contracts = contractsArray[0];
        zappers = zappersArray[0];
    }

    function deployAndConnectContractsMultiColl(TroveManagerParams[] memory troveManagerParamsArray)
        public
        returns (
            LiquityContractsDev[] memory contractsArray,
            ICollateralRegistry collateralRegistry,
            IBoldToken boldToken,
            HintHelpers hintHelpers,
            MultiTroveGetter multiTroveGetter,
            IWETH WETH, // for gas compensation
            Zappers[] memory zappersArray
        )
    {
        // used for gas compensation and as collateral of the first branch
        WETH = new WETHTester(
            100 ether, //     _tapAmount
            1 days //         _tapPeriod
        );
        (contractsArray, collateralRegistry, boldToken, hintHelpers, multiTroveGetter, zappersArray) =
            deployAndConnectContracts(troveManagerParamsArray, WETH);
    }

    function deployAndConnectContracts(TroveManagerParams[] memory troveManagerParamsArray, IWETH _WETH)
        public
        returns (
            LiquityContractsDev[] memory contractsArray,
            ICollateralRegistry collateralRegistry,
            IBoldToken boldToken,
            HintHelpers hintHelpers,
            MultiTroveGetter multiTroveGetter,
            Zappers[] memory zappersArray
        )
    {
        DeploymentVarsDev memory vars;
        vars.numCollaterals = troveManagerParamsArray.length;
        // Deploy Bold
        vars.bytecode = abi.encodePacked(type(BoldToken).creationCode, abi.encode(address(this)));
        vars.boldTokenAddress = getAddress(address(this), vars.bytecode, SALT);
        boldToken = new BoldToken{salt: SALT}(address(this));
        assert(address(boldToken) == vars.boldTokenAddress);

        contractsArray = new LiquityContractsDev[](vars.numCollaterals);
        zappersArray = new Zappers[](vars.numCollaterals);
        vars.collaterals = new IERC20Metadata[](vars.numCollaterals);
        vars.addressesRegistries = new IAddressesRegistry[](vars.numCollaterals);
        vars.troveManagers = new ITroveManager[](vars.numCollaterals);

        // Deploy the first branch with WETH collateral
        vars.collaterals[0] = _WETH;
        (IAddressesRegistry addressesRegistry, address troveManagerAddress) =
            _deployAddressesRegistryDev(troveManagerParamsArray[0]);
        vars.addressesRegistries[0] = addressesRegistry;
        vars.troveManagers[0] = ITroveManager(troveManagerAddress);
        for (vars.i = 1; vars.i < vars.numCollaterals; vars.i++) {
            IERC20Metadata collToken = new ERC20Faucet(
                string.concat("Staked ETH", string(abi.encode(vars.i))), // _name
                string.concat("stETH", string(abi.encode(vars.i))), // _symbol
                100 ether, //     _tapAmount
                1 days //         _tapPeriod
            );
            vars.collaterals[vars.i] = collToken;
            // Addresses registry and TM address
            (addressesRegistry, troveManagerAddress) = _deployAddressesRegistryDev(troveManagerParamsArray[vars.i]);
            vars.addressesRegistries[vars.i] = addressesRegistry;
            vars.troveManagers[vars.i] = ITroveManager(troveManagerAddress);
        }

        collateralRegistry = new CollateralRegistry(boldToken, vars.collaterals, vars.troveManagers);
        hintHelpers = new HintHelpers(collateralRegistry);
        multiTroveGetter = new MultiTroveGetter(collateralRegistry);

        (contractsArray[0], zappersArray[0]) = _deployAndConnectCollateralContractsDev(
            _WETH,
            boldToken,
            collateralRegistry,
            _WETH,
            vars.addressesRegistries[0],
            address(vars.troveManagers[0]),
            hintHelpers,
            multiTroveGetter
        );

        // Deploy the remaining branches with LST collateral
        for (vars.i = 1; vars.i < vars.numCollaterals; vars.i++) {
            (contractsArray[vars.i], zappersArray[vars.i]) = _deployAndConnectCollateralContractsDev(
                vars.collaterals[vars.i],
                boldToken,
                collateralRegistry,
                _WETH,
                vars.addressesRegistries[vars.i],
                address(vars.troveManagers[vars.i]),
                hintHelpers,
                multiTroveGetter
            );
        }

        boldToken.setCollateralRegistry(address(collateralRegistry));
    }

    function _deployAddressesRegistryDev(TroveManagerParams memory _troveManagerParams)
        internal
        returns (IAddressesRegistry, address)
    {
        IAddressesRegistry addressesRegistry = new AddressesRegistry(
            address(this),
            _troveManagerParams.CCR,
            _troveManagerParams.MCR,
            _troveManagerParams.SCR,
            _troveManagerParams.LIQUIDATION_PENALTY_SP,
            _troveManagerParams.LIQUIDATION_PENALTY_REDISTRIBUTION
        );
        address troveManagerAddress = getAddress(
            address(this), getBytecode(type(TroveManagerTester).creationCode, address(addressesRegistry)), SALT
        );

        return (addressesRegistry, troveManagerAddress);
    }

    function _deployAndConnectCollateralContractsDev(
        IERC20Metadata _collToken,
        IBoldToken _boldToken,
        ICollateralRegistry _collateralRegistry,
        IWETH _weth,
        IAddressesRegistry _addressesRegistry,
        address _troveManagerAddress,
        IHintHelpers _hintHelpers,
        IMultiTroveGetter _multiTroveGetter
    ) internal returns (LiquityContractsDev memory contracts, Zappers memory zappers) {
        LiquityContractAddresses memory addresses;
        contracts.collToken = _collToken;

        // Deploy all contracts, using testers for TM and PriceFeed
        contracts.addressesRegistry = _addressesRegistry;
        contracts.priceFeed = new PriceFeedTestnet();
        contracts.interestRouter = new MockInterestRouter();

        // Deploy Metadata
        MetadataNFT metadataNFT = deployMetadata(SALT);
        addresses.metadataNFT = getAddress(
            address(this), getBytecode(type(MetadataNFT).creationCode, address(initializedFixedAssetReader)), SALT
        );
        assert(address(metadataNFT) == addresses.metadataNFT);

        // Pre-calc addresses
        addresses.borrowerOperations = getAddress(
            address(this),
            getBytecode(type(BorrowerOperationsTester).creationCode, address(contracts.addressesRegistry)),
            SALT
        );
        addresses.troveManager = _troveManagerAddress;
        addresses.troveNFT = getAddress(
            address(this), getBytecode(type(TroveNFT).creationCode, address(contracts.addressesRegistry)), SALT
        );
        addresses.stabilityPool = getAddress(
            address(this), getBytecode(type(StabilityPool).creationCode, address(contracts.addressesRegistry)), SALT
        );
        addresses.activePool = getAddress(
            address(this), getBytecode(type(ActivePool).creationCode, address(contracts.addressesRegistry)), SALT
        );
        addresses.defaultPool = getAddress(
            address(this), getBytecode(type(DefaultPool).creationCode, address(contracts.addressesRegistry)), SALT
        );
        addresses.gasPool = getAddress(
            address(this), getBytecode(type(GasPool).creationCode, address(contracts.addressesRegistry)), SALT
        );
        addresses.collSurplusPool = getAddress(
            address(this), getBytecode(type(CollSurplusPool).creationCode, address(contracts.addressesRegistry)), SALT
        );
        addresses.sortedTroves = getAddress(
            address(this), getBytecode(type(SortedTroves).creationCode, address(contracts.addressesRegistry)), SALT
        );

        // Deploy contracts
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
            WETH: _weth
        });
        contracts.addressesRegistry.setAddresses(addressVars);

        contracts.borrowerOperations = new BorrowerOperationsTester{salt: SALT}(contracts.addressesRegistry);
        contracts.troveManager = new TroveManagerTester{salt: SALT}(contracts.addressesRegistry);
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
        (zappers.gasCompZapper, zappers.wethZapper, zappers.leverageZapperCurve, zappers.leverageZapperUniV3) =
        _deployZappers(contracts.addressesRegistry, contracts.collToken, _boldToken, _weth, contracts.priceFeed, false);
    }

    // Creates individual PriceFeed contracts based on oracle addresses.
    // Still uses mock collaterals rather than real mainnet WETH and LST addresses.

    function deployAndConnectContractsMainnet(TroveManagerParams[] memory _troveManagerParamsArray)
        public
        returns (DeploymentResultMainnet memory result)
    {
        DeploymentVarsMainnet memory vars;

        result.externalAddresses.ETHOracle = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
        result.externalAddresses.RETHOracle = 0x536218f9E9Eb48863970252233c8F271f554C2d0;
        result.externalAddresses.STETHOracle = 0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8;
        result.externalAddresses.ETHXOracle = 0xC5f8c4aB091Be1A899214c0C3636ca33DcA0C547;
        result.externalAddresses.WSTETHToken = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
        // Redstone Oracle with CL interface
        // TODO: obtain the Chainlink market price feed and use that, when it's ready
        result.externalAddresses.OSETHOracle = 0x66ac817f997Efd114EDFcccdce99F3268557B32C;

        result.externalAddresses.RETHToken = 0xae78736Cd615f374D3085123A210448E74Fc6393;
        result.externalAddresses.StaderOracle = 0xF64bAe65f6f2a5277571143A24FaaFDFC0C2a737;
        result.externalAddresses.OsTokenVaultController = 0x2A261e60FB14586B474C208b1B7AC6D0f5000306;

        vars.oracleParams.ethUsdStalenessThreshold = _24_HOURS;
        vars.oracleParams.stEthUsdStalenessThreshold = _24_HOURS;
        vars.oracleParams.rEthEthStalenessThreshold = _48_HOURS;
        vars.oracleParams.ethXEthStalenessThreshold = _48_HOURS;
        vars.oracleParams.osEthEthStalenessThreshold = _48_HOURS;

        vars.numCollaterals = 5;
        result.contractsArray = new LiquityContracts[](vars.numCollaterals);
        result.zappersArray = new Zappers[](vars.numCollaterals);
        vars.priceFeeds = new IPriceFeed[](vars.numCollaterals);
        vars.collaterals = new IERC20Metadata[](vars.numCollaterals);
        vars.addressesRegistries = new IAddressesRegistry[](vars.numCollaterals);
        vars.troveManagers = new ITroveManager[](vars.numCollaterals);
        address troveManagerAddress;

        // Price feeds
        // ETH
        vars.priceFeeds[0] = new WETHPriceFeed(
            address(this), result.externalAddresses.ETHOracle, vars.oracleParams.ethUsdStalenessThreshold
        );

        // RETH
        vars.priceFeeds[1] = new RETHPriceFeed(
            address(this),
            result.externalAddresses.ETHOracle,
            result.externalAddresses.RETHOracle,
            result.externalAddresses.RETHToken,
            vars.oracleParams.ethUsdStalenessThreshold,
            vars.oracleParams.rEthEthStalenessThreshold
        );

        // wstETH
        vars.priceFeeds[2] = new WSTETHPriceFeed(
            address(this),
            result.externalAddresses.STETHOracle,
            vars.oracleParams.stEthUsdStalenessThreshold,
            result.externalAddresses.WSTETHToken
        );

        // ETHx
        vars.priceFeeds[3] = new ETHXPriceFeed(
            address(this),
            result.externalAddresses.ETHOracle,
            result.externalAddresses.ETHXOracle,
            result.externalAddresses.StaderOracle,
            vars.oracleParams.ethUsdStalenessThreshold,
            vars.oracleParams.ethXEthStalenessThreshold
        );

        // osETH
        vars.priceFeeds[4] = new OSETHPriceFeed(
            address(this),
            result.externalAddresses.ETHOracle,
            result.externalAddresses.OSETHOracle,
            result.externalAddresses.OsTokenVaultController,
            vars.oracleParams.ethUsdStalenessThreshold,
            vars.oracleParams.osEthEthStalenessThreshold
        );

        // Deploy Bold
        vars.bytecode = abi.encodePacked(type(BoldToken).creationCode, abi.encode(address(this)));
        vars.boldTokenAddress = getAddress(address(this), vars.bytecode, SALT);
        result.boldToken = new BoldToken{salt: SALT}(address(this));
        assert(address(result.boldToken) == vars.boldTokenAddress);

        // WETH
        IWETH WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
        vars.collaterals[0] = WETH;
        (vars.addressesRegistries[0], troveManagerAddress) =
            _deployAddressesRegistryMainnet(_troveManagerParamsArray[0]);
        vars.troveManagers[0] = ITroveManager(troveManagerAddress);

        // RETH
        vars.collaterals[1] = IERC20Metadata(0xae78736Cd615f374D3085123A210448E74Fc6393);
        (vars.addressesRegistries[1], troveManagerAddress) =
            _deployAddressesRegistryMainnet(_troveManagerParamsArray[1]);
        vars.troveManagers[1] = ITroveManager(troveManagerAddress);

        // WSTETH
        vars.collaterals[2] = IERC20Metadata(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0);
        (vars.addressesRegistries[2], troveManagerAddress) =
            _deployAddressesRegistryMainnet(_troveManagerParamsArray[2]);
        vars.troveManagers[2] = ITroveManager(troveManagerAddress);

        // ETHX
        vars.collaterals[3] = IERC20Metadata(0xA35b1B31Ce002FBF2058D22F30f95D405200A15b);
        (vars.addressesRegistries[3], troveManagerAddress) =
            _deployAddressesRegistryMainnet(_troveManagerParamsArray[3]);
        vars.troveManagers[3] = ITroveManager(troveManagerAddress);

        // OSETH
        vars.collaterals[4] = IERC20Metadata(0xf1C9acDc66974dFB6dEcB12aA385b9cD01190E38);
        (vars.addressesRegistries[4], troveManagerAddress) =
            _deployAddressesRegistryMainnet(_troveManagerParamsArray[4]);
        vars.troveManagers[4] = ITroveManager(troveManagerAddress);

        // Deploy registry and register the TMs
        result.collateralRegistry = new CollateralRegistry(result.boldToken, vars.collaterals, vars.troveManagers);

        result.hintHelpers = new HintHelpers(result.collateralRegistry);
        result.multiTroveGetter = new MultiTroveGetter(result.collateralRegistry);

        // Deploy each set of core contracts
        for (vars.i = 0; vars.i < vars.numCollaterals; vars.i++) {
            (result.contractsArray[vars.i], result.zappersArray[vars.i]) = _deployAndConnectCollateralContractsMainnet(
                vars.collaterals[vars.i],
                vars.priceFeeds[vars.i],
                result.boldToken,
                result.collateralRegistry,
                WETH,
                vars.addressesRegistries[vars.i],
                address(vars.troveManagers[vars.i]),
                result.hintHelpers,
                result.multiTroveGetter
            );
        }

        result.boldToken.setCollateralRegistry(address(result.collateralRegistry));
    }

    function _deployAddressesRegistryMainnet(TroveManagerParams memory _troveManagerParams)
        internal
        returns (IAddressesRegistry, address)
    {
        IAddressesRegistry addressesRegistry = new AddressesRegistry(
            address(this),
            _troveManagerParams.CCR,
            _troveManagerParams.MCR,
            _troveManagerParams.SCR,
            _troveManagerParams.LIQUIDATION_PENALTY_SP,
            _troveManagerParams.LIQUIDATION_PENALTY_REDISTRIBUTION
        );
        address troveManagerAddress =
            getAddress(address(this), getBytecode(type(TroveManager).creationCode, address(addressesRegistry)), SALT);

        return (addressesRegistry, troveManagerAddress);
    }

    function _deployAndConnectCollateralContractsMainnet(
        IERC20Metadata _collToken,
        IPriceFeed _priceFeed,
        IBoldToken _boldToken,
        ICollateralRegistry _collateralRegistry,
        IWETH _weth,
        IAddressesRegistry _addressesRegistry,
        address _troveManagerAddress,
        IHintHelpers _hintHelpers,
        IMultiTroveGetter _multiTroveGetter
    ) internal returns (LiquityContracts memory contracts, Zappers memory zappers) {
        LiquityContractAddresses memory addresses;
        contracts.collToken = _collToken;
        contracts.priceFeed = _priceFeed;
        contracts.interestRouter = new MockInterestRouter();

        contracts.addressesRegistry = _addressesRegistry;

        // Deploy Metadata
        MetadataNFT metadataNFT = deployMetadata(SALT);
        addresses.metadataNFT = getAddress(
            address(this), getBytecode(type(MetadataNFT).creationCode, address(initializedFixedAssetReader)), SALT
        );
        assert(address(metadataNFT) == addresses.metadataNFT);

        // Pre-calc addresses
        addresses.borrowerOperations = getAddress(
            address(this),
            getBytecode(type(BorrowerOperationsTester).creationCode, address(contracts.addressesRegistry)),
            SALT
        );
        addresses.troveManager = _troveManagerAddress;
        addresses.troveNFT = getAddress(
            address(this), getBytecode(type(TroveNFT).creationCode, address(contracts.addressesRegistry)), SALT
        );
        addresses.stabilityPool = getAddress(
            address(this), getBytecode(type(StabilityPool).creationCode, address(contracts.addressesRegistry)), SALT
        );
        addresses.activePool = getAddress(
            address(this), getBytecode(type(ActivePool).creationCode, address(contracts.addressesRegistry)), SALT
        );
        addresses.defaultPool = getAddress(
            address(this), getBytecode(type(DefaultPool).creationCode, address(contracts.addressesRegistry)), SALT
        );
        addresses.gasPool = getAddress(
            address(this), getBytecode(type(GasPool).creationCode, address(contracts.addressesRegistry)), SALT
        );
        addresses.collSurplusPool = getAddress(
            address(this), getBytecode(type(CollSurplusPool).creationCode, address(contracts.addressesRegistry)), SALT
        );
        addresses.sortedTroves = getAddress(
            address(this), getBytecode(type(SortedTroves).creationCode, address(contracts.addressesRegistry)), SALT
        );

        // Deploy contracts
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
            WETH: _weth
        });
        contracts.addressesRegistry.setAddresses(addressVars);

        contracts.borrowerOperations = new BorrowerOperationsTester{salt: SALT}(contracts.addressesRegistry);
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

        // TODO: remove this and set address in constructor as per the CREATE2 approach above
        _priceFeed.setAddresses(addresses.borrowerOperations);

        // deploy zappers
        (zappers.gasCompZapper, zappers.wethZapper, zappers.leverageZapperCurve, zappers.leverageZapperUniV3) =
        _deployZappers(contracts.addressesRegistry, contracts.collToken, _boldToken, _weth, contracts.priceFeed, true);
    }

    function _deployZappers(
        IAddressesRegistry _addressesRegistry,
        IERC20 _collToken,
        IBoldToken _boldToken,
        IWETH _weth,
        IPriceFeed _priceFeed,
        bool mainnet
    )
        internal
        returns (
            GasCompZapper gasCompZapper,
            WETHZapper wethZapper,
            ILeverageZapper leverageZapperCurve,
            ILeverageZapper leverageZapperUniV3
        )
    {
        bool lst = _collToken != _weth;
        if (lst) {
            gasCompZapper = new GasCompZapper(_addressesRegistry);
        } else {
            wethZapper = new WETHZapper(_addressesRegistry);
        }

        if (mainnet) {
            (leverageZapperCurve, leverageZapperUniV3) =
                _deployLeverageZappers(_addressesRegistry, _collToken, _boldToken, _priceFeed, lst);
        }

        return (gasCompZapper, wethZapper, leverageZapperCurve, leverageZapperUniV3);
    }

    function _deployLeverageZappers(
        IAddressesRegistry _addressesRegistry,
        IERC20 _collToken,
        IBoldToken _boldToken,
        IPriceFeed _priceFeed,
        bool _lst
    ) internal returns (ILeverageZapper, ILeverageZapper) {
        IFlashLoanProvider flashLoanProvider = new BalancerFlashLoan();

        ILeverageZapper leverageZapperCurve =
            _deployCurveLeverageZapper(_addressesRegistry, _collToken, _boldToken, _priceFeed, flashLoanProvider, _lst);
        ILeverageZapper leverageZapperUniV3 =
            _deployUniV3LeverageZapper(_addressesRegistry, _collToken, _boldToken, _priceFeed, flashLoanProvider, _lst);

        return (leverageZapperCurve, leverageZapperUniV3);
    }

    function _deployCurveLeverageZapper(
        IAddressesRegistry _addressesRegistry,
        IERC20 _collToken,
        IBoldToken _boldToken,
        IPriceFeed _priceFeed,
        IFlashLoanProvider _flashLoanProvider,
        bool _lst
    ) internal returns (ILeverageZapper) {
        (uint256 price, ) = _priceFeed.fetchPrice();

        // deploy Curve Twocrypto NG pool
        address[2] memory coins;
        coins[0] = address(_boldToken);
        coins[1] = address(_collToken);
        ICurvePool curvePool = curveFactory.deploy_pool(
            "LST-Bold pool",
            "LBLD",
            coins,
            0, // implementation id
            400000, // A
            145000000000000, // gamma
            26000000, // mid_fee
            45000000, // out_fee
            230000000000000, // fee_gamma
            2000000000000, // allowed_extra_profit
            146000000000000, // adjustment_step
            600, // ma_exp_time
            price // initial_price
        );

        IExchange curveExchange = new CurveExchange(_collToken, _boldToken, curvePool, 1, 0);
        ILeverageZapper leverageZapperCurve;
        if (_lst) {
            leverageZapperCurve = new LeverageLSTZapper(_addressesRegistry, _flashLoanProvider, curveExchange);
        } else {
            leverageZapperCurve = new LeverageWETHZapper(_addressesRegistry, _flashLoanProvider, curveExchange);
        }

        return leverageZapperCurve;
    }

    struct UniV3Vars {
        IExchange uniV3Exchange;
        uint256 price;
        address[2] tokens;
    }

    function _deployUniV3LeverageZapper(
        IAddressesRegistry _addressesRegistry,
        IERC20 _collToken,
        IBoldToken _boldToken,
        IPriceFeed _priceFeed,
        IFlashLoanProvider _flashLoanProvider,
        bool _lst
    ) internal returns (ILeverageZapper) {
        UniV3Vars memory vars;
        vars.uniV3Exchange = new UniV3Exchange(_collToken, _boldToken, UNIV3_FEE, uniV3Router, uniV3Quoter);
        ILeverageZapper leverageZapperUniV3;
        if (_lst) {
            leverageZapperUniV3 = new LeverageLSTZapper(_addressesRegistry, _flashLoanProvider, vars.uniV3Exchange);
        } else {
            leverageZapperUniV3 = new LeverageWETHZapper(_addressesRegistry, _flashLoanProvider, vars.uniV3Exchange);
        }

        // Create Uni V3 pool
        (vars.price, ) = _priceFeed.fetchPrice();
        if (address(_boldToken) < address(_collToken)) {
            //console2.log("b < c");
            vars.tokens[0] = address(_boldToken);
            vars.tokens[1] = address(_collToken);
        } else {
            //console2.log("c < b");
            vars.tokens[0] = address(_collToken);
            vars.tokens[1] = address(_boldToken);
        }
        uniV3PositionManager.createAndInitializePoolIfNecessary(
            vars.tokens[0], // token0,
            vars.tokens[1], // token1,
            UNIV3_FEE, // fee,
            UniV3Exchange(address(vars.uniV3Exchange)).priceToSqrtPrice(_boldToken, _collToken, vars.price) // sqrtPriceX96
        );

        return leverageZapperUniV3;
    }
}
