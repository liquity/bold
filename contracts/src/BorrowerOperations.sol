// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBoldToken.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/AddRemoveManagers.sol";
import "./Dependencies/Ownable.sol";

// import "forge-std/console2.sol";

contract BorrowerOperations is LiquityBase, AddRemoveManagers, Ownable, IBorrowerOperations {
    using SafeERC20 for IERC20;

    string public constant NAME = "BorrowerOperations";

    // --- Connected contract declarations ---

    IERC20 public immutable collToken;
    address gasPoolAddress;
    ICollSurplusPool collSurplusPool;
    IBoldToken public boldToken;
    // A doubly linked list of Troves, sorted by their collateral ratios
    ISortedTroves public sortedTroves;
    // Wrapped ETH for liquidation reserve (gas compensation)
    IWETH public immutable WETH;

    // Shutdown system collateral ratio. If the system's total collateral ratio (TCR) for a given collateral falls below the SCR,
    // the protocol triggers the shutdown of the borrow market and permanently disables all borrowing operations except for closing Troves.
    uint256 public immutable SCR;
    bool public hasBeenShutDown;

    // Minimum collateral ratio for individual troves
    uint256 public immutable MCR;

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
        ContractsCacheTMAPBT contractsCache;
        uint256 troveId;
        TroveChange troveChange;
        uint256 price;
        uint256 avgInterestRate;
        uint256 entireDebt;
        uint256 ICR;
        uint256 newTCR;
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

    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event BoldTokenAddressChanged(address _boldTokenAddress);

    event ShutDown(uint256 _tcr);
    event ShutDownFromOracleFailure(address _oracleAddress);

    constructor(IERC20 _collToken, ITroveManager _troveManager, IWETH _weth) AddRemoveManagers(_troveManager) {
        collToken = _collToken;

        WETH = _weth;

        SCR = _troveManager.SCR();
        MCR = _troveManager.MCR();
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
        assert(MIN_DEBT > 0);

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
        collToken.approve(_activePoolAddress, type(uint256).max);

        _renounceOwnership();
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
        uint256 _maxUpfrontFee
    ) external override returns (uint256) {
        return openTrove(
            _owner,
            _ownerIndex,
            _collAmount,
            _boldAmount,
            _upperHint,
            _lowerHint,
            _annualInterestRate,
            _maxUpfrontFee,
            address(0),
            address(0),
            address(0)
        );
    }

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
    ) public override returns (uint256) {
        _requireIsNotShutDown();

        LocalVariables_openTrove memory vars;
        vars.contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);

        vars.price = priceFeed.fetchPrice();

        // --- Checks ---

        _requireNotBelowCriticalThreshold(vars.price);
        _requireValidAnnualInterestRate(_annualInterestRate);

        vars.troveId = uint256(keccak256(abi.encode(_owner, _ownerIndex)));
        _requireTroveIsNotOpen(vars.contractsCache.troveManager, vars.troveId);

        vars.troveChange.collIncrease = _collAmount;
        vars.troveChange.debtIncrease = _boldAmount;

        // For simplicity, we ignore the fee when calculating the approx. interest rate
        vars.troveChange.newWeightedRecordedDebt = vars.troveChange.debtIncrease * _annualInterestRate;

        vars.avgInterestRate =
            vars.contractsCache.activePool.getNewApproxAvgInterestRateFromTroveChange(vars.troveChange);
        vars.troveChange.upfrontFee = _calcUpfrontFee(vars.troveChange.debtIncrease, vars.avgInterestRate);
        _requireUserAcceptsUpfrontFee(vars.troveChange.upfrontFee, _maxUpfrontFee);

        vars.entireDebt = vars.troveChange.debtIncrease + vars.troveChange.upfrontFee;
        _requireAtLeastMinDebt(vars.entireDebt);

        // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
        vars.troveChange.newWeightedRecordedDebt = vars.entireDebt * _annualInterestRate;

        // ICR is based on the composite debt, i.e. the requested Bold amount + Bold gas comp + upfront fee.
        vars.ICR = LiquityMath._computeCR(_collAmount, vars.entireDebt, vars.price);
        _requireICRisAboveMCR(vars.ICR);

        vars.newTCR = _getNewTCRFromTroveChange(vars.troveChange, vars.price);
        _requireNewTCRisAboveCCR(vars.newTCR);

        // --- Effects & interactions ---

        // Set add/remove managers
        if (_addManager != address(0)) {
            _setAddManager(vars.troveId, _addManager);
        }
        if (_removeManager != address(0)) {
            _setRemoveManager(vars.troveId, _removeManager, _receiver);
        }

        vars.contractsCache.activePool.mintAggInterestAndAccountForTroveChange(vars.troveChange);
        sortedTroves.insert(vars.troveId, _annualInterestRate, _upperHint, _lowerHint);

        // Set the stored Trove properties and mint the NFT
        vars.contractsCache.troveManager.onOpenTrove(
            _owner, vars.troveId, _collAmount, vars.entireDebt, _annualInterestRate, vars.troveChange.upfrontFee
        );

        // Pull coll tokens from sender and move them to the Active Pool
        _pullCollAndSendToActivePool(vars.contractsCache.activePool, _collAmount);

        // Mint the requested _boldAmount to the borrower and mint the gas comp to the GasPool
        vars.contractsCache.boldToken.mint(msg.sender, _boldAmount);
        WETH.transferFrom(msg.sender, gasPoolAddress, ETH_GAS_COMPENSATION);

        return vars.troveId;
    }

    // Send collateral to a trove
    function addColl(uint256 _troveId, uint256 _collAmount) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);

        TroveChange memory troveChange;
        troveChange.collIncrease = _collAmount;

        _adjustTrove(
            contractsCache,
            _troveId,
            troveChange,
            0 // _maxUpfrontFee
        );
    }

    // Withdraw collateral from a trove
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

        sortedTroves.insert(
            _troveId, contractsCache.troveManager.getTroveAnnualInterestRate(_troveId), _upperHint, _lowerHint
        );

        contractsCache.troveManager.setTroveStatusToActive(_troveId);
    }

    function adjustTroveInterestRate(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _maxUpfrontFee
    ) external {
        _requireIsNotShutDown();

        ContractsCacheTMAP memory contractsCache = ContractsCacheTMAP(troveManager, activePool);

        _requireValidAnnualInterestRate(_newAnnualInterestRate);
        // TODO: Delegation functionality
        _requireSenderIsOwner(contractsCache.troveManager, _troveId);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);

        LatestTroveData memory trove = contractsCache.troveManager.getLatestTroveData(_troveId);
        uint256 newDebt = trove.entireDebt;

        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        troveChange.appliedRedistCollGain = trove.redistCollGain;
        troveChange.newWeightedRecordedDebt = newDebt * _newAnnualInterestRate;
        troveChange.oldWeightedRecordedDebt = trove.weightedRecordedDebt;

        // Apply upfront fee on premature adjustments
        if (block.timestamp < trove.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN) {
            // TODO: should we fetch unconditionally? Would make the TX a bit more expensive for well-behaved users, but
            // it would be more consistent with other functions (fetching the price is the first thing we usually do).
            uint256 price = priceFeed.fetchPrice();

            uint256 avgInterestRate = contractsCache.activePool.getNewApproxAvgInterestRateFromTroveChange(troveChange);
            troveChange.upfrontFee = _calcUpfrontFee(newDebt, avgInterestRate);
            _requireUserAcceptsUpfrontFee(troveChange.upfrontFee, _maxUpfrontFee);

            newDebt += troveChange.upfrontFee;

            // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
            troveChange.newWeightedRecordedDebt = newDebt * _newAnnualInterestRate;

            // ICR is based on the composite debt, i.e. the requested Bold amount + Bold gas comp + upfront fee.
            uint256 newICR = LiquityMath._computeCR(trove.entireColl, newDebt, price);
            _requireICRisAboveMCR(newICR);

            // Disallow a premature adjustment if it would result in TCR < CCR
            // (which includes the case when TCR is already below CCR before the adjustment).
            uint256 newTCR = _getNewTCRFromTroveChange(troveChange, price);
            _requireNewTCRisAboveCCR(newTCR);
        }

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(troveChange);
        sortedTroves.reInsert(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint);
        contractsCache.troveManager.onAdjustTroveInterestRate(
            _troveId, trove.entireColl, newDebt, _newAnnualInterestRate, troveChange
        );
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
        _requireIsNotShutDown();

        LocalVariables_adjustTrove memory vars;

        vars.price = priceFeed.fetchPrice();
        vars.isBelowCriticalThreshold = _checkBelowCriticalThreshold(vars.price);

        // --- Checks ---

        _requireNonZeroAdjustment(_troveChange);
        _requireTroveIsOpen(_contractsCache.troveManager, _troveId);

        address owner = _contractsCache.troveManager.ownerOf(_troveId);
        address receiver = owner; // If it’s a withdrawal, and manager has receive privilege, manager would be the receiver

        if (_troveChange.collDecrease > 0 || _troveChange.debtIncrease > 0) {
            receiver = _requireSenderIsOwnerOrRemoveManager(_troveId, owner);
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

        _troveChange.appliedRedistBoldDebtGain = vars.trove.redistBoldDebtGain;
        _troveChange.appliedRedistCollGain = vars.trove.redistCollGain;
        _troveChange.oldWeightedRecordedDebt = vars.trove.weightedRecordedDebt;
        _troveChange.newWeightedRecordedDebt = vars.newDebt * vars.trove.annualInterestRate;

        // Pay an upfront fee on debt increases
        if (_troveChange.debtIncrease > 0) {
            uint256 avgInterestRate =
                _contractsCache.activePool.getNewApproxAvgInterestRateFromTroveChange(_troveChange);
            _troveChange.upfrontFee = _calcUpfrontFee(_troveChange.debtIncrease, avgInterestRate);
            _requireUserAcceptsUpfrontFee(_troveChange.upfrontFee, _maxUpfrontFee);

            vars.newDebt += _troveChange.upfrontFee;

            // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
            _troveChange.newWeightedRecordedDebt = vars.newDebt * vars.trove.annualInterestRate;
        }

        // Make sure the Trove doesn't become unredeemable
        _requireAtLeastMinDebt(vars.newDebt);

        vars.newICR = LiquityMath._computeCR(vars.newColl, vars.newDebt, vars.price);

        // Check the adjustment satisfies all conditions for the current system mode
        _requireValidAdjustmentInCurrentMode(_troveChange, vars);

        // --- Effects and interactions ---

        _contractsCache.activePool.mintAggInterestAndAccountForTroveChange(_troveChange);
        _moveTokensFromAdjustment(receiver, _troveChange, _contractsCache);
        _contractsCache.troveManager.onAdjustTrove(_troveId, vars.newColl, vars.newDebt, _troveChange);
    }

    function closeTrove(uint256 _troveId) external override returns (uint256) {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);

        // --- Checks ---

        address owner = contractsCache.troveManager.ownerOf(_troveId);
        address receiver = _requireSenderIsOwnerOrRemoveManager(_troveId, owner);
        _requireTroveIsOpen(contractsCache.troveManager, _troveId);
        uint256 price = priceFeed.fetchPrice();

        LatestTroveData memory trove = contractsCache.troveManager.getLatestTroveData(_troveId);

        // The borrower must repay their entire debt including accrued interest and redist. gains
        _requireSufficientBoldBalance(contractsCache.boldToken, msg.sender, trove.entireDebt);

        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        troveChange.appliedRedistCollGain = trove.redistCollGain;
        troveChange.collDecrease = trove.entireColl;
        troveChange.debtDecrease = trove.entireDebt;
        troveChange.oldWeightedRecordedDebt = trove.weightedRecordedDebt;

        uint256 newTCR = _getNewTCRFromTroveChange(troveChange, price);
        if (!hasBeenShutDown) _requireNewTCRisAboveCCR(newTCR);

        // --- Effects and interactions ---

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(troveChange);
        contractsCache.troveManager.onCloseTrove(_troveId, troveChange);

        // Return ETH gas compensation
        WETH.transferFrom(gasPoolAddress, receiver, ETH_GAS_COMPENSATION);
        // Burn the remainder of the Trove's entire debt from the user
        contractsCache.boldToken.burn(msg.sender, trove.entireDebt);

        // Send the collateral back to the user
        contractsCache.activePool.sendColl(receiver, trove.entireColl);

        return trove.entireColl;
    }

    function applyTroveInterestPermissionless(uint256 _troveId) external {
        _requireIsNotShutDown();

        ContractsCacheTMAP memory contractsCache = ContractsCacheTMAP(troveManager, activePool);

        _requireTroveIsStale(contractsCache.troveManager, _troveId);
        _requireTroveIsOpen(contractsCache.troveManager, _troveId);

        LatestTroveData memory trove = contractsCache.troveManager.getLatestTroveData(_troveId);
        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        troveChange.appliedRedistCollGain = trove.redistCollGain;
        troveChange.oldWeightedRecordedDebt = trove.weightedRecordedDebt;
        troveChange.newWeightedRecordedDebt = trove.entireDebt * trove.annualInterestRate;

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(troveChange);
        contractsCache.troveManager.onApplyTroveInterest(_troveId, trove.entireColl, trove.entireDebt, troveChange);
    }

    /**
     * Claim remaining collateral from a liquidation with ICR exceeding the liquidation penalty
     */
    function claimCollateral() external override {
        // send coll from CollSurplus Pool to owner
        collSurplusPool.claimColl(msg.sender);
    }

    function shutdown() external {
        require(!hasBeenShutDown, "BO: already shutdown");

        uint256 totalColl = getEntireSystemColl();
        uint256 totalDebt = getEntireSystemDebt();
        uint256 price = priceFeed.fetchPrice();

        uint256 TCR = LiquityMath._computeCR(totalColl, totalDebt, price);
        require(TCR < SCR, "BO: TCR is not below SCR");

        _applyShutdown();

        emit ShutDown(TCR);
    }

    // Not technically a "Borrower op", but seems best placed here given current shutdown logic.
    function shutdownFromOracleFailure(address _failedOracleAddr) external {
        _requireCallerIsPriceFeed();

        // No-op rather than revert here, so that the outer function call which fetches the price does not revert
        if (hasBeenShutDown) return;

        _applyShutdown();

        emit ShutDownFromOracleFailure(_failedOracleAddr);
    }

    function _applyShutdown() internal {
        activePool.mintAggInterest();
        hasBeenShutDown = true;
        troveManager.shutdown();
    }

    // --- Helper functions ---

    // This function mints the BOLD corresponding to the borrower's chosen debt increase
    // (it does not mint the accrued interest).
    function _moveTokensFromAdjustment(
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
            // Pull coll tokens from sender and move them to the Active Pool
            _pullCollAndSendToActivePool(_contractsCache.activePool, _troveChange.collIncrease);
        } else if (_troveChange.collDecrease > 0) {
            // Pull Coll from Active Pool and decrease its recorded Coll balance
            _contractsCache.activePool.sendColl(withdrawalReceiver, _troveChange.collDecrease);
        }
    }

    function _pullCollAndSendToActivePool(IActivePool _activePool, uint256 _amount) internal {
        // Send Coll tokens from sender to active pool
        collToken.safeTransferFrom(msg.sender, address(_activePool), _amount);
        // Make sure Active Pool accountancy is right
        _activePool.accountForReceivedColl(_amount);
    }

    // --- 'Require' wrapper functions ---

    function _requireIsNotShutDown() internal view {
        require(!hasBeenShutDown, "BO: Branch shut down");
    }

    function _requireIsShutDown() internal view {
        require(hasBeenShutDown, "BO: Branch is not shut down");
    }

    function _requireNonZeroAdjustment(TroveChange memory _troveChange) internal pure {
        require(
            _troveChange.collIncrease > 0 || _troveChange.collDecrease > 0 || _troveChange.debtIncrease > 0
                || _troveChange.debtDecrease > 0,
            "BorrowerOps: There must be either a collateral change or a debt change"
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
        require(_debtRepayment <= _currentDebt, "BorrowerOps: Amount repaid must not be larger than the Trove's debt");
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
        require(_annualInterestRate <= MAX_ANNUAL_INTEREST_RATE, "Interest rate must not be greater than max");
    }

    function _requireTroveIsStale(ITroveManager _troveManager, uint256 _troveId) internal view {
        require(_troveManager.troveIsStale(_troveId), "BO: Trove must be stale");
    }

    function _requireCallerIsPriceFeed() internal view {
        require(msg.sender == address(priceFeed), "BO: Caller must be PriceFeed");
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
}
