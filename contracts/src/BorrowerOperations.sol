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

// import "forge-std/console2.sol";

contract BorrowerOperations is LiquityBase, Ownable, CheckContract, IBorrowerOperations {
    using SafeERC20 for IERC20;

    string public constant NAME = "BorrowerOperations";

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

    struct ContractsCacheTMAP {
        ITroveManager troveManager;
        IActivePool activePool;
    }

    struct ContractsCacheTMAPBT {
        ITroveManager troveManager;
        IActivePool activePool;
        IBoldToken boldToken;
    }

    enum Operation {
        openTrove,
        closeTrove,
        adjustTrove,
        adjustTroveInterestRate,
        applyTroveInterestPermissionless
    }

    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event BoldTokenAddressChanged(address _boldTokenAddress);

    event TroveCreated(address indexed _owner, uint256 _troveId);
    event TroveUpdated(uint256 indexed _troveId, uint256 _debt, uint256 _coll, Operation operation);
    event BoldBorrowingFeePaid(uint256 indexed _troveId, uint256 _boldFee);

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
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        LocalVariables_openTrove memory vars;

        vars.price = priceFeed.fetchPrice();

        // --- Checks ---

        _requireNotBelowCriticalThreshold(vars.price);
        _requireValidAnnualInterestRate(_annualInterestRate);

        uint256 troveId = uint256(keccak256(abi.encode(_owner, _ownerIndex)));
        _requireTroveIsNotOpen(contractsCache.troveManager, troveId);

        vars.troveChange.collIncrease = _ETHAmount;
        vars.troveChange.debtIncrease = _boldAmount + BOLD_GAS_COMPENSATION;

        // For simplicity, we ignore the fee when calculating the approx. interest rate
        vars.troveChange.newWeightedRecordedDebt = vars.troveChange.debtIncrease * _annualInterestRate;

        vars.avgInterestRate = contractsCache.activePool.getNewApproxAvgInterestRateFromTroveChange(vars.troveChange);
        vars.troveChange.upfrontFee = _calcUpfrontFee(vars.troveChange.debtIncrease, vars.avgInterestRate);
        _requireUserAcceptsUpfrontFee(vars.troveChange.upfrontFee, _maxUpfrontFee);

        vars.entireDebt = vars.troveChange.debtIncrease + vars.troveChange.upfrontFee;
        _requireAtLeastMinDebt(vars.entireDebt);

        // Recalculate newWeightedRecordedDebt, now taking into account the upfront fee
        vars.troveChange.newWeightedRecordedDebt = vars.entireDebt * _annualInterestRate;

        // ICR is based on the composite debt, i.e. the requested Bold amount + Bold gas comp + upfront fee.
        vars.ICR = LiquityMath._computeCR(_ETHAmount, vars.entireDebt, vars.price);
        _requireICRisAboveMCR(vars.ICR);

        vars.newTCR = _getNewTCRFromTroveChange(vars.troveChange, vars.price);
        _requireNewTCRisAboveCCR(vars.newTCR);

        // --- Effects & interactions ---

        // Set the stored Trove properties and mint the NFT
        contractsCache.troveManager.openTrove(_owner, troveId, _ETHAmount, vars.entireDebt, _annualInterestRate);

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(vars.troveChange);
        sortedTroves.insert(troveId, _annualInterestRate, _upperHint, _lowerHint);

        emit TroveCreated(_owner, troveId);

        // Pull ETH tokens from sender and move them to the Active Pool
        _pullETHAndSendToActivePool(contractsCache.activePool, _ETHAmount);

        // Mint the requested _boldAmount to the borrower and mint the gas comp to the GasPool
        contractsCache.boldToken.mint(msg.sender, _boldAmount);
        contractsCache.boldToken.mint(gasPoolAddress, BOLD_GAS_COMPENSATION);

        emit TroveUpdated(troveId, vars.entireDebt, _ETHAmount, Operation.openTrove);

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

        sortedTroves.insert(
            _troveId, contractsCache.troveManager.getTroveAnnualInterestRate(_troveId), _upperHint, _lowerHint
        );
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
        // TODO: Delegation functionality
        _requireSenderIsOwner(contractsCache.troveManager, _troveId);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);

        LatestTroveData memory trove = contractsCache.troveManager.getLatestTroveData(_troveId);
        uint256 newColl = trove.entireColl;
        uint256 newDebt = trove.entireDebt;

        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        troveChange.newWeightedRecordedDebt = newDebt * _newAnnualInterestRate;
        troveChange.oldWeightedRecordedDebt = trove.weightedRecordedDebt;

        bool prematureAdjustment = (
            trove.lastInterestRateAdjTime != 0
                && block.timestamp < trove.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN
        );

        // Apply upfront fee on premature adjustments
        if (prematureAdjustment) {
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
            uint256 newICR = LiquityMath._computeCR(newColl, newDebt, price);
            _requireICRisAboveMCR(newICR);

            // Disallow a premature adjustment if it would result in TCR < CCR
            // (which includes the case when TCR is already below CCR before the adjustment).
            uint256 newTCR = _getNewTCRFromTroveChange(troveChange, price);
            _requireNewTCRisAboveCCR(newTCR);
        }

        contractsCache.troveManager.adjustTroveInterestRate(
            _troveId,
            newColl,
            newDebt,
            _newAnnualInterestRate,
            trove.redistETHGain,
            trove.redistBoldDebtGain,
            !prematureAdjustment // _startCooldown
        );

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(troveChange);
        sortedTroves.reInsert(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint);

        emit TroveUpdated(_troveId, newColl, newDebt, Operation.adjustTroveInterestRate);
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
            // TODO: is this needed? Then why aren't we doing this for collateral?
            _requireSufficientBoldBalance(_contractsCache.boldToken, msg.sender, _troveChange.debtDecrease);
        }

        // When the adjustment is a collateral withdrawal, check that it's no more than the Trove's entire collateral
        if (_troveChange.collDecrease > 0) {
            _requireValidCollWithdrawal(vars.trove.entireColl, _troveChange.collDecrease);
        }

        vars.newColl = vars.trove.entireColl + _troveChange.collIncrease - _troveChange.collDecrease;
        vars.newDebt = vars.trove.entireDebt + _troveChange.debtIncrease - _troveChange.debtDecrease;

        _troveChange.appliedRedistBoldDebtGain = vars.trove.redistBoldDebtGain;
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

        _contractsCache.troveManager.adjustTrove(
            _troveId, vars.newColl, vars.newDebt, vars.trove.redistETHGain, vars.trove.redistBoldDebtGain
        );

        _contractsCache.activePool.mintAggInterestAndAccountForTroveChange(_troveChange);

        emit TroveUpdated(_troveId, vars.newDebt, vars.newColl, Operation.adjustTrove);

        _moveTokensAndETHfromAdjustment(owner, _troveChange, _contractsCache);
    }

    function closeTrove(uint256 _troveId) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);

        // --- Checks ---

        _requireCallerIsBorrower(contractsCache.troveManager, _troveId);
        _requireTroveIsOpen(contractsCache.troveManager, _troveId);
        uint256 price = priceFeed.fetchPrice();

        LatestTroveData memory trove = contractsCache.troveManager.getLatestTroveData(_troveId);

        // The borrower must repay their entire debt including accrued interest and redist. gains (and less the gas comp.)
        _requireSufficientBoldBalance(contractsCache.boldToken, msg.sender, trove.entireDebt - BOLD_GAS_COMPENSATION);

        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        troveChange.collDecrease = trove.entireColl;
        troveChange.debtDecrease = trove.entireDebt;
        troveChange.oldWeightedRecordedDebt = trove.weightedRecordedDebt;

        uint256 newTCR = _getNewTCRFromTroveChange(troveChange, price);
        _requireNewTCRisAboveCCR(newTCR);

        // --- Effects and interactions ---

        contractsCache.troveManager.closeTrove(_troveId, trove.redistETHGain, trove.redistBoldDebtGain);
        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(troveChange);

        emit TroveUpdated(_troveId, 0, 0, Operation.closeTrove);

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

        LatestTroveData memory trove = contractsCache.troveManager.getLatestTroveData(_troveId);
        TroveChange memory troveChange;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        troveChange.oldWeightedRecordedDebt = trove.weightedRecordedDebt;
        troveChange.newWeightedRecordedDebt = trove.entireDebt * trove.annualInterestRate;

        contractsCache.troveManager.applyTroveInterest(
            _troveId, trove.entireColl, trove.entireDebt, trove.redistETHGain, trove.redistBoldDebtGain
        );

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(troveChange);

        emit TroveUpdated(_troveId, trove.entireColl, trove.entireDebt, Operation.applyTroveInterestPermissionless);
    }

    function setAddManager(uint256 _troveId, address _manager) external {
        _requireSenderIsOwner(troveManager, _troveId);
        addManagerOf[_troveId] = _manager;
    }

    function setRemoveManager(uint256 _troveId, address _manager) external {
        _requireSenderIsOwner(troveManager, _troveId);
        removeManagerOf[_troveId] = _manager;
    }

    /**
     * Claim remaining collateral from a liquidation with ICR exceeding the liquidation penalty
     */
    function claimCollateral() external override {
        // send ETH from CollSurplus Pool to owner
        collSurplusPool.claimColl(msg.sender);
    }

    // --- Helper functions ---

    function _getUSDValue(uint256 _coll, uint256 _price) internal pure returns (uint256) {
        uint256 usdValue = _price * _coll / DECIMAL_PRECISION;

        return usdValue;
    }

    function _getCollChange(uint256 _collReceived, uint256 _requestedCollWithdrawal)
        internal
        pure
        returns (uint256 collChange, bool isCollIncrease)
    {
        if (_collReceived != 0) {
            collChange = _collReceived;
            isCollIncrease = true;
        } else {
            collChange = _requestedCollWithdrawal;
        }
    }

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
        * - The new ICR is above MCR
        * - The adjustment won't pull the TCR below CCR
        */
        if (_vars.isBelowCriticalThreshold) {
            _requireNoBorrowing(_troveChange.debtIncrease);
            _requireDebtRepaymentGeCollWithdrawal(_troveChange, _vars.price);
        } else {
            // if Normal Mode
            _requireICRisAboveMCR(_vars.newICR);
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
        require(_annualInterestRate <= MAX_ANNUAL_INTEREST_RATE, "Interest rate must not be greater than max");
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
