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
    ITroveManager public troveManager;
    address gasPoolAddress;
    ICollSurplusPool collSurplusPool;
    IBoldToken public boldToken;
    // A doubly linked list of Troves, sorted by their collateral ratios
    ISortedTroves public sortedTroves;

    /* --- Variable container structs  ---

    Used to hold, return and assign variables inside a function, in order to avoid the error:
    "CompilerError: Stack too deep". */

    struct LocalVariables_adjustTrove {
        uint256 price;
        bool isBelowCriticalThreshold;
        uint256 newICR;
        uint256 newTCR;
        uint256 newRecordedDebt;
        uint256 newEntireDebt;
        uint256 newEntireColl;
        uint256 newWeightedRecordedDebt;
        uint256 newUpfrontInterest;
        uint256 forgoneUpfrontInterest;
    }

    struct LocalVariables_openTrove {
        uint256 price;
        uint256 recordedDebt;
        uint256 weightedRecordedDebt;
        uint256 upfrontInterest;
        uint256 entireDebt;
        uint256 ICR;
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

    event TroveCreated(address indexed _owner, uint256 _troveId, uint256 _arrayIndex);
    event TroveUpdated(uint256 indexed _troveId, uint256 _debt, uint256 _coll, Operation operation);
    event BoldBorrowingFeePaid(uint256 indexed _troveId, uint256 _boldFee);

    constructor(address _ETHAddress) {
        checkContract(_ETHAddress);
        ETH = IERC20(_ETHAddress);
    }

    // --- Dependency setters ---

    function setAddresses(
        address _troveManagerAddress,
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

        checkContract(_troveManagerAddress);
        checkContract(_activePoolAddress);
        checkContract(_defaultPoolAddress);
        checkContract(_gasPoolAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_priceFeedAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_boldTokenAddress);

        troveManager = ITroveManager(_troveManagerAddress);
        activePool = IActivePool(_activePoolAddress);
        defaultPool = IDefaultPool(_defaultPoolAddress);
        gasPoolAddress = _gasPoolAddress;
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        boldToken = IBoldToken(_boldTokenAddress);

        emit TroveManagerAddressChanged(_troveManagerAddress);
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

        vars.recordedDebt = _boldAmount + BOLD_GAS_COMPENSATION;
        _requireAtLeastMinDebt(vars.recordedDebt);

        vars.weightedRecordedDebt = vars.recordedDebt * _annualInterestRate;
        vars.upfrontInterest = vars.weightedRecordedDebt * UPFRONT_INTEREST_PERIOD / ONE_YEAR / DECIMAL_PRECISION;
        vars.entireDebt = vars.recordedDebt + vars.upfrontInterest;

        // ICR is based on the entire debt, i.e. the requested Bold amount + upfront interest + Bold gas comp.
        vars.ICR = LiquityMath._computeCR(_ETHAmount, vars.entireDebt, vars.price);
        _requireICRisAboveMCR(vars.ICR);

        uint256 newTCR = _getNewTCRFromTroveChange(
            _ETHAmount,
            0, // _collDecrease
            vars.recordedDebt,
            0, // _debtDecrease
            vars.upfrontInterest,
            0, // _oldRecordedUpfrontInterest
            0, // _forgoneUpfrontInterest
            vars.price
        );
        _requireNewTCRisAboveCCR(newTCR);

        // --- Effects & interactions ---

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(
            0, // _appliedRedistBoldDebtGain
            vars.recordedDebt,
            0, // _debtDecrease
            vars.weightedRecordedDebt,
            0, // _oldWeightedRecordedTroveDebt
            vars.upfrontInterest,
            0, // _oldRecordedUpfrontInterest
            0 // _forgoneUpfrontInterest
        );

        // Set the stored Trove properties and mint the NFT
        vars.arrayIndex = contractsCache.troveManager.setTrovePropertiesOnOpen(
            _owner, troveId, _ETHAmount, vars.recordedDebt, vars.upfrontInterest, _annualInterestRate
        );

        sortedTroves.insert(troveId, _annualInterestRate, _upperHint, _lowerHint);
        emit TroveCreated(_owner, troveId, vars.arrayIndex);

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
        // TODO: Use oldColl and assert in fuzzing, remove before deployment
        uint256 oldColl = contractsCache.troveManager.getTroveEntireColl(_troveId);
        _adjustTrove(msg.sender, _troveId, _ETHAmount, true, 0, false, contractsCache);
        assert(contractsCache.troveManager.getTroveEntireColl(_troveId) > oldColl);
    }

    // Withdraw ETH collateral from a trove
    function withdrawColl(uint256 _troveId, uint256 _collWithdrawal) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);
        // TODO: Use oldColl and assert in fuzzing, remove before deployment
        uint256 oldColl = contractsCache.troveManager.getTroveEntireColl(_troveId);
        _adjustTrove(msg.sender, _troveId, _collWithdrawal, false, 0, false, contractsCache);
        assert(contractsCache.troveManager.getTroveEntireColl(_troveId) < oldColl);
    }

    // Withdraw Bold tokens from a trove: mint new Bold tokens to the owner, and increase the trove's debt accordingly
    function withdrawBold(uint256 _troveId, uint256 _boldAmount) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);
        // TODO: Use oldDebt and assert in fuzzing, remove before deployment
        uint256 oldDebt = contractsCache.troveManager.getTroveEntireDebt(_troveId);
        _adjustTrove(msg.sender, _troveId, 0, false, _boldAmount, true, contractsCache);
        assert(contractsCache.troveManager.getTroveEntireDebt(_troveId) > oldDebt);
    }

    // Repay Bold tokens to a Trove: Burn the repaid Bold tokens, and reduce the trove's debt accordingly
    function repayBold(uint256 _troveId, uint256 _boldAmount) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);
        // TODO: Use oldDebt and assert in fuzzing, remove before deployment
        uint256 oldDebt = contractsCache.troveManager.getTroveEntireDebt(_troveId);
        _adjustTrove(msg.sender, _troveId, 0, false, _boldAmount, false, contractsCache);
        assert(contractsCache.troveManager.getTroveEntireDebt(_troveId) < oldDebt);
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
        _adjustTrove(msg.sender, _troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, contractsCache);
        contractsCache.troveManager.setTroveStatusToActive(_troveId);
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
        ContractsCacheTMAP memory contractsCache = ContractsCacheTMAP(troveManager, activePool);

        uint256 price = priceFeed.fetchPrice();

        _requireValidAnnualInterestRate(_newAnnualInterestRate);
        // TODO: Delegation functionality
        _requireIsOwner(contractsCache.troveManager, _troveId);
        _requireTroveIsActive(contractsCache.troveManager, _troveId);

        ITroveManager.LatestTroveData memory trove = contractsCache.troveManager.getLatestTroveData(_troveId);

        contractsCache.troveManager.applyRedistributionGains(_troveId, trove.redistBoldDebtGain, trove.redistETHGain);

        uint256 newWeightedRecordedDebt = trove.entireDebt * _newAnnualInterestRate;
        uint256 newUpfrontInterest = newWeightedRecordedDebt * UPFRONT_INTEREST_PERIOD / ONE_YEAR / DECIMAL_PRECISION;
        uint256 newEntireDebt = trove.entireDebt + newUpfrontInterest;

        uint256 newTCR = _getNewTCRFromTroveChange(
            0, // _collIncrease
            0, // _collDecrease
            0, // _debtIncrease
            0, // _debtDecrease
            newUpfrontInterest,
            trove.recordedUpfrontInterest,
            trove.unusedUpfrontInterest,
            price
        );
        _requireNewTCRisAboveCCR(newTCR);

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(
            trove.redistBoldDebtGain,
            0, // _debtIncrease
            0, // _debtDecrease
            newWeightedRecordedDebt,
            trove.weightedRecordedDebt,
            newUpfrontInterest,
            trove.recordedUpfrontInterest,
            trove.unusedUpfrontInterest
        );

        sortedTroves.reInsert(_troveId, _newAnnualInterestRate, _upperHint, _lowerHint);

        contractsCache.troveManager.setTrovePropertiesOnInterestRateAdjustment(
            _troveId, trove.entireColl, trove.entireDebt, newUpfrontInterest, _newAnnualInterestRate
        );

        emit TroveUpdated(_troveId, trove.entireColl, newEntireDebt, Operation.adjustTroveInterestRate);
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
        vars.isBelowCriticalThreshold = _checkBelowCriticalThreshold(vars.price);

        // --- Checks ---

        if (_isCollIncrease) {
            _requireNonZeroCollChange(_collChange);
        }

        if (_isDebtIncrease) {
            _requireNonZeroDebtChange(_boldChange);
        }

        _requireNonZeroAdjustment(_collChange, _boldChange);
        _requireTroveIsOpen(_contractsCache.troveManager, _troveId);

        ITroveManager.LatestTroveData memory data = _contractsCache.troveManager.getLatestTroveData(_troveId);

        // When the adjustment is a debt repayment, check it's a valid amount and that the caller has enough Bold
        if (!_isDebtIncrease && _boldChange > 0) {
            _requireValidBoldRepayment(data.entireDebt, _boldChange);
            _requireSufficientBoldBalance(_contractsCache.boldToken, msg.sender, _boldChange);
        }

        // When the adjustment is a collateral withdrawal, check that it's no more than the Trove's entire collateral
        if (!_isCollIncrease && _collChange > 0) {
            _requireValidCollWithdrawal(data.entireColl, _collChange);
        }

        vars.newRecordedDebt = data.entireDebt - data.unusedUpfrontInterest;
        vars.newUpfrontInterest = data.unusedUpfrontInterest;

        if (_isDebtIncrease) {
            vars.newRecordedDebt += _boldChange;
            vars.newUpfrontInterest +=
                _boldChange * data.annualInterestRate * UPFRONT_INTEREST_PERIOD / ONE_YEAR / DECIMAL_PRECISION;
        } else {
            uint256 repaidRecordedDebt = vars.newRecordedDebt * _boldChange / data.entireDebt;
            vars.forgoneUpfrontInterest = _boldChange - repaidRecordedDebt;
            vars.newRecordedDebt -= repaidRecordedDebt;
            vars.newUpfrontInterest -= vars.forgoneUpfrontInterest;
        }

        // Make sure the Trove doesn't become unredeemable
        _requireAtLeastMinDebt(vars.newRecordedDebt);

        vars.newWeightedRecordedDebt = vars.newRecordedDebt * data.annualInterestRate;
        vars.newEntireColl = _isCollIncrease ? data.entireColl + _collChange : data.entireColl - _collChange;
        vars.newEntireDebt = vars.newRecordedDebt + vars.newUpfrontInterest;

        vars.newICR = LiquityMath._computeCR(vars.newEntireColl, vars.newEntireDebt, vars.price);
        vars.newTCR = _getNewTCRFromTroveChange(
            _isCollIncrease ? _collChange : 0, // _collIncrease
            _isCollIncrease ? 0 : _collChange, // _collDecrease
            _isDebtIncrease ? _boldChange : 0, // _debtIncrease
            _isDebtIncrease ? 0 : _boldChange, // _debtDecrease
            vars.newUpfrontInterest,
            data.recordedUpfrontInterest,
            vars.forgoneUpfrontInterest,
            vars.price
        );

        // Check the adjustment satisfies all conditions for the current system mode
        _requireValidAdjustmentInCurrentMode(_collChange, _isCollIncrease, _boldChange, _isDebtIncrease, vars);

        // --- Effects and interactions ---

        _contractsCache.troveManager.applyRedistributionGains(_troveId, data.redistBoldDebtGain, data.redistETHGain);

        // Update the Trove's recorded properties
        _contractsCache.troveManager.setTrovePropertiesOnAdjustment(
            _sender,
            _troveId,
            vars.newEntireColl,
            vars.newRecordedDebt,
            vars.newUpfrontInterest,
            _isCollIncrease,
            !_isCollIncrease && _collChange > 0, // _isCollDecrease
            _isDebtIncrease,
            !_isDebtIncrease && _boldChange > 0 // _isDebtDecrease
        );

        _contractsCache.troveManager.updateStakeAndTotalStakes(_troveId);

        _contractsCache.activePool.mintAggInterestAndAccountForTroveChange(
            data.redistBoldDebtGain,
            _isDebtIncrease ? _boldChange : 0, // _debtIncrease
            _isDebtIncrease ? 0 : _boldChange, // _debtDecrease
            vars.newWeightedRecordedDebt,
            data.weightedRecordedDebt,
            vars.newUpfrontInterest,
            data.recordedUpfrontInterest,
            vars.forgoneUpfrontInterest
        );

        emit TroveUpdated(_troveId, vars.newEntireDebt, vars.newEntireColl, Operation.adjustTrove);

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

        ITroveManager.LatestTroveData memory data = contractsCache.troveManager.getLatestTroveData(_troveId);

        // The borrower must repay their entire debt including accrued interest and redist. gains (and less the gas comp.)
        _requireSufficientBoldBalance(contractsCache.boldToken, msg.sender, data.entireDebt - BOLD_GAS_COMPENSATION);

        uint256 newTCR = _getNewTCRFromTroveChange(
            0, // _collIncrease
            data.entireColl,
            0, // _debtIncrease
            data.entireDebt,
            0, // _newRecordedUpfrontInterest
            data.recordedUpfrontInterest,
            data.unusedUpfrontInterest,
            price
        );
        _requireNewTCRisAboveCCR(newTCR);

        // --- Effects and interactions ---

        // TODO: gas optimization of redistribution gains. We don't need to update the Trove's reward snapshots, since
        // we'll zero them at the end.
        contractsCache.troveManager.applyRedistributionGains(_troveId, data.redistBoldDebtGain, data.redistETHGain);

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(
            data.redistBoldDebtGain,
            0, // _debtIncrease
            data.entireDebt,
            0, // _newWeightedRecordedDebt
            data.weightedRecordedDebt,
            0, // _newRecordedUpfrontInterest
            data.recordedUpfrontInterest,
            data.unusedUpfrontInterest
        );

        contractsCache.troveManager.removeStake(_troveId);
        contractsCache.troveManager.closeTrove(_troveId);
        emit TroveUpdated(_troveId, 0, 0, Operation.closeTrove);

        // Burn the 200 BOLD gas compensation
        contractsCache.boldToken.burn(gasPoolAddress, BOLD_GAS_COMPENSATION);
        // Burn the remainder of the Trove's entire debt from the user
        contractsCache.boldToken.burn(msg.sender, data.entireDebt - BOLD_GAS_COMPENSATION);

        // Send the collateral back to the user
        contractsCache.activePool.sendETH(msg.sender, data.entireColl);
    }

    function applyTroveInterestPermissionless(uint256 _troveId) external {
        ContractsCacheTMAP memory contractsCache = ContractsCacheTMAP(troveManager, activePool);

        _requireTroveIsStale(contractsCache.troveManager, _troveId);
        _requireTroveIsOpen(contractsCache.troveManager, _troveId);

        ITroveManager.LatestTroveData memory data = contractsCache.troveManager.getLatestTroveData(_troveId);

        contractsCache.troveManager.applyRedistributionGains(_troveId, data.redistBoldDebtGain, data.redistETHGain);

        uint256 newRecordedDebt = data.entireDebt - data.unusedUpfrontInterest;
        uint256 newWeightedRecordedDebt = newRecordedDebt * data.annualInterestRate;

        contractsCache.activePool.mintAggInterestAndAccountForTroveChange(
            data.redistBoldDebtGain,
            0, // _debtIncrease
            0, // _debtDecrease
            newWeightedRecordedDebt,
            data.weightedRecordedDebt,
            data.unusedUpfrontInterest,
            data.recordedUpfrontInterest,
            0 // _forgoneUpfrontInterest
        );

        contractsCache.troveManager.setTrovePropertiesOnInterestApplication(
            _troveId, data.entireColl, newRecordedDebt, data.unusedUpfrontInterest
        );

        emit TroveUpdated(_troveId, data.entireColl, data.entireDebt, Operation.applyTroveInterestPermissionless);
    }

    function setAddManager(uint256 _troveId, address _manager) external {
        troveManager.setAddManager(msg.sender, _troveId, _manager);
    }

    function setRemoveManager(uint256 _troveId, address _manager) external {
        troveManager.setRemoveManager(msg.sender, _troveId, _manager);
    }

    /**
     * Claim remaining collateral from a redemption or from a liquidation with ICR > MCR in Recovery Mode
     */
    function claimCollateral(uint256 _troveId) external override {
        _requireIsOwner(troveManager, _troveId);

        // send ETH from CollSurplus Pool to owner
        collSurplusPool.claimColl(msg.sender, _troveId);
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

    function _requireIsOwner(ITroveManager _troveManager, uint256 _troveId) internal view {
        require(_troveManager.ownerOf(_troveId) == msg.sender, "BO: Only owner");
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
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        LocalVariables_adjustTrove memory _vars
    ) internal pure {
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
            _requireNoBorrowing(_isDebtIncrease);
            _requireDebtRepaymentGeCollWithdrawal(
                _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _vars.price
            );
        } else {
            // if Normal Mode
            _requireICRisAboveMCR(_vars.newICR);
            _requireNewTCRisAboveCCR(_vars.newTCR);
        }
    }

    function _requireICRisAboveMCR(uint256 _newICR) internal pure {
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

    function _getNewTCRFromTroveChange(
        uint256 _collIncrease,
        uint256 _collDecrease,
        uint256 _debtIncrease,
        uint256 _debtDecrease,
        uint256 _newRecordedUpfrontInterest,
        uint256 _oldRecordedUpfrontInterest,
        uint256 _forgoneUpfrontInterest,
        uint256 _price
    ) internal view returns (uint256 newTCR) {
        uint256 totalColl = getEntireSystemColl();
        totalColl += _collIncrease;
        totalColl -= _collDecrease;

        uint256 totalDebt = getEntireSystemDebtUpperBound();
        totalDebt += _debtIncrease;
        totalDebt += _forgoneUpfrontInterest;
        totalDebt += _newRecordedUpfrontInterest;
        totalDebt -= _debtDecrease;
        totalDebt -= _oldRecordedUpfrontInterest;

        newTCR = LiquityMath._computeCR(totalColl, totalDebt, _price);
    }

    function getCompositeDebt(uint256 _debt) external pure override returns (uint256) {
        return _debt + BOLD_GAS_COMPENSATION;
    }
}
