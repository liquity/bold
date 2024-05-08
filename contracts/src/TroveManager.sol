// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/IBoldToken.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";

// import "forge-std/console2.sol";

contract TroveManager is ERC721, LiquityBase, Ownable, ITroveManager {
    string public constant NAME = "TroveManager"; // TODO
    string public constant SYMBOL = "Lv2T"; // TODO

    // --- Connected contract declarations ---

    address public borrowerOperationsAddress;
    IStabilityPool public override stabilityPool;
    address gasPoolAddress;
    ICollSurplusPool collSurplusPool;
    IBoldToken public override boldToken;
    // A doubly linked list of Troves, sorted by their sorted by their collateral ratios
    ISortedTroves public sortedTroves;
    address public collateralRegistryAddress;

    // --- Data structures ---

    enum Status {
        nonExistent,
        active,
        closedByOwner,
        closedByLiquidation,
        closedByRedemption,
        unredeemable
    }

    // Store the necessary data for a trove
    struct Trove {
        uint256 debt;
        uint256 coll;
        uint256 stake;
        Status status;
        uint128 arrayIndex;
        uint64 lastDebtUpdateTime;
        uint256 annualInterestRate;
        uint256 upfrontInterest;
    }
    // TODO: optimize this struct packing for gas reduction, which may break v1 tests that assume a certain order of properties

    mapping(uint256 => Trove) public Troves;
    /*
     * Mapping from TroveId to granted address for operations that “give” money to the trove (add collateral, pay debt).
     * Useful for instance for cold/hot wallet setups.
     * If its value is zero address, any address is allowed to do those operations on behalf of trove owner.
     * Otherwise, only the address in this mapping (and the trove owner) will be allowed.
     * To restrict this permission to no one, trove owner should be set in this mapping.
     */
    mapping(uint256 => address) public TroveAddManagers;
    /*
     * Mapping from TroveId to granted address for operations that “withdraw” money from the trove (withdraw collateral, borrow).
     * Useful for instance for cold/hot wallet setups.
     * If its value is zero address, only owner is allowed to do those operations.
     * Otherwise, only the address in this mapping (and the trove owner) will be allowed.
     * Therefore, by default this permission is restricted to no one.
     * Trove owner be set in this mapping is equivalent to zero address.
     */
    mapping(uint256 => address) public TroveRemoveManagers;

    uint256 public totalStakes;

    // Snapshot of the value of totalStakes, taken immediately after the latest liquidation
    uint256 public totalStakesSnapshot;

    // Snapshot of the total collateral across the ActivePool and DefaultPool, immediately after the latest liquidation.
    uint256 public totalCollateralSnapshot;

    /*
    * L_ETH and L_boldDebt track the sums of accumulated liquidation rewards per unit staked. During its lifetime, each stake earns:
    *
    * An ETH gain of ( stake * [L_ETH - L_ETH(0)] )
    * A boldDebt increase  of ( stake * [L_boldDebt - L_boldDebt(0)] )
    *
    * Where L_ETH(0) and L_boldDebt(0) are snapshots of L_ETH and L_boldDebt for the active Trove taken at the instant the stake was made
    */
    uint256 public L_ETH;
    uint256 public L_boldDebt;

    // Map addresses with active troves to their RewardSnapshot
    mapping(uint256 => RewardSnapshot) public rewardSnapshots;

    // Object containing the ETH and Bold snapshots for a given active trove
    struct RewardSnapshot {
        uint256 ETH;
        uint256 boldDebt;
    }

    // Array of all active trove addresses - used to to compute an approximate hint off-chain, for the sorted list insertion
    uint256[] public TroveIds;

    // Error trackers for the trove redistribution calculation
    uint256 public lastETHError_Redistribution;
    uint256 public lastBoldDebtError_Redistribution;

    /*
    * --- Variable container structs for liquidations ---
    *
    * These structs are used to hold, return and assign variables inside the liquidation functions,
    * in order to avoid the error: "CompilerError: Stack too deep".
    **/

    struct LocalVariables_OuterLiquidationFunction {
        uint256 price;
        uint256 boldInStabPool;
        bool recoveryModeAtStart;
        uint256 liquidatedDebt;
        uint256 liquidatedColl;
    }

    struct LocalVariables_InnerSingleLiquidateFunction {
        uint256 collToLiquidate;
        uint256 pendingDebtReward;
        uint256 pendingCollReward;
    }

    struct LocalVariables_LiquidationSequence {
        uint256 remainingBoldInStabPool;
        uint256 i;
        uint256 ICR;
        uint256 troveId;
        bool backToNormalMode;
        uint256 entireSystemDebt;
        uint256 entireSystemColl;
    }

    struct LiquidationValues {
        uint256 entireDebt;
        uint256 entireColl;
        uint256 collGasCompensation;
        uint256 BoldGasCompensation;
        uint256 debtToOffset;
        uint256 collToSendToSP;
        uint256 debtToRedistribute;
        uint256 collToRedistribute;
        uint256 collSurplus;
        uint256 accruedInterest;
        uint256 forgoneUpfrontInterest;
        uint256 weightedRecordedDebt;
        uint256 recordedDebt;
        uint256 pendingDebtReward;
    }

    struct LiquidationTotals {
        uint256 totalCollInSequence;
        uint256 totalDebtInSequence;
        uint256 totalRecordedDebtInSequence;
        uint256 totalWeightedRecordedDebtInSequence;
        uint256 totalAccruedInterestInSequence;
        uint256 totalForgoneUpfrontInterestInSequence;
        uint256 totalCollGasCompensation;
        uint256 totalBoldGasCompensation;
        uint256 totalDebtToOffset;
        uint256 totalCollToSendToSP;
        uint256 totalDebtToRedistribute;
        uint256 totalCollToRedistribute;
        uint256 totalCollSurplus;
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
        uint256 remainingBold;
        uint256 totalBoldToRedeem;
        uint256 totalETHDrawn;
        uint256 ETHFee;
        uint256 ETHToSendToRedeemer;
        uint256 price;
        uint256 totalRedistDebtGains;
        uint256 totalNewWeightedRecordedDebt;
        uint256 totalOldWeightedRecordedDebt;
        uint256 totalForgoneUpfrontInterest;
    }

    struct SingleRedemptionValues {
        uint256 BoldLot;
        uint256 ETHLot;
        uint256 redistDebtGain;
        uint256 newRecordedDebt;
        uint256 oldWeightedRecordedDebt;
        uint256 newWeightedRecordedDebt;
        uint256 forgoneUpfrontInterest;
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
    event CollateralRegistryAddressChanged(address _collateralRegistryAddress);

    event Liquidation(
        uint256 _liquidatedDebt, uint256 _liquidatedColl, uint256 _collGasCompensation, uint256 _boldGasCompensation
    );
    event Redemption(uint256 _attemptedBoldAmount, uint256 _actualBoldAmount, uint256 _ETHSent, uint256 _ETHFee);
    event TroveUpdated(uint256 indexed _troveId, uint256 _debt, uint256 _coll, Operation _operation);
    event TroveLiquidated(uint256 indexed _troveId, uint256 _debt, uint256 _coll, Operation _operation);
    event TotalStakesUpdated(uint256 _newTotalStakes);
    event SystemSnapshotsUpdated(uint256 _totalStakesSnapshot, uint256 _totalCollateralSnapshot);
    event LTermsUpdated(uint256 _L_ETH, uint256 _L_boldDebt);
    event TroveSnapshotsUpdated(uint256 _L_ETH, uint256 _L_boldDebt);
    event TroveIndexUpdated(uint256 _troveId, uint256 _newIndex);

    enum Operation {
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
        address _sortedTrovesAddress
    ) external override onlyOwner {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        activePool = IActivePool(_activePoolAddress);
        defaultPool = IDefaultPool(_defaultPoolAddress);
        stabilityPool = IStabilityPool(_stabilityPoolAddress);
        gasPoolAddress = _gasPoolAddress;
        collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
        priceFeed = IPriceFeed(_priceFeedAddress);
        boldToken = IBoldToken(_boldTokenAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);
        emit DefaultPoolAddressChanged(_defaultPoolAddress);
        emit StabilityPoolAddressChanged(_stabilityPoolAddress);
        emit GasPoolAddressChanged(_gasPoolAddress);
        emit CollSurplusPoolAddressChanged(_collSurplusPoolAddress);
        emit PriceFeedAddressChanged(_priceFeedAddress);
        emit BoldTokenAddressChanged(_boldTokenAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
    }

    function setCollateralRegistry(address _collateralRegistryAddress) external override onlyOwner {
        collateralRegistryAddress = _collateralRegistryAddress;
        emit CollateralRegistryAddressChanged(_collateralRegistryAddress);

        _renounceOwnership();
    }

    // --- Getters ---

    function getTroveIdsCount() external view override returns (uint256) {
        return TroveIds.length;
    }

    function getTroveFromTroveIdsArray(uint256 _index) external view override returns (uint256) {
        return TroveIds[_index];
    }

    // --- Trove Liquidation functions ---

    // Single liquidation function. Closes the trove if its ICR is lower than the minimum collateral ratio.
    function liquidate(uint256 _troveId) external override {
        _requireTroveIsOpen(_troveId);

        uint256[] memory troves = new uint256[](1);
        troves[0] = _troveId;
        batchLiquidateTroves(troves);
    }

    // --- Inner single liquidation functions ---

    // Liquidate one trove, in Normal Mode.
    function _liquidateNormalMode(
        IDefaultPool _defaultPool,
        uint256 _troveId,
        uint256 _boldInStabPool,
        LiquidationValues memory singleLiquidation
    ) internal {
        LocalVariables_InnerSingleLiquidateFunction memory vars;
        LatestTroveData memory data;
        _getLatestTroveData(_troveId, data);

        singleLiquidation.entireDebt = data.entireDebt;
        singleLiquidation.entireColl = data.entireColl;
        singleLiquidation.pendingDebtReward = data.redistBoldDebtGain;
        vars.pendingCollReward = data.redistETHGain;
        singleLiquidation.recordedDebt = data.recordedDebt;
        singleLiquidation.accruedInterest = data.accruedInterest;
        singleLiquidation.weightedRecordedDebt = data.weightedRecordedDebt;
        singleLiquidation.forgoneUpfrontInterest = data.unusedUpfrontInterest;

        _movePendingTroveRewardsToActivePool(_defaultPool, singleLiquidation.pendingDebtReward, vars.pendingCollReward);
        _removeStake(_troveId);

        singleLiquidation.collGasCompensation = _getCollGasCompensation(singleLiquidation.entireColl);
        singleLiquidation.BoldGasCompensation = BOLD_GAS_COMPENSATION;
        uint256 collToLiquidate = singleLiquidation.entireColl - singleLiquidation.collGasCompensation;

        (
            singleLiquidation.debtToOffset,
            singleLiquidation.collToSendToSP,
            singleLiquidation.debtToRedistribute,
            singleLiquidation.collToRedistribute
        ) = _getOffsetAndRedistributionVals(singleLiquidation.entireDebt, collToLiquidate, _boldInStabPool);

        _closeTrove(_troveId, Status.closedByLiquidation);
        emit TroveLiquidated(
            _troveId, singleLiquidation.entireDebt, singleLiquidation.entireColl, Operation.liquidateInNormalMode
        );
        emit TroveUpdated(_troveId, 0, 0, Operation.liquidateInNormalMode);
    }

    // Liquidate one trove, in Recovery Mode.
    function _liquidateRecoveryMode(
        IDefaultPool _defaultPool,
        uint256 _troveId,
        uint256 _ICR,
        uint256 _boldInStabPool,
        uint256 _TCR,
        uint256 _price,
        LiquidationValues memory singleLiquidation
    ) internal {
        LocalVariables_InnerSingleLiquidateFunction memory vars;
        if (TroveIds.length <= 1) return; // don't liquidate if last trove

        LatestTroveData memory data;
        _getLatestTroveData(_troveId, data);

        singleLiquidation.entireDebt = data.entireDebt;
        singleLiquidation.entireColl = data.entireColl;
        singleLiquidation.pendingDebtReward = data.redistBoldDebtGain;
        vars.pendingCollReward = data.redistETHGain;
        singleLiquidation.recordedDebt = data.recordedDebt;
        singleLiquidation.accruedInterest = data.accruedInterest;
        singleLiquidation.weightedRecordedDebt = data.weightedRecordedDebt;
        singleLiquidation.forgoneUpfrontInterest = data.unusedUpfrontInterest;
        singleLiquidation.collGasCompensation = _getCollGasCompensation(singleLiquidation.entireColl);
        singleLiquidation.BoldGasCompensation = BOLD_GAS_COMPENSATION;
        vars.collToLiquidate = singleLiquidation.entireColl - singleLiquidation.collGasCompensation;

        // If ICR <= 100%, purely redistribute the Trove across all active Troves
        if (_ICR <= _100pct) {
            _movePendingTroveRewardsToActivePool(
                _defaultPool, singleLiquidation.pendingDebtReward, vars.pendingCollReward
            );
            _removeStake(_troveId);

            singleLiquidation.debtToOffset = 0;
            singleLiquidation.collToSendToSP = 0;
            singleLiquidation.debtToRedistribute = singleLiquidation.entireDebt;
            singleLiquidation.collToRedistribute = vars.collToLiquidate;

            _closeTrove(_troveId, Status.closedByLiquidation);
            emit TroveLiquidated(
                _troveId, singleLiquidation.entireDebt, singleLiquidation.entireColl, Operation.liquidateInRecoveryMode
            );
            emit TroveUpdated(_troveId, 0, 0, Operation.liquidateInRecoveryMode);

            // If 100% < ICR < MCR, offset as much as possible, and redistribute the remainder
        } else if ((_ICR > _100pct) && (_ICR < MCR)) {
            _movePendingTroveRewardsToActivePool(
                _defaultPool, singleLiquidation.pendingDebtReward, vars.pendingCollReward
            );
            _removeStake(_troveId);

            (
                singleLiquidation.debtToOffset,
                singleLiquidation.collToSendToSP,
                singleLiquidation.debtToRedistribute,
                singleLiquidation.collToRedistribute
            ) = _getOffsetAndRedistributionVals(singleLiquidation.entireDebt, vars.collToLiquidate, _boldInStabPool);

            _closeTrove(_troveId, Status.closedByLiquidation);
            emit TroveLiquidated(
                _troveId, singleLiquidation.entireDebt, singleLiquidation.entireColl, Operation.liquidateInRecoveryMode
            );
            emit TroveUpdated(_troveId, 0, 0, Operation.liquidateInRecoveryMode);
            /*
        * If 110% <= ICR < current TCR (accounting for the preceding liquidations in the current sequence)
        * and there is Bold in the Stability Pool, only offset, with no redistribution,
        * but at a capped rate of 1.1 and only if the whole debt can be liquidated.
        * The remainder due to the capped rate will be claimable as collateral surplus.
        */
        } else if ((_ICR >= MCR) && (_ICR < _TCR) && (singleLiquidation.entireDebt <= _boldInStabPool)) {
            _movePendingTroveRewardsToActivePool(
                _defaultPool, singleLiquidation.pendingDebtReward, vars.pendingCollReward
            );
            assert(_boldInStabPool != 0);

            _removeStake(_troveId);
            singleLiquidation = _getCappedOffsetVals(
                singleLiquidation.entireDebt,
                singleLiquidation.entireColl,
                singleLiquidation.recordedDebt,
                singleLiquidation.weightedRecordedDebt,
                _price
            );

            _closeTrove(_troveId, Status.closedByLiquidation);
            if (singleLiquidation.collSurplus > 0) {
                collSurplusPool.accountSurplus(_troveId, singleLiquidation.collSurplus);
            }

            emit TroveLiquidated(
                _troveId,
                singleLiquidation.entireDebt,
                singleLiquidation.collToSendToSP,
                Operation.liquidateInRecoveryMode
            );
            emit TroveUpdated(_troveId, 0, 0, Operation.liquidateInRecoveryMode);
        } else {
            // if (_ICR >= MCR && ( _ICR >= _TCR || singleLiquidation.entireTroveDebt > _boldInStabPool))
            return; // zero values
        }
    }

    /* In a full liquidation, returns the values for a trove's coll and debt to be offset, and coll and debt to be
    * redistributed to active troves.
    */
    function _getOffsetAndRedistributionVals(
        uint256 _entireTroveDebt,
        uint256 _collToLiquidate,
        uint256 _boldInStabPool
    )
        internal
        pure
        returns (uint256 debtToOffset, uint256 collToSendToSP, uint256 debtToRedistribute, uint256 collToRedistribute)
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
            debtToOffset = LiquityMath._min(_entireTroveDebt, _boldInStabPool);
            collToSendToSP = _collToLiquidate * debtToOffset / _entireTroveDebt;
            debtToRedistribute = _entireTroveDebt - debtToOffset;
            collToRedistribute = _collToLiquidate - collToSendToSP;
        } else {
            debtToOffset = 0;
            collToSendToSP = 0;
            debtToRedistribute = _entireTroveDebt;
            collToRedistribute = _collToLiquidate;
        }
    }

    /*
    *  Get its offset coll/debt and ETH gas comp.
    */
    function _getCappedOffsetVals(
        uint256 _entireDebt,
        uint256 _entireColl,
        uint256 _recordedDebt,
        uint256 _weightedRecordedDebt,
        uint256 _price
    ) internal pure returns (LiquidationValues memory singleLiquidation) {
        singleLiquidation.entireDebt = _entireDebt;
        singleLiquidation.entireColl = _entireColl;
        singleLiquidation.recordedDebt = _recordedDebt;
        singleLiquidation.weightedRecordedDebt = _weightedRecordedDebt;
        uint256 cappedCollPortion = _entireDebt * MCR / _price;

        singleLiquidation.collGasCompensation = _getCollGasCompensation(cappedCollPortion);
        singleLiquidation.BoldGasCompensation = BOLD_GAS_COMPENSATION;

        singleLiquidation.debtToOffset = _entireDebt;
        singleLiquidation.collToSendToSP = cappedCollPortion - singleLiquidation.collGasCompensation;
        singleLiquidation.collSurplus = _entireColl - cappedCollPortion;
        singleLiquidation.debtToRedistribute = 0;
        singleLiquidation.collToRedistribute = 0;
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
            _batchLiquidateTroves_RecoveryMode(defaultPoolCached, vars.price, vars.boldInStabPool, _troveArray, totals);
        } else {
            //  if !vars.recoveryModeAtStart
            _batchLiquidateTroves_NormalMode(defaultPoolCached, vars.price, vars.boldInStabPool, _troveArray, totals);
        }

        require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

        activePool.mintAggInterestAndAccountForTroveChange(
            0, // _troveDebtIncrease
            totals.totalRecordedDebtInSequence + totals.totalAccruedInterestInSequence, //_troveDebtDecrease
            0, // _newWeightedRecordedTroveDebt
            totals.totalWeightedRecordedDebtInSequence, // _oldWeightedRecordedTroveDebt
            totals.totalForgoneUpfrontInterestInSequence // _forgoneUpfrontInterest
        );

        // Move liquidated ETH and Bold to the appropriate pools
        stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
        _redistributeDebtAndColl(
            activePoolCached, defaultPoolCached, totals.totalDebtToRedistribute, totals.totalCollToRedistribute
        );
        if (totals.totalCollSurplus > 0) {
            activePoolCached.sendETH(address(collSurplusPool), totals.totalCollSurplus);
        }

        // Update system snapshots
        _updateSystemSnapshots_excludeCollRemainder(activePoolCached, totals.totalCollGasCompensation);

        vars.liquidatedDebt = totals.totalDebtInSequence;
        vars.liquidatedColl = totals.totalCollInSequence - totals.totalCollGasCompensation - totals.totalCollSurplus;
        emit Liquidation(
            vars.liquidatedDebt, vars.liquidatedColl, totals.totalCollGasCompensation, totals.totalBoldGasCompensation
        );

        // Send gas compensation to caller
        _sendGasCompensation(
            activePoolCached, msg.sender, totals.totalBoldGasCompensation, totals.totalCollGasCompensation
        );
    }

    function _isLiquidatableStatus(Status _status) internal pure returns (bool) {
        return _status == Status.active || _status == Status.unredeemable;
    }

    /*
    * This function is used when the batch liquidation sequence starts during Recovery Mode. However, it
    * handle the case where the system *leaves* Recovery Mode, part way through the liquidation sequence
    */
    function _batchLiquidateTroves_RecoveryMode(
        IDefaultPool _defaultPool,
        uint256 _price,
        uint256 _boldInStabPool,
        uint256[] memory _troveArray,
        LiquidationTotals memory totals
    ) internal {
        LocalVariables_LiquidationSequence memory vars;

        vars.remainingBoldInStabPool = _boldInStabPool;
        vars.backToNormalMode = false;
        vars.entireSystemDebt = getEntireSystemDebt();
        vars.entireSystemColl = getEntireSystemColl();

        for (vars.i = 0; vars.i < _troveArray.length; vars.i++) {
            vars.troveId = _troveArray[vars.i];

            // Skip non-liquidatable troves
            if (!_isLiquidatableStatus(Troves[vars.troveId].status)) continue;

            vars.ICR = getCurrentICR(vars.troveId, _price);

            if (!vars.backToNormalMode) {
                // Skip this trove if ICR is greater than MCR and Stability Pool is empty
                if (vars.ICR >= MCR && vars.remainingBoldInStabPool == 0) continue;

                uint256 TCR = LiquityMath._computeCR(vars.entireSystemColl, vars.entireSystemDebt, _price);

                LiquidationValues memory singleLiquidation;

                _liquidateRecoveryMode(
                    _defaultPool, vars.troveId, vars.ICR, vars.remainingBoldInStabPool, TCR, _price, singleLiquidation
                );

                // Update aggregate trackers
                vars.remainingBoldInStabPool -= singleLiquidation.debtToOffset;
                vars.entireSystemDebt -= singleLiquidation.debtToOffset;
                vars.entireSystemColl -= (
                    singleLiquidation.collToSendToSP + singleLiquidation.collGasCompensation
                        + singleLiquidation.collSurplus
                );

                // Add liquidation values to their respective running totals
                _addLiquidationValuesToTotals(totals, singleLiquidation);

                vars.backToNormalMode =
                    !_checkPotentialRecoveryMode(vars.entireSystemColl, vars.entireSystemDebt, _price);
            } else if (vars.backToNormalMode && vars.ICR < MCR) {
                LiquidationValues memory singleLiquidation;

                _liquidateNormalMode(_defaultPool, vars.troveId, vars.remainingBoldInStabPool, singleLiquidation);
                vars.remainingBoldInStabPool -= singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                _addLiquidationValuesToTotals(totals, singleLiquidation);
            } else {
                continue;
            } // In Normal Mode skip troves with ICR >= MCR
        }
    }

    function _batchLiquidateTroves_NormalMode(
        IDefaultPool _defaultPool,
        uint256 _price,
        uint256 _boldInStabPool,
        uint256[] memory _troveArray,
        LiquidationTotals memory totals
    ) internal {
        LocalVariables_LiquidationSequence memory vars;

        vars.remainingBoldInStabPool = _boldInStabPool;

        for (vars.i = 0; vars.i < _troveArray.length; vars.i++) {
            vars.troveId = _troveArray[vars.i];

            // Skip non-liquidatable troves
            if (!_isLiquidatableStatus(Troves[vars.troveId].status)) continue;

            vars.ICR = getCurrentICR(vars.troveId, _price);

            if (vars.ICR < MCR) {
                LiquidationValues memory singleLiquidation;

                _liquidateNormalMode(_defaultPool, vars.troveId, vars.remainingBoldInStabPool, singleLiquidation);
                vars.remainingBoldInStabPool -= singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                _addLiquidationValuesToTotals(totals, singleLiquidation);
            }
        }
    }

    // --- Liquidation helper functions ---

    // Adds all values from `singleLiquidation` to their respective totals in `totals` in-place
    function _addLiquidationValuesToTotals(LiquidationTotals memory totals, LiquidationValues memory singleLiquidation)
        internal
        pure
    {
        // Tally all the values with their respective running totals
        totals.totalCollGasCompensation += singleLiquidation.collGasCompensation;
        totals.totalBoldGasCompensation += singleLiquidation.BoldGasCompensation;
        totals.totalDebtInSequence += singleLiquidation.entireDebt;
        totals.totalCollInSequence += singleLiquidation.entireColl;
        totals.totalRecordedDebtInSequence += singleLiquidation.recordedDebt;
        totals.totalWeightedRecordedDebtInSequence += singleLiquidation.weightedRecordedDebt;
        totals.totalAccruedInterestInSequence += singleLiquidation.accruedInterest;
        totals.totalForgoneUpfrontInterestInSequence += singleLiquidation.forgoneUpfrontInterest;
        totals.totalDebtToOffset += singleLiquidation.debtToOffset;
        totals.totalCollToSendToSP += singleLiquidation.collToSendToSP;
        totals.totalDebtToRedistribute += singleLiquidation.debtToRedistribute;
        totals.totalCollToRedistribute += singleLiquidation.collToRedistribute;
        totals.totalCollSurplus += singleLiquidation.collSurplus;
    }

    function _sendGasCompensation(IActivePool _activePool, address _liquidator, uint256 _bold, uint256 _ETH) internal {
        if (_bold > 0) {
            boldToken.returnFromPool(gasPoolAddress, _liquidator, _bold);
        }

        if (_ETH > 0) {
            _activePool.sendETH(_liquidator, _ETH);
        }
    }

    // Move a Trove's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
    function _movePendingTroveRewardsToActivePool(IDefaultPool _defaultPool, uint256 _bold, uint256 _ETH) internal {
        if (_bold > 0) {
            _defaultPool.decreaseBoldDebt(_bold);
        }
        if (_ETH > 0) {
            _defaultPool.sendETHToActivePool(_ETH);
        }
    }

    // --- Redemption functions ---

    // Redeem as much collateral as possible from _borrower's Trove in exchange for Bold up to _maxBoldamount
    function _redeemCollateralFromTrove(
        ContractsCache memory _contractsCache,
        uint256 _troveId,
        uint256 _maxBoldamount,
        uint256 _price,
        SingleRedemptionValues memory singleRedemption
    ) internal {
        LatestTroveData memory data;
        _getLatestTroveData(_troveId, data);

        singleRedemption.oldWeightedRecordedDebt = data.weightedRecordedDebt;

        _applyRedistributionGains(_contractsCache.defaultPool, _troveId, data.redistBoldDebtGain, data.redistETHGain);

        // We redeem proportionally from the Trove's interest-bearing (AKA recorded) debt and unused upfront interest
        // We have to make sure there's enough interest-bearing debt left for gas compensation
        singleRedemption.newRecordedDebt = data.entireDebt - data.unusedUpfrontInterest;
        uint256 maxRedeemable = data.entireDebt - BOLD_GAS_COMPENSATION
            - BOLD_GAS_COMPENSATION * data.unusedUpfrontInterest / singleRedemption.newRecordedDebt;

        singleRedemption.BoldLot = LiquityMath._min(_maxBoldamount, maxRedeemable);
        singleRedemption.ETHLot = singleRedemption.BoldLot * DECIMAL_PRECISION / _price;

        uint256 redeemedRecordedDebt = singleRedemption.newRecordedDebt * singleRedemption.BoldLot / data.entireDebt;
        singleRedemption.forgoneUpfrontInterest = singleRedemption.BoldLot - redeemedRecordedDebt;
        singleRedemption.newRecordedDebt -= redeemedRecordedDebt;
        data.unusedUpfrontInterest -= singleRedemption.forgoneUpfrontInterest;
        singleRedemption.newWeightedRecordedDebt = singleRedemption.newRecordedDebt * data.annualInterestRate;

        assert(singleRedemption.newRecordedDebt >= BOLD_GAS_COMPENSATION);

        // Decrease the debt and collateral of the current Trove according to the Bold lot and corresponding ETH to send
        uint256 newEntireDebt = data.entireDebt - singleRedemption.BoldLot;
        uint256 newEntireColl = data.entireColl - singleRedemption.ETHLot;

        assert(newEntireDebt == singleRedemption.newRecordedDebt + data.unusedUpfrontInterest);

        if (singleRedemption.newRecordedDebt < MIN_DEBT) {
            Troves[_troveId].status = Status.unredeemable;
            sortedTroves.remove(_troveId);
            // TODO: should we also remove from the Troves array? Seems unneccessary as it's only used for off-chain hints.
            // We save borrowers gas by not removing
        }

        Troves[_troveId].coll = newEntireColl;
        Troves[_troveId].debt = singleRedemption.newRecordedDebt;
        Troves[_troveId].upfrontInterest = data.unusedUpfrontInterest;
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);

        // TODO: Gas optimize? We update totalStakes N times for a sequence of N Trovres(!).
        _updateStakeAndTotalStakes(_troveId);

        emit TroveUpdated(_troveId, newEntireDebt, newEntireColl, Operation.redeemCollateral);
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
        address _sender,
        uint256 _boldamount,
        uint256 _price,
        uint256 _redemptionRate,
        uint256 _maxIterations
    ) external override returns (uint256 _redemeedAmount) {
        _requireIsCollateralRegistry();

        ContractsCache memory contractsCache =
            ContractsCache(activePool, defaultPool, boldToken, sortedTroves, collSurplusPool, gasPoolAddress);
        RedemptionTotals memory totals;

        totals.remainingBold = _boldamount;
        uint256 currentTroveId;

        currentTroveId = contractsCache.sortedTroves.getLast();

        // Loop through the Troves starting from the one with lowest collateral ratio until _amount of Bold is exchanged for collateral
        if (_maxIterations == 0) _maxIterations = type(uint256).max;
        while (currentTroveId != 0 && totals.remainingBold > 0 && _maxIterations > 0) {
            _maxIterations--;
            // Save the uint256 of the Trove preceding the current one
            uint256 nextUserToCheck = contractsCache.sortedTroves.getPrev(currentTroveId);
            // Skip if ICR < 100%, to make sure that redemptions always improve the CR of hit Troves
            if (getCurrentICR(currentTroveId, _price) < _100pct) {
                currentTroveId = nextUserToCheck;
                continue;
            }

            SingleRedemptionValues memory singleRedemption;
            _redeemCollateralFromTrove(contractsCache, currentTroveId, totals.remainingBold, _price, singleRedemption);

            totals.totalBoldToRedeem += singleRedemption.BoldLot;
            totals.totalRedistDebtGains += singleRedemption.redistDebtGain;
            // For recorded and weighted recorded debt totals, we need to capture the increases and decreases,
            // since the net debt change for a given Trove could be positive or negative: redemptions decrease a Trove's recorded
            // (and weighted recorded) debt, but the accrued interest increases it.
            totals.totalNewWeightedRecordedDebt += singleRedemption.newWeightedRecordedDebt;
            totals.totalOldWeightedRecordedDebt += singleRedemption.oldWeightedRecordedDebt;
            totals.totalForgoneUpfrontInterest += singleRedemption.forgoneUpfrontInterest;
            totals.totalETHDrawn += singleRedemption.ETHLot;
            totals.remainingBold -= singleRedemption.BoldLot;

            currentTroveId = nextUserToCheck;
        }

        // We are removing this condition to prevent blocking redemptions
        //require(totals.totalETHDrawn > 0, "TroveManager: Unable to redeem any amount");

        // Calculate the ETH fee
        totals.ETHFee = _getRedemptionFee(totals.totalETHDrawn, _redemptionRate);

        // Do nothing with the fee - the funds remain in ActivePool. TODO: replace with new redemption fee scheme
        totals.ETHToSendToRedeemer = totals.totalETHDrawn - totals.ETHFee;

        emit Redemption(_boldamount, totals.totalBoldToRedeem, totals.totalETHDrawn, totals.ETHFee);

        activePool.mintAggInterestAndAccountForTroveChange(
            totals.totalRedistDebtGains, // _troveDebtIncrease
            totals.totalBoldToRedeem - totals.totalForgoneUpfrontInterest, // _troveDebtDecrease
            totals.totalNewWeightedRecordedDebt,
            totals.totalOldWeightedRecordedDebt,
            totals.totalForgoneUpfrontInterest
        );

        // Send the redeemed ETH to sender
        contractsCache.activePool.sendETH(_sender, totals.ETHToSendToRedeemer);
        // We’ll burn all the Bold together out in the CollateralRegistry, to save gas

        return totals.totalBoldToRedeem;
    }

    // --- Helper functions ---

    // Return the current collateral ratio (ICR) of a given Trove. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getCurrentICR(uint256 _troveId, uint256 _price) public view override returns (uint256) {
        LatestTroveData memory data;
        _getLatestTroveData(_troveId, data);
        return LiquityMath._computeCR(data.entireColl, data.entireDebt, _price);
    }

    function applyRedistributionGains(uint256 _troveId, uint256 _redistBoldDebtGain, uint256 _redistETHGain)
        external
        override
    {
        _requireCallerIsBorrowerOperations();
        _applyRedistributionGains(defaultPool, _troveId, _redistBoldDebtGain, _redistETHGain);
    }

    // Add the borrowers's coll and debt rewards earned from redistributions, to their Trove
    function _applyRedistributionGains(
        IDefaultPool _defaultPool,
        uint256 _troveId,
        uint256 _redistBoldDebtGain,
        uint256 _redistETHGain
    ) internal {
        _updateTroveRewardSnapshots(_troveId);

        // Transfer redistribution gains from DefaultPool to ActivePool
        _movePendingTroveRewardsToActivePool(_defaultPool, _redistBoldDebtGain, _redistETHGain);
    }

    function _updateTroveRewardSnapshots(uint256 _troveId) internal {
        rewardSnapshots[_troveId].ETH = L_ETH;
        rewardSnapshots[_troveId].boldDebt = L_boldDebt;
    }

    // Get the borrower's pending accumulated ETH reward, earned by their stake
    function getPendingETHReward(uint256 _troveId) external view override returns (uint256 redistETHGain) {
        LatestTroveData memory data;
        _getLatestTroveData(_troveId, data);
        return data.redistETHGain;
    }

    // Get the borrower's pending accumulated Bold reward, earned by their stake
    function getPendingBoldDebtReward(uint256 _troveId) external view override returns (uint256 redistBoldDebtGain) {
        LatestTroveData memory data;
        _getLatestTroveData(_troveId, data);
        return data.redistBoldDebtGain;
    }

    function hasRedistributionGains(uint256 _troveId) external view override returns (bool) {
        /*
        * A Trove has redistribution gains if its snapshot is less than the current rewards per-unit-staked sum:
        * this indicates that rewards have occured since the snapshot was made, and the user therefore has
        * redistribution gains
        */
        if (!checkTroveIsOpen(_troveId)) return false;

        return (rewardSnapshots[_troveId].ETH < L_ETH);
    }

    // Return the Troves entire debt and coll, including redistribution gains from redistributions.
    function _getLatestTroveData(uint256 _troveId, LatestTroveData memory data) internal view {
        uint256 stake = Troves[_troveId].stake;
        uint256 upfrontInterest = Troves[_troveId].upfrontInterest;

        data.recordedDebt = Troves[_troveId].debt;
        data.annualInterestRate = Troves[_troveId].annualInterestRate;

        data.redistBoldDebtGain = stake * (L_boldDebt - rewardSnapshots[_troveId].boldDebt) / DECIMAL_PRECISION;
        data.redistETHGain = stake * (L_ETH - rewardSnapshots[_troveId].ETH) / DECIMAL_PRECISION;
        data.weightedRecordedDebt = data.recordedDebt * data.annualInterestRate;
        data.accruedInterest = data.weightedRecordedDebt * (block.timestamp - Troves[_troveId].lastDebtUpdateTime)
            / ONE_YEAR / DECIMAL_PRECISION;

        if (data.accruedInterest < upfrontInterest) {
            data.unusedUpfrontInterest = upfrontInterest - data.accruedInterest;
        }

        data.entireDebt =
            data.recordedDebt + data.redistBoldDebtGain + data.accruedInterest + data.unusedUpfrontInterest;
        data.entireColl = Troves[_troveId].coll + data.redistETHGain;
    }

    function getLatestTroveData(uint256 _troveId) external view returns (LatestTroveData memory data) {
        _getLatestTroveData(_troveId, data);
    }

    function getEntireDebtAndColl(uint256 _troveId)
        external
        view
        returns (
            uint256 entireDebt,
            uint256 entireColl,
            uint256 pendingBoldDebtReward,
            uint256 pendingETHReward,
            uint256 accruedTroveInterest
        )
    {
        LatestTroveData memory data;
        _getLatestTroveData(_troveId, data);

        return (data.entireDebt, data.entireColl, data.redistBoldDebtGain, data.redistETHGain, data.accruedInterest);
    }

    function getTroveEntireDebt(uint256 _troveId) public view returns (uint256 entireTroveDebt) {
        LatestTroveData memory data;
        _getLatestTroveData(_troveId, data);
        return data.entireDebt;
    }

    function getTroveEntireColl(uint256 _troveId) external view returns (uint256 entireTroveColl) {
        LatestTroveData memory data;
        _getLatestTroveData(_troveId, data);
        return data.entireColl;
    }

    function removeStake(uint256 _troveId) external override {
        _requireCallerIsBorrowerOperations();
        return _removeStake(_troveId);
    }

    // Remove borrower's stake from the totalStakes sum, and set their stake to 0
    function _removeStake(uint256 _troveId) internal {
        uint256 stake = Troves[_troveId].stake;
        totalStakes = totalStakes - stake;
        Troves[_troveId].stake = 0;
    }

    function updateStakeAndTotalStakes(uint256 _troveId) external override returns (uint256) {
        _requireCallerIsBorrowerOperations();
        return _updateStakeAndTotalStakes(_troveId);
    }

    // Update borrower's stake based on their latest collateral value
    // TODO: Gas: can we pass current coll as a param here and remove an SLOAD?
    function _updateStakeAndTotalStakes(uint256 _troveId) internal returns (uint256) {
        uint256 newStake = _computeNewStake(Troves[_troveId].coll);
        uint256 oldStake = Troves[_troveId].stake;
        Troves[_troveId].stake = newStake;

        totalStakes = totalStakes - oldStake + newStake;
        emit TotalStakesUpdated(totalStakes);

        return newStake;
    }

    // Calculate a new stake based on the snapshots of the totalStakes and totalCollateral taken at the last liquidation
    function _computeNewStake(uint256 _coll) internal view returns (uint256) {
        uint256 stake;
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

    function _redistributeDebtAndColl(
        IActivePool _activePool,
        IDefaultPool _defaultPool,
        uint256 _debtToRedistribute,
        uint256 _collToRedistribute
    ) internal {
        if (_debtToRedistribute == 0) return;

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
        uint256 ETHNumerator = _collToRedistribute * DECIMAL_PRECISION + lastETHError_Redistribution;
        uint256 boldDebtNumerator = _debtToRedistribute * DECIMAL_PRECISION + lastBoldDebtError_Redistribution;

        // Get the per-unit-staked terms
        uint256 ETHRewardPerUnitStaked = ETHNumerator / totalStakes;
        uint256 boldDebtRewardPerUnitStaked = boldDebtNumerator / totalStakes;

        lastETHError_Redistribution = ETHNumerator - ETHRewardPerUnitStaked * totalStakes;
        lastBoldDebtError_Redistribution = boldDebtNumerator - boldDebtRewardPerUnitStaked * totalStakes;

        // Add per-unit-staked terms to the running totals
        L_ETH = L_ETH + ETHRewardPerUnitStaked;
        L_boldDebt = L_boldDebt + boldDebtRewardPerUnitStaked;

        emit LTermsUpdated(L_ETH, L_boldDebt);

        _defaultPool.increaseBoldDebt(_debtToRedistribute);
        _activePool.sendETHToDefaultPool(_collToRedistribute);
    }

    function closeTrove(uint256 _troveId) external override {
        _requireCallerIsBorrowerOperations();
        return _closeTrove(_troveId, Status.closedByOwner);
    }

    function _closeTrove(uint256 _troveId, Status closedStatus) internal {
        assert(closedStatus != Status.nonExistent && closedStatus != Status.active);

        uint256 TroveIdsArrayLength = TroveIds.length;
        _requireMoreThanOneTroveInSystem(TroveIdsArrayLength);

        Status prevStatus = Troves[_troveId].status;

        // Zero Trove properties
        Troves[_troveId].status = closedStatus;
        Troves[_troveId].coll = 0;
        Troves[_troveId].debt = 0;
        Troves[_troveId].annualInterestRate = 0;
        Troves[_troveId].upfrontInterest = 0;

        // Zero Trove snapshots
        rewardSnapshots[_troveId].ETH = 0;
        rewardSnapshots[_troveId].boldDebt = 0;

        _removeTroveId(_troveId, TroveIdsArrayLength);
        if (prevStatus == Status.active) sortedTroves.remove(_troveId);

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
    function _updateSystemSnapshots_excludeCollRemainder(IActivePool _activePool, uint256 _collRemainder) internal {
        totalStakesSnapshot = totalStakes;

        uint256 activeColl = _activePool.getETHBalance();
        uint256 liquidatedColl = defaultPool.getETHBalance();
        totalCollateralSnapshot = activeColl - _collRemainder + liquidatedColl;

        emit SystemSnapshotsUpdated(totalStakesSnapshot, totalCollateralSnapshot);
    }

    // Push the trove's id to the Trove list, and record the corresponding array index on the Trove struct
    function _addTroveIdToArray(uint256 _troveId) internal returns (uint256) {
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
    function _removeTroveId(uint256 _troveId, uint256 TroveIdsArrayLength) internal {
        Status troveStatus = Troves[_troveId].status;
        // It’s set in caller function `_closeTrove`
        assert(troveStatus != Status.nonExistent && troveStatus != Status.active);

        uint128 index = Troves[_troveId].arrayIndex;
        uint256 length = TroveIdsArrayLength;
        uint256 idxLast = length - 1;

        assert(index <= idxLast);

        uint256 idToMove = TroveIds[idxLast];

        TroveIds[index] = idToMove;
        Troves[idToMove].arrayIndex = index;
        emit TroveIndexUpdated(idToMove, index);

        TroveIds.pop();
    }

    // --- Recovery Mode and TCR functions ---

    function getTCR(uint256 _price) external view override returns (uint256) {
        return _getTCR(_price);
    }

    function checkRecoveryMode(uint256 _price) external view override returns (bool) {
        return _checkRecoveryMode(_price);
    }

    // Check whether or not the system *would be* in Recovery Mode, given an ETH:USD price, and the entire system coll and debt.
    function _checkPotentialRecoveryMode(uint256 _entireSystemColl, uint256 _entireSystemDebt, uint256 _price)
        internal
        pure
        returns (bool)
    {
        uint256 TCR = LiquityMath._computeCR(_entireSystemColl, _entireSystemDebt, _price);

        return TCR < CCR;
    }

    function checkTroveIsOpen(uint256 _troveId) public view returns (bool) {
        Status status = Troves[_troveId].status;
        return status == Status.active || status == Status.unredeemable;
    }

    function checkTroveIsActive(uint256 _troveId) external view returns (bool) {
        Status status = Troves[_troveId].status;
        return status == Status.active;
    }

    function checkTroveIsUnredeemable(uint256 _troveId) external view returns (bool) {
        Status status = Troves[_troveId].status;
        return status == Status.unredeemable;
    }

    function _getRedemptionFee(uint256 _ETHDrawn, uint256 _redemptionRate) internal pure returns (uint256) {
        uint256 redemptionFee = _redemptionRate * _ETHDrawn / DECIMAL_PRECISION;
        return redemptionFee;
    }

    // --- Interest rate calculations ---

    // TODO: analyze precision loss in interest functions and decide upon the minimum granularity
    // (per-second, per-block, etc)
    function calcTroveAccruedInterest(uint256 _troveId) public view returns (uint256) {
        uint256 recordedDebt = Troves[_troveId].debt;
        // convert annual interest to per-second and multiply by the principal
        uint256 annualInterestRate = Troves[_troveId].annualInterestRate;
        uint256 lastDebtUpdateTime = Troves[_troveId].lastDebtUpdateTime;

        return recordedDebt * annualInterestRate * (block.timestamp - lastDebtUpdateTime) / ONE_YEAR / 1e18;
    }

    // --- 'require' wrapper functions ---

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "TroveManager: Caller is not the BorrowerOperations contract");
    }

    function _requireIsOwnerOrAddManager(uint256 _troveId, address _sender) internal view {
        assert(_sender != address(0)); // TODO: remove
        require(
            _sender == ownerOf(_troveId) || _sender == TroveAddManagers[_troveId],
            "TroveManager: sender is not trove owner nor manager"
        );
    }

    function _requireIsOwnerOrRemoveManager(uint256 _troveId, address _sender) internal view {
        assert(_sender != address(0)); // TODO: remove
        require(
            _sender == ownerOf(_troveId) || _sender == TroveRemoveManagers[_troveId],
            "TroveManager: sender is not trove owner nor manager"
        );
    }

    function _requireIsCollateralRegistry() internal view {
        require(msg.sender == collateralRegistryAddress, "TroveManager: Caller is not the CollateralRegistry contract");
    }

    function _requireTroveIsOpen(uint256 _troveId) internal view {
        require(checkTroveIsOpen(_troveId), "TroveManager: Trove does not exist or is closed");
    }

    function _requireMoreThanOneTroveInSystem(uint256 TroveIdsArrayLength) internal view {
        require(TroveIdsArrayLength > 1 && sortedTroves.getSize() > 1, "TroveManager: Only one trove in the system");
    }

    // --- Trove property getters ---

    function getTroveStatus(uint256 _troveId) external view override returns (uint256) {
        return uint256(Troves[_troveId].status);
    }

    function getTroveStake(uint256 _troveId) external view override returns (uint256) {
        return Troves[_troveId].stake;
    }

    function getTroveDebt(uint256 _troveId) external view override returns (uint256) {
        return Troves[_troveId].debt;
    }

    function getTroveWeightedRecordedDebt(uint256 _troveId) public view returns (uint256) {
        return Troves[_troveId].debt * Troves[_troveId].annualInterestRate;
    }

    function getTroveColl(uint256 _troveId) external view override returns (uint256) {
        return Troves[_troveId].coll;
    }

    function getTroveAnnualInterestRate(uint256 _troveId) external view returns (uint256) {
        return Troves[_troveId].annualInterestRate;
    }

    function getTroveLastDebtUpdateTime(uint256 _troveId) external view returns (uint256) {
        return Troves[_troveId].lastDebtUpdateTime;
    }

    function troveIsStale(uint256 _troveId) external view returns (bool) {
        return block.timestamp - Troves[_troveId].lastDebtUpdateTime > STALE_TROVE_DURATION;
    }

    function getUnbackedPortionPriceAndRedeemability() external returns (uint256, uint256, bool) {
        uint256 totalDebt = getEntireSystemDebt();
        uint256 spSize = stabilityPool.getTotalBoldDeposits();
        uint256 unbackedPortion = totalDebt - spSize;

        uint256 price = priceFeed.fetchPrice();
        bool redeemable = _getTCR(price) >= _100pct;

        return (unbackedPortion, price, redeemable);
    }

    // --- Trove property setters, called by BorrowerOperations ---

    function setTrovePropertiesOnOpen(
        address _owner,
        uint256 _troveId,
        uint256 _coll,
        uint256 _debt,
        uint256 _upfrontInterest,
        uint256 _annualInterestRate
    ) external returns (uint256 arrayIndex) {
        _requireCallerIsBorrowerOperations();
        // TODO: optimize gas for writing to this struct
        Troves[_troveId].status = Status.active;
        Troves[_troveId].coll = _coll;
        Troves[_troveId].debt = _debt;
        Troves[_troveId].upfrontInterest = _upfrontInterest;
        Troves[_troveId].annualInterestRate = _annualInterestRate;
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);

        _updateTroveRewardSnapshots(_troveId);

        // mint ERC721
        _mint(_owner, _troveId);

        arrayIndex = _addTroveIdToArray(_troveId);

        // Record the Trove's stake (for redistributions) and update the total stakes
        _updateStakeAndTotalStakes(_troveId);
    }

    function setTroveStatusToActive(uint256 _troveId) external {
        _requireCallerIsBorrowerOperations();
        Troves[_troveId].status = Status.active;
    }

    function setTrovePropertiesOnInterestRateAdjustment(
        uint256 _troveId,
        uint256 _coll,
        uint256 _debt,
        uint256 _upfrontInterest,
        uint256 _annualInterestRate
    ) external {
        _requireCallerIsBorrowerOperations();

        Troves[_troveId].coll = _coll;
        Troves[_troveId].debt = _debt;
        Troves[_troveId].upfrontInterest = _upfrontInterest;
        Troves[_troveId].annualInterestRate = _annualInterestRate;
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);
    }

    function setTrovePropertiesOnInterestApplication(
        uint256 _troveId,
        uint256 _coll,
        uint256 _debt,
        uint256 _upfrontInterest
    ) external {
        _requireCallerIsBorrowerOperations();

        Troves[_troveId].coll = _coll;
        Troves[_troveId].debt = _debt;
        Troves[_troveId].upfrontInterest = _upfrontInterest;
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);
    }

    function setTrovePropertiesOnAdjustment(
        address _sender,
        uint256 _troveId,
        uint256 _coll,
        uint256 _debt,
        uint256 _upfrontInterest,
        bool _isCollIncrease,
        bool _isCollDecrease,
        bool _isDebtIncrease,
        bool _isDebtDecrease
    ) external {
        _requireCallerIsBorrowerOperations();

        if (_isCollDecrease || _isDebtIncrease) _requireIsOwnerOrRemoveManager(_troveId, _sender);
        if (_isCollIncrease || _isDebtDecrease) _requireIsOwnerOrAddManager(_troveId, _sender);

        // TODO: consider optimizing this so we only write storage slots that need changing
        Troves[_troveId].coll = _coll;
        Troves[_troveId].debt = _debt;
        Troves[_troveId].upfrontInterest = _upfrontInterest;
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);
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
