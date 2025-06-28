// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./AddressesRegistry.sol";
import "./Interfaces/IAddressesRegistry.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/IActivePool.sol";
import "./Interfaces/IDefaultPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/ITroveNFT.sol";
import "./Interfaces/IMetadataNFT.sol"; // Assuming MetadataNFT is used by TroveNFT
import "./Interfaces/IPriceFeed.sol";
import "./Interfaces/IInterestRouter.sol"; // Assuming a shared or deployable interest router
import "./Interfaces/ICollateralRegistry.sol"; // For AddressVars
import "./Interfaces/IHintHelpers.sol"; // For AddressVars
import "./Interfaces/IMultiTroveGetter.sol"; // For AddressVars
import "./Interfaces/IWETH.sol"; // For AddressVars, assuming WETH is a known address
import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import "./StableMToken.sol";
import "./ActivePool.sol";
import "./DefaultPool.sol";
import "./BorrowerOperations.sol";
import "./TroveManager.sol";
import "./TroveNFT.sol";
import "./NFTMetadata/MetadataNFT.sol"; // If TroveNFT depends on a specific MetadataNFT deployed with it
import "./CollSurplusPool.sol";
import "./GasPool.sol"; // Assuming GasPool is part of the minimal viable pool
import "./SortedTroves.sol";
import "./StabilityPool.sol"; // Will be heavily modified later, deploy placeholder for now

// Placeholder for InterestRouter if it's deployed per pool or a global one is set
// import "./InterestRouter.sol";

contract MemecoinLendingFactory {
    address public owner;
    StableMToken public stableMToken;
    address public immutable WETH_ADDRESS; // Define WETH address, e.g., from constants or constructor
    address public immutable collateralRegistryAddress; // Global collateral registry
    address public immutable hintHelpersAddress; // Global hint helpers
    address public immutable multiTroveGetterAddress; // Global multi-trove getter
    address public immutable interestRouterAddress; // Global or per-pool interest router address

    struct PoolContracts {
        IAddressesRegistry addressesRegistry;
        ITroveManager troveManager;
        IBorrowerOperations borrowerOperations;
        IStabilityPool stabilityPool;
        IActivePool activePool;
        IDefaultPool defaultPool;
        ICollSurplusPool collSurplusPool;
        ISortedTroves sortedTroves;
        ITroveNFT troveNFT;
        IMetadataNFT metadataNFT; // This now refers to the created interface
        GasPool gasPool;
        IERC20 memecoinToken;
        IPriceFeed priceFeed;
    }

    mapping(address => PoolContracts) public memecoinToPoolContracts;
    address[] public deployedMemecoins;

    event PoolCreated(
        address indexed memecoinToken,
        address indexed priceFeedAddress,
        address addressesRegistry,
        address troveManager,
        address borrowerOperations,
        string poolName,
        string poolSymbol
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Factory: Caller is not the owner");
        _;
    }

    constructor(
        address _stableMTokenAddress,
        address _wethAddress,
        address _collateralRegistryAddress,
        address _hintHelpersAddress,
        address _multiTroveGetterAddress,
        address _interestRouterAddress
    ) {
        owner = msg.sender;
        stableMToken = StableMToken(_stableMTokenAddress);
        WETH_ADDRESS = _wethAddress;
        collateralRegistryAddress = _collateralRegistryAddress;
        hintHelpersAddress = _hintHelpersAddress;
        multiTroveGetterAddress = _multiTroveGetterAddress;
        interestRouterAddress = _interestRouterAddress;
    }

    function createPool(
        address _memecoinTokenAddress,
        address _priceFeedAddress,
        string calldata _poolName,
        string calldata _poolSymbol,
        uint256 _CCR,
        uint256 _MCR, // TroveManager MCR for liquidations
        uint256 _borrowerOperationsMCR, // MCR for new loans in BorrowerOperations
        uint256 _SCR,
        uint256 _BCR,
        uint256 _liquidationPenaltySP,
        uint256 _liquidationPenaltyRedistribution
    ) external onlyOwner {
        require(_memecoinTokenAddress != address(0), "Factory: Memecoin token address cannot be zero");
        require(_priceFeedAddress != address(0), "Factory: Price feed address cannot be zero");
        require(memecoinToPoolContracts[_memecoinTokenAddress].addressesRegistry == IAddressesRegistry(address(0)), "Factory: Pool for this memecoin already exists");

        AddressesRegistry newAddressesRegistry = new AddressesRegistry(
            address(this),
            _CCR,
            _MCR,
            _BCR,
            _SCR,
            _liquidationPenaltySP,
            _liquidationPenaltyRedistribution
        );

        // Deploy core contracts, passing the new registry
        ActivePool newActivePool = new ActivePool(newAddressesRegistry);
        DefaultPool newDefaultPool = new DefaultPool(newAddressesRegistry);
        GasPool newGasPool = new GasPool(newAddressesRegistry);
        CollSurplusPool newCollSurplusPool = new CollSurplusPool(newAddressesRegistry);
        SortedTroves newSortedTroves = new SortedTroves(newAddressesRegistry);

        // Deploy MetadataNFT first if TroveNFT needs it in constructor
        // MetadataNFT newMetadataNFT = new MetadataNFT(); // Assuming simple constructor
        // TroveNFT newTroveNFT = new TroveNFT(newAddressesRegistry, address(newMetadataNFT));
        // The existing TroveNFT constructor in the files only takes IAddressesRegistry.
        // Name/Symbol for NFT might be set via a separate call or within TroveNFT using registry info.
        TroveNFT newTroveNFT = new TroveNFT(newAddressesRegistry);
        IMetadataNFT deployedMetadataNFTInstance = IMetadataNFT(address(0)); // Default to address(0)
        // If MetadataNFT is deployed per pool and TroveNFT needs it:
        // MetadataNFT concreteMetadataNFT = new MetadataNFT(/** constructor params if any **/);
        // deployedMetadataNFTInstance = concreteMetadataNFT;
        // newTroveNFT.setMetadataNFT(address(concreteMetadataNFT)); // if there's a setter
        // Or if TroveNFT constructor takes it: TroveNFT newTroveNFT = new TroveNFT(newAddressesRegistry, address(concreteMetadataNFT));

        BorrowerOperations newBorrowerOperations = new BorrowerOperations(newAddressesRegistry, _borrowerOperationsMCR);
        TroveManager newTroveManager = new TroveManager(newAddressesRegistry);
        StabilityPool newStabilityPool = new StabilityPool(newAddressesRegistry);

        IAddressesRegistry.AddressVars memory addressVars = IAddressesRegistry.AddressVars({
            collToken: IERC20(_memecoinTokenAddress),
            borrowerOperations: newBorrowerOperations,
            troveManager: newTroveManager,
            troveNFT: newTroveNFT,
            metadataNFT: deployedMetadataNFTInstance, // Use the IMetadataNFT instance (address(0) for now)
            stabilityPool: newStabilityPool,
            priceFeed: IPriceFeed(_priceFeedAddress),
            activePool: newActivePool,
            defaultPool: newDefaultPool,
            gasPoolAddress: address(newGasPool),
            collSurplusPool: newCollSurplusPool,
            sortedTroves: newSortedTroves,
            interestRouter: IInterestRouter(interestRouterAddress),
            hintHelpers: IHintHelpers(hintHelpersAddress),
            multiTroveGetter: IMultiTroveGetter(multiTroveGetterAddress),
            collateralRegistry: ICollateralRegistry(collateralRegistryAddress),
            boldToken: stableMToken,
            WETH: IWETH(WETH_ADDRESS)
        });

        newAddressesRegistry.setAddresses(addressVars);

        PoolContracts storage newPool = memecoinToPoolContracts[_memecoinTokenAddress];
        newPool.addressesRegistry = newAddressesRegistry;
        newPool.memecoinToken = IERC20(_memecoinTokenAddress);
        newPool.priceFeed = IPriceFeed(_priceFeedAddress);
        newPool.troveManager = newTroveManager;
        newPool.borrowerOperations = newBorrowerOperations;
        newPool.stabilityPool = newStabilityPool;
        newPool.activePool = newActivePool;
        newPool.defaultPool = newDefaultPool;
        newPool.collSurplusPool = newCollSurplusPool;
        newPool.sortedTroves = newSortedTroves;
        newPool.troveNFT = newTroveNFT;
        newPool.metadataNFT = deployedMetadataNFTInstance; // Store the instance
        newPool.gasPool = newGasPool;

        deployedMemecoins.push(_memecoinTokenAddress);

        emit PoolCreated(
            _memecoinTokenAddress,
            _priceFeedAddress,
            address(newAddressesRegistry),
            address(newTroveManager),
            address(newBorrowerOperations),
            _poolName,
            _poolSymbol
        );
    }

    function getPoolRegistry(address _memecoinTokenAddress) external view returns (address) {
        return address(memecoinToPoolContracts[_memecoinTokenAddress].addressesRegistry);
    }

    function getPoolTroveManager(address _memecoinTokenAddress) external view returns (address) {
        return address(memecoinToPoolContracts[_memecoinTokenAddress].troveManager);
    }

    function getDeployedMemecoins() external view returns (address[] memory) {
        return deployedMemecoins;
    }
}
