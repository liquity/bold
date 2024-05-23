// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBoldToken.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";

// import "forge-std/console2.sol";

/*
 * The Stability Pool holds Bold tokens deposited by Stability Pool depositors.
 *
 * When a trove is liquidated, then depending on system conditions, some of its Bold debt gets offset with
 * Bold in the Stability Pool:  that is, the offset debt evaporates, and an equal amount of Bold tokens in the Stability Pool is burned.
 *
 * Thus, a liquidation causes each depositor to receive a Bold loss, in proportion to their deposit as a share of total deposits.
 * They also receive an ETH gain, as the ETH collateral of the liquidated trove is distributed among Stability depositors,
 * in the same proportion.
 *
 * When a liquidation occurs, it depletes every deposit by the same fraction: for example, a liquidation that depletes 40%
 * of the total Bold in the Stability Pool, depletes 40% of each deposit.
 *
 * A deposit that has experienced a series of liquidations is termed a "compounded deposit": each liquidation depletes the deposit,
 * multiplying it by some factor in range ]0,1[
 *
 *
 * --- IMPLEMENTATION ---
 *
 * We use a highly scalable method of tracking deposits and ETH gains that has O(1) complexity.
 *
 * When a liquidation occurs, rather than updating each depositor's deposit and ETH gain, we simply update two state variables:
 * a product P, and a sum S.
 *
 * A mathematical manipulation allows us to factor out the initial deposit, and accurately track all depositors' compounded deposits
 * and accumulated ETH gains over time, as liquidations occur, using just these two variables P and S. When depositors join the
 * Stability Pool, they get a snapshot of the latest P and S: P_t and S_t, respectively.
 *
 * The formula for a depositor's accumulated ETH gain is derived here:
 * https://github.com/liquity/dev/blob/main/papers/Scalable_Reward_Distribution_with_Compounding_Stakes.pdf
 *
 * For a given deposit d_t, the ratio P/P_t tells us the factor by which a deposit has decreased since it joined the Stability Pool,
 * and the term d_t * (S - S_t)/P_t gives us the deposit's total accumulated ETH gain.
 *
 * Each liquidation updates the product P and sum S. After a series of liquidations, a compounded deposit and corresponding ETH gain
 * can be calculated using the initial deposit, the depositor’s snapshots of P and S, and the latest values of P and S.
 *
 * Any time a depositor updates their deposit (withdrawal, top-up) their accumulated ETH gain is paid out, their new deposit is recorded
 * (based on their latest compounded deposit and modified by the withdrawal/top-up), and they receive new snapshots of the latest P and S.
 * Essentially, they make a fresh deposit that overwrites the old one.
 *
 *
 * --- SCALE FACTOR ---
 *
 * Since P is a running product in range ]0,1] that is always-decreasing, it should never reach 0 when multiplied by a number in range ]0,1[.
 * Unfortunately, Solidity floor division always reaches 0, sooner or later.
 *
 * A series of liquidations that nearly empty the Pool (and thus each multiply P by a very small number in range ]0,1[ ) may push P
 * to its 18 digit decimal limit, and round it to 0, when in fact the Pool hasn't been emptied: this would break deposit tracking.
 *
 * So, to track P accurately, we use a scale factor: if a liquidation would cause P to decrease to <1e-9 (and be rounded to 0 by Solidity),
 * we first multiply P by 1e9, and increment a currentScale factor by 1.
 *
 * The added benefit of using 1e9 for the scale factor (rather than 1e18) is that it ensures negligible precision loss close to the
 * scale boundary: when P is at its minimum value of 1e9, the relative precision loss in P due to floor division is only on the
 * order of 1e-9.
 *
 * --- EPOCHS ---
 *
 * Whenever a liquidation fully empties the Stability Pool, all deposits should become 0. However, setting P to 0 would make P be 0
 * forever, and break all future reward calculations.
 *
 * So, every time the Stability Pool is emptied by a liquidation, we reset P = 1 and currentScale = 0, and increment the currentEpoch by 1.
 *
 * --- TRACKING DEPOSIT OVER SCALE CHANGES AND EPOCHS ---
 *
 * When a deposit is made, it gets snapshots of the currentEpoch and the currentScale.
 *
 * When calculating a compounded deposit, we compare the current epoch to the deposit's epoch snapshot. If the current epoch is newer,
 * then the deposit was present during a pool-emptying liquidation, and necessarily has been depleted to 0.
 *
 * Otherwise, we then compare the current scale to the deposit's scale snapshot. If they're equal, the compounded deposit is given by d_t * P/P_t.
 * If it spans one scale change, it is given by d_t * P/(P_t * 1e9). If it spans more than one scale change, we define the compounded deposit
 * as 0, since it is now less than 1e-9'th of its initial value (e.g. a deposit of 1 billion Bold has depleted to < 1 Bold).
 *
 *
 *  --- TRACKING DEPOSITOR'S ETH GAIN OVER SCALE CHANGES AND EPOCHS ---
 *
 * In the current epoch, the latest value of S is stored upon each scale change, and the mapping (scale -> S) is stored for each epoch.
 *
 * This allows us to calculate a deposit's accumulated ETH gain, during the epoch in which the deposit was non-zero and earned ETH.
 *
 * We calculate the depositor's accumulated ETH gain for the scale at which they made the deposit, using the ETH gain formula:
 * e_1 = d_t * (S - S_t) / P_t
 *
 * and also for scale after, taking care to divide the latter by a factor of 1e9:
 * e_2 = d_t * S / (P_t * 1e9)
 *
 * The gain in the second scale will be full, as the starting point was in the previous scale, thus no need to subtract anything.
 * The deposit therefore was present for reward events from the beginning of that second scale.
 *
 *        S_i-S_t + S_{i+1}
 *      .<--------.------------>
 *      .         .
 *      . S_i     .   S_{i+1}
 *   <--.-------->.<----------->
 *   S_t.         .
 *   <->.         .
 *      t         .
 *  |---+---------|-------------|-----...
 *         i            i+1
 *
 * The sum of (e_1 + e_2) captures the depositor's total accumulated ETH gain, handling the case where their
 * deposit spanned one scale change. We only care about gains across one scale change, since the compounded
 * deposit is defined as being 0 once it has spanned more than one scale change.
 *
 *
 * --- UPDATING P WHEN A LIQUIDATION OCCURS ---
 *
 * Please see the implementation spec in the proof document, which closely follows on from the compounded deposit / ETH gain derivations:
 * https://github.com/liquity/liquity/blob/master/papers/Scalable_Reward_Distribution_with_Compounding_Stakes.pdf
 *
 *
 */
contract StabilityPool is LiquityBase, Ownable, CheckContract, IStabilityPool {
    using SafeERC20 for IERC20;

    string public constant NAME = "StabilityPool";

    IERC20 public immutable ETH;
    IBorrowerOperations public borrowerOperations;
    ITroveManager public troveManager;
    IBoldToken public boldToken;
    // Needed to check if there are pending liquidations
    ISortedTroves public sortedTroves;

    uint256 internal ETHBalance; // deposited ether tracker

    // Tracker for Bold held in the pool. Changes when users deposit/withdraw, and when Trove debt is offset.
    uint256 internal totalBoldDeposits;

    // Total remaining Bold yield gains (from Trove interest mints) held by SP, and not yet paid out to depositors
    uint256 internal yieldGainsOwed;

    // --- Data structures ---

    struct Deposit {
        uint256 initialValue;
    }

    struct Snapshots {
        uint256 S; // ETH reward sum liqs
        uint256 P;
        uint256 B; // Bold reward sum from minted interest
        uint128 scale;
        uint128 epoch;
    }

    mapping(address => Deposit) public deposits; // depositor address -> Deposit struct
    mapping(address => Snapshots) public depositSnapshots; // depositor address -> snapshots struct
    mapping(address => uint256) public stashedETH;

    /*  Product 'P': Running product by which to multiply an initial deposit, in order to find the current compounded deposit,
    * after a series of liquidations have occurred, each of which cancel some Bold debt with the deposit.
    *
    * During its lifetime, a deposit's value evolves from d_t to d_t * P / P_t , where P_t
    * is the snapshot of P taken at the instant the deposit was made. 18-digit decimal.
    */
    uint256 public P = DECIMAL_PRECISION;

    uint256 public constant SCALE_FACTOR = 1e9;

    // Each time the scale of P shifts by SCALE_FACTOR, the scale is incremented by 1
    uint128 public currentScale;

    // With each offset that fully empties the Pool, the epoch is incremented by 1
    uint128 public currentEpoch;

    /* ETH Gain sum 'S': During its lifetime, each deposit d_t earns an ETH gain of ( d_t * [S - S_t] )/P_t, where S_t
    * is the depositor's snapshot of S taken at the time t when the deposit was made.
    *
    * The 'S' sums are stored in a nested mapping (epoch => scale => sum):
    *
    * - The inner mapping records the sum S at different scales
    * - The outer mapping records the (scale => sum) mappings, for different epochs.
    */
    mapping(uint128 => mapping(uint128 => uint256)) public epochToScaleToS;
    mapping(uint128 => mapping(uint128 => uint256)) public epochToScaleToB;

    // Error trackers for the error correction in the offset calculation
    uint256 public lastETHError_Offset;
    uint256 public lastBoldLossError_Offset;

    // Error tracker fror the error correction in the BOLD reward calculation
    uint256 public lastYieldError;

    // --- Events ---

    event StabilityPoolETHBalanceUpdated(uint256 _newBalance);
    event StabilityPoolBoldBalanceUpdated(uint256 _newBalance);

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event BoldTokenAddressChanged(address _newBoldTokenAddress);
    event SortedTrovesAddressChanged(address _newSortedTrovesAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);

    event P_Updated(uint256 _P);
    event S_Updated(uint256 _S, uint128 _epoch, uint128 _scale);
    event B_Updated(uint256 _B, uint128 _epoch, uint128 _scale);
    event EpochUpdated(uint128 _currentEpoch);
    event ScaleUpdated(uint128 _currentScale);

    event DepositSnapshotUpdated(address indexed _depositor, uint256 _P, uint256 _S, uint256 _B);
    event UserDepositChanged(address indexed _depositor, uint256 _newDeposit);

    event ETHGainWithdrawn(address indexed _depositor, uint256 _ETH, uint256 _boldLoss);
    // TODO: Do we still need this, as we’ll likely have the ERC20 transfer event?
    event EtherSent(address _to, uint256 _amount);

    event YieldGainsOwedUpdated(uint256 _newYieldGainsOwed);
    event YieldGainsSent(address _to, uint256 _amount);

    constructor(address _ETHAddress) {
        checkContract(_ETHAddress);
        ETH = IERC20(_ETHAddress);
    }

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _activePoolAddress,
        address _boldTokenAddress,
        address _sortedTrovesAddress,
        address _priceFeedAddress
    ) external override onlyOwner {
        checkContract(_borrowerOperationsAddress);
        checkContract(_troveManagerAddress);
        checkContract(_activePoolAddress);
        checkContract(_boldTokenAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_priceFeedAddress);

        borrowerOperations = IBorrowerOperations(_borrowerOperationsAddress);
        troveManager = ITroveManager(_troveManagerAddress);
        activePool = IActivePool(_activePoolAddress);
        boldToken = IBoldToken(_boldTokenAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit BoldTokenAddressChanged(_boldTokenAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);

        // Allow funds movements between Liquity contracts
        ETH.approve(_borrowerOperationsAddress, type(uint256).max);

        _renounceOwnership();
    }

    // --- Getters for public variables. Required by IPool interface ---

    function getETHBalance() external view override returns (uint256) {
        return ETHBalance;
    }

    function getTotalBoldDeposits() external view override returns (uint256) {
        return totalBoldDeposits;
    }

    function getYieldGainsOwed() external view override returns (uint256) {
        return yieldGainsOwed;
    }

    // --- External Depositor Functions ---

    /*  provideToSP():
    * - Calculates depositor's ETH gain
    * - Calculates the compounded deposit
    * - Increases deposit, and takes new snapshots of accumulators P and S
    * - Sends depositor's accumulated ETH gains to depositor
    */
    function provideToSP(uint256 _topUp, bool _doClaim) external override {
        _requireNonZeroAmount(_topUp);

        activePool.mintAggInterest();

        uint256 initialDeposit = deposits[msg.sender].initialValue;

        uint256 currentETHGain = getDepositorETHGain(msg.sender);
        uint256 currentYieldGain = getDepositorYieldGain(msg.sender);
        uint256 compoundedBoldDeposit = getCompoundedBoldDeposit(msg.sender);
        
        uint256 boldLoss = initialDeposit - compoundedBoldDeposit; // Needed only for event log
        (uint256 keptYieldGain, uint256 yieldGainToSend) = _getYieldToKeepOrSend(currentYieldGain, _doClaim);

        uint256 newDeposit = compoundedBoldDeposit + _topUp + keptYieldGain;

        _updateDepositAndSnapshots(msg.sender, newDeposit);
        emit UserDepositChanged(msg.sender, newDeposit);

        _depositBoldtoSP(msg.sender, _topUp);
        _decreaseYieldGainsOwed(currentYieldGain);
        
        _sendBoldtoDepositor(msg.sender, yieldGainToSend);
        _stashOrSendETHGains(msg.sender, currentETHGain, boldLoss, _doClaim);

        assert(getDepositorETHGain(msg.sender) == 0);
        assert(getDepositorYieldGain(msg.sender) == 0);
    }

    function _getYieldToKeepOrSend(uint256 _currentYieldGain, bool _doClaim) internal pure returns (uint256, uint256) {
        uint256 yieldToKeep;
        uint256 yieldToSend;
         
        if (_doClaim) {
            yieldToKeep = 0;
            yieldToSend = _currentYieldGain;
        } else { 
            yieldToKeep = _currentYieldGain;
            yieldToSend = 0;
        }

        return (yieldToKeep, yieldToSend);
    }

    /*  withdrawFromSP():
    * - Calculates depositor's ETH gain
    * - Calculates the compounded deposit
    * - Sends the requested BOLD withdrawal to depositor
    * - (If _amount > userDeposit, the user withdraws all of their compounded deposit)
    * - Decreases deposit by withdrawn amount and takes new snapshots of accumulators P and S
    */
    function withdrawFromSP(uint256 _amount, bool _doClaim) external override {
        // TODO: if (_amount !=0) {_requireNoUnderCollateralizedTroves();}
        uint256 initialDeposit = deposits[msg.sender].initialValue;
        _requireUserHasDeposit(initialDeposit);

        activePool.mintAggInterest();
     
        uint256 currentETHGain = getDepositorETHGain(msg.sender);
        uint256 currentYieldGain = getDepositorYieldGain(msg.sender);

        uint256 compoundedBoldDeposit = getCompoundedBoldDeposit(msg.sender);
        uint256 boldToWithdraw = LiquityMath._min(_amount, compoundedBoldDeposit);
        uint256 boldLoss = initialDeposit - compoundedBoldDeposit; // Needed only for event log
        (uint256 keptYieldGain, uint256 yieldGainToSend) = _getYieldToKeepOrSend(currentYieldGain, _doClaim);

        // Update deposit
        uint256 newDeposit = compoundedBoldDeposit - boldToWithdraw + keptYieldGain;
        _updateDepositAndSnapshots(msg.sender, newDeposit);
        emit UserDepositChanged(msg.sender, newDeposit);

        _decreaseYieldGainsOwed(currentYieldGain);
        _decreaseBoldDeposits(boldToWithdraw);

        _sendBoldtoDepositor(msg.sender, boldToWithdraw + yieldGainToSend);
        _stashOrSendETHGains(msg.sender, currentETHGain, boldLoss, _doClaim);

        assert(getDepositorETHGain(msg.sender) == 0);
        assert(getDepositorYieldGain(msg.sender) == 0);
    }

    function _stashOrSendETHGains(address _depositor, uint256 _currentETHGain, uint256 _boldLoss, bool _doClaim)
        internal
    {
        if (_doClaim) {
            // Get the total gain (stashed + current), zero the stashed balance, send total gain to depositor
            uint256 ETHToSend = _getTotalETHGainAndZeroStash(_depositor, _currentETHGain);

            emit ETHGainWithdrawn(msg.sender, ETHToSend, _boldLoss); // Bold Loss required for event log
            _sendETHGainToDepositor(ETHToSend);
        } else {
            // Just stash the current gain
            stashedETH[_depositor] += _currentETHGain;
        }
    }

    function _getTotalETHGainAndZeroStash(address _depositor, uint256 _currentETHGain) internal returns (uint256) {
        // Get total ETH gains
        uint256 stashedETHGain = stashedETH[_depositor];
        uint256 totalETHGain = stashedETHGain + _currentETHGain;

        // TODO: Gas - saves gas when stashedETHGain == 0?
        if (stashedETHGain > 0) stashedETH[_depositor] = 0;

        return totalETHGain;
    }

    // This function is only needed in the case a user has no deposit but still has remaining stashed ETH gains.
    function claimAllETHGains() external {
        _requireUserHasNoDeposit(msg.sender);
        assert(getDepositorETHGain(msg.sender) == 0);
        assert(getDepositorYieldGain(msg.sender) == 0);
       
        activePool.mintAggInterest();

        uint256 ETHToSend = _getTotalETHGainAndZeroStash(msg.sender, 0);
        
        _sendETHGainToDepositor(ETHToSend);

        assert(stashedETH[msg.sender] == 0);
        assert(getDepositorETHGain(msg.sender) == 0);
        assert(getDepositorYieldGain(msg.sender) == 0);
    }

    // --- BOLD reward functions ---

    function triggerBoldRewards(uint256 _boldYield) external {
        _requireCallerIsActivePool();
   
        uint256 totalBoldDepositsCached = totalBoldDeposits; // cached to save an SLOAD
        /*
        * When total deposits is 0, B is not updated. In this case, the BOLD issued can not be obtained by later
        * depositors - it is missed out on, and remains in the balance of the SP.
        *
        */
        if (totalBoldDepositsCached == 0 || _boldYield == 0) {
            return;}

        yieldGainsOwed += _boldYield;

        uint256 yieldPerUnitStaked =_computeYieldPerUnitStaked(_boldYield, totalBoldDepositsCached);

        uint256 marginalYieldGain = yieldPerUnitStaked * P;
        epochToScaleToB[currentEpoch][currentScale] = epochToScaleToB[currentEpoch][currentScale] + marginalYieldGain;

        emit B_Updated(epochToScaleToB[currentEpoch][currentScale], currentEpoch, currentScale);
    }

    function _computeYieldPerUnitStaked(uint256 _yield, uint256 _totalBoldDeposits) internal returns (uint) {
        /*  
        * Calculate the BOLD-per-unit staked.  Division uses a "feedback" error correction, to keep the 
        * cumulative error low in the running total B:
        *
        * 1) Form a numerator which compensates for the floor division error that occurred the last time this 
        * function was called.  
        * 2) Calculate "per-unit-staked" ratio.
        * 3) Multiply the ratio back by its denominator, to reveal the current floor division error.
        * 4) Store this error for use in the next correction when this function is called.
        * 5) Note: static analysis tools complain about this "division before multiplication", however, it is intended.
        */
        uint256 yieldNumerator = _yield * DECIMAL_PRECISION + lastYieldError;

        uint256 yieldPerUnitStaked = yieldNumerator / _totalBoldDeposits;
        lastYieldError = yieldNumerator - yieldPerUnitStaked * _totalBoldDeposits;

        return yieldPerUnitStaked;
    }

    // --- Liquidation functions ---

    /*
    * Cancels out the specified debt against the Bold contained in the Stability Pool (as far as possible)
    * and transfers the Trove's ETH collateral from ActivePool to StabilityPool.
    * Only called by liquidation functions in the TroveManager.
    */
    function offset(uint256 _debtToOffset, uint256 _collToAdd) external override {
        _requireCallerIsTroveManager();
        uint256 totalBold = totalBoldDeposits; // cached to save an SLOAD
        if (totalBold == 0 || _debtToOffset == 0) return;

        (uint256 ETHGainPerUnitStaked, uint256 boldLossPerUnitStaked) =
            _computeETHRewardsPerUnitStaked(_collToAdd, _debtToOffset, totalBold);

        _updateETHRewardSumAndProduct(ETHGainPerUnitStaked, boldLossPerUnitStaked); // updates S and P

        _moveOffsetCollAndDebt(_collToAdd, _debtToOffset);
    }

    // --- Offset helper functions ---

    function _computeETHRewardsPerUnitStaked(uint256 _collToAdd, uint256 _debtToOffset, uint256 _totalBoldDeposits)
        internal
        returns (uint256 ETHGainPerUnitStaked, uint256 boldLossPerUnitStaked)
    {
        /*
        * Compute the Bold and ETH rewards. Uses a "feedback" error correction, to keep
        * the cumulative error in the P and S state variables low:
        *
        * 1) Form numerators which compensate for the floor division errors that occurred the last time this
        * function was called.
        * 2) Calculate "per-unit-staked" ratios.
        * 3) Multiply each ratio back by its denominator, to reveal the current floor division error.
        * 4) Store these errors for use in the next correction when this function is called.
        * 5) Note: static analysis tools complain about this "division before multiplication", however, it is intended.
        */
        uint256 ETHNumerator = _collToAdd * DECIMAL_PRECISION + lastETHError_Offset;

        assert(_debtToOffset <= _totalBoldDeposits);
        if (_debtToOffset == _totalBoldDeposits) {
            boldLossPerUnitStaked = DECIMAL_PRECISION; // When the Pool depletes to 0, so does each deposit
            lastBoldLossError_Offset = 0;
        } else {
            uint256 boldLossNumerator = _debtToOffset * DECIMAL_PRECISION - lastBoldLossError_Offset;
            /*
            * Add 1 to make error in quotient positive. We want "slightly too much" Bold loss,
            * which ensures the error in any given compoundedBoldDeposit favors the Stability Pool.
            */
            boldLossPerUnitStaked = boldLossNumerator / _totalBoldDeposits + 1;
            lastBoldLossError_Offset = boldLossPerUnitStaked * _totalBoldDeposits - boldLossNumerator;
        }

        ETHGainPerUnitStaked = ETHNumerator / _totalBoldDeposits;
        lastETHError_Offset = ETHNumerator - ETHGainPerUnitStaked * _totalBoldDeposits;

        return (ETHGainPerUnitStaked, boldLossPerUnitStaked);
    }

    // Update the Stability Pool reward sum S and product P
    function _updateETHRewardSumAndProduct(uint256 _ETHGainPerUnitStaked, uint256 _boldLossPerUnitStaked) internal {
        uint256 currentP = P;
        uint256 newP;

        assert(_boldLossPerUnitStaked <= DECIMAL_PRECISION);
        /*
        * The newProductFactor is the factor by which to change all deposits, due to the depletion of Stability Pool Bold in the liquidation.
        * We make the product factor 0 if there was a pool-emptying. Otherwise, it is (1 - boldLossPerUnitStaked)
        */
        uint256 newProductFactor = uint256(DECIMAL_PRECISION) - _boldLossPerUnitStaked;

        uint128 currentScaleCached = currentScale;
        uint128 currentEpochCached = currentEpoch;
        uint256 currentS = epochToScaleToS[currentEpochCached][currentScaleCached];

        /*
        * Calculate the new S first, before we update P.
        * The ETH gain for any given depositor from a liquidation depends on the value of their deposit
        * (and the value of totalDeposits) prior to the Stability being depleted by the debt in the liquidation.
        *
        * Since S corresponds to ETH gain, and P to deposit loss, we update S first.
        */
        uint256 marginalETHGain = _ETHGainPerUnitStaked * currentP;
        uint256 newS = currentS + marginalETHGain;
        epochToScaleToS[currentEpochCached][currentScaleCached] = newS;
        emit S_Updated(newS, currentEpochCached, currentScaleCached);

        // If the Stability Pool was emptied, increment the epoch, and reset the scale and product P
        if (newProductFactor == 0) {
            currentEpoch = currentEpochCached + 1;
            emit EpochUpdated(currentEpoch);
            currentScale = 0;
            emit ScaleUpdated(currentScale);
            newP = DECIMAL_PRECISION;

            // If multiplying P by a non-zero product factor would reduce P below the scale boundary, increment the scale
        } else if (currentP * newProductFactor / DECIMAL_PRECISION < SCALE_FACTOR) {
            newP = currentP * newProductFactor * SCALE_FACTOR / DECIMAL_PRECISION;
            currentScale = currentScaleCached + 1;
            emit ScaleUpdated(currentScale);
        } else {
            newP = currentP * newProductFactor / DECIMAL_PRECISION;
        }

        assert(newP > 0);
        P = newP;

        emit P_Updated(newP);
    }

    function _moveOffsetCollAndDebt(uint256 _collToAdd, uint256 _debtToOffset) internal {
        IActivePool activePoolCached = activePool;

        // Cancel the liquidated Bold debt with the Bold in the stability pool
        _decreaseBoldDeposits(_debtToOffset);

        // Burn the debt that was successfully offset
        boldToken.burn(address(this), _debtToOffset);

        // Update internal ETH balance tracker
        ETHBalance = ETHBalance + _collToAdd;
        // Pull ETH from Active Pool
        activePoolCached.sendETH(address(this), _collToAdd);
    }

    function _decreaseBoldDeposits(uint256 _amount) internal {
        if (_amount == 0) return;
        uint256 newTotalBoldDeposits = totalBoldDeposits - _amount;
        totalBoldDeposits = newTotalBoldDeposits;
        emit StabilityPoolBoldBalanceUpdated(newTotalBoldDeposits);
    }

    function _decreaseYieldGainsOwed(uint256 _amount) internal {
        if (_amount == 0) return;
        uint256 newYieldGainsOwed = yieldGainsOwed - _amount;
        yieldGainsOwed = newYieldGainsOwed;
        emit YieldGainsOwedUpdated(newYieldGainsOwed); 
    }

    // --- Reward calculator functions for depositor ---

    /* Calculates the ETH gain earned by the deposit since its last snapshots were taken.
    * Given by the formula:  E = d0 * (S - S(0))/P(0)
    * where S(0) and P(0) are the depositor's snapshots of the sum S and product P, respectively.
    * d0 is the last recorded deposit value.
    */
    function getDepositorETHGain(address _depositor) public view override returns (uint256) {
        uint256 initialDeposit = deposits[_depositor].initialValue;

        if (initialDeposit == 0) return 0;

        Snapshots memory snapshots = depositSnapshots[_depositor];

        uint256 ETHGain = _getETHGainFromSnapshots(initialDeposit, snapshots);
        return ETHGain;
    }

    function getDepositorYieldGain(address _depositor) public view override returns (uint256) {
        uint256 initialDeposit = deposits[_depositor].initialValue;

        if (initialDeposit == 0) return 0;

        Snapshots memory snapshots = depositSnapshots[_depositor];

        uint256 yieldGain = _getYieldGainFromSnapshots(initialDeposit, snapshots);
        return yieldGain;
    }

    function _getETHGainFromSnapshots(uint256 initialDeposit, Snapshots memory snapshots)
        internal
        view
        returns (uint256)
    {
        /*
        * Grab the sum 'S' from the epoch at which the stake was made. The ETH gain may span up to one scale change.
        * If it does, the second portion of the ETH gain is scaled by 1e9.
        * If the gain spans no scale change, the second portion will be 0.
        */
        uint128 epochSnapshot = snapshots.epoch;
        uint128 scaleSnapshot = snapshots.scale;
        uint256 S_Snapshot = snapshots.S;
        uint256 P_Snapshot = snapshots.P;

        uint256 firstPortion = epochToScaleToS[epochSnapshot][scaleSnapshot] - S_Snapshot;
        uint256 secondPortion = epochToScaleToS[epochSnapshot][scaleSnapshot + 1] / SCALE_FACTOR;

        uint256 ETHGain = initialDeposit * (firstPortion + secondPortion) / P_Snapshot / DECIMAL_PRECISION;

        return ETHGain;
    }

    function _getYieldGainFromSnapshots(uint256 initialDeposit, Snapshots memory snapshots)
        internal
        view
        returns (uint256)
    {
        /*
        * Grab the sum 'B' from the epoch at which the stake was made. The Bold gain may span up to one scale change.
        * If it does, the second portion of the Bold gain is scaled by 1e9.
        * If the gain spans no scale change, the second portion will be 0.
        */
        uint128 epochSnapshot = snapshots.epoch;
        uint128 scaleSnapshot = snapshots.scale;
        uint256 B_Snapshot = snapshots.B;
        uint256 P_Snapshot = snapshots.P;

        uint256 firstPortion = epochToScaleToB[epochSnapshot][scaleSnapshot] - B_Snapshot;
        uint256 secondPortion = epochToScaleToB[epochSnapshot][scaleSnapshot + 1] / SCALE_FACTOR;

        uint256 yieldGain = initialDeposit * (firstPortion + secondPortion) / P_Snapshot / DECIMAL_PRECISION;

        return yieldGain;
    }

    // --- Compounded deposit ---

    /*
    * Return the user's compounded deposit. Given by the formula:  d = d0 * P/P(0)
    * where P(0) is the depositor's snapshot of the product P, taken when they last updated their deposit.
    */
    function getCompoundedBoldDeposit(address _depositor) public view override returns (uint256) {
        uint256 initialDeposit = deposits[_depositor].initialValue;
        if (initialDeposit == 0) return 0;

        Snapshots memory snapshots = depositSnapshots[_depositor];

        uint256 compoundedDeposit = _getCompoundedStakeFromSnapshots(initialDeposit, snapshots);
        return compoundedDeposit;
    }

    // Internal function, used to calculcate compounded deposits and compounded front end stakes.
    function _getCompoundedStakeFromSnapshots(uint256 initialStake, Snapshots memory snapshots)
        internal
        view
        returns (uint256)
    {
        uint256 snapshot_P = snapshots.P;
        uint128 scaleSnapshot = snapshots.scale;
        uint128 epochSnapshot = snapshots.epoch;

        // If stake was made before a pool-emptying event, then it has been fully cancelled with debt -- so, return 0
        if (epochSnapshot < currentEpoch) return 0;

        uint256 compoundedStake;
        uint128 scaleDiff = currentScale - scaleSnapshot;

        /* Compute the compounded stake. If a scale change in P was made during the stake's lifetime,
        * account for it. If more than one scale change was made, then the stake has decreased by a factor of
        * at least 1e-9 -- so return 0.
        */
        if (scaleDiff == 0) {
            compoundedStake = initialStake * P / snapshot_P;
        } else if (scaleDiff == 1) {
            compoundedStake = initialStake * P / snapshot_P / SCALE_FACTOR;
        } else {
            // if scaleDiff >= 2
            compoundedStake = 0;
        }

        /*
        * If compounded deposit is less than a billionth of the initial deposit, return 0.
        *
        * NOTE: originally, this line was in place to stop rounding errors making the deposit too large. However, the error
        * corrections should ensure the error in P "favors the Pool", i.e. any given compounded deposit should slightly less
        * than it's theoretical value.
        *
        * Thus it's unclear whether this line is still really needed.
        */
        if (compoundedStake < initialStake / 1e9) return 0;

        return compoundedStake;
    }

    // --- Sender functions for Bold deposit and ETH gains ---

    // Transfer the Bold tokens from the user to the Stability Pool's address, and update its recorded Bold
    function _depositBoldtoSP(address _address, uint256 _amount) internal {
        boldToken.sendToPool(_address, address(this), _amount);
        uint256 newTotalBoldDeposits = totalBoldDeposits + _amount;
        totalBoldDeposits = newTotalBoldDeposits;
        emit StabilityPoolBoldBalanceUpdated(newTotalBoldDeposits);
    }

    function _sendETHGainToDepositor(uint256 _ETHAmount) internal {
        if (_ETHAmount == 0) return;

        uint256 newETHBalance = ETHBalance - _ETHAmount;
        ETHBalance = newETHBalance;
        emit StabilityPoolETHBalanceUpdated(newETHBalance);
        emit EtherSent(msg.sender, _ETHAmount);
        ETH.safeTransfer(msg.sender, _ETHAmount);
    }

    // Send Bold to user and decrease Bold in Pool
    function _sendBoldtoDepositor(address _depositor, uint256 _boldToSend) internal {
        if (_boldToSend == 0) return;
        boldToken.returnFromPool(address(this), _depositor, _boldToSend);
    }

    function receiveETH(uint256 _amount) external {
        _requireCallerIsActivePool();

        uint256 newETHBalance = ETHBalance + _amount;
        ETHBalance = newETHBalance;

        // Pull ETH tokens from sender
        ETH.safeTransferFrom(msg.sender, address(this), _amount);

        emit StabilityPoolETHBalanceUpdated(newETHBalance);
    }

    // --- Stability Pool Deposit Functionality ---

    function _updateDepositAndSnapshots(address _depositor, uint256 _newValue) internal {
        deposits[_depositor].initialValue = _newValue;

        if (_newValue == 0) {
            delete depositSnapshots[_depositor];
            emit DepositSnapshotUpdated(_depositor, 0, 0, 0);
            return;
        }
        uint128 currentScaleCached = currentScale;
        uint128 currentEpochCached = currentEpoch;
        uint256 currentP = P;

        // Get S for the current epoch and current scale
        uint256 currentS = epochToScaleToS[currentEpochCached][currentScaleCached];
        uint256 currentB = epochToScaleToB[currentEpochCached][currentScaleCached];

        // Record new snapshots of the latest running product P and sum S for the depositor
        depositSnapshots[_depositor].P = currentP;
        depositSnapshots[_depositor].S = currentS;
        depositSnapshots[_depositor].B = currentB;
        depositSnapshots[_depositor].scale = currentScaleCached;
        depositSnapshots[_depositor].epoch = currentEpochCached;

        emit DepositSnapshotUpdated(_depositor, currentP, currentS, currentB);
    }

    // --- 'require' functions ---

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == address(activePool), "StabilityPool: Caller is not ActivePool");
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == address(troveManager), "StabilityPool: Caller is not TroveManager");
    }

    /* TODO
    function _requireNoUnderCollateralizedTroves() internal {
        uint price = priceFeed.fetchPrice();
        uint256 lowestTroveId = sortedTroves.getLast();
        uint ICR = troveManager.getCurrentICR(lowestTrove, price);
        require(ICR >= MCR, "StabilityPool: Cannot withdraw while there are troves with ICR < MCR");
    }
    */

    function _requireUserHasDeposit(uint256 _initialDeposit) internal pure {
        require(_initialDeposit > 0, "StabilityPool: User must have a non-zero deposit");
    }

    function _requireUserHasNoDeposit(address _address) internal view {
        uint256 initialDeposit = deposits[_address].initialValue;
        require(initialDeposit == 0, "StabilityPool: User must have no deposit");
    }

    function _requireNonZeroAmount(uint256 _amount) internal pure {
        require(_amount > 0, "StabilityPool: Amount must be non-zero");
    }

    function _requireValidKickbackRate(uint256 _kickbackRate) internal pure {
        require(_kickbackRate <= DECIMAL_PRECISION, "StabilityPool: Kickback rate must be in range [0,1]");
    }
}
