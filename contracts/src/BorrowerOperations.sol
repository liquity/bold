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
    address stabilityPoolAddress;
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
        uint256 recordedDebtIncrease;
        uint256 recordedDebtDecrease;
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
    event StabilityPoolAddressChanged(address _stabilityPoolAddress);
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

    constructor(address _ETHAddress) {
        checkContract(_ETHAddress);
        ETH = IERC20(_ETHAddress);
    }

    // --- Dependency setters ---

    function setAddresses(
        address _troveManagerAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
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
        checkContract(_stabilityPoolAddress);
        checkContract(_gasPoolAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_priceFeedAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_boldTokenAddress);

        troveManager = ITroveManager(_troveManagerAddress);
        activePool = IActivePool(_activePoolAddress);
        defaultPool = IDefaultPool(_defaultPoolAddress);
        stabilityPoolAddress = _stabilityPoolAddress;
        gasPoolAddress = _gasPoolAddress;
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        boldToken = IBoldToken(_boldTokenAddress);

        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
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
        uint256 _maxFeePercentage,
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

        bool isRecoveryMode = _checkRecoveryMode(vars.price);

        _requireValidAnnualInterestRate(_annualInterestRate);
        _requireValidMaxFeePercentage(_maxFeePercentage, isRecoveryMode);

        uint256 troveId = uint256(keccak256(abi.encode(_owner, _ownerIndex)));
        _requireTroveisNotActive(contractsCache.troveManager, troveId);

        _requireAtLeastMinNetDebt(_boldAmount);

        // ICR is based on the composite debt, i.e. the requested Bold amount + Bold gas comp.
        vars.compositeDebt = _getCompositeDebt(_boldAmount);
        assert(vars.compositeDebt > 0);

        vars.ICR = LiquityMath._computeCR(_ETHAmount, vars.compositeDebt, vars.price);

        if (isRecoveryMode) {
            _requireICRisAboveCCR(vars.ICR);
        } else {
            _requireICRisAboveMCR(vars.ICR);
            uint256 newTCR = _getNewTCRFromTroveChange(_ETHAmount, true, vars.compositeDebt, true, vars.price); // bools: coll increase, debt increase
            _requireNewTCRisAboveCCR(newTCR);
        }

        // --- Effects & interactions ---

        uint256 weightedRecordedTroveDebt = vars.compositeDebt * _annualInterestRate;
        contractsCache.activePool.mintAggInterest(
            vars.compositeDebt, 0, vars.compositeDebt, 0, weightedRecordedTroveDebt, 0
        );

        // Set the stored Trove properties and mint the NFT
        vars.stake = contractsCache.troveManager.setTrovePropertiesOnOpen(
            _owner, troveId, _ETHAmount, vars.compositeDebt, _annualInterestRate
        );

        sortedTroves.insert(troveId, _annualInterestRate, _upperHint, _lowerHint);
        vars.arrayIndex = contractsCache.troveManager.addTroveIdToArray(troveId);
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
        _adjustTrove(msg.sender, _troveId, _ETHAmount, true, 0, false, 0);
    }

    // Send ETH as collateral to a trove. Called by only the Stability Pool.
    function moveETHGainToTrove(address _sender, uint256 _troveId, uint256 _ETHAmount) external override {
        _requireCallerIsStabilityPool();
        // TODO: check owner?
        _adjustTrove(_sender, _troveId, _ETHAmount, true, 0, false, 0);
    }

    // Withdraw ETH collateral from a trove
    function withdrawColl(uint256 _troveId, uint256 _collWithdrawal) external override {
        _adjustTrove(msg.sender, _troveId, _collWithdrawal, false, 0, false, 0);
    }

    // Withdraw Bold tokens from a trove: mint new Bold tokens to the owner, and increase the trove's debt accordingly
    function withdrawBold(uint256 _troveId, uint256 _maxFeePercentage, uint256 _boldAmount) external override {
        _adjustTrove(msg.sender, _troveId, 0, false, _boldAmount, true, _maxFeePercentage);
    }

    // Repay Bold tokens to a Trove: Burn the repaid Bold tokens, and reduce the trove's debt accordingly
    function repayBold(uint256 _troveId, uint256 _boldAmount) external override {
        _adjustTrove(msg.sender, _troveId, 0, false, _boldAmount, false, 0);
    }

    function adjustTrove(
        uint256 _troveId,
        uint256 _maxFeePercentage,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease
    ) external override {
        _adjustTrove(
            msg.sender, _troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _maxFeePercentage
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

        _requireTroveisActive(contractsCache.troveManager, _troveId);

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
        uint256 _maxFeePercentage
    ) internal {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        LocalVariables_adjustTrove memory vars;

        vars.price = priceFeed.fetchPrice();

        vars.initialWeightedRecordedTroveDebt = contractsCache.troveManager.getTroveWeightedRecordedDebt(_troveId);
        vars.annualInterestRate = contractsCache.troveManager.getTroveAnnualInterestRate(_troveId);

        // --- Checks ---

        bool isRecoveryMode = _checkRecoveryMode(vars.price);

        if (_isCollIncrease) {
            _requireNonZeroCollChange(_collChange);
        }
        if (_isDebtIncrease) {
            _requireValidMaxFeePercentage(_maxFeePercentage, isRecoveryMode);
            _requireNonZeroDebtChange(_boldChange);
        }
        _requireNonZeroAdjustment(_collChange, _boldChange);
        _requireTroveisActive(contractsCache.troveManager, _troveId);

        // Confirm the operation is an ETH transfer if coming from the Stability Pool to a trove
        assert((msg.sender != stabilityPoolAddress || (_isCollIncrease && _boldChange == 0)));

        (vars.entireDebt, vars.entireColl, vars.redistDebtGain,, vars.accruedTroveInterest) =
            contractsCache.troveManager.getEntireDebtAndColl(_troveId);

        // Get the trove's old ICR before the adjustment, and what its new ICR will be after the adjustment
        vars.oldICR = LiquityMath._computeCR(vars.entireColl, vars.entireDebt, vars.price);
        vars.newICR = _getNewICRFromTroveChange(
            vars.entireColl, vars.entireDebt, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, vars.price
        );
        assert(_isCollIncrease || _collChange <= vars.entireColl); // TODO: do we still need this?

        // Check the adjustment satisfies all conditions for the current system mode
        _requireValidAdjustmentInCurrentMode(
            isRecoveryMode, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, vars
        );

        // When the adjustment is a debt repayment, check it's a valid amount and that the caller has enough Bold
        if (!_isDebtIncrease && _boldChange > 0) {
            _requireAtLeastMinNetDebt(_getNetDebt(vars.entireDebt) - _boldChange);
            _requireValidBoldRepayment(vars.entireDebt, _boldChange);
            _requireSufficientBoldBalance(contractsCache.boldToken, msg.sender, _boldChange);
        }

        // --- Effects and interactions ---

        contractsCache.troveManager.getAndApplyRedistributionGains(_troveId);

        // Update the Trove's recorded coll and debt
        vars.newEntireColl = _updateTroveCollFromAdjustment(
            contractsCache.troveManager, _sender, _troveId, vars.entireColl, _collChange, _isCollIncrease
        );
        vars.newEntireDebt = _updateTroveDebtFromAdjustment(
            contractsCache.troveManager,
            _sender,
            _troveId,
            vars.entireDebt,
            _boldChange,
            _isDebtIncrease,
            vars.accruedTroveInterest
        );

        vars.stake = contractsCache.troveManager.updateStakeAndTotalStakes(_troveId);

        vars.newWeightedTroveDebt = vars.newEntireDebt * vars.annualInterestRate;

        if (_isDebtIncrease) {
            // Increase Trove debt by the drawn debt + redist. gain
            vars.troveDebtIncrease = _boldChange + vars.redistDebtGain;
            vars.recordedDebtIncrease = _boldChange + vars.accruedTroveInterest;
        } else {
            // Increase Trove debt by redist. gain and decrease by the repaid debt
            vars.troveDebtIncrease = vars.redistDebtGain;
            vars.troveDebtDecrease = _boldChange;

            vars.recordedDebtIncrease = vars.accruedTroveInterest;
            vars.recordedDebtDecrease = _boldChange;
        }

        activePool.mintAggInterest(
            vars.troveDebtIncrease,
            vars.troveDebtDecrease,
            vars.recordedDebtIncrease,
            vars.recordedDebtDecrease,
            vars.newWeightedTroveDebt,
            vars.initialWeightedRecordedTroveDebt
        );

        emit TroveUpdated(_troveId, vars.newEntireDebt, vars.newEntireColl, vars.stake, BorrowerOperation.adjustTrove);
        emit BoldBorrowingFeePaid(_troveId, vars.BoldFee); // TODO

        _moveTokensAndETHfromAdjustment(
            contractsCache.activePool,
            contractsCache.boldToken,
            contractsCache.troveManager,
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
        _requireTroveisActive(contractsCache.troveManager, _troveId);
        uint256 price = priceFeed.fetchPrice();
        _requireNotInRecoveryMode(price);

        uint256 initialWeightedRecordedTroveDebt = contractsCache.troveManager.getTroveWeightedRecordedDebt(_troveId);
        uint256 initialRecordedTroveDebt = contractsCache.troveManager.getTroveDebt(_troveId);

        (
            uint256 entireTroveDebt,
            uint256 entireTroveColl,
            uint256 debtRedistGain,
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
        // Remove only the Trove's latest recorded debt (inc. redist. gains) from the recorded debt tracker,
        // i.e. exclude the accrued interest since it has not been added.
        // TODO: If/when redist. gains are gas-optimized, exclude them from here too.
        uint256 recordedDebtSumDecrease = initialRecordedTroveDebt + debtRedistGain;

        contractsCache.activePool.mintAggInterest(
            0, troveDebtDecrease, 0, recordedDebtSumDecrease, 0, initialWeightedRecordedTroveDebt
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
        _requireTroveisActive(contractsCache.troveManager, _troveId);

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
     * Claim remaining collateral from a redemption or from a liquidation with ICR > MCR in Recovery Mode
     */
    function claimCollateral(uint256 _troveId) external override {
        _requireIsOwner(_troveId);

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
            address borrower = _troveManager.ownerOf(_troveId);
            _boldToken.mint(borrower, _boldChange);
        } else {
            _boldToken.burn(msg.sender, _boldChange);
        }

        if (_isCollIncrease) {
            // Pull ETH tokens from sender and move them to the Active Pool
            _pullETHAndSendToActivePool(_activePool, _collChange);
        } else {
            address borrower = _troveManager.ownerOf(_troveId);
            // Pull ETH from Active Pool and decrease its recorded ETH balance
            _activePool.sendETH(borrower, _collChange);
        }
    }

    function _pullETHAndSendToActivePool(IActivePool _activePool, uint256 _amount) internal {
        // Pull ETH tokens from sender (we may save gas by pulling directly from Active Pool, but then the approval UX for user would be weird)
        ETH.safeTransferFrom(msg.sender, address(this), _amount);
        // Move the ether to the Active Pool
        _activePool.receiveETH(_amount);
    }

    function _updateActivePoolTrackersNoDebtChange(
        ITroveManager _troveManager,
        IActivePool _activePool,
        uint256 _troveId,
        uint256 _annualInterestRate
    ) internal returns (uint256) {
        uint256 initialWeightedRecordedTroveDebt = _troveManager.getTroveWeightedRecordedDebt(_troveId);
        // --- Effects ---

        (, uint256 redistDebtGain) = _troveManager.getAndApplyRedistributionGains(_troveId);

        uint256 accruedTroveInterest = _troveManager.calcTroveAccruedInterest(_troveId);
        uint256 recordedTroveDebt = _troveManager.getTroveDebt(_troveId);
        uint256 entireTroveDebt = recordedTroveDebt + accruedTroveInterest;
        uint256 newWeightedTroveDebt = entireTroveDebt * _annualInterestRate;
        // Add only the Trove's accrued interest to the recorded debt tracker since we have already applied redist. gains.
        // No debt is issued/repaid, so the net Trove debt change is purely the redistribution gain
        // TODO: also include redist. gains here in the recordedSumIncrease arg if we gas-optimize them
        _activePool.mintAggInterest(
            redistDebtGain, 0, accruedTroveInterest, 0, newWeightedTroveDebt, initialWeightedRecordedTroveDebt
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

    function _requireTroveisActive(ITroveManager _troveManager, uint256 _troveId) internal view {
        uint256 status = _troveManager.getTroveStatus(_troveId);
        require(status == 1, "BorrowerOps: Trove does not exist or is closed");
    }

    function _requireTroveisNotActive(ITroveManager _troveManager, uint256 _troveId) internal view {
        uint256 status = _troveManager.getTroveStatus(_troveId);
        require(status != 1, "BorrowerOps: Trove is active");
    }

    function _requireNonZeroCollChange(uint256 _collChange) internal pure {
        require(_collChange > 0, "BorrowerOps: Coll increase requires non-zero collChange");
    }

    function _requireNonZeroDebtChange(uint256 _boldChange) internal pure {
        require(_boldChange > 0, "BorrowerOps: Debt increase requires non-zero debtChange");
    }

    function _requireNotInRecoveryMode(uint256 _price) internal view {
        require(!_checkRecoveryMode(_price), "BorrowerOps: Operation not permitted during Recovery Mode");
    }

    function _requireNoCollWithdrawal(uint256 _collWithdrawal, bool _isCollIncrease) internal pure {
        require(
            _collWithdrawal == 0 || _isCollIncrease, "BorrowerOps: Collateral withdrawal not permitted Recovery Mode"
        );
    }

    function _requireValidAdjustmentInCurrentMode(
        bool _isRecoveryMode,
        uint256 _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        LocalVariables_adjustTrove memory _vars
    ) internal view {
        /*
        *In Recovery Mode, only allow:
        *
        * - Pure collateral top-up
        * - Pure debt repayment
        * - Collateral top-up with debt repayment
        * - A debt increase combined with a collateral top-up which makes the ICR >= 150% and improves the ICR (and by extension improves the TCR).
        *
        * In Normal Mode, ensure:
        *
        * - The new ICR is above MCR
        * - The adjustment won't pull the TCR below CCR
        */
        if (_isRecoveryMode) {
            _requireNoCollWithdrawal(_collChange, _isCollIncrease);
            if (_isDebtIncrease) {
                _requireICRisAboveCCR(_vars.newICR);
                _requireNewICRisAboveOldICR(_vars.newICR, _vars.oldICR);
            }
        } else {
            // if Normal Mode
            _requireICRisAboveMCR(_vars.newICR);
            _vars.newTCR =
                _getNewTCRFromTroveChange(_collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _vars.price);
            _requireNewTCRisAboveCCR(_vars.newTCR);
        }
    }

    function _requireICRisAboveMCR(uint256 _newICR) internal pure {
        require(_newICR >= MCR, "BorrowerOps: An operation that would result in ICR < MCR is not permitted");
    }

    function _requireICRisAboveCCR(uint256 _newICR) internal pure {
        require(_newICR >= CCR, "BorrowerOps: Operation must leave trove with ICR >= CCR");
    }

    function _requireNewICRisAboveOldICR(uint256 _newICR, uint256 _oldICR) internal pure {
        require(_newICR >= _oldICR, "BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode");
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

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "BorrowerOps: Caller is not Stability Pool");
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

    function _requireValidMaxFeePercentage(uint256 _maxFeePercentage, bool _isRecoveryMode) internal pure {
        if (_isRecoveryMode) {
            require(_maxFeePercentage <= DECIMAL_PRECISION, "Max fee percentage must less than or equal to 100%");
        } else {
            require(
                _maxFeePercentage >= BORROWING_FEE_FLOOR && _maxFeePercentage <= DECIMAL_PRECISION,
                "Max fee percentage must be between 0.5% and 100%"
            );
        }
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
