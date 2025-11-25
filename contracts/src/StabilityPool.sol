// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/IAddressesRegistry.sol";
import "./Interfaces/IStabilityPoolEvents.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBoldToken.sol";
import "./Interfaces/ISystemParams.sol";
import "./Dependencies/LiquityBaseInit.sol";

/*
 * The Stability Pool holds Bold tokens deposited by Stability Pool depositors.
 *
 * When a trove is liquidated, then depending on system conditions, some of its Bold debt gets offset with
 * Bold in the Stability Pool:  that is, the offset debt evaporates, and an equal amount of Bold tokens in the Stability Pool is burned.
 *
 * Thus, a liquidation causes each depositor to receive a Bold loss, in proportion to their deposit as a share of total deposits.
 * They also receive an Coll gain, as the collateral of the liquidated trove is distributed among Stability depositors,
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
 * We use a highly scalable method of tracking deposits and Coll gains that has O(1) complexity.
 *
 * When a liquidation occurs, rather than updating each depositor's deposit and Coll gain, we simply update two state variables:
 * a product P, and a sum S.
 *
 * A mathematical manipulation allows us to factor out the initial deposit, and accurately track all depositors' compounded deposits
 * and accumulated Coll gains over time, as liquidations occur, using just these two variables P and S. When depositors join the
 * Stability Pool, they get a snapshot of the latest P and S: P_t and S_t, respectively.
 *
 * The formula for a depositor's accumulated Coll gain is derived here:
 * https://github.com/liquity/dev/blob/main/papers/Scalable_Reward_Distribution_with_Compounding_Stakes.pdf
 *
 * For a given deposit d_t, the ratio P/P_t tells us the factor by which a deposit has decreased since it joined the Stability Pool,
 * and the term d_t * (S - S_t)/P_t gives us the deposit's total accumulated Coll gain.
 *
 * Each liquidation updates the product P and sum S. After a series of liquidations, a compounded deposit and corresponding Coll gain
 * can be calculated using the initial deposit, the depositor’s snapshots of P and S, and the latest values of P and S.
 *
 * Any time a depositor updates their deposit (withdrawal, top-up) their accumulated Coll gain is paid out, their new deposit is recorded
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
 * to its 36 digit decimal limit, and round it to 0, when in fact the Pool hasn't been emptied: this would break deposit tracking.
 *
 * P is stored at 36-digit precision as a uint. That is, a value of "1" is represented by a value of 1e36 in the code.
 *
 * So, to track P accurately, we use a scale factor: if a liquidation would cause P to decrease below 1e27,
 * we first multiply P by 1e9, and increment a currentScale factor by 1.
 *
 * The added benefit of using 1e9 for the scale factor that it ensures negligible precision loss close to the
 * scale boundary: when P is at its minimum value of 1e27, the relative precision loss in P due to floor division is only on the
 * order of 1e-27.
 *
 * --- MIN BOLD IN SP ---
 *
 * Once totalBoldDeposits has become >= MIN_BOLD_IN_SP, a liquidation may never fully empty the Pool - a minimum of 1 BOLD remains in the SP at all times thereafter.
 * This is enforced for liquidations in TroveManager.batchLiquidateTroves, and for withdrawals in StabilityPool.withdrawFromSP.
 * As such, it is impossible to empty the Stability Pool via liquidations, and P can never become 0.
 *
 * --- TRACKING DEPOSIT OVER SCALE CHANGES ---
 *
 * When a deposit is made, it gets a snapshot of the currentScale.
 *
 * When calculating a compounded deposit, we compare the current scale to the deposit's scale snapshot. If they're equal, the compounded deposit is given by d_t * P/P_t.
 * If it spans one scale change, it is given by d_t * P/(P_t * 1e9).
 *
 *  --- TRACKING DEPOSITOR'S COLL GAIN OVER SCALE CHANGES  ---
 *
 * We calculate the depositor's accumulated Coll gain for the scale at which they made the deposit, using the Coll gain formula:
 * e_1 = d_t * (S - S_t) / P_t
 *
 * and also for the scale after, taking care to divide the latter by a factor of 1e9:
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
 * The sum of (e_1 + e_2) captures the depositor's total accumulated Coll gain, handling the case where their
 * deposit spanned one scale change.
 *
 * --- UPDATING P WHEN A LIQUIDATION OCCURS ---
 *
 * Please see the implementation spec in the proof document, which closely follows on from the compounded deposit / Coll gain derivations:
 * https://github.com/liquity/liquity/blob/master/papers/Scalable_Reward_Distribution_with_Compounding_Stakes.pdf
 *
 *
 */
contract StabilityPool is Initializable, LiquityBaseInit, IStabilityPool, IStabilityPoolEvents {
    using SafeERC20 for IERC20;

    string public constant NAME = "StabilityPool";

    IERC20 public collToken;
    ITroveManager public troveManager;
    IBoldToken public boldToken;

    uint256 internal collBalance; // deposited coll tracker

    // Tracker for Bold held in the pool. Changes when users deposit/withdraw, and when Trove debt is offset.
    uint256 internal totalBoldDeposits;

    // Total remaining Bold yield gains (from Trove interest mints) held by SP, and not yet paid out to depositors
    // From the contract's perspective, this is a write-only variable.
    uint256 internal yieldGainsOwed;
    // Total remaining Bold yield gains (from Trove interest mints) held by SP, not yet paid out to depositors,
    // and not accounted for because they were received when the total deposits were too small
    uint256 internal yieldGainsPending;

    // --- Data structures ---

    struct Deposit {
        uint256 initialValue;
    }

    struct Snapshots {
        uint256 S; // Coll reward sum liqs
        uint256 P;
        uint256 B; // Bold reward sum from minted interest
        uint256 scale;
    }

    mapping(address => Deposit) public deposits; // depositor address -> Deposit struct
    mapping(address => Snapshots) public depositSnapshots; // depositor address -> snapshots struct
    mapping(address => uint256) public stashedColl;

    /*  Product 'P': Running product by which to multiply an initial deposit, in order to find the current compounded deposit,
    * after a series of liquidations have occurred, each of which cancel some Bold debt with the deposit.
    *
    * During its lifetime, a deposit's value evolves from d_t to d_t * P / P_t , where P_t
    * is the snapshot of P taken at the instant the deposit was made. 18-digit decimal.
    */
    uint256 public P = P_PRECISION;

    uint256 public constant P_PRECISION = 1e36;

    // A scale change will happen if P decreases by a factor of at least this much
    uint256 public constant SCALE_FACTOR = 1e9;

    // Highest power `SCALE_FACTOR` can be raised to without overflow
    uint256 public constant MAX_SCALE_FACTOR_EXPONENT = 8;

    // The number of scale changes after which an untouched deposit stops receiving yield / coll gains
    uint256 public constant SCALE_SPAN = 2;

    // Each time the scale of P shifts by SCALE_FACTOR, the scale is incremented by 1
    uint256 public currentScale;

    address public liquidityStrategy;

    ISystemParams public immutable systemParams;

    /* Coll Gain sum 'S': During its lifetime, each deposit d_t earns an Coll gain of ( d_t * [S - S_t] )/P_t, where S_t
    * is the depositor's snapshot of S taken at the time t when the deposit was made.
    *
    * The 'S' sums are stored in a mapping (scale => sum).
    * - The mapping records the sum S at different scales.
    */
    mapping(uint256 => uint256) public scaleToS;
    mapping(uint256 => uint256) public scaleToB;

    // --- Events ---

    event TroveManagerAddressChanged(address _newTroveManagerAddress);
    event BoldTokenAddressChanged(address _newBoldTokenAddress);
    event RebalanceExecuted(uint256 amountCollIn, uint256 amountStableOut);

    /**
     * @dev Should be called with disable=true in deployments when it's accessed through a Proxy.
     * Call this with disable=false during testing, when used without a proxy.
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(bool disable, ISystemParams _systemParams) {
        if (disable) {
            _disableInitializers();
        }

        systemParams = _systemParams;
    }

    function initialize(IAddressesRegistry _addressesRegistry) external initializer {
        __LiquityBase_init(_addressesRegistry);

        collToken = _addressesRegistry.collToken();
        troveManager = _addressesRegistry.troveManager();
        boldToken = _addressesRegistry.boldToken();
        liquidityStrategy = _addressesRegistry.liquidityStrategy();

        emit TroveManagerAddressChanged(address(troveManager));
        emit BoldTokenAddressChanged(address(boldToken));
    }

    // --- Getters for public variables. Required by IPool interface ---

    function getCollBalance() external view override returns (uint256) {
        return collBalance;
    }

    function getTotalBoldDeposits() external view override returns (uint256) {
        return totalBoldDeposits;
    }

    function getYieldGainsOwed() external view override returns (uint256) {
        return yieldGainsOwed;
    }

    function getYieldGainsPending() external view override returns (uint256) {
        return yieldGainsPending;
    }

    // --- External Depositor Functions ---

    /*  provideToSP():
    * - Calculates depositor's Coll gain
    * - Calculates the compounded deposit
    * - Increases deposit, and takes new snapshots of accumulators P and S
    * - Sends depositor's accumulated Coll gains to depositor
    */
    function provideToSP(uint256 _topUp, bool _doClaim) external override {
        _requireNonZeroAmount(_topUp);

        activePool.mintAggInterest();

        uint256 initialDeposit = deposits[msg.sender].initialValue;

        uint256 currentCollGain = getDepositorCollGain(msg.sender);
        uint256 currentYieldGain = getDepositorYieldGain(msg.sender);
        uint256 compoundedBoldDeposit = getCompoundedBoldDeposit(msg.sender);
        (uint256 keptYieldGain, uint256 yieldGainToSend) = _getYieldToKeepOrSend(currentYieldGain, _doClaim);
        uint256 newDeposit = compoundedBoldDeposit + _topUp + keptYieldGain;
        (uint256 newStashedColl, uint256 collToSend) =
            _getNewStashedCollAndCollToSend(msg.sender, currentCollGain, _doClaim);

        emit DepositOperation(
            msg.sender,
            Operation.provideToSP,
            initialDeposit - compoundedBoldDeposit,
            int256(_topUp),
            currentYieldGain,
            yieldGainToSend,
            currentCollGain,
            collToSend
        );

        _updateDepositAndSnapshots(msg.sender, newDeposit, newStashedColl);
        boldToken.sendToPool(msg.sender, address(this), _topUp);
        _updateTotalBoldDeposits(_topUp + keptYieldGain, 0);
        _decreaseYieldGainsOwed(currentYieldGain);
        _sendBoldtoDepositor(msg.sender, yieldGainToSend);
        _sendCollGainToDepositor(collToSend);

        // If there were pending yields and with the new deposit we are reaching the threshold, let’s move the yield to owed
        _updateYieldRewardsSum(0);
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
    * - Calculates depositor's Coll gain
    * - Calculates the compounded deposit
    * - Sends the requested BOLD withdrawal to depositor
    * - (If _amount > userDeposit, the user withdraws all of their compounded deposit)
    * - Decreases deposit by withdrawn amount and takes new snapshots of accumulators P and S
    */
    function withdrawFromSP(uint256 _amount, bool _doClaim) external override {
        uint256 initialDeposit = deposits[msg.sender].initialValue;
        _requireUserHasDeposit(initialDeposit);

        activePool.mintAggInterest();

        uint256 currentCollGain = getDepositorCollGain(msg.sender);
        uint256 currentYieldGain = getDepositorYieldGain(msg.sender);
        uint256 compoundedBoldDeposit = getCompoundedBoldDeposit(msg.sender);
        uint256 boldToWithdraw = LiquityMath._min(_amount, compoundedBoldDeposit);
        (uint256 keptYieldGain, uint256 yieldGainToSend) = _getYieldToKeepOrSend(currentYieldGain, _doClaim);
        uint256 newDeposit = compoundedBoldDeposit - boldToWithdraw + keptYieldGain;
        (uint256 newStashedColl, uint256 collToSend) =
            _getNewStashedCollAndCollToSend(msg.sender, currentCollGain, _doClaim);

        emit DepositOperation(
            msg.sender,
            Operation.withdrawFromSP,
            initialDeposit - compoundedBoldDeposit,
            -int256(boldToWithdraw),
            currentYieldGain,
            yieldGainToSend,
            currentCollGain,
            collToSend
        );

        _updateDepositAndSnapshots(msg.sender, newDeposit, newStashedColl);
        _decreaseYieldGainsOwed(currentYieldGain);
        uint256 newTotalBoldDeposits = _updateTotalBoldDeposits(keptYieldGain, boldToWithdraw);
        _sendBoldtoDepositor(msg.sender, boldToWithdraw + yieldGainToSend);
        _sendCollGainToDepositor(collToSend);

        require(
            newTotalBoldDeposits >= systemParams.MIN_BOLD_IN_SP(),
            "Withdrawal must leave totalBoldDeposits >= MIN_BOLD_IN_SP"
        );
    }

    function _getNewStashedCollAndCollToSend(address _depositor, uint256 _currentCollGain, bool _doClaim)
        internal
        view
        returns (uint256 newStashedColl, uint256 collToSend)
    {
        if (_doClaim) {
            newStashedColl = 0;
            collToSend = stashedColl[_depositor] + _currentCollGain;
        } else {
            newStashedColl = stashedColl[_depositor] + _currentCollGain;
            collToSend = 0;
        }
    }

    // This function is only needed in the case a user has no deposit but still has remaining stashed Coll gains.
    function claimAllCollGains() external {
        _requireUserHasNoDeposit(msg.sender);

        activePool.mintAggInterest();

        uint256 collToSend = stashedColl[msg.sender];
        _requireNonZeroAmount(collToSend);
        stashedColl[msg.sender] = 0;

        emit DepositOperation(msg.sender, Operation.claimAllCollGains, 0, 0, 0, 0, 0, collToSend);
        emit DepositUpdated(msg.sender, 0, 0, 0, 0, 0, 0);

        _sendCollGainToDepositor(collToSend);
    }

    // --- BOLD reward functions ---

    function triggerBoldRewards(uint256 _boldYield) external {
        _requireCallerIsActivePool();
        _updateYieldRewardsSum(_boldYield);
    }

    function _updateYieldRewardsSum(uint256 _newYield) internal {
        uint256 accumulatedYieldGains = yieldGainsPending + _newYield;
        if (accumulatedYieldGains == 0) return;

        // When total deposits is very small, B is not updated. In this case, the BOLD issued is held
        // until the total deposits reach 1 BOLD (remains in the balance of the SP).
        if (totalBoldDeposits < systemParams.MIN_BOLD_IN_SP()) {
            yieldGainsPending = accumulatedYieldGains;
            return;
        }

        yieldGainsOwed += accumulatedYieldGains;
        yieldGainsPending = 0;

        scaleToB[currentScale] += P * accumulatedYieldGains / totalBoldDeposits;
        emit B_Updated(scaleToB[currentScale], currentScale);
    }

    // --- Liquidity strategy functions ---

    /*
    * Stable token liquidity in the stability pool can be used to rebalance FPMM pools.
    * Collateral will be swapped for stable tokens in the SP.
    * Removed stable tokens will be factored out from LPs' positions.
    * Added collateral will be added to LPs collateral gain which can be later claimed by the depositor.
    */
    function swapCollateralForStable(uint256 amountCollIn, uint256 amountStableOut) external {
        _requireCallerIsLiquidityStrategy();
        _requireNoShutdown();
        

        activePool.mintAggInterest();

        _updateTrackingVariables(amountStableOut, amountCollIn);

        _swapCollateralForStable(amountCollIn, amountStableOut);

        require(
            totalBoldDeposits >= systemParams.MIN_BOLD_AFTER_REBALANCE(),
            "Total Bold deposits must be >= MIN_BOLD_AFTER_REBALANCE"
        );
        emit RebalanceExecuted(amountCollIn, amountStableOut);
    }

    // --- Liquidation functions ---

    /*
    * Cancels out the specified debt against the Bold contained in the Stability Pool (as far as possible)
    * and transfers the Trove's Coll collateral from ActivePool to StabilityPool.
    * Only called by liquidation functions in the TroveManager.
    */
    function offset(uint256 _debtToOffset, uint256 _collToAdd) external override {
        _requireCallerIsTroveManager();

        _updateTrackingVariables(_debtToOffset, _collToAdd);

        _moveOffsetCollAndDebt(_collToAdd, _debtToOffset);
    }

    function _updateTrackingVariables(uint256 _amountStableOut, uint256 _amountCollIn) internal {
        scaleToS[currentScale] += P * _amountCollIn / totalBoldDeposits;
        emit S_Updated(scaleToS[currentScale], currentScale);

        uint256 numerator = P * (totalBoldDeposits - _amountStableOut);
        uint256 newP = numerator / totalBoldDeposits;

        // For `P` to turn zero, `totalBoldDeposits` has to be greater than `P * (totalBoldDeposits - _debtToOffset)`.
        // - As the offset must leave at least 1 BOLD in the SP (MIN_BOLD_IN_SP),
        //   the minimum value of `totalBoldDeposits - _debtToOffset` is `1e18`
        // - It can be shown that `P` is always in range [1e27, 1e36].
        // Thus, to turn `P` zero, `totalBoldDeposits` has to be greater than `1e27 * 1e18`,
        // and the offset has to be (near) maximal.
        // In other words, there needs to be octillions of BOLD in the SP, which is unlikely to happen in practice.
        require(newP > 0, "P must never decrease to 0");

        // Overflow analyisis of scaling up P:
        // We know that the resulting P is <= 1e36, and it's the result of dividing numerator by totalBoldDeposits.
        // Thus, numerator <= 1e36 * totalBoldDeposits, so unless totalBoldDeposits is septillions of BOLD, it won’t overflow.
        // That holds on every iteration as an upper bound. We multiply numerator by SCALE_FACTOR,
        // but numerator is by definition smaller than 1e36 * totalBoldDeposits / SCALE_FACTOR.
        while (newP < P_PRECISION / SCALE_FACTOR) {
            numerator *= SCALE_FACTOR;
            newP = numerator / totalBoldDeposits;
            currentScale += 1;
            emit ScaleUpdated(currentScale);
        }

        emit P_Updated(newP);
        P = newP;
    }

    function _swapCollateralForStable(uint256 _amountCollIn, uint256 _amountStableOut) internal {
        _updateTotalBoldDeposits(0, _amountStableOut);
        IERC20(address(boldToken)).safeTransfer(liquidityStrategy, _amountStableOut);

        collBalance += _amountCollIn;
        collToken.safeTransferFrom(msg.sender, address(this), _amountCollIn);

        emit StabilityPoolCollBalanceUpdated(collBalance);
    }

    function _moveOffsetCollAndDebt(uint256 _collToAdd, uint256 _debtToOffset) internal {
        // Cancel the liquidated Bold debt with the Bold in the stability pool
        _updateTotalBoldDeposits(0, _debtToOffset);

        // Burn the debt that was successfully offset
        boldToken.burn(address(this), _debtToOffset);

        // Update internal Coll balance tracker
        uint256 newCollBalance = collBalance + _collToAdd;
        collBalance = newCollBalance;

        // Pull Coll from Active Pool
        activePool.sendColl(address(this), _collToAdd);

        emit StabilityPoolCollBalanceUpdated(newCollBalance);
    }

    function _updateTotalBoldDeposits(uint256 _depositIncrease, uint256 _depositDecrease) internal returns (uint256) {
        if (_depositIncrease == 0 && _depositDecrease == 0) return totalBoldDeposits;
        uint256 newTotalBoldDeposits = totalBoldDeposits + _depositIncrease - _depositDecrease;
        totalBoldDeposits = newTotalBoldDeposits;

        emit StabilityPoolBoldBalanceUpdated(newTotalBoldDeposits);
        return newTotalBoldDeposits;
    }

    function _decreaseYieldGainsOwed(uint256 _amount) internal {
        if (_amount == 0) return;
        uint256 newYieldGainsOwed = yieldGainsOwed - _amount;
        yieldGainsOwed = newYieldGainsOwed;
    }

    // --- Reward calculator functions for depositor ---

    function getDepositorCollGain(address _depositor) public view override returns (uint256) {
        uint256 initialDeposit = deposits[_depositor].initialValue;
        if (initialDeposit == 0) return 0;

        Snapshots storage snapshots = depositSnapshots[_depositor];

        // Coll gains from the same scale in which the deposit was made need no scaling
        uint256 normalizedGains = scaleToS[snapshots.scale] - snapshots.S;

        // Scale down further coll gains by a power of `SCALE_FACTOR` depending on how many scale changes they span
        for (uint256 i = 1; i <= SCALE_SPAN; ++i) {
            normalizedGains += scaleToS[snapshots.scale + i] / SCALE_FACTOR ** i;
        }

        return LiquityMath._min(initialDeposit * normalizedGains / snapshots.P, collBalance);
    }

    function getDepositorYieldGain(address _depositor) public view override returns (uint256) {
        uint256 initialDeposit = deposits[_depositor].initialValue;
        if (initialDeposit == 0) return 0;

        Snapshots storage snapshots = depositSnapshots[_depositor];

        // Yield gains from the same scale in which the deposit was made need no scaling
        uint256 normalizedGains = scaleToB[snapshots.scale] - snapshots.B;

        // Scale down further yield gains by a power of `SCALE_FACTOR` depending on how many scale changes they span
        for (uint256 i = 1; i <= SCALE_SPAN; ++i) {
            normalizedGains += scaleToB[snapshots.scale + i] / SCALE_FACTOR ** i;
        }

        return LiquityMath._min(initialDeposit * normalizedGains / snapshots.P, yieldGainsOwed);
    }

    function getDepositorYieldGainWithPending(address _depositor) external view override returns (uint256) {
        if (totalBoldDeposits < systemParams.MIN_BOLD_IN_SP()) return 0;

        uint256 initialDeposit = deposits[_depositor].initialValue;
        if (initialDeposit == 0) return 0;

        Snapshots storage snapshots = depositSnapshots[_depositor];
        uint256 newYieldGainsOwed = yieldGainsOwed;

        // Yield gains from the same scale in which the deposit was made need no scaling
        uint256 normalizedGains = scaleToB[snapshots.scale] - snapshots.B;

        // Scale down further yield gains by a power of `SCALE_FACTOR` depending on how many scale changes they span
        for (uint256 i = 1; i <= SCALE_SPAN; ++i) {
            normalizedGains += scaleToB[snapshots.scale + i] / SCALE_FACTOR ** i;
        }

        // Pending gains
        uint256 pendingSPYield = activePool.calcPendingSPYield();
        newYieldGainsOwed += pendingSPYield;

        if (currentScale <= snapshots.scale + SCALE_SPAN) {
            normalizedGains += P * pendingSPYield / totalBoldDeposits / SCALE_FACTOR ** (currentScale - snapshots.scale);
        }

        return LiquityMath._min(initialDeposit * normalizedGains / snapshots.P, newYieldGainsOwed);
    }

    // --- Compounded deposit ---

    function getCompoundedBoldDeposit(address _depositor) public view override returns (uint256 compoundedDeposit) {
        uint256 initialDeposit = deposits[_depositor].initialValue;
        if (initialDeposit == 0) return 0;

        Snapshots storage snapshots = depositSnapshots[_depositor];

        uint256 scaleDiff = currentScale - snapshots.scale;

        // Compute the compounded deposit. If one or more scale changes in `P` were made during the deposit's lifetime,
        // account for them.
        // If more than `MAX_SCALE_FACTOR_EXPONENT` scale changes were made, then the divisor is greater than 2^256 so
        // any deposit amount would be rounded down to zero.
        if (scaleDiff <= MAX_SCALE_FACTOR_EXPONENT) {
            compoundedDeposit = initialDeposit * P / snapshots.P / SCALE_FACTOR ** scaleDiff;
        } else {
            compoundedDeposit = 0;
        }
    }

    // --- Sender functions for Bold deposit and Coll gains ---

    function _sendCollGainToDepositor(uint256 _collAmount) internal {
        if (_collAmount == 0) return;

        uint256 newCollBalance = collBalance - _collAmount;
        collBalance = newCollBalance;
        emit StabilityPoolCollBalanceUpdated(newCollBalance);
        collToken.safeTransfer(msg.sender, _collAmount);
    }

    // Send Bold to user and decrease Bold in Pool
    function _sendBoldtoDepositor(address _depositor, uint256 _boldToSend) internal {
        if (_boldToSend == 0) return;
        boldToken.returnFromPool(address(this), _depositor, _boldToSend);
    }

    // --- Stability Pool Deposit Functionality ---

    function _updateDepositAndSnapshots(address _depositor, uint256 _newDeposit, uint256 _newStashedColl) internal {
        deposits[_depositor].initialValue = _newDeposit;
        stashedColl[_depositor] = _newStashedColl;

        if (_newDeposit == 0) {
            delete depositSnapshots[_depositor];
            emit DepositUpdated(_depositor, 0, _newStashedColl, 0, 0, 0, 0);
            return;
        }

        uint256 currentScaleCached = currentScale;
        uint256 currentP = P;

        // Get S for the current scale
        uint256 currentS = scaleToS[currentScaleCached];
        uint256 currentB = scaleToB[currentScaleCached];

        // Record new snapshots of the latest running product P and sum S for the depositor
        depositSnapshots[_depositor].P = currentP;
        depositSnapshots[_depositor].S = currentS;
        depositSnapshots[_depositor].B = currentB;
        depositSnapshots[_depositor].scale = currentScaleCached;

        emit DepositUpdated(_depositor, _newDeposit, _newStashedColl, currentP, currentS, currentB, currentScaleCached);
    }

    // --- 'require' functions ---

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == address(activePool), "StabilityPool: Caller is not ActivePool");
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == address(troveManager), "StabilityPool: Caller is not TroveManager");
    }

    function _requireUserHasDeposit(uint256 _initialDeposit) internal pure {
        require(_initialDeposit > 0, "StabilityPool: User must have a non-zero deposit");
    }

    function _requireUserHasNoDeposit(address _address) internal view {
        uint256 initialDeposit = deposits[_address].initialValue;
        require(initialDeposit == 0, "StabilityPool: User must have no deposit");
    }

    function _requireCallerIsLiquidityStrategy() internal view {
        require(msg.sender == liquidityStrategy, "StabilityPool: Caller is not LiquidityStrategy");
    }

    function _requireNonZeroAmount(uint256 _amount) internal pure {
        require(_amount > 0, "StabilityPool: Amount must be non-zero");
    }

    function _requireNoShutdown() internal view {
        require(troveManager.shutdownTime() == 0, "StabilityPool: System is shut down");
    }
}
