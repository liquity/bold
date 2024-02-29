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

    string constant public NAME = "BorrowerOperations";

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
        uint price;
        uint entireDebt;
        uint entireColl;
        uint256 redistDebtGain;
        uint256 accruedTroveInterest;
        uint oldICR;
        uint newICR;
        uint newTCR;
        uint BoldFee;
        uint newEntireDebt;
        uint newEntireColl;
        uint stake;
    }

    struct LocalVariables_openTrove {
        uint price;
        uint BoldFee;
        uint netDebt;
        uint compositeDebt;
        uint ICR;
        uint stake;
        uint arrayIndex;
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
    event PriceFeedAddressChanged(address  _newPriceFeedAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event BoldTokenAddressChanged(address _boldTokenAddress);

    event TroveCreated(address indexed _owner, uint256 _troveId, uint256 _arrayIndex);
    event TroveUpdated(uint256 indexed _troveId, uint _debt, uint _coll, uint stake, BorrowerOperation operation);
    event BoldBorrowingFeePaid(uint256 indexed _troveId, uint _boldFee);

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
    )
        external
        override
        onlyOwner
    {
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
        uint _maxFeePercentage,
        uint256 _ETHAmount,
        uint _boldAmount,
        uint256 _upperHint,
        uint256 _lowerHint,
        uint256 _annualInterestRate
    )
        external
        override
        returns (uint256)
    {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        LocalVariables_openTrove memory vars;

        vars.price = priceFeed.fetchPrice();

        // --- Checks ---

        bool isRecoveryMode = _checkRecoveryMode(vars.price);

        _requireValidAnnualInterestRate(_annualInterestRate);
        _requireValidMaxFeePercentage(_maxFeePercentage, isRecoveryMode);

        uint256 troveId = uint256(keccak256(abi.encode(_owner, _ownerIndex)));
        _requireTroveisNotActive(contractsCache.troveManager, troveId);

        vars.BoldFee;

        _requireAtLeastMinNetDebt(_boldAmount);

        // ICR is based on the composite debt, i.e. the requested Bold amount + Bold gas comp.
        vars.compositeDebt = _getCompositeDebt(_boldAmount);
        assert(vars.compositeDebt > 0);

        vars.ICR = LiquityMath._computeCR(_ETHAmount, vars.compositeDebt, vars.price);

        if (isRecoveryMode) {
            _requireICRisAboveCCR(vars.ICR);
        } else {
            _requireICRisAboveMCR(vars.ICR);
            uint newTCR = _getNewTCRFromTroveChange(_ETHAmount, true, vars.compositeDebt, true, vars.price);  // bools: coll increase, debt increase
            _requireNewTCRisAboveCCR(newTCR);
        }

        // --- Effects & interactions ---

        contractsCache.activePool.mintAggInterest(vars.compositeDebt, 0);

        // Set the stored Trove properties and mint the NFT
        vars.stake = contractsCache.troveManager.setTrovePropertiesOnOpen(
            _owner,
            troveId,
            _ETHAmount,
            vars.compositeDebt,
            _annualInterestRate
        );

        sortedTroves.insert(troveId, _annualInterestRate, _upperHint, _lowerHint);
        vars.arrayIndex = contractsCache.troveManager.addTroveIdToArray(troveId);
        emit TroveCreated(_owner, troveId, vars.arrayIndex);

        // Pull ETH tokens from sender and move them to the Active Pool
        _pullETHAndSendToActivePool(contractsCache.activePool, _ETHAmount);

        // Mint the requested _boldAmount to the borrower and mint the gas comp to the GasPool
        contractsCache.boldToken.mint(msg.sender, _boldAmount);
        contractsCache.boldToken.mint(gasPoolAddress, BOLD_GAS_COMPENSATION);

        // Add the whole debt to the recorded debt tracker
        contractsCache.activePool.increaseRecordedDebtSum(vars.compositeDebt);
        // Add the whole weighted debt to the weighted recorded debt tracker
        contractsCache.activePool.changeAggWeightedDebtSum(0, vars.compositeDebt * _annualInterestRate);

        emit TroveUpdated(troveId, vars.compositeDebt, _ETHAmount, vars.stake, BorrowerOperation.openTrove);
        emit BoldBorrowingFeePaid(troveId, vars.BoldFee);

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
    function withdrawColl(uint256 _troveId, uint _collWithdrawal) external override {
        _adjustTrove(msg.sender, _troveId, _collWithdrawal, false, 0, false, 0);
    }

    // Withdraw Bold tokens from a trove: mint new Bold tokens to the owner, and increase the trove's debt accordingly
    function withdrawBold(uint256 _troveId, uint _maxFeePercentage, uint _boldAmount ) external override {
        _adjustTrove(msg.sender, _troveId, 0, false, _boldAmount, true, _maxFeePercentage);
    }

    // Repay Bold tokens to a Trove: Burn the repaid Bold tokens, and reduce the trove's debt accordingly
    function repayBold(uint256 _troveId, uint _boldAmount) external override {
        _adjustTrove(msg.sender, _troveId, 0, false, _boldAmount, false, 0);
    }

    function adjustTrove(
        uint256 _troveId,
        uint _maxFeePercentage,
        uint _collChange,
        bool _isCollIncrease,
        uint _boldChange,
        bool _isDebtIncrease
    )
        external
        override
    {
        _adjustTrove(msg.sender, _troveId, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _maxFeePercentage);
    }

    function adjustTroveInterestRate(uint256 _troveId, uint _newAnnualInterestRate, uint256 _upperHint, uint256 _lowerHint) external {
        // TODO: Delegation functionality

        ContractsCacheTMAP memory contractsCache = ContractsCacheTMAP(troveManager, activePool);

        _requireValidAnnualInterestRate(_newAnnualInterestRate);
        _requireTroveisActive(contractsCache.troveManager, _troveId);

        uint256 entireTroveDebt = _updateActivePoolTrackersNoDebtChange(contractsCache.troveManager, contractsCache.activePool, _troveId, _newAnnualInterestRate);

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
        uint _collChange,
        bool _isCollIncrease,
        uint _boldChange,
        bool _isDebtIncrease,
        uint _maxFeePercentage
    )
        internal
    {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        LocalVariables_adjustTrove memory vars;

        vars.price = priceFeed.fetchPrice();

        uint256 initialWeightedRecordedTroveDebt = contractsCache.troveManager.getTroveWeightedRecordedDebt(_borrower);
        uint256 annualInterestRate = contractsCache.troveManager.getTroveAnnualInterestRate(_borrower);

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

        // Get the collChange based on whether or not ETH was sent in the transaction
        (vars.collChange, vars.isCollIncrease) = _getCollChange(msg.value, _collWithdrawal);

        (vars.entireDebt, vars.entireColl, vars.redistDebtGain, , vars.accruedTroveInterest) = contractsCache.troveManager.getEntireDebtAndColl(_troveId);

        // Get the trove's old ICR before the adjustment, and what its new ICR will be after the adjustment
        vars.oldICR = LiquityMath._computeCR(vars.entireColl, vars.entireDebt, vars.price);
        vars.newICR = _getNewICRFromTroveChange(
            vars.entireColl,
            vars.entireDebt,
            _collChange,
            _isCollIncrease,
            _boldChange,
            _isDebtIncrease,
            vars.price
        );
        assert(_isCollIncrease || _collChange <= vars.entireColl); // TODO: do we still need this?

        // Check the adjustment satisfies all conditions for the current system mode
        _requireValidAdjustmentInCurrentMode(isRecoveryMode, _collChange, _isCollIncrease, _boldChange, _isDebtIncrease, vars);

        // When the adjustment is a debt repayment, check it's a valid amount and that the caller has enough Bold
        if (!_isDebtIncrease && _boldChange > 0) {
            _requireAtLeastMinNetDebt(_getNetDebt(vars.entireDebt) - _boldChange);
            _requireValidBoldRepayment(vars.entireDebt, _boldChange);
            _requireSufficientBoldBalance(contractsCache.boldToken, msg.sender, _boldChange);
        }

        // --- Effects and interactions ---

        contractsCache.troveManager.getAndApplyRedistributionGains(_borrower);

        if (_isDebtIncrease) {
            // Increase Trove debt by the drawn debt + redist. gain
            activePool.mintAggInterest(_boldChange + vars.redistDebtGain, 0);
        } else {
            // Increase Trove debt by redist. gain and decrease by the repaid debt
            activePool.mintAggInterest(vars.redistDebtGain, _boldChange);
        }

        // Update the Trove's recorded coll and debt
        vars.newEntireColl = _updateTroveCollFromAdjustment(contractsCache.troveManager, _troveId, vars.collChange, vars.isCollIncrease);
        vars.newEntireDebt = _updateTroveDebtFromAdjustment(contractsCache.troveManager, _troveId, vars.entireDebt, _boldChange, _isDebtIncrease);

        vars.stake = contractsCache.troveManager.updateStakeAndTotalStakes(_troveId);

        emit TroveUpdated(_troveId, vars.newEntireDebt, vars.newEntireColl, vars.stake, BorrowerOperation.adjustTrove);
        emit BoldBorrowingFeePaid(_troveId,  vars.BoldFee);

        _moveTokensAndETHfromAdjustment(
            contractsCache.activePool,
            contractsCache.boldToken,
            contractsCache.troveManager,
            _troveId,
            _collChange,
            _isCollIncrease,
            _boldChange,
            _isDebtIncrease,
            vars.accruedTroveInterest
        );

        contractsCache.activePool.changeAggWeightedDebtSum(initialWeightedRecordedTroveDebt, vars.newEntireDebt * annualInterestRate);
    }

    function closeTrove(uint256 _troveId) external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);

        // --- Checks ---

        _requireCallerIsBorrower(contractsCache.troveManager, _troveId);
        _requireTroveisActive(contractsCache.troveManager, _troveId);
        uint price = priceFeed.fetchPrice();
        _requireNotInRecoveryMode(price);

        uint256 initialWeightedRecordedTroveDebt = contractsCache.troveManager.getTroveWeightedRecordedDebt(_troveId);
        uint256 initialRecordedTroveDebt = contractsCache.troveManager.getTroveDebt(_troveId);

        (uint256 entireTroveDebt,
        uint256 entireTroveColl,
        uint256 debtRedistGain,
         , // ETHredist gain
        uint256 accruedTroveInterest) = contractsCache.troveManager.getEntireDebtAndColl(_troveId);

        // The borrower must repay their entire debt including accrued interest and redist. gains (and less the gas comp.)
        _requireSufficientBoldBalance(contractsCache.boldToken, msg.sender, entireTroveDebt - BOLD_GAS_COMPENSATION);

        // The TCR always includes A Trove's redist. gain and accrued interest, so we must use the Trove's entire debt here
        uint newTCR = _getNewTCRFromTroveChange(entireTroveColl, false, entireTroveDebt, false, price);
        _requireNewTCRisAboveCCR(newTCR);

        // --- Effects and interactions ---

        // TODO: gas optimization of redistribution gains. We don't need to actually update stored Trove debt & coll properties here, since we'll
        // zero them at the end.
        contractsCache.troveManager.getAndApplyRedistributionGains(_troveId);

        // Remove the Trove's initial recorded debt plus its accrued interest from ActivePool.aggRecordedDebt,
        // but *don't* remove the redistribution gains, since these were not yet incorporated into the sum.
        contractsCache.activePool.mintAggInterest(0, initialRecordedTroveDebt + accruedTroveInterest);

        contractsCache.troveManager.removeStake(_troveId);
        contractsCache.troveManager.closeTrove(_troveId, initialWeightedRecordedTroveDebt);
        emit TroveUpdated(_troveId, 0, 0, 0, BorrowerOperation.closeTrove);

        // Remove only the Trove's latest recorded debt (inc. redist. gains) from the recorded debt tracker,
        // i.e. exclude the accrued interest since it has not been added.
        // TODO: If/when redist. gains are gas-optimized, exclude them from here too.
        contractsCache.activePool.decreaseRecordedDebtSum(initialRecordedTroveDebt + debtRedistGain);

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

        uint256 entireTroveDebt = _updateActivePoolTrackersNoDebtChange(contractsCache.troveManager, contractsCache.activePool, _troveId, annualInterestRate);

        // Update Trove recorded debt and interest-weighted debt sum
        contractsCache.troveManager.updateTroveDebt(_troveId, entireTroveDebt);
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
        address owner = troveManager.ownerOf(_troveId);
        require(owner == msg.sender, "BO: Only owner can claim trove collateral");

        // send ETH from CollSurplus Pool to owner
        collSurplusPool.claimColl(msg.sender, _troveId);
    }

    // --- Helper functions ---

    function _getUSDValue(uint _coll, uint _price) internal pure returns (uint) {
        uint usdValue = _price * _coll / DECIMAL_PRECISION;

        return usdValue;
    }

    function _getCollChange(
        uint _collReceived,
        uint _requestedCollWithdrawal
    )
        internal
        pure
        returns(uint collChange, bool isCollIncrease)
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
    function _updateTroveCollFromAdjustment
    (
        ITroveManager _troveManager,
        address _sender,
        uint256 _troveId,
        uint256 _coll,
        uint _collChange,
        bool _isCollIncrease
    )
        internal
        returns (uint256)
    {
        uint256 newEntireColl;

        if (_collChange > 0) {
            newEntireColl = (_isCollIncrease) ?
                _troveManager.increaseTroveColl(_sender, _troveId, _collChange) :
                _troveManager.decreaseTroveColl(_sender, _troveId, _collChange);
        } else {
            newEntireColl = _coll;
        }

        return newEntireColl;
    }

    // Update Trove's coll whether they increased or decreased debt. Assumes any debt redistribution gain was already applied
    // to the Trove's debt.
    function _updateTroveDebtFromAdjustment(
        ITroveManager _troveManager,
        address _borrower,
        uint256 _oldEntireDebt,
        uint256  _debtChange,
        bool _isDebtIncrease
    )
        internal
        returns (uint256)
    {
        uint newEntireDebt;
        if (_debtChange > 0) {
            newEntireDebt= _isDebtIncrease ? _oldEntireDebt + _debtChange : _oldEntireDebt - _debtChange;
            _troveManager.updateTroveDebt(_troveId, newEntireDebt);
        } else {
            newEntireDebt = _oldEntireDebt;
        }

       return newEntireDebt;
    }

    // This function incorporates both the Trove's net debt change (repaid/drawn) and its accrued interest.
    // Redist. gains have already been applied before this is called.
    // TODO: explicitly pass redist. gains too if we gas-optimize them.
    function _moveTokensAndETHfromAdjustment
    (
        IActivePool _activePool,
        IBoldToken _boldToken,
        ITroveManager _troveManager,
        uint256 _troveId,
        uint _collChange,
        bool _isCollIncrease,
        uint _boldChange,
        bool _isDebtIncrease,
        uint256 _accruedTroveInterest
    )
        internal
    {
        if (_isDebtIncrease) {
            _activePool.increaseRecordedDebtSum(_boldChange + _accruedTroveInterest);
            address borrower = _troveManager.ownerOf(_troveId);
            _boldToken.mint(borrower, _boldChange);
        } else {
            // TODO: Gas optimize this
            _activePool.increaseRecordedDebtSum(_accruedTroveInterest);
            _activePool.decreaseRecordedDebtSum(_boldChange);

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

    function _updateActivePoolTrackersNoDebtChange
    (
        ITroveManager _troveManager,
        IActivePool _activePool,
        uint256 _troveId,
        uint256 _annualInterestRate
    )
        internal
        returns (uint256)
    {
        uint256 initialWeightedRecordedTroveDebt = _troveManager.getTroveWeightedRecordedDebt(_borrower);
        // --- Effects ---

        (, uint256 redistDebtGain) = _troveManager.getAndApplyRedistributionGains(_borrower);

        // No debt is issued/repaid, so the net Trove debt change is purely the redistribution gain
        _activePool.mintAggInterest(redistDebtGain, 0);

        uint256 accruedTroveInterest = _troveManager.calcTroveAccruedInterest(_borrower);
        uint256 recordedTroveDebt = _troveManager.getTroveDebt(_borrower);
        uint256 entireTroveDebt = recordedTroveDebt + accruedTroveInterest;

        // Add only the Trove's accrued interest to the recorded debt tracker since we have already applied redist. gains.
        // TODO: include redist. gains here if we gas-optimize them
        _activePool.increaseRecordedDebtSum(accruedTroveInterest);
        // Remove the old weighted recorded debt and and add the new one to the relevant tracker
        _activePool.changeAggWeightedDebtSum(initialWeightedRecordedTroveDebt, entireTroveDebt * _annualInterestRate);

        return entireTroveDebt;
    }

    // --- 'Require' wrapper functions ---

    function _requireCallerIsBorrower(ITroveManager _troveManager , uint256 _troveId) internal view {
        require(msg.sender == _troveManager.ownerOf(_troveId), "BorrowerOps: Caller must be the borrower for a withdrawal");
    }

    function _requireNonZeroAdjustment(uint _collChange, uint _boldChange) internal pure {
        require(_collChange != 0 || _boldChange != 0, "BorrowerOps: There must be either a collateral change or a debt change");
    }

    function _requireTroveisActive(ITroveManager _troveManager, uint256 _troveId) internal view {
        uint status = _troveManager.getTroveStatus(_troveId);
        require(status == 1, "BorrowerOps: Trove does not exist or is closed");
    }

    function _requireTroveisNotActive(ITroveManager _troveManager, uint256 _troveId) internal view {
        uint status = _troveManager.getTroveStatus(_troveId);
        require(status != 1, "BorrowerOps: Trove is active");
    }

    function _requireNonZeroCollChange(uint _collChange) internal pure {
        require(_collChange > 0, "BorrowerOps: Coll increase requires non-zero collChange");
    }

    function _requireNonZeroDebtChange(uint _boldChange) internal pure {
        require(_boldChange > 0, "BorrowerOps: Debt increase requires non-zero debtChange");
    }

    function _requireNotInRecoveryMode(uint _price) internal view {
        require(!_checkRecoveryMode(_price), "BorrowerOps: Operation not permitted during Recovery Mode");
    }

    function _requireNoCollWithdrawal(uint _collWithdrawal, bool _isCollIncrease) internal pure {
        require(_collWithdrawal == 0 || _isCollIncrease, "BorrowerOps: Collateral withdrawal not permitted Recovery Mode");
    }

    function _requireValidAdjustmentInCurrentMode
    (
        bool _isRecoveryMode,
        uint _collChange,
        bool _isCollIncrease,
        uint256 _boldChange,
        bool _isDebtIncrease,
        LocalVariables_adjustTrove memory _vars
    )
        internal
        view
    {
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
        } else { // if Normal Mode
            _requireICRisAboveMCR(_vars.newICR);
            _vars.newTCR = _getNewTCRFromTroveChange(_collChange, _isCollIncrease, _boldChange, _isDebtIncrease, _vars.price);
            _requireNewTCRisAboveCCR(_vars.newTCR);
        }
    }

    function _requireICRisAboveMCR(uint _newICR) internal pure {
        require(_newICR >= MCR, "BorrowerOps: An operation that would result in ICR < MCR is not permitted");
    }

    function _requireICRisAboveCCR(uint _newICR) internal pure {
        require(_newICR >= CCR, "BorrowerOps: Operation must leave trove with ICR >= CCR");
    }

    function _requireNewICRisAboveOldICR(uint _newICR, uint _oldICR) internal pure {
        require(_newICR >= _oldICR, "BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode");
    }

    function _requireNewTCRisAboveCCR(uint _newTCR) internal pure {
        require(_newTCR >= CCR, "BorrowerOps: An operation that would result in TCR < CCR is not permitted");
    }

    function _requireAtLeastMinNetDebt(uint _netDebt) internal pure {
        require (_netDebt >= MIN_NET_DEBT, "BorrowerOps: Trove's net debt must be greater than minimum");
    }

    function _requireValidBoldRepayment(uint _currentDebt, uint _debtRepayment) internal pure {
        require(_debtRepayment <= _currentDebt - BOLD_GAS_COMPENSATION, "BorrowerOps: Amount repaid must not be larger than the Trove's debt");
    }

    function _requireCallerIsStabilityPool() internal view {
        require(msg.sender == stabilityPoolAddress, "BorrowerOps: Caller is not Stability Pool");
    }

     function _requireSufficientBoldBalance(IBoldToken _boldToken, address _borrower, uint _debtRepayment) internal view {
        require(_boldToken.balanceOf(_borrower) >= _debtRepayment, "BorrowerOps: Caller doesnt have enough Bold to make repayment");
    }

    function _requireValidMaxFeePercentage(uint _maxFeePercentage, bool _isRecoveryMode) internal pure {
        if (_isRecoveryMode) {
            require(_maxFeePercentage <= DECIMAL_PRECISION,
                "Max fee percentage must less than or equal to 100%");
        } else {
            require(_maxFeePercentage >= BORROWING_FEE_FLOOR && _maxFeePercentage <= DECIMAL_PRECISION,
                "Max fee percentage must be between 0.5% and 100%");
        }
    }

    function _requireValidAnnualInterestRate(uint256 _annualInterestRate) internal pure {
        require(_annualInterestRate <= MAX_ANNUAL_INTEREST_RATE, "Interest rate must not be greater than max");
    }

    function  _requireTroveIsStale(ITroveManager _troveManager, address _borrower) internal view {
        require(_troveManager.troveIsStale(_borrower), "BO: Trove must be stale");
    }

    // --- ICR and TCR getters ---

    // Compute the new collateral ratio, considering the change in coll and debt. Assumes 0 pending rewards.
    function _getNewICRFromTroveChange
    (
        uint _coll,
        uint _debt,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease,
        uint _price
    )
        pure
        internal
        returns (uint)
    {
        (uint newColl, uint newDebt) = _getNewTroveAmounts(_coll, _debt, _collChange, _isCollIncrease, _debtChange, _isDebtIncrease);

        uint newICR = LiquityMath._computeCR(newColl, newDebt, _price);
        return newICR;
    }

    function _getNewTroveAmounts(
        uint _coll,
        uint _debt,
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease
    )
        internal
        pure
        returns (uint, uint)
    {
        uint newColl = _coll;
        uint newDebt = _debt;

        newColl = _isCollIncrease ? _coll + _collChange :  _coll - _collChange;
        newDebt = _isDebtIncrease ? _debt + _debtChange : _debt - _debtChange;

        return (newColl, newDebt);
    }

    function _getNewTCRFromTroveChange
    (
        uint _collChange,
        bool _isCollIncrease,
        uint _debtChange,
        bool _isDebtIncrease,
        uint _price
    )
        internal
        view
        returns (uint)
    {
        uint totalColl = getEntireSystemColl();
        uint totalDebt = getEntireSystemDebt();

        totalColl = _isCollIncrease ? totalColl + _collChange : totalColl - _collChange;
        totalDebt = _isDebtIncrease ? totalDebt + _debtChange : totalDebt - _debtChange;

        uint newTCR = LiquityMath._computeCR(totalColl, totalDebt, _price);
        return newTCR;
    }

    function getCompositeDebt(uint _debt) external pure override returns (uint) {
        return _getCompositeDebt(_debt);
    }
}
