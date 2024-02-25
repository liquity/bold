// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBoldToken.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";

import "forge-std/console2.sol";


contract BorrowerOperations is LiquityBase, Ownable, CheckContract, IBorrowerOperations {
    string constant public NAME = "BorrowerOperations";

    // --- Connected contract declarations ---

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
        uint collChange;
        bool isCollIncrease;
        uint entireDebt;
        uint entireColl;
        uint256 redistDebtGain;
        uint256 accruedTroveInterest;
        uint oldICR;
        uint newICR;
        uint newTCR;
        uint BoldFee;
        uint newDebt;
        uint newColl;
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

    event TroveCreated(address indexed _borrower, uint arrayIndex);
    event TroveUpdated(address indexed _borrower, uint _debt, uint _coll, uint stake, BorrowerOperation operation);
    event BoldBorrowingFeePaid(address indexed _borrower, uint _boldFee);
    
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

        _renounceOwnership();
    }

    // --- Borrower Trove Operations ---

    function openTrove(uint _maxFeePercentage, uint _boldAmount, address _upperHint, address _lowerHint, uint256 _annualInterestRate) external payable override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        LocalVariables_openTrove memory vars;

        vars.price = priceFeed.fetchPrice();

        // --- Checks ---
        
        bool isRecoveryMode = _checkRecoveryMode(vars.price);

        _requireValidAnnualInterestRate(_annualInterestRate);
        _requireValidMaxFeePercentage(_maxFeePercentage, isRecoveryMode);
        _requireTroveisNotActive(contractsCache.troveManager, msg.sender);

        vars.BoldFee;

        if (!isRecoveryMode) {
            // TODO: implement interest rate charges
        }
        _requireAtLeastMinNetDebt(_boldAmount);

        // ICR is based on the composite debt, i.e. the requested Bold amount + Bold gas comp.
        vars.compositeDebt = _getCompositeDebt(_boldAmount);
        assert(vars.compositeDebt > 0);

        vars.ICR = LiquityMath._computeCR(msg.value, vars.compositeDebt, vars.price);

        if (isRecoveryMode) {
            _requireICRisAboveCCR(vars.ICR);
        } else {
            _requireICRisAboveMCR(vars.ICR);
            uint newTCR = _getNewTCRFromTroveChange(msg.value, true, vars.compositeDebt, true, vars.price);  // bools: coll increase, debt increase
            _requireNewTCRisAboveCCR(newTCR); 
        }

        // --- Effects & interactions --- 

        contractsCache.activePool.mintAggInterest(vars.compositeDebt, 0);

        // Set the stored Trove properties
        vars.stake = contractsCache.troveManager.setTrovePropertiesOnOpen(
            msg.sender, 
            msg.value, 
            vars.compositeDebt, 
            _annualInterestRate
        );

        sortedTroves.insert(msg.sender, _annualInterestRate, _upperHint, _lowerHint);
        vars.arrayIndex = contractsCache.troveManager.addTroveOwnerToArray(msg.sender);
        emit TroveCreated(msg.sender, vars.arrayIndex);

        // Move the ether to the Active Pool
        _activePoolAddColl(contractsCache.activePool, msg.value);

        // Mint the requested _boldAmount to the borrower and mint the gas comp to the GasPool
        contractsCache.boldToken.mint(msg.sender, _boldAmount);
        contractsCache.boldToken.mint(gasPoolAddress, BOLD_GAS_COMPENSATION);
       
        // Add the whole debt to the recorded debt tracker
        contractsCache.activePool.increaseRecordedDebtSum(vars.compositeDebt);
        // Add the whole weighted debt to the weighted recorded debt tracker
        contractsCache.activePool.changeAggWeightedDebtSum(0, vars.compositeDebt * _annualInterestRate);

        emit TroveUpdated(msg.sender, vars.compositeDebt, msg.value, vars.stake, BorrowerOperation.openTrove);
        emit BoldBorrowingFeePaid(msg.sender, vars.BoldFee);
    }

    // Send ETH as collateral to a trove
    function addColl() external payable override {
        _adjustTrove(msg.sender, 0, 0, false, 0);
    }

    // Send ETH as collateral to a trove. Called by only the Stability Pool.
    function moveETHGainToTrove(address _borrower) external payable override {
        _requireCallerIsStabilityPool();
        _adjustTrove(_borrower, 0, 0, false, 0);
    }

    // Withdraw ETH collateral from a trove
    function withdrawColl(uint _collWithdrawal) external override {
        _adjustTrove(msg.sender, _collWithdrawal, 0, false, 0);
    }

    // Withdraw Bold tokens from a trove: mint new Bold tokens to the owner, and increase the trove's debt accordingly
    function withdrawBold(uint _maxFeePercentage, uint _boldAmount ) external override {
        _adjustTrove(msg.sender, 0, _boldAmount, true, _maxFeePercentage);
    }

    // Repay Bold tokens to a Trove: Burn the repaid Bold tokens, and reduce the trove's debt accordingly
    function repayBold(uint _boldAmount) external override {
        _adjustTrove(msg.sender, 0, _boldAmount, false, 0);
    }

    function adjustTrove(uint _maxFeePercentage, uint _collWithdrawal, uint _boldChange, bool _isDebtIncrease) external payable override {
        _adjustTrove(msg.sender, _collWithdrawal, _boldChange, _isDebtIncrease, _maxFeePercentage);
    }

    function adjustTroveInterestRate(uint _newAnnualInterestRate, address _upperHint, address _lowerHint) external {
        // TODO: Delegation functionality
       
        ContractsCacheTMAP memory contractsCache = ContractsCacheTMAP(troveManager, activePool);
        // --- Checks ---
        _requireValidAnnualInterestRate(_newAnnualInterestRate);
        _requireTroveisActive(contractsCache.troveManager, msg.sender);

        uint256 initialWeightedRecordedTroveDebt = contractsCache.troveManager.getTroveWeightedRecordedDebt(msg.sender);

        // --- Effects ---

        (, uint256 redistDebtGain) = contractsCache.troveManager.getAndApplyRedistributionGains(msg.sender);

        // No debt is issued/repaid, so the net Trove debt change is purely the redistribution gain 
        contractsCache.activePool.mintAggInterest(redistDebtGain, 0);

        uint256 accruedTroveInterest = contractsCache.troveManager.calcTroveAccruedInterest(msg.sender);
        uint256 recordedTroveDebt = contractsCache.troveManager.getTroveDebt(msg.sender);
        uint256 entireTroveDebt = recordedTroveDebt + accruedTroveInterest; 

        sortedTroves.reInsert(msg.sender, _newAnnualInterestRate, _upperHint, _lowerHint);

        // Update Trove recorded debt and interest-weighted debt sum
        contractsCache.troveManager.updateTroveDebtAndInterest(msg.sender, entireTroveDebt, _newAnnualInterestRate);
        
        // Add only the Trove's accrued interest to the recorded debt tracker since we have already applied redist. gains.
        // TODO: include redist. gains here if we gas-optimize them
        contractsCache.activePool.increaseRecordedDebtSum(accruedTroveInterest);
        // Remove the old weighted recorded debt and and add the new one to the relevant tracker
        contractsCache.activePool.changeAggWeightedDebtSum(initialWeightedRecordedTroveDebt, entireTroveDebt * _newAnnualInterestRate); 
    }
    
    /*
    * _adjustTrove(): Alongside a debt change, this function can perform either a collateral top-up or a collateral withdrawal. 
    *
    * It therefore expects either a positive msg.value, or a positive _collWithdrawal argument.
    *
    * If both are positive, it will revert.
    */
    function _adjustTrove(address _borrower, uint _collWithdrawal, uint _boldChange, bool _isDebtIncrease, uint _maxFeePercentage) internal {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);
        LocalVariables_adjustTrove memory vars;

        vars.price = priceFeed.fetchPrice();

        uint256 initialWeightedRecordedTroveDebt = contractsCache.troveManager.getTroveWeightedRecordedDebt(msg.sender);
        uint256 annualInterestRate = contractsCache.troveManager.getTroveAnnualInterestRate(msg.sender);

        // --- Checks ---

        bool isRecoveryMode = _checkRecoveryMode(vars.price);

        if (_isDebtIncrease) {
            _requireValidMaxFeePercentage(_maxFeePercentage, isRecoveryMode);
            _requireNonZeroDebtChange(_boldChange);
        }
        _requireSingularCollChange(_collWithdrawal);
        _requireNonZeroAdjustment(_collWithdrawal, _boldChange);
        _requireTroveisActive(contractsCache.troveManager, _borrower);

        // Confirm the operation is either a borrower adjusting their own trove, or a pure ETH transfer from the Stability Pool to a trove
        assert(msg.sender == _borrower || (msg.sender == stabilityPoolAddress && msg.value > 0 && _boldChange == 0));

        // Get the collChange based on whether or not ETH was sent in the transaction
        (vars.collChange, vars.isCollIncrease) = _getCollChange(msg.value, _collWithdrawal);

        (vars.entireDebt, vars.entireColl, vars.redistDebtGain, , vars.accruedTroveInterest) = contractsCache.troveManager.getEntireDebtAndColl(msg.sender);

        // Get the trove's old ICR before the adjustment, and what its new ICR will be after the adjustment
        vars.oldICR = LiquityMath._computeCR(vars.entireColl, vars.entireDebt, vars.price);
        vars.newICR = _getNewICRFromTroveChange(
            vars.entireColl, 
            vars.entireDebt, 
            vars.collChange, 
            vars.isCollIncrease, 
            _boldChange,
            _isDebtIncrease, 
            vars.price
        );
        assert(_collWithdrawal <= vars.entireColl); 
        // Check the adjustment satisfies all conditions for the current system mode
        _requireValidAdjustmentInCurrentMode(isRecoveryMode, _collWithdrawal, _isDebtIncrease, _boldChange, vars);
            
        // When the adjustment is a debt repayment, check it's a valid amount and that the caller has enough Bold
        if (!_isDebtIncrease && _boldChange > 0) {
            _requireAtLeastMinNetDebt(_getNetDebt(vars.entireDebt) - _boldChange);
            _requireValidBoldRepayment(vars.entireDebt, _boldChange);
            _requireSufficientBoldBalance(contractsCache.boldToken, _borrower, _boldChange);
        }

        // --- Effects and interactions ---

        contractsCache.troveManager.getAndApplyRedistributionGains(_borrower);

        if (_isDebtIncrease) {
            // Incresae Trove debt by the drawn debt + redist. gain
            activePool.mintAggInterest(_boldChange + vars.redistDebtGain, 0);
        } else {
            // Increase Trove debt by redist. gain and decrease by the repaid debt
            activePool.mintAggInterest(vars.redistDebtGain, _boldChange);
        }

        // Update the Trove's recorded debt and coll
        (vars.newColl) = _updateTroveCollFromAdjustment(contractsCache.troveManager, _borrower, vars.collChange, vars.isCollIncrease);
        uint256 newEntireDebt = vars.entireDebt + _boldChange;
        contractsCache.troveManager.updateTroveDebt(_borrower, newEntireDebt);
     
        vars.stake = contractsCache.troveManager.updateStakeAndTotalStakes(_borrower);

        emit TroveUpdated(_borrower, vars.newDebt, vars.newColl, vars.stake, BorrowerOperation.adjustTrove);
        emit BoldBorrowingFeePaid(msg.sender,  vars.BoldFee);

        _moveTokensAndETHfromAdjustment(
            contractsCache.activePool,
            contractsCache.boldToken,
            msg.sender,
            vars.collChange,
            vars.isCollIncrease,
            _boldChange,
            _isDebtIncrease,
            vars.accruedTroveInterest
        );

        contractsCache.activePool.changeAggWeightedDebtSum(initialWeightedRecordedTroveDebt, newEntireDebt * annualInterestRate); 
    }

    function closeTrove() external override {
        ContractsCacheTMAPBT memory contractsCache = ContractsCacheTMAPBT(troveManager, activePool, boldToken);

        // --- Checks ---

        _requireTroveisActive(contractsCache.troveManager, msg.sender);
        uint price = priceFeed.fetchPrice();
        _requireNotInRecoveryMode(price);

        uint256 initialWeightedRecordedTroveDebt = contractsCache.troveManager.getTroveWeightedRecordedDebt(msg.sender);
        uint256 initialRecordedTroveDebt = contractsCache.troveManager.getTroveDebt(msg.sender);

        (uint256 entireTroveDebt, 
        uint256 entireTroveColl,
        uint256 debtRedistGain, 
         , // ETHredist gain
        uint256 accruedTroveInterest) = contractsCache.troveManager.getEntireDebtAndColl(msg.sender);
      
        // The borrower must repay their entire debt including accrued interest and redist. gains (and less the gas comp.)
        _requireSufficientBoldBalance(contractsCache.boldToken, msg.sender, entireTroveDebt - BOLD_GAS_COMPENSATION);

        // The TCR always includes A Trove's redist. gain and accrued interest, so we must use the Trove's entire debt here
        uint newTCR = _getNewTCRFromTroveChange(entireTroveColl, false, entireTroveDebt, false, price);
        _requireNewTCRisAboveCCR(newTCR);

        // --- Effects and interactions ---

        // TODO: gas optimization of redistribution gains. We don't need to actually update stored Trove debt & coll properties here, since we'll
        // zero them at the end. 
        contractsCache.troveManager.getAndApplyRedistributionGains(msg.sender);

        // Remove the Trove's initial recorded debt plus its accrued interest from ActivePool.aggRecordedDebt, 
        // but *don't* remove the redistribution gains, since these were not yet incorporated into the sum. 
        contractsCache.activePool.mintAggInterest(0, initialRecordedTroveDebt + accruedTroveInterest);

        contractsCache.troveManager.removeStake(msg.sender);
        contractsCache.troveManager.closeTrove(msg.sender, initialWeightedRecordedTroveDebt);
        emit TroveUpdated(msg.sender, 0, 0, 0, BorrowerOperation.closeTrove);

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

    /**
     * Claim remaining collateral from a redemption or from a liquidation with ICR > MCR in Recovery Mode
     */
    function claimCollateral() external override {
        // send ETH from CollSurplus Pool to owner
        collSurplusPool.claimColl(msg.sender);
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

    // Update trove's coll whether they added or removed collateral
    function _updateTroveCollFromAdjustment
    (
        ITroveManager _troveManager,
        address _borrower,
        uint _collChange,
        bool _isCollIncrease
    )
        internal
        returns (uint256)
    {
        uint newColl = (_isCollIncrease) ? _troveManager.increaseTroveColl(_borrower, _collChange)
                                        : _troveManager.decreaseTroveColl(_borrower, _collChange);
      
        return (newColl);
    }

    // This function incorporates both the Trove's net debt change (repaid/drawn) and its accrued interest.
    // Redist. gains have already been applied before this is called.
    // TODO: explicitly pass redist. gains too if we gas-optimize them.
    function _moveTokensAndETHfromAdjustment
    (
        IActivePool _activePool,
        IBoldToken _boldToken,
        address _borrower,
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
            _boldToken.mint(_borrower, _boldChange);
        } else {
            // TODO: Gas optimize this
            _activePool.increaseRecordedDebtSum(_accruedTroveInterest);
            _activePool.decreaseRecordedDebtSum(_boldChange);

            _boldToken.burn(_borrower, _boldChange);
        }

        if (_isCollIncrease) {
            _activePoolAddColl(_activePool, _collChange);
        } else {
            _activePool.sendETH(_borrower, _collChange);
        }
    }

    // Send ETH to Active Pool and increase its recorded ETH balance
    function _activePoolAddColl(IActivePool _activePool, uint _amount) internal {
        (bool success, ) = address(_activePool).call{value: _amount}("");
        require(success, "BorrowerOps: Sending ETH to ActivePool failed");
    }

    // --- 'Require' wrapper functions ---

    function _requireSingularCollChange(uint _collWithdrawal) internal view {
        require(msg.value == 0 || _collWithdrawal == 0, "BorrowerOperations: Cannot withdraw and add coll");
    }

    function _requireCallerIsBorrower(address _borrower) internal view {
        require(msg.sender == _borrower, "BorrowerOps: Caller must be the borrower for a withdrawal");
    }

    function _requireNonZeroAdjustment(uint _collWithdrawal, uint _boldChange) internal view {
        require(msg.value != 0 || _collWithdrawal != 0 || _boldChange != 0, "BorrowerOps: There must be either a collateral change or a debt change");
    }

    function _requireTroveisActive(ITroveManager _troveManager, address _borrower) internal view {
        uint status = _troveManager.getTroveStatus(_borrower);
        require(status == 1, "BorrowerOps: Trove does not exist or is closed");
    }

    function _requireTroveisNotActive(ITroveManager _troveManager, address _borrower) internal view {
        uint status = _troveManager.getTroveStatus(_borrower);
        require(status != 1, "BorrowerOps: Trove is active");
    }

    function _requireNonZeroDebtChange(uint _boldChange) internal pure {
        require(_boldChange > 0, "BorrowerOps: Debt increase requires non-zero debtChange");
    }
   
    function _requireNotInRecoveryMode(uint _price) internal view {
        require(!_checkRecoveryMode(_price), "BorrowerOps: Operation not permitted during Recovery Mode");
    }

    function _requireNoCollWithdrawal(uint _collWithdrawal) internal pure {
        require(_collWithdrawal == 0, "BorrowerOps: Collateral withdrawal not permitted Recovery Mode");
    }

    function _requireValidAdjustmentInCurrentMode 
    (
        bool _isRecoveryMode,
        uint _collWithdrawal,
        bool _isDebtIncrease, 
        uint256 _boldChange,
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
            _requireNoCollWithdrawal(_collWithdrawal);
            if (_isDebtIncrease) {
                _requireICRisAboveCCR(_vars.newICR);
                _requireNewICRisAboveOldICR(_vars.newICR, _vars.oldICR);
            }       
        } else { // if Normal Mode
            _requireICRisAboveMCR(_vars.newICR);
            _vars.newTCR = _getNewTCRFromTroveChange(_vars.collChange, _vars.isCollIncrease, _boldChange, _isDebtIncrease, _vars.price);
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
        console2.log(totalDebt, "BO:totalSystemDebt");
        console2.log(totalColl, "BO:totalSystemColl");

        totalColl = _isCollIncrease ? totalColl + _collChange : totalColl - _collChange;
        totalDebt = _isDebtIncrease ? totalDebt + _debtChange : totalDebt - _debtChange;

        uint newTCR = LiquityMath._computeCR(totalColl, totalDebt, _price);
        console2.log(newTCR, "BO:newTCR");
        return newTCR;
    }

    function getCompositeDebt(uint _debt) external pure override returns (uint) {
        return _getCompositeDebt(_debt);
    }
}
