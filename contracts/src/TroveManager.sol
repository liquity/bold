// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/IBoldToken.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/IInterestRouter.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";

import "forge-std/console2.sol";

contract TroveManager is ERC721, LiquityBase, Ownable, CheckContract, ITroveManager {
    string constant public NAME = "TroveManager"; // TODO
    string constant public SYMBOL = "Lv2T"; // TODO

    // --- Connected contract declarations ---

    address public borrowerOperationsAddress;

    IStabilityPool public override stabilityPool;

    address gasPoolAddress;

    ICollSurplusPool collSurplusPool;

    IBoldToken public override boldToken;

    // A doubly linked list of Troves, sorted by their sorted by their collateral ratios
    ISortedTroves public sortedTroves;

    IInterestRouter public interestRouter;

    // --- Data structures ---

    uint constant public SECONDS_IN_ONE_MINUTE = 60;

    uint256 constant public SECONDS_IN_ONE_YEAR = 31536000; // 60 * 60 * 24 * 365,

    /*
     * Half-life of 12h. 12h = 720 min
     * (1/2) = d^720 => d = (1/2)^(1/720)
     */
    uint constant public MINUTE_DECAY_FACTOR = 999037758833783000;
    uint constant public REDEMPTION_FEE_FLOOR = DECIMAL_PRECISION / 1000 * 5; // 0.5%
    uint constant public MAX_BORROWING_FEE = DECIMAL_PRECISION / 100 * 5; // 5%

    // During bootsrap period redemptions are not allowed
    uint constant public BOOTSTRAP_PERIOD = 14 days;

    /*
    * BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction, in order to calc the new base rate from a redemption.
    * Corresponds to (1 / ALPHA) in the white paper.
    */
    uint constant public BETA = 2;

    uint public baseRate;

    // The timestamp of the latest fee operation (redemption or new Bold issuance)
    uint public lastFeeOperationTime;

    enum Status {
        nonExistent,
        active,
        closedByOwner,
        closedByLiquidation,
        closedByRedemption
    }

    // Store the necessary data for a trove
    struct Trove {
        uint debt;
        uint coll;
        uint stake;
        Status status;
        uint128 arrayIndex;
        uint256 annualInterestRate;
        uint64 lastDebtUpdateTime;
        // TODO: optimize this struct packing for gas reduction, which may break v1 tests that assume a certain order of properties
    }

    mapping (uint256 => Trove) public Troves;
    /*
     * Mapping from TroveId to granted address for operations that “give” money to the trove (add collateral, pay debt).
     * Useful for instance for cold/hot wallet setups.
     * If its value is zero address, any address is allowed to do those operations on behalf of trove owner.
     * Otherwise, only the address in this mapping (and the trove owner) will be allowed.
     * To restrict this permission to no one, trove owner should be set in this mapping.
     */
    mapping (uint256 => address) public TroveAddManagers;
    /*
     * Mapping from TroveId to granted address for operations that “withdraw” money from the trove (withdraw collateral, borrow).
     * Useful for instance for cold/hot wallet setups.
     * If its value is zero address, only owner is allowed to do those operations.
     * Otherwise, only the address in this mapping (and the trove owner) will be allowed.
     * Therefore, by default this permission is restricted to no one.
     * Trove owner be set in this mapping is equivalent to zero address.
     */
    mapping (uint256 => address) public TroveRemoveManagers;

    uint public totalStakes;

    // Snapshot of the value of totalStakes, taken immediately after the latest liquidation
    uint public totalStakesSnapshot;

    // Snapshot of the total collateral across the ActivePool and DefaultPool, immediately after the latest liquidation.
    uint public totalCollateralSnapshot;

    /*
    * L_ETH and L_boldDebt track the sums of accumulated liquidation rewards per unit staked. During its lifetime, each stake earns:
    *
    * An ETH gain of ( stake * [L_ETH - L_ETH(0)] )
    * A boldDebt increase  of ( stake * [L_boldDebt - L_boldDebt(0)] )
    *
    * Where L_ETH(0) and L_boldDebt(0) are snapshots of L_ETH and L_boldDebt for the active Trove taken at the instant the stake was made
    */
    uint public L_ETH;
    uint public L_boldDebt;

    // Map addresses with active troves to their RewardSnapshot
    mapping (uint256 => RewardSnapshot) public rewardSnapshots;

    // Object containing the ETH and Bold snapshots for a given active trove
    struct RewardSnapshot { uint ETH; uint boldDebt;}

    // Array of all active trove addresses - used to to compute an approximate hint off-chain, for the sorted list insertion
    uint256[] public TroveIds;

    // Error trackers for the trove redistribution calculation
    uint public lastETHError_Redistribution;
    uint public lastBoldDebtError_Redistribution;

    uint256 public aggRecordedDebt;
    /* Sum of individual recorded Trove debts, weighted by their respective chosen interest rates.
    * Updated at all Trove operations.
    */
    uint256 public aggWeightedDebtSum;

    // Last time at which the aggregate recorded debt and weighted sum were updated
    uint256 public lastAggUpdateTime;
    /*
    * --- Variable container structs for liquidations ---
    *
    * These structs are used to hold, return and assign variables inside the liquidation functions,
    * in order to avoid the error: "CompilerError: Stack too deep".
    **/

    struct LocalVariables_OuterLiquidationFunction {
        uint price;
        uint boldInStabPool;
        bool recoveryModeAtStart;
        uint liquidatedDebt;
        uint liquidatedColl;
    }

    struct LocalVariables_InnerSingleLiquidateFunction {
        uint collToLiquidate;
        uint pendingDebtReward;
        uint pendingCollReward;
    }

    struct LocalVariables_LiquidationSequence {
        uint remainingBoldInStabPool;
        uint i;
        uint ICR;
        uint256 troveId;
        bool backToNormalMode;
        uint entireSystemDebt;
        uint entireSystemColl;
    }

    struct LiquidationValues {
        uint entireTroveDebt;
        uint entireTroveColl;
        uint collGasCompensation;
        uint BoldGasCompensation;
        uint debtToOffset;
        uint collToSendToSP;
        uint debtToRedistribute;
        uint collToRedistribute;
        uint collSurplus;
    }

    struct LiquidationTotals {
        uint totalCollInSequence;
        uint totalDebtInSequence;
        uint totalCollGasCompensation;
        uint totalBoldGasCompensation;
        uint totalDebtToOffset;
        uint totalCollToSendToSP;
        uint totalDebtToRedistribute;
        uint totalCollToRedistribute;
        uint totalCollSurplus;
    }

    struct ContractsCache {
        IActivePool activePool;
        IDefaultPool defaultPool;
        IBoldToken boldToken;
        ISortedTroves sortedTroves;
        ICollSurplusPool collSurplusPool;
        address gasPoolAddress;
    }
    // --- Variable container structs for redemptions ---

    struct RedemptionTotals {
        uint remainingBold;
        uint totalBoldToRedeem;
        uint totalETHDrawn;
        uint ETHFee;
        uint ETHToSendToRedeemer;
        uint decayedBaseRate;
        uint price;
        uint totalBoldSupplyAtStart;
    }

    struct SingleRedemptionValues {
        uint BoldLot;
        uint ETHLot;
        bool cancelledPartial;
    }

    // --- Events ---

    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);
    event BoldTokenAddressChanged(address _newBoldTokenAddress);
    event ActivePoolAddressChanged(address _activePoolAddress);
    event DefaultPoolAddressChanged(address _defaultPoolAddress);
    event StabilityPoolAddressChanged(address _stabilityPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);

    event Liquidation(uint _liquidatedDebt, uint _liquidatedColl, uint _collGasCompensation, uint _boldGasCompensation);
    event Redemption(uint _attemptedBoldAmount, uint _actualBoldAmount, uint _ETHSent, uint _ETHFee);
    event TroveUpdated(uint256 indexed _troveId, uint _debt, uint _coll, uint _stake, TroveManagerOperation _operation);
    event TroveLiquidated(uint256 indexed _troveId, uint _debt, uint _coll, TroveManagerOperation _operation);
    event BaseRateUpdated(uint _baseRate);
    event LastFeeOpTimeUpdated(uint _lastFeeOpTime);
    event TotalStakesUpdated(uint _newTotalStakes);
    event SystemSnapshotsUpdated(uint _totalStakesSnapshot, uint _totalCollateralSnapshot);
    event LTermsUpdated(uint _L_ETH, uint _L_boldDebt);
    event TroveSnapshotsUpdated(uint _L_ETH, uint _L_boldDebt);
    event TroveIndexUpdated(uint256 _troveId, uint _newIndex);

     enum TroveManagerOperation {
        getAndApplyRedistributionGains,
        liquidateInNormalMode,
        liquidateInRecoveryMode,
        redeemCollateral
    }

    constructor() ERC721(NAME, SYMBOL) {}

    // --- Dependency setter ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _activePoolAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress,
        address _gasPoolAddress,
        address _collSurplusPoolAddress,
        address _priceFeedAddress,
        address _boldTokenAddress,
        address _sortedTrovesAddress,
        address _interestRouterAddress
    )
        external
        override
        onlyOwner
    {
        checkContract(_borrowerOperationsAddress);
        checkContract(_activePoolAddress);
        checkContract(_defaultPoolAddress);
        checkContract(_stabilityPoolAddress);
        checkContract(_gasPoolAddress);
        checkContract(_collSurplusPoolAddress);
        checkContract(_priceFeedAddress);
        checkContract(_boldTokenAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_interestRouterAddress);

        borrowerOperationsAddress = _borrowerOperationsAddress;
        activePool = IActivePool(_activePoolAddress);
        defaultPool = IDefaultPool(_defaultPoolAddress);
        stabilityPool = IStabilityPool(_stabilityPoolAddress);
        gasPoolAddress = _gasPoolAddress;
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        boldToken = IBoldToken(_boldTokenAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        interestRouter = IInterestRouter(_interestRouterAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit GasPoolAddressChanged(_gasPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit BoldTokenAddressChanged(_boldTokenAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);

        _renounceOwnership();
    }

    // --- Getters ---

    function getTroveIdsCount() external view override returns (uint) {
        return TroveIds.length;
    }

    function getTroveFromTroveIdsArray(uint _index) external view override returns (uint256) {
        return TroveIds[_index];
    }

    // --- Trove Liquidation functions ---

    // Single liquidation function. Closes the trove if its ICR is lower than the minimum collateral ratio.
    function liquidate(uint256 _troveId) external override {
        _requireTroveIsActive(_troveId);

        uint256[] memory troves = new uint256[](1);
        troves[0] = _troveId;
        batchLiquidateTroves(troves);
    }

    // --- Inner single liquidation functions ---

    // Liquidate one trove, in Normal Mode.
    function _liquidateNormalMode(
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        uint256 _troveId,
        uint _boldInStabPool
    )
        internal
        returns (LiquidationValues memory singleLiquidation)
    {
        LocalVariables_InnerSingleLiquidateFunction memory vars;

        (singleLiquidation.entireTroveDebt,
        singleLiquidation.entireTroveColl,
        vars.pendingDebtReward,
        vars.pendingCollReward, ) = getEntireDebtAndColl(_troveId);

        _movePendingTroveRewardsToActivePool(_activePool, _defaultPool, vars.pendingDebtReward, vars.pendingCollReward);
        _removeStake(_troveId);

        singleLiquidation.collGasCompensation = _getCollGasCompensation(singleLiquidation.entireTroveColl);
        singleLiquidation.BoldGasCompensation = BOLD_GAS_COMPENSATION;
        uint collToLiquidate = singleLiquidation.entireTroveColl - singleLiquidation.collGasCompensation;

        (singleLiquidation.debtToOffset,
        singleLiquidation.collToSendToSP,
        singleLiquidation.debtToRedistribute,
        singleLiquidation.collToRedistribute) = _getOffsetAndRedistributionVals(singleLiquidation.entireTroveDebt, collToLiquidate, _boldInStabPool);

        _closeTrove(_troveId, Status.closedByLiquidation);
        emit TroveLiquidated(_troveId, singleLiquidation.entireTroveDebt, singleLiquidation.entireTroveColl, TroveManagerOperation.liquidateInNormalMode);
        emit TroveUpdated(_troveId, 0, 0, 0, TroveManagerOperation.liquidateInNormalMode);
        return singleLiquidation;
    }

    // Liquidate one trove, in Recovery Mode.
    function _liquidateRecoveryMode(
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        uint256 _troveId,
        uint _ICR,
        uint _boldInStabPool,
        uint _TCR,
        uint _price
    )
        internal
        returns (LiquidationValues memory singleLiquidation)
    {
        LocalVariables_InnerSingleLiquidateFunction memory vars;
        if (TroveIds.length <= 1) {return singleLiquidation;} // don't liquidate if last trove
        (singleLiquidation.entireTroveDebt,
        singleLiquidation.entireTroveColl,
        vars.pendingDebtReward,
        vars.pendingCollReward, ) = getEntireDebtAndColl(_troveId);

        singleLiquidation.collGasCompensation = _getCollGasCompensation(singleLiquidation.entireTroveColl);
        singleLiquidation.BoldGasCompensation = BOLD_GAS_COMPENSATION;
        vars.collToLiquidate = singleLiquidation.entireTroveColl - singleLiquidation.collGasCompensation;

        // If ICR <= 100%, purely redistribute the Trove across all active Troves
        if (_ICR <= _100pct) {
            _movePendingTroveRewardsToActivePool(_activePool, _defaultPool, vars.pendingDebtReward, vars.pendingCollReward);
            _removeStake(_troveId);

            singleLiquidation.debtToOffset = 0;
            singleLiquidation.collToSendToSP = 0;
            singleLiquidation.debtToRedistribute = singleLiquidation.entireTroveDebt;
            singleLiquidation.collToRedistribute = vars.collToLiquidate;

            _closeTrove(_troveId, Status.closedByLiquidation);
            emit TroveLiquidated(_troveId, singleLiquidation.entireTroveDebt, singleLiquidation.entireTroveColl, TroveManagerOperation.liquidateInRecoveryMode);
            emit TroveUpdated(_troveId, 0, 0, 0, TroveManagerOperation.liquidateInRecoveryMode);

        // If 100% < ICR < MCR, offset as much as possible, and redistribute the remainder
        } else if ((_ICR > _100pct) && (_ICR < MCR)) {
             _movePendingTroveRewardsToActivePool(_activePool, _defaultPool, vars.pendingDebtReward, vars.pendingCollReward);
            _removeStake(_troveId);

            (singleLiquidation.debtToOffset,
            singleLiquidation.collToSendToSP,
            singleLiquidation.debtToRedistribute,
            singleLiquidation.collToRedistribute) = _getOffsetAndRedistributionVals(singleLiquidation.entireTroveDebt, vars.collToLiquidate, _boldInStabPool);

            _closeTrove(_troveId, Status.closedByLiquidation);
            emit TroveLiquidated(_troveId, singleLiquidation.entireTroveDebt, singleLiquidation.entireTroveColl, TroveManagerOperation.liquidateInRecoveryMode);
            emit TroveUpdated(_troveId, 0, 0, 0, TroveManagerOperation.liquidateInRecoveryMode);
        /*
        * If 110% <= ICR < current TCR (accounting for the preceding liquidations in the current sequence)
        * and there is Bold in the Stability Pool, only offset, with no redistribution,
        * but at a capped rate of 1.1 and only if the whole debt can be liquidated.
        * The remainder due to the capped rate will be claimable as collateral surplus.
        */
        } else if ((_ICR >= MCR) && (_ICR < _TCR) && (singleLiquidation.entireTroveDebt <= _boldInStabPool)) {
            _movePendingTroveRewardsToActivePool(_activePool, _defaultPool, vars.pendingDebtReward, vars.pendingCollReward);
            assert(_boldInStabPool != 0);

            _removeStake(_troveId);
            singleLiquidation = _getCappedOffsetVals(singleLiquidation.entireTroveDebt, singleLiquidation.entireTroveColl, _price);

            _closeTrove(_troveId, Status.closedByLiquidation);
            if (singleLiquidation.collSurplus > 0) {
                collSurplusPool.accountSurplus(_troveId, singleLiquidation.collSurplus);
            }

            emit TroveLiquidated(_troveId, singleLiquidation.entireTroveDebt, singleLiquidation.collToSendToSP, TroveManagerOperation.liquidateInRecoveryMode);
            emit TroveUpdated(_troveId, 0, 0, 0, TroveManagerOperation.liquidateInRecoveryMode);

        } else { // if (_ICR >= MCR && ( _ICR >= _TCR || singleLiquidation.entireTroveDebt > _boldInStabPool))
            LiquidationValues memory zeroVals;
            return zeroVals;
        }

        return singleLiquidation;
    }

    /* In a full liquidation, returns the values for a trove's coll and debt to be offset, and coll and debt to be
    * redistributed to active troves.
    */
    function _getOffsetAndRedistributionVals
    (
        uint _debt,
        uint _coll,
        uint _boldInStabPool
    )
        internal
        pure
        returns (uint debtToOffset, uint collToSendToSP, uint debtToRedistribute, uint collToRedistribute)
    {
        if (_boldInStabPool > 0) {
        /*
        * Offset as much debt & collateral as possible against the Stability Pool, and redistribute the remainder
        * between all active troves.
        *
        *  If the trove's debt is larger than the deposited Bold in the Stability Pool:
        *
        *  - Offset an amount of the trove's debt equal to the Bold in the Stability Pool
        *  - Send a fraction of the trove's collateral to the Stability Pool, equal to the fraction of its offset debt
        *
        */
            debtToOffset = LiquityMath._min(_debt, _boldInStabPool);
            collToSendToSP = _coll * debtToOffset / _debt;
            debtToRedistribute = _debt - debtToOffset;
            collToRedistribute = _coll - collToSendToSP;
        } else {
            debtToOffset = 0;
            collToSendToSP = 0;
            debtToRedistribute = _debt;
            collToRedistribute = _coll;
        }
    }

    /*
    *  Get its offset coll/debt and ETH gas comp, and close the trove.
    */
    function _getCappedOffsetVals
    (
        uint _entireTroveDebt,
        uint _entireTroveColl,
        uint _price
    )
        internal
        pure
        returns (LiquidationValues memory singleLiquidation)
    {
        singleLiquidation.entireTroveDebt = _entireTroveDebt;
        singleLiquidation.entireTroveColl = _entireTroveColl;
        uint cappedCollPortion = _entireTroveDebt * MCR / _price;

        singleLiquidation.collGasCompensation = _getCollGasCompensation(cappedCollPortion);
        singleLiquidation.BoldGasCompensation = BOLD_GAS_COMPENSATION;

        singleLiquidation.debtToOffset = _entireTroveDebt;
        singleLiquidation.collToSendToSP = cappedCollPortion - singleLiquidation.collGasCompensation;
        singleLiquidation.collSurplus = _entireTroveColl - cappedCollPortion;
        singleLiquidation.debtToRedistribute = 0;
        singleLiquidation.collToRedistribute = 0;
    }

    /*
    * This function is used when the liquidateTroves sequence starts during Recovery Mode. However, it
    * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
    */
    function _getTotalsFromLiquidateTrovesSequence_RecoveryMode
    (
        ContractsCache memory _contractsCache,
        uint _price,
        uint _boldInStabPool,
        uint _n
    )
        internal
        returns(LiquidationTotals memory totals)
    {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingBoldInStabPool = _boldInStabPool;
        vars.backToNormalMode = false;
        vars.entireSystemDebt = getEntireSystemDebt();
        vars.entireSystemColl = getEntireSystemColl();

        vars.troveId = _contractsCache.sortedTroves.getLast();
        uint256 firstUser = _contractsCache.sortedTroves.getFirst();
        for (vars.i = 0; vars.i < _n && vars.troveId != firstUser; vars.i++) {
            // we need to cache it, because current trove is likely going to be deleted
            uint256 nextUser = _contractsCache.sortedTroves.getPrev(vars.troveId);

            vars.ICR = getCurrentICR(vars.troveId, _price);

            if (!vars.backToNormalMode) {
                // Break the loop if ICR is greater than MCR and Stability Pool is empty
                if (vars.ICR >= MCR && vars.remainingBoldInStabPool == 0) { break; }

                uint TCR = LiquityMath._computeCR(vars.entireSystemColl, vars.entireSystemDebt, _price);

                singleLiquidation = _liquidateRecoveryMode(_contractsCache.activePool, _contractsCache.defaultPool, vars.troveId, vars.ICR, vars.remainingBoldInStabPool, TCR, _price);

                // Update aggregate trackers
                vars.remainingBoldInStabPool = vars.remainingBoldInStabPool - singleLiquidation.debtToOffset;
                vars.entireSystemDebt = vars.entireSystemDebt - singleLiquidation.debtToOffset;
                vars.entireSystemColl = vars.entireSystemColl
                    - singleLiquidation.collToSendToSP
                    - singleLiquidation.collGasCompensation
                    - singleLiquidation.collSurplus;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

                vars.backToNormalMode = !_checkPotentialRecoveryMode(vars.entireSystemColl, vars.entireSystemDebt, _price);
            }
            else if (vars.backToNormalMode && vars.ICR < MCR) {
                singleLiquidation = _liquidateNormalMode(_contractsCache.activePool, _contractsCache.defaultPool, vars.troveId, vars.remainingBoldInStabPool);

                vars.remainingBoldInStabPool = vars.remainingBoldInStabPool - singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

            }  else break;  // break if the loop reaches a Trove with ICR >= MCR

            vars.troveId = nextUser;
        }
    }

    function _getTotalsFromLiquidateTrovesSequence_NormalMode
    (
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        uint _price,
        uint _boldInStabPool,
        uint _n
    )
        internal
        returns(LiquidationTotals memory totals)
    {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;
        ISortedTroves sortedTrovesCached = sortedTroves;

        vars.remainingBoldInStabPool = _boldInStabPool;

        for (vars.i = 0; vars.i < _n; vars.i++) {
            vars.troveId = sortedTrovesCached.getLast();
            vars.ICR = getCurrentICR(vars.troveId, _price);

            if (vars.ICR < MCR) {
                singleLiquidation = _liquidateNormalMode(_activePool, _defaultPool, vars.troveId, vars.remainingBoldInStabPool);

                vars.remainingBoldInStabPool = vars.remainingBoldInStabPool - singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

            } else break;  // break if the loop reaches a Trove with ICR >= MCR
        }
    }

    /*
    * Attempt to liquidate a custom list of troves provided by the caller.
    */
    function batchLiquidateTroves(uint256[] memory _troveArray) public override {
        require(_troveArray.length != 0, "TroveManager: Calldata address array must not be empty");

        IActivePool activePoolCached = activePool;
        IDefaultPool defaultPoolCached = defaultPool;
        IStabilityPool stabilityPoolCached = stabilityPool;

        LocalVariables_OuterLiquidationFunction memory vars;
        LiquidationTotals memory totals;

        vars.price = priceFeed.fetchPrice();
        vars.boldInStabPool = stabilityPoolCached.getTotalBoldDeposits();
        vars.recoveryModeAtStart = _checkRecoveryMode(vars.price);

        // Perform the appropriate liquidation sequence - tally values and obtain their totals.
        if (vars.recoveryModeAtStart) {
            totals = _getTotalFromBatchLiquidate_RecoveryMode(activePoolCached, defaultPoolCached, vars.price, vars.boldInStabPool, _troveArray);
        } else {  //  if !vars.recoveryModeAtStart
            totals = _getTotalsFromBatchLiquidate_NormalMode(activePoolCached, defaultPoolCached, vars.price, vars.boldInStabPool, _troveArray);
        }

        require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

        // Move liquidated ETH and Bold to the appropriate pools
        stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
        _redistributeDebtAndColl(activePoolCached, defaultPoolCached, totals.totalDebtToRedistribute, totals.totalCollToRedistribute);
        if (totals.totalCollSurplus > 0) {
            activePoolCached.sendETH(address(collSurplusPool), totals.totalCollSurplus);
        }

        // Update system snapshots
        _updateSystemSnapshots_excludeCollRemainder(activePoolCached, totals.totalCollGasCompensation);

        vars.liquidatedDebt = totals.totalDebtInSequence;
        vars.liquidatedColl = totals.totalCollInSequence - totals.totalCollGasCompensation - totals.totalCollSurplus;
        emit Liquidation(vars.liquidatedDebt, vars.liquidatedColl, totals.totalCollGasCompensation, totals.totalBoldGasCompensation);

        // Send gas compensation to caller
        _sendGasCompensation(activePoolCached, msg.sender, totals.totalBoldGasCompensation, totals.totalCollGasCompensation);
    }

    /*
    * This function is used when the batch liquidation sequence starts during Recovery Mode. However, it
    * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
    */
    function _getTotalFromBatchLiquidate_RecoveryMode
    (
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        uint _price,
        uint _boldInStabPool,
        uint256[] memory _troveArray
    )
        internal
        returns(LiquidationTotals memory totals)
    {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingBoldInStabPool = _boldInStabPool;
        vars.backToNormalMode = false;
        vars.entireSystemDebt = getEntireSystemDebt();
        vars.entireSystemColl = getEntireSystemColl();

        for (vars.i = 0; vars.i < _troveArray.length; vars.i++) {
            vars.troveId = _troveArray[vars.i];
            // Skip non-active troves
            if (Troves[vars.troveId].status != Status.active) { continue; }
            vars.ICR = getCurrentICR(vars.troveId, _price);

            if (!vars.backToNormalMode) {

                // Skip this trove if ICR is greater than MCR and Stability Pool is empty
                if (vars.ICR >= MCR && vars.remainingBoldInStabPool == 0) { continue; }

                uint TCR = LiquityMath._computeCR(vars.entireSystemColl, vars.entireSystemDebt, _price);

                singleLiquidation = _liquidateRecoveryMode(_activePool, _defaultPool, vars.troveId, vars.ICR, vars.remainingBoldInStabPool, TCR, _price);

                // Update aggregate trackers
                vars.remainingBoldInStabPool = vars.remainingBoldInStabPool - singleLiquidation.debtToOffset;
                vars.entireSystemDebt = vars.entireSystemDebt - singleLiquidation.debtToOffset;
                vars.entireSystemColl = vars.entireSystemColl
                    - singleLiquidation.collToSendToSP
                    - singleLiquidation.collGasCompensation
                    - singleLiquidation.collSurplus;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

                vars.backToNormalMode = !_checkPotentialRecoveryMode(vars.entireSystemColl, vars.entireSystemDebt, _price);
            }

            else if (vars.backToNormalMode && vars.ICR < MCR) {
                singleLiquidation = _liquidateNormalMode(_activePool, _defaultPool, vars.troveId, vars.remainingBoldInStabPool);
                vars.remainingBoldInStabPool = vars.remainingBoldInStabPool - singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);

            } else continue; // In Normal Mode skip troves with ICR >= MCR
        }
    }

    function _getTotalsFromBatchLiquidate_NormalMode
    (
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        uint _price,
        uint _boldInStabPool,
        uint256[] memory _troveArray
    )
        internal
        returns(LiquidationTotals memory totals)
    {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingBoldInStabPool = _boldInStabPool;

        for (vars.i = 0; vars.i < _troveArray.length; vars.i++) {
            vars.troveId = _troveArray[vars.i];
            vars.ICR = getCurrentICR(vars.troveId, _price);

            if (vars.ICR < MCR) {
                singleLiquidation = _liquidateNormalMode(_activePool, _defaultPool, vars.troveId, vars.remainingBoldInStabPool);
                vars.remainingBoldInStabPool = vars.remainingBoldInStabPool - singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);
            }
        }
    }

    // --- Liquidation helper functions ---

    function _addLiquidationValuesToTotals(LiquidationTotals memory oldTotals, LiquidationValues memory singleLiquidation)
    internal pure returns(LiquidationTotals memory newTotals) {

        // Tally all the values with their respective running totals
        newTotals.totalCollGasCompensation = oldTotals.totalCollGasCompensation + singleLiquidation.collGasCompensation;
        newTotals.totalBoldGasCompensation = oldTotals.totalBoldGasCompensation + singleLiquidation.BoldGasCompensation;
        newTotals.totalDebtInSequence = oldTotals.totalDebtInSequence + singleLiquidation.entireTroveDebt;
        newTotals.totalCollInSequence = oldTotals.totalCollInSequence + singleLiquidation.entireTroveColl;
        newTotals.totalDebtToOffset = oldTotals.totalDebtToOffset + singleLiquidation.debtToOffset;
        newTotals.totalCollToSendToSP = oldTotals.totalCollToSendToSP + singleLiquidation.collToSendToSP;
        newTotals.totalDebtToRedistribute = oldTotals.totalDebtToRedistribute + singleLiquidation.debtToRedistribute;
        newTotals.totalCollToRedistribute = oldTotals.totalCollToRedistribute + singleLiquidation.collToRedistribute;
        newTotals.totalCollSurplus = oldTotals.totalCollSurplus + singleLiquidation.collSurplus;

        return newTotals;
    }

    function _sendGasCompensation(IActivePool _activePool, address _liquidator, uint _bold, uint _ETH) internal {
        if (_bold > 0) {
            boldToken.returnFromPool(gasPoolAddress, _liquidator, _bold);
        }

        if (_ETH > 0) {
            _activePool.sendETH(_liquidator, _ETH);
        }
    }

    // Move a Trove's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
    function _movePendingTroveRewardsToActivePool(IActivePool _activePool, IDefaultPool _defaultPool, uint _bold, uint _ETH) internal {
        _defaultPool.decreaseBoldDebt(_bold);
        _activePool.increaseBoldDebt(_bold);
        _defaultPool.sendETHToActivePool(_ETH);
    }

    // --- Redemption functions ---

    // Redeem as much collateral as possible from _borrower's Trove in exchange for Bold up to _maxBoldamount
    function _redeemCollateralFromTrove(
        ContractsCache memory _contractsCache,
        uint256 _troveId,
        uint _maxBoldamount,
        uint _price
    )
        internal returns (SingleRedemptionValues memory singleRedemption)
    {
        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the Trove minus the liquidation reserve
        singleRedemption.BoldLot = LiquityMath._min(_maxBoldamount, Troves[_troveId].debt - BOLD_GAS_COMPENSATION);

        // Get the ETHLot of equivalent value in USD
        singleRedemption.ETHLot = singleRedemption.BoldLot * DECIMAL_PRECISION / _price;

        // Decrease the debt and collateral of the current Trove according to the Bold lot and corresponding ETH to send
        uint newDebt = Troves[_troveId].debt - singleRedemption.BoldLot;
        uint newColl = Troves[_troveId].coll - singleRedemption.ETHLot;

        // TODO: zombi troves
        if (newDebt == BOLD_GAS_COMPENSATION) {
            // No debt left in the Trove (except for the liquidation reserve), therefore the trove gets closed
            _removeStake(_troveId);
            _closeTrove(_troveId, Status.closedByRedemption);
            _redeemCloseTrove(_contractsCache, _troveId, BOLD_GAS_COMPENSATION, newColl);
            emit TroveUpdated(_troveId, 0, 0, 0, TroveManagerOperation.redeemCollateral);

        } else {
            Troves[_troveId].debt = newDebt;
            Troves[_troveId].coll = newColl;
            _updateStakeAndTotalStakes(_troveId);

            emit TroveUpdated(
                _troveId,
                newDebt, newColl,
                Troves[_troveId].stake,
                TroveManagerOperation.redeemCollateral
            );
        }

        return singleRedemption;
    }

    /*
    * Called when a full redemption occurs, and closes the trove.
    * The redeemer swaps (debt - liquidation reserve) Bold for (debt - liquidation reserve) worth of ETH, so the Bold liquidation reserve left corresponds to the remaining debt.
    * In order to close the trove, the Bold liquidation reserve is burned, and the corresponding debt is removed from the active pool.
    * The debt recorded on the trove's struct is zero'd elswhere, in _closeTrove.
    * Any surplus ETH left in the trove, is sent to the Coll surplus pool, and can be later claimed by the borrower.
    */
    function _redeemCloseTrove(ContractsCache memory _contractsCache, uint256 _troveId, uint _bold, uint _ETH) internal {
        _contractsCache.boldToken.burn(gasPoolAddress, _bold);
        // Update Active Pool Bold, and send ETH to account
        _contractsCache.activePool.decreaseBoldDebt(_bold);

        // send ETH from Active Pool to CollSurplus Pool
        _contractsCache.collSurplusPool.accountSurplus(_troveId, _ETH);
        _contractsCache.activePool.sendETH(address(_contractsCache.collSurplusPool), _ETH);
    }

    /* Send _boldamount Bold to the system and redeem the corresponding amount of collateral from as many Troves as are needed to fill the redemption
    * request.  Applies redistribution gains to a Trove before reducing its debt and coll.
    *
    * Note that if _amount is very large, this function can run out of gas, specially if traversed troves are small. This can be easily avoided by
    * splitting the total _amount in appropriate chunks and calling the function multiple times.
    *
    * Param `_maxIterations` can also be provided, so the loop through Troves is capped (if it’s zero, it will be ignored).This makes it easier to
    * avoid OOG for the frontend, as only knowing approximately the average cost of an iteration is enough, without needing to know the “topology”
    * of the trove list. It also avoids the need to set the cap in stone in the contract, nor doing gas calculations, as both gas price and opcode
    * costs can vary.
    *
    * All Troves that are redeemed from -- with the likely exception of the last one -- will end up with no debt left, therefore they will be closed.
    * If the last Trove does have some remaining debt, it has a finite ICR, and the reinsertion could be anywhere in the list, therefore it requires a hint.
    * A frontend should use getRedemptionHints() to calculate what the ICR of this Trove will be after redemption, and pass a hint for its position
    * in the sortedTroves list along with the ICR value that the hint was found for.
    *
    * If another transaction modifies the list between calling getRedemptionHints() and passing the hints to redeemCollateral(), it
    * is very likely that the last (partially) redeemed Trove would end up with a different ICR than what the hint is for. In this case the
    * redemption will stop after the last completely redeemed Trove and the sender will keep the remaining Bold amount, which they can attempt
    * to redeem later.
    */
    function redeemCollateral(
        uint _boldamount,
        uint _maxIterations,
        uint _maxFeePercentage
    )
        external
        override
    {
        ContractsCache memory contractsCache = ContractsCache(
            activePool,
            defaultPool,
            boldToken,
            sortedTroves,
            collSurplusPool,
            gasPoolAddress
        );
        RedemptionTotals memory totals;

        _requireValidMaxFeePercentage(_maxFeePercentage);
        _requireAfterBootstrapPeriod();
        totals.price = priceFeed.fetchPrice();
        _requireTCRoverMCR(totals.price);
        _requireAmountGreaterThanZero(_boldamount);
        _requireBoldBalanceCoversRedemption(contractsCache.boldToken, msg.sender, _boldamount);

        totals.totalBoldSupplyAtStart = getEntireSystemDebt();
        // Confirm redeemer's balance is less than total Bold supply
        assert(contractsCache.boldToken.balanceOf(msg.sender) <= totals.totalBoldSupplyAtStart);

        totals.remainingBold = _boldamount;
        uint256 currentTroveId;

        currentTroveId = contractsCache.sortedTroves.getLast();

        // Loop through the Troves starting from the one with lowest collateral ratio until _amount of Bold is exchanged for collateral
        if (_maxIterations == 0) { _maxIterations = type(uint256).max; }
        while (currentTroveId != 0 && totals.remainingBold > 0 && _maxIterations > 0) {
            _maxIterations--;
            // Save the uint256 of the Trove preceding the current one, before potentially modifying the list
            uint256 nextUserToCheck = contractsCache.sortedTroves.getPrev(currentTroveId);
            // TODO: check ICR?
            //getCurrentICR(currentTroveId, _price) < MCR

            _getAndApplyRedistributionGains(contractsCache.activePool, contractsCache.defaultPool, currentTroveId);

            SingleRedemptionValues memory singleRedemption = _redeemCollateralFromTrove(
                contractsCache,
                currentTroveId,
                totals.remainingBold,
                totals.price
            );

            if (singleRedemption.cancelledPartial) break; // Partial redemption was cancelled (out-of-date hint, or new net debt < minimum), therefore we could not redeem from the last Trove

            totals.totalBoldToRedeem  = totals.totalBoldToRedeem + singleRedemption.BoldLot;
            totals.totalETHDrawn = totals.totalETHDrawn + singleRedemption.ETHLot;

            totals.remainingBold = totals.remainingBold - singleRedemption.BoldLot;
            currentTroveId = nextUserToCheck;
        }
        require(totals.totalETHDrawn > 0, "TroveManager: Unable to redeem any amount");

        // Decay the baseRate due to time passed, and then increase it according to the size of this redemption.
        // Use the saved total Bold supply value, from before it was reduced by the redemption.
        _updateBaseRateFromRedemption(totals.totalETHDrawn, totals.price, totals.totalBoldSupplyAtStart);

        // Calculate the ETH fee
        totals.ETHFee = _getRedemptionFee(totals.totalETHDrawn);

        _requireUserAcceptsFee(totals.ETHFee, totals.totalETHDrawn, _maxFeePercentage);

        // Do nothing with the fee - the funds remain in ActivePool. TODO: replace with new redemption fee scheme
        totals.ETHToSendToRedeemer = totals.totalETHDrawn - totals.ETHFee;

        emit Redemption(_boldamount, totals.totalBoldToRedeem, totals.totalETHDrawn, totals.ETHFee);

        // Burn the total Bold that is cancelled with debt, and send the redeemed ETH to msg.sender
        contractsCache.boldToken.burn(msg.sender, totals.totalBoldToRedeem);
        // Update Active Pool Bold, and send ETH to account
        contractsCache.activePool.decreaseBoldDebt(totals.totalBoldToRedeem);
        contractsCache.activePool.sendETH(msg.sender, totals.ETHToSendToRedeemer);
    }

    // --- Helper functions ---

    // Return the current collateral ratio (ICR) of a given Trove. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getCurrentICR(uint256 _troveId, uint _price) public view override returns (uint) {
        (uint currentETH, uint currentBoldDebt) = _getCurrentTroveAmounts(_troveId);

        uint ICR = LiquityMath._computeCR(currentETH, currentBoldDebt, _price);
        return ICR;
    }

    function _getCurrentTroveAmounts(uint256 _troveId) internal view returns (uint, uint) {
        uint pendingETHReward = getPendingETHReward(_troveId);
        uint pendingBoldDebtReward = getPendingBoldDebtReward(_troveId);

        uint currentETH = Troves[_troveId].coll + pendingETHReward;
        uint currentBoldDebt = Troves[_troveId].debt + pendingBoldDebtReward;

        return (currentETH, currentBoldDebt);
    }

    function getAndApplyRedistributionGains(address _troveId) external override {
        _requireCallerIsBorrowerOperations();
        return _getAndApplyRedistributionGains(activePool, defaultPool, _troveId);
    }

    // Add the borrowers's coll and debt rewards earned from redistributions, to their Trove
    function _getAndApplyRedistributionGains(IActivePool _activePool, IDefaultPool _defaultPool, address _troveId) internal {
        if (hasRedistributionGains(_troveId)) {
            _requireTroveIsActive(_troveId);

            // Compute redistribution gains
            uint pendingETHReward = getPendingETHReward(_troveId);
            uint pendingBoldDebtReward = getPendingBoldDebtReward(_troveId);

            // Apply redistribution gains to trove's state
            Troves[_troveId].coll = Troves[_troveId].coll + pendingETHReward;
            Troves[_troveId].debt = Troves[_troveId].debt + pendingBoldDebtReward;

            _updateTroveRewardSnapshots(_troveId);

            // Transfer redistribution gains from DefaultPool to ActivePool
            _movePendingTroveRewardsToActivePool(_activePool, _defaultPool, pendingBoldDebtReward, pendingETHReward);

            emit TroveUpdated(
                _troveId,
                Troves[_troveId].debt,
                Troves[_troveId].coll,
                Troves[_troveId].stake,
                TroveManagerOperation.getAndApplyRedistributionGains
            );
        }
    }

    function _updateTroveRewardSnapshots(uint256 _troveId) internal {
        rewardSnapshots[_troveId].ETH = L_ETH;
        rewardSnapshots[_troveId].boldDebt = L_boldDebt;
        emit TroveSnapshotsUpdated(L_ETH, L_boldDebt);
    }

    // Get the borrower's pending accumulated ETH reward, earned by their stake
    function getPendingETHReward(uint256 _troveId) public view override returns (uint) {
        uint snapshotETH = rewardSnapshots[_troveId].ETH;
        uint rewardPerUnitStaked = L_ETH - snapshotETH;

        if ( rewardPerUnitStaked == 0 || Troves[_troveId].status != Status.active) { return 0; }

        uint stake = Troves[_troveId].stake;

        uint pendingETHReward = stake * rewardPerUnitStaked / DECIMAL_PRECISION;

        return pendingETHReward;
    }

    // Get the borrower's pending accumulated Bold reward, earned by their stake
    function getPendingBoldDebtReward(uint256 _troveId) public view override returns (uint) {
        uint snapshotBoldDebt = rewardSnapshots[_troveId].boldDebt;
        uint rewardPerUnitStaked = L_boldDebt - snapshotBoldDebt;

        if ( rewardPerUnitStaked == 0 || Troves[_troveId].status != Status.active) { return 0; }

        uint stake =  Troves[_troveId].stake;

        uint pendingBoldDebtReward = stake * rewardPerUnitStaked / DECIMAL_PRECISION;

        return pendingBoldDebtReward;
    }

    function hasRedistributionGains(address _troveId) public view override returns (bool) {
        /*
        * A Trove has redistribution gains if its snapshot is less than the current rewards per-unit-staked sum:
        * this indicates that rewards have occured since the snapshot was made, and the user therefore has
        * redistribution gains
        */
        if (Troves[_troveId].status != Status.active) {return false;}

        return (rewardSnapshots[_troveId].ETH < L_ETH);
    }

    // Return the Troves entire debt and coll, including redistribution gains from redistributions.
    function getEntireDebtAndColl(
        uint256 _troveId
    )
        public
        view
        override
        returns (uint debt, uint coll, uint pendingBoldDebtReward, uint pendingETHReward, uint pendingBoldInterest)
    {
        debt = Troves[_troveId].debt;
        coll = Troves[_troveId].coll;

        pendingBoldDebtReward = getPendingBoldDebtReward(_troveId);
        pendingBoldInterest = _calcPendingTroveInterest(_troveId);
        pendingETHReward = getPendingETHReward(_troveId);

        debt = debt + pendingBoldDebtReward + pendingBoldInterest;
        coll = coll + pendingETHReward;
    }

    function removeStake(uint256 _troveId) external override {
        _requireCallerIsBorrowerOperations();
        return _removeStake(_troveId);
    }

    // Remove borrower's stake from the totalStakes sum, and set their stake to 0
    function _removeStake(uint256 _troveId) internal {
        uint stake = Troves[_troveId].stake;
        totalStakes = totalStakes - stake;
        Troves[_troveId].stake = 0;
    }

    function updateStakeAndTotalStakes(uint256 _troveId) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        return _updateStakeAndTotalStakes(_troveId);
    }

    // Update borrower's stake based on their latest collateral value
    function _updateStakeAndTotalStakes(uint256 _troveId) internal returns (uint) {
        uint newStake = _computeNewStake(Troves[_troveId].coll);
        uint oldStake = Troves[_troveId].stake;
        Troves[_troveId].stake = newStake;

        totalStakes = totalStakes - oldStake + newStake;
        emit TotalStakesUpdated(totalStakes);

        return newStake;
    }

    // Calculate a new stake based on the snapshots of the totalStakes and totalCollateral taken at the last liquidation
    function _computeNewStake(uint _coll) internal view returns (uint) {
        uint stake;
        if (totalCollateralSnapshot == 0) {
            stake = _coll;
        } else {
            /*
            * The following assert() holds true because:
            * - The system always contains >= 1 trove
            * - When we close or liquidate a trove, we redistribute the redistribution gains, so if all troves were closed/liquidated,
            * rewards would’ve been emptied and totalCollateralSnapshot would be zero too.
            */
            assert(totalStakesSnapshot > 0);
            stake = _coll * totalStakesSnapshot / totalCollateralSnapshot;
        }
        return stake;
    }

    function _redistributeDebtAndColl(IActivePool _activePool, IDefaultPool _defaultPool, uint _debt, uint _coll) internal {
        if (_debt == 0) { return; }

        /*
        * Add distributed coll and debt rewards-per-unit-staked to the running totals. Division uses a "feedback"
        * error correction, to keep the cumulative error low in the running totals L_ETH and L_boldDebt:
        *
        * 1) Form numerators which compensate for the floor division errors that occurred the last time this
        * function was called.
        * 2) Calculate "per-unit-staked" ratios.
        * 3) Multiply each ratio back by its denominator, to reveal the current floor division error.
        * 4) Store these errors for use in the next correction when this function is called.
        * 5) Note: static analysis tools complain about this "division before multiplication", however, it is intended.
        */
        uint ETHNumerator = _coll * DECIMAL_PRECISION + lastETHError_Redistribution;
        uint boldDebtNumerator = _debt * DECIMAL_PRECISION + lastBoldDebtError_Redistribution;

        // Get the per-unit-staked terms
        uint ETHRewardPerUnitStaked = ETHNumerator / totalStakes;
        uint boldDebtRewardPerUnitStaked = boldDebtNumerator / totalStakes;

        lastETHError_Redistribution = ETHNumerator - ETHRewardPerUnitStaked * totalStakes;
        lastBoldDebtError_Redistribution = boldDebtNumerator - boldDebtRewardPerUnitStaked * totalStakes;

        // Add per-unit-staked terms to the running totals
        L_ETH = L_ETH + ETHRewardPerUnitStaked;
        L_boldDebt = L_boldDebt + boldDebtRewardPerUnitStaked;

        emit LTermsUpdated(L_ETH, L_boldDebt);

        // Transfer coll and debt from ActivePool to DefaultPool
        _activePool.decreaseBoldDebt(_debt);
        _defaultPool.increaseBoldDebt(_debt);
        _activePool.sendETHToDefaultPool(_coll);
    }

    function closeTrove(uint256 _troveId) external override {
        _requireCallerIsBorrowerOperations();
        return _closeTrove(_troveId, Status.closedByOwner);
    }

    function _closeTrove(uint256 _troveId, Status closedStatus) internal {
        assert(closedStatus != Status.nonExistent && closedStatus != Status.active);

        uint TroveIdsArrayLength = TroveIds.length;
        _requireMoreThanOneTroveInSystem(TroveIdsArrayLength);

        Troves[_troveId].status = closedStatus;
        Troves[_troveId].coll = 0;
        Troves[_troveId].debt = 0;
        Troves[_troveId].annualInterestRate = 0;

        rewardSnapshots[_troveId].ETH = 0;
        rewardSnapshots[_troveId].boldDebt = 0;

        _removeTroveId(_troveId, TroveIdsArrayLength);
        sortedTroves.remove(_troveId);

        // burn ERC721
        // TODO: Should we do it?
        _burn(_troveId);
    }

    /*
    * Updates snapshots of system total stakes and total collateral, excluding a given collateral remainder from the calculation.
    * Used in a liquidation sequence.
    *
    * The calculation excludes a portion of collateral that is in the ActivePool:
    *
    * the total ETH gas compensation from the liquidation sequence
    *
    * The ETH as compensation must be excluded as it is always sent out at the very end of the liquidation sequence.
    */
    function _updateSystemSnapshots_excludeCollRemainder(IActivePool _activePool, uint _collRemainder) internal {
        totalStakesSnapshot = totalStakes;

        uint activeColl = _activePool.getETHBalance();
        uint liquidatedColl = defaultPool.getETHBalance();
        totalCollateralSnapshot = activeColl - _collRemainder + liquidatedColl;

        emit SystemSnapshotsUpdated(totalStakesSnapshot, totalCollateralSnapshot);
    }

    // Push the trove's id to the Trove list, and record the corresponding array index on the Trove struct
    function addTroveIdToArray(uint256 _troveId) external override returns (uint) {
        _requireCallerIsBorrowerOperations();

        /* Max array size is 2**128 - 1, i.e. ~3e30 troves. No risk of overflow, since troves have minimum Bold
        debt of liquidation reserve plus MIN_NET_DEBT. 3e30 Bold dwarfs the value of all wealth in the world ( which is < 1e15 USD). */

        // Push the Troveowner to the array
        TroveIds.push(_troveId);

        // Record the index of the new Troveowner on their Trove struct
        uint128 index = uint128(TroveIds.length - 1);
        Troves[_troveId].arrayIndex = index;

        return index;
    }

    /*
    * Remove a Trove owner from the TroveIds array, not preserving array order. Removing owner 'B' does the following:
    * [A B C D E] => [A E C D], and updates E's Trove struct to point to its new array index.
    */
    function _removeTroveId(uint256 _troveId, uint TroveIdsArrayLength) internal {
        Status troveStatus = Troves[_troveId].status;
        // It’s set in caller function `_closeTrove`
        assert(troveStatus != Status.nonExistent && troveStatus != Status.active);

        uint128 index = Troves[_troveId].arrayIndex;
        uint length = TroveIdsArrayLength;
        uint idxLast = length - 1;

        assert(index <= idxLast);

        uint256 idToMove = TroveIds[idxLast];

        TroveIds[index] = idToMove;
        Troves[idToMove].arrayIndex = index;
        emit TroveIndexUpdated(idToMove, index);

        TroveIds.pop();
    }

    // --- Recovery Mode and TCR functions ---

    function getTCR(uint _price) external view override returns (uint) {
        return _getTCR(_price);
    }

    function checkRecoveryMode(uint _price) external view override returns (bool) {
        return _checkRecoveryMode(_price);
    }

    // Check whether or not the system *would be* in Recovery Mode, given an ETH:USD price, and the entire system coll and debt.
    function _checkPotentialRecoveryMode(
        uint _entireSystemColl,
        uint _entireSystemDebt,
        uint _price
    )
        internal
        pure
    returns (bool)
    {
        uint TCR = LiquityMath._computeCR(_entireSystemColl, _entireSystemDebt, _price);

        return TCR < CCR;
    }

    // --- Redemption fee functions ---

    /*
    * This function has two impacts on the baseRate state variable:
    * 1) decays the baseRate based on time passed since last redemption or Bold borrowing operation.
    * then,
    * 2) increases the baseRate based on the amount redeemed, as a proportion of total supply
    */
    function _updateBaseRateFromRedemption(uint _ETHDrawn,  uint _price, uint _totalBoldSupply) internal returns (uint) {
        uint decayedBaseRate = _calcDecayedBaseRate();

        /* Convert the drawn ETH back to Bold at face value rate (1 Bold:1 USD), in order to get
        * the fraction of total supply that was redeemed at face value. */
        uint redeemedBoldFraction = _ETHDrawn * _price / _totalBoldSupply;

        uint newBaseRate = decayedBaseRate + redeemedBoldFraction / BETA;
        newBaseRate = LiquityMath._min(newBaseRate, DECIMAL_PRECISION); // cap baseRate at a maximum of 100%
        //assert(newBaseRate <= DECIMAL_PRECISION); // This is already enforced in the line above
        assert(newBaseRate > 0); // Base rate is always non-zero after redemption

        // Update the baseRate state variable
        baseRate = newBaseRate;
        emit BaseRateUpdated(newBaseRate);

        _updateLastFeeOpTime();

        return newBaseRate;
    }

    function getRedemptionRate() public view override returns (uint) {
        return _calcRedemptionRate(baseRate);
    }

    function getRedemptionRateWithDecay() public view override returns (uint) {
        return 0;
        // return _calcRedemptionRate(_calcDecayedBaseRate());
    }

    function _calcRedemptionRate(uint /* _baseRate */) internal pure returns (uint) {
        return 0;
        // return LiquityMath._min(
        //     REDEMPTION_FEE_FLOOR + _baseRate,
        //     DECIMAL_PRECISION // cap at a maximum of 100%
        // );
    }

    function _getRedemptionFee(uint _ETHDrawn) internal view returns (uint) {
        return _calcRedemptionFee(getRedemptionRate(), _ETHDrawn);
    }

    function getRedemptionFeeWithDecay(uint _ETHDrawn) external view override returns (uint) {
        return _calcRedemptionFee(getRedemptionRateWithDecay(), _ETHDrawn);
    }

    function _calcRedemptionFee(uint /* _redemptionRate */, uint /* _ETHDrawn */) internal pure returns (uint) {
        return 0;
        // uint redemptionFee = _redemptionRate * _ETHDrawn / DECIMAL_PRECISION;
        // require(redemptionFee < _ETHDrawn, "TroveManager: Fee would eat up all returned collateral");
        // return redemptionFee;
    }

    // --- Internal fee functions ---

    // Update the last fee operation time only if time passed >= decay interval. This prevents base rate griefing.
    function _updateLastFeeOpTime() internal {
        uint timePassed = block.timestamp - lastFeeOperationTime;

        if (timePassed >= SECONDS_IN_ONE_MINUTE) {
            lastFeeOperationTime = block.timestamp;
            emit LastFeeOpTimeUpdated(block.timestamp);
        }
    }

    function _calcDecayedBaseRate() internal view returns (uint) {
        uint minutesPassed = _minutesPassedSinceLastFeeOp();
        uint decayFactor = LiquityMath._decPow(MINUTE_DECAY_FACTOR, minutesPassed);

        return baseRate * decayFactor / DECIMAL_PRECISION;
    }

    function _minutesPassedSinceLastFeeOp() internal view returns (uint) {
        return (block.timestamp - lastFeeOperationTime) / SECONDS_IN_ONE_MINUTE;
    }

    function checkTroveIsActive(uint256 _troveId) public view returns (bool) {
        return Troves[_troveId].status == Status.active;
    }

    // --- Interest rate calculations ---

    // TODO: analyze precision loss in interest functions and decide upon the minimum granularity
    // (per-second, per-block, etc)
    function _calcPendingTroveInterest(address _borrower) internal view returns (uint256) {
        uint256 recordedDebt = Troves[_borrower].debt;
        // convert annual interest to per-second and multiply by the principal
        uint256 annualInterestRate = Troves[_borrower].annualInterestRate;
        uint256 lastDebtUpdateTime = Troves[_borrower].lastDebtUpdateTime;

        return recordedDebt * annualInterestRate * (block.timestamp - lastDebtUpdateTime) / SECONDS_IN_ONE_YEAR;
    }

    function calcPendingAggInterest() public view returns (uint256) {
        return aggWeightedDebtSum * (block.timestamp - lastAggUpdateTime) / SECONDS_IN_ONE_YEAR / 1e18;
    }

    // --- Aggregate interest operations ---

    // This function is called inside all state-changing user ops: borrower ops, liquidations, redemptions and SP deposits/withdrawals. 
    // Some user ops trigger debt changes to Trove(s), in which case _troveDebtChange will be non-zero.
    // The _troveDebtChange is the sum of: 
    // - Any composite debt change to a Trove from a borrower op
    // - Any debt increase due to a Trove's redistribution gaisn being applied.
    // It does NOT include the Trove's pending individual interest. This is because aggregate interest and individual interest are tracked 
    // separately, in parallel.  
    //That is, the aggregate recorded debt is incremented by the aggregate pending interest.

        function mintAggInterest(int256 _troveDebtChange) public {
        _requireCallerIsBOorSP();
        uint256 aggInterest = calcPendingAggInterest();
        // Mint the new BOLD interest to a mock interest router that would split it and send it onward to SP, LP staking, etc.
        // TODO: implement interest routing and SP Bold reward tracking
        if (aggInterest > 0) {boldToken.mint(address(interestRouter), aggInterest);}

        // TODO: cleaner way to deal with debt changes that can be positive or negative?
        aggRecordedDebt = addUint256ToInt256(aggRecordedDebt + aggInterest, _troveDebtChange);
        // assert(aggRecordedDebt > 0) // This should never be negative. If all principal debt were repaid, it should be 0, and if all
        lastAggUpdateTime = block.timestamp;
    }

    function addUint256ToInt256(uint256 _x, int256 _y) internal returns (uint256) {
        // Assumption: _x + _y > 0. Will revert otherwise.
        if (_y >= 0) {
            return _x + uint256(_y);
        } else {
            return (_x - uint256(-_y));
        }
    }

    // TODO: make this purely for existing Trove touches which alter coll or debt. // TODO: How about redemptions and liqs?
    // function _applyInterestAndRedistributionGains(
    //     address _borrower,
    //     uint256 _debtChange,
    //     uint256 _mintedAggInterest,
    //     uint256, _pendingTroveInterest,
    //     uint256 _annualInterestRate,
    //     uint256 _pendingCollGain,
    //     uint256 _pendingDebtGain
    // )
    //     internal
    // {
    //     uint256 oldRecordedDebt = Troves[_borrower].debt;

    //     // uint256 pendingTroveInterest = _calcPendingTroveInterest(oldRecordedDebt, annualInterestRate, Troves[_borrower].lastDebtUpdateTime);

    //     // Apply all changes to the Trove's state
    //     Troves[_borrower].coll = Troves[_borrower].coll + _pendingCollGain;
    //     uint256 newRecordedDebt = oldRecordedDebt + pendingTroveInterest + debtChange + _pendingDebtGain;
    //     Troves[borrower].debt = newRecordedDebt;

    //     _updateTroveRewardSnapshots(_borrower);

    //     // Record the Trove’s latest individual update time
    //     Troves[borrower].lastDebtUpdateTime = block.timestamp;

    //     // Update aggregate recorded debt
    //     aggRecordedDebt += debtChange + _pendingDebtGain  + _mintedAggInterest; // we don't add the Trove's fresh interest here, since this aggregate recorded debt gets updated with minted interest separately.
    //     assert(lastAggUpdateTime == block.timestamp); // Confirm there's no aggregate pending interest

    //     // Update aggregate weighted debt sum
    //     uint256 annualInterestRate = Troves[borrower].annualInterestRate;
    //     uint256 oldWeightedRecordedDebt = oldTroveRecordedDebt * annualInterestRate;
    //     uint256 newWeightedRecordedDebt = newRecordedDebt * annualInterestRate;
    //     aggWeightedDebtSum = aggWeightedDebtSum - oldWeightedRecordedDebt + newWeightedRecordedDebt;

    //     // Transfer redistribution gains from DefaultPool to ActivePool
    //     _movePendingTroveRewardsToActivePool(_activePool, _defaultPool, _pendingDebtGain, _pendingCollGain);

    //     emit TroveUpdated(
    //         _borrower,
    //         Troves[_borrower].debt,
    //         Troves[_borrower].coll,
    //         Troves[_borrower].stake,
    //         Troves[_borrower].lastDebtUpdateTime
    //         TroveManagerOperation.getAndApplyRedistributionGains
    //     );
    // }

    // function updateAggAndTroveRecordedDebt
    // // TODO: bake in getAndApplyRedistributionGains in gas-efficient way

    // --- 'require' wrapper functions ---

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "TroveManager: Caller is not the BorrowerOperations contract");
    }

    function _requireCallerIsBOorSP() internal view {
        require(msg.sender == borrowerOperationsAddress || msg.sender == address(stabilityPool),
            "TroveManager: Caller is not the BO or SP");
    }

    function _requireIsOwnerOrAddManager(uint256 _troveId, address _sender) internal view {
        assert(_sender != address(0)); // TODO: remove
        require(
            _sender == ownerOf(_troveId) || _sender == TroveAddManagers[_troveId],
            "TroveManager: sender is not trove owner nor manager");
    }

    function _requireIsOwnerOrRemoveManager(uint256 _troveId, address _sender) internal view {
        assert(_sender != address(0)); // TODO: remove
        require(
            _sender == ownerOf(_troveId) || _sender == TroveRemoveManagers[_troveId],
            "TroveManager: sender is not trove owner nor manager");
    }

    function _requireTroveIsActive(uint256 _troveId) internal view {
        require(checkTroveIsActive(_troveId), "TroveManager: Trove does not exist or is closed");
    }

    function _requireBoldBalanceCoversRedemption(IBoldToken _boldToken, address _redeemer, uint _amount) internal view {
        require(_boldToken.balanceOf(_redeemer) >= _amount, "TroveManager: Requested redemption amount must be <= user's Bold token balance");
    }

    function _requireMoreThanOneTroveInSystem(uint TroveIdsArrayLength) internal view {
        require (TroveIdsArrayLength > 1 && sortedTroves.getSize() > 1, "TroveManager: Only one trove in the system");
    }

    function _requireAmountGreaterThanZero(uint _amount) internal pure {
        require(_amount > 0, "TroveManager: Amount must be greater than zero");
    }

    function _requireTCRoverMCR(uint _price) internal view {
        require(_getTCR(_price) >= MCR, "TroveManager: Cannot redeem when TCR < MCR");
    }

    function _requireAfterBootstrapPeriod() internal view {
        uint systemDeploymentTime = boldToken.deploymentStartTime();
        require(block.timestamp >= systemDeploymentTime + BOOTSTRAP_PERIOD, "TroveManager: Redemptions are not allowed during bootstrap phase");
    }

    function _requireValidMaxFeePercentage(uint _maxFeePercentage) internal pure {
        require(_maxFeePercentage >= REDEMPTION_FEE_FLOOR && _maxFeePercentage <= DECIMAL_PRECISION,
            "Max fee percentage must be between 0.5% and 100%");
    }

    // --- Trove property getters ---

    function getTroveStatus(uint256 _troveId) external view override returns (uint) {
        return uint(Troves[_troveId].status);
    }

    function getTroveStake(uint256 _troveId) external view override returns (uint) {
        return Troves[_troveId].stake;
    }

    function getTroveDebt(uint256 _troveId) external view override returns (uint) {
        return Troves[_troveId].debt;
    }

    function getTroveColl(uint256 _troveId) external view override returns (uint) {
        return Troves[_troveId].coll;
    }

    function getTroveAnnualInterestRate(uint256 _troveId) external view returns (uint) {
        return Troves[_troveId].annualInterestRate;
    }

    function getTroveLastDebtUpdateTime(address _borrower) external view returns (uint) {
        return Troves[_borrower].lastDebtUpdateTime;
    }

    // --- Trove property setters, called by BorrowerOperations ---

    function setTrovePropertiesOnOpen(
        address _owner,
        uint256 _troveId,
        uint256 _coll,
        uint256 _debt,
        uint256 _annualInterestRate
    )
        external
        returns (uint256)
    {
        _requireCallerIsBorrowerOperations();
        // TODO: optimize gas for writing to this struct
        Troves[_troveId].status = Status.active;
        Troves[_troveId].coll = _coll;
        Troves[_troveId].debt = _debt;
        Troves[_troveId].annualInterestRate = _annualInterestRate;
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);

        _updateTroveRewardSnapshots(_troveId);

        // Update weighted debt sum with the Trove's interest-weighted debt
        aggWeightedDebtSum += _debt * _annualInterestRate;

        // Record the Trove's stake (for redistributions) and update the total stakes
        return _updateStakeAndTotalStakes(_troveId);
    }

    function increaseTroveColl(address _sender, uint256 _troveId, uint _collIncrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        _requireIsOwnerOrAddManager(_troveId, _sender);

        uint newColl = Troves[_troveId].coll + _collIncrease;
        Troves[_troveId].coll = newColl;
        return newColl;
    }

    function decreaseTroveColl(address _sender, uint256 _troveId, uint _collDecrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        _requireIsOwnerOrRemoveManager(_troveId, _sender);

        uint newColl = Troves[_troveId].coll - _collDecrease;
        Troves[_troveId].coll = newColl;
        return newColl;
    }

    function increaseTroveDebt(address _sender, uint256 _troveId, uint _debtIncrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        _requireIsOwnerOrRemoveManager(_troveId, _sender);

        uint newDebt = Troves[_troveId].debt + _debtIncrease;
        Troves[_troveId].debt = newDebt;
        return newDebt;
    }

    function decreaseTroveDebt(address _sender, uint256 _troveId, uint _debtDecrease) external override returns (uint) {
        _requireCallerIsBorrowerOperations();
        _requireIsOwnerOrAddManager(_troveId, _sender);

        uint newDebt = Troves[_troveId].debt - _debtDecrease;
        Troves[_troveId].debt = newDebt;
        return newDebt;
    }

    function changeAnnualInterestRate(uint256 _troveId, uint256 _newAnnualInterestRate) external {
        _requireCallerIsBorrowerOperations();
        Troves[_troveId].annualInterestRate = _newAnnualInterestRate;
    }

    function setAddManager(address _sender, uint256 _troveId, address _manager) external {
        _requireCallerIsBorrowerOperations();
        require(_sender == ownerOf(_troveId), "TroveManager: sender is not trove owner");

        TroveAddManagers[_troveId] = _manager;
    }

    function setRemoveManager(address _sender, uint256 _troveId, address _manager) external {
        _requireCallerIsBorrowerOperations();
        require(_sender == ownerOf(_troveId), "TroveManager: sender is not trove owner");

        TroveRemoveManagers[_troveId] = _manager;
    }
}
