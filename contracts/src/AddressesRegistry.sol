// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "./Dependencies/Ownable.sol";
import {MIN_LIQUIDATION_PENALTY_SP, MAX_LIQUIDATION_PENALTY_REDISTRIBUTION} from "./Dependencies/Constants.sol";
import "./Interfaces/IAddressesRegistry.sol";

contract AddressesRegistry is Ownable, IAddressesRegistry {
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

    // Critical system collateral ratio. If the system's total collateral ratio (TCR) falls below the CCR, some borrowing operation restrictions are applied
    uint256 public CCR;
    // Shutdown system collateral ratio. If the system's total collateral ratio (TCR) for a given collateral falls below the SCR,
    // the protocol triggers the shutdown of the borrow market and permanently disables all borrowing operations except for closing Troves.
    uint256 public SCR;

    // Minimum collateral ratio for individual troves
    uint256 public MCR;
    // Extra buffer of collateral ratio to join a batch or adjust a trove inside a batch (on top of MCR)
    uint256 public BCR;
    // Debt limit for the system
    uint256 public immutable debtLimit;
    // Liquidation penalty for troves offset to the SP
    uint256 public immutable LIQUIDATION_PENALTY_SP;
    // Liquidation penalty for troves redistributed
    uint256 public immutable LIQUIDATION_PENALTY_REDISTRIBUTION;

    error InvalidCCR();
    error InvalidMCR();
    error InvalidBCR();
    error InvalidSCR();
    error InvalidDebtLimit();
    error SPPenaltyTooLow();
    error SPPenaltyGtRedist();
    error RedistPenaltyTooHigh();

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
    event CCRUpdated(uint256 _newCCR);
    event MCRUpdated(uint256 _newMCR);
    event BCRUpdated(uint256 _newBCR);
    event SCRUpdated(uint256 _newSCR);

    constructor(
        address _owner,
        uint256 _ccr,
        uint256 _mcr,
        uint256 _bcr,
        uint256 _scr,
        uint256 _debtLimit,
        uint256 _liquidationPenaltySP,
        uint256 _liquidationPenaltyRedistribution
    ) Ownable(_owner) {
        if (_ccr <= 1e18 || _ccr >= 5e18) revert InvalidCCR();
        if (_mcr <= 1e18 || _mcr >= 5e18) revert InvalidMCR();
        if (_bcr < 5e16 || _bcr >= 50e16) revert InvalidBCR();
        if (_scr <= 1e18 || _scr >= 5e18) revert InvalidSCR();
        if (_liquidationPenaltySP < MIN_LIQUIDATION_PENALTY_SP) revert SPPenaltyTooLow();
        if (_liquidationPenaltySP > _liquidationPenaltyRedistribution) revert SPPenaltyGtRedist();
        if (_liquidationPenaltyRedistribution > MAX_LIQUIDATION_PENALTY_REDISTRIBUTION) revert RedistPenaltyTooHigh();

        CCR = _ccr;
        SCR = _scr;
        MCR = _mcr;
        BCR = _bcr;
        debtLimit = _debtLimit;
        LIQUIDATION_PENALTY_SP = _liquidationPenaltySP;
        LIQUIDATION_PENALTY_REDISTRIBUTION = _liquidationPenaltyRedistribution;
    }

    function setAddresses(AddressVars memory _vars) external onlyOwner {
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

        _renounceOwnership();
    }

    function updateCCR(uint256 _newCCR) external {
        require(msg.sender == address(collateralRegistry), "AddressesRegistry: Only collateral registry can call this function");
        if (_newCCR <= 1e18 || _newCCR >= 5e18) revert InvalidCCR();
        CCR = _newCCR;
        emit CCRUpdated(_newCCR);
    }

    function updateMCR(uint256 _newMCR) external {
        require(msg.sender == address(collateralRegistry), "AddressesRegistry: Only collateral registry can call this function");
        if (_newMCR <= 1e18 || _newMCR >= 5e18) revert InvalidMCR();
        MCR = _newMCR;
        emit MCRUpdated(_newMCR);
    }

    function updateBCR(uint256 _newBCR) external {
        require(msg.sender == address(collateralRegistry), "AddressesRegistry: Only collateral registry can call this function");
        if (_newBCR < 5e16 || _newBCR >= 50e16) revert InvalidBCR();
        BCR = _newBCR;
        emit BCRUpdated(_newBCR);
    }

    function updateSCR(uint256 _newSCR) external {
        require(msg.sender == address(collateralRegistry), "AddressesRegistry: Only collateral registry can call this function");
        if (_newSCR <= 1e18 || _newSCR >= 5e18) revert InvalidSCR();
        SCR = _newSCR;
        emit SCRUpdated(_newSCR);
    }
}
