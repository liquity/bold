// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.24;

import "./Dependencies/Owned.sol";
import {MIN_LIQUIDATION_PENALTY_SP, MAX_LIQUIDATION_PENALTY_REDISTRIBUTION} from "./Dependencies/Constants.sol";
import "./Interfaces/IAddressesRegistry.sol";

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

    bool systemContractsInitialized;

    // Critical system collateral ratio. If the system's total collateral ratio (TCR) falls below the CCR, some borrowing operation restrictions are applied
    uint256 public CCR;
    // Shutdown system collateral ratio. If the system's total collateral ratio (TCR) for a given collateral falls below the SCR,
    // the protocol triggers the shutdown of the borrow market and permanently disables all borrowing operations except for closing Troves.
    uint256 public SCR;

    // Minimum collateral ratio for individual troves
    uint256 public MCR;

    // Extra buffer of collateral ratio to join a batch or adjust a trove inside a batch (on top of MCR)
    uint256 public immutable BCR;
    // Liquidation penalty for troves offset to the SP
    uint256 public LIQUIDATION_PENALTY_SP;
    // Liquidation penalty for troves redistributed
    uint256 public LIQUIDATION_PENALTY_REDISTRIBUTION;

    error InvalidCCR();
    error InvalidMCR();
    error InvalidBCR();
    error InvalidSCR();
    error SPPenaltyTooLow();
    error SPPenaltyGtRedist();
    error RedistPenaltyTooHigh();
    error AlreadyInitialized();
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
        uint256 _bcr,
        uint256 _scr,
        uint256 _liquidationPenaltySP,
        uint256 _liquidationPenaltyRedistribution
    ) Owned(_owner) {
        if (_ccr <= 1e18 || _ccr >= 2e18) revert InvalidCCR();
        if (_mcr <= 1e18 || _mcr >= 2e18) revert InvalidMCR();
        if (_bcr < 5e16 || _bcr >= 50e16) revert InvalidBCR();
        if (_scr <= 1e18 || _scr >= 2e18) revert InvalidSCR();
        if (_liquidationPenaltySP < MIN_LIQUIDATION_PENALTY_SP) revert SPPenaltyTooLow();
        if (_liquidationPenaltySP > _liquidationPenaltyRedistribution) revert SPPenaltyGtRedist();
        if (_liquidationPenaltyRedistribution > MAX_LIQUIDATION_PENALTY_REDISTRIBUTION) revert RedistPenaltyTooHigh();

        CCR = _ccr;
        SCR = _scr;
        MCR = _mcr;
        BCR = _bcr;
        LIQUIDATION_PENALTY_SP = _liquidationPenaltySP;
        LIQUIDATION_PENALTY_REDISTRIBUTION = _liquidationPenaltyRedistribution;
    }

    function getOwner() external returns (address) {
        return owner;
    }

    // initialization
    function setAddresses(AddressVars memory _vars) external onlyOwner {
        if(systemContractsInitialized)
            revert AlreadyInitialized();
    
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
        systemContractsInitialized = true;

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
        if(whitelistInitialized)
            revert AlreadyInitialized();

        whitelist = IWhitelist(_whitelist);

        troveManager.updateWhitelist(_whitelist);

        whitelistInitialized = true;

        emit WhitelistChanged(_whitelist);
    }

    // --- WHITELIST UPDATE LOGIC ---- //
    event WhitelistChanged(address _whitelistAddress);
    event WhitelistProposed(address _newWhitelistAddress);

    struct WhitelistProposal {
        address whitelist; 
        uint256 timestamp;
    }
    bool whitelistInitialized;
    WhitelistProposal public proposedWhitelist;

    // set to address 0 to remove the whitelist
    function proposeNewWhitelist(address _newWhitelist) external onlyOwner {
        require(whitelistInitialized, "Not initalised");

        proposedWhitelist.whitelist = _newWhitelist;
        proposedWhitelist.timestamp = block.timestamp;

        emit WhitelistProposed(_newWhitelist);
    }

    function acceptNewWhitelist() external onlyOwner {
        require(
            proposedWhitelist.timestamp + 3 days <= block.timestamp && 
            proposedWhitelist.timestamp != 0,
            "Invalid"
        );
        
        address newWhitelist = proposedWhitelist.whitelist;
        
        // update/remove whitelist
        whitelist = IWhitelist(newWhitelist);
            
        // trigger update in trove manager
        troveManager.updateWhitelist(newWhitelist);

        // reset proposal
        delete proposedWhitelist;

        emit WhitelistChanged(newWhitelist);
    }

    // --- CRs UPDATE LOGIC ---- //
    event CRsChanged(uint256 newCCR, uint256 newSCR, uint256 newMCR);
    event CRsProposal(uint256 newCCR, uint256 newSCR, uint256 newMCR, uint256 timestamp);

    struct CRProposal {
        uint256 CCR;
        uint256 MCR;
        uint256 SCR;
        uint256 timestamp; 
    }

    CRProposal public proposedCR; 

    function proposeNewCollateralValues(uint256 newCCR, uint256 newSCR, uint256 newMCR) external override onlyOwner {
        if (newCCR <= 1e18 || newCCR >= 2e18) revert InvalidCCR();
        if (newMCR <= 1e18 || newMCR >= 2e18) revert InvalidMCR();
        if (newSCR <= 1e18 || newSCR >= 2e18) revert InvalidSCR();

        proposedCR.CCR = newCCR;
        proposedCR.MCR = newMCR;
        proposedCR.SCR = newSCR;
        proposedCR.timestamp = block.timestamp;

        emit CRsProposal(newCCR, newSCR, newMCR, block.timestamp);
    }

    function acceptNewCollateralValues() external override onlyOwner {
        require(
            proposedCR.timestamp + 3 days <= block.timestamp && 
            proposedCR.timestamp != 0,
            "Invalid"
        );

        CCR = proposedCR.CCR;
        SCR = proposedCR.SCR;
        MCR = proposedCR.MCR;
            
        // trigger update in trove manager
        troveManager.updateCRs(CCR, SCR, MCR);

        // reset proposal
        delete proposedCR;

        emit CRsChanged(CCR, SCR, MCR);
    }
    
        // --- LIQUIDATION VALUES UPDATE LOGIC ---- //
    event LiquidationValuesChanged(uint256 liquidationPenaltySP, uint256 liquidationPenaltyRedistribution);
    event LiquidationValuesProposed(uint256 liquidationPenaltySP, uint256 liquidationPenaltyRedistribution, uint256 timestamp);

    struct LiquidationValuesProposal {
        uint256 liquidationPenaltySP;
        uint256 liquidationPenaltyRedistribution;
        uint256 timestamp; 
    }

    LiquidationValuesProposal public proposedLiquidationValues; 

    function proposeNewLiquidationValues(uint256 newLiquidationPenaltySP, uint256 newLiquidationPenaltyRedistribution) external override onlyOwner {
        if (newLiquidationPenaltySP < MIN_LIQUIDATION_PENALTY_SP) revert SPPenaltyTooLow();
        if (newLiquidationPenaltySP > newLiquidationPenaltyRedistribution) revert SPPenaltyGtRedist();
        if (newLiquidationPenaltyRedistribution > MAX_LIQUIDATION_PENALTY_REDISTRIBUTION) revert RedistPenaltyTooHigh();

        proposedLiquidationValues.liquidationPenaltySP = newLiquidationPenaltySP;
        proposedLiquidationValues.liquidationPenaltyRedistribution = newLiquidationPenaltyRedistribution;
        proposedLiquidationValues.timestamp = block.timestamp;

        emit LiquidationValuesProposed(newLiquidationPenaltySP, newLiquidationPenaltyRedistribution, block.timestamp);
    }

    function acceptNewLiquidationValues() external override onlyOwner {
        require(
            proposedLiquidationValues.timestamp + 3 days <= block.timestamp && 
            proposedLiquidationValues.timestamp != 0,
            "Invalid"
        );

        LIQUIDATION_PENALTY_SP = proposedLiquidationValues.liquidationPenaltySP;
        LIQUIDATION_PENALTY_REDISTRIBUTION = proposedLiquidationValues.liquidationPenaltyRedistribution;
            
        // trigger update in trove manager
        troveManager.updateLiquidationValues(LIQUIDATION_PENALTY_SP, LIQUIDATION_PENALTY_REDISTRIBUTION);

        // reset proposal
        delete proposedLiquidationValues;

        emit LiquidationValuesChanged(LIQUIDATION_PENALTY_SP, LIQUIDATION_PENALTY_REDISTRIBUTION);
    }

}
