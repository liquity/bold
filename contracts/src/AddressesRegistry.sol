// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.24;

import "./Dependencies/Owned.sol";
import {MIN_LIQUIDATION_PENALTY_SP, MAX_LIQUIDATION_PENALTY_REDISTRIBUTION} from "./Dependencies/Constants.sol";
import "./Interfaces/IAddressesRegistry.sol";
import {UpgradableContracts} from "./Types/UpgradableContracts.sol";

contract AddressesRegistry is Owned, IAddressesRegistry {
    IERC20Metadata public collToken;
    IBorrowerOperations public borrowerOperations;
    ITroveManager public troveManager;
    ITroveNFT public troveNFT;
    IMetadataNFT public metadataNFT;
    IStabilityPool public stabilityPool;
    IPriceFeed public priceFeed;
    IActivePool public activePool;
    IDefaultPool public defaultPool;
    address public gasPoolAddress;
    ICollSurplusPool public collSurplusPool;
    ISortedTroves public sortedTroves;
    IInterestRouter public interestRouter;
    IHintHelpers public hintHelpers;
    IMultiTroveGetter public multiTroveGetter;
    ICollateralRegistry public collateralRegistry;
    IBoldToken public boldToken;
    IWETH public WETH;
    IWhitelist public whitelist;

    // Critical system collateral ratio. If the system's total collateral ratio (TCR) falls below the CCR, some borrowing operation restrictions are applied
    uint256 public immutable CCR;
    // Shutdown system collateral ratio. If the system's total collateral ratio (TCR) for a given collateral falls below the SCR,
    // the protocol triggers the shutdown of the borrow market and permanently disables all borrowing operations except for closing Troves.
    uint256 public immutable SCR;

    // Minimum collateral ratio for individual troves
    uint256 public immutable MCR;

    // Liquidation penalty for troves offset to the SP
    uint256 public immutable LIQUIDATION_PENALTY_SP;
    // Liquidation penalty for troves redistributed
    uint256 public immutable LIQUIDATION_PENALTY_REDISTRIBUTION;

    error InvalidCCR();
    error InvalidMCR();
    error InvalidSCR();
    error SPPenaltyTooLow();
    error SPPenaltyGtRedist();
    error RedistPenaltyTooHigh();
    error AlreadyInitialised();
    error Cooldown();

    event CollTokenAddressChanged(address _collTokenAddress);
    event BorrowerOperationsAddressChanged(address _borrowerOperationsAddress);
    event TroveManagerAddressChanged(address _troveManagerAddress);
    event TroveNFTAddressChanged(address _troveNFTAddress);
    event MetadataNFTAddressChanged(address _metadataNFTAddress);
    event StabilityPoolAddressChanged(address _stabilityPoolAddress);
    event PriceFeedAddressChanged(address _priceFeedAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event InterestRouterAddressChanged(address _interestRouterAddress);
    event HintHelpersAddressChanged(address _hintHelpersAddress);
    event MultiTroveGetterAddressChanged(address _multiTroveGetterAddress);
    event CollateralRegistryAddressChanged(address _collateralRegistryAddress);
    event BoldTokenAddressChanged(address _boldTokenAddress);
    event WETHAddressChanged(address _wethAddress);

    constructor(
        address _owner,
        uint256 _ccr,
        uint256 _mcr,
        uint256 _scr,
        uint256 _liquidationPenaltySP,
        uint256 _liquidationPenaltyRedistribution
    ) Owned(_owner) {
        if (_ccr <= 1e18 || _ccr >= 2e18) revert InvalidCCR();
        if (_mcr <= 1e18 || _mcr >= 2e18) revert InvalidMCR();
        if (_scr <= 1e18 || _scr >= 2e18) revert InvalidSCR();
        if (_liquidationPenaltySP < MIN_LIQUIDATION_PENALTY_SP) revert SPPenaltyTooLow();
        if (_liquidationPenaltySP > _liquidationPenaltyRedistribution) revert SPPenaltyGtRedist();
        if (_liquidationPenaltyRedistribution > MAX_LIQUIDATION_PENALTY_REDISTRIBUTION) revert RedistPenaltyTooHigh();

        CCR = _ccr;
        SCR = _scr;
        MCR = _mcr;
        LIQUIDATION_PENALTY_SP = _liquidationPenaltySP;
        LIQUIDATION_PENALTY_REDISTRIBUTION = _liquidationPenaltyRedistribution;
    }

    function getOwner() external returns (address) {
        return owner;
    }

    // initialization
    function setAddresses(AddressVars memory _vars) external onlyOwner {
        if(systemContractsInitialised)
            revert AlreadyInitialised();
    
        collToken = _vars.collToken;
        borrowerOperations = _vars.borrowerOperations;
        troveManager = _vars.troveManager;
        troveNFT = _vars.troveNFT;
        metadataNFT = _vars.metadataNFT;
        stabilityPool = _vars.stabilityPool;
        priceFeed = _vars.priceFeed;
        activePool = _vars.activePool;
        defaultPool = _vars.defaultPool;
        gasPoolAddress = _vars.gasPoolAddress;
        collSurplusPool = _vars.collSurplusPool;
        sortedTroves = _vars.sortedTroves;
        interestRouter = _vars.interestRouter;
        hintHelpers = _vars.hintHelpers;
        multiTroveGetter = _vars.multiTroveGetter;
        collateralRegistry = _vars.collateralRegistry;
        boldToken = _vars.boldToken;
        WETH = _vars.WETH;
        systemContractsInitialised = true;

        emit CollTokenAddressChanged(address(_vars.collToken));
        emit BorrowerOperationsAddressChanged(address(_vars.borrowerOperations));
        emit TroveManagerAddressChanged(address(_vars.troveManager));
        emit TroveNFTAddressChanged(address(_vars.troveNFT));
        emit MetadataNFTAddressChanged(address(_vars.metadataNFT));
        emit StabilityPoolAddressChanged(address(_vars.stabilityPool));
        emit PriceFeedAddressChanged(address(_vars.priceFeed));
        emit ActivePoolAddressChanged(address(_vars.activePool));
        emit DefaultPoolAddressChanged(address(_vars.defaultPool));
        emit GasPoolAddressChanged(_vars.gasPoolAddress);
        emit CollSurplusPoolAddressChanged(address(_vars.collSurplusPool));
        emit SortedTrovesAddressChanged(address(_vars.sortedTroves));
        emit InterestRouterAddressChanged(address(_vars.interestRouter));
        emit HintHelpersAddressChanged(address(_vars.hintHelpers));
        emit MultiTroveGetterAddressChanged(address(_vars.multiTroveGetter));
        emit CollateralRegistryAddressChanged(address(_vars.collateralRegistry));
        emit BoldTokenAddressChanged(address(_vars.boldToken));
        emit WETHAddressChanged(address(_vars.WETH));
    }
    
    function initializeWhitelist(address _whitelist) external onlyOwner {
        require(address(whitelist) == address(0), "Already initialized");

        whitelist = IWhitelist(_whitelist);

        troveManager.updateWhitelist(IWhitelist(_whitelist));

        emit WhitelistChanged(_whitelist);
    }

    // --- WHITELIST UPDATE LOGIC ---- //
    event WhitelistChanged(address _whitelistAddress);
    event WhitelistProposed(address _newWhitelistAddress);

    struct WhitelistProposal {
        address whitelist; 
        uint256 timestamp;
    }
    WhitelistProposal public proposedWhitelist;

    function proposeNewWhitelist(address _newWhitelist) external onlyOwner {
        require(_newWhitelist != address(0), "Invalid address");

        proposedWhitelist.whitelist = _newWhitelist;
        proposedWhitelist.timestamp = block.timestamp;

        emit WhitelistProposed(_newWhitelist);
    }

    function acceptNewWhitelist() external onlyOwner {
        require(
            address(whitelist) != address(0) && 
            proposedWhitelist.timestamp + 3 days <= block.timestamp, 
            "Invalid"
        );

        // update address
        whitelist = IWhitelist(proposedWhitelist.whitelist);
            
        // trigger update in trove manager
        troveManager.updateWhitelist(whitelist);

        // reset proposal
        delete proposedWhitelist;

        emit WhitelistChanged(address(whitelist));
    }

    // // --- SYSTEM CONTRACTS UPDATE LOGIC TODO ---- //

    // event NewSystemContractsProposed(UpdateContractsProposal _proposedAddresses);
    // event SystemContractsChanged();

    // struct UpdateContractsProposal {
    //     UpgradableContracts contracts;
    //     uint256 timestamp;
    // }

    // UpdateContractsProposal proposedSystemUpdates;
    bool systemContractsInitialised;

    // function proposeNewSystemContracts(UpdateContractsProposal memory _newAddresses) external onlyOwner {
    //     UpgradableContracts memory proposedContracts = _newAddresses.contracts;
        
    //     require(
    //         systemContractsInitialised &&
    //         proposedContracts.priceFeed != address(0),
    //         "Invalid proposal"
    //     );

    //     proposedSystemUpdates.contracts = proposedContracts;
    //     proposedSystemUpdates.timestamp = block.timestamp;

    //     emit NewSystemContractsProposed(_newAddresses);
    // }

    // function acceptNewSystemContracts() external onlyOwner {
    //     require(
    //         systemContractsInitialised && 
    //         proposedSystemUpdates.timestamp + 3 days <= block.timestamp, 
    //         "Invalid"
    //     );
        
    //     // update addresses
    //     UpgradableContracts memory proposedContracts = proposedSystemUpdates.contracts;
    //     _setNewSystemContracts(proposedContracts);

    //     // trigger update in trove manager
    //     troveManager.updateSystemContracts(proposedContracts);

    //     // reset proposal
    //     delete proposedContracts;

    //     emit SystemContractsChanged();
    // }

    // function _setNewSystemContracts(UpgradableContracts memory _proposedContracts) internal {
    //     if(_proposedContracts.priceFeed != address(0))
    //         priceFeed = IPriceFeed(_proposedContracts.priceFeed);
    // }
}
