// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBoldToken.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";
import "./Types/LatestTroveData.sol";
import "./Types/LatestBatchData.sol";

// import "forge-std/console2.sol";

contract BorrowerOperations is LiquityBase, Ownable, CheckContract, IBorrowerOperations {
    using SafeERC20 for IERC20;

    string public constant NAME = "BorrowerOperations";

    uint256 public constant SECONDS_IN_ONE_YEAR = 31536000; // 60 * 60 * 24 * 365,

    // --- Connected contract declarations ---

    IERC20 public immutable ETH;
    ITroveManager public immutable troveManager;
    address gasPoolAddress;
    ICollSurplusPool collSurplusPool;
    IBoldToken public boldToken;
    // A doubly linked list of Troves, sorted by their collateral ratios
    ISortedTroves public sortedTroves;

    // Minimum collateral ratio for individual troves
    uint256 public immutable MCR;

    /*
     * Mapping from TroveId to granted address for operations that "give" money to the trove (add collateral, pay debt).
     * Useful for instance for cold/hot wallet setups.
     * If its value is zero address, any address is allowed to do those operations on behalf of trove owner.
     * Otherwise, only the address in this mapping (and the trove owner) will be allowed.
     * To restrict this permission to no one, trove owner should be set in this mapping.
     */
    mapping(uint256 => address) public addManagerOf;

    /*
     * Mapping from TroveId to granted address for operations that "withdraw" money from the trove (withdraw collateral, borrow).
     * Useful for instance for cold/hot wallet setups.
     * If its value is zero address, only owner is allowed to do those operations.
     * Otherwise, only the address in this mapping (and the trove owner) will be allowed.
     * Therefore, by default this permission is restricted to no one.
     * Trove owner be set in this mapping is equivalent to zero address.
     */
    mapping(uint256 => address) public removeManagerOf;

    /*
    * Mapping from TroveId to individual delegate for interest rate setting.
    *
    * This address then has the ability to update the borrower’s interest rate, but not change its debt or collateral.
    * Useful for instance for cold/hot wallet setups.
    */
    mapping(uint256 => InterestIndividualDelegate) private interestIndividualDelegateOf;

    /*
     * Mapping from TroveId to granted address for interest rate setting (batch manager).
     *
     * Batch managers set the interest rate for every Trove in the batch. The interest rate is the same for all Troves in the batch.
     */
    mapping(uint256 => address) public interestBatchManagerOf;

    // List of registered Interest Batch Managers
    mapping(address => InterestBatchManager) private interestBatchManagers;

    /* --- Variable container structs  ---

    Used to hold, return and assign variables inside a function, in order to avoid the error:
    "CompilerError: Stack too deep". */

    struct LocalVariables_adjustTrove {
        LatestTroveData trove;
        uint256 price;
        bool isBelowCriticalThreshold;
        uint256 newICR;
        uint256 newDebt;
        uint256 newColl;
    }

    struct LocalVariables_openTrove {
        TroveChange troveChange;
        uint256 price;
        uint256 avgInterestRate;
        uint256 entireDebt;
        uint256 ICR;
        uint256 newTCR;
    }

    struct LocalVariables_setInterestBatchManager {
        address oldBatchManager;
        LatestTroveData trove;
        LatestBatchData oldBatch;
        LatestBatchData newBatch;
    }

    struct LocalVariables_removeFromBatch {
        address batchManager;
        LatestTroveData trove;
        LatestBatchData batch;
        uint256 newBatchDebt;
    }

    struct ContractsCacheTMAP {
        ITroveManager troveManager;
        IActivePool activePool;
    }

    struct ContractsCacheTMAPBT {
        ITroveManager troveManager;
        IActivePool activePool;
        IBoldToken boldToken;
    }

    struct ContractsCacheTMAPBTST {
        ITroveManager troveManager;
        IActivePool activePool;
        IBoldToken boldToken;
        ISortedTroves sortedTroves;
    }

    struct ContractsCacheTMAPST {
        ITroveManager troveManager;
        IActivePool activePool;
        ISortedTroves sortedTroves;
    }

    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event BoldTokenAddressChanged(address _boldTokenAddress);

    constructor(IERC20 _ETH, ITroveManager _troveManager) {
        checkContract(address(_ETH));
        checkContract(address(_troveManager));

        ETH = _ETH;
        troveManager = _troveManager;

        MCR = _troveManager.MCR();

        emit TroveManagerAddressChanged(address(_troveManager));
    }

    // --- Dependency setters ---

    function setAddresses(
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _sortedTrovesAddress,
        address _boldTokenAddress
    ) external override onlyOwner {
        // This makes impossible to open a trove with zero withdrawn Bold
        assert(MIN_NET_DEBT > 0);

        checkContract(_activePoolAddress);
        checkContract(_defaultPoolAddress);
        checkContract(_gasPoolAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_priceFeedAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_boldTokenAddress);

        activePool = IActivePool(_activePoolAddress);
        defaultPool = IDefaultPool(_defaultPoolAddress);
        gasPoolAddress = _gasPoolAddress;
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        boldToken = IBoldToken(_boldTokenAddress);

        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit GasPoolAddressChanged(_gasPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit BoldTokenAddressChanged(_boldTokenAddress);

        // Allow funds movements between Liquity contracts
        ETH.approve(_activePoolAddress, type(uint256).max);

        _renounceOwnership();
    }

    // --- Borrower Trove Operations ---

    function openTrove(
        address _owner,
        uint256 _ownerIndex,
        uint256 _ETHAmount,
        uint256 _boldAmount,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _annualInterestRate,
        uint256 _maxUpfrontFee
    ) external override returns (uint256) {
        _requireValidAnnualInterestRate(_annualInterestRate);

        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);

        TroveChange memory troveChange;
        uint256 troveId = _openTrove(
            contractsCache, _owner, _ownerIndex, _ETHAmount, _boldAmount, _annualInterestRate, address(0), 0, 0, _maxUpfrontFee, troveChange
        );

        // Set the stored Trove properties and mint the NFT
        contractsCache.troveManager.onOpenTrove(_owner, troveId, troveChange, _annualInterestRate);

        sortedTroves.insert(troveId, _annualInterestRate, _upperHint, _lowerHint);

        return troveId;
    }

    function openTroveAndJoinInterestBatchManager(
        address _owner,
        uint256 _ownerIndex,
        uint256 _ETHAmount,
        uint256 _boldAmount,
        uint256 _upperHint,
        uint256 _lowerHint,
        address _interestBatchManager,
        uint256 _maxUpfrontFee
    ) external override returns (uint256) {
        _requireValidInterestBatchManager(_interestBatchManager);

        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);

        LatestBatchData memory batch = contractsCache.troveManager.getLatestBatchData(_interestBatchManager);

        TroveChange memory batchChange;
        // We set old weighted values here, as it’s only necessary for batches, so we don’t need to pass them to _openTrove func
        batchChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
        batchChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
        uint256 troveId = _openTrove(
            contractsCache, _owner, _ownerIndex, _ETHAmount, _boldAmount, batch.annualInterestRate, _interestBatchManager, batch.entireDebtWithoutRedistribution, batch.annualManagementFee, _maxUpfrontFee, batchChange
        );

        interestBatchManagerOf[troveId] = _interestBatchManager;

        // Set the stored Trove properties and mint the NFT
        contractsCache.troveManager.onOpenTroveAndJoinBatch(_owner, troveId, batchChange, _interestBatchManager, batch.entireCollWithoutRedistribution, batch.entireDebtWithoutRedistribution);

        sortedTroves.insertIntoBatch(
            troveId, BatchId.wrap(_interestBatchManager), batch.annualInterestRate, _upperHint, _lowerHint
        );

        return troveId;
    }

    function _openTrove(
        ContractsCacheTMAPBT memory contractsCache,
        address _owner,
        uint256 _ownerIndex,
        uint256 _ETHAmount,
        uint256 _boldAmount,
        uint256 _annualInterestRate,
        address _interestBatchManager,
        uint256 _batchEntireDebt,
        uint256 _batchManagementFee,
        uint256 _maxUpfrontFee,
        TroveChange memory _troveChange
    ) internal returns (uint256) {
        LocalVariables_openTrove memory vars;

        vars.price = priceFeed.fetchPrice();

        // --- Checks ---

        _requireNotBelowCriticalThreshold(vars.price);

        uint256 troveId = uint256(keccak256(abi.encode(_owner, _ownerIndex)));
        _requireTroveIsNotOpen(contractsCache.troveManager, troveId);

        _troveChange.collIncrease = _ETHAmount;
        _troveChange.debtIncrease = _boldAmount + BOLD_GAS_COMPENSATION;

        // For simplicity, we ignore the fee when calculating the approx. interest rate
        _troveChange.newWeightedRecordedDebt = _troveChange.debtIncrease * _annualInterestRate;

        vars.avgInterestRate = contractsCache.activePool.getNewApproxAvgInterestRateFromTroveChange(_troveChange);
        _troveChange.upfrontFee = _calcUpfrontFee(_troveChange.debtIncrease, vars.avgInterestRate);
        _requireUserAcceptsUpfrontFee(_troveChange.upfrontFee, _maxUpfrontFee);

        vars.entireDebt = _troveChange.debtIncrease + _troveChange.upfrontFee;
        _requireAtLeastMinDebt(vars.entireDebt);

        // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee, and the batch fee if needed
        if (_interestBatchManager == address(0)) {
            _troveChange.newWeightedRecordedDebt = vars.entireDebt * _annualInterestRate;
        } else {
            // old values have been set outside, before calling this function
            _troveChange.newWeightedRecordedDebt = (_batchEntireDebt + vars.entireDebt) * _annualInterestRate;
            _troveChange.newWeightedRecordedBatchManagementFee = (_batchEntireDebt + vars.entireDebt) * _batchManagementFee;
        }

        // ICR is based on the composite debt, i.e. the requested Bold amount + Bold gas comp + upfront fee.
        vars.ICR = LiquityMath._computeCR(_ETHAmount, vars.entireDebt, vars.price);
        _requireICRisAboveMCR(vars.ICR);

        vars.newTCR = _getNewTCRFromTroveChange(_troveChange, vars.price);
        _requireNewTCRisAboveCCR(vars.newTCR);

        // --- Effects & interactions ---

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(_troveChange, _interestBatchManager);

        // Pull ETH tokens from sender and move them to the Active Pool
        _pullETHAndSendToActivePool(contractsCache.activePool, _ETHAmount);

        // Mint the requested _boldAmount to the borrower and mint the gas comp to the GasPool
        contractsCache.boldToken.mint(msg.sender, _boldAmount);
        contractsCache.boldToken.mint(gasPoolAddress, BOLD_GAS_COMPENSATION);

        return troveId;
    }

    // Send ETH as collateral to a trove
    function addColl(uint256 _troveId, uint256 _ETHAmount) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);

        TroveChange memory troveChange;
        troveChange.collIncrease = _ETHAmount;

        _adjustTrove(
            contractsCache,
            _troveId,
            troveChange,
            0 // _maxUpfrontFee
        );
    }

    // Withdraw ETH collateral from a trove
    function withdrawColl(uint256 _troveId, uint256 _collWithdrawal) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);

        TroveChange memory troveChange;
        troveChange.collDecrease = _collWithdrawal;

        _adjustTrove(
            contractsCache,
            _troveId,
            troveChange,
            0 // _maxUpfrontFee
        );
    }

    // Withdraw Bold tokens from a trove: mint new Bold tokens to the owner, and increase the trove's debt accordingly
    function withdrawBold(uint256 _troveId, uint256 _boldAmount, uint256 _maxUpfrontFee) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);

        TroveChange memory troveChange;
        troveChange.debtIncrease = _boldAmount;
        _adjustTrove(contractsCache, _troveId, troveChange, _maxUpfrontFee);
    }

    // Repay Bold tokens to a Trove: Burn the repaid Bold tokens, and reduce the trove's debt accordingly
    function repayBold(uint256 _troveId, uint256 _boldAmount) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);

        TroveChange memory troveChange;
        troveChange.debtDecrease = _boldAmount;

        _adjustTrove(
            contractsCache,
            _troveId,
            troveChange,
            0 // _maxUpfrontFee
        );
    }

    function _initTroveChange(
        TroveChange memory _troveChange,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease
    ) internal pure {
        if (_isCollIncrease) {
            _troveChange.collIncrease = _collChange;
        } else {
            _troveChange.collDecrease = _collChange;
        }

        if (_isDebtIncrease) {
            _troveChange.debtIncrease = _boldChange;
        } else {
            _troveChange.debtDecrease = _boldChange;
        }
    }

    function adjustTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _maxUpfrontFee
    ) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);

        TroveChange memory troveChange;
        _initTroveChange(troveChange, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease);
        _adjustTrove(contractsCache, _troveId, troveChange, _maxUpfrontFee);
    }

    function adjustUnredeemableTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsUnredeemable(contractsCache.troveManager, _troveId);

        TroveChange memory troveChange;
        _initTroveChange(troveChange, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease);
        _adjustTrove(contractsCache, _troveId, troveChange, _maxUpfrontFee);

        contractsCache.troveManager.setTroveStatusToActive(_troveId);

        // If it was in a batch, we need to put it back, otherwise we insert it normally
        address batchManager = interestBatchManagerOf[_troveId];
        if (batchManager == address(0)) {
            sortedTroves.insert(
                _troveId, contractsCache.troveManager.getTroveAnnualInterestRate(_troveId), _upperHint, _lowerHint
            );
        } else {
            LatestBatchData memory batch = contractsCache.troveManager.getLatestBatchData(batchManager);
            sortedTroves.insertIntoBatch(
                _troveId, BatchId.wrap(batchManager), batch.annualInterestRate, _upperHint, _lowerHint
            );
        }
    }

    function adjustTroveInterestRate(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external {
        ContractsCacheTMAP memory contractsCache = ContractsCacheTMAP(troveManager, activePool);

        _requireValidAnnualInterestRate(_newAnnualInterestRate);
        _requireIsNotInBatch(_troveId);
        address owner = contractsCache.troveManager.ownerOf(_troveId);
        _requireSenderIsOwnerOrInterestManager(_troveId, owner);
        _requireInterestRateInDelegateRange(_troveId, _newAnnualInterestRate);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);

        LatestTroveData memory trove = contractsCache.troveManager.getLatestTroveData(_troveId);

        uint256 newDebt = trove.entireDebt;

        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        troveChange.appliedRedistETHGain = trove.redistETHGain;
        troveChange.newWeightedRecordedDebt = newDebt * _newAnnualInterestRate;
        troveChange.oldWeightedRecordedDebt = trove.weightedRecordedDebt;

        // Apply upfront fee on premature adjustments
        // TODO: Does it make sense to allow adjusting to the same interest?
        if (
            trove.annualInterestRate != _newAnnualInterestRate
            && block.timestamp < trove.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN
        ) {
            newDebt = _applyUpfrontFee(trove.entireColl, newDebt, troveChange, _maxUpfrontFee);
        }

        // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
        troveChange.newWeightedRecordedDebt = newDebt * _newAnnualInterestRate;

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(troveChange, address(0));

        //TODO: emit TroveUpdated(_troveId, trove.entireColl, newDebt, Operation.adjustTroveInterestRate);

        contractsCache.troveManager.onAdjustTroveInterestRate(
            _troveId, trove.entireColl, newDebt, _newAnnualInterestRate, troveChange
        );

        sortedTroves.reInsert(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint);
    }

    /*
    * _adjustTrove(): Alongside a debt change, this function can perform either a collateral top-up or a collateral withdrawal.
    */
    function _adjustTrove(
        ContractsCacheTMAPBT memory _contractsCache,
        uint256 _troveId,
        TroveChange memory _troveChange,
        uint256 _maxUpfrontFee
    ) internal {
        LocalVariables_adjustTrove memory vars;

        vars.price = priceFeed.fetchPrice();
        vars.isBelowCriticalThreshold = _checkBelowCriticalThreshold(vars.price);

        // --- Checks ---

        _requireNonZeroAdjustment(_troveChange);
        _requireTroveIsOpen(_contractsCache.troveManager, _troveId);

        address owner = _contractsCache.troveManager.ownerOf(_troveId);

        if (_troveChange.collDecrease > 0 || _troveChange.debtIncrease > 0) {
            _requireSenderIsOwnerOrRemoveManager(_troveId, owner);
        }

        if (_troveChange.collIncrease > 0 || _troveChange.debtDecrease > 0) {
            _requireSenderIsOwnerOrAddManager(_troveId, owner);
        }

        vars.trove = _contractsCache.troveManager.getLatestTroveData(_troveId);

        // When the adjustment is a debt repayment, check it's a valid amount and that the caller has enough Bold
        if (_troveChange.debtDecrease > 0) {
            _requireValidBoldRepayment(vars.trove.entireDebt, _troveChange.debtDecrease);
            _requireSufficientBoldBalance(_contractsCache.boldToken, msg.sender, _troveChange.debtDecrease);
        }

        // When the adjustment is a collateral withdrawal, check that it's no more than the Trove's entire collateral
        if (_troveChange.collDecrease > 0) {
            _requireValidCollWithdrawal(vars.trove.entireColl, _troveChange.collDecrease);
        }

        vars.newColl = vars.trove.entireColl + _troveChange.collIncrease - _troveChange.collDecrease;
        vars.newDebt = vars.trove.entireDebt + _troveChange.debtIncrease - _troveChange.debtDecrease;

        address batchManager = interestBatchManagerOf[_troveId];
        bool isTroveInBatch = batchManager != address(0);
        LatestBatchData memory batch;
        uint256 batchFutureDebt;
        if (isTroveInBatch) {
            // TODO: gas, we already did this in getLatestTroveData(_troveId) above
            batch = _contractsCache.troveManager.getLatestBatchData(batchManager);

            batchFutureDebt = batch.entireDebtWithoutRedistribution + _troveChange.debtIncrease - _troveChange.debtDecrease;

            // TODO: comment
            _troveChange.appliedRedistBoldDebtGain = vars.trove.redistBoldDebtGain;
            _troveChange.appliedRedistETHGain = vars.trove.redistETHGain;
            _troveChange.batchAccruedManagementFee = batch.accruedManagementFee;
            _troveChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
            _troveChange.newWeightedRecordedDebt = batchFutureDebt * batch.annualInterestRate;
            _troveChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
            _troveChange.newWeightedRecordedBatchManagementFee = batchFutureDebt * batch.annualManagementFee;
        } else {
            _troveChange.appliedRedistBoldDebtGain = vars.trove.redistBoldDebtGain;
            _troveChange.appliedRedistETHGain = vars.trove.redistETHGain;
            _troveChange.oldWeightedRecordedDebt = vars.trove.weightedRecordedDebt;
            _troveChange.newWeightedRecordedDebt = vars.newDebt * vars.trove.annualInterestRate;
        }

        // Pay an upfront fee on debt increases
        if (_troveChange.debtIncrease > 0) {
            uint256 avgInterestRate =
                _contractsCache.activePool.getNewApproxAvgInterestRateFromTroveChange(_troveChange);
            _troveChange.upfrontFee = _calcUpfrontFee(_troveChange.debtIncrease, avgInterestRate);
            _requireUserAcceptsUpfrontFee(_troveChange.upfrontFee, _maxUpfrontFee);

            vars.newDebt += _troveChange.upfrontFee;
            if (isTroveInBatch) {
                batch.entireDebtWithoutRedistribution += _troveChange.upfrontFee;
                batchFutureDebt += _troveChange.upfrontFee;
                // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
                _troveChange.newWeightedRecordedDebt = batchFutureDebt * batch.annualInterestRate;
                _troveChange.newWeightedRecordedBatchManagementFee = batchFutureDebt * batch.annualManagementFee;
            } else {
                // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
                _troveChange.newWeightedRecordedDebt = vars.newDebt * vars.trove.annualInterestRate;
            }
        }

        // Make sure the Trove doesn't become unredeemable
        _requireAtLeastMinDebt(vars.newDebt);

        vars.newICR = LiquityMath._computeCR(vars.newColl, vars.newDebt, vars.price);

        // Check the adjustment satisfies all conditions for the current system mode
        _requireValidAdjustmentInCurrentMode(_troveChange, vars);

        // --- Effects and interactions ---

        if (isTroveInBatch) {
            _contractsCache.troveManager.onAdjustTroveInsideBatch(
                _troveId, vars.newColl, _troveChange, batchManager, batch.entireCollWithoutRedistribution, batch.entireDebtWithoutRedistribution
            );
        } else {
            _contractsCache.troveManager.onAdjustTrove(_troveId, vars.newColl, vars.newDebt, _troveChange);
        }

        _contractsCache.activePool.mintAggInterestAndAccountForTroveChange(_troveChange, batchManager);
        _moveTokensAndETHfromAdjustment(owner, _troveChange, _contractsCache);
    }

    function closeTrove(uint256 _troveId) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);

        _requireCallerIsBorrower(contractsCache.troveManager, _troveId);
        _requireTroveIsOpen(contractsCache.troveManager, _troveId);

        LatestTroveData memory trove = contractsCache.troveManager.getLatestTroveData(_troveId);

        // The borrower must repay their entire debt including accrued interest, batch fee and redist. gains (and less the gas comp.)
        _requireSufficientBoldBalance(contractsCache.boldToken, msg.sender, trove.entireDebt - BOLD_GAS_COMPENSATION);

        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        troveChange.appliedRedistETHGain = trove.redistETHGain;
        troveChange.collDecrease = trove.entireColl;
        troveChange.debtDecrease = trove.entireDebt;
        troveChange.oldWeightedRecordedDebt = trove.weightedRecordedDebt;

        address batchManager = interestBatchManagerOf[_troveId];
        bool isTroveInBatch = batchManager != address(0);
        LatestBatchData memory batch;
        if (isTroveInBatch) {
            batch = contractsCache.troveManager.getLatestBatchData(batchManager);
            troveChange.batchAccruedManagementFee = batch.accruedManagementFee;
            troveChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
            troveChange.newWeightedRecordedBatchManagementFee = (batch.entireDebtWithoutRedistribution - trove.entireDebt) * batch.annualManagementFee;
        }

        uint256 price = priceFeed.fetchPrice();
        uint256 newTCR = _getNewTCRFromTroveChange(troveChange, price);
        _requireNewTCRisAboveCCR(newTCR);

        contractsCache.troveManager.onCloseTrove(_troveId, troveChange, batchManager, batch.entireCollWithoutRedistribution, batch.entireDebtWithoutRedistribution);

        // If trove is in batch
        if (isTroveInBatch) {
            // Unlink here in BorrowerOperations
            interestBatchManagerOf[_troveId] = address(0);
        }

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(troveChange, batchManager);

        // Burn the 200 BOLD gas compensation
        contractsCache.boldToken.burn(gasPoolAddress, BOLD_GAS_COMPENSATION);
        // Burn the remainder of the Trove's entire debt from the user
        contractsCache.boldToken.burn(msg.sender, trove.entireDebt - BOLD_GAS_COMPENSATION);

        // Send the collateral back to the user
        contractsCache.activePool.sendETH(msg.sender, trove.entireColl);
    }

    function applyTroveInterestPermissionless(uint256 _troveId) external {
        ContractsCacheTMAP memory contractsCache = ContractsCacheTMAP(troveManager, activePool);

        _requireTroveIsStale(contractsCache.troveManager, _troveId);
        _requireTroveIsOpen(contractsCache.troveManager, _troveId);
        _requireIsNotInBatch(_troveId);

        LatestTroveData memory trove = contractsCache.troveManager.getLatestTroveData(_troveId);
        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        troveChange.appliedRedistETHGain = trove.redistETHGain;
        troveChange.oldWeightedRecordedDebt = trove.weightedRecordedDebt;
        troveChange.newWeightedRecordedDebt = trove.entireDebt * trove.annualInterestRate;

        contractsCache.troveManager.onApplyTroveInterest(_troveId, trove.entireColl, trove.entireDebt, troveChange);
        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(troveChange, address(0));
    }

    function applyBatchInterestAndFeePermissionless(address _batchManager) external {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        LatestBatchData memory batch = contractsCache.troveManager.getLatestBatchData(_batchManager);

        TroveChange memory batchChange;
        batchChange.batchAccruedManagementFee = batch.accruedManagementFee;
        batchChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
        batchChange.newWeightedRecordedDebt = batch.entireDebtWithoutRedistribution * batch.annualInterestRate;
        batchChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
        batchChange.newWeightedRecordedBatchManagementFee = batch.entireDebtWithoutRedistribution * batch.annualManagementFee;

        contractsCache.troveManager.onApplyBatchInterestAndFee(_batchManager, batch.entireCollWithoutRedistribution, batch.entireDebtWithoutRedistribution);

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(batchChange, _batchManager);

        // TODO: emit TroveUpdated(_troveId, trove.entireColl, trove.entireDebt, Operation.applyTroveInterestPermissionless);
    }

    function setAddManager(uint256 _troveId, address _manager) external {
        _requireSenderIsOwner(troveManager, _troveId);
        addManagerOf[_troveId] = _manager;
    }

    function setRemoveManager(uint256 _troveId, address _manager) external {
        _requireSenderIsOwner(troveManager, _troveId);
        removeManagerOf[_troveId] = _manager;
    }

    function getInterestIndividualDelegateOf(uint256 _troveId)
        external
        view
        returns (InterestIndividualDelegate memory)
    {
        return interestIndividualDelegateOf[_troveId];
    }

    function setInterestIndividualDelegate(
        uint256 _troveId,
        address _delegate,
        uint128 _minInterestRate,
        uint128 _maxInterestRate,
        // only needed if trove was previously in a batch:
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external {
        _requireSenderIsOwner(troveManager, _troveId);
        interestIndividualDelegateOf[_troveId] =
            InterestIndividualDelegate(_delegate, _minInterestRate, _maxInterestRate);
        // Can’t have both individual delegation and batch manager
        if (interestBatchManagerOf[_troveId] != address(0)) {
            removeFromBatch(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint, _maxUpfrontFee);
        }
    }

    function removeInterestIndividualDelegate(uint256 _troveId) external {
        _requireSenderIsOwner(troveManager, _troveId); // TODO: should we also allow delegate?
        delete interestIndividualDelegateOf[_troveId];
    }

    function getInterestBatchManager(address _account) external view returns (InterestBatchManager memory) {
        return interestBatchManagers[_account];
    }

    function registerBatchManager(
        uint128 minInterestRate,
        uint128 maxInterestRate,
        uint128 currentInterestRate,
        uint128 annualManagementFee,
        uint128 minInterestRateChangePeriod
    ) external {
        _requireNonExistentInterestBatchManager(msg.sender);
        interestBatchManagers[msg.sender] =
            InterestBatchManager(minInterestRate, maxInterestRate, minInterestRateChangePeriod);
        troveManager.onRegisterBatchManager(msg.sender, currentInterestRate, annualManagementFee);
    }

    // TODO: Unregister??

    function lowerBatchManagementFee(uint256 _newAnnualManagementFee) external {
        _requireValidInterestBatchManager(msg.sender);
        ContractsCacheTMAP memory contractsCache = ContractsCacheTMAP(troveManager, activePool);
        LatestBatchData memory batch = contractsCache.troveManager.getLatestBatchData(msg.sender);
        require(_newAnnualManagementFee < batch.annualManagementFee, "BO: New fee should be lower");

        // Lower batch fee on TM
        contractsCache.troveManager.onLowerBatchManagerAnnualFee(
            msg.sender, batch.entireCollWithoutRedistribution, batch.entireDebtWithoutRedistribution, _newAnnualManagementFee
        );

        // active pool mint
        TroveChange memory batchChange;
        batchChange.batchAccruedManagementFee = batch.accruedManagementFee;
        batchChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
        batchChange.newWeightedRecordedDebt = batch.entireDebtWithoutRedistribution * batch.annualInterestRate;
        batchChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
        batchChange.newWeightedRecordedBatchManagementFee = batch.entireDebtWithoutRedistribution * batch.annualManagementFee;

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(batchChange, msg.sender);
    }

    function setBatchManagerAnnualInterestRate(
        uint128 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external {
        _requireValidInterestBatchManager(msg.sender);
        _requireValidAnnualInterestRate(_newAnnualInterestRate);
        _requireInterestRateInBatchManagerRange(msg.sender, _newAnnualInterestRate);

        ContractsCacheTMAP memory contractsCache = ContractsCacheTMAP(troveManager, activePool);
        LatestBatchData memory batch = contractsCache.troveManager.getLatestBatchData(msg.sender);
        _requireInterestRateChangePeriodPassed(msg.sender, uint256(batch.lastInterestRateAdjTime));

        bool batchWasEmpty = batch.entireDebtWithoutRedistribution == 0 && batch.entireCollWithoutRedistribution == 0;
        uint256 newDebt = batch.entireDebtWithoutRedistribution;

        TroveChange memory batchChange;
        batchChange.batchAccruedManagementFee = batch.accruedManagementFee;
        batchChange.newWeightedRecordedDebt = newDebt * _newAnnualInterestRate;
        batchChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
        batchChange.newWeightedRecordedBatchManagementFee = newDebt * _newAnnualInterestRate;
        batchChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;

        // Apply upfront fee on premature adjustments
        // TODO: Does it make sense to allow adjusting to the same interest?
        if (
            batch.annualInterestRate != _newAnnualInterestRate
                && block.timestamp < batch.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN
        ) {
            // TODO: should we fetch unconditionally? Would make the TX a bit more expensive for well-behaved users, but
            // it would be more consistent with other functions (fetching the price is the first thing we usually do).
            uint256 price = priceFeed.fetchPrice();

            uint256 avgInterestRate = activePool.getNewApproxAvgInterestRateFromTroveChange(batchChange);
            batchChange.upfrontFee = _calcUpfrontFee(newDebt, avgInterestRate);
            _requireUserAcceptsUpfrontFee(batchChange.upfrontFee, _maxUpfrontFee);

            newDebt += batchChange.upfrontFee;

            // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
            batchChange.newWeightedRecordedDebt = newDebt * _newAnnualInterestRate;

            // Disallow a premature adjustment if it would result in TCR < CCR
            // (which includes the case when TCR is already below CCR before the adjustment).
            uint256 newTCR = _getNewTCRFromTroveChange(batchChange, price);
            _requireNewTCRisAboveCCR(newTCR);
        }

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(batchChange, msg.sender);

        // TODO emit BatchUpdated(msg.sender, batch.entireCollWithoutRedistribution, newDebt, Operation.adjustBatchInterestRate);

        contractsCache.troveManager.onSetBatchManagerAnnualInterestRate(
            msg.sender, batch.entireCollWithoutRedistribution, newDebt, _newAnnualInterestRate
        );

        // Check batch is not empty, and then reinsert in sorted list
        if (!batchWasEmpty) {
            sortedTroves.reInsertBatch(BatchId.wrap(msg.sender), _newAnnualInterestRate, _upperHint, _lowerHint);
        }
    }

    // TODO: change fee?

    function setInterestBatchManager(
        uint256 _troveId,
        address _newBatchManager,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external {
        _requireSenderIsOwner(troveManager, _troveId);
        _requireValidInterestBatchManager(_newBatchManager);
        LocalVariables_setInterestBatchManager memory vars;
        vars.oldBatchManager = interestBatchManagerOf[_troveId];
        _requireNewInterestBatchManager(vars.oldBatchManager, _newBatchManager); // TODO: Is this worth?

        interestBatchManagerOf[_troveId] = _newBatchManager;
        // Can’t have both individual delegation and batch manager
        if (interestIndividualDelegateOf[_troveId].account != address(0)) delete interestIndividualDelegateOf[_troveId];

        ContractsCacheTMAPBTST memory contractsCache =
            ContractsCacheTMAPBTST(troveManager, activePool, boldToken, sortedTroves);

        vars.trove = contractsCache.troveManager.getLatestTroveData(_troveId);
        bool isTroveInBatch = vars.oldBatchManager != address(0);
        // Take care of batch fee accountancy in Active Pool
        if (isTroveInBatch) {
            vars.oldBatch = contractsCache.troveManager.getLatestBatchData(vars.oldBatchManager);
            TroveChange memory oldBatchTroveChange;
            oldBatchTroveChange.oldWeightedRecordedBatchManagementFee = vars.oldBatch.weightedRecordedBatchManagementFee;
            oldBatchTroveChange.newWeightedRecordedBatchManagementFee = (vars.oldBatch.entireDebtWithoutRedistribution - vars.trove.entireDebt) * vars.oldBatch.annualManagementFee;
            oldBatchTroveChange.batchAccruedManagementFee = vars.oldBatch.accruedManagementFee;
            contractsCache.activePool.mintBatchManagementFeeAndAccountForChange(oldBatchTroveChange, vars.oldBatchManager);
        }
        vars.newBatch = contractsCache.troveManager.getLatestBatchData(_newBatchManager);

        TroveChange memory newBatchTroveChange;
        newBatchTroveChange.appliedRedistBoldDebtGain = vars.trove.redistBoldDebtGain;
        newBatchTroveChange.appliedRedistETHGain = vars.trove.redistETHGain;
        newBatchTroveChange.batchAccruedManagementFee = vars.newBatch.accruedManagementFee;
        if (isTroveInBatch) {
            newBatchTroveChange.oldWeightedRecordedDebt = vars.oldBatch.weightedRecordedDebt + vars.newBatch.weightedRecordedDebt;
            newBatchTroveChange.newWeightedRecordedDebt =
                (vars.oldBatch.entireDebtWithoutRedistribution - vars.trove.entireDebt) * vars.oldBatch.annualInterestRate +
                (vars.newBatch.entireDebtWithoutRedistribution + vars.trove.entireDebt) * vars.newBatch.annualInterestRate;
        } else {
            newBatchTroveChange.oldWeightedRecordedDebt = vars.trove.weightedRecordedDebt + vars.newBatch.weightedRecordedDebt;
            newBatchTroveChange.newWeightedRecordedDebt =
                (vars.newBatch.entireDebtWithoutRedistribution + vars.trove.entireDebt) * vars.newBatch.annualInterestRate;
        }

        // TODO: We may check the old rate to see if it’s different than the new one, but then we should check the
        // last interest adjustment times to avoid gaming. So we decided to keep it simple and account it always
        // as a change. It’s probably not so common to join a batch with the exact same interest rate.
        // Apply upfront fee on premature adjustments
        if (
            block.timestamp < vars.trove.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN
        ) {
            vars.trove.entireDebt = _applyUpfrontFee(vars.trove.entireColl, vars.trove.entireDebt, newBatchTroveChange, _maxUpfrontFee);
        }

        // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
        if (isTroveInBatch) {
            newBatchTroveChange.newWeightedRecordedDebt =
                // Now the trove would include the upfront fee, we need to subtract it from trove entire debt for he old batch
                (vars.oldBatch.entireDebtWithoutRedistribution + newBatchTroveChange.upfrontFee - vars.trove.entireDebt) * vars.oldBatch.annualInterestRate +
                (vars.newBatch.entireDebtWithoutRedistribution + vars.trove.entireDebt) * vars.newBatch.annualInterestRate;
        } else {
            newBatchTroveChange.newWeightedRecordedDebt =
                (vars.newBatch.entireDebtWithoutRedistribution + vars.trove.entireDebt) * vars.newBatch.annualInterestRate;
        }

        // Add batch fees
        newBatchTroveChange.oldWeightedRecordedBatchManagementFee = vars.newBatch.weightedRecordedBatchManagementFee;
        newBatchTroveChange.newWeightedRecordedBatchManagementFee = (vars.newBatch.entireDebtWithoutRedistribution + vars.trove.entireDebt) * vars.newBatch.annualManagementFee;
        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(newBatchTroveChange, _newBatchManager);

        // TODO emit TroveUpdated(_troveId, trove.entireColl, newDebt, Operation.adjustTroveInterestRate);

        contractsCache.troveManager.onSetInterestBatchManager(
            _troveId,
            vars.trove.entireColl,
            vars.trove.entireDebt,
            newBatchTroveChange,
            vars.oldBatchManager,
            _newBatchManager,
            vars.oldBatch.entireCollWithoutRedistribution,
            vars.oldBatch.entireDebtWithoutRedistribution,
            vars.newBatch.entireCollWithoutRedistribution,
            vars.newBatch.entireDebtWithoutRedistribution
        );

        if (isTroveInBatch) {
            contractsCache.sortedTroves.removeFromBatch(_troveId);
        } else {
            contractsCache.sortedTroves.remove(_troveId);
        }
        contractsCache.sortedTroves.insertIntoBatch(
            _troveId, BatchId.wrap(_newBatchManager), vars.newBatch.annualInterestRate, _upperHint, _lowerHint
        );
    }

    function removeFromBatch(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) public override {
        ContractsCacheTMAPBTST memory contractsCache =
            ContractsCacheTMAPBTST(troveManager, activePool, boldToken, sortedTroves);
        _requireSenderIsOwner(contractsCache.troveManager, _troveId);

        LocalVariables_removeFromBatch memory vars;

        vars.batchManager = interestBatchManagerOf[_troveId];
        delete interestBatchManagerOf[_troveId];

        // Remove trove from Batch in SortedTroves
        contractsCache.sortedTroves.removeFromBatch(_troveId);
        contractsCache.sortedTroves.insert(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint);

        // TODO: gas: we are actually calling getLatestBatchData twice here
        vars.trove = contractsCache.troveManager.getLatestTroveData(_troveId);
        vars.batch = contractsCache.troveManager.getLatestBatchData(vars.batchManager);

        TroveChange memory batchChange;
        batchChange.appliedRedistBoldDebtGain = vars.trove.redistBoldDebtGain;
        batchChange.appliedRedistETHGain = vars.trove.redistETHGain;
        batchChange.batchAccruedManagementFee = vars.batch.accruedManagementFee;
        batchChange.oldWeightedRecordedDebt = vars.batch.weightedRecordedDebt;
        batchChange.newWeightedRecordedDebt = (vars.batch.entireDebtWithoutRedistribution - vars.trove.entireDebt) * vars.batch.annualInterestRate + vars.trove.entireDebt * _newAnnualInterestRate;

        // Apply upfront fee on premature adjustments
        if (
            vars.batch.annualInterestRate != _newAnnualInterestRate
            && block.timestamp < vars.batch.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN
        ) {
            vars.trove.entireDebt = _applyUpfrontFee(vars.trove.entireColl, vars.trove.entireDebt, batchChange, _maxUpfrontFee);
        }

        // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
        vars.newBatchDebt = vars.batch.entireDebtWithoutRedistribution + batchChange.upfrontFee - vars.trove.entireDebt;
        batchChange.newWeightedRecordedDebt = vars.newBatchDebt * vars.batch.annualInterestRate + vars.trove.entireDebt * _newAnnualInterestRate;
        // Add batch fees
        batchChange.oldWeightedRecordedBatchManagementFee = vars.batch.weightedRecordedBatchManagementFee;
        batchChange.newWeightedRecordedBatchManagementFee = vars.newBatchDebt * vars.batch.annualManagementFee;

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(batchChange, vars.batchManager);

        // TODO emit TroveUpdated(_troveId, vars.trove.entireColl, vars.trove.entireDebt, Operation.adjustTroveInterestRate);

        contractsCache.troveManager.onRemoveFromBatch(
            _troveId,
            vars.trove.entireColl,
            vars.trove.entireDebt,
            batchChange,
            vars.batchManager,
            vars.batch.entireCollWithoutRedistribution,
            vars.batch.entireDebtWithoutRedistribution,
            _newAnnualInterestRate
        );
    }

    function _applyUpfrontFee(uint256 _troveEntireColl, uint256 _troveEntireDebt, TroveChange memory _troveChange, uint256 _maxUpfrontFee) internal returns (uint256) {
        // TODO: should we fetch unconditionally? Would make the TX a bit more expensive for well-behaved users, but
        // it would be more consistent with other functions (fetching the price is the first thing we usually do).
        uint256 price = priceFeed.fetchPrice();

        uint256 avgInterestRate = activePool.getNewApproxAvgInterestRateFromTroveChange(_troveChange);
        _troveChange.upfrontFee = _calcUpfrontFee(_troveEntireDebt, avgInterestRate);
        _requireUserAcceptsUpfrontFee(_troveChange.upfrontFee, _maxUpfrontFee);

        _troveEntireDebt += _troveChange.upfrontFee;

        // ICR is based on the composite debt, i.e. the requested Bold amount + Bold gas comp + upfront fee.
        uint256 newICR = LiquityMath._computeCR(_troveEntireColl, _troveEntireDebt, price);
        _requireICRisAboveMCR(newICR);

        // Disallow a premature adjustment if it would result in TCR < CCR
        // (which includes the case when TCR is already below CCR before the adjustment).
        uint256 newTCR = _getNewTCRFromTroveChange(_troveChange, price);
        _requireNewTCRisAboveCCR(newTCR);

        return _troveEntireDebt;
    }

    /**
     * Claim remaining collateral from a liquidation with ICR exceeding the liquidation penalty
     */
    function claimCollateral() external override {
        // send ETH from CollSurplus Pool to owner
        collSurplusPool.claimColl(msg.sender);
    }

    // --- Helper functions ---

    // This function mints the BOLD corresponding to the borrower's chosen debt increase
    // (it does not mint the accrued interest).
    function _moveTokensAndETHfromAdjustment(
        address withdrawalReceiver,
        TroveChange memory _troveChange,
        ContractsCacheTMAPBT memory _contractsCache
    ) internal {
        if (_troveChange.debtIncrease > 0) {
            _contractsCache.boldToken.mint(withdrawalReceiver, _troveChange.debtIncrease);
        } else if (_troveChange.debtDecrease > 0) {
            _contractsCache.boldToken.burn(msg.sender, _troveChange.debtDecrease);
        }

        if (_troveChange.collIncrease > 0) {
            // Pull ETH tokens from sender and move them to the Active Pool
            _pullETHAndSendToActivePool(_contractsCache.activePool, _troveChange.collIncrease);
        } else if (_troveChange.collDecrease > 0) {
            // Pull ETH from Active Pool and decrease its recorded ETH balance
            _contractsCache.activePool.sendETH(withdrawalReceiver, _troveChange.collDecrease);
        }
    }

    function _pullETHAndSendToActivePool(IActivePool _activePool, uint256 _amount) internal {
        // Send ETH tokens from sender to active pool
        ETH.safeTransferFrom(msg.sender, address(_activePool), _amount);
        // Make sure Active Pool accountancy is right
        _activePool.accountForReceivedETH(_amount);
    }

    function checkBatchManagerExists(address _batchManager) external view returns (bool) {
        return interestBatchManagers[_batchManager].maxInterestRate > 0;
    }
    // --- 'Require' wrapper functions ---

    function _requireCallerIsBorrower(ITroveManager _troveManager, uint256 _troveId) internal view {
        require(
            msg.sender == _troveManager.ownerOf(_troveId), "BorrowerOps: Caller must be the borrower for a withdrawal"
        );
    }

    function _requireNonZeroAdjustment(TroveChange memory _troveChange) internal pure {
        require(
            _troveChange.collIncrease > 0 || _troveChange.collDecrease > 0 || _troveChange.debtIncrease > 0
                || _troveChange.debtDecrease > 0,
            "BorrowerOps: There must be either a collateral change or a debt change"
        );
    }

    function _requireSenderIsOwner(ITroveManager _troveManager, uint256 _troveId) internal view {
        require(_troveManager.ownerOf(_troveId) == msg.sender, "BorrowerOps: sender is not Trove owner");
    }

    function _requireSenderIsOwnerOrAddManager(uint256 _troveId, address _owner) internal view {
        require(
            msg.sender == _owner || msg.sender == addManagerOf[_troveId],
            "BorrowerOps: sender is neither Trove owner nor add-manager"
        );
    }

    function _requireSenderIsOwnerOrRemoveManager(uint256 _troveId, address _owner) internal view {
        require(
            msg.sender == _owner || msg.sender == removeManagerOf[_troveId],
            "BorrowerOps: sender is neither Trove owner nor remove-manager"
        );
    }

    function _requireSenderIsOwnerOrInterestManager(uint256 _troveId, address _owner) internal view {
        require(
            msg.sender == _owner || msg.sender == interestIndividualDelegateOf[_troveId].account,
            "BorrowerOps: sender is neither Trove owner nor interest manager"
        );
    }

    function _requireIsNotInBatch(uint256 _troveId) internal view {
        require(interestBatchManagerOf[_troveId] == address(0), "BO: Trove is in batch");
    }

    function _requireInterestRateInDelegateRange(uint256 _troveId, uint256 _annualInterestRate) internal view {
        InterestIndividualDelegate memory individualDelegate = interestIndividualDelegateOf[_troveId];
        require(
            individualDelegate.account == address(0)
                || (
                    individualDelegate.minInterestRate <= _annualInterestRate
                        && _annualInterestRate <= individualDelegate.maxInterestRate
                ),
            "BO: interest not in range of individual delegate"
        );
    }

    function _requireInterestRateInBatchManagerRange(address _interestBatchManagerAddress, uint256 _annualInterestRate)
        internal
        view
    {
        InterestBatchManager memory interestBatchManager = interestBatchManagers[_interestBatchManagerAddress];
        require(
            interestBatchManager.minInterestRate <= _annualInterestRate
                && _annualInterestRate <= interestBatchManager.maxInterestRate,
            "BO: interest not in range of batch manager"
        );
    }

    function _requireInterestRateChangePeriodPassed(
        address _interestBatchManagerAddress,
        uint256 _lastInterestRateAdjTime
    ) internal view {
        InterestBatchManager memory interestBatchManager = interestBatchManagers[_interestBatchManagerAddress];
        require(
            block.timestamp >= _lastInterestRateAdjTime + uint256(interestBatchManager.minInterestRateChangePeriod),
            "BO: cannot change interest rate again yet"
        );
    }

    function _requireTroveIsOpen(ITroveManager _troveManager, uint256 _troveId) internal view {
        require(_troveManager.checkTroveIsOpen(_troveId), "BorrowerOps: Trove does not exist or is closed");
    }

    function _requireTroveIsActive(ITroveManager _troveManager, uint256 _troveId) internal view {
        require(_troveManager.checkTroveIsActive(_troveId), "BorrowerOps: Trove does not have active status");
    }

    function _requireTroveIsUnredeemable(ITroveManager _troveManager, uint256 _troveId) internal view {
        require(
            _troveManager.checkTroveIsUnredeemable(_troveId), "BorrowerOps: Trove does not have unredeemable status"
        );
    }

    function _requireTroveIsNotOpen(ITroveManager _troveManager, uint256 _troveId) internal view {
        require(!_troveManager.checkTroveIsOpen(_troveId), "BorrowerOps: Trove is open");
    }

    function _requireUserAcceptsUpfrontFee(uint256 _fee, uint256 _maxFee) internal pure {
        require(_fee <= _maxFee, "BorrowerOps: Upfront fee exceeded provided maximum");
    }

    function _requireNotBelowCriticalThreshold(uint256 _price) internal view {
        require(!_checkBelowCriticalThreshold(_price), "BorrowerOps: Operation not permitted below CT");
    }

    function _requireNoBorrowing(uint256 _debtIncrease) internal pure {
        require(_debtIncrease == 0, "BorrowerOps: Borrowing not permitted below CT");
    }

    function _requireValidAdjustmentInCurrentMode(
        TroveChange memory _troveChange,
        LocalVariables_adjustTrove memory _vars
    ) internal view {
        /*
        * Below Critical Threshold, it is not permitted:
        *
        * - Borrowing
        * - Collateral withdrawal except accompanied by a debt repayment of at least the same value
        *
        * In Normal Mode, ensure:
        *
        * - The adjustment won't pull the TCR below CCR
        *
        * In Both cases:
        * - The new ICR is above MCR
        */
        _requireICRisAboveMCR(_vars.newICR);

        if (_vars.isBelowCriticalThreshold) {
            _requireNoBorrowing(_troveChange.debtIncrease);
            _requireDebtRepaymentGeCollWithdrawal(_troveChange, _vars.price);
        } else {
            // if Normal Mode
            uint256 newTCR = _getNewTCRFromTroveChange(_troveChange, _vars.price);
            _requireNewTCRisAboveCCR(newTCR);
        }
    }

    function _requireICRisAboveMCR(uint256 _newICR) internal view {
        require(_newICR >= MCR, "BorrowerOps: An operation that would result in ICR < MCR is not permitted");
    }

    function _requireDebtRepaymentGeCollWithdrawal(TroveChange memory _troveChange, uint256 _price) internal pure {
        require(
            (_troveChange.debtDecrease >= _troveChange.collDecrease * _price / DECIMAL_PRECISION),
            "BorrowerOps: below CT, repayment must be >= coll withdrawal"
        );
    }

    function _requireNewTCRisAboveCCR(uint256 _newTCR) internal pure {
        require(_newTCR >= CCR, "BorrowerOps: An operation that would result in TCR < CCR is not permitted");
    }

    function _requireAtLeastMinDebt(uint256 _debt) internal pure {
        require(_debt >= MIN_DEBT, "BorrowerOps: Trove's debt must be greater than minimum");
    }

    function _requireValidBoldRepayment(uint256 _currentDebt, uint256 _debtRepayment) internal pure {
        require(
            _debtRepayment <= _currentDebt - BOLD_GAS_COMPENSATION,
            "BorrowerOps: Amount repaid must not be larger than the Trove's debt"
        );
    }

    function _requireValidCollWithdrawal(uint256 _currentColl, uint256 _collWithdrawal) internal pure {
        require(_collWithdrawal <= _currentColl, "BorrowerOps: Can't withdraw more than the Trove's entire collateral");
    }

    function _requireSufficientBoldBalance(IBoldToken _boldToken, address _borrower, uint256 _debtRepayment)
        internal
        view
    {
        require(
            _boldToken.balanceOf(_borrower) >= _debtRepayment,
            "BorrowerOps: Caller doesnt have enough Bold to make repayment"
        );
    }

    function _requireValidAnnualInterestRate(uint256 _annualInterestRate) internal pure {
        require(_annualInterestRate >= MIN_ANNUAL_INTEREST_RATE, "Interest rate must not be lower than min");
        require(_annualInterestRate <= MAX_ANNUAL_INTEREST_RATE, "Interest rate must not be greater than max");
    }

    function _requireValidInterestBatchManager(address _interestBatchManagerAddress) internal view {
        require(interestBatchManagers[_interestBatchManagerAddress].maxInterestRate > 0, "BO: Not valid Batch Manager");
    }

    function _requireNonExistentInterestBatchManager(address _interestBatchManagerAddress) internal view {
        require(
            interestBatchManagers[_interestBatchManagerAddress].maxInterestRate == 0, "BO: Batch Manager already exists"
        );
    }

    function _requireNewInterestBatchManager(address _oldBatchManagerAddress, address _newBatchManagerAddress)
        internal
        pure
    {
        require(_oldBatchManagerAddress != _newBatchManagerAddress, "BO: Already has this Batch Manager");
    }

    function _requireTroveIsStale(ITroveManager _troveManager, uint256 _troveId) internal view {
        require(_troveManager.troveIsStale(_troveId), "BO: Trove must be stale");
    }

    // --- ICR and TCR getters ---

    function _getNewTCRFromTroveChange(TroveChange memory _troveChange, uint256 _price)
        internal
        view
        returns (uint256 newTCR)
    {
        uint256 totalColl = getEntireSystemColl();
        totalColl += _troveChange.collIncrease;
        totalColl -= _troveChange.collDecrease;

        uint256 totalDebt = getEntireSystemDebt();
        totalDebt += _troveChange.debtIncrease;
        totalDebt += _troveChange.upfrontFee;
        totalDebt -= _troveChange.debtDecrease;

        newTCR = LiquityMath._computeCR(totalColl, totalDebt, _price);
    }

    function getCompositeDebt(uint256 _debt) external pure override returns (uint256) {
        return _debt + BOLD_GAS_COMPENSATION;
    }
}
