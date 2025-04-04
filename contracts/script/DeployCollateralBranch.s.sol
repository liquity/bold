// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

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
import "src/Dependencies/Whitelist.sol";
import "src/PriceFeeds/CollateralPriceFeed.sol";
import "test/TestContracts/PriceFeedTestnet.sol";
import "src/Zappers/TokenZapper.sol";
import "src/Dependencies/TokenWrapper.sol";
import "./DeployBvUSD.s.sol";
import {stdJson} from "forge-std/StdJson.sol";

// to deploy only base protocol: 
// DeploymentConfig.json -> globalContracts with zero addresses

// to deploy base protocol and collateral branches: 
// DeploymentConfig.json -> globalContracts with zero addresses and branch data to be deployed

// to deploy new branches and add to existing protocol
// DeploymentConfig.json -> globalContracts with deployed addresses and branch data to be deployed

contract DeployCollateralBranchScript is DeployBaseProtocol {
    using Strings for *;
    using StringFormatting for *;
    using StringEquality for string;
    using stdJson for string;

    string internal jsonData;
    string configPath = "/script/DeploymentConfig.json";

    struct BranchConfig {
        uint256 BCR;
        uint256 CCR;
        address collateralAddress;
        uint256 collateralIndex;
        bool createWhitelist;
        bool createWrapper;
        uint256 liqPenaltyDistr;
        uint256 liqPenaltySP;
        uint256 MCR;
        address oracleAddress;
        uint256 oracleStalenessThreshold;
        uint256 SCR;
    }

    struct BranchDeployment {
        address collateralAddress;
        bool createWrapper;
        bool createWhitelist;
        address oracleAddress;
        uint256 oracleStalenessThreshold;
    }


    struct TroveManagerParams {
        uint256 CCR;
        uint256 MCR;
        uint256 SCR;
        uint256 BCR;
        uint256 LIQUIDATION_PENALTY_SP;
        uint256 LIQUIDATION_PENALTY_REDISTRIBUTION;
    }

    struct BranchContracts {
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
        IERC20Metadata collToken;
        ITokenZapper collZapper;
        IWhitelist whitelist;
    }

    struct BranchContractsAddresses {
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
        address whitelist;
    }

    struct DeploymentVars {
        uint256 numCollaterals;
        bool[] deployZappers;
        bool[] deployWhitelist;
        IERC20Metadata[] collaterals;
        IPriceFeed[] priceFeeds;
        IAddressesRegistry[] addressesRegistries;
        ITroveManager[] troveManagers;
        BranchContracts contracts;
        bytes bytecode;
        address boldTokenAddress;
        uint256 i;
    }

    IWETH gasToken; // gas token

    function run() external override {
        GlobalContracts memory globalContracts;

        string memory saltStr = vm.envOr("SALT", block.timestamp.toString());
        SALT = keccak256(bytes(saltStr));
    
        if (vm.envBytes("DEPLOYER").length == 20) {
            // address
            deployer = vm.envAddress("DEPLOYER");
            vm.startBroadcast(deployer);
        } else {
            // private key
            uint256 privateKey = vm.envUint("DEPLOYER");
            deployer = vm.addr(privateKey);
            vm.startBroadcast(privateKey);
        }

        _log("Deployer:               ", deployer.toHexString());
        _log("Deployer balance:       ", deployer.balance.decimal());
        _log("CREATE2 salt:           ", 'keccak256(bytes("', saltStr, '")) = ', uint256(SALT).toHexString());

        // pull branches data
        jsonData = vm.readFile(string.concat(vm.projectRoot(), configPath));

        // fetch global contracts
        globalContracts = abi.decode(
            jsonData.parseRaw(".globalContracts"),
            (GlobalContracts)
        );

        // first deployment - deploy stablecoin
        if(address(globalContracts.bvUSD) == address(0)) {
            globalContracts.bvUSD = deployBvUSD();
        }

        // bvUSD must be set at this point        
        assert(address(globalContracts.bvUSD) != address(0));

        // LOG global contracts
        _log("bvUSD:               ", address(globalContracts.bvUSD).toHexString());
        _log("Collateral Registry:               ", address(globalContracts.collateralRegistry).toHexString());
        _log("Hint Helpers:               ", address(globalContracts.hintHelpers).toHexString());
        _log("MultiTrove getter:               ", address(globalContracts.multiTroveGetter).toHexString());

        // populate branch configs data
        uint256 numBranches = jsonData.readUint(".numBranches");
        assert(numBranches <= 10);

        _log("Number of branches:               ", numBranches.toString());

        TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](numBranches);
        BranchDeployment [] memory branchDeploymentConfigs = new BranchDeployment[](numBranches);
        uint256[] memory collateralIndexes = new uint256[](numBranches);
        string[] memory collNames = new string[](numBranches);
        string[] memory collSymbols = new string[](numBranches);


        for(uint256 i=0; i<numBranches; i++) {
            string memory collName = abi.decode(
                jsonData.parseRaw(
                    string.concat(".branches[", vm.toString(i), "].collateralName")
                ),
                (string)
            );
        
            string memory collSymbol = abi.decode(
                jsonData.parseRaw(
                    string.concat(".branches[", vm.toString(i), "].collateralSymbol")
                ),
                (string)
            );

            // // parse branch config 
            BranchConfig memory branchConfig = abi.decode(
                jsonData.parseRaw(
                    string.concat(".branches[", vm.toString(i), "].config")
                ),
                (BranchConfig)
            );

            // deploy collateral wrapper and set as actual collateral if necessary
            collateralIndexes[i] = branchConfig.collateralIndex;
            collNames[i] = collName;
            collSymbols[i] = collSymbol;
            troveManagerParamsArray[i] = TroveManagerParams({
                CCR: branchConfig.CCR,
                MCR: branchConfig.MCR,
                SCR: branchConfig.SCR,
                BCR: branchConfig.BCR,
                LIQUIDATION_PENALTY_SP: branchConfig.liqPenaltySP,
                LIQUIDATION_PENALTY_REDISTRIBUTION: branchConfig.liqPenaltyDistr
            });

            branchDeploymentConfigs[i].collateralAddress = branchConfig.createWrapper ? deployCollateralWrapper(branchConfig.collateralAddress) : branchConfig.collateralAddress;
            branchDeploymentConfigs[i].createWrapper = branchConfig.createWrapper;
            branchDeploymentConfigs[i].createWhitelist = branchConfig.createWhitelist;
            branchDeploymentConfigs[i].oracleAddress = branchConfig.oracleAddress;
            branchDeploymentConfigs[i].oracleStalenessThreshold = branchConfig.oracleStalenessThreshold;

            _log("Branch number:               ", (i + 1).toString());
            _log("Collateral Address:               ", branchConfig.collateralAddress.toHexString());
            _log("Collateral Index:               ", branchConfig.collateralIndex.toHexString());
            _log("Deploy Wrapper and Zapper:               ", branchConfig.createWrapper.toString());
            _log("Collateral Name:               ", collName);
            _log("Collateral Symbol:               ", collSymbol);
            _log("Oracle address:               ", branchConfig.oracleAddress.toHexString());
            _log("Oracle staleness:               ", branchConfig.oracleStalenessThreshold.toString());
            _log("CCR:               ", branchConfig.CCR.toString());
            _log("BCR:               ", branchConfig.BCR.toString());
            _log("MCR:               ", branchConfig.MCR.toString());
            _log("SCR:               ", branchConfig.SCR.toString());
            _log("LIQUIDATION_PENALTY_SP:               ", branchConfig.liqPenaltySP.toString());
            _log("LIQUIDATION_PENALTY_REDISTRIBUTION:               ", branchConfig.liqPenaltyDistr.toString());
        }

        gasToken = IWETH(globalContracts.gasToken);
        _log("Gas token:               ", address(gasToken).toHexString());

        // deploy branches and connect to base protocol
        BranchContracts[] memory branches = deployAndConnectMultiBranch(
            troveManagerParamsArray,
            globalContracts,
            branchDeploymentConfigs,
            collateralIndexes
        );

        vm.stopBroadcast();

        vm.writeFile("deployment-manifest.json", _getManifestJson(branches, globalContracts));
    }

    // deploy branches and connect 
    // deploy collateral registry if not present yet
    function deployAndConnectMultiBranch(
        TroveManagerParams[] memory troveManagerParamsArray,
        GlobalContracts memory globalContracts,
        BranchDeployment[] memory branchConfigs,
        uint256[] memory _collateralIndexes
    ) public returns (BranchContracts[] memory branches) {
        assert(branchConfigs.length == troveManagerParamsArray.length);

        DeploymentVars memory vars;
        vars.numCollaterals = troveManagerParamsArray.length;

        branches = new BranchContracts[](vars.numCollaterals);
        vars.collaterals = new IERC20Metadata[](vars.numCollaterals);
        vars.priceFeeds = new IPriceFeed[](vars.numCollaterals);
        vars.addressesRegistries = new IAddressesRegistry[](vars.numCollaterals);
        vars.troveManagers = new ITroveManager[](vars.numCollaterals);
        vars.deployZappers = new bool[](vars.numCollaterals);
        vars.deployWhitelist = new bool[](vars.numCollaterals);

        for (vars.i = 0; vars.i < vars.numCollaterals; vars.i++) {
            // set collaterals
            vars.collaterals[vars.i] = IERC20Metadata(branchConfigs[vars.i].collateralAddress);
            // set zapper to be deployed
            vars.deployZappers[vars.i] = branchConfigs[vars.i].createWrapper;
            
            // set whitelist to be deployed
            vars.deployWhitelist[vars.i] = branchConfigs[vars.i].createWhitelist;

            // Deploy AddressesRegistries and get TroveManager addresses
            (IAddressesRegistry addressesRegistry, address troveManagerAddress) =
                _deployAddressesRegistry(troveManagerParamsArray[vars.i]);

            vars.addressesRegistries[vars.i] = addressesRegistry;
            vars.troveManagers[vars.i] = ITroveManager(troveManagerAddress);

            vars.priceFeeds[vars.i] = new CollateralPriceFeed(
                deployer, 
                branchConfigs[vars.i].oracleAddress, 
                branchConfigs[vars.i].oracleStalenessThreshold
            );
        }

        // COLLATERAL REGISTRY
        if(address(globalContracts.collateralRegistry) == address(0)) {
            // deploy collateral registry with deployed branches
            // deploy hint helpers
            // deploy multi trove getter
            (
                globalContracts.collateralRegistry, 
                globalContracts.hintHelpers, 
                globalContracts.multiTroveGetter
            ) = 
                deployAndConnectCollateralRegistry(globalContracts.bvUSD, vars.collaterals, vars.troveManagers, deployer);
        } else {
            // only add new branches to existing collateral registry
            globalContracts.collateralRegistry.addNewCollaterals(
                _collateralIndexes,
                vars.collaterals,
                vars.troveManagers
            );
        }

        // Deploy per-branch contracts for each branch
        for (vars.i = 0; vars.i < vars.numCollaterals; vars.i++) {
            vars.contracts = deployAndConnectBranch(
                vars.collaterals[vars.i],
                vars.deployZappers[vars.i],
                vars.deployWhitelist[vars.i],
                vars.priceFeeds[vars.i],
                globalContracts.bvUSD,
                globalContracts.collateralRegistry,
                vars.addressesRegistries[vars.i],
                address(vars.troveManagers[vars.i]),
                globalContracts.hintHelpers,
                globalContracts.multiTroveGetter            
            );
            branches[vars.i] = vars.contracts;
        }
    }

    // deploy a new branch and connects it to the existing system
    function deployAndConnectBranch(
        IERC20Metadata _collToken,
        bool deployZapper,
        bool deployWhitelist,
        IPriceFeed _priceFeed,
        IBoldToken _bvUSD,
        ICollateralRegistry _collateralRegistry,
        IAddressesRegistry _addressesRegistry,
        address _troveManagerAddress,
        IHintHelpers _hintHelpers,
        IMultiTroveGetter _multiTroveGetter
    ) internal returns (BranchContracts memory branchContracts) {
        BranchContractsAddresses memory addresses;
        branchContracts.collToken = _collToken;

        // Deploy all contracts, using testers for TM and PriceFeed
        branchContracts.addressesRegistry = _addressesRegistry;

        // Deploy Metadata
        branchContracts.metadataNFT = deployMetadata(SALT);
        addresses.metadataNFT = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(MetadataNFT).creationCode, address(initializedFixedAssetReader)))
        );
        assert(address(branchContracts.metadataNFT) == addresses.metadataNFT);

        branchContracts.priceFeed = _priceFeed;
        addresses.borrowerOperations = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(BorrowerOperations).creationCode, address(branchContracts.addressesRegistry)))
        );
        addresses.troveManager = _troveManagerAddress;
        addresses.troveNFT = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(TroveNFT).creationCode, address(branchContracts.addressesRegistry)))
        );
        addresses.stabilityPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(StabilityPool).creationCode, address(branchContracts.addressesRegistry)))
        );
        addresses.activePool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(ActivePool).creationCode, address(branchContracts.addressesRegistry)))
        );
        addresses.defaultPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(DefaultPool).creationCode, address(branchContracts.addressesRegistry)))
        );
        addresses.gasPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(GasPool).creationCode, address(branchContracts.addressesRegistry)))
        );
        addresses.collSurplusPool = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(CollSurplusPool).creationCode, address(branchContracts.addressesRegistry)))
        );
        addresses.sortedTroves = vm.computeCreate2Address(
            SALT, keccak256(getBytecode(type(SortedTroves).creationCode, address(branchContracts.addressesRegistry)))
        );
        
        if(deployWhitelist) {
            addresses.whitelist =  vm.computeCreate2Address(
                SALT, keccak256(getBytecode(type(Whitelist).creationCode, deployer))
            );
            branchContracts.whitelist = new Whitelist{salt: SALT}(deployer);
        }

        IAddressesRegistry.AddressVars memory addressVars = IAddressesRegistry.AddressVars({
            collToken: _collToken,
            borrowerOperations: IBorrowerOperations(addresses.borrowerOperations),
            troveManager: ITroveManager(addresses.troveManager),
            troveNFT: ITroveNFT(addresses.troveNFT),
            metadataNFT: IMetadataNFT(addresses.metadataNFT),
            stabilityPool: IStabilityPool(addresses.stabilityPool),
            priceFeed: branchContracts.priceFeed,
            activePool: IActivePool(addresses.activePool),
            defaultPool: IDefaultPool(addresses.defaultPool),
            gasPoolAddress: addresses.gasPool,
            collSurplusPool: ICollSurplusPool(addresses.collSurplusPool),
            sortedTroves: ISortedTroves(addresses.sortedTroves),
            interestRouter: IInterestRouter(address(0)),
            hintHelpers: _hintHelpers,
            multiTroveGetter: _multiTroveGetter,
            collateralRegistry: _collateralRegistry,
            boldToken: _bvUSD,
            WETH: gasToken,
            whitelist: IWhitelist(addresses.whitelist)
        });
        branchContracts.addressesRegistry.setAddresses(addressVars);
        branchContracts.priceFeed.setAddresses(addresses.borrowerOperations);

        branchContracts.borrowerOperations = new BorrowerOperations{salt: SALT}(branchContracts.addressesRegistry);
        branchContracts.troveManager = new TroveManager{salt: SALT}(branchContracts.addressesRegistry);
        branchContracts.troveNFT = new TroveNFT{salt: SALT}(branchContracts.addressesRegistry);
        branchContracts.stabilityPool = new StabilityPool{salt: SALT}(branchContracts.addressesRegistry);
        branchContracts.activePool = new ActivePool{salt: SALT}(branchContracts.addressesRegistry);
        branchContracts.defaultPool = new DefaultPool{salt: SALT}(branchContracts.addressesRegistry);
        branchContracts.gasPool = new GasPool{salt: SALT}(branchContracts.addressesRegistry);
        branchContracts.collSurplusPool = new CollSurplusPool{salt: SALT}(branchContracts.addressesRegistry);
        branchContracts.sortedTroves = new SortedTroves{salt: SALT}(branchContracts.addressesRegistry);
    
        assert(address(branchContracts.borrowerOperations) == addresses.borrowerOperations);
        assert(address(branchContracts.troveManager) == addresses.troveManager);
        assert(address(branchContracts.troveNFT) == addresses.troveNFT);
        assert(address(branchContracts.stabilityPool) == addresses.stabilityPool);
        assert(address(branchContracts.activePool) == addresses.activePool);
        assert(address(branchContracts.defaultPool) == addresses.defaultPool);
        assert(address(branchContracts.gasPool) == addresses.gasPool);
        assert(address(branchContracts.collSurplusPool) == addresses.collSurplusPool);
        assert(address(branchContracts.sortedTroves) == addresses.sortedTroves);

        // deploy zapper
        if(deployZapper)
            branchContracts.collZapper = deployCollateralZapper(ITokenWrapper(address(branchContracts.collToken)), branchContracts.addressesRegistry);

        // Connect contracts
        _bvUSD.setStabilityPool(address(branchContracts.stabilityPool), true);

        // minters
        _bvUSD.setMinter(address(branchContracts.activePool), true);
        _bvUSD.setMinter(address(branchContracts.borrowerOperations), true);

        // burners
        _bvUSD.setBurner(address(branchContracts.troveManager), true);
        _bvUSD.setBurner(address(_collateralRegistry), true);
        _bvUSD.setBurner(address(branchContracts.borrowerOperations), true);
        _bvUSD.setBurner(address(branchContracts.stabilityPool), true);
    }

    // deploy token wrapper and zapper
    function deployCollateralWrapper(address underlyingToken) 
        public returns (address collateralWrapper) 
    {
        collateralWrapper = address(new TokenWrapper(IERC20Metadata(underlyingToken)));
    }

    function deployCollateralZapper(
        ITokenWrapper collateralWrapper, 
        IAddressesRegistry addressRegistry
    ) public returns (ITokenZapper collateralZapper) 
    {
        collateralZapper = new TokenZapper(addressRegistry, collateralWrapper);
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

    function getBytecode(bytes memory _creationCode, address _addressesRegistry) public pure returns (bytes memory) {
        return abi.encodePacked(_creationCode, abi.encode(_addressesRegistry));
    }

    function _getManifestJson(BranchContracts[] memory branches, GlobalContracts memory globalContracts)
        internal
        view
        returns (string memory)
    {
        string[] memory strBranches = new string[](branches.length);

        // Poor man's .map()
        for (uint256 i = 0; i < branches.length; ++i) {
            strBranches[i] = _getBranchContractsJson(branches[i]);
        }

        return string.concat(
            "{",
            string.concat(
                string.concat('"constants":', _getDeploymentConstants(), ","),
                string.concat('"collateralRegistry":"', address(globalContracts.collateralRegistry).toHexString(), '",'),
                string.concat('"bvUSD Token":"', address(globalContracts.bvUSD).toHexString(), '",'),
                string.concat('"hintHelpers":"', address(globalContracts.hintHelpers).toHexString(), '",'),
                string.concat('"multiTroveGetter":"', address(globalContracts.multiTroveGetter).toHexString(), '",'),
                string.concat('"Gas token":"', address(gasToken).toHexString(), '",'),
                string.concat('"branches":[', strBranches.join(","), "],")
            ),
            "}"
        );
    }

    function _getBranchContractsJson(BranchContracts memory c) internal view returns (string memory) {
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
                    string.concat('"collateral zapper":"', address(c.collZapper).toHexString(), '",'),
                    string.concat('"whitelist":"', address(c.whitelist).toHexString(), '",')
                )
            ),
            "}"
        );
    }

    function _getDeploymentConstants() internal view returns (string memory) {
        return string.concat(
            "{",
            string.concat(
                string.concat('"ETH_GAS_COMPENSATION":"', ETH_GAS_COMPENSATION.toString(), '",'),
                string.concat('"INTEREST_RATE_ADJ_COOLDOWN":"', INTEREST_RATE_ADJ_COOLDOWN.toString(), '",'),
                string.concat('"MAX_ANNUAL_INTEREST_RATE":"', MAX_ANNUAL_INTEREST_RATE.toString(), '",'),
                string.concat('"MIN_ANNUAL_INTEREST_RATE":"', MIN_ANNUAL_INTEREST_RATE.toString(), '",'),
                string.concat('"MIN_DEBT":"', MIN_DEBT.toString(), '",'),
                string.concat('"UPFRONT_INTEREST_PERIOD":"', UPFRONT_INTEREST_PERIOD.toString(), '"') // no comma
            ),
            "}"
        );
    }

}