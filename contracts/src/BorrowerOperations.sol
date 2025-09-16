// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

// import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/IAddressesRegistry.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBoldToken.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/AddRemoveManagers.sol";
import "./Types/LatestTroveData.sol";
import "./Types/LatestBatchData.sol";

contract BorrowerOperations is LiquityBase, AddRemoveManagers, IBorrowerOperations {
    // using SafeERC20 for IERC20;

    // --- Connected contract declarations ---
    IAddressesRegistry internal immutable addressesRegistry;
    IERC20 internal immutable collToken;
    ITroveManager internal troveManager;
    address internal gasPoolAddress;
    ICollSurplusPool internal collSurplusPool;
    IBoldToken internal boldToken;
    // A doubly linked list of Troves, sorted by their collateral ratios
    ISortedTroves internal sortedTroves;
    // Wrapped ETH for liquidation reserve (gas compensation)
    IWETH internal immutable WETH;

    bool public hasBeenShutDown;

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

    struct OpenTroveVars {
        ITroveManager troveManager;
        uint256 troveId;
        TroveChange change;
        LatestBatchData batch;
    }

    struct LocalVariables_openTrove {
        ITroveManager troveManager;
        IActivePool activePool;
        IBoldToken boldToken;
        uint256 troveId;
        uint256 price;
        uint256 avgInterestRate;
        uint256 entireDebt;
        uint256 ICR;
        uint256 newTCR;
        bool newOracleFailureDetected;
    }

    struct LocalVariables_adjustTrove {
        IActivePool activePool;
        IBoldToken boldToken;
        LatestTroveData trove;
        uint256 price;
        bool isBelowCriticalThreshold;
        uint256 newICR;
        uint256 newDebt;
        uint256 newColl;
        bool newOracleFailureDetected;
    }

    struct LocalVariables_setInterestBatchManager {
        ITroveManager troveManager;
        IActivePool activePool;
        ISortedTroves sortedTroves;
        address oldBatchManager;
        LatestTroveData trove;
        LatestBatchData oldBatch;
        LatestBatchData newBatch;
    }

    struct LocalVariables_removeFromBatch {
        ITroveManager troveManager;
        ISortedTroves sortedTroves;
        address batchManager;
        LatestTroveData trove;
        LatestBatchData batch;
        uint256 batchFutureDebt;
        TroveChange batchChange;
    }

    error IsShutDown();
    error TCRNotBelowSCR();
    error ZeroAdjustment();
    error NotOwnerNorInterestManager();
    error TroveInBatch();
    error TroveNotInBatch();
    error InterestNotInRange();
    error BatchInterestRateChangePeriodNotPassed();
    error DelegateInterestRateChangePeriodNotPassed();
    error TroveExists();
    error TroveNotOpen();
    error TroveNotActive();
    error TroveNotZombie();
    error TroveWithZeroDebt();
    error UpfrontFeeTooHigh();
    error ICRBelowMCR();
    error ICRBelowMCRPlusBCR();
    error RepaymentNotMatchingCollWithdrawal();
    error TCRBelowCCR();
    error DebtBelowMin();
    error CollWithdrawalTooHigh();
    error NotEnoughBoldBalance();
    error InterestRateTooLow();
    error InterestRateTooHigh();
    error InterestRateNotNew();
    error InvalidInterestBatchManager();
    error BatchManagerExists();
    error BatchManagerNotNew();
    error NewFeeNotLower();
    error CallerNotTroveManager();
    error CallerNotPriceFeed();
    error MinGeMax();
    error AnnualManagementFeeTooHigh();
    error MinInterestRateChangePeriodTooLow();
    error NewOracleFailureDetected();
    error BatchSharesRatioTooLow();

    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event BoldTokenAddressChanged(address _boldTokenAddress);

    event ShutDown(uint256 _tcr);

    constructor(IAddressesRegistry _addressesRegistry)
        AddRemoveManagers(_addressesRegistry)
        LiquityBase(_addressesRegistry)
    {
        // This makes impossible to open a trove with zero withdrawn Bold
        assert(MIN_DEBT > 0);

        addressesRegistry = _addressesRegistry;
        collToken = _addressesRegistry.collToken();

        WETH = _addressesRegistry.WETH();

        troveManager = _addressesRegistry.troveManager();
        gasPoolAddress = _addressesRegistry.gasPoolAddress();
        collSurplusPool = _addressesRegistry.collSurplusPool();
        sortedTroves = _addressesRegistry.sortedTroves();
        boldToken = _addressesRegistry.boldToken();

        emit TroveManagerAddressChanged(address(troveManager));
        emit GasPoolAddressChanged(gasPoolAddress);
        emit CollSurplusPoolAddressChanged(address(collSurplusPool));
        emit SortedTrovesAddressChanged(address(sortedTroves));
        emit BoldTokenAddressChanged(address(boldToken));

        // Allow funds movements between Liquity contracts
        collToken.approve(address(activePool), type(uint256).max);
    }

    // Critical system collateral ratio. If the system's total collateral ratio (TCR) falls below the CCR, some borrowing operation restrictions are applied
    function CCR() public view returns (uint256) {
        return addressesRegistry.CCR();
    }

    // Minimum collateral ratio for individual troves
    function MCR() public view returns (uint256) {
        return addressesRegistry.MCR();
    }

    // Shutdown system collateral ratio. If the system's total collateral ratio (TCR) for a given collateral falls below the SCR,
    // the protocol triggers the shutdown of the borrow market and permanently disables all borrowing operations except for closing Troves.
    function SCR() public view returns (uint256) {
        return addressesRegistry.SCR();
    }

    // Extra buffer of collateral ratio to join a batch or adjust a trove inside a batch (on top of MCR)
    function BCR() public view returns (uint256) {
        return addressesRegistry.BCR();
    }

    // --- Borrower Trove Operations ---

    function openTrove(
        address _owner,
        uint256 _ownerIndex,
        uint256 _collAmount,
        uint256 _boldAmount,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _annualInterestRate,
        uint256 _maxUpfrontFee,
        address _addManager,
        address _removeManager,
        address _receiver
    ) external override returns (uint256) {
        _requireValidAnnualInterestRate(_annualInterestRate);

        OpenTroveVars memory vars;

        vars.troveId = _openTrove(
            _owner,
            _ownerIndex,
            _collAmount,
            _boldAmount,
            _annualInterestRate,
            address(0),
            0,
            0,
            _maxUpfrontFee,
            _addManager,
            _removeManager,
            _receiver,
            vars.change
        );

        // Set the stored Trove properties and mint the NFT
        troveManager.onOpenTrove(_owner, vars.troveId, vars.change, _annualInterestRate);

        sortedTroves.insert(vars.troveId, _annualInterestRate, _upperHint, _lowerHint);

        return vars.troveId;
    }

    function openTroveAndJoinInterestBatchManager(OpenTroveAndJoinInterestBatchManagerParams calldata _params)
        external
        override
        returns (uint256)
    {
        _requireValidInterestBatchManager(_params.interestBatchManager);

        OpenTroveVars memory vars;
        vars.troveManager = troveManager;

        vars.batch = vars.troveManager.getLatestBatchData(_params.interestBatchManager);

        // We set old weighted values here, as it’s only necessary for batches, so we don’t need to pass them to _openTrove func
        vars.change.batchAccruedManagementFee = vars.batch.accruedManagementFee;
        vars.change.oldWeightedRecordedDebt = vars.batch.weightedRecordedDebt;
        vars.change.oldWeightedRecordedBatchManagementFee = vars.batch.weightedRecordedBatchManagementFee;
        vars.troveId = _openTrove(
            _params.owner,
            _params.ownerIndex,
            _params.collAmount,
            _params.boldAmount,
            vars.batch.annualInterestRate,
            _params.interestBatchManager,
            vars.batch.entireDebtWithoutRedistribution,
            vars.batch.annualManagementFee,
            _params.maxUpfrontFee,
            _params.addManager,
            _params.removeManager,
            _params.receiver,
            vars.change
        );

        interestBatchManagerOf[vars.troveId] = _params.interestBatchManager;

        // Set the stored Trove properties and mint the NFT
        vars.troveManager.onOpenTroveAndJoinBatch(
            _params.owner,
            vars.troveId,
            vars.change,
            _params.interestBatchManager,
            vars.batch.entireCollWithoutRedistribution,
            vars.batch.entireDebtWithoutRedistribution
        );

        sortedTroves.insertIntoBatch(
            vars.troveId,
            BatchId.wrap(_params.interestBatchManager),
            vars.batch.annualInterestRate,
            _params.upperHint,
            _params.lowerHint
        );

        return vars.troveId;
    }

    function _openTrove(
        address _owner,
        uint256 _ownerIndex,
        uint256 _collAmount,
        uint256 _boldAmount,
        uint256 _annualInterestRate,
        address _interestBatchManager,
        uint256 _batchEntireDebt,
        uint256 _batchManagementAnnualFee,
        uint256 _maxUpfrontFee,
        address _addManager,
        address _removeManager,
        address _receiver,
        TroveChange memory _change
    ) internal returns (uint256) {
        _requireIsNotShutDown();

        LocalVariables_openTrove memory vars;

        // stack too deep not allowing to reuse troveManager from outer functions
        vars.troveManager = troveManager;
        vars.activePool = activePool;
        vars.boldToken = boldToken;

        vars.price = _requireOraclesLive();

        // --- Checks ---

        vars.troveId = uint256(keccak256(abi.encode(msg.sender, _owner, _ownerIndex)));
        _requireTroveDoesNotExist(vars.troveManager, vars.troveId);

        _change.collIncrease = _collAmount;
        _change.debtIncrease = _boldAmount;

        // For simplicity, we ignore the fee when calculating the approx. interest rate
        _change.newWeightedRecordedDebt = (_batchEntireDebt + _change.debtIncrease) * _annualInterestRate;

        vars.avgInterestRate = vars.activePool.getNewApproxAvgInterestRateFromTroveChange(_change);
        _change.upfrontFee = _calcUpfrontFee(_change.debtIncrease, vars.avgInterestRate);
        _requireUserAcceptsUpfrontFee(_change.upfrontFee, _maxUpfrontFee);

        vars.entireDebt = _change.debtIncrease + _change.upfrontFee;
        require(troveManager.getDebtLimit() >= troveManager.getEntireBranchDebt() + vars.entireDebt, "BorrowerOperations: Debt limit exceeded.");
        _requireAtLeastMinDebt(vars.entireDebt);

        vars.ICR = LiquityMath._computeCR(_collAmount, vars.entireDebt, vars.price);

        // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee, and the batch fee if needed
        if (_interestBatchManager == address(0)) {
            _change.newWeightedRecordedDebt = vars.entireDebt * _annualInterestRate;

            // ICR is based on the requested Bold amount + upfront fee.
            _requireICRisAboveMCR(vars.ICR);
        } else {
            // old values have been set outside, before calling this function
            _change.newWeightedRecordedDebt = (_batchEntireDebt + vars.entireDebt) * _annualInterestRate;
            _change.newWeightedRecordedBatchManagementFee =
                (_batchEntireDebt + vars.entireDebt) * _batchManagementAnnualFee;

            // ICR is based on the requested Bold amount + upfront fee.
            // Troves in a batch have a stronger requirement (MCR+BCR)
            _requireICRisAboveMCRPlusBCR(vars.ICR);
        }

        vars.newTCR = _getNewTCRFromTroveChange(_change, vars.price);
        _requireNewTCRisAboveCCR(vars.newTCR);

        // --- Effects & interactions ---

        // Set add/remove managers
        _setAddManager(vars.troveId, _addManager);
        _setRemoveManagerAndReceiver(vars.troveId, _removeManager, _receiver);

        vars.activePool.mintAggInterestAndAccountForTroveChange(_change, _interestBatchManager);

        // Pull coll tokens from sender and move them to the Active Pool
        _pullCollAndSendToActivePool(vars.activePool, _collAmount);

        // Mint the requested _boldAmount to the borrower and mint the gas comp to the GasPool
        vars.boldToken.mint(msg.sender, _boldAmount);
        WETH.transferFrom(msg.sender, gasPoolAddress, ETH_GAS_COMPENSATION);

        return vars.troveId;
    }

    // Send collateral to a trove
    function addColl(uint256 _troveId, uint256 _collAmount) external override {
        ITroveManager troveManagerCached = troveManager;
        _requireTroveIsActive(troveManagerCached, _troveId);

        TroveChange memory troveChange;
        troveChange.collIncrease = _collAmount;

        _adjustTrove(
            troveManagerCached,
            _troveId,
            troveChange,
            0 // _maxUpfrontFee
        );
    }

    // Withdraw collateral from a trove
    function withdrawColl(uint256 _troveId, uint256 _collWithdrawal) external override {
        ITroveManager troveManagerCached = troveManager;
        _requireTroveIsActive(troveManagerCached, _troveId);

        TroveChange memory troveChange;
        troveChange.collDecrease = _collWithdrawal;

        _adjustTrove(
            troveManagerCached,
            _troveId,
            troveChange,
            0 // _maxUpfrontFee
        );
    }

    // Withdraw Bold tokens from a trove: mint new Bold tokens to the owner, and increase the trove's debt accordingly
    function withdrawBold(uint256 _troveId, uint256 _boldAmount, uint256 _maxUpfrontFee) external override {
        ITroveManager troveManagerCached = troveManager;
        _requireTroveIsActive(troveManagerCached, _troveId);
        require(isBranchActive(), "BorrowerOperations: Branch is not active");
        
        TroveChange memory troveChange;
        troveChange.debtIncrease = _boldAmount;
        _adjustTrove(troveManagerCached, _troveId, troveChange, _maxUpfrontFee);
    }

    // Repay Bold tokens to a Trove: Burn the repaid Bold tokens, and reduce the trove's debt accordingly
    function repayBold(uint256 _troveId, uint256 _boldAmount) external override {
        ITroveManager troveManagerCached = troveManager;
        _requireTroveIsActive(troveManagerCached, _troveId);

        TroveChange memory troveChange;
        troveChange.debtDecrease = _boldAmount;

        _adjustTrove(
            troveManagerCached,
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
        ITroveManager troveManagerCached = troveManager;
        _requireTroveIsActive(troveManagerCached, _troveId);
        require(isBranchActive(), "BorrowerOperations: Branch is not active");

        TroveChange memory troveChange;
        _initTroveChange(troveChange, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease);
        _adjustTrove(troveManagerCached, _troveId, troveChange, _maxUpfrontFee);
    }

    function adjustZombieTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external override {
        ITroveManager troveManagerCached = troveManager;
        _requireTroveIsZombie(troveManagerCached, _troveId);
        require(isBranchActive(), "BorrowerOperations: Branch is not active");

        TroveChange memory troveChange;
        _initTroveChange(troveChange, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease);
        _adjustTrove(troveManagerCached, _troveId, troveChange, _maxUpfrontFee);

        troveManagerCached.setTroveStatusToActive(_troveId);

        address batchManager = interestBatchManagerOf[_troveId];
        uint256 batchAnnualInterestRate;
        if (batchManager != address(0)) {
            LatestBatchData memory batch = troveManagerCached.getLatestBatchData(batchManager);
            batchAnnualInterestRate = batch.annualInterestRate;
        }
        _reInsertIntoSortedTroves(
            _troveId,
            troveManagerCached.getTroveAnnualInterestRate(_troveId),
            _upperHint,
            _lowerHint,
            batchManager,
            batchAnnualInterestRate
        );
    }

    function adjustTroveInterestRate(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external {
        _requireIsNotShutDown();

        ITroveManager troveManagerCached = troveManager;

        _requireValidAnnualInterestRate(_newAnnualInterestRate);
        _requireIsNotInBatch(_troveId);
        _requireSenderIsOwnerOrInterestManager(_troveId);
        _requireTroveIsActive(troveManagerCached, _troveId);

        LatestTroveData memory trove = troveManagerCached.getLatestTroveData(_troveId);
        _requireValidDelegateAdjustment(_troveId, trove.lastInterestRateAdjTime, _newAnnualInterestRate);
        _requireAnnualInterestRateIsNew(trove.annualInterestRate, _newAnnualInterestRate);

        uint256 newDebt = trove.entireDebt;

        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        troveChange.appliedRedistCollGain = trove.redistCollGain;
        troveChange.newWeightedRecordedDebt = newDebt * _newAnnualInterestRate;
        troveChange.oldWeightedRecordedDebt = trove.weightedRecordedDebt;

        // Apply upfront fee on premature adjustments. It checks the resulting ICR
        if (block.timestamp < trove.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN) {
            newDebt = _applyUpfrontFee(trove.entireColl, newDebt, troveChange, _maxUpfrontFee, false);
        }

        // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
        troveChange.newWeightedRecordedDebt = newDebt * _newAnnualInterestRate;

        activePool.mintAggInterestAndAccountForTroveChange(troveChange, address(0));

        sortedTroves.reInsert(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint);
        troveManagerCached.onAdjustTroveInterestRate(
            _troveId, trove.entireColl, newDebt, _newAnnualInterestRate, troveChange
        );
    }

    /*
    * _adjustTrove(): Alongside a debt change, this function can perform either a collateral top-up or a collateral withdrawal.
    */
    function _adjustTrove(
        ITroveManager _troveManager,
        uint256 _troveId,
        TroveChange memory _troveChange,
        uint256 _maxUpfrontFee
    ) internal {
        _requireIsNotShutDown();

        LocalVariables_adjustTrove memory vars;
        vars.activePool = activePool;
        vars.boldToken = boldToken;

        vars.price = _requireOraclesLive();
        vars.isBelowCriticalThreshold = _checkBelowCriticalThreshold(vars.price, CCR());

        // --- Checks ---

        _requireTroveIsOpen(_troveManager, _troveId);

        address owner = troveNFT.ownerOf(_troveId);
        address receiver = owner; // If it’s a withdrawal, and remove manager privilege is set, a different receiver can be defined

        if (_troveChange.collDecrease > 0 || _troveChange.debtIncrease > 0) {
            receiver = _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner);
        } else {
            // RemoveManager assumes AddManager, so if the former is set, there's no need to check the latter
            _requireSenderIsOwnerOrAddManager(_troveId, owner);
            // No need to check the type of trove change for two reasons:
            // - If the check above fails, it means sender is not owner, nor AddManager, nor RemoveManager.
            //   An independent 3rd party should not be allowed here.
            // - If it's not collIncrease or debtDecrease, _requireNonZeroAdjustment would revert
        }

        vars.trove = _troveManager.getLatestTroveData(_troveId);

        // When the adjustment is a debt repayment, check it's a valid amount and that the caller has enough Bold
        if (_troveChange.debtDecrease > 0) {
            uint256 maxRepayment = vars.trove.entireDebt > MIN_DEBT ? vars.trove.entireDebt - MIN_DEBT : 0;
            if (_troveChange.debtDecrease > maxRepayment) {
                _troveChange.debtDecrease = maxRepayment;
            }
            _requireSufficientBoldBalance(vars.boldToken, msg.sender, _troveChange.debtDecrease);
        }

        _requireNonZeroAdjustment(_troveChange);

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
            batch = _troveManager.getLatestBatchData(batchManager);

            batchFutureDebt = batch.entireDebtWithoutRedistribution + vars.trove.redistBoldDebtGain
                + _troveChange.debtIncrease - _troveChange.debtDecrease;

            _troveChange.appliedRedistBoldDebtGain = vars.trove.redistBoldDebtGain;
            _troveChange.appliedRedistCollGain = vars.trove.redistCollGain;
            _troveChange.batchAccruedManagementFee = batch.accruedManagementFee;
            _troveChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
            _troveChange.newWeightedRecordedDebt = batchFutureDebt * batch.annualInterestRate;
            _troveChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
            _troveChange.newWeightedRecordedBatchManagementFee = batchFutureDebt * batch.annualManagementFee;
        } else {
            _troveChange.appliedRedistBoldDebtGain = vars.trove.redistBoldDebtGain;
            _troveChange.appliedRedistCollGain = vars.trove.redistCollGain;
            _troveChange.oldWeightedRecordedDebt = vars.trove.weightedRecordedDebt;
            _troveChange.newWeightedRecordedDebt = vars.newDebt * vars.trove.annualInterestRate;
        }

        // Pay an upfront fee on debt increases
        if (_troveChange.debtIncrease > 0) {
            uint256 avgInterestRate = vars.activePool.getNewApproxAvgInterestRateFromTroveChange(_troveChange);
            _troveChange.upfrontFee = _calcUpfrontFee(_troveChange.debtIncrease, avgInterestRate);
            _requireUserAcceptsUpfrontFee(_troveChange.upfrontFee, _maxUpfrontFee);

            vars.newDebt += _troveChange.upfrontFee;
            if (isTroveInBatch) {
                batchFutureDebt += _troveChange.upfrontFee;
                // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
                _troveChange.newWeightedRecordedDebt = batchFutureDebt * batch.annualInterestRate;
                _troveChange.newWeightedRecordedBatchManagementFee = batchFutureDebt * batch.annualManagementFee;
            } else {
                // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
                _troveChange.newWeightedRecordedDebt = vars.newDebt * vars.trove.annualInterestRate;
            }
        }

        // Make sure the Trove doesn't end up zombie
        // Now the max repayment is capped to stay above MIN_DEBT, so this only applies to adjustZombieTrove
        _requireAtLeastMinDebt(vars.newDebt);

        vars.newICR = LiquityMath._computeCR(vars.newColl, vars.newDebt, vars.price);

        // Check the adjustment satisfies all conditions for the current system mode
        _requireValidAdjustmentInCurrentMode(_troveChange, vars, isTroveInBatch);

        // --- Effects and interactions ---

        if (isTroveInBatch) {
            _troveManager.onAdjustTroveInsideBatch(
                _troveId,
                vars.newColl,
                vars.newDebt,
                _troveChange,
                batchManager,
                batch.entireCollWithoutRedistribution,
                batch.entireDebtWithoutRedistribution
            );
        } else {
            _troveManager.onAdjustTrove(_troveId, vars.newColl, vars.newDebt, _troveChange);
        }

        vars.activePool.mintAggInterestAndAccountForTroveChange(_troveChange, batchManager);
        _moveTokensFromAdjustment(receiver, _troveChange, vars.boldToken, vars.activePool);
    }

    function closeTrove(uint256 _troveId) external override {
        ITroveManager troveManagerCached = troveManager;
        IActivePool activePoolCached = activePool;
        IBoldToken boldTokenCached = boldToken;

        // --- Checks ---

        address owner = troveNFT.ownerOf(_troveId);
        address receiver = _requireSenderIsOwnerOrRemoveManagerAndGetReceiver(_troveId, owner);
        _requireTroveIsOpen(troveManagerCached, _troveId);

        LatestTroveData memory trove = troveManagerCached.getLatestTroveData(_troveId);

        // The borrower must repay their entire debt including accrued interest, batch fee and redist. gains
        _requireSufficientBoldBalance(boldTokenCached, msg.sender, trove.entireDebt);

        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        troveChange.appliedRedistCollGain = trove.redistCollGain;
        troveChange.collDecrease = trove.entireColl;
        troveChange.debtDecrease = trove.entireDebt;

        address batchManager = interestBatchManagerOf[_troveId];
        LatestBatchData memory batch;
        if (batchManager != address(0)) {
            batch = troveManagerCached.getLatestBatchData(batchManager);
            uint256 batchFutureDebt =
                batch.entireDebtWithoutRedistribution - (trove.entireDebt - trove.redistBoldDebtGain);
            troveChange.batchAccruedManagementFee = batch.accruedManagementFee;
            troveChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
            troveChange.newWeightedRecordedDebt = batchFutureDebt * batch.annualInterestRate;
            troveChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
            troveChange.newWeightedRecordedBatchManagementFee = batchFutureDebt * batch.annualManagementFee;
        } else {
            troveChange.oldWeightedRecordedDebt = trove.weightedRecordedDebt;
            // troveChange.newWeightedRecordedDebt = 0;
        }

        (uint256 price,) = priceFeed.fetchPrice();
        uint256 newTCR = _getNewTCRFromTroveChange(troveChange, price);
        if (!hasBeenShutDown) _requireNewTCRisAboveCCR(newTCR);

        troveManagerCached.onCloseTrove(
            _troveId,
            troveChange,
            batchManager,
            batch.entireCollWithoutRedistribution,
            batch.entireDebtWithoutRedistribution
        );

        // If trove is in batch
        if (batchManager != address(0)) {
            // Unlink here in BorrowerOperations
            interestBatchManagerOf[_troveId] = address(0);
        }

        activePoolCached.mintAggInterestAndAccountForTroveChange(troveChange, batchManager);

        // Return ETH gas compensation
        WETH.transferFrom(gasPoolAddress, receiver, ETH_GAS_COMPENSATION);
        // Burn the remainder of the Trove's entire debt from the user
        boldTokenCached.burn(msg.sender, trove.entireDebt);

        // Send the collateral back to the user
        activePoolCached.sendColl(receiver, trove.entireColl);

        _wipeTroveMappings(_troveId);
    }

    function applyPendingDebt(uint256 _troveId, uint256 _lowerHint, uint256 _upperHint) public {
        _requireIsNotShutDown();

        ITroveManager troveManagerCached = troveManager;

        _requireTroveIsOpen(troveManagerCached, _troveId);

        LatestTroveData memory trove = troveManagerCached.getLatestTroveData(_troveId);
        _requireNonZeroDebt(trove.entireDebt);

        TroveChange memory change;
        change.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        change.appliedRedistCollGain = trove.redistCollGain;

        address batchManager = interestBatchManagerOf[_troveId];
        LatestBatchData memory batch;

        if (batchManager == address(0)) {
            change.oldWeightedRecordedDebt = trove.weightedRecordedDebt;
            change.newWeightedRecordedDebt = trove.entireDebt * trove.annualInterestRate;
        } else {
            batch = troveManagerCached.getLatestBatchData(batchManager);
            change.batchAccruedManagementFee = batch.accruedManagementFee;
            change.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
            change.newWeightedRecordedDebt =
                (batch.entireDebtWithoutRedistribution + trove.redistBoldDebtGain) * batch.annualInterestRate;
            change.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
            change.newWeightedRecordedBatchManagementFee =
                (batch.entireDebtWithoutRedistribution + trove.redistBoldDebtGain) * batch.annualManagementFee;
        }

        troveManagerCached.onApplyTroveInterest(
            _troveId,
            trove.entireColl,
            trove.entireDebt,
            batchManager,
            batch.entireCollWithoutRedistribution,
            batch.entireDebtWithoutRedistribution,
            change
        );
        activePool.mintAggInterestAndAccountForTroveChange(change, batchManager);

        // If the trove was zombie, and now it’s not anymore, put it back in the list
        if (_checkTroveIsZombie(troveManagerCached, _troveId) && trove.entireDebt >= MIN_DEBT) {
            troveManagerCached.setTroveStatusToActive(_troveId);
            _reInsertIntoSortedTroves(
                _troveId, trove.annualInterestRate, _upperHint, _lowerHint, batchManager, batch.annualInterestRate
            );
        }
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
        uint256 _maxUpfrontFee,
        uint256 _minInterestRateChangePeriod
    ) external {
        _requireIsNotShutDown();
        _requireTroveIsActive(troveManager, _troveId);
        _requireCallerIsBorrower(_troveId);
        _requireValidAnnualInterestRate(_minInterestRate);
        _requireValidAnnualInterestRate(_maxInterestRate);
        // With the check below, it could only be ==
        _requireOrderedRange(_minInterestRate, _maxInterestRate);

        interestIndividualDelegateOf[_troveId] =
            InterestIndividualDelegate(_delegate, _minInterestRate, _maxInterestRate, _minInterestRateChangePeriod);
        // Can’t have both individual delegation and batch manager
        if (interestBatchManagerOf[_troveId] != address(0)) {
            // Not needed, implicitly checked in removeFromBatch
            //_requireValidAnnualInterestRate(_newAnnualInterestRate);
            removeFromBatch(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint, _maxUpfrontFee);
        }
    }

    function removeInterestIndividualDelegate(uint256 _troveId) external {
        _requireCallerIsBorrower(_troveId);
        delete interestIndividualDelegateOf[_troveId];
    }

    function getInterestBatchManager(address _account) external view returns (InterestBatchManager memory) {
        return interestBatchManagers[_account];
    }

    function registerBatchManager(
        uint128 _minInterestRate,
        uint128 _maxInterestRate,
        uint128 _currentInterestRate,
        uint128 _annualManagementFee,
        uint128 _minInterestRateChangePeriod
    ) external {
        _requireIsNotShutDown();
        _requireNonExistentInterestBatchManager(msg.sender);
        _requireValidAnnualInterestRate(_minInterestRate);
        _requireValidAnnualInterestRate(_maxInterestRate);
        // With the check below, it could only be ==
        _requireOrderedRange(_minInterestRate, _maxInterestRate);
        _requireInterestRateInRange(_currentInterestRate, _minInterestRate, _maxInterestRate);
        // Not needed, implicitly checked in the condition above:
        //_requireValidAnnualInterestRate(_currentInterestRate);
        if (_annualManagementFee > MAX_ANNUAL_BATCH_MANAGEMENT_FEE) revert AnnualManagementFeeTooHigh();
        if (_minInterestRateChangePeriod < MIN_INTEREST_RATE_CHANGE_PERIOD) revert MinInterestRateChangePeriodTooLow();

        interestBatchManagers[msg.sender] =
            InterestBatchManager(_minInterestRate, _maxInterestRate, _minInterestRateChangePeriod);

        troveManager.onRegisterBatchManager(msg.sender, _currentInterestRate, _annualManagementFee);
    }

    function lowerBatchManagementFee(uint256 _newAnnualManagementFee) external {
        _requireIsNotShutDown();
        _requireValidInterestBatchManager(msg.sender);

        ITroveManager troveManagerCached = troveManager;

        LatestBatchData memory batch = troveManagerCached.getLatestBatchData(msg.sender);
        if (_newAnnualManagementFee >= batch.annualManagementFee) {
            revert NewFeeNotLower();
        }

        // Lower batch fee on TM
        troveManagerCached.onLowerBatchManagerAnnualFee(
            msg.sender,
            batch.entireCollWithoutRedistribution,
            batch.entireDebtWithoutRedistribution,
            _newAnnualManagementFee
        );

        // active pool mint
        TroveChange memory batchChange;
        batchChange.batchAccruedManagementFee = batch.accruedManagementFee;
        batchChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
        batchChange.newWeightedRecordedDebt = batch.entireDebtWithoutRedistribution * batch.annualInterestRate;
        batchChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
        batchChange.newWeightedRecordedBatchManagementFee =
            batch.entireDebtWithoutRedistribution * _newAnnualManagementFee;

        activePool.mintAggInterestAndAccountForTroveChange(batchChange, msg.sender);
    }

    function setBatchManagerAnnualInterestRate(
        uint128 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external {
        _requireIsNotShutDown();
        _requireValidInterestBatchManager(msg.sender);
        _requireInterestRateInBatchManagerRange(msg.sender, _newAnnualInterestRate);
        // Not needed, implicitly checked in the condition above:
        //_requireValidAnnualInterestRate(_newAnnualInterestRate);

        ITroveManager troveManagerCached = troveManager;
        IActivePool activePoolCached = activePool;

        LatestBatchData memory batch = troveManagerCached.getLatestBatchData(msg.sender);
        _requireBatchInterestRateChangePeriodPassed(msg.sender, uint256(batch.lastInterestRateAdjTime));

        uint256 newDebt = batch.entireDebtWithoutRedistribution;

        TroveChange memory batchChange;
        batchChange.batchAccruedManagementFee = batch.accruedManagementFee;
        batchChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
        batchChange.newWeightedRecordedDebt = newDebt * _newAnnualInterestRate;
        batchChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
        batchChange.newWeightedRecordedBatchManagementFee = newDebt * batch.annualManagementFee;

        // Apply upfront fee on premature adjustments
        if (
            batch.annualInterestRate != _newAnnualInterestRate
                && block.timestamp < batch.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN
        ) {
            uint256 price = _requireOraclesLive();

            uint256 avgInterestRate = activePoolCached.getNewApproxAvgInterestRateFromTroveChange(batchChange);
            batchChange.upfrontFee = _calcUpfrontFee(newDebt, avgInterestRate);
            _requireUserAcceptsUpfrontFee(batchChange.upfrontFee, _maxUpfrontFee);

            newDebt += batchChange.upfrontFee;

            // Recalculate the batch's weighted terms, now taking into account the upfront fee
            batchChange.newWeightedRecordedDebt = newDebt * _newAnnualInterestRate;
            batchChange.newWeightedRecordedBatchManagementFee = newDebt * batch.annualManagementFee;

            // Disallow a premature adjustment if it would result in TCR < CCR
            // (which includes the case when TCR is already below CCR before the adjustment).
            uint256 newTCR = _getNewTCRFromTroveChange(batchChange, price);
            _requireNewTCRisAboveCCR(newTCR);
        }

        activePoolCached.mintAggInterestAndAccountForTroveChange(batchChange, msg.sender);

        // Check batch is not empty, and then reinsert in sorted list
        if (!sortedTroves.isEmptyBatch(BatchId.wrap(msg.sender))) {
            sortedTroves.reInsertBatch(BatchId.wrap(msg.sender), _newAnnualInterestRate, _upperHint, _lowerHint);
        }

        troveManagerCached.onSetBatchManagerAnnualInterestRate(
            msg.sender, batch.entireCollWithoutRedistribution, newDebt, _newAnnualInterestRate, batchChange.upfrontFee
        );
    }

    function setInterestBatchManager(
        uint256 _troveId,
        address _newBatchManager,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) public override {
        _requireIsNotShutDown();
        LocalVariables_setInterestBatchManager memory vars;
        vars.troveManager = troveManager;
        vars.activePool = activePool;
        vars.sortedTroves = sortedTroves;

        _requireTroveIsActive(vars.troveManager, _troveId);
        _requireCallerIsBorrower(_troveId);
        _requireValidInterestBatchManager(_newBatchManager);
        _requireIsNotInBatch(_troveId);

        interestBatchManagerOf[_troveId] = _newBatchManager;
        // Can’t have both individual delegation and batch manager
        if (interestIndividualDelegateOf[_troveId].account != address(0)) delete interestIndividualDelegateOf[_troveId];

        vars.trove = vars.troveManager.getLatestTroveData(_troveId);
        vars.newBatch = vars.troveManager.getLatestBatchData(_newBatchManager);

        TroveChange memory newBatchTroveChange;
        newBatchTroveChange.appliedRedistBoldDebtGain = vars.trove.redistBoldDebtGain;
        newBatchTroveChange.appliedRedistCollGain = vars.trove.redistCollGain;
        newBatchTroveChange.batchAccruedManagementFee = vars.newBatch.accruedManagementFee;
        newBatchTroveChange.oldWeightedRecordedDebt =
            vars.newBatch.weightedRecordedDebt + vars.trove.weightedRecordedDebt;
        newBatchTroveChange.newWeightedRecordedDebt =
            (vars.newBatch.entireDebtWithoutRedistribution + vars.trove.entireDebt) * vars.newBatch.annualInterestRate;

        // An upfront fee is always charged upon joining a batch to ensure that borrowers can not game the fee logic
        // and gain free interest rate updates (e.g. if they also manage the batch they joined)
        // It checks the resulting ICR
        vars.trove.entireDebt =
            _applyUpfrontFee(vars.trove.entireColl, vars.trove.entireDebt, newBatchTroveChange, _maxUpfrontFee, true);

        // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
        newBatchTroveChange.newWeightedRecordedDebt =
            (vars.newBatch.entireDebtWithoutRedistribution + vars.trove.entireDebt) * vars.newBatch.annualInterestRate;

        // Add batch fees
        newBatchTroveChange.oldWeightedRecordedBatchManagementFee = vars.newBatch.weightedRecordedBatchManagementFee;
        newBatchTroveChange.newWeightedRecordedBatchManagementFee =
            (vars.newBatch.entireDebtWithoutRedistribution + vars.trove.entireDebt) * vars.newBatch.annualManagementFee;
        vars.activePool.mintAggInterestAndAccountForTroveChange(newBatchTroveChange, _newBatchManager);

        vars.troveManager.onSetInterestBatchManager(
            ITroveManager.OnSetInterestBatchManagerParams({
                troveId: _troveId,
                troveColl: vars.trove.entireColl,
                troveDebt: vars.trove.entireDebt,
                troveChange: newBatchTroveChange,
                newBatchAddress: _newBatchManager,
                newBatchColl: vars.newBatch.entireCollWithoutRedistribution,
                newBatchDebt: vars.newBatch.entireDebtWithoutRedistribution
            })
        );

        vars.sortedTroves.remove(_troveId);
        vars.sortedTroves.insertIntoBatch(
            _troveId, BatchId.wrap(_newBatchManager), vars.newBatch.annualInterestRate, _upperHint, _lowerHint
        );
    }

    function kickFromBatch(uint256 _troveId, uint256 _upperHint, uint256 _lowerHint) external override {
        _removeFromBatch({
            _troveId: _troveId,
            _newAnnualInterestRate: 0, // ignored when kicking
            _upperHint: _upperHint,
            _lowerHint: _lowerHint,
            _maxUpfrontFee: 0, // will use the batch's existing interest rate, so no fee
            _kick: true
        });
    }

    function removeFromBatch(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) public override {
        _removeFromBatch({
            _troveId: _troveId,
            _newAnnualInterestRate: _newAnnualInterestRate,
            _upperHint: _upperHint,
            _lowerHint: _lowerHint,
            _maxUpfrontFee: _maxUpfrontFee,
            _kick: false
        });
    }

    function _removeFromBatch(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee,
        bool _kick
    ) internal {
        _requireIsNotShutDown();

        LocalVariables_removeFromBatch memory vars;
        vars.troveManager = troveManager;
        vars.sortedTroves = sortedTroves;

        if (_kick) {
            _requireTroveIsOpen(vars.troveManager, _troveId);
        } else {
            _requireTroveIsActive(vars.troveManager, _troveId);
            _requireCallerIsBorrower(_troveId);
            _requireValidAnnualInterestRate(_newAnnualInterestRate);
        }

        vars.batchManager = _requireIsInBatch(_troveId);
        vars.trove = vars.troveManager.getLatestTroveData(_troveId);
        vars.batch = vars.troveManager.getLatestBatchData(vars.batchManager);

        if (_kick) {
            if (vars.batch.totalDebtShares * MAX_BATCH_SHARES_RATIO >= vars.batch.entireDebtWithoutRedistribution) {
                revert BatchSharesRatioTooLow();
            }
            _newAnnualInterestRate = vars.batch.annualInterestRate;
        }

        delete interestBatchManagerOf[_troveId];

        if (!_checkTroveIsZombie(vars.troveManager, _troveId)) {
            // Remove trove from Batch in SortedTroves
            vars.sortedTroves.removeFromBatch(_troveId);
            // Reinsert as single trove
            vars.sortedTroves.insert(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint);
        }

        vars.batchFutureDebt =
            vars.batch.entireDebtWithoutRedistribution - (vars.trove.entireDebt - vars.trove.redistBoldDebtGain);

        vars.batchChange.appliedRedistBoldDebtGain = vars.trove.redistBoldDebtGain;
        vars.batchChange.appliedRedistCollGain = vars.trove.redistCollGain;
        vars.batchChange.batchAccruedManagementFee = vars.batch.accruedManagementFee;
        vars.batchChange.oldWeightedRecordedDebt = vars.batch.weightedRecordedDebt;
        vars.batchChange.newWeightedRecordedDebt =
            vars.batchFutureDebt * vars.batch.annualInterestRate + vars.trove.entireDebt * _newAnnualInterestRate;

        // Apply upfront fee on premature adjustments. It checks the resulting ICR
        if (
            vars.batch.annualInterestRate != _newAnnualInterestRate
                && block.timestamp < vars.trove.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN
        ) {
            vars.trove.entireDebt =
                _applyUpfrontFee(vars.trove.entireColl, vars.trove.entireDebt, vars.batchChange, _maxUpfrontFee, false);
        }

        // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
        vars.batchChange.newWeightedRecordedDebt =
            vars.batchFutureDebt * vars.batch.annualInterestRate + vars.trove.entireDebt * _newAnnualInterestRate;
        // Add batch fees
        vars.batchChange.oldWeightedRecordedBatchManagementFee = vars.batch.weightedRecordedBatchManagementFee;
        vars.batchChange.newWeightedRecordedBatchManagementFee = vars.batchFutureDebt * vars.batch.annualManagementFee;

        activePool.mintAggInterestAndAccountForTroveChange(vars.batchChange, vars.batchManager);

        vars.troveManager.onRemoveFromBatch(
            _troveId,
            vars.trove.entireColl,
            vars.trove.entireDebt,
            vars.batchChange,
            vars.batchManager,
            vars.batch.entireCollWithoutRedistribution,
            vars.batch.entireDebtWithoutRedistribution,
            _newAnnualInterestRate
        );
    }

    function switchBatchManager(
        uint256 _troveId,
        uint256 _removeUpperHint,
        uint256 _removeLowerHint,
        address _newBatchManager,
        uint256 _addUpperHint,
        uint256 _addLowerHint,
        uint256 _maxUpfrontFee
    ) external override {
        address oldBatchManager = _requireIsInBatch(_troveId);
        _requireNewInterestBatchManager(oldBatchManager, _newBatchManager);

        LatestBatchData memory oldBatch = troveManager.getLatestBatchData(oldBatchManager);

        removeFromBatch(_troveId, oldBatch.annualInterestRate, _removeUpperHint, _removeLowerHint, 0);
        setInterestBatchManager(_troveId, _newBatchManager, _addUpperHint, _addLowerHint, _maxUpfrontFee);
    }

    function _applyUpfrontFee(
        uint256 _troveEntireColl,
        uint256 _troveEntireDebt,
        TroveChange memory _troveChange,
        uint256 _maxUpfrontFee,
        bool _isTroveInBatch
    ) internal returns (uint256) {
        uint256 price = _requireOraclesLive();

        uint256 avgInterestRate = activePool.getNewApproxAvgInterestRateFromTroveChange(_troveChange);
        _troveChange.upfrontFee = _calcUpfrontFee(_troveEntireDebt, avgInterestRate);
        _requireUserAcceptsUpfrontFee(_troveChange.upfrontFee, _maxUpfrontFee);

        _troveEntireDebt += _troveChange.upfrontFee;

        // ICR is based on the requested Bold amount + upfront fee.
        uint256 newICR = LiquityMath._computeCR(_troveEntireColl, _troveEntireDebt, price);
        if (_isTroveInBatch) {
            _requireICRisAboveMCRPlusBCR(newICR);
        } else {
            _requireICRisAboveMCR(newICR);
        }

        // Disallow a premature adjustment if it would result in TCR < CCR
        // (which includes the case when TCR is already below CCR before the adjustment).
        uint256 newTCR = _getNewTCRFromTroveChange(_troveChange, price);
        _requireNewTCRisAboveCCR(newTCR);

        return _troveEntireDebt;
    }

    function _calcUpfrontFee(uint256 _debt, uint256 _avgInterestRate) internal pure returns (uint256) {
        return _calcInterest(_debt * _avgInterestRate, UPFRONT_INTEREST_PERIOD);
    }

    // Call from TM to clean state here
    function onLiquidateTrove(uint256 _troveId) external {
        _requireCallerIsTroveManager();

        _wipeTroveMappings(_troveId);
    }

    function _wipeTroveMappings(uint256 _troveId) internal {
        delete interestIndividualDelegateOf[_troveId];
        delete interestBatchManagerOf[_troveId];
        _wipeAddRemoveManagers(_troveId);
    }

    /**
     * Claim remaining collateral from a liquidation with ICR exceeding the liquidation penalty
     */
    function claimCollateral() external override {
        // send coll from CollSurplus Pool to owner
        collSurplusPool.claimColl(msg.sender);
    }

    function shutdown() external {
        if (hasBeenShutDown) revert IsShutDown();

        uint256 totalColl = getEntireBranchColl();
        uint256 totalDebt = getEntireBranchDebt();
        (uint256 price, bool newOracleFailureDetected) = priceFeed.fetchPrice();
        // If the oracle failed, the above call to PriceFeed will have shut this branch down
        if (newOracleFailureDetected) return;

        // Otherwise, proceed with the TCR check:
        uint256 TCR = LiquityMath._computeCR(totalColl, totalDebt, price);
        if (TCR >= SCR()) revert TCRNotBelowSCR();

        _applyShutdown();

        emit ShutDown(TCR);
    }

    // Not technically a "Borrower op", but seems best placed here given current shutdown logic.
    function shutdownFromOracleFailure() external {
        _requireCallerIsPriceFeed();

        // No-op rather than revert here, so that the outer function call which fetches the price does not revert
        // if the system is already shut down.
        if (hasBeenShutDown) return;

        _applyShutdown();
    }

    function _applyShutdown() internal {
        activePool.mintAggInterest();
        hasBeenShutDown = true;
        troveManager.shutdown();
    }

    // --- Helper functions ---

    function _reInsertIntoSortedTroves(
        uint256 _troveId,
        uint256 _troveAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        address _batchManager,
        uint256 _batchAnnualInterestRate
    ) internal {
        // If it was in a batch, we need to put it back, otherwise we insert it normally
        if (_batchManager == address(0)) {
            sortedTroves.insert(_troveId, _troveAnnualInterestRate, _upperHint, _lowerHint);
        } else {
            sortedTroves.insertIntoBatch(
                _troveId, BatchId.wrap(_batchManager), _batchAnnualInterestRate, _upperHint, _lowerHint
            );
        }
    }

    // This function mints the BOLD corresponding to the borrower's chosen debt increase
    // (it does not mint the accrued interest).
    function _moveTokensFromAdjustment(
        address withdrawalReceiver,
        TroveChange memory _troveChange,
        IBoldToken _boldToken,
        IActivePool _activePool
    ) internal {
        if (_troveChange.debtIncrease > 0) {
            require(troveManager.getDebtLimit() >= troveManager.getEntireBranchDebt(), "BorrowerOperations: Debt limit exceeded.");
            _boldToken.mint(withdrawalReceiver, _troveChange.debtIncrease);
        } else if (_troveChange.debtDecrease > 0) {
            _boldToken.burn(msg.sender, _troveChange.debtDecrease);
        }

        if (_troveChange.collIncrease > 0) {
            // Pull coll tokens from sender and move them to the Active Pool
            _pullCollAndSendToActivePool(_activePool, _troveChange.collIncrease);
        } else if (_troveChange.collDecrease > 0) {
            // Pull Coll from Active Pool and decrease its recorded Coll balance
            _activePool.sendColl(withdrawalReceiver, _troveChange.collDecrease);
        }
    }

    function _pullCollAndSendToActivePool(IActivePool _activePool, uint256 _amount) internal {
        // Send Coll tokens from sender to active pool
        collToken.transferFrom(msg.sender, address(_activePool), _amount);
        // Make sure Active Pool accountancy is right
        _activePool.accountForReceivedColl(_amount);
    }

    function checkBatchManagerExists(address _batchManager) external view returns (bool) {
        return interestBatchManagers[_batchManager].maxInterestRate > 0;
    }

    // --- 'Require' wrapper functions ---

    function _requireIsNotShutDown() internal view {
        if (hasBeenShutDown) {
            revert IsShutDown();
        }
    }

    function _requireNonZeroAdjustment(TroveChange memory _troveChange) internal pure {
        if (
            _troveChange.collIncrease == 0 && _troveChange.collDecrease == 0 && _troveChange.debtIncrease == 0
                && _troveChange.debtDecrease == 0
        ) {
            revert ZeroAdjustment();
        }
    }

    function _requireSenderIsOwnerOrInterestManager(uint256 _troveId) internal view {
        address owner = troveNFT.ownerOf(_troveId);
        if (msg.sender != owner && msg.sender != interestIndividualDelegateOf[_troveId].account) {
            revert NotOwnerNorInterestManager();
        }
    }

    function _requireValidDelegateAdjustment(
        uint256 _troveId,
        uint256 _lastInterestRateAdjTime,
        uint256 _annualInterestRate
    ) internal view {
        InterestIndividualDelegate memory individualDelegate = interestIndividualDelegateOf[_troveId];
        // We have previously checked that sender is either owner or delegate
        // If it’s owner, this restriction doesn’t apply
        if (individualDelegate.account == msg.sender) {
            _requireInterestRateInRange(
                _annualInterestRate, individualDelegate.minInterestRate, individualDelegate.maxInterestRate
            );
            _requireDelegateInterestRateChangePeriodPassed(
                _lastInterestRateAdjTime, individualDelegate.minInterestRateChangePeriod
            );
        }
    }

    function _requireIsNotInBatch(uint256 _troveId) internal view {
        if (interestBatchManagerOf[_troveId] != address(0)) {
            revert TroveInBatch();
        }
    }

    function _requireIsInBatch(uint256 _troveId) internal view returns (address) {
        address batchManager = interestBatchManagerOf[_troveId];
        if (batchManager == address(0)) {
            revert TroveNotInBatch();
        }

        return batchManager;
    }

    function _requireTroveDoesNotExist(ITroveManager _troveManager, uint256 _troveId) internal view {
        ITroveManager.Status status = _troveManager.getTroveStatus(_troveId);
        if (status != ITroveManager.Status.nonExistent) {
            revert TroveExists();
        }
    }

    function _requireTroveIsOpen(ITroveManager _troveManager, uint256 _troveId) internal view {
        ITroveManager.Status status = _troveManager.getTroveStatus(_troveId);
        if (status != ITroveManager.Status.active && status != ITroveManager.Status.zombie) {
            revert TroveNotOpen();
        }
    }

    function _requireTroveIsActive(ITroveManager _troveManager, uint256 _troveId) internal view {
        ITroveManager.Status status = _troveManager.getTroveStatus(_troveId);
        if (status != ITroveManager.Status.active) {
            revert TroveNotActive();
        }
    }

    function _requireTroveIsZombie(ITroveManager _troveManager, uint256 _troveId) internal view {
        if (!_checkTroveIsZombie(_troveManager, _troveId)) {
            revert TroveNotZombie();
        }
    }

    function _checkTroveIsZombie(ITroveManager _troveManager, uint256 _troveId) internal view returns (bool) {
        ITroveManager.Status status = _troveManager.getTroveStatus(_troveId);
        return status == ITroveManager.Status.zombie;
    }

    function _requireNonZeroDebt(uint256 _troveDebt) internal pure {
        if (_troveDebt == 0) {
            revert TroveWithZeroDebt();
        }
    }

    function _requireUserAcceptsUpfrontFee(uint256 _fee, uint256 _maxFee) internal pure {
        if (_fee > _maxFee) {
            revert UpfrontFeeTooHigh();
        }
    }

    function _requireValidAdjustmentInCurrentMode(
        TroveChange memory _troveChange,
        LocalVariables_adjustTrove memory _vars,
        bool _isTroveInBatch
    ) internal view {
        /*
        * Below Critical Threshold, it is not permitted:
        *
        * - Borrowing, unless it brings TCR up to CCR again
        * - Collateral withdrawal except accompanied by a debt repayment of at least the same value
        *
        * In Normal Mode, ensure:
        *
        * - The adjustment won't pull the TCR below CCR
        *
        * In Both cases:
        * - The new ICR is above MCR, or MCR+BCR if a batched trove
        */

        if (_isTroveInBatch) {
            _requireICRisAboveMCRPlusBCR(_vars.newICR);
        } else {
            _requireICRisAboveMCR(_vars.newICR);
        }

        uint256 newTCR = _getNewTCRFromTroveChange(_troveChange, _vars.price);
        if (_vars.isBelowCriticalThreshold) {
            _requireNoBorrowingUnlessNewTCRisAboveCCR(_troveChange.debtIncrease, newTCR);
            _requireDebtRepaymentGeCollWithdrawal(_troveChange, _vars.price);
        } else {
            // if Normal Mode
            _requireNewTCRisAboveCCR(newTCR);
        }
    }

    function _requireICRisAboveMCR(uint256 _newICR) internal view {
        if (_newICR < MCR()) {
            revert ICRBelowMCR();
        }
    }

    function _requireICRisAboveMCRPlusBCR(uint256 _newICR) internal view {
        if (_newICR < MCR() + BCR()) {
            revert ICRBelowMCRPlusBCR();
        }
    }

    function _requireNoBorrowingUnlessNewTCRisAboveCCR(uint256 _debtIncrease, uint256 _newTCR) internal view {
        if (_debtIncrease > 0 && _newTCR < CCR()) {
            revert TCRBelowCCR();
        }
    }

    function _requireDebtRepaymentGeCollWithdrawal(TroveChange memory _troveChange, uint256 _price) internal pure {
        if ((_troveChange.debtDecrease * DECIMAL_PRECISION < _troveChange.collDecrease * _price)) {
            revert RepaymentNotMatchingCollWithdrawal();
        }
    }

    function _requireNewTCRisAboveCCR(uint256 _newTCR) internal view {
        if (_newTCR < CCR()) {
            revert TCRBelowCCR();
        }
    }

    function _requireAtLeastMinDebt(uint256 _debt) internal pure {
        if (_debt < MIN_DEBT) {
            revert DebtBelowMin();
        }
    }

    function _requireValidCollWithdrawal(uint256 _currentColl, uint256 _collWithdrawal) internal pure {
        if (_collWithdrawal > _currentColl) {
            revert CollWithdrawalTooHigh();
        }
    }

    function _requireSufficientBoldBalance(IBoldToken _boldToken, address _borrower, uint256 _debtRepayment)
        internal
        view
    {
        if (_boldToken.balanceOf(_borrower) < _debtRepayment) {
            revert NotEnoughBoldBalance();
        }
    }

    function _requireValidAnnualInterestRate(uint256 _annualInterestRate) internal pure {
        if (_annualInterestRate < MIN_ANNUAL_INTEREST_RATE) {
            revert InterestRateTooLow();
        }
        if (_annualInterestRate > MAX_ANNUAL_INTEREST_RATE) {
            revert InterestRateTooHigh();
        }
    }

    function _requireAnnualInterestRateIsNew(uint256 _oldAnnualInterestRate, uint256 _newAnnualInterestRate)
        internal
        pure
    {
        if (_oldAnnualInterestRate == _newAnnualInterestRate) {
            revert InterestRateNotNew();
        }
    }

    function _requireOrderedRange(uint256 _minInterestRate, uint256 _maxInterestRate) internal pure {
        if (_minInterestRate >= _maxInterestRate) revert MinGeMax();
    }

    function _requireInterestRateInBatchManagerRange(address _interestBatchManagerAddress, uint256 _annualInterestRate)
        internal
        view
    {
        InterestBatchManager memory interestBatchManager = interestBatchManagers[_interestBatchManagerAddress];
        _requireInterestRateInRange(
            _annualInterestRate, interestBatchManager.minInterestRate, interestBatchManager.maxInterestRate
        );
    }

    function _requireInterestRateInRange(
        uint256 _annualInterestRate,
        uint256 _minInterestRate,
        uint256 _maxInterestRate
    ) internal pure {
        if (_minInterestRate > _annualInterestRate || _annualInterestRate > _maxInterestRate) {
            revert InterestNotInRange();
        }
    }

    function _requireBatchInterestRateChangePeriodPassed(
        address _interestBatchManagerAddress,
        uint256 _lastInterestRateAdjTime
    ) internal view {
        InterestBatchManager memory interestBatchManager = interestBatchManagers[_interestBatchManagerAddress];
        if (block.timestamp < _lastInterestRateAdjTime + uint256(interestBatchManager.minInterestRateChangePeriod)) {
            revert BatchInterestRateChangePeriodNotPassed();
        }
    }

    function _requireDelegateInterestRateChangePeriodPassed(
        uint256 _lastInterestRateAdjTime,
        uint256 _minInterestRateChangePeriod
    ) internal view {
        if (block.timestamp < _lastInterestRateAdjTime + _minInterestRateChangePeriod) {
            revert DelegateInterestRateChangePeriodNotPassed();
        }
    }

    function _requireValidInterestBatchManager(address _interestBatchManagerAddress) internal view {
        if (interestBatchManagers[_interestBatchManagerAddress].maxInterestRate == 0) {
            revert InvalidInterestBatchManager();
        }
    }

    function _requireNonExistentInterestBatchManager(address _interestBatchManagerAddress) internal view {
        if (interestBatchManagers[_interestBatchManagerAddress].maxInterestRate > 0) {
            revert BatchManagerExists();
        }
    }

    function _requireNewInterestBatchManager(address _oldBatchManagerAddress, address _newBatchManagerAddress)
        internal
        pure
    {
        if (_oldBatchManagerAddress == _newBatchManagerAddress) {
            revert BatchManagerNotNew();
        }
    }

    function _requireCallerIsTroveManager() internal view {
        if (msg.sender != address(troveManager)) {
            revert CallerNotTroveManager();
        }
    }

    function _requireCallerIsPriceFeed() internal view {
        if (msg.sender != address(priceFeed)) {
            revert CallerNotPriceFeed();
        }
    }

    function _requireOraclesLive() internal returns (uint256) {
        (uint256 price, bool newOracleFailureDetected) = priceFeed.fetchPrice();
        if (newOracleFailureDetected) {
            revert NewOracleFailureDetected();
        }

        return price;
    }

    // --- ICR and TCR getters ---

    function _getNewTCRFromTroveChange(TroveChange memory _troveChange, uint256 _price)
        internal
        view
        returns (uint256 newTCR)
    {
        uint256 totalColl = getEntireBranchColl();
        totalColl += _troveChange.collIncrease;
        totalColl -= _troveChange.collDecrease;

        uint256 totalDebt = getEntireBranchDebt();
        totalDebt += _troveChange.debtIncrease;
        totalDebt += _troveChange.upfrontFee;
        totalDebt -= _troveChange.debtDecrease;

        newTCR = LiquityMath._computeCR(totalColl, totalDebt, _price);
    }

    function isBranchActive() public view returns (bool) {
        return troveManager.isActive();
    }
}
