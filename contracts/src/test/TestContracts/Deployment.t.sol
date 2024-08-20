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
import "../../CollateralRegistry.sol";
import "../../MockInterestRouter.sol";
import "./PriceFeedTestnet.sol";
import {WETHTester} from "./WETHTester.sol";
import {ERC20Faucet} from "./ERC20Faucet.sol";

import "../../PriceFeeds/WETHPriceFeed.sol";
import "../../PriceFeeds/WSTETHPriceFeed.sol";
import "../../PriceFeeds/RETHPriceFeed.sol";
import "../../PriceFeeds/OSETHPriceFeed.sol";
import "../../PriceFeeds/ETHXPriceFeed.sol";

import "forge-std/console2.sol";

// TODO: Split dev and mainnet
contract TestDeployer {
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
        IERC20 collToken;
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
        IERC20 collToken;
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
        IERC20[] collaterals;
        LiquityContractsDev contracts;
        bytes bytecode;
        address boldTokenAddress;
        uint256 i;
    }

    struct DeploymentParamsMainnet {
        ExternalAddresses externalAddresses;
        TroveManagerParams[] troveManagerParamsArray;
        OracleParams oracleParams;
    }

    struct DeploymentResultMainnet {
        LiquityContracts[] contractsArray;
        MockCollaterals mockCollaterals;
        ICollateralRegistry collateralRegistry;
        IBoldToken boldToken;
        HintHelpers hintHelpers;
        MultiTroveGetter multiTroveGetter;
    }

    struct DeploymentVarsMainnet {
        uint256 numCollaterals;
        IERC20[] collaterals;
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

    // TODO: replace this with the real LST contracts
    struct MockCollaterals {
        IWETH WETH;
        IERC20 RETH;
        IERC20 WSTETH;
        IERC20 ETHX;
        IERC20 OSETH;
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
            IWETH WETH // for gas compensation
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
        // Deploy Bold
        vars.bytecode = abi.encodePacked(type(BoldToken).creationCode, abi.encode(address(this)));
        vars.boldTokenAddress = getAddress(address(this), vars.bytecode, SALT);
        boldToken = new BoldToken{salt: SALT}(address(this));
        assert(address(boldToken) == vars.boldTokenAddress);

        contractsArray = new LiquityContractsDev[](vars.numCollaterals);
        vars.collaterals = new IERC20[](vars.numCollaterals);

        // Deploy the first branch with WETH collateral
        vars.collaterals[0] = _WETH;
        for (vars.i = 1; vars.i < vars.numCollaterals; vars.i++) {
            IERC20 collToken = new ERC20Faucet(
                string.concat("Staked ETH", string(abi.encode(vars.i))), // _name
                string.concat("stETH", string(abi.encode(vars.i))), // _symbol
                100 ether, //     _tapAmount
                1 days //         _tapPeriod
            );
            vars.collaterals[vars.i] = collToken;
        }

        collateralRegistry = new CollateralRegistry(boldToken, vars.collaterals);
        hintHelpers = new HintHelpers(collateralRegistry);
        multiTroveGetter = new MultiTroveGetter(collateralRegistry);

        vars.contracts = _deployAndConnectCollateralContractsDev(
            0, _WETH, boldToken, collateralRegistry, _WETH, hintHelpers, multiTroveGetter, troveManagerParamsArray[0]
        );
        contractsArray[0] = vars.contracts;

        // Deploy the remaining branches with LST collateral
        for (vars.i = 1; vars.i < vars.numCollaterals; vars.i++) {
            vars.contracts = _deployAndConnectCollateralContractsDev(
                vars.i,
                vars.collaterals[vars.i],
                boldToken,
                collateralRegistry,
                _WETH,
                hintHelpers,
                multiTroveGetter,
                troveManagerParamsArray[vars.i]
            );
            contractsArray[vars.i] = vars.contracts;
        }

        boldToken.setCollateralRegistry(address(collateralRegistry));
    }
    // Creates individual PriceFeed contracts based on oracle addresses.
    // Still uses mock collaterals rather than real mainnet WETH and LST addresses.

    function deployAndConnectContractsMainnet(DeploymentParamsMainnet memory _params)
        public
        returns (DeploymentResultMainnet memory result)
    {
        DeploymentVarsMainnet memory vars;
        vars.numCollaterals = 5;
        result.contractsArray = new LiquityContracts[](vars.numCollaterals);
        vars.priceFeeds = new IPriceFeed[](vars.numCollaterals);
        vars.collaterals = new IERC20[](vars.numCollaterals);

        vars.priceFeeds[0] = new WETHPriceFeed(
            address(this), _params.externalAddresses.ETHOracle, _params.oracleParams.ethUsdStalenessThreshold
        );

        // RETH
        vars.priceFeeds[1] = new RETHPriceFeed(
            address(this),
            _params.externalAddresses.ETHOracle,
            _params.externalAddresses.RETHOracle,
            _params.externalAddresses.RETHToken,
            _params.oracleParams.ethUsdStalenessThreshold,
            _params.oracleParams.rEthEthStalenessThreshold
        );

        vars.priceFeeds[2] = new WSTETHPriceFeed(
            address(this),
            _params.externalAddresses.STETHOracle,
            _params.oracleParams.stEthUsdStalenessThreshold,
            _params.externalAddresses.WSTETHToken
        );

        vars.priceFeeds[3] = new ETHXPriceFeed(
            address(this),
            _params.externalAddresses.ETHOracle,
            _params.externalAddresses.ETHXOracle,
            _params.externalAddresses.StaderOracle,
            _params.oracleParams.ethUsdStalenessThreshold,
            _params.oracleParams.ethXEthStalenessThreshold
        );

        vars.priceFeeds[4] = new OSETHPriceFeed(
            address(this),
            _params.externalAddresses.ETHOracle,
            _params.externalAddresses.OSETHOracle,
            _params.externalAddresses.OsTokenVaultController,
            _params.oracleParams.ethUsdStalenessThreshold,
            _params.oracleParams.osEthEthStalenessThreshold
        );

        // Deploy Bold
        vars.bytecode = abi.encodePacked(type(BoldToken).creationCode, abi.encode());
        vars.boldTokenAddress = getAddress(address(this), vars.bytecode, SALT);
        result.boldToken = new BoldToken{salt: SALT}(address(this));
        assert(address(result.boldToken) == vars.boldTokenAddress);

        // TODO: replace mock collaterals with connections to the real tokens for later mainnet testing
        result.mockCollaterals.WETH = new WETHTester(
            100 ether, //     _tapAmount
            1 days //         _tapPeriod
        );
        vars.collaterals[0] = result.mockCollaterals.WETH;

        result.mockCollaterals.RETH = new ERC20Faucet(
            "Mock rETH", // _name
            "mockRETH", // _symbol
            100 ether, //     _tapAmount
            1 days //         _tapPeriod
        );
        vars.collaterals[1] = result.mockCollaterals.RETH;

        result.mockCollaterals.WSTETH = new ERC20Faucet(
            "Mock wstETH", // _name
            "mockWSTETH", // _symbol
            100 ether, //     _tapAmount
            1 days //         _tapPeriod
        );
        vars.collaterals[2] = result.mockCollaterals.WSTETH;

        result.mockCollaterals.ETHX = new ERC20Faucet(
            "Mock ETHX", // _name
            "mockETHX", // _symbol
            100 ether, //     _tapAmount
            1 days //         _tapPeriod
        );
        vars.collaterals[3] = result.mockCollaterals.ETHX;

        result.mockCollaterals.OSETH = new ERC20Faucet(
            "Mock OSETH", // _name
            "mockOSETH", // _symbol
            100 ether, //     _tapAmount
            1 days //         _tapPeriod
        );
        vars.collaterals[4] = result.mockCollaterals.OSETH;

        // Deploy registry and register the TMs
        result.collateralRegistry = new CollateralRegistry(result.boldToken, vars.collaterals);

        result.hintHelpers = new HintHelpers(result.collateralRegistry);
        result.multiTroveGetter = new MultiTroveGetter(result.collateralRegistry);

        // Deploy each set of core contracts
        for (vars.i = 0; vars.i < vars.numCollaterals; vars.i++) {
            result.contractsArray[vars.i] = _deployAndConnectCollateralContractsMainnet(
                vars.i,
                vars.collaterals[vars.i],
                vars.priceFeeds[vars.i],
                result.boldToken,
                result.collateralRegistry,
                result.mockCollaterals.WETH,
                result.hintHelpers,
                result.multiTroveGetter,
                _params.troveManagerParamsArray[vars.i]
            );
        }

        result.boldToken.setCollateralRegistry(address(result.collateralRegistry));
    }

    function _deployAndConnectCollateralContractsDev(
        uint256 _branch,
        IERC20 _collToken,
        IBoldToken _boldToken,
        ICollateralRegistry _collateralRegistry,
        IWETH _weth,
        IHintHelpers _hintHelpers,
        IMultiTroveGetter _multiTroveGetter,
        TroveManagerParams memory _troveManagerParams
    ) internal returns (LiquityContractsDev memory contracts) {
        LiquityContractAddresses memory addresses;
        contracts.collToken = _collToken;

        // Deploy all contracts, using testers for TM and PriceFeed
        contracts.addressesRegistry = new AddressesRegistry(
            address(this),
            _troveManagerParams.CCR,
            _troveManagerParams.MCR,
            _troveManagerParams.SCR,
            _troveManagerParams.LIQUIDATION_PENALTY_SP,
            _troveManagerParams.LIQUIDATION_PENALTY_REDISTRIBUTION
        );
        contracts.priceFeed = new PriceFeedTestnet();
        contracts.interestRouter = new MockInterestRouter();
        addresses.borrowerOperations = getAddress(
            address(this),
            getBytecode(type(BorrowerOperationsTester).creationCode, address(contracts.addressesRegistry)),
            SALT
        );
        addresses.troveManager = getAddress(
            address(this),
            getBytecode(type(TroveManagerTester).creationCode, address(contracts.addressesRegistry)),
            SALT
        );
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

        IAddressesRegistry.AddressVars memory addressVars = IAddressesRegistry.AddressVars({
            collToken: _collToken,
            borrowerOperations: IBorrowerOperations(addresses.borrowerOperations),
            troveManager: ITroveManager(addresses.troveManager),
            troveNFT: ITroveNFT(addresses.troveNFT),
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

        _collateralRegistry.setTroveManager(_branch, contracts.troveManager);
    }

    function _deployAndConnectCollateralContractsMainnet(
        uint256 _branch,
        IERC20 _collToken,
        IPriceFeed _priceFeed,
        IBoldToken _boldToken,
        ICollateralRegistry _collateralRegistry,
        IWETH _weth,
        IHintHelpers _hintHelpers,
        IMultiTroveGetter _multiTroveGetter,
        TroveManagerParams memory _troveManagerParams
    ) internal returns (LiquityContracts memory contracts) {
        LiquityContractAddresses memory addresses;
        contracts.collToken = _collToken;
        contracts.priceFeed = _priceFeed;

        contracts.addressesRegistry = new AddressesRegistry(
            address(this),
            _troveManagerParams.CCR,
            _troveManagerParams.MCR,
            _troveManagerParams.SCR,
            _troveManagerParams.LIQUIDATION_PENALTY_SP,
            _troveManagerParams.LIQUIDATION_PENALTY_REDISTRIBUTION
        );

        addresses.borrowerOperations = getAddress(
            address(this),
            getBytecode(type(BorrowerOperationsTester).creationCode, address(contracts.addressesRegistry)),
            SALT
        );
        addresses.troveManager = getAddress(
            address(this),
            getBytecode(type(TroveManagerTester).creationCode, address(contracts.addressesRegistry)),
            SALT
        );
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

        IAddressesRegistry.AddressVars memory addressVars = IAddressesRegistry.AddressVars({
            collToken: _collToken,
            borrowerOperations: IBorrowerOperations(addresses.borrowerOperations),
            troveManager: ITroveManager(addresses.troveManager),
            troveNFT: ITroveNFT(addresses.troveNFT),
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

        _collateralRegistry.setTroveManager(_branch, contracts.troveManager);
    }
}
