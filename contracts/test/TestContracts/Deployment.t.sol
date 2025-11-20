// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "src/AddressesRegistry.sol";
import "src/ActivePool.sol";
import "./StableTokenV3.sol";
import "src/BorrowerOperations.sol";
import "src/CollSurplusPool.sol";
import "src/DefaultPool.sol";
import "src/GasPool.sol";
import "src/HintHelpers.sol";
import "src/MultiTroveGetter.sol";
import "src/SortedTroves.sol";
import "src/StabilityPool.sol";
import "./BorrowerOperationsTester.t.sol";
import "./TroveManagerTester.t.sol";
import "./CollateralRegistryTester.sol";
import "src/TroveNFT.sol";
import "src/NFTMetadata/MetadataNFT.sol";
import "src/CollateralRegistry.sol";
import "./MockInterestRouter.sol";
import "./MockFXPriceFeed.sol";
import "./MetadataDeployment.sol";
import "src/SystemParams.sol";

import {WETHTester} from "./WETHTester.sol";
import {ERC20Faucet} from "./ERC20Faucet.sol";

import "forge-std/console2.sol";

uint256 constant _24_HOURS = 86400;
uint256 constant _48_HOURS = 172800;

contract TestDeployer is MetadataDeployment {
    IERC20 constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

    bytes32 constant SALT = keccak256("LiquityV2");

    struct LiquityContractsDevPools {
        IDefaultPool defaultPool;
        ICollSurplusPool collSurplusPool;
        GasPool gasPool;
    }

    struct LiquityContractsDev {
        IAddressesRegistry addressesRegistry;
        IBorrowerOperationsTester borrowerOperations; // Tester
        ISortedTroves sortedTroves;
        IActivePool activePool;
        IStabilityPool stabilityPool;
        ITroveManagerTester troveManager; // Tester
        ITroveNFT troveNFT;
        IMockFXPriceFeed priceFeed; // Tester
        IInterestRouter interestRouter;
        IERC20Metadata collToken;
        LiquityContractsDevPools pools;
        ISystemParams systemParams;
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
        ISystemParams systemParams;
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
        uint256 BCR;
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

    struct ExternalAddresses {
        address ETHOracle;
        address STETHOracle;
        address RETHOracle;
        address WSTETHToken;
        address RETHToken;
    }

    struct OracleParams {
        uint256 ethUsdStalenessThreshold;
        uint256 stEthUsdStalenessThreshold;
        uint256 rEthEthStalenessThreshold;
    }

    // See: https://solidity-by-example.org/app/create2/
    function getBytecode(bytes memory _creationCode, address _addressesRegistry) public pure returns (bytes memory) {
        return abi.encodePacked(_creationCode, abi.encode(_addressesRegistry));
    }

    function getBytecode(bytes memory _creationCode, address _addressesRegistry, address _systemParams)
        public
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(_creationCode, abi.encode(_addressesRegistry, _systemParams));
    }

    function getBytecode(bytes memory _creationCode, bool _disable) public pure returns (bytes memory) {
        return abi.encodePacked(_creationCode, abi.encode(_disable));
    }

    function getBytecode(bytes memory _creationCode, bool _disable, address _systemParams)
        public
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(_creationCode, abi.encode(_disable, _systemParams));
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
            IWETH WETH // for gas compensation
        )
    {
        return deployAndConnectContracts(TroveManagerParams(150e16, 110e16, 10e16, 110e16, 5e16, 10e16));
    }

    function deployAndConnectContracts(TroveManagerParams memory troveManagerParams)
        public
        returns (
            LiquityContractsDev memory contracts,
            ICollateralRegistry collateralRegistry,
            IBoldToken boldToken,
            HintHelpers hintHelpers,
            MultiTroveGetter multiTroveGetter,
            IWETH WETH // for gas compensation
        )
    {
        LiquityContractsDev[] memory contractsArray;
        TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](1);

        troveManagerParamsArray[0] = troveManagerParams;

        (contractsArray, collateralRegistry, boldToken, hintHelpers, multiTroveGetter, WETH) =
            deployAndConnectContractsMultiColl(troveManagerParamsArray);
        contracts = contractsArray[0];
    }

    function deployAndConnectContractsMultiColl(TroveManagerParams[] memory troveManagerParamsArray)
        public
        returns (
            LiquityContractsDev[] memory contractsArray,
            ICollateralRegistry collateralRegistry,
            IBoldToken boldToken,
            HintHelpers hintHelpers,
            MultiTroveGetter multiTroveGetter,
            IWETH WETH // for gas compensation
        )
    {
        // used for gas compensation and as collateral of the first branch
        WETH = new WETHTester(
            100 ether, //     _tapAmount
            1 days //         _tapPeriod
        );
        (contractsArray, collateralRegistry, boldToken, hintHelpers, multiTroveGetter) =
            deployAndConnectContracts(troveManagerParamsArray, WETH);
    }

    function _nameToken(uint256 _index) internal pure returns (string memory) {
        if (_index == 1) return "Wrapped Staked Ether";
        if (_index == 2) return "Rocket Pool ETH";
        return "LST Tester";
    }

    function _symboltoken(uint256 _index) internal pure returns (string memory) {
        if (_index == 1) return "wstETH";
        if (_index == 2) return "rETH";
        return "LST";
    }

    function deployAndConnectContracts(TroveManagerParams[] memory troveManagerParamsArray, IWETH _WETH)
        public
        returns (
            LiquityContractsDev[] memory contractsArray,
            ICollateralRegistry collateralRegistry,
            IBoldToken boldToken,
            HintHelpers hintHelpers,
            MultiTroveGetter multiTroveGetter
        )
    {
        DeploymentVarsDev memory vars;
        vars.numCollaterals = troveManagerParamsArray.length;

        // Deploy Bold (StableTokenV3)
        vars.bytecode = abi.encodePacked(type(StableTokenV3).creationCode, abi.encode(false));
        vars.boldTokenAddress = getAddress(address(this), vars.bytecode, SALT);
        StableTokenV3 stableTokenV3 = new StableTokenV3{salt: SALT}(false);
        boldToken = IBoldToken(address(stableTokenV3));
        assert(address(boldToken) == vars.boldTokenAddress);

        contractsArray = new LiquityContractsDev[](vars.numCollaterals);
        vars.collaterals = new IERC20Metadata[](vars.numCollaterals);
        vars.addressesRegistries = new IAddressesRegistry[](vars.numCollaterals);
        vars.troveManagers = new ITroveManager[](vars.numCollaterals);

        ISystemParams[] memory systemParamsArray = new ISystemParams[](vars.numCollaterals);

        for (vars.i = 0; vars.i < vars.numCollaterals; vars.i++) {
            systemParamsArray[vars.i] = deploySystemParamsDev(troveManagerParamsArray[vars.i], vars.i);
        }

        // Deploy the first branch with WETH collateral
        vars.collaterals[0] = _WETH;
        (IAddressesRegistry addressesRegistry, address troveManagerAddress) =
            _deployAddressesRegistryDev(systemParamsArray[0]);
        vars.addressesRegistries[0] = addressesRegistry;
        vars.troveManagers[0] = ITroveManager(troveManagerAddress);
        for (vars.i = 1; vars.i < vars.numCollaterals; vars.i++) {
            IERC20Metadata collToken = new ERC20Faucet(
                _nameToken(vars.i), // _name
                _symboltoken(vars.i), // _symbol
                100 ether, //     _tapAmount
                1 days //         _tapPeriod
            );
            vars.collaterals[vars.i] = collToken;
            // Addresses registry and TM address
            (addressesRegistry, troveManagerAddress) = _deployAddressesRegistryDev(systemParamsArray[vars.i]);
            vars.addressesRegistries[vars.i] = addressesRegistry;
            vars.troveManagers[vars.i] = ITroveManager(troveManagerAddress);
        }

        collateralRegistry =
            new CollateralRegistry(boldToken, vars.collaterals, vars.troveManagers, systemParamsArray[0]);
        hintHelpers = new HintHelpers(collateralRegistry, systemParamsArray[0]);
        multiTroveGetter = new MultiTroveGetter(collateralRegistry);

        contractsArray[0] = _deployAndConnectCollateralContractsDev(
            _WETH,
            boldToken,
            collateralRegistry,
            _WETH,
            vars.addressesRegistries[0],
            address(vars.troveManagers[0]),
            hintHelpers,
            multiTroveGetter,
            systemParamsArray[0]
        );

        // Deploy the remaining branches with LST collateral
        for (vars.i = 1; vars.i < vars.numCollaterals; vars.i++) {
            contractsArray[vars.i] = _deployAndConnectCollateralContractsDev(
                vars.collaterals[vars.i],
                boldToken,
                collateralRegistry,
                _WETH,
                vars.addressesRegistries[vars.i],
                address(vars.troveManagers[vars.i]),
                hintHelpers,
                multiTroveGetter,
                systemParamsArray[vars.i]
            );
        }

        // Initialize StableTokenV3 with all minters, burners, and operators
        // This should handle both cases with multiple collaterals and single collateral
        address[] memory minters = new address[](vars.numCollaterals * 2);
        address[] memory burners = new address[](vars.numCollaterals * 3 + 1);
        address[] memory operators = new address[](vars.numCollaterals);

        for (vars.i = 0; vars.i < vars.numCollaterals; vars.i++) {
            minters[vars.i * 2] = address(contractsArray[vars.i].borrowerOperations);
            minters[vars.i * 2 + 1] = address(contractsArray[vars.i].activePool);

            burners[vars.i * 3] = address(contractsArray[vars.i].troveManager);
            burners[vars.i * 3 + 1] = address(contractsArray[vars.i].borrowerOperations);
            burners[vars.i * 3 + 2] = address(contractsArray[vars.i].stabilityPool);

            operators[vars.i] = address(contractsArray[vars.i].stabilityPool);
        }
        burners[vars.numCollaterals * 3] = address(collateralRegistry);

        stableTokenV3.initialize("Bold Token", "BOLD", address(this), new address[](0), new uint256[](0), minters, burners, operators);
    }

    function _deployAddressesRegistryDev(ISystemParams _systemParams) internal returns (IAddressesRegistry, address) {
        IAddressesRegistry addressesRegistry = new AddressesRegistry(address(this));
        address troveManagerAddress = getAddress(
            address(this),
            getBytecode(type(TroveManagerTester).creationCode, address(addressesRegistry), address(_systemParams)),
            SALT
        );

        return (addressesRegistry, troveManagerAddress);
    }

    function deploySystemParamsDev(TroveManagerParams memory params, uint256 index) public returns (ISystemParams) {
        bytes32 uniqueSalt = keccak256(abi.encodePacked(SALT, index));

        // Create parameter structs based on constants
        ISystemParams.DebtParams memory debtParams = ISystemParams.DebtParams({
            minDebt: 2000e18 // MIN_DEBT
        });

        ISystemParams.LiquidationParams memory liquidationParams = ISystemParams.LiquidationParams({
            liquidationPenaltySP: params.LIQUIDATION_PENALTY_SP,
            liquidationPenaltyRedistribution: params.LIQUIDATION_PENALTY_REDISTRIBUTION
        });

        ISystemParams.GasCompParams memory gasCompParams = ISystemParams.GasCompParams({
            collGasCompensationDivisor: 200, // COLL_GAS_COMPENSATION_DIVISOR
            collGasCompensationCap: 2 ether, // COLL_GAS_COMPENSATION_CAP
            ethGasCompensation: 0.0375 ether // ETH_GAS_COMPENSATION
        });

        ISystemParams.CollateralParams memory collateralParams =
            ISystemParams.CollateralParams({ccr: params.CCR, scr: params.SCR, mcr: params.MCR, bcr: params.BCR});

        ISystemParams.InterestParams memory interestParams = ISystemParams.InterestParams({
            minAnnualInterestRate: DECIMAL_PRECISION / 200 // MIN_ANNUAL_INTEREST_RATE (0.5%)
        });

        ISystemParams.RedemptionParams memory redemptionParams = ISystemParams.RedemptionParams({
            redemptionFeeFloor: DECIMAL_PRECISION / 200, // REDEMPTION_FEE_FLOOR (0.5%)
            initialBaseRate: DECIMAL_PRECISION, // INITIAL_BASE_RATE (100%)
            redemptionMinuteDecayFactor: 998076443575628800, // REDEMPTION_MINUTE_DECAY_FACTOR
            redemptionBeta: 1 // REDEMPTION_BETA
        });

        ISystemParams.StabilityPoolParams memory poolParams = ISystemParams.StabilityPoolParams({
            spYieldSplit: 75 * (DECIMAL_PRECISION / 100), // SP_YIELD_SPLIT (75%)
            minBoldInSP: 1e18, // MIN_BOLD_IN_SP
            minBoldAfterRebalance: 1_000e18 // MIN_BOLD_AFTER_REBALANCE
        });

        SystemParams systemParams = new SystemParams{salt: uniqueSalt}(
            false,
            debtParams,
            liquidationParams,
            gasCompParams,
            collateralParams,
            interestParams,
            redemptionParams,
            poolParams
        );

        systemParams.initialize();

        return ISystemParams(systemParams);
    }

    function _deployAndConnectCollateralContractsDev(
        IERC20Metadata _collToken,
        IBoldToken _boldToken,
        ICollateralRegistry _collateralRegistry,
        IERC20Metadata _gasToken,
        IAddressesRegistry _addressesRegistry,
        address _troveManagerAddress,
        IHintHelpers _hintHelpers,
        IMultiTroveGetter _multiTroveGetter,
        ISystemParams _systemParams
    ) internal returns (LiquityContractsDev memory contracts) {
        LiquityContractAddresses memory addresses;
        contracts.collToken = _collToken;
        contracts.systemParams = _systemParams;

        // Deploy all contracts, using testers for TM and PriceFeed
        contracts.addressesRegistry = _addressesRegistry;
        contracts.priceFeed = new MockFXPriceFeed();
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
            getBytecode(
                type(BorrowerOperationsTester).creationCode,
                address(contracts.addressesRegistry),
                address(_systemParams)
            ),
            SALT
        );
        addresses.troveManager = _troveManagerAddress;
        addresses.troveNFT = getAddress(
            address(this), getBytecode(type(TroveNFT).creationCode, address(contracts.addressesRegistry)), SALT
        );
        bytes32 stabilityPoolSalt = keccak256(abi.encodePacked(address(contracts.addressesRegistry)));
        addresses.stabilityPool = getAddress(
            address(this),
            getBytecode(type(StabilityPool).creationCode, bool(false), address(_systemParams)),
            stabilityPoolSalt
        );
        addresses.activePool = getAddress(
            address(this),
            getBytecode(type(ActivePool).creationCode, address(contracts.addressesRegistry), address(_systemParams)),
            SALT
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
            collToken: _collToken,
            gasToken: _gasToken,
            // TODO: add liquidity strategy
            liquidityStrategy: makeAddr("liquidityStrategy")
        });
        contracts.addressesRegistry.setAddresses(addressVars);

        contracts.borrowerOperations =
            new BorrowerOperationsTester{salt: SALT}(contracts.addressesRegistry, _systemParams);
        contracts.troveManager = new TroveManagerTester{salt: SALT}(contracts.addressesRegistry, _systemParams);
        contracts.troveNFT = new TroveNFT{salt: SALT}(contracts.addressesRegistry);
        contracts.stabilityPool = new StabilityPool{salt: stabilityPoolSalt}(false, _systemParams);
        contracts.activePool = new ActivePool{salt: SALT}(contracts.addressesRegistry, _systemParams);
        contracts.pools.defaultPool = new DefaultPool{salt: SALT}(contracts.addressesRegistry);
        contracts.pools.gasPool = new GasPool{salt: SALT}(contracts.addressesRegistry);
        contracts.pools.collSurplusPool = new CollSurplusPool{salt: SALT}(contracts.addressesRegistry);
        contracts.sortedTroves = new SortedTroves{salt: SALT}(contracts.addressesRegistry);

        assert(address(contracts.borrowerOperations) == addresses.borrowerOperations);
        assert(address(contracts.troveManager) == addresses.troveManager);
        assert(address(contracts.troveNFT) == addresses.troveNFT);
        assert(address(contracts.stabilityPool) == addresses.stabilityPool);
        assert(address(contracts.activePool) == addresses.activePool);
        assert(address(contracts.pools.defaultPool) == addresses.defaultPool);
        assert(address(contracts.pools.gasPool) == addresses.gasPool);
        assert(address(contracts.pools.collSurplusPool) == addresses.collSurplusPool);
        assert(address(contracts.sortedTroves) == addresses.sortedTroves);

        contracts.stabilityPool.initialize(contracts.addressesRegistry);

        // Note: StableTokenV3 initialization is done after all branches are deployed
        // in the deployAndConnectContracts function
    }
}
