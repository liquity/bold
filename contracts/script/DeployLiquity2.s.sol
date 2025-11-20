// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {StdCheats} from "forge-std/StdCheats.sol";
import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {IERC20 as IERC20_GOV} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ProxyAdmin} from "openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from
    "openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {IFPMMFactory} from "src/Interfaces/IFPMMFactory.sol";
import {SystemParams} from "src/SystemParams.sol";
import {ISystemParams} from "src/Interfaces/ISystemParams.sol";
import {
    INTEREST_RATE_ADJ_COOLDOWN,
    MAX_ANNUAL_INTEREST_RATE,
    UPFRONT_INTEREST_PERIOD
} from "src/Dependencies/Constants.sol";

import {IBorrowerOperations} from "src/Interfaces/IBorrowerOperations.sol";
import {StringFormatting} from "test/Utils/StringFormatting.sol";
import {Accounts} from "test/TestContracts/Accounts.sol";
import {ERC20Faucet} from "test/TestContracts/ERC20Faucet.sol";
import {WETHTester} from "test/TestContracts/WETHTester.sol";
import "src/AddressesRegistry.sol";
import "src/ActivePool.sol";
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

import "src/CollateralRegistry.sol";
import "test/TestContracts/StableTokenV3.sol";
import "test/TestContracts/MockFXPriceFeed.sol";
import "test/TestContracts/MetadataDeployment.sol";
import "test/Utils/Logging.sol";
import "test/Utils/StringEquality.sol";
import "forge-std/console2.sol";

contract DeployLiquity2Script is StdCheats, MetadataDeployment, Logging {
    using Strings for *;
    using StringFormatting for *;
    using StringEquality for string;

    bytes32 SALT;
    address deployer;

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
        LiquityContracts contracts;
        ICollateralRegistry collateralRegistry;
        HintHelpers hintHelpers;
        MultiTroveGetter multiTroveGetter;
        ProxyAdmin proxyAdmin;
        IStableTokenV3 stableToken;
        ISystemParams systemParams;
        address stabilityPoolImpl;
        address stableTokenV3Impl;
        address systemParamsImpl;
        address fpmm;
    }

    struct DeploymentConfig {
        address USDm_ALFAJORES_ADDRESS;
        address proxyAdmin;
        address fpmmFactory;
        address fpmmImplementation;
        address liquidityStrategy;
        address oracleAdapter;
        address referenceRateFeedID;
        string stableTokenName;
        string stableTokenSymbol;
        address watchdog;
    }

    DeploymentConfig internal CONFIG = DeploymentConfig({
        USDm_ALFAJORES_ADDRESS: 0x9E2d4412d0f434cC85500b79447d9323a7416f09,
        proxyAdmin: 0xe4DdacCAdb64114215FCe8251B57B2AEB5C2C0E2,
        fpmmFactory: 0xd8098494a749a3fDAD2D2e7Fa5272D8f274D8FF6,
        fpmmImplementation: 0x0292efcB331C6603eaa29D570d12eB336D6c01d6,
        liquidityStrategy: address(123), // TODO: set liquidity strategy
        oracleAdapter: address(234), // TODO: set oracle adapter address
        referenceRateFeedID: 0x206B25Ea01E188Ee243131aFdE526bA6E131a016,
        stableTokenName: "EUR.v2 Test",
        stableTokenSymbol: "EUR.v2",
        watchdog: address(345) // TODO: set watchdog address
    });

    function run() external {
        string memory saltStr = vm.envOr("SALT", block.timestamp.toString());
        SALT = keccak256(bytes(saltStr));

        uint256 privateKey = vm.envUint("DEPLOYER");
        deployer = vm.addr(privateKey);
        vm.startBroadcast(privateKey);

        _log("Deployer:               ", deployer.toHexString());
        _log("Deployer balance:       ", deployer.balance.decimal());
        _log("CREATE2 salt:           ", 'keccak256(bytes("', saltStr, '")) = ', uint256(SALT).toHexString());
        _log("Chain ID:               ", block.chainid.toString());

        DeploymentResult memory deployed = _deployAndConnectContracts();

        vm.stopBroadcast();

        vm.writeFile("script/deployment-manifest.json", _getManifestJson(deployed));
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

    function _deployAndConnectContracts() internal returns (DeploymentResult memory r) {
        _deployProxyInfrastructure(r);
        _deployStableToken(r);
        // _deployFPMM(r);
        _deploySystemParams(r);

        IAddressesRegistry addressesRegistry = new AddressesRegistry(deployer);

        address troveManagerAddress =
            _computeCreate2Address(type(TroveManager).creationCode, address(addressesRegistry), address(r.systemParams));

        IERC20Metadata collToken = IERC20Metadata(CONFIG.USDm_ALFAJORES_ADDRESS);

        IERC20Metadata[] memory collaterals = new IERC20Metadata[](1);
        collaterals[0] = collToken;

        ITroveManager[] memory troveManagers = new ITroveManager[](1);
        troveManagers[0] = ITroveManager(troveManagerAddress);

        r.collateralRegistry =
            new CollateralRegistry(IBoldToken(address(r.stableToken)), collaterals, troveManagers, r.systemParams);
        r.hintHelpers = new HintHelpers(r.collateralRegistry, r.systemParams);
        r.multiTroveGetter = new MultiTroveGetter(r.collateralRegistry);

        // TODO: replace with real price feed
        IPriceFeed priceFeed = new MockFXPriceFeed();

        r.contracts =
            _deployAndConnectCollateralContracts(collToken, priceFeed, addressesRegistry, troveManagerAddress, r);
    }

    function _deployProxyInfrastructure(DeploymentResult memory r) internal {
        r.proxyAdmin = ProxyAdmin(CONFIG.proxyAdmin);
        r.stableTokenV3Impl = address(new StableTokenV3{salt: SALT}(true));
        r.stabilityPoolImpl = address(new StabilityPool{salt: SALT}(true, r.systemParams));

        _deploySystemParamsImpl(r);

        assert(
            address(r.stableTokenV3Impl)
                == vm.computeCreate2Address(
                    SALT, keccak256(bytes.concat(type(StableTokenV3).creationCode, abi.encode(true)))
                )
        );
        assert(
            address(r.stabilityPoolImpl)
                == vm.computeCreate2Address(
                    SALT, keccak256(bytes.concat(type(StabilityPool).creationCode, abi.encode(true, r.systemParams)))
                )
        );
    }

    function _deployStableToken(DeploymentResult memory r) internal {
        r.stableToken = IStableTokenV3(
            address(new TransparentUpgradeableProxy(address(r.stableTokenV3Impl), address(r.proxyAdmin), ""))
        );
    }

    function _deployFPMM(DeploymentResult memory r) internal {
        r.fpmm = IFPMMFactory(CONFIG.fpmmFactory).deployFPMM(
            CONFIG.fpmmImplementation, address(r.stableToken), CONFIG.USDm_ALFAJORES_ADDRESS, CONFIG.referenceRateFeedID
        );
    }

    function _deploySystemParamsImpl(DeploymentResult memory r) internal {
        ISystemParams.DebtParams memory debtParams = ISystemParams.DebtParams({minDebt: 2000e18});

        ISystemParams.LiquidationParams memory liquidationParams =
            ISystemParams.LiquidationParams({liquidationPenaltySP: 5e16, liquidationPenaltyRedistribution: 10e16});

        ISystemParams.GasCompParams memory gasCompParams = ISystemParams.GasCompParams({
            collGasCompensationDivisor: 200,
            collGasCompensationCap: 2 ether,
            ethGasCompensation: 0.0375 ether
        });

        ISystemParams.CollateralParams memory collateralParams =
            ISystemParams.CollateralParams({ccr: 150 * 1e16, scr: 110 * 1e16, mcr: 110 * 1e16, bcr: 10 * 1e16});

        ISystemParams.InterestParams memory interestParams =
            ISystemParams.InterestParams({minAnnualInterestRate: 1e18 / 200});

        ISystemParams.RedemptionParams memory redemptionParams = ISystemParams.RedemptionParams({
            redemptionFeeFloor: 1e18 / 200,
            initialBaseRate: 1e18,
            redemptionMinuteDecayFactor: 998076443575628800,
            redemptionBeta: 1
        });

        ISystemParams.StabilityPoolParams memory poolParams = ISystemParams.StabilityPoolParams({
            spYieldSplit: 75 * (1e18 / 100),
            minBoldInSP: 1e18,
            minBoldAfterRebalance: 1_000e18
        });

        r.systemParamsImpl = address(
            new SystemParams{salt: SALT}(
                true, // disableInitializers for implementation
                debtParams,
                liquidationParams,
                gasCompParams,
                collateralParams,
                interestParams,
                redemptionParams,
                poolParams
            )
        );
    }

    function _deploySystemParams(DeploymentResult memory r) internal {
        address systemParamsProxy =
            address(new TransparentUpgradeableProxy(address(r.systemParamsImpl), address(r.proxyAdmin), ""));

        r.systemParams = ISystemParams(systemParamsProxy);
        r.systemParams.initialize();
    }

    function _deployAndConnectCollateralContracts(
        IERC20Metadata _collToken,
        IPriceFeed _priceFeed,
        IAddressesRegistry _addressesRegistry,
        address _troveManagerAddress,
        DeploymentResult memory r
    ) internal returns (LiquityContracts memory contracts) {
        LiquityContractAddresses memory addresses;
        contracts.collToken = _collToken;
        contracts.addressesRegistry = _addressesRegistry;
        contracts.priceFeed = _priceFeed;
        contracts.systemParams = r.systemParams;
        // TODO: replace with governance timelock on mainnet
        contracts.interestRouter = IInterestRouter(0x56fD3F2bEE130e9867942D0F463a16fBE49B8d81);

        addresses.troveManager = _troveManagerAddress;

        contracts.metadataNFT = deployMetadata(SALT);
        addresses.metadataNFT = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(MetadataNFT).creationCode, address(initializedFixedAssetReader)))
        );
        assert(address(contracts.metadataNFT) == addresses.metadataNFT);

        addresses.borrowerOperations = _computeCreate2Address(
            type(BorrowerOperations).creationCode, address(contracts.addressesRegistry), address(contracts.systemParams)
        );
        addresses.troveNFT = _computeCreate2Address(type(TroveNFT).creationCode, address(contracts.addressesRegistry));
        addresses.activePool = _computeCreate2Address(
            type(ActivePool).creationCode, address(contracts.addressesRegistry), address(contracts.systemParams)
        );
        addresses.defaultPool =
            _computeCreate2Address(type(DefaultPool).creationCode, address(contracts.addressesRegistry));
        addresses.gasPool = _computeCreate2Address(type(GasPool).creationCode, address(contracts.addressesRegistry));
        addresses.collSurplusPool =
            _computeCreate2Address(type(CollSurplusPool).creationCode, address(contracts.addressesRegistry));
        addresses.sortedTroves =
            _computeCreate2Address(type(SortedTroves).creationCode, address(contracts.addressesRegistry));

        // Deploy StabilityPool proxy
        address stabilityPool =
            address(new TransparentUpgradeableProxy(address(r.stabilityPoolImpl), address(r.proxyAdmin), ""));

        contracts.stabilityPool = IStabilityPool(stabilityPool);
        // Set up addresses in registry
        _setupAddressesRegistry(contracts, addresses, r);

        // Deploy core protocol contracts
        _deployProtocolContracts(contracts, addresses);

        IStabilityPool(stabilityPool).initialize(contracts.addressesRegistry);

        address[] memory minters = new address[](2);
        minters[0] = address(contracts.borrowerOperations);
        minters[1] = address(contracts.activePool);

        address[] memory burners = new address[](4);
        burners[0] = address(contracts.troveManager);
        burners[1] = address(r.collateralRegistry);
        burners[2] = address(contracts.borrowerOperations);
        burners[3] = address(contracts.stabilityPool);

        address[] memory operators = new address[](1);
        operators[0] = address(contracts.stabilityPool);

        r.stableToken.initialize(
            CONFIG.stableTokenName,
            CONFIG.stableTokenSymbol,
            deployer,
            new address[](0),
            new uint256[](0),
            minters,
            burners,
            operators
        );
    }

    function _setupAddressesRegistry(
        LiquityContracts memory contracts,
        LiquityContractAddresses memory addresses,
        DeploymentResult memory r
    ) internal {
        IAddressesRegistry.AddressVars memory addressVars = IAddressesRegistry.AddressVars({
            collToken: contracts.collToken,
            borrowerOperations: IBorrowerOperations(addresses.borrowerOperations),
            troveManager: ITroveManager(addresses.troveManager),
            troveNFT: ITroveNFT(addresses.troveNFT),
            metadataNFT: IMetadataNFT(addresses.metadataNFT),
            stabilityPool: contracts.stabilityPool,
            priceFeed: contracts.priceFeed,
            activePool: IActivePool(addresses.activePool),
            defaultPool: IDefaultPool(addresses.defaultPool),
            gasPoolAddress: addresses.gasPool,
            collSurplusPool: ICollSurplusPool(addresses.collSurplusPool),
            sortedTroves: ISortedTroves(addresses.sortedTroves),
            interestRouter: contracts.interestRouter,
            hintHelpers: r.hintHelpers,
            multiTroveGetter: r.multiTroveGetter,
            collateralRegistry: r.collateralRegistry,
            boldToken: IBoldToken(address(r.stableToken)),
            gasToken: IERC20Metadata(CONFIG.USDm_ALFAJORES_ADDRESS),
            liquidityStrategy: CONFIG.liquidityStrategy
        });
        contracts.addressesRegistry.setAddresses(addressVars);
    }

    function _deployProtocolContracts(LiquityContracts memory contracts, LiquityContractAddresses memory addresses)
        internal
    {
        contracts.borrowerOperations =
            new BorrowerOperations{salt: SALT}(contracts.addressesRegistry, contracts.systemParams);
        contracts.troveManager = new TroveManager{salt: SALT}(contracts.addressesRegistry, contracts.systemParams);
        contracts.troveNFT = new TroveNFT{salt: SALT}(contracts.addressesRegistry);
        contracts.activePool = new ActivePool{salt: SALT}(contracts.addressesRegistry, contracts.systemParams);
        contracts.defaultPool = new DefaultPool{salt: SALT}(contracts.addressesRegistry);
        contracts.gasPool = new GasPool{salt: SALT}(contracts.addressesRegistry);
        contracts.collSurplusPool = new CollSurplusPool{salt: SALT}(contracts.addressesRegistry);
        contracts.sortedTroves = new SortedTroves{salt: SALT}(contracts.addressesRegistry);

        assert(address(contracts.borrowerOperations) == addresses.borrowerOperations);
        assert(address(contracts.troveManager) == addresses.troveManager);
        assert(address(contracts.troveNFT) == addresses.troveNFT);
        assert(address(contracts.activePool) == addresses.activePool);
        assert(address(contracts.defaultPool) == addresses.defaultPool);
        assert(address(contracts.gasPool) == addresses.gasPool);
        assert(address(contracts.collSurplusPool) == addresses.collSurplusPool);
        assert(address(contracts.sortedTroves) == addresses.sortedTroves);
    }

    function _computeCreate2Address(bytes memory creationCode, address _addressesRegistry)
        internal
        view
        returns (address)
    {
        return vm.computeCreate2Address(SALT, keccak256(getBytecode(creationCode, _addressesRegistry)));
    }

    function _computeCreate2Address(bytes memory creationCode, address _addressesRegistry, address _systemParams)
        internal
        view
        returns (address)
    {
        return vm.computeCreate2Address(SALT, keccak256(getBytecode(creationCode, _addressesRegistry, _systemParams)));
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
                    string.concat('"sortedTroves":"', address(c.sortedTroves).toHexString(), '",'),
                    string.concat('"systemParams":"', address(c.systemParams).toHexString(), '",')
                ),
                string.concat(
                    string.concat('"stabilityPool":"', address(c.stabilityPool).toHexString(), '",'),
                    string.concat('"troveManager":"', address(c.troveManager).toHexString(), '",'),
                    string.concat('"troveNFT":"', address(c.troveNFT).toHexString(), '",'),
                    string.concat('"metadataNFT":"', address(c.metadataNFT).toHexString(), '",'),
                    string.concat('"priceFeed":"', address(c.priceFeed).toHexString(), '",'),
                    string.concat('"gasPool":"', address(c.gasPool).toHexString(), '",'),
                    string.concat('"interestRouter":"', address(c.interestRouter).toHexString(), '",')
                )
            ),
            "}"
        );
    }

    function _getDeploymentConstants(ISystemParams params) internal view returns (string memory) {
        return string.concat(
            "{",
            string.concat(
                string.concat('"ETH_GAS_COMPENSATION":"', params.ETH_GAS_COMPENSATION().toString(), '",'),
                string.concat('"INTEREST_RATE_ADJ_COOLDOWN":"', INTEREST_RATE_ADJ_COOLDOWN.toString(), '",'),
                string.concat('"MAX_ANNUAL_INTEREST_RATE":"', MAX_ANNUAL_INTEREST_RATE.toString(), '",'),
                string.concat('"MIN_ANNUAL_INTEREST_RATE":"', params.MIN_ANNUAL_INTEREST_RATE().toString(), '",'),
                string.concat('"MIN_DEBT":"', params.MIN_DEBT().toString(), '",'),
                string.concat('"SP_YIELD_SPLIT":"', params.SP_YIELD_SPLIT().toString(), '",'),
                string.concat('"UPFRONT_INTEREST_PERIOD":"', UPFRONT_INTEREST_PERIOD.toString(), '"') // no comma
            ),
            "}"
        );
    }

    function _getManifestJson(DeploymentResult memory deployed) internal view returns (string memory) {
        string[] memory branches = new string[](1);

        branches[0] = _getBranchContractsJson(deployed.contracts);

        string memory part1 = string.concat(
            "{",
            string.concat('"constants":', _getDeploymentConstants(deployed.contracts.systemParams), ","),
            string.concat('"collateralRegistry":"', address(deployed.collateralRegistry).toHexString(), '",'),
            string.concat('"boldToken":"', address(deployed.stableToken).toHexString(), '",'),
            string.concat('"hintHelpers":"', address(deployed.hintHelpers).toHexString(), '",')
        );

        string memory part2 = string.concat(
            string.concat('"stableTokenV3Impl":"', address(deployed.stableTokenV3Impl).toHexString(), '",'),
            string.concat('"stabilityPoolImpl":"', address(deployed.stabilityPoolImpl).toHexString(), '",'),
            string.concat('"systemParamsImpl":"', address(deployed.systemParamsImpl).toHexString(), '",'),
            string.concat('"systemParams":"', address(deployed.systemParams).toHexString(), '",'),
            string.concat('"multiTroveGetter":"', address(deployed.multiTroveGetter).toHexString(), '",')
        );

        string memory part3 = string.concat(
            string.concat('"fpmm":"', address(deployed.fpmm).toHexString(), '",'),
            string.concat('"branches":[', branches.join(","), "]"),
            "}"
        );

        return string.concat(part1, part2, part3);
    }
}
