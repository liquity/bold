// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IAddressesRegistry.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/IBoldToken.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/ITroveEvents.sol";
import "./Interfaces/ITroveNFT.sol";
import "./Interfaces/ICollateralRegistry.sol";
import "./Interfaces/IWETH.sol";
import "./Interfaces/ISystemParams.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Constants.sol";

contract TroveManager is LiquityBase, ITroveManager, ITroveEvents {
    // --- Connected contract declarations ---

    ITroveNFT public troveNFT;
    IBorrowerOperations public borrowerOperations;
    IStabilityPool public stabilityPool;
    address internal gasPoolAddress;
    ICollSurplusPool internal collSurplusPool;
    IBoldToken internal boldToken;
    // A doubly linked list of Troves, sorted by their interest rate
    ISortedTroves public sortedTroves;
    ICollateralRegistry internal collateralRegistry;
    // Gas token for liquidation reserve (gas compensation)
    IERC20Metadata internal immutable gasToken;
    ISystemParams immutable systemParams;

    // --- Data structures ---

    // Store the necessary data for a trove
    struct Trove {
        uint256 debt;
        uint256 coll;
        uint256 stake;
        Status status;
        uint64 arrayIndex;
        uint64 lastDebtUpdateTime;
        uint64 lastInterestRateAdjTime;
        uint256 annualInterestRate;
        address interestBatchManager;
        uint256 batchDebtShares;
    }

    mapping(uint256 => Trove) public Troves;

    // Store the necessary data for an interest batch manager. We treat each batch as a “big trove”.
    // Each trove has a share of the debt of the global batch. Collateral is stored per trove (as CRs are different)
    // Still the total amount of batch collateral is stored for informational purposes
    struct Batch {
        uint256 debt;
        uint256 coll;
        uint64 arrayIndex;
        uint64 lastDebtUpdateTime;
        uint64 lastInterestRateAdjTime;
        uint256 annualInterestRate;
        uint256 annualManagementFee;
        uint256 totalDebtShares;
    }

    mapping(address => Batch) internal batches;

    uint256 internal totalStakes;

    // Snapshot of the value of totalStakes, taken immediately after the latest liquidation
    uint256 internal totalStakesSnapshot;

    // Snapshot of the total collateral across the ActivePool and DefaultPool, immediately after the latest liquidation.
    uint256 internal totalCollateralSnapshot;

    /*
    * L_coll and L_boldDebt track the sums of accumulated liquidation rewards per unit staked. During its lifetime, each stake earns:
    *
    * An Coll gain of ( stake * [L_coll - L_coll(0)] )
    * A boldDebt increase  of ( stake * [L_boldDebt - L_boldDebt(0)] )
    *
    * Where L_coll(0) and L_boldDebt(0) are snapshots of L_coll and L_boldDebt for the active Trove taken at the instant the stake was made
    */
    uint256 internal L_coll;
    uint256 internal L_boldDebt;

    // Map active troves to their RewardSnapshot
    mapping(uint256 => RewardSnapshot) public rewardSnapshots;

    // Object containing the Coll and Bold snapshots for a given active trove
    struct RewardSnapshot {
        uint256 coll;
        uint256 boldDebt;
    }

    // Array of all active trove addresses - used to compute an approximate hint off-chain, for the sorted list insertion
    uint256[] internal TroveIds;
    // Array of all batch managers - used to fetch them off-chain
    address[] public batchIds;

    uint256 public lastZombieTroveId;

    // Error trackers for the trove redistribution calculation
    uint256 internal lastCollError_Redistribution;
    uint256 internal lastBoldDebtError_Redistribution;

    // Timestamp at which branch was shut down. 0 if not shut down.
    uint256 public shutdownTime;

    /*
    * --- Variable container structs for liquidations ---
    *
    * These structs are used to hold, return and assign variables inside the liquidation functions,
    * in order to avoid the error: "CompilerError: Stack too deep".
    **/

    struct LiquidationValues {
        uint256 collGasCompensation;
        uint256 debtToOffset;
        uint256 collToSendToSP;
        uint256 debtToRedistribute;
        uint256 collToRedistribute;
        uint256 collSurplus;
        uint256 ETHGasCompensation;
        uint256 oldWeightedRecordedDebt;
        uint256 newWeightedRecordedDebt;
    }

    // --- Variable container structs for redemptions ---

    struct RedeemCollateralValues {
        uint256 totalCollFee;
        uint256 remainingBold;
        address lastBatchUpdatedInterest;
        uint256 nextUserToCheck;
    }

    struct SingleRedemptionValues {
        uint256 troveId;
        address batchAddress;
        uint256 boldLot;
        uint256 collLot;
        uint256 collFee;
        uint256 appliedRedistBoldDebtGain;
        uint256 oldWeightedRecordedDebt;
        uint256 newWeightedRecordedDebt;
        uint256 newStake;
        bool isZombieTrove;
        LatestTroveData trove;
        LatestBatchData batch;
    }

    // --- Errors ---

    error EmptyData();
    error NothingToLiquidate();
    error CallerNotBorrowerOperations();
    error CallerNotCollateralRegistry();
    error OnlyOneTroveLeft();
    error NotShutDown();
    error ZeroAmount();
    error NotEnoughBoldBalance();
    error MinCollNotReached(uint256 _coll);
    error BatchSharesRatioTooHigh();

    // --- Events ---

    event TroveNFTAddressChanged(address _newTroveNFTAddress);
    event BorrowerOperationsAddressChanged(address _newBorrowerOperationsAddress);
    event BoldTokenAddressChanged(address _newBoldTokenAddress);
    event StabilityPoolAddressChanged(address _stabilityPoolAddress);
    event GasPoolAddressChanged(address _gasPoolAddress);
    event CollSurplusPoolAddressChanged(address _collSurplusPoolAddress);
    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event CollateralRegistryAddressChanged(address _collateralRegistryAddress);

    constructor(IAddressesRegistry _addressesRegistry, ISystemParams _systemParams) LiquityBase(_addressesRegistry) {
        systemParams = _systemParams;

        troveNFT = _addressesRegistry.troveNFT();
        borrowerOperations = _addressesRegistry.borrowerOperations();
        stabilityPool = _addressesRegistry.stabilityPool();
        gasPoolAddress = _addressesRegistry.gasPoolAddress();
        collSurplusPool = _addressesRegistry.collSurplusPool();
        boldToken = _addressesRegistry.boldToken();
        sortedTroves = _addressesRegistry.sortedTroves();
        gasToken = _addressesRegistry.gasToken();
        collateralRegistry = _addressesRegistry.collateralRegistry();

        emit TroveNFTAddressChanged(address(troveNFT));
        emit BorrowerOperationsAddressChanged(address(borrowerOperations));
        emit StabilityPoolAddressChanged(address(stabilityPool));
        emit GasPoolAddressChanged(gasPoolAddress);
        emit CollSurplusPoolAddressChanged(address(collSurplusPool));
        emit BoldTokenAddressChanged(address(boldToken));
        emit SortedTrovesAddressChanged(address(sortedTroves));
        emit CollateralRegistryAddressChanged(address(collateralRegistry));
    }

    // --- Getters ---

    function getTroveIdsCount() external view override returns (uint256) {
        return TroveIds.length;
    }

    function getTroveFromTroveIdsArray(uint256 _index) external view override returns (uint256) {
        return TroveIds[_index];
    }

    // --- Trove Liquidation functions ---

    // --- Inner single liquidation functions ---

    // Liquidate one trove
    function _liquidate(
        IDefaultPool _defaultPool,
        uint256 _troveId,
        uint256 _boldInSPForOffsets,
        uint256 _price,
        LatestTroveData memory trove,
        LiquidationValues memory singleLiquidation
    ) internal {
        address owner = troveNFT.ownerOf(_troveId);

        _getLatestTroveData(_troveId, trove);
        address batchAddress = _getBatchManager(_troveId);
        bool isTroveInBatch = batchAddress != address(0);
        LatestBatchData memory batch;
        if (isTroveInBatch) _getLatestBatchData(batchAddress, batch);

        _movePendingTroveRewardsToActivePool(_defaultPool, trove.redistBoldDebtGain, trove.redistCollGain);

        (
            singleLiquidation.debtToOffset,
            singleLiquidation.collToSendToSP,
            singleLiquidation.collGasCompensation,
            singleLiquidation.debtToRedistribute,
            singleLiquidation.collToRedistribute,
            singleLiquidation.collSurplus
        ) = _getOffsetAndRedistributionVals(trove.entireDebt, trove.entireColl, _boldInSPForOffsets, _price);

        TroveChange memory troveChange;
        troveChange.collDecrease = trove.entireColl;
        troveChange.debtDecrease = trove.entireDebt;
        troveChange.appliedRedistCollGain = trove.redistCollGain;
        troveChange.appliedRedistBoldDebtGain = trove.redistBoldDebtGain;
        _closeTrove(
            _troveId,
            troveChange,
            batchAddress,
            batch.entireCollWithoutRedistribution,
            batch.entireDebtWithoutRedistribution,
            Status.closedByLiquidation
        );

        if (isTroveInBatch) {
            // the parenthesis in the old weighted term equals `recordedDebt + accruedInterest + accruedBatchManagementFee`
            // We want to capture last 2 ones, as the batch part only has recorded debt. The recorded debt of the trove is duplicated there,
            // but it needs to be, because it’s also included in `entireDebtWithoutRedistribution` in the next line.
            // So in the end we add it once and subtract it twice, which is the same as subtracting it once.
            singleLiquidation.oldWeightedRecordedDebt =
                batch.weightedRecordedDebt + (trove.entireDebt - trove.redistBoldDebtGain) * batch.annualInterestRate;
            singleLiquidation.newWeightedRecordedDebt = batch.entireDebtWithoutRedistribution * batch.annualInterestRate;
            // Mint batch management fee
            troveChange.batchAccruedManagementFee = batch.accruedManagementFee;
            troveChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee
                + (trove.entireDebt - trove.redistBoldDebtGain) * batch.annualManagementFee;
            troveChange.newWeightedRecordedBatchManagementFee =
                batch.entireDebtWithoutRedistribution * batch.annualManagementFee;
            activePool.mintBatchManagementFeeAndAccountForChange(troveChange, batchAddress);
        } else {
            singleLiquidation.oldWeightedRecordedDebt = trove.weightedRecordedDebt;
        }

        // Difference between liquidation penalty and liquidation threshold
        if (singleLiquidation.collSurplus > 0) {
            collSurplusPool.accountSurplus(owner, singleLiquidation.collSurplus);
        }

        // Wipe out state in BO
        borrowerOperations.onLiquidateTrove(_troveId);

        emit TroveUpdated({
            _troveId: _troveId,
            _debt: 0,
            _coll: 0,
            _stake: 0,
            _annualInterestRate: 0,
            _snapshotOfTotalCollRedist: 0,
            _snapshotOfTotalDebtRedist: 0
        });

        emit TroveOperation({
            _troveId: _troveId,
            _operation: Operation.liquidate,
            _annualInterestRate: 0,
            _debtIncreaseFromRedist: trove.redistBoldDebtGain,
            _debtIncreaseFromUpfrontFee: 0,
            _debtChangeFromOperation: -int256(trove.entireDebt),
            _collIncreaseFromRedist: trove.redistCollGain,
            _collChangeFromOperation: -int256(trove.entireColl)
        });

        if (isTroveInBatch) {
            emit BatchUpdated({
                _interestBatchManager: batchAddress,
                _operation: BatchOperation.exitBatch,
                _debt: batches[batchAddress].debt,
                _coll: batches[batchAddress].coll,
                _annualInterestRate: batch.annualInterestRate,
                _annualManagementFee: batch.annualManagementFee,
                _totalDebtShares: batches[batchAddress].totalDebtShares,
                _debtIncreaseFromUpfrontFee: 0
            });
        }
    }

    // Return the amount of Coll to be drawn from a trove's collateral and sent as gas compensation.
    function _getCollGasCompensation(uint256 _coll) internal view returns (uint256) {
        // _entireDebt should never be zero, but we add the condition defensively to avoid an unexpected revert
        return LiquityMath._min(
            _coll / systemParams.COLL_GAS_COMPENSATION_DIVISOR(), systemParams.COLL_GAS_COMPENSATION_CAP()
        );
    }

    /* In a full liquidation, returns the values for a trove's coll and debt to be offset, and coll and debt to be
    * redistributed to active troves.
    */
    function _getOffsetAndRedistributionVals(
        uint256 _entireTroveDebt,
        uint256 _entireTroveColl,
        uint256 _boldInSPForOffsets,
        uint256 _price
    )
        internal
        view
        returns (
            uint256 debtToOffset,
            uint256 collToSendToSP,
            uint256 collGasCompensation,
            uint256 debtToRedistribute,
            uint256 collToRedistribute,
            uint256 collSurplus
        )
    {
        uint256 collSPPortion;
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
        if (_boldInSPForOffsets > 0) {
            debtToOffset = LiquityMath._min(_entireTroveDebt, _boldInSPForOffsets);
            collSPPortion = _entireTroveColl * debtToOffset / _entireTroveDebt;

            collGasCompensation = _getCollGasCompensation(collSPPortion);
            uint256 collToOffset = collSPPortion - collGasCompensation;

            (collToSendToSP, collSurplus) =
                _getCollPenaltyAndSurplus(collToOffset, debtToOffset, systemParams.LIQUIDATION_PENALTY_SP(), _price);
        }

        // Redistribution
        debtToRedistribute = _entireTroveDebt - debtToOffset;
        if (debtToRedistribute > 0) {
            uint256 collRedistributionPortion = _entireTroveColl - collSPPortion;
            if (collRedistributionPortion > 0) {
                (collToRedistribute, collSurplus) = _getCollPenaltyAndSurplus(
                    collRedistributionPortion + collSurplus, // Coll surplus from offset can be eaten up by red. penalty
                    debtToRedistribute,
                    systemParams.LIQUIDATION_PENALTY_REDISTRIBUTION(), // _penaltyRatio
                    _price
                );
            }
        }
        // assert(_collToLiquidate == collToSendToSP + collToRedistribute + collSurplus);
    }

    function _getCollPenaltyAndSurplus(
        uint256 _collToLiquidate,
        uint256 _debtToLiquidate,
        uint256 _penaltyRatio,
        uint256 _price
    ) internal pure returns (uint256 seizedColl, uint256 collSurplus) {
        uint256 maxSeizedColl = _debtToLiquidate * (DECIMAL_PRECISION + _penaltyRatio) / _price;
        if (_collToLiquidate > maxSeizedColl) {
            seizedColl = maxSeizedColl;
            collSurplus = _collToLiquidate - maxSeizedColl;
        } else {
            seizedColl = _collToLiquidate;
            collSurplus = 0;
        }
    }

    /*
     * Attempt to liquidate a custom list of troves provided by the caller.
     */
    function batchLiquidateTroves(uint256[] memory _troveArray) public override {
        if (_troveArray.length == 0) {
            revert EmptyData();
        }

        IActivePool activePoolCached = activePool;
        IDefaultPool defaultPoolCached = defaultPool;
        IStabilityPool stabilityPoolCached = stabilityPool;

        TroveChange memory troveChange;
        LiquidationValues memory totals;

        uint256 price = priceFeed.fetchPrice();

        // - If the SP has total deposits >= 1e18, we leave 1e18 in it untouched.
        // - If it has 0 < x < 1e18 total deposits, we leave x in it.
        uint256 totalBoldDeposits = stabilityPoolCached.getTotalBoldDeposits();
        uint256 boldToLeaveInSP = LiquityMath._min(systemParams.MIN_BOLD_IN_SP(), totalBoldDeposits);
        uint256 boldInSPForOffsets = totalBoldDeposits - boldToLeaveInSP;

        // Perform the appropriate liquidation sequence - tally values and obtain their totals.
        _batchLiquidateTroves(defaultPoolCached, price, boldInSPForOffsets, _troveArray, totals, troveChange);

        if (troveChange.debtDecrease == 0) {
            revert NothingToLiquidate();
        }

        activePoolCached.mintAggInterestAndAccountForTroveChange(troveChange, address(0));

        // Move liquidated Coll and Bold to the appropriate pools
        if (totals.debtToOffset > 0 || totals.collToSendToSP > 0) {
            stabilityPoolCached.offset(totals.debtToOffset, totals.collToSendToSP);
        }
        // we check amount is not zero inside
        _redistributeDebtAndColl(
            activePoolCached, defaultPoolCached, totals.debtToRedistribute, totals.collToRedistribute
        );
        if (totals.collSurplus > 0) {
            activePoolCached.sendColl(address(collSurplusPool), totals.collSurplus);
        }

        // Update system snapshots
        _updateSystemSnapshots_excludeCollRemainder(activePoolCached, totals.collGasCompensation);

        emit Liquidation(
            totals.debtToOffset,
            totals.debtToRedistribute,
            totals.ETHGasCompensation,
            totals.collGasCompensation,
            totals.collToSendToSP,
            totals.collToRedistribute,
            totals.collSurplus,
            L_coll,
            L_boldDebt,
            price
        );

        // Send gas compensation to caller
        _sendGasCompensation(activePoolCached, msg.sender, totals.ETHGasCompensation, totals.collGasCompensation);
    }

    function _isActiveOrZombie(Status _status) internal pure returns (bool) {
        return _status == Status.active || _status == Status.zombie;
    }

    function _batchLiquidateTroves(
        IDefaultPool _defaultPool,
        uint256 _price,
        uint256 _boldInSPForOffsets,
        uint256[] memory _troveArray,
        LiquidationValues memory totals,
        TroveChange memory troveChange
    ) internal {
        uint256 remainingBoldInSPForOffsets = _boldInSPForOffsets;

        for (uint256 i = 0; i < _troveArray.length; i++) {
            uint256 troveId = _troveArray[i];

            // Skip non-liquidatable troves
            if (!_isActiveOrZombie(Troves[troveId].status)) continue;

            uint256 ICR = getCurrentICR(troveId, _price);

            if (ICR < systemParams.MCR()) {
                LiquidationValues memory singleLiquidation;
                LatestTroveData memory trove;

                _liquidate(_defaultPool, troveId, remainingBoldInSPForOffsets, _price, trove, singleLiquidation);
                remainingBoldInSPForOffsets -= singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                _addLiquidationValuesToTotals(trove, singleLiquidation, totals, troveChange);
            }
        }
    }

    // --- Liquidation helper functions ---

    // Adds all values from `singleLiquidation` to their respective totals in `totals` in-place
    function _addLiquidationValuesToTotals(
        LatestTroveData memory _trove,
        LiquidationValues memory _singleLiquidation,
        LiquidationValues memory totals,
        TroveChange memory troveChange
    ) internal view {
        // Tally all the values with their respective running totals
        totals.collGasCompensation += _singleLiquidation.collGasCompensation;
        totals.ETHGasCompensation += systemParams.ETH_GAS_COMPENSATION();
        troveChange.debtDecrease += _trove.entireDebt;
        troveChange.collDecrease += _trove.entireColl;
        troveChange.appliedRedistBoldDebtGain += _trove.redistBoldDebtGain;
        troveChange.oldWeightedRecordedDebt += _singleLiquidation.oldWeightedRecordedDebt;
        troveChange.newWeightedRecordedDebt += _singleLiquidation.newWeightedRecordedDebt;
        totals.debtToOffset += _singleLiquidation.debtToOffset;
        totals.collToSendToSP += _singleLiquidation.collToSendToSP;
        totals.debtToRedistribute += _singleLiquidation.debtToRedistribute;
        totals.collToRedistribute += _singleLiquidation.collToRedistribute;
        totals.collSurplus += _singleLiquidation.collSurplus;
    }

    function _sendGasCompensation(IActivePool _activePool, address _liquidator, uint256 _eth, uint256 _coll) internal {
        if (_eth > 0) {
            gasToken.transferFrom(gasPoolAddress, _liquidator, _eth);
        }

        if (_coll > 0) {
            _activePool.sendColl(_liquidator, _coll);
        }
    }

    // Move a Trove's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
    function _movePendingTroveRewardsToActivePool(IDefaultPool _defaultPool, uint256 _bold, uint256 _coll) internal {
        if (_bold > 0) {
            _defaultPool.decreaseBoldDebt(_bold);
        }

        if (_coll > 0) {
            _defaultPool.sendCollToActivePool(_coll);
        }
    }

    // --- Redemption functions ---

    function _applySingleRedemption(
        IDefaultPool _defaultPool,
        SingleRedemptionValues memory _singleRedemption,
        bool _isTroveInBatch
    ) internal returns (uint256) {
        // Decrease the debt and collateral of the current Trove according to the Bold lot and corresponding ETH to send
        uint256 newDebt = _singleRedemption.trove.entireDebt - _singleRedemption.boldLot;
        uint256 newColl = _singleRedemption.trove.entireColl - _singleRedemption.collLot;

        _singleRedemption.appliedRedistBoldDebtGain = _singleRedemption.trove.redistBoldDebtGain;

        if (_isTroveInBatch) {
            _getLatestBatchData(_singleRedemption.batchAddress, _singleRedemption.batch);
            // We know boldLot <= trove entire debt, so this subtraction is safe
            uint256 newAmountForWeightedDebt = _singleRedemption.batch.entireDebtWithoutRedistribution
                + _singleRedemption.trove.redistBoldDebtGain - _singleRedemption.boldLot;
            _singleRedemption.oldWeightedRecordedDebt = _singleRedemption.batch.weightedRecordedDebt;
            _singleRedemption.newWeightedRecordedDebt =
                newAmountForWeightedDebt * _singleRedemption.batch.annualInterestRate;

            TroveChange memory troveChange;
            troveChange.debtDecrease = _singleRedemption.boldLot;
            troveChange.collDecrease = _singleRedemption.collLot;
            troveChange.appliedRedistBoldDebtGain = _singleRedemption.trove.redistBoldDebtGain;
            troveChange.appliedRedistCollGain = _singleRedemption.trove.redistCollGain;
            // batchAccruedManagementFee is handled in the outer function
            troveChange.oldWeightedRecordedBatchManagementFee =
                _singleRedemption.batch.weightedRecordedBatchManagementFee;
            troveChange.newWeightedRecordedBatchManagementFee =
                newAmountForWeightedDebt * _singleRedemption.batch.annualManagementFee;

            activePool.mintBatchManagementFeeAndAccountForChange(troveChange, _singleRedemption.batchAddress);

            Troves[_singleRedemption.troveId].coll = newColl;
            // interest and fee were updated in the outer function
            // This call could revert due to BatchSharesRatioTooHigh if trove.redistCollGain > boldLot
            // so we skip that check to avoid blocking redemptions
            _updateBatchShares(
                _singleRedemption.troveId,
                _singleRedemption.batchAddress,
                troveChange,
                newDebt,
                _singleRedemption.batch.entireCollWithoutRedistribution,
                _singleRedemption.batch.entireDebtWithoutRedistribution,
                false // _checkBatchSharesRatio
            );
        } else {
            _singleRedemption.oldWeightedRecordedDebt = _singleRedemption.trove.weightedRecordedDebt;
            _singleRedemption.newWeightedRecordedDebt = newDebt * _singleRedemption.trove.annualInterestRate;
            Troves[_singleRedemption.troveId].debt = newDebt;
            Troves[_singleRedemption.troveId].coll = newColl;
            Troves[_singleRedemption.troveId].lastDebtUpdateTime = uint64(block.timestamp);
        }

        _singleRedemption.newStake = _updateStakeAndTotalStakes(_singleRedemption.troveId, newColl);
        _movePendingTroveRewardsToActivePool(
            _defaultPool, _singleRedemption.trove.redistBoldDebtGain, _singleRedemption.trove.redistCollGain
        );
        _updateTroveRewardSnapshots(_singleRedemption.troveId);

        if (_isTroveInBatch) {
            emit BatchedTroveUpdated({
                _troveId: _singleRedemption.troveId,
                _interestBatchManager: _singleRedemption.batchAddress,
                _batchDebtShares: Troves[_singleRedemption.troveId].batchDebtShares,
                _coll: newColl,
                _stake: _singleRedemption.newStake,
                _snapshotOfTotalCollRedist: L_coll,
                _snapshotOfTotalDebtRedist: L_boldDebt
            });
        } else {
            emit TroveUpdated({
                _troveId: _singleRedemption.troveId,
                _debt: newDebt,
                _coll: newColl,
                _stake: _singleRedemption.newStake,
                _annualInterestRate: _singleRedemption.trove.annualInterestRate,
                _snapshotOfTotalCollRedist: L_coll,
                _snapshotOfTotalDebtRedist: L_boldDebt
            });
        }

        emit TroveOperation({
            _troveId: _singleRedemption.troveId,
            _operation: Operation.redeemCollateral,
            _annualInterestRate: _singleRedemption.trove.annualInterestRate,
            _debtIncreaseFromRedist: _singleRedemption.trove.redistBoldDebtGain,
            _debtIncreaseFromUpfrontFee: 0,
            _debtChangeFromOperation: -int256(_singleRedemption.boldLot),
            _collIncreaseFromRedist: _singleRedemption.trove.redistCollGain,
            _collChangeFromOperation: -int256(_singleRedemption.collLot)
        });

        if (_isTroveInBatch) {
            emit BatchUpdated({
                _interestBatchManager: _singleRedemption.batchAddress,
                _operation: BatchOperation.troveChange,
                _debt: batches[_singleRedemption.batchAddress].debt,
                _coll: batches[_singleRedemption.batchAddress].coll,
                _annualInterestRate: _singleRedemption.batch.annualInterestRate,
                _annualManagementFee: _singleRedemption.batch.annualManagementFee,
                _totalDebtShares: batches[_singleRedemption.batchAddress].totalDebtShares,
                _debtIncreaseFromUpfrontFee: 0
            });
        }

        emit RedemptionFeePaidToTrove(_singleRedemption.troveId, _singleRedemption.collFee);

        return newDebt;
    }

    // Redeem as much collateral as possible from _borrower's Trove in exchange for Bold up to _maxBoldamount
    function _redeemCollateralFromTrove(
        IDefaultPool _defaultPool,
        SingleRedemptionValues memory _singleRedemption,
        uint256 _maxBoldamount,
        uint256 _redemptionPrice,
        uint256 _redemptionRate
    ) internal {
        _getLatestTroveData(_singleRedemption.troveId, _singleRedemption.trove);

        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the Trove
        _singleRedemption.boldLot = LiquityMath._min(_maxBoldamount, _singleRedemption.trove.entireDebt);

        // Get the amount of Coll equal in USD value to the boldLot redeemed
        uint256 correspondingColl = _singleRedemption.boldLot * DECIMAL_PRECISION / _redemptionPrice;
        // Calculate the collFee separately (for events)
        _singleRedemption.collFee = correspondingColl * _redemptionRate / DECIMAL_PRECISION;
        // Get the final collLot to send to redeemer, leaving the fee in the Trove
        _singleRedemption.collLot = correspondingColl - _singleRedemption.collFee;

        bool isTroveInBatch = _singleRedemption.batchAddress != address(0);
        uint256 newDebt = _applySingleRedemption(_defaultPool, _singleRedemption, isTroveInBatch);

        // Make Trove zombie if it's tiny (and it wasn’t already), in order to prevent griefing future (normal, sequential) redemptions
        if (newDebt < systemParams.MIN_DEBT()) {
            if (!_singleRedemption.isZombieTrove) {
                Troves[_singleRedemption.troveId].status = Status.zombie;
                if (isTroveInBatch) {
                    sortedTroves.removeFromBatch(_singleRedemption.troveId);
                } else {
                    sortedTroves.remove(_singleRedemption.troveId);
                }
                // If it’s a partial redemption, let’s store a pointer to it so it’s used first in the next one
                if (newDebt > 0) {
                    lastZombieTroveId = _singleRedemption.troveId;
                }
            } else if (newDebt == 0) {
                // Reset last zombie trove pointer if the previous one was fully redeemed now
                lastZombieTroveId = 0;
            }
        }
        // Note: technically, it could happen that the Trove pointed to by `lastZombieTroveId` ends up with
        // newDebt >= systemParams.MIN_DEBT() thanks to BOLD debt redistribution, which means it _could_ be made active again,
        // however we don't do that here, as it would require hints for re-insertion into `SortedTroves`.
    }

    function _updateBatchInterestPriorToRedemption(IActivePool _activePool, address _batchAddress) internal {
        LatestBatchData memory batch;
        _getLatestBatchData(_batchAddress, batch);
        batches[_batchAddress].debt = batch.entireDebtWithoutRedistribution;
        batches[_batchAddress].lastDebtUpdateTime = uint64(block.timestamp);
        // As we are updating the batch, we update the ActivePool weighted sum too
        TroveChange memory batchTroveChange;
        batchTroveChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
        batchTroveChange.newWeightedRecordedDebt = batch.entireDebtWithoutRedistribution * batch.annualInterestRate;
        batchTroveChange.batchAccruedManagementFee = batch.accruedManagementFee;
        batchTroveChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
        batchTroveChange.newWeightedRecordedBatchManagementFee =
            batch.entireDebtWithoutRedistribution * batch.annualManagementFee;

        _activePool.mintAggInterestAndAccountForTroveChange(batchTroveChange, _batchAddress);
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
    * All Troves that are redeemed from -- with the likely exception of the last one -- will end up with no debt left, and therefore in “zombie” state
    */
    function redeemCollateral(
        address _redeemer,
        uint256 _boldamount,
        uint256 _price,
        uint256 _redemptionRate,
        uint256 _maxIterations
    ) external override returns (uint256 _redeemedAmount) {
        _requireCallerIsCollateralRegistry();

        IActivePool activePoolCached = activePool;
        ISortedTroves sortedTrovesCached = sortedTroves;

        TroveChange memory totalsTroveChange;
        RedeemCollateralValues memory vars;

        vars.remainingBold = _boldamount;

        SingleRedemptionValues memory singleRedemption;
        // Let’s check if there’s a pending zombie trove from previous redemption
        if (lastZombieTroveId != 0) {
            singleRedemption.troveId = lastZombieTroveId;
            singleRedemption.isZombieTrove = true;
        } else {
            singleRedemption.troveId = sortedTrovesCached.getLast();
        }
        vars.lastBatchUpdatedInterest = address(0);

        uint256 redemptionPrice = priceFeed.fetchPrice();

        // Loop through the Troves starting from the one with lowest interest rate until _amount of Bold is exchanged for collateral
        if (_maxIterations == 0) _maxIterations = type(uint256).max;
        while (singleRedemption.troveId != 0 && vars.remainingBold > 0 && _maxIterations > 0) {
            _maxIterations--;
            // Save the uint256 of the Trove preceding the current one
            if (singleRedemption.isZombieTrove) {
                vars.nextUserToCheck = sortedTrovesCached.getLast();
            } else {
                vars.nextUserToCheck = sortedTrovesCached.getPrev(singleRedemption.troveId);
            }

            // Skip if ICR < 100%, to make sure that redemptions don’t decrease the CR of hit Troves.
            // Use the normal price for the ICR check.
            if (getCurrentICR(singleRedemption.troveId, _price) < _100pct) {
                singleRedemption.troveId = vars.nextUserToCheck;
                singleRedemption.isZombieTrove = false;
                continue;
            }

            // If it’s in a batch, we need to update interest first
            // We do it here outside, to avoid repeating for each trove in the same batch
            singleRedemption.batchAddress = _getBatchManager(singleRedemption.troveId);
            if (
                singleRedemption.batchAddress != address(0)
                    && singleRedemption.batchAddress != vars.lastBatchUpdatedInterest
            ) {
                _updateBatchInterestPriorToRedemption(activePoolCached, singleRedemption.batchAddress);
                vars.lastBatchUpdatedInterest = singleRedemption.batchAddress;
            }

            _redeemCollateralFromTrove(
                defaultPool, singleRedemption, vars.remainingBold, redemptionPrice, _redemptionRate
            );

            totalsTroveChange.collDecrease += singleRedemption.collLot;
            totalsTroveChange.debtDecrease += singleRedemption.boldLot;
            totalsTroveChange.appliedRedistBoldDebtGain += singleRedemption.appliedRedistBoldDebtGain;
            // For recorded and weighted recorded debt totals, we need to capture the increases and decreases,
            // since the net debt change for a given Trove could be positive or negative: redemptions decrease a Trove's recorded
            // (and weighted recorded) debt, but the accrued interest increases it.
            totalsTroveChange.newWeightedRecordedDebt += singleRedemption.newWeightedRecordedDebt;
            totalsTroveChange.oldWeightedRecordedDebt += singleRedemption.oldWeightedRecordedDebt;
            vars.totalCollFee += singleRedemption.collFee;

            vars.remainingBold -= singleRedemption.boldLot;
            singleRedemption.troveId = vars.nextUserToCheck;
            singleRedemption.isZombieTrove = false;
        }

        // We are removing this condition to prevent blocking redemptions
        //require(totals.totalCollDrawn > 0, "TroveManager: Unable to redeem any amount");

        emit Redemption(
            _boldamount,
            totalsTroveChange.debtDecrease,
            totalsTroveChange.collDecrease,
            vars.totalCollFee,
            _price,
            redemptionPrice
        );

        activePoolCached.mintAggInterestAndAccountForTroveChange(totalsTroveChange, address(0));

        // Send the redeemed Coll to sender
        activePoolCached.sendColl(_redeemer, totalsTroveChange.collDecrease);
        // We’ll burn all the Bold together out in the CollateralRegistry, to save gas

        return totalsTroveChange.debtDecrease;
    }

    // Redeem as much collateral as possible from _borrower's Trove in exchange for Bold up to _maxBoldamount
    function _urgentRedeemCollateralFromTrove(
        IDefaultPool _defaultPool,
        uint256 _maxBoldamount,
        uint256 _price,
        SingleRedemptionValues memory _singleRedemption
    ) internal {
        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the Trove minus the liquidation reserve
        _singleRedemption.boldLot = LiquityMath._min(_maxBoldamount, _singleRedemption.trove.entireDebt);

        // Get the amount of ETH equal in USD value to the BOLD lot redeemed
        _singleRedemption.collLot = _singleRedemption.boldLot * (DECIMAL_PRECISION + URGENT_REDEMPTION_BONUS) / _price;
        // As here we can redeem when CR < 101% (accounting for 1% bonus), we need to cap by collateral too
        if (_singleRedemption.collLot > _singleRedemption.trove.entireColl) {
            _singleRedemption.collLot = _singleRedemption.trove.entireColl;
            _singleRedemption.boldLot =
                _singleRedemption.trove.entireColl * _price / (DECIMAL_PRECISION + URGENT_REDEMPTION_BONUS);
        }

        bool isTroveInBatch = _singleRedemption.batchAddress != address(0);
        _applySingleRedemption(_defaultPool, _singleRedemption, isTroveInBatch);

        // No need to make this Trove zombie if it has tiny debt, since:
        // - This collateral branch has shut down and urgent redemptions are enabled
        // - Urgent redemptions aren't sequential, so they can't be griefed by tiny Troves.
    }

    function urgentRedemption(uint256 _boldAmount, uint256[] calldata _troveIds, uint256 _minCollateral) external {
        _requireIsShutDown();
        _requireAmountGreaterThanZero(_boldAmount);
        _requireBoldBalanceCoversRedemption(boldToken, msg.sender, _boldAmount);

        IActivePool activePoolCached = activePool;
        TroveChange memory totalsTroveChange;

        // Use the standard fetchPrice here, since if branch has shut down we don't worry about small redemption arbs
        uint256 price = priceFeed.fetchPrice();

        uint256 remainingBold = _boldAmount;
        for (uint256 i = 0; i < _troveIds.length; i++) {
            if (remainingBold == 0) break;

            SingleRedemptionValues memory singleRedemption;
            singleRedemption.troveId = _troveIds[i];
            _getLatestTroveData(singleRedemption.troveId, singleRedemption.trove);

            if (!_isActiveOrZombie(Troves[singleRedemption.troveId].status) || singleRedemption.trove.entireDebt == 0) {
                continue;
            }

            // If it’s in a batch, we need to update interest first
            // As we don’t have them ordered now, we cannot avoid repeating for each trove in the same batch
            singleRedemption.batchAddress = _getBatchManager(singleRedemption.troveId);
            if (singleRedemption.batchAddress != address(0)) {
                _updateBatchInterestPriorToRedemption(activePoolCached, singleRedemption.batchAddress);
            }

            _urgentRedeemCollateralFromTrove(defaultPool, remainingBold, price, singleRedemption);

            totalsTroveChange.collDecrease += singleRedemption.collLot;
            totalsTroveChange.debtDecrease += singleRedemption.boldLot;
            totalsTroveChange.appliedRedistBoldDebtGain += singleRedemption.appliedRedistBoldDebtGain;
            // For recorded and weighted recorded debt totals, we need to capture the increases and decreases,
            // since the net debt change for a given Trove could be positive or negative: redemptions decrease a Trove's recorded
            // (and weighted recorded) debt, but the accrued interest increases it.
            totalsTroveChange.newWeightedRecordedDebt += singleRedemption.newWeightedRecordedDebt;
            totalsTroveChange.oldWeightedRecordedDebt += singleRedemption.oldWeightedRecordedDebt;

            remainingBold -= singleRedemption.boldLot;
        }

        if (totalsTroveChange.collDecrease < _minCollateral) {
            revert MinCollNotReached(totalsTroveChange.collDecrease);
        }

        emit Redemption(_boldAmount, totalsTroveChange.debtDecrease, totalsTroveChange.collDecrease, 0, price, price);

        // Since this branch is shut down, this will mint 0 interest.
        // We call this only to update the aggregate debt and weighted debt trackers.
        activePoolCached.mintAggInterestAndAccountForTroveChange(totalsTroveChange, address(0));

        // Send the redeemed coll to caller
        activePoolCached.sendColl(msg.sender, totalsTroveChange.collDecrease);
        // Burn bold
        boldToken.burn(msg.sender, totalsTroveChange.debtDecrease);
    }

    function shutdown() external {
        _requireCallerIsBorrowerOperations();
        shutdownTime = block.timestamp;
        activePool.setShutdownFlag();
    }

    // --- Helper functions ---

    // Return the current collateral ratio (ICR) of a given Trove. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getCurrentICR(uint256 _troveId, uint256 _price) public view override returns (uint256) {
        LatestTroveData memory trove;
        _getLatestTroveData(_troveId, trove);
        return LiquityMath._computeCR(trove.entireColl, trove.entireDebt, _price);
    }

    function _updateTroveRewardSnapshots(uint256 _troveId) internal {
        rewardSnapshots[_troveId].coll = L_coll;
        rewardSnapshots[_troveId].boldDebt = L_boldDebt;
    }

    // Return the Troves entire debt and coll, including redistribution gains from redistributions.
    function _getLatestTroveData(uint256 _troveId, LatestTroveData memory trove) internal view {
        // If trove belongs to a batch, we fetch the batch and apply its share to obtained values
        address batchAddress = _getBatchManager(_troveId);
        if (batchAddress != address(0)) {
            LatestBatchData memory batch;
            _getLatestBatchData(batchAddress, batch);
            _getLatestTroveDataFromBatch(_troveId, trove, batch);
            return;
        }

        uint256 stake = Troves[_troveId].stake;
        trove.redistBoldDebtGain = stake * (L_boldDebt - rewardSnapshots[_troveId].boldDebt) / DECIMAL_PRECISION;
        trove.redistCollGain = stake * (L_coll - rewardSnapshots[_troveId].coll) / DECIMAL_PRECISION;

        trove.recordedDebt = Troves[_troveId].debt;
        trove.annualInterestRate = Troves[_troveId].annualInterestRate;
        trove.weightedRecordedDebt = trove.recordedDebt * trove.annualInterestRate;

        uint256 period = _getInterestPeriod(Troves[_troveId].lastDebtUpdateTime);
        trove.accruedInterest = _calcInterest(trove.weightedRecordedDebt, period);

        trove.entireDebt = trove.recordedDebt + trove.redistBoldDebtGain + trove.accruedInterest;
        trove.entireColl = Troves[_troveId].coll + trove.redistCollGain;
        trove.lastInterestRateAdjTime = Troves[_troveId].lastInterestRateAdjTime;
    }

    function _getLatestTroveDataFromBatch(
        uint256 _troveId,
        LatestTroveData memory _latestTroveData,
        LatestBatchData memory _latestBatchData
    ) internal view {
        Trove memory trove = Troves[_troveId];
        uint256 batchDebtShares = trove.batchDebtShares;
        uint256 totalDebtShares = _latestBatchData.totalDebtShares;

        uint256 stake = trove.stake;
        _latestTroveData.redistBoldDebtGain =
            stake * (L_boldDebt - rewardSnapshots[_troveId].boldDebt) / DECIMAL_PRECISION;
        _latestTroveData.redistCollGain = stake * (L_coll - rewardSnapshots[_troveId].coll) / DECIMAL_PRECISION;

        if (totalDebtShares > 0) {
            _latestTroveData.recordedDebt = _latestBatchData.recordedDebt * batchDebtShares / totalDebtShares;
            _latestTroveData.weightedRecordedDebt = _latestTroveData.recordedDebt * _latestBatchData.annualInterestRate;
            _latestTroveData.accruedInterest = _latestBatchData.accruedInterest * batchDebtShares / totalDebtShares;
            _latestTroveData.accruedBatchManagementFee =
                _latestBatchData.accruedManagementFee * batchDebtShares / totalDebtShares;
        }
        _latestTroveData.annualInterestRate = _latestBatchData.annualInterestRate;

        // We can’t do pro-rata batch entireDebt, because redist gains are proportional to coll, not to debt
        _latestTroveData.entireDebt = _latestTroveData.recordedDebt + _latestTroveData.redistBoldDebtGain
            + _latestTroveData.accruedInterest + _latestTroveData.accruedBatchManagementFee;
        _latestTroveData.entireColl = trove.coll + _latestTroveData.redistCollGain;
        _latestTroveData.lastInterestRateAdjTime =
            LiquityMath._max(_latestBatchData.lastInterestRateAdjTime, trove.lastInterestRateAdjTime);
    }

    function getLatestTroveData(uint256 _troveId) external view returns (LatestTroveData memory trove) {
        _getLatestTroveData(_troveId, trove);
    }

    function getTroveAnnualInterestRate(uint256 _troveId) external view returns (uint256) {
        Trove memory trove = Troves[_troveId];
        address batchAddress = _getBatchManager(trove);
        if (batchAddress != address(0)) {
            return batches[batchAddress].annualInterestRate;
        }
        return trove.annualInterestRate;
    }

    function _getBatchManager(uint256 _troveId) internal view returns (address) {
        return Troves[_troveId].interestBatchManager;
    }

    function _getBatchManager(Trove memory trove) internal pure returns (address) {
        return trove.interestBatchManager;
    }

    // Return the Batch entire debt and coll, including redistribution gains from redistributions.
    function _getLatestBatchData(address _batchAddress, LatestBatchData memory latestBatchData) internal view {
        Batch memory batch = batches[_batchAddress];

        latestBatchData.totalDebtShares = batch.totalDebtShares;
        latestBatchData.recordedDebt = batch.debt;
        latestBatchData.annualInterestRate = batch.annualInterestRate;
        latestBatchData.weightedRecordedDebt = latestBatchData.recordedDebt * latestBatchData.annualInterestRate;
        uint256 period = _getInterestPeriod(batch.lastDebtUpdateTime);
        latestBatchData.accruedInterest = _calcInterest(latestBatchData.weightedRecordedDebt, period);
        latestBatchData.annualManagementFee = batch.annualManagementFee;
        latestBatchData.weightedRecordedBatchManagementFee =
            latestBatchData.recordedDebt * latestBatchData.annualManagementFee;
        latestBatchData.accruedManagementFee = _calcInterest(latestBatchData.weightedRecordedBatchManagementFee, period);

        latestBatchData.entireDebtWithoutRedistribution =
            latestBatchData.recordedDebt + latestBatchData.accruedInterest + latestBatchData.accruedManagementFee;
        latestBatchData.entireCollWithoutRedistribution = batch.coll;
        latestBatchData.lastDebtUpdateTime = batch.lastDebtUpdateTime;
        latestBatchData.lastInterestRateAdjTime = batch.lastInterestRateAdjTime;
    }

    function getLatestBatchData(address _batchAddress) external view returns (LatestBatchData memory batch) {
        _getLatestBatchData(_batchAddress, batch);
    }

    // Update borrower's stake based on their latest collateral value
    function _updateStakeAndTotalStakes(uint256 _troveId, uint256 _coll) internal returns (uint256 newStake) {
        newStake = _computeNewStake(_coll);
        uint256 oldStake = Troves[_troveId].stake;
        Troves[_troveId].stake = newStake;

        totalStakes = totalStakes - oldStake + newStake;
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
            // assert(totalStakesSnapshot > 0);
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
        if (_debtToRedistribute == 0) return; // Otherwise _collToRedistribute > 0 too

        /*
        * Add distributed coll and debt rewards-per-unit-staked to the running totals. Division uses a "feedback"
        * error correction, to keep the cumulative error low in the running totals L_coll and L_boldDebt:
        *
        * 1) Form numerators which compensate for the floor division errors that occurred the last time this
        * function was called.
        * 2) Calculate "per-unit-staked" ratios.
        * 3) Multiply each ratio back by its denominator, to reveal the current floor division error.
        * 4) Store these errors for use in the next correction when this function is called.
        * 5) Note: static analysis tools complain about this "division before multiplication", however, it is intended.
        */
        uint256 collNumerator = _collToRedistribute * DECIMAL_PRECISION + lastCollError_Redistribution;
        uint256 boldDebtNumerator = _debtToRedistribute * DECIMAL_PRECISION + lastBoldDebtError_Redistribution;

        // Get the per-unit-staked terms
        uint256 collRewardPerUnitStaked = collNumerator / totalStakes;
        uint256 boldDebtRewardPerUnitStaked = boldDebtNumerator / totalStakes;

        lastCollError_Redistribution = collNumerator - collRewardPerUnitStaked * totalStakes;
        lastBoldDebtError_Redistribution = boldDebtNumerator - boldDebtRewardPerUnitStaked * totalStakes;

        // Add per-unit-staked terms to the running totals
        L_coll = L_coll + collRewardPerUnitStaked;
        L_boldDebt = L_boldDebt + boldDebtRewardPerUnitStaked;

        _defaultPool.increaseBoldDebt(_debtToRedistribute);
        _activePool.sendCollToDefaultPool(_collToRedistribute);
    }

    /*
    * Updates snapshots of system total stakes and total collateral, excluding a given collateral remainder from the calculation.
    * Used in a liquidation sequence.
    */
    function _updateSystemSnapshots_excludeCollRemainder(IActivePool _activePool, uint256 _collRemainder) internal {
        totalStakesSnapshot = totalStakes;

        uint256 activeColl = _activePool.getCollBalance();
        uint256 liquidatedColl = defaultPool.getCollBalance();
        totalCollateralSnapshot = activeColl - _collRemainder + liquidatedColl;
    }

    /*
    * Remove a Trove owner from the TroveIds array, not preserving array order. Removing owner 'B' does the following:
    * [A B C D E] => [A E C D], and updates E's Trove struct to point to its new array index.
    */
    function _removeTroveId(uint256 _troveId, uint256 TroveIdsArrayLength) internal {
        uint64 index = Troves[_troveId].arrayIndex;
        uint256 idxLast = TroveIdsArrayLength - 1;

        // assert(index <= idxLast);

        uint256 idToMove = TroveIds[idxLast];

        TroveIds[index] = idToMove;
        Troves[idToMove].arrayIndex = index;

        TroveIds.pop();
    }

    function getTroveStatus(uint256 _troveId) external view override returns (Status) {
        return Troves[_troveId].status;
    }

    // --- Interest rate calculations ---

    function _getInterestPeriod(uint256 _lastDebtUpdateTime) internal view returns (uint256) {
        if (shutdownTime == 0) {
            // If branch is not shut down, interest is earned up to now.
            return block.timestamp - _lastDebtUpdateTime;
        } else if (shutdownTime > 0 && _lastDebtUpdateTime < shutdownTime) {
            // If branch is shut down and the Trove was not updated since shut down, interest is earned up to the shutdown time.
            return shutdownTime - _lastDebtUpdateTime;
        } else {
            // if (shutdownTime > 0 && _lastDebtUpdateTime >= shutdownTime)
            // If branch is shut down and the Trove was updated after shutdown, no interest is earned since.
            return 0;
        }
    }

    // --- 'require' wrapper functions ---

    function _requireCallerIsBorrowerOperations() internal view {
        if (msg.sender != address(borrowerOperations)) {
            revert CallerNotBorrowerOperations();
        }
    }

    function _requireCallerIsCollateralRegistry() internal view {
        if (msg.sender != address(collateralRegistry)) {
            revert CallerNotCollateralRegistry();
        }
    }

    function _requireMoreThanOneTroveInSystem(uint256 TroveIdsArrayLength) internal pure {
        if (TroveIdsArrayLength == 1) {
            revert OnlyOneTroveLeft();
        }
    }

    function _requireIsShutDown() internal view {
        if (shutdownTime == 0) {
            revert NotShutDown();
        }
    }

    function _requireAmountGreaterThanZero(uint256 _amount) internal pure {
        if (_amount == 0) {
            revert ZeroAmount();
        }
    }

    function _requireBoldBalanceCoversRedemption(IBoldToken _boldToken, address _redeemer, uint256 _amount)
        internal
        view
    {
        uint256 boldBalance = _boldToken.balanceOf(_redeemer);
        if (boldBalance < _amount) {
            revert NotEnoughBoldBalance();
        }
    }

    // --- Trove property getters ---

    function getUnbackedPortionPriceAndRedeemability() external returns (uint256, uint256, bool) {
        uint256 totalDebt = getEntireBranchDebt();
        uint256 spSize = stabilityPool.getTotalBoldDeposits();
        uint256 unbackedPortion = totalDebt > spSize ? totalDebt - spSize : 0;

        uint256 price = priceFeed.fetchPrice();
        // It's redeemable if the TCR is above the shutdown threshold, and branch has not been shut down.
        // Use the normal price for the TCR check.
        bool redeemable = _getTCR(price) >= systemParams.SCR() && shutdownTime == 0;

        return (unbackedPortion, price, redeemable);
    }

    // --- Trove property setters, called by BorrowerOperations ---

    function onOpenTrove(address _owner, uint256 _troveId, TroveChange memory _troveChange, uint256 _annualInterestRate)
        external
    {
        _requireCallerIsBorrowerOperations();

        uint256 newStake = _computeNewStake(_troveChange.collIncrease);

        // Trove memory newTrove;
        Troves[_troveId].debt = _troveChange.debtIncrease + _troveChange.upfrontFee;
        Troves[_troveId].coll = _troveChange.collIncrease;
        Troves[_troveId].stake = newStake;
        Troves[_troveId].status = Status.active;
        Troves[_troveId].arrayIndex = uint64(TroveIds.length);
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);
        Troves[_troveId].lastInterestRateAdjTime = uint64(block.timestamp);
        Troves[_troveId].annualInterestRate = _annualInterestRate;

        // Push the trove's id to the Trove list
        TroveIds.push(_troveId);

        uint256 newTotalStakes = totalStakes + newStake;
        totalStakes = newTotalStakes;

        // mint ERC721
        troveNFT.mint(_owner, _troveId);

        _updateTroveRewardSnapshots(_troveId);

        emit TroveUpdated({
            _troveId: _troveId,
            _debt: _troveChange.debtIncrease + _troveChange.upfrontFee,
            _coll: _troveChange.collIncrease,
            _stake: newStake,
            _annualInterestRate: _annualInterestRate,
            _snapshotOfTotalCollRedist: L_coll,
            _snapshotOfTotalDebtRedist: L_boldDebt
        });

        emit TroveOperation({
            _troveId: _troveId,
            _operation: Operation.openTrove,
            _annualInterestRate: _annualInterestRate,
            _debtIncreaseFromRedist: 0,
            _debtIncreaseFromUpfrontFee: _troveChange.upfrontFee,
            _debtChangeFromOperation: int256(_troveChange.debtIncrease),
            _collIncreaseFromRedist: 0,
            _collChangeFromOperation: int256(_troveChange.collIncrease)
        });
    }

    function onOpenTroveAndJoinBatch(
        address _owner,
        uint256 _troveId,
        TroveChange memory _troveChange,
        address _batchAddress,
        uint256 _batchColl,
        uint256 _batchDebt
    ) external {
        _requireCallerIsBorrowerOperations();
        // assert(batchIds[batches[_batchAddress].arrayIndex] == _batchAddress);

        uint256 newStake = _computeNewStake(_troveChange.collIncrease);

        // Trove memory newTrove;
        Troves[_troveId].coll = _troveChange.collIncrease;
        Troves[_troveId].stake = newStake;
        Troves[_troveId].status = Status.active;
        Troves[_troveId].arrayIndex = uint64(TroveIds.length);
        Troves[_troveId].interestBatchManager = _batchAddress;
        Troves[_troveId].lastInterestRateAdjTime = uint64(block.timestamp);

        _updateTroveRewardSnapshots(_troveId);

        // Push the trove's id to the Trove list
        TroveIds.push(_troveId);

        assert(_troveChange.debtIncrease > 0);
        _updateBatchShares(
            _troveId, _batchAddress, _troveChange, _troveChange.debtIncrease, _batchColl, _batchDebt, true
        );

        uint256 newTotalStakes = totalStakes + newStake;
        totalStakes = newTotalStakes;

        // mint ERC721
        troveNFT.mint(_owner, _troveId);

        emit BatchedTroveUpdated({
            _troveId: _troveId,
            _interestBatchManager: _batchAddress,
            _batchDebtShares: Troves[_troveId].batchDebtShares,
            _coll: _troveChange.collIncrease,
            _stake: newStake,
            _snapshotOfTotalCollRedist: L_coll,
            _snapshotOfTotalDebtRedist: L_boldDebt
        });

        emit TroveOperation({
            _troveId: _troveId,
            _operation: Operation.openTroveAndJoinBatch,
            _annualInterestRate: batches[_batchAddress].annualInterestRate,
            _debtIncreaseFromRedist: 0,
            _debtIncreaseFromUpfrontFee: _troveChange.upfrontFee,
            _debtChangeFromOperation: int256(_troveChange.debtIncrease),
            _collIncreaseFromRedist: 0,
            _collChangeFromOperation: int256(_troveChange.collIncrease)
        });

        emit BatchUpdated({
            _interestBatchManager: _batchAddress,
            _operation: BatchOperation.joinBatch,
            _debt: batches[_batchAddress].debt,
            _coll: batches[_batchAddress].coll,
            _annualInterestRate: batches[_batchAddress].annualInterestRate,
            _annualManagementFee: batches[_batchAddress].annualManagementFee,
            _totalDebtShares: batches[_batchAddress].totalDebtShares,
            // Although the Trove joining the batch pays an upfront fee,
            // it is an individual fee, so we don't include it here
            _debtIncreaseFromUpfrontFee: 0
        });
    }

    function setTroveStatusToActive(uint256 _troveId) external {
        _requireCallerIsBorrowerOperations();
        Troves[_troveId].status = Status.active;
        if (lastZombieTroveId == _troveId) {
            lastZombieTroveId = 0;
        }
    }

    function onAdjustTroveInterestRate(
        uint256 _troveId,
        uint256 _newColl,
        uint256 _newDebt,
        uint256 _newAnnualInterestRate,
        TroveChange calldata _troveChange
    ) external {
        _requireCallerIsBorrowerOperations();

        Troves[_troveId].coll = _newColl;
        Troves[_troveId].debt = _newDebt;
        Troves[_troveId].annualInterestRate = _newAnnualInterestRate;
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);
        Troves[_troveId].lastInterestRateAdjTime = uint64(block.timestamp);

        _movePendingTroveRewardsToActivePool(
            defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistCollGain
        );

        _updateTroveRewardSnapshots(_troveId);

        emit TroveUpdated({
            _troveId: _troveId,
            _debt: _newDebt,
            _coll: _newColl,
            _stake: Troves[_troveId].stake,
            _annualInterestRate: _newAnnualInterestRate,
            _snapshotOfTotalCollRedist: L_coll,
            _snapshotOfTotalDebtRedist: L_boldDebt
        });

        emit TroveOperation({
            _troveId: _troveId,
            _operation: Operation.adjustTroveInterestRate,
            _annualInterestRate: _newAnnualInterestRate,
            _debtIncreaseFromRedist: _troveChange.appliedRedistBoldDebtGain,
            _debtIncreaseFromUpfrontFee: _troveChange.upfrontFee,
            _debtChangeFromOperation: 0,
            _collIncreaseFromRedist: _troveChange.appliedRedistCollGain,
            _collChangeFromOperation: 0
        });
    }

    function onAdjustTrove(uint256 _troveId, uint256 _newColl, uint256 _newDebt, TroveChange calldata _troveChange)
        external
    {
        _requireCallerIsBorrowerOperations();

        Troves[_troveId].coll = _newColl;
        Troves[_troveId].debt = _newDebt;
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);

        _movePendingTroveRewardsToActivePool(
            defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistCollGain
        );

        uint256 newStake = _updateStakeAndTotalStakes(_troveId, _newColl);
        _updateTroveRewardSnapshots(_troveId);

        emit TroveUpdated({
            _troveId: _troveId,
            _debt: _newDebt,
            _coll: _newColl,
            _stake: newStake,
            _annualInterestRate: Troves[_troveId].annualInterestRate,
            _snapshotOfTotalCollRedist: L_coll,
            _snapshotOfTotalDebtRedist: L_boldDebt
        });

        emit TroveOperation({
            _troveId: _troveId,
            _operation: Operation.adjustTrove,
            _annualInterestRate: Troves[_troveId].annualInterestRate,
            _debtIncreaseFromRedist: _troveChange.appliedRedistBoldDebtGain,
            _debtIncreaseFromUpfrontFee: _troveChange.upfrontFee,
            _debtChangeFromOperation: int256(_troveChange.debtIncrease) - int256(_troveChange.debtDecrease),
            _collIncreaseFromRedist: _troveChange.appliedRedistCollGain,
            _collChangeFromOperation: int256(_troveChange.collIncrease) - int256(_troveChange.collDecrease)
        });
    }

    function onCloseTrove(
        uint256 _troveId,
        TroveChange memory _troveChange, // decrease vars: entire, with interest, batch fee and redistribution
        address _batchAddress,
        uint256 _newBatchColl,
        uint256 _newBatchDebt // entire, with interest and batch fee
    ) external override {
        _requireCallerIsBorrowerOperations();
        _closeTrove(_troveId, _troveChange, _batchAddress, _newBatchColl, _newBatchDebt, Status.closedByOwner);
        _movePendingTroveRewardsToActivePool(
            defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistCollGain
        );

        emit TroveUpdated({
            _troveId: _troveId,
            _debt: 0,
            _coll: 0,
            _stake: 0,
            _annualInterestRate: 0,
            _snapshotOfTotalCollRedist: 0,
            _snapshotOfTotalDebtRedist: 0
        });

        emit TroveOperation({
            _troveId: _troveId,
            _operation: Operation.closeTrove,
            _annualInterestRate: 0,
            _debtIncreaseFromRedist: _troveChange.appliedRedistBoldDebtGain,
            _debtIncreaseFromUpfrontFee: _troveChange.upfrontFee,
            _debtChangeFromOperation: int256(_troveChange.debtIncrease) - int256(_troveChange.debtDecrease),
            _collIncreaseFromRedist: _troveChange.appliedRedistCollGain,
            _collChangeFromOperation: int256(_troveChange.collIncrease) - int256(_troveChange.collDecrease)
        });

        if (_batchAddress != address(0)) {
            emit BatchUpdated({
                _interestBatchManager: _batchAddress,
                _operation: BatchOperation.exitBatch,
                _debt: batches[_batchAddress].debt,
                _coll: batches[_batchAddress].coll,
                _annualInterestRate: batches[_batchAddress].annualInterestRate,
                _annualManagementFee: batches[_batchAddress].annualManagementFee,
                _totalDebtShares: batches[_batchAddress].totalDebtShares,
                _debtIncreaseFromUpfrontFee: 0
            });
        }
    }

    function _closeTrove(
        uint256 _troveId,
        TroveChange memory _troveChange, // decrease vars: entire, with interest, batch fee and redistribution
        address _batchAddress,
        uint256 _newBatchColl,
        uint256 _newBatchDebt, // entire, with interest and batch fee
        Status closedStatus
    ) internal {
        // assert(closedStatus == Status.closedByLiquidation || closedStatus == Status.closedByOwner);

        uint256 TroveIdsArrayLength = TroveIds.length;
        // If branch has not been shut down, or it's a liquidation,
        // require at least 1 trove in the system
        if (shutdownTime == 0 || closedStatus == Status.closedByLiquidation) {
            _requireMoreThanOneTroveInSystem(TroveIdsArrayLength);
        }

        _removeTroveId(_troveId, TroveIdsArrayLength);

        Trove memory trove = Troves[_troveId];

        // If trove belongs to a batch, remove from it
        if (_batchAddress != address(0)) {
            if (trove.status == Status.active) {
                sortedTroves.removeFromBatch(_troveId);
            } else if (trove.status == Status.zombie && lastZombieTroveId == _troveId) {
                lastZombieTroveId = 0;
            }

            _removeTroveSharesFromBatch(
                _troveId,
                _troveChange.collDecrease,
                _troveChange.debtDecrease,
                _troveChange,
                _batchAddress,
                _newBatchColl,
                _newBatchDebt
            );
        } else {
            if (trove.status == Status.active) {
                sortedTroves.remove(_troveId);
            } else if (trove.status == Status.zombie && lastZombieTroveId == _troveId) {
                lastZombieTroveId = 0;
            }
        }

        uint256 newTotalStakes = totalStakes - trove.stake;
        totalStakes = newTotalStakes;

        // Zero Trove properties
        delete Troves[_troveId];
        Troves[_troveId].status = closedStatus;

        // Zero Trove snapshots
        delete rewardSnapshots[_troveId];

        // burn ERC721
        troveNFT.burn(_troveId);
    }

    function onAdjustTroveInsideBatch(
        uint256 _troveId,
        uint256 _newTroveColl, // entire, with redistribution and trove change
        uint256 _newTroveDebt, // entire, with redistribution and trove change
        TroveChange memory _troveChange,
        address _batchAddress,
        uint256 _newBatchColl, // without trove change
        uint256 _newBatchDebt // entire (with interest, batch fee), but without trove change nor upfront fee nor redistribution
    ) external {
        _requireCallerIsBorrowerOperations();

        // Trove
        Troves[_troveId].coll = _newTroveColl;
        _updateTroveRewardSnapshots(_troveId);
        uint256 newStake = _updateStakeAndTotalStakes(_troveId, _newTroveColl);

        // Batch
        assert(_newTroveDebt > 0);
        _updateBatchShares(_troveId, _batchAddress, _troveChange, _newTroveDebt, _newBatchColl, _newBatchDebt, true);

        _movePendingTroveRewardsToActivePool(
            defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistCollGain
        );

        emit BatchedTroveUpdated({
            _troveId: _troveId,
            _interestBatchManager: _batchAddress,
            _batchDebtShares: Troves[_troveId].batchDebtShares,
            _coll: _newTroveColl,
            _stake: newStake,
            _snapshotOfTotalCollRedist: L_coll,
            _snapshotOfTotalDebtRedist: L_boldDebt
        });

        emit TroveOperation({
            _troveId: _troveId,
            _operation: Operation.adjustTrove,
            _annualInterestRate: batches[_batchAddress].annualInterestRate,
            _debtIncreaseFromRedist: _troveChange.appliedRedistBoldDebtGain,
            _debtIncreaseFromUpfrontFee: _troveChange.upfrontFee,
            _debtChangeFromOperation: int256(_troveChange.debtIncrease) - int256(_troveChange.debtDecrease),
            _collIncreaseFromRedist: _troveChange.appliedRedistCollGain,
            _collChangeFromOperation: int256(_troveChange.collIncrease) - int256(_troveChange.collDecrease)
        });

        emit BatchUpdated({
            _interestBatchManager: _batchAddress,
            _operation: BatchOperation.troveChange,
            _debt: batches[_batchAddress].debt,
            _coll: batches[_batchAddress].coll,
            _annualInterestRate: batches[_batchAddress].annualInterestRate,
            _annualManagementFee: batches[_batchAddress].annualManagementFee,
            _totalDebtShares: batches[_batchAddress].totalDebtShares,
            // Although the Trove being adjusted may pay an upfront fee,
            // it is an individual fee, so we don't include it here
            _debtIncreaseFromUpfrontFee: 0
        });
    }

    function onApplyTroveInterest(
        uint256 _troveId,
        uint256 _newTroveColl,
        uint256 _newTroveDebt,
        address _batchAddress,
        uint256 _newBatchColl,
        uint256 _newBatchDebt,
        TroveChange calldata _troveChange
    ) external {
        _requireCallerIsBorrowerOperations();

        Troves[_troveId].coll = _newTroveColl;

        if (_batchAddress != address(0)) {
            assert(_newTroveDebt > 0);
            _updateBatchShares(_troveId, _batchAddress, _troveChange, _newTroveDebt, _newBatchColl, _newBatchDebt, true);

            emit BatchUpdated({
                _interestBatchManager: _batchAddress,
                _operation: BatchOperation.applyBatchInterestAndFee,
                _debt: _newBatchDebt,
                _coll: _newBatchColl,
                _annualInterestRate: batches[_batchAddress].annualInterestRate,
                _annualManagementFee: batches[_batchAddress].annualManagementFee,
                _totalDebtShares: batches[_batchAddress].totalDebtShares,
                _debtIncreaseFromUpfrontFee: 0
            });
        } else {
            Troves[_troveId].debt = _newTroveDebt;
            Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);
        }

        _movePendingTroveRewardsToActivePool(
            defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistCollGain
        );

        _updateTroveRewardSnapshots(_troveId);

        emit TroveUpdated({
            _troveId: _troveId,
            _debt: _newTroveDebt,
            _coll: _newTroveColl,
            _stake: Troves[_troveId].stake,
            _annualInterestRate: Troves[_troveId].annualInterestRate,
            _snapshotOfTotalCollRedist: L_coll,
            _snapshotOfTotalDebtRedist: L_boldDebt
        });

        emit TroveOperation({
            _troveId: _troveId,
            _operation: Operation.applyPendingDebt,
            _annualInterestRate: Troves[_troveId].annualInterestRate,
            _debtIncreaseFromRedist: _troveChange.appliedRedistBoldDebtGain,
            _debtIncreaseFromUpfrontFee: _troveChange.upfrontFee,
            _debtChangeFromOperation: int256(_troveChange.debtIncrease) - int256(_troveChange.debtDecrease),
            _collIncreaseFromRedist: _troveChange.appliedRedistCollGain,
            _collChangeFromOperation: int256(_troveChange.collIncrease) - int256(_troveChange.collDecrease)
        });
    }

    function onRegisterBatchManager(address _account, uint256 _annualInterestRate, uint256 _annualManagementFee)
        external
    {
        _requireCallerIsBorrowerOperations();

        batches[_account].arrayIndex = uint64(batchIds.length);
        batches[_account].annualInterestRate = _annualInterestRate;
        batches[_account].annualManagementFee = _annualManagementFee;
        batches[_account].lastInterestRateAdjTime = uint64(block.timestamp);

        batchIds.push(_account);

        emit BatchUpdated({
            _interestBatchManager: _account,
            _operation: BatchOperation.registerBatchManager,
            _debt: 0,
            _coll: 0,
            _annualInterestRate: _annualInterestRate,
            _annualManagementFee: _annualManagementFee,
            _totalDebtShares: 0,
            _debtIncreaseFromUpfrontFee: 0
        });
    }

    function onLowerBatchManagerAnnualFee(
        address _batchAddress,
        uint256 _newColl,
        uint256 _newDebt,
        uint256 _newAnnualManagementFee
    ) external {
        _requireCallerIsBorrowerOperations();

        batches[_batchAddress].coll = _newColl;
        batches[_batchAddress].debt = _newDebt;
        batches[_batchAddress].annualManagementFee = _newAnnualManagementFee;
        batches[_batchAddress].lastDebtUpdateTime = uint64(block.timestamp);

        emit BatchUpdated({
            _interestBatchManager: _batchAddress,
            _operation: BatchOperation.lowerBatchManagerAnnualFee,
            _debt: _newDebt,
            _coll: _newColl,
            _annualInterestRate: batches[_batchAddress].annualInterestRate,
            _annualManagementFee: _newAnnualManagementFee,
            _totalDebtShares: batches[_batchAddress].totalDebtShares,
            _debtIncreaseFromUpfrontFee: 0
        });
    }

    function onSetBatchManagerAnnualInterestRate(
        address _batchAddress,
        uint256 _newColl,
        uint256 _newDebt,
        uint256 _newAnnualInterestRate,
        uint256 _upfrontFee
    ) external {
        _requireCallerIsBorrowerOperations();

        batches[_batchAddress].coll = _newColl;
        batches[_batchAddress].debt = _newDebt;
        batches[_batchAddress].annualInterestRate = _newAnnualInterestRate;
        batches[_batchAddress].lastDebtUpdateTime = uint64(block.timestamp);
        batches[_batchAddress].lastInterestRateAdjTime = uint64(block.timestamp);

        emit BatchUpdated({
            _interestBatchManager: _batchAddress,
            _operation: BatchOperation.setBatchManagerAnnualInterestRate,
            _debt: _newDebt,
            _coll: _newColl,
            _annualInterestRate: _newAnnualInterestRate,
            _annualManagementFee: batches[_batchAddress].annualManagementFee,
            _totalDebtShares: batches[_batchAddress].totalDebtShares,
            _debtIncreaseFromUpfrontFee: _upfrontFee
        });
    }

    function onSetInterestBatchManager(OnSetInterestBatchManagerParams calldata _params) external {
        _requireCallerIsBorrowerOperations();
        TroveChange memory _troveChange = _params.troveChange;

        // assert(batchIds[batches[_params.newBatchAddress].arrayIndex] == _params.newBatchAddress);

        _updateTroveRewardSnapshots(_params.troveId);

        // Clean Trove state
        Troves[_params.troveId].debt = 0;
        Troves[_params.troveId].annualInterestRate = 0;
        Troves[_params.troveId].lastDebtUpdateTime = 0;
        Troves[_params.troveId].coll = _params.troveColl;

        Troves[_params.troveId].interestBatchManager = _params.newBatchAddress;
        Troves[_params.troveId].lastInterestRateAdjTime = uint64(block.timestamp);

        _troveChange.collIncrease = _params.troveColl - _troveChange.appliedRedistCollGain;
        _troveChange.debtIncrease = _params.troveDebt - _troveChange.appliedRedistBoldDebtGain - _troveChange.upfrontFee;
        assert(_params.troveDebt > 0);
        _updateBatchShares(
            _params.troveId,
            _params.newBatchAddress,
            _troveChange,
            _params.troveDebt,
            _params.newBatchColl,
            _params.newBatchDebt,
            true
        );

        _movePendingTroveRewardsToActivePool(
            defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistCollGain
        );

        emit BatchedTroveUpdated({
            _troveId: _params.troveId,
            _interestBatchManager: _params.newBatchAddress,
            _batchDebtShares: Troves[_params.troveId].batchDebtShares,
            _coll: _params.troveColl,
            _stake: Troves[_params.troveId].stake,
            _snapshotOfTotalCollRedist: L_coll,
            _snapshotOfTotalDebtRedist: L_boldDebt
        });

        emit TroveOperation({
            _troveId: _params.troveId,
            _operation: Operation.setInterestBatchManager,
            _annualInterestRate: batches[_params.newBatchAddress].annualInterestRate,
            _debtIncreaseFromRedist: _troveChange.appliedRedistBoldDebtGain,
            _debtIncreaseFromUpfrontFee: _troveChange.upfrontFee,
            _debtChangeFromOperation: 0,
            _collIncreaseFromRedist: _troveChange.appliedRedistCollGain,
            _collChangeFromOperation: 0
        });

        emit BatchUpdated({
            _interestBatchManager: _params.newBatchAddress,
            _operation: BatchOperation.joinBatch,
            _debt: batches[_params.newBatchAddress].debt,
            _coll: batches[_params.newBatchAddress].coll,
            _annualInterestRate: batches[_params.newBatchAddress].annualInterestRate,
            _annualManagementFee: batches[_params.newBatchAddress].annualManagementFee,
            _totalDebtShares: batches[_params.newBatchAddress].totalDebtShares,
            // Although the Trove joining the batch may pay an upfront fee,
            // it is an individual fee, so we don't include it here
            _debtIncreaseFromUpfrontFee: 0
        });
    }

    // This function will revert if there’s a total debt increase and the ratio debt / shares has exceeded the max
    function _updateBatchShares(
        uint256 _troveId,
        address _batchAddress,
        TroveChange memory _troveChange,
        uint256 _newTroveDebt, // entire, with interest, batch fee and redistribution
        uint256 _batchColl, // without trove change
        uint256 _batchDebt, // entire (with interest, batch fee), but without trove change, nor upfront fee nor redist
        bool _checkBatchSharesRatio // whether we do the check on the resulting ratio inside the func call
    ) internal {
        // Debt
        uint256 currentBatchDebtShares = batches[_batchAddress].totalDebtShares;
        uint256 batchDebtSharesDelta;
        uint256 debtIncrease =
            _troveChange.debtIncrease + _troveChange.upfrontFee + _troveChange.appliedRedistBoldDebtGain;
        uint256 debtDecrease;
        if (debtIncrease > _troveChange.debtDecrease) {
            debtIncrease -= _troveChange.debtDecrease;
        } else {
            debtDecrease = _troveChange.debtDecrease - debtIncrease;
            debtIncrease = 0;
        }

        if (debtIncrease == 0 && debtDecrease == 0) {
            batches[_batchAddress].debt = _batchDebt;
        } else {
            if (debtIncrease > 0) {
                // Add debt
                if (_batchDebt == 0) {
                    batchDebtSharesDelta = debtIncrease;
                } else {
                    // To avoid rebasing issues, let’s make sure the ratio debt / shares is not too high
                    _requireBelowMaxSharesRatio(currentBatchDebtShares, _batchDebt, _checkBatchSharesRatio);

                    batchDebtSharesDelta = currentBatchDebtShares * debtIncrease / _batchDebt;
                }

                Troves[_troveId].batchDebtShares += batchDebtSharesDelta;
                batches[_batchAddress].debt = _batchDebt + debtIncrease;
                batches[_batchAddress].totalDebtShares = currentBatchDebtShares + batchDebtSharesDelta;
            } else if (debtDecrease > 0) {
                // Subtract debt
                // We make sure that if final trove debt is zero, shares are too (avoiding rounding issues)
                // This can only happen from redemptions, as otherwise we would be using _removeTroveSharesFromBatch
                // In redemptions we don’t do that because we don’t want to kick the trove out of the batch (it’d be bad UX)
                if (_newTroveDebt == 0) {
                    batches[_batchAddress].debt = _batchDebt - debtDecrease;
                    batches[_batchAddress].totalDebtShares = currentBatchDebtShares - Troves[_troveId].batchDebtShares;
                    Troves[_troveId].batchDebtShares = 0;
                } else {
                    batchDebtSharesDelta = currentBatchDebtShares * debtDecrease / _batchDebt;

                    Troves[_troveId].batchDebtShares -= batchDebtSharesDelta;
                    batches[_batchAddress].debt = _batchDebt - debtDecrease;
                    batches[_batchAddress].totalDebtShares = currentBatchDebtShares - batchDebtSharesDelta;
                }
            }
        }
        // Update debt checkpoint
        batches[_batchAddress].lastDebtUpdateTime = uint64(block.timestamp);

        // Collateral
        uint256 collIncrease = _troveChange.collIncrease + _troveChange.appliedRedistCollGain;
        uint256 collDecrease;
        if (collIncrease > _troveChange.collDecrease) {
            collIncrease -= _troveChange.collDecrease;
        } else {
            collDecrease = _troveChange.collDecrease - collIncrease;
            collIncrease = 0;
        }

        if (collIncrease == 0 && collDecrease == 0) {
            batches[_batchAddress].coll = _batchColl;
        } else {
            if (collIncrease > 0) {
                // Add coll
                batches[_batchAddress].coll = _batchColl + collIncrease;
            } else if (collDecrease > 0) {
                // Subtract coll
                batches[_batchAddress].coll = _batchColl - collDecrease;
            }
        }
    }

    // For the debt / shares ratio to increase by a factor 1e9
    // at a average annual debt increase (compounded interest + fees) of 10%, it would take more than 217 years (log(1e9)/log(1.1))
    // at a average annual debt increase (compounded interest + fees) of 50%, it would take more than 51 years (log(1e9)/log(1.5))
    // When that happens, no more debt can be manually added to the batch, so batch should be migrated to a new one
    function _requireBelowMaxSharesRatio(
        uint256 _currentBatchDebtShares,
        uint256 _batchDebt,
        bool _checkBatchSharesRatio
    ) internal view {
        // debt / shares should be below MAX_BATCH_SHARES_RATIO
        if (_currentBatchDebtShares * MAX_BATCH_SHARES_RATIO < _batchDebt && _checkBatchSharesRatio) {
            revert BatchSharesRatioTooHigh();
        }
    }

    function onRemoveFromBatch(
        uint256 _troveId,
        uint256 _newTroveColl, // entire, with redistribution
        uint256 _newTroveDebt, // entire, with interest, batch fee and redistribution
        TroveChange memory _troveChange,
        address _batchAddress,
        uint256 _newBatchColl,
        uint256 _newBatchDebt, // entire, with interest and batch fee
        uint256 _newAnnualInterestRate
    ) external {
        _requireCallerIsBorrowerOperations();
        // assert(batchIds[batches[_batchAddress].arrayIndex] == _batchAddress);

        // Subtract from batch
        _removeTroveSharesFromBatch(
            _troveId, _newTroveColl, _newTroveDebt, _troveChange, _batchAddress, _newBatchColl, _newBatchDebt
        );

        // Restore Trove state
        Troves[_troveId].debt = _newTroveDebt;
        Troves[_troveId].coll = _newTroveColl;
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);
        Troves[_troveId].annualInterestRate = _newAnnualInterestRate;
        Troves[_troveId].lastInterestRateAdjTime = uint64(block.timestamp);

        _updateTroveRewardSnapshots(_troveId);
        _movePendingTroveRewardsToActivePool(
            defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistCollGain
        );

        emit TroveUpdated({
            _troveId: _troveId,
            _debt: _newTroveDebt,
            _coll: _newTroveColl,
            _stake: Troves[_troveId].stake,
            _annualInterestRate: _newAnnualInterestRate,
            _snapshotOfTotalCollRedist: L_coll,
            _snapshotOfTotalDebtRedist: L_boldDebt
        });

        emit TroveOperation({
            _troveId: _troveId,
            _operation: Operation.removeFromBatch,
            _annualInterestRate: _newAnnualInterestRate,
            _debtIncreaseFromRedist: _troveChange.appliedRedistBoldDebtGain,
            _debtIncreaseFromUpfrontFee: _troveChange.upfrontFee,
            _debtChangeFromOperation: 0,
            _collIncreaseFromRedist: _troveChange.appliedRedistCollGain,
            _collChangeFromOperation: 0
        });

        emit BatchUpdated({
            _interestBatchManager: _batchAddress,
            _operation: BatchOperation.exitBatch,
            _debt: batches[_batchAddress].debt,
            _coll: batches[_batchAddress].coll,
            _annualInterestRate: batches[_batchAddress].annualInterestRate,
            _annualManagementFee: batches[_batchAddress].annualManagementFee,
            _totalDebtShares: batches[_batchAddress].totalDebtShares,
            // Although the Trove leaving the batch may pay an upfront fee,
            // it is an individual fee, so we don't include it here
            _debtIncreaseFromUpfrontFee: 0
        });
    }

    function _removeTroveSharesFromBatch(
        uint256 _troveId,
        uint256 _newTroveColl, // entire, with redistribution
        uint256 _newTroveDebt, // entire, with interest, batch fee and redistribution
        TroveChange memory _troveChange,
        address _batchAddress,
        uint256 _newBatchColl, // without trove change
        uint256 _newBatchDebt // entire (with interest and batch fee), but without trove change
    ) internal {
        // As we are removing:
        // assert(_newBatchDebt > 0 || _newBatchColl > 0);

        Trove memory trove = Troves[_troveId];

        // We don’t need to increase the shares corresponding to redistribution first, because they would be subtracted immediately after
        // We don’t need to account for interest nor batch fee because it’s proportional to debt shares
        uint256 batchDebtDecrease = _newTroveDebt - _troveChange.upfrontFee - _troveChange.appliedRedistBoldDebtGain;
        uint256 batchCollDecrease = _newTroveColl - _troveChange.appliedRedistCollGain;

        batches[_batchAddress].totalDebtShares -= trove.batchDebtShares;
        batches[_batchAddress].debt = _newBatchDebt - batchDebtDecrease;
        batches[_batchAddress].coll = _newBatchColl - batchCollDecrease;
        batches[_batchAddress].lastDebtUpdateTime = uint64(block.timestamp);

        Troves[_troveId].interestBatchManager = address(0);
        Troves[_troveId].batchDebtShares = 0;
    }
}
