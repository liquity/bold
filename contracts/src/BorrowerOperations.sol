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

    /* --- Variable container structs  ---

    Used to hold, return and assign variables inside a function, in order to avoid the error:
    "CompilerError: Stack too deep". */

    struct LocalVariables_adjustTrove {
        uint256 price;
        uint256 entireDebt;
        uint256 entireColl;
        uint256 redistDebtGain;
        uint256 accruedTroveInterest;
        uint256 oldICR;
        uint256 newICR;
        uint256 newTCR;
        uint256 BoldFee; // TODO
        uint256 newEntireDebt;
        uint256 newEntireColl;
        uint256 stake;
        uint256 initialWeightedRecordedTroveDebt;
        uint256 newWeightedTroveDebt;
        uint256 annualInterestRate;
        uint256 troveDebtIncrease;
        uint256 troveDebtDecrease;
    }

    struct LocalVariables_openTrove {
        uint256 price;
        uint256 BoldFee; // TODO
        uint256 netDebt;
        uint256 compositeDebt;
        uint256 ICR;
        uint256 stake;
        uint256 arrayIndex;
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

    enum BorrowerOperation {
        openTrove,
        closeTrove,
        adjustTrove
    }

    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event BoldTokenAddressChanged(address _boldTokenAddress);

    event TroveCreated(address indexed _owner, uint256 _troveId, uint256 _arrayIndex);
    event TroveUpdated(
        uint256 indexed _troveId, uint256 _debt, uint256 _coll, uint256 stake, BorrowerOperation operation
    );
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
        uint256 _annualInterestRate
    ) external override returns (uint256) {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        LocalVariables_openTrove memory vars;

        vars.price = priceFeed.fetchPrice();

        // --- Checks ---

        _requireNotBelowCriticalThreshold(vars.price);

        _requireValidAnnualInterestRate(_annualInterestRate);

        uint256 troveId = uint256(keccak256(abi.encode(_owner, _ownerIndex)));
        _requireTroveIsNotOpen(contractsCache.troveManager, troveId);

        _requireAtLeastMinNetDebt(_boldAmount);

        // ICR is based on the composite debt, i.e. the requested Bold amount + Bold gas comp.
        vars.compositeDebt = _getCompositeDebt(_boldAmount);
        assert(vars.compositeDebt > 0);

        vars.ICR = LiquityMath._computeCR(_ETHAmount, vars.compositeDebt, vars.price);

        _requireICRisAboveMCR(vars.ICR);
        uint256 newTCR = _getNewTCRFromTroveChange(_ETHAmount, true, vars.compositeDebt, true, vars.price); // bools: coll increase, debt increase
        _requireNewTCRisAboveCCR(newTCR);

        // --- Effects & interactions ---

        uint256 weightedRecordedTroveDebt = vars.compositeDebt * _annualInterestRate;
        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(
            vars.compositeDebt, 0, weightedRecordedTroveDebt, 0
        );

        // Set the stored Trove properties and mint the NFT
        (vars.stake, vars.arrayIndex) = contractsCache.troveManager.setTrovePropertiesOnOpen(
            _owner, troveId, _ETHAmount, vars.compositeDebt, _annualInterestRate
        );

        sortedTroves.insert(troveId, _annualInterestRate, _upperHint, _lowerHint);
        emit TroveCreated(_owner, troveId, vars.arrayIndex);

        // Pull ETH tokens from sender and move them to the Active Pool
        _pullETHAndSendToActivePool(contractsCache.activePool, _ETHAmount);

        // Mint the requested _boldAmount to the borrower and mint the gas comp to the GasPool
        contractsCache.boldToken.mint(msg.sender, _boldAmount);
        contractsCache.boldToken.mint(gasPoolAddress, BOLD_GAS_COMPENSATION);

        emit TroveUpdated(troveId, vars.compositeDebt, _ETHAmount, vars.stake, BorrowerOperation.openTrove);
        emit BoldBorrowingFeePaid(troveId, vars.BoldFee); // TODO

        return troveId;
    }

    // Send ETH as collateral to a trove
    function addColl(uint256 _troveId, uint256 _ETHAmount) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);
        // TODO: Use oldColl and assert in fuzzing, remove before deployment
        uint256 oldColl = troveManager.getTroveEntireColl(_troveId);
        _adjustTrove(msg.sender, _troveId, _ETHAmount, true, 0, false, contractsCache);
        assert(troveManager.getTroveEntireColl(_troveId) > oldColl);
    }

    // Withdraw ETH collateral from a trove
    function withdrawColl(uint256 _troveId, uint256 _collWithdrawal) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);
        // TODO: Use oldColl and assert in fuzzing, remove before deployment
        uint256 oldColl = troveManager.getTroveEntireColl(_troveId);
        _adjustTrove(msg.sender, _troveId, _collWithdrawal, false, 0, false, contractsCache);
        assert(troveManager.getTroveEntireColl(_troveId) < oldColl);
    }

    // Withdraw Bold tokens from a trove: mint new Bold tokens to the owner, and increase the trove's debt accordingly
    function withdrawBold(uint256 _troveId, uint256 _boldAmount) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);
        // TODO: Use oldDebt and assert in fuzzing, remove before deployment
        uint256 oldDebt = troveManager.getTroveEntireDebt(_troveId);
        _adjustTrove(msg.sender, _troveId, 0, false, _boldAmount, true, contractsCache);
        assert(troveManager.getTroveEntireDebt(_troveId) > oldDebt);
    }

    // Repay Bold tokens to a Trove: Burn the repaid Bold tokens, and reduce the trove's debt accordingly
    function repayBold(uint256 _troveId, uint256 _boldAmount) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);
        // TODO: Use oldDebt and assert in fuzzing, remove before deployment
        uint256 oldDebt = troveManager.getTroveEntireDebt(_troveId);
        _adjustTrove(msg.sender, _troveId, 0, false, _boldAmount, false, contractsCache);
        assert(troveManager.getTroveEntireDebt(_troveId) < oldDebt);
    }

    function adjustTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease
    ) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);
        _adjustTrove(msg.sender, _troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, contractsCache);
    }

    function adjustUnredeemableTrove(
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _upperHint,
        uint256 _lowerHint
    ) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsUnredeemable(contractsCache.troveManager, _troveId);
        // TODO: Gas - pass the cached TM down here, since we fetch it again inside _adjustTrove?
        _adjustTrove(msg.sender, _troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, contractsCache);
        troveManager.setTroveStatusToActive(_troveId);
        sortedTroves.insert(
            _troveId, contractsCache.troveManager.getTroveAnnualInterestRate(_troveId), _upperHint, _lowerHint
        );
    }

    function adjustTroveInterestRate(
        uint256 _troveId,
        uint256 _newAnnualInterestRate,
        uint256 _upperHint,
        uint256 _lowerHint
    ) external {
        _requireValidAnnualInterestRate(_newAnnualInterestRate);
        // TODO: Delegation functionality
        _requireIsOwner(_troveId);

        ContractsCacheTMAP memory contractsCache = ContractsCacheTMAP(troveManager, activePool);

        _requireTroveIsActive(contractsCache.troveManager, _troveId);

        uint256 entireTroveDebt = _updateActivePoolTrackersNoDebtChange(
            contractsCache.troveManager, contractsCache.activePool, _troveId, _newAnnualInterestRate
        );

        sortedTroves.reInsert(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint);

        // Update Trove recorded debt and interest-weighted debt sum
        contractsCache.troveManager.updateTroveDebtAndInterest(_troveId, entireTroveDebt, _newAnnualInterestRate);
    }

    /*
    * _adjustTrove(): Alongside a debt change, this function can perform either a collateral top-up or a collateral withdrawal.
    */
    function _adjustTrove(
        address _sender,
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        ContractsCacheTMAPBT memory _contractsCache
    ) internal {
        LocalVariables_adjustTrove memory vars;

        vars.price = priceFeed.fetchPrice();

        vars.initialWeightedRecordedTroveDebt = _contractsCache.troveManager.getTroveWeightedRecordedDebt(_troveId);
        vars.annualInterestRate = _contractsCache.troveManager.getTroveAnnualInterestRate(_troveId);

        // --- Checks ---

        bool isBelowCriticalThreshold = _checkBelowCriticalThreshold(vars.price);

        if (_isCollIncrease) {
            _requireNonZeroCollChange(_collChange);
        }
        if (_isDebtIncrease) {
            _requireNonZeroDebtChange(_boldChange);
        }
        _requireNonZeroAdjustment(_collChange, _boldChange);
        _requireTroveIsOpen(_contractsCache.troveManager, _troveId);

        (vars.entireDebt, vars.entireColl, vars.redistDebtGain,, vars.accruedTroveInterest) =
            _contractsCache.troveManager.getEntireDebtAndColl(_troveId);

        // When the adjustment is a debt repayment, check it's a valid amount and that the caller has enough Bold
        if (!_isDebtIncrease && _boldChange > 0) {
            _requireValidBoldRepayment(vars.entireDebt, _boldChange);
            _requireSufficientBoldBalance(_contractsCache.boldToken, msg.sender, _boldChange);
        }

        // When the adjustment is a collateral withdrawal, check that it's no more than the Trove's entire collateral
        if (!_isCollIncrease && _collChange > 0) {
            _requireValidCollWithdrawal(vars.entireColl, _collChange);
        }

        // Get the trove's old ICR before the adjustment, and what its new ICR will be after the adjustment
        vars.oldICR = LiquityMath._computeCR(vars.entireColl, vars.entireDebt, vars.price);
        vars.newICR = _getNewICRFromTroveChange(
            vars.entireColl, vars.entireDebt, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, vars.price
        );

        // Check the adjustment satisfies all conditions for the current system mode
        _requireValidAdjustmentInCurrentMode(
            isBelowCriticalThreshold, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, vars
        );

        // --- Effects and interactions ---

        _contractsCache.troveManager.getAndApplyRedistributionGains(_troveId);

        // Update the Trove's recorded coll and debt
        vars.newEntireColl = _updateTroveCollFromAdjustment(
            _contractsCache.troveManager, _sender, _troveId, vars.entireColl, _collChange, _isCollIncrease
        );
        vars.newEntireDebt = _updateTroveDebtFromAdjustment(
            _contractsCache.troveManager,
            _sender,
            _troveId,
            vars.entireDebt,
            _boldChange,
            _isDebtIncrease,
            vars.accruedTroveInterest
        );

        _requireAtLeastMinNetDebt(_getNetDebt(vars.newEntireDebt));

        vars.stake = _contractsCache.troveManager.updateStakeAndTotalStakes(_troveId);

        vars.newWeightedTroveDebt = vars.newEntireDebt * vars.annualInterestRate;

        if (_isDebtIncrease) {
            // Increase Trove debt by the drawn debt + redist. gain
            vars.troveDebtIncrease = _boldChange + vars.redistDebtGain;
        } else {
            // Increase Trove debt by redist. gain and decrease by the repaid debt
            vars.troveDebtIncrease = vars.redistDebtGain;
            vars.troveDebtDecrease = _boldChange;
        }

        activePool.mintAggInterestAndAccountForTroveChange(
            vars.troveDebtIncrease,
            vars.troveDebtDecrease,
            vars.newWeightedTroveDebt,
            vars.initialWeightedRecordedTroveDebt
        );

        emit TroveUpdated(_troveId, vars.newEntireDebt, vars.newEntireColl, vars.stake, BorrowerOperation.adjustTrove);
        emit BoldBorrowingFeePaid(_troveId, vars.BoldFee); // TODO

        _moveTokensAndETHfromAdjustment(
            _contractsCache.activePool,
            _contractsCache.boldToken,
            _contractsCache.troveManager,
            _troveId,
            _collChange,
            _isCollIncrease,
            _boldChange,
            _isDebtIncrease
        );
    }

    function closeTrove(uint256 _troveId) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);

        // --- Checks ---

        _requireCallerIsBorrower(contractsCache.troveManager, _troveId);
        _requireTroveIsOpen(contractsCache.troveManager, _troveId);
        uint256 price = priceFeed.fetchPrice();

        uint256 initialWeightedRecordedTroveDebt = contractsCache.troveManager.getTroveWeightedRecordedDebt(_troveId);
        uint256 initialRecordedTroveDebt = contractsCache.troveManager.getTroveDebt(_troveId);

        (
            uint256 entireTroveDebt,
            uint256 entireTroveColl,
            , // debtRedistGain
            , // ETHredist gain
            uint256 accruedTroveInterest
        ) = contractsCache.troveManager.getEntireDebtAndColl(_troveId);

        // The borrower must repay their entire debt including accrued interest and redist. gains (and less the gas comp.)
        _requireSufficientBoldBalance(contractsCache.boldToken, msg.sender, entireTroveDebt - BOLD_GAS_COMPENSATION);

        // The TCR always includes A Trove's redist. gain and accrued interest, so we must use the Trove's entire debt here
        uint256 newTCR = _getNewTCRFromTroveChange(entireTroveColl, false, entireTroveDebt, false, price);
        _requireNewTCRisAboveCCR(newTCR);

        // --- Effects and interactions ---

        // TODO: gas optimization of redistribution gains. We don't need to actually update stored Trove debt & coll properties here, since we'll
        // zero them at the end.
        contractsCache.troveManager.getAndApplyRedistributionGains(_troveId);

        // Remove the Trove's initial recorded debt plus its accrued interest from ActivePool.aggRecordedDebt,
        // but *don't* remove the redistribution gains, since these were not yet incorporated into the sum.
        uint256 troveDebtDecrease = initialRecordedTroveDebt + accruedTroveInterest;

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(
            0, troveDebtDecrease, 0, initialWeightedRecordedTroveDebt
        );

        contractsCache.troveManager.removeStake(_troveId);
        contractsCache.troveManager.closeTrove(_troveId);
        emit TroveUpdated(_troveId, 0, 0, 0, BorrowerOperation.closeTrove);

        // Burn the 200 BOLD gas compensation
        contractsCache.boldToken.burn(gasPoolAddress, BOLD_GAS_COMPENSATION);
        // Burn the remainder of the Trove's entire debt from the user
        contractsCache.boldToken.burn(msg.sender, entireTroveDebt - BOLD_GAS_COMPENSATION);

        // Send the collateral back to the user
        contractsCache.activePool.sendETH(msg.sender, entireTroveColl);
    }

    function applyTroveInterestPermissionless(uint256 _troveId) external {
        ContractsCacheTMAP memory contractsCache = ContractsCacheTMAP(troveManager, activePool);

        _requireTroveIsStale(contractsCache.troveManager, _troveId);
        _requireTroveIsOpen(contractsCache.troveManager, _troveId);

        uint256 annualInterestRate = contractsCache.troveManager.getTroveAnnualInterestRate(_troveId);

        uint256 entireTroveDebt = _updateActivePoolTrackersNoDebtChange(
            contractsCache.troveManager, contractsCache.activePool, _troveId, annualInterestRate
        );

        // Update Trove recorded debt
        contractsCache.troveManager.updateTroveDebtFromInterestApplication(_troveId, entireTroveDebt);
    }

    function setAddManager(uint256 _troveId, address _manager) external {
        troveManager.setAddManager(msg.sender, _troveId, _manager);
    }

    function setRemoveManager(uint256 _troveId, address _manager) external {
        troveManager.setRemoveManager(msg.sender, _troveId, _manager);
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

    // Update Trove's coll whether they added or removed collateral. Assumes any ETH redistribution gain was already applied
    // to the Trove's coll.
    function _updateTroveCollFromAdjustment(
        ITroveManager _troveManager,
        address _sender,
        uint256 _troveId,
        uint256 _oldEntireColl,
        uint256 _collChange,
        bool _isCollIncrease
    ) internal returns (uint256) {
        uint256 newEntireColl;

        if (_collChange > 0) {
            newEntireColl = _isCollIncrease ? _oldEntireColl + _collChange : _oldEntireColl - _collChange;
            _troveManager.updateTroveColl(_sender, _troveId, newEntireColl, _isCollIncrease);
        } else {
            newEntireColl = _oldEntireColl;
        }

        return newEntireColl;
    }

    // Update Trove's coll whether they increased or decreased debt. Assumes any debt redistribution gain was already applied
    // to the Trove's debt.
    function _updateTroveDebtFromAdjustment(
        ITroveManager _troveManager,
        address _sender,
        uint256 _troveId,
        uint256 _oldEntireDebt,
        uint256 _debtChange,
        bool _isDebtIncrease,
        uint256 _accruedTroveInterest
    ) internal returns (uint256) {
        uint256 newEntireDebt;
        if (_debtChange > 0) {
            newEntireDebt = _isDebtIncrease ? _oldEntireDebt + _debtChange : _oldEntireDebt - _debtChange;
            _troveManager.updateTroveDebt(_sender, _troveId, newEntireDebt, _isDebtIncrease);
        } else {
            newEntireDebt = _oldEntireDebt;
            if (_accruedTroveInterest > 0) {
                _troveManager.updateTroveDebtFromInterestApplication(_troveId, newEntireDebt);
            }
        }

        return newEntireDebt;
    }

    // This function mints the BOLD corresponding to the borrower's chosen debt increase
    // (it does not mint the accrued interest).
    function _moveTokensAndETHfromAdjustment(
        IActivePool _activePool,
        IBoldToken _boldToken,
        ITroveManager _troveManager,
        uint256 _troveId,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease
    ) internal {
        if (_isDebtIncrease) {
            // implies _boldChange > 0
            address borrower = _troveManager.ownerOf(_troveId);
            _boldToken.mint(borrower, _boldChange);
        } else if (_boldChange > 0) {
            _boldToken.burn(msg.sender, _boldChange);
        }

        if (_isCollIncrease) {
            // implies _collChange > 0
            // Pull ETH tokens from sender and move them to the Active Pool
            _pullETHAndSendToActivePool(_activePool, _collChange);
        } else if (_collChange > 0) {
            address borrower = _troveManager.ownerOf(_troveId);
            // Pull ETH from Active Pool and decrease its recorded ETH balance
            _activePool.sendETH(borrower, _collChange);
        }
    }

    function _pullETHAndSendToActivePool(IActivePool _activePool, uint256 _amount) internal {
        // Send ETH tokens from sender to active pool
        ETH.safeTransferFrom(msg.sender, address(_activePool), _amount);
        // Make sure Active Pool accountancy is right
        _activePool.accountForReceivedETH(_amount);
    }

    function _updateActivePoolTrackersNoDebtChange(
        ITroveManager _troveManager,
        IActivePool _activePool,
        uint256 _troveId,
        uint256 _annualInterestRate
    ) internal returns (uint256) {
        uint256 initialWeightedRecordedTroveDebt = _troveManager.getTroveWeightedRecordedDebt(_troveId);
        // --- Effects ---

        uint256 accruedTroveInterest = _troveManager.calcTroveAccruedInterest(_troveId);
        (, uint256 redistDebtGain) = _troveManager.getAndApplyRedistributionGains(_troveId);
        uint256 recordedTroveDebt = _troveManager.getTroveDebt(_troveId);
        uint256 entireTroveDebt = recordedTroveDebt + accruedTroveInterest;
        uint256 newWeightedTroveDebt = entireTroveDebt * _annualInterestRate;
        // Add only the Trove's accrued interest to the recorded debt tracker since we have already applied redist. gains.
        // No debt is issued/repaid, so the net Trove debt change is purely the redistribution gain
        // TODO: also include redist. gains here in the recordedSumIncrease arg if we gas-optimize them
        _activePool.mintAggInterestAndAccountForTroveChange(
            redistDebtGain, 0, newWeightedTroveDebt, initialWeightedRecordedTroveDebt
        );

        return entireTroveDebt;
    }

    // --- 'Require' wrapper functions ---

    function _requireCallerIsBorrower(ITroveManager _troveManager, uint256 _troveId) internal view {
        require(
            msg.sender == _troveManager.ownerOf(_troveId), "BorrowerOps: Caller must be the borrower for a withdrawal"
        );
    }

    function _requireNonZeroAdjustment(uint256 _collChange, uint256 _boldChange) internal pure {
        require(
            _collChange != 0 || _boldChange != 0,
            "BorrowerOps: There must be either a collateral change or a debt change"
        );
    }

    function _requireIsOwner(uint256 _troveId) internal view {
        require(troveManager.ownerOf(_troveId) == msg.sender, "BO: Only owner");
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

    function _requireNonZeroCollChange(uint256 _collChange) internal pure {
        require(_collChange > 0, "BorrowerOps: Coll increase requires non-zero collChange");
    }

    function _requireNonZeroDebtChange(uint256 _boldChange) internal pure {
        require(_boldChange > 0, "BorrowerOps: Debt increase requires non-zero debtChange");
    }

    function _requireNotBelowCriticalThreshold(uint256 _price) internal view {
        require(!_checkBelowCriticalThreshold(_price), "BorrowerOps: Operation not permitted below CT");
    }

    function _requireNoBorrowing(bool _isDebtIncrease) internal pure {
        require(!_isDebtIncrease, "BorrowerOps: Borrowing not permitted below CT");
    }

    function _requireValidAdjustmentInCurrentMode(
        bool _isBelowCriticalThreshold,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
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
        if (_isBelowCriticalThreshold) {
            _requireNoBorrowing(_isDebtIncrease);
            _requireDebtRepaymentGeCollWithdrawal(
                _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _vars.price
            );
        } else {
            // if Normal Mode
            _requireICRisAboveMCR(_vars.newICR);
            _vars.newTCR =
                _getNewTCRFromTroveChange(_collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _vars.price);
            _requireNewTCRisAboveCCR(_vars.newTCR);
        }
    }

    function _requireICRisAboveMCR(uint256 _newICR) internal view {
        require(_newICR >= MCR, "BorrowerOps: An operation that would result in ICR < MCR is not permitted");
    }

    function _requireDebtRepaymentGeCollWithdrawal(
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        uint256 _price
    ) internal pure {
        require(
            _isCollIncrease || (!_isDebtIncrease && _boldChange >= _collChange * _price / DECIMAL_PRECISION),
            "BorrowerOps: below CT, repayment must be >= coll withdrawal"
        );
    }

    function _requireNewTCRisAboveCCR(uint256 _newTCR) internal pure {
        require(_newTCR >= CCR, "BorrowerOps: An operation that would result in TCR < CCR is not permitted");
    }

    function _requireAtLeastMinNetDebt(uint256 _netDebt) internal pure {
        require(_netDebt >= MIN_NET_DEBT, "BorrowerOps: Trove's net debt must be greater than minimum");
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

    // Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
    function _getNewICRFromTroveChange(
        uint256 _coll,
        uint256 _debt,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _debtChange,
        bool _isDebtIncrease,
        uint256 _price
    ) internal pure returns (uint256) {
        (uint256 newColl, uint256 newDebt) =
            _getNewTroveAmounts(_coll, _debt, _collChange, _isCollIncrease, _debtChange, _isDebtIncrease);

        uint256 newICR = LiquityMath._computeCR(newColl, newDebt, _price);
        return newICR;
    }

    function _getNewTroveAmounts(
        uint256 _coll,
        uint256 _debt,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _debtChange,
        bool _isDebtIncrease
    ) internal pure returns (uint256, uint256) {
        uint256 newColl = _coll;
        uint256 newDebt = _debt;

        newColl = _isCollIncrease ? _coll + _collChange : _coll - _collChange;
        newDebt = _isDebtIncrease ? _debt + _debtChange : _debt - _debtChange;

        return (newColl, newDebt);
    }

    function _getNewTCRFromTroveChange(
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _debtChange,
        bool _isDebtIncrease,
        uint256 _price
    ) internal view returns (uint256) {
        uint256 totalColl = getEntireSystemColl();
        uint256 totalDebt = getEntireSystemDebt();

        totalColl = _isCollIncrease ? totalColl + _collChange : totalColl - _collChange;
        totalDebt = _isDebtIncrease ? totalDebt + _debtChange : totalDebt - _debtChange;

        uint256 newTCR = LiquityMath._computeCR(totalColl, totalDebt, _price);

        return newTCR;
    }

    function getCompositeDebt(uint256 _debt) external pure override returns (uint256) {
        return _getCompositeDebt(_debt);
    }
}
