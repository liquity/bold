// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseSetup} from "@chimera/BaseSetup.sol";
import {vm} from "chimera/Hevm.sol";
import "forge-std/console2.sol";

import {MockERC20} from "./mocks/MockERC20.sol";

import {ActorManager} from "./managers/ActorManager.sol";
import {AssetManager} from "./managers/AssetManager.sol";

import {AddressesRegistry} from "../../src/AddressesRegistry.sol";
import {ActivePool} from "../../src/ActivePool.sol";
import {BoldToken} from "../../src/BoldToken.sol";
import {BorrowerOperationsTester} from "../TestContracts/BorrowerOperationsTester.t.sol";
import {CollateralRegistry} from "../../src/CollateralRegistry.sol";
import {CollSurplusPool} from "../../src/CollSurplusPool.sol";
import {DefaultPool} from "../../src/DefaultPool.sol";
import {SortedTroves} from "../../src/SortedTroves.sol";
import {StabilityPool} from "../../src/StabilityPool.sol";
import {TroveManagerTester} from "../TestContracts/TroveManagerTester.t.sol";
import {TroveNFT} from "../../src/TroveNFT.sol";
import {PriceFeedTestnet} from "../TestContracts/PriceFeedTestnet.sol";
import {GasPool} from "../../src/GasPool.sol";
import {HintHelpers} from "../../src/HintHelpers.sol";
import {MultiTroveGetter} from "../../src/MultiTroveGetter.sol";

import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IBoldToken} from "../../src/Interfaces/IBoldToken.sol";
import { ISuperToken, ISuperTokenFactory, IERC20 } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {IWETH} from "../../src/Interfaces/IWETH.sol";
import {IAddressesRegistry} from "../../src/Interfaces/IAddressesRegistry.sol";
import {ICollateralRegistry} from "../../src/Interfaces/ICollateralRegistry.sol";
import {IHintHelpers} from "../../src/Interfaces/IHintHelpers.sol";
import {IMultiTroveGetter} from "../../src/Interfaces/IMultiTroveGetter.sol";
import {IInterestRouter} from "../../src/Interfaces/IInterestRouter.sol";
import {IPriceFeed} from "../../src/Interfaces/IPriceFeed.sol";
import {MetadataNFT, IMetadataNFT} from "../../src/NFTMetadata/MetadataNFT.sol";

// Add these interface imports
import {IBorrowerOperations} from "../../src/Interfaces/IBorrowerOperations.sol";
import {ITroveManager} from "../../src/Interfaces/ITroveManager.sol";
import {ITroveNFT} from "../../src/Interfaces/ITroveNFT.sol";
import {IStabilityPool} from "../../src/Interfaces/IStabilityPool.sol";
import {IActivePool} from "../../src/Interfaces/IActivePool.sol";
import {IDefaultPool} from "../../src/Interfaces/IDefaultPool.sol";
import {ICollSurplusPool} from "../../src/Interfaces/ICollSurplusPool.sol";
import {ISortedTroves} from "../../src/Interfaces/ISortedTroves.sol";

// TODO: We need the whole system


contract InterestRouter {
    
}

// TODO: Figure out ways to shutdown
contract MultiTokenPriceFeedTestnet {
    event LastGoodPriceUpdated(uint256 _lastGoodPrice);

    uint256 private _price = 2000 * 1e18;

    // --- Functions ---

    // View price getter for simplicity in tests
    function getPrice() external view returns (uint256) {
        return _price;
    }

    function lastGoodPrice() external view returns (uint256) {
        return _price;
    }

    // TODO: Redemptions and non redemptions
    function fetchPrice() external returns (uint256, bool) {
        // Fire an event just like the mainnet version would.
        // This lets the subgraph rely on events to get the latest price even when developing locally.
        emit LastGoodPriceUpdated(_price);
        return (_price, false);
    }

    function fetchRedemptionPrice() external returns (uint256, bool) {
        // Fire an event just like the mainnet version would.
        // This lets the subgraph rely on events to get the latest price even when developing locally.
        emit LastGoodPriceUpdated(_price);
        return (_price, false);
    }

    // Manual external price setter.
    function setPrice(uint256 price) external returns (bool) {
        _price = price;
        return true;
    }

    // TODO: Shutdowns
    function triggerShutdown() external {
        // TODO: pass BO
        // borrowerOperations.shutdownFromOracleFailure();
    }
}

struct LiquityContractsDev {
    AddressesRegistry addressesRegistry;
    ActivePool activePool;
    BorrowerOperationsTester borrowerOperations; // Tester
    CollSurplusPool collSurplusPool;
    DefaultPool defaultPool;
    SortedTroves sortedTroves;
    StabilityPool stabilityPool;
    TroveManagerTester troveManager; // Tester
    TroveNFT troveNFT;
    MultiTokenPriceFeedTestnet priceFeed; // Tester
    GasPool gasPool;
    InterestRouter interestRouter;
    MockERC20 collToken;
}

// Collateral Registry

abstract contract Setup is BaseSetup, ActorManager, AssetManager {
    LiquityContractsDev[] branches;

    LiquityContractsDev activeBranch;

    // Global contracts
    IBoldToken boldToken;
    InterestRouter interestRouter;
    CollateralRegistry collateralRegistry;
    HintHelpers hintHelpers;
    MultiTroveGetter multiTroveGetter;

    // Branch Contracts
    AddressesRegistry addressesRegistry;
    ActivePool activePool;
    BorrowerOperationsTester borrowerOperations; // Tester
    CollSurplusPool collSurplusPool;
    DefaultPool defaultPool;
    SortedTroves sortedTroves;
    StabilityPool stabilityPool;
    TroveManagerTester troveManager; // Tester
    TroveNFT troveNFT;
    MultiTokenPriceFeedTestnet priceFeed; // Tester
    GasPool gasPool;
    MockERC20 collToken;

    // List of Managers
    // TODO: Consider adding

    // List of TroveIds
    uint256[] troveIds;
    uint256 clampedTroveId;
    address clampedBatchManager;

    // Canaries
    bool hasDoneLiquidation;
    bool hasDoneRedemption;

    // Fake addresses
    address factory = address(this);
    address governor = address(this);

    function setNewClampedTroveId(uint256 entropy) public returns (uint256) {
        clampedTroveId = troveIds[entropy % troveIds.length];

        return clampedTroveId; // So it gets added to the dictionary
    }


    
    // bold token

    // TODO: Chunk these out, no point in not

    bytes32 SALT = bytes32(uint256(0x123123));


    // Assets
    MockERC20 weth;
    MockERC20 stETH;
    MockERC20 reETH;

    uint256 currentBranch;

    function _setupAddressRegistryAndTroveManager(
        address coll,
        TroveManagerParams memory params
    ) internal returns (address, address) {
        IAddressesRegistry addressesRegistry = new AddressesRegistry(
            address(this),
            params.CCR,
            params.MCR,
            params.SCR,
            type(uint256).max, // TODO: DEBT LIMIT?
            // TODO: Debt Limit
            params.LIQUIDATION_PENALTY_SP,
            params.LIQUIDATION_PENALTY_REDISTRIBUTION
        );
        address troveManagerAddress =
            getAddress(address(this), getBytecode(type(TroveManagerTester).creationCode, address(addressesRegistry)), SALT);
        
        return (address(addressesRegistry), troveManagerAddress);
    }

    function setup() internal virtual override {
        _addActor(address(0x7333333337));
        _addActor(address(0xb4d455555));

        // === Before === ///
        // Bold and interst router
        interestRouter = new InterestRouter();
        boldToken = boldToken = IBoldToken(address(new BoldToken{salt: SALT}(address(this), ISuperTokenFactory(factory))));
        
        // Temp branch and then push?

        weth = MockERC20(_newAsset(18));

        TroveManagerParams memory _troveManagerParams = TroveManagerParams({
            CCR: 150e16,                          // 150%
            MCR: 110e16,                          // 110%
            SCR: 130e16,                          // 130%
            LIQUIDATION_PENALTY_SP: 1e17,         // 10%
            LIQUIDATION_PENALTY_REDISTRIBUTION: 1e17  // 10%
        });

        (address addressesRegistry, address troveManagerAddress) = _setupAddressRegistryAndTroveManager(
            address(weth),
            _troveManagerParams
        );

        // Initialize arrays for collateral registry
        IERC20Metadata[] memory collaterals = new IERC20Metadata[](1);
        collaterals[0] = IERC20Metadata(address(weth));
        
        ITroveManager[] memory troveManagers = new ITroveManager[](1);
        troveManagers[0] = ITroveManager(troveManagerAddress);

        /// MID
        // Deploy registry and register the TMs
        collateralRegistry = new CollateralRegistry(IBoldToken(address(boldToken)), collaterals, troveManagers, governor);
        hintHelpers = new HintHelpers(collateralRegistry);
        multiTroveGetter = new MultiTroveGetter(collateralRegistry);

        // Deploy here
        // Receive the data format we need
        // Push to the list

        // Then ad-hoc branch setup
        // Ad hoc branch setup
        // Deploy and add branch!
        branches.push(_copiedDeploy(
            IERC20Metadata(address(weth)),
            IBoldToken(address(boldToken)),
            IWETH(address(weth)),
            troveManagerAddress,
            IAddressesRegistry(addressesRegistry),
            ICollateralRegistry(address(collateralRegistry)),
            IHintHelpers(address(hintHelpers)),
            IMultiTroveGetter(address(multiTroveGetter))
        ));

        _switchToActiveBranch(0);


        _onActorEnabled(address(this));
        _onActorEnabled(address(0x7333333337));
        _onActorEnabled(address(0xb4d455555));
    }

    function _switchToActiveBranch(uint256 index) internal {
        activeBranch = branches[index];

        addressesRegistry = activeBranch.addressesRegistry;
        activePool = activeBranch.activePool;
        borrowerOperations = activeBranch.borrowerOperations;
        collSurplusPool = activeBranch.collSurplusPool;
        defaultPool = activeBranch.defaultPool;
        sortedTroves = activeBranch.sortedTroves;
        stabilityPool = activeBranch.stabilityPool;
        troveManager = activeBranch.troveManager;
        troveNFT = activeBranch.troveNFT;
        priceFeed = activeBranch.priceFeed;
        gasPool = activeBranch.gasPool;
        collToken = activeBranch.collToken;


    }


    // STRUCTS
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

    function _copiedDeploy(
        IERC20Metadata _collToken,
        IBoldToken _boldToken,
        IWETH _weth,
        address _troveManagerAddress,
        IAddressesRegistry _addressesRegistry,
        ICollateralRegistry _collateralRegistry,
        IHintHelpers _hintHelpers,
        IMultiTroveGetter _multiTroveGetter
    ) internal returns (LiquityContractsDev memory contracts) {
        LiquityContractAddresses memory addresses;

        // Deploy all contracts, using testers for TM and PriceFeed
        contracts.addressesRegistry = AddressesRegistry(address(_addressesRegistry));
        contracts.priceFeed = new MultiTokenPriceFeedTestnet();
        contracts.interestRouter = new InterestRouter();
        contracts.collToken = MockERC20(address(_collToken));

        // Deploy Metadata
        addresses.metadataNFT = deployMetadata(SALT);
        // assert(address(metadataNFT) == addresses.metadataNFT); // NOTE: Skip

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
            priceFeed: IPriceFeed(address(contracts.priceFeed)),
            activePool: IActivePool(addresses.activePool),
            defaultPool: IDefaultPool(addresses.defaultPool),
            gasPoolAddress: addresses.gasPool,
            collSurplusPool: ICollSurplusPool(addresses.collSurplusPool),
            sortedTroves: ISortedTroves(addresses.sortedTroves),
            interestRouter: IInterestRouter(address(contracts.interestRouter)),
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
    }


    
    // TODO: NEED
    function switchBranch(uint256 index) public {
        // Switch to active branch
        activeBranch = branches[index];
    }


    // TODO: Programmatic Deployment of a Branch
    // Way to add more?

    // TODO: Replace with TroveManager2


    /// === ACTOR MANAGER HOOKS === ///
    // Given each actor a swap function that is called on swap
    // This hook ensures each actor is setup correctly
    function _onActorEnabled(address actor) internal {
        // TODO: Mint tokens and add stuff?
        vm.prank(actor);
        collToken.approve(address(borrowerOperations), type(uint256).max);

        vm.prank(actor);
        boldToken.approve(address(stabilityPool), type(uint256).max);

        collToken.mint(actor, type(uint88).max);
    }


    /// === Actor Modifiers === ///

    // NOTE: LIMITATION You can use these modifier only for one call, so use them for BASIC TARGETS
    modifier asAdmin {
        vm.prank(address(this));
        _;
    }

    modifier asActor {
        vm.prank(_getActor());
        _;
    }


    

    /// === Deplyoment crap === ///
    function getBytecode(bytes memory _creationCode, address _addressesRegistry) internal pure returns (bytes memory) {
        return abi.encodePacked(_creationCode, abi.encode(_addressesRegistry));
    }

    function getAddress(address _deployer, bytes memory _bytecode, bytes32 _salt) internal pure returns (address) {
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), _deployer, _salt, keccak256(_bytecode)));

        // NOTE: cast last 20 bytes of hash to address
        return address(uint160(uint256(hash)));
    }

    function deployMetadata(bytes32 salt) internal returns (address) {
        return (address(0x123123));
    }

}