// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICollSurplusPool.sol";
import "./Interfaces/IBoldToken.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/ITroveEvents.sol";
import "./Dependencies/LiquityBase.sol";
import "./Dependencies/Ownable.sol";

// import "forge-std/console2.sol";

contract TroveManager is ERC721, LiquityBase, Ownable, ITroveManager, ITroveEvents {
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

    // Minimum collateral ratio for individual troves
    uint256 public immutable MCR;
    // Liquidation penalty for troves offset to the SP
    uint256 public immutable LIQUIDATION_PENALTY_SP;
    // Liquidation penalty for troves redistributed
    uint256 public immutable LIQUIDATION_PENALTY_REDISTRIBUTION;

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
    // TODO: optimize this struct packing for gas reduction, which may break v1 tests that assume a certain order of properties

    mapping(uint256 => Trove) public Troves;

    // Store the necessary data for an interest batch manager. We treat each batch as a “big trove”.
    // Each trove has a share of the debt and a share of the coll of the global batch (will in general be different, as CRs are different).
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

    mapping(address => Batch) public batches;

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

    // Map active troves to their RewardSnapshot
    mapping(uint256 => RewardSnapshot) public rewardSnapshots;

    // Object containing the ETH and Bold snapshots for a given active trove
    struct RewardSnapshot {
        uint256 ETH;
        uint256 boldDebt;
    }

    // Array of all active trove addresses - used to compute an approximate hint off-chain, for the sorted list insertion
    uint256[] public TroveIds;
    // Array of all batch managers - used to fetch them off-chain
    address[] public batchIds;

    // Error trackers for the trove redistribution calculation
    uint256 public lastETHError_Redistribution;
    uint256 public lastBoldDebtError_Redistribution;

    /*
    * --- Variable container structs for liquidations ---
    *
    * These structs are used to hold, return and assign variables inside the liquidation functions,
    * in order to avoid the error: "CompilerError: Stack too deep".
    **/

    struct LocalVariables_LiquidationSequence {
        uint256 remainingBoldInStabPool;
        uint256 i;
        uint256 ICR;
        uint256 troveId;
        uint256 entireSystemDebt;
        uint256 entireSystemColl;
    }

    struct LiquidationValues {
        LatestTroveData trove;
        uint256 collGasCompensation;
        uint256 debtToOffset;
        uint256 collToSendToSP;
        uint256 debtToRedistribute;
        uint256 collToRedistribute;
        uint256 collSurplus;
        uint256 oldWeightedRecordedDebt;
        uint256 newWeightedRecordedDebt;
        LatestBatchData  batch;
    }

    struct LiquidationTotals {
        TroveChange troveChange;
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
        TroveChange troveChange;
        uint256 ETHFee;
    }

    struct SingleRedemptionValues {
        uint256 troveId;
        address batchAddress;
        uint256 BoldLot;
        uint256 ETHLot;
        uint256 ETHFee;
        uint256 appliedRedistBoldDebtGain;
        uint256 oldWeightedRecordedDebt;
        uint256 newWeightedRecordedDebt;
        uint256 newStake;
        LatestTroveData trove;
        LatestBatchData batch;
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

    constructor(uint256 _mcr, uint256 _liquidationPenaltySP, uint256 _liquidationPenaltyRedistribution)
        ERC721(NAME, SYMBOL)
    {
        require(_mcr > 1e18 && _mcr < 2e18, "Invalid MCR");
        require(_liquidationPenaltySP >= 5e16, "SP penalty too low");
        require(_liquidationPenaltySP <= _liquidationPenaltyRedistribution, "SP penalty cannot be > redist");
        require(_liquidationPenaltyRedistribution <= 10e16, "Redistribution penalty too high");

        MCR = _mcr;
        LIQUIDATION_PENALTY_SP = _liquidationPenaltySP;
        LIQUIDATION_PENALTY_REDISTRIBUTION = _liquidationPenaltyRedistribution;
    }

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

    // Liquidate one trove
    function _liquidate(
        IDefaultPool _defaultPool,
        uint256 _troveId,
        uint256 _boldInStabPool,
        uint256 _price,
        LiquidationValues memory singleLiquidation
    ) internal {
        address owner = ownerOf(_troveId);

        _getLatestTroveData(_troveId, singleLiquidation.trove);
        // TODO: gas: we are calling _getLatestBatchData twice
        address batchAddress = _getBatchManager(_troveId);
        bool isTroveInBatch = batchAddress != address(0);
        if (isTroveInBatch) _getLatestBatchData(batchAddress, singleLiquidation.batch);

        _movePendingTroveRewardsToActivePool(
            _defaultPool, singleLiquidation.trove.redistBoldDebtGain, singleLiquidation.trove.redistETHGain
        );

        singleLiquidation.collGasCompensation = _getCollGasCompensation(singleLiquidation.trove.entireColl);
        uint256 collToLiquidate = singleLiquidation.trove.entireColl - singleLiquidation.collGasCompensation;

        (
            singleLiquidation.debtToOffset,
            singleLiquidation.collToSendToSP,
            singleLiquidation.debtToRedistribute,
            singleLiquidation.collToRedistribute,
            singleLiquidation.collSurplus
        ) = _getOffsetAndRedistributionVals(
            singleLiquidation.trove.entireDebt, collToLiquidate, _boldInStabPool, _price
        );

        TroveChange memory troveChange;
        troveChange.collDecrease = singleLiquidation.trove.entireColl;
        troveChange.debtDecrease = singleLiquidation.trove.entireDebt;
        troveChange.appliedRedistETHGain = singleLiquidation.trove.redistETHGain;
        troveChange.appliedRedistBoldDebtGain = singleLiquidation.trove.redistBoldDebtGain;
        _closeTrove(
            _troveId,
            troveChange,
            batchAddress,
            singleLiquidation.batch.entireColl,
            singleLiquidation.batch.entireDebt,
            Status.closedByLiquidation
        );

        if (isTroveInBatch) {
            singleLiquidation.oldWeightedRecordedDebt = singleLiquidation.batch.weightedRecordedDebt + (singleLiquidation.trove.entireDebt - singleLiquidation.trove.redistBoldDebtGain) * singleLiquidation.batch.annualInterestRate;
            singleLiquidation.newWeightedRecordedDebt = singleLiquidation.batch.entireDebt * singleLiquidation.batch.annualInterestRate;
            // Mint batch management fee
            troveChange.batchAccruedManagementFee = singleLiquidation.batch.accruedManagementFee;
            troveChange.oldWeightedRecordedBatchManagementFee = singleLiquidation.batch.weightedRecordedBatchManagementFee + (singleLiquidation.trove.entireDebt - singleLiquidation.trove.redistBoldDebtGain) * singleLiquidation.batch.annualManagementFee;
            troveChange.newWeightedRecordedBatchManagementFee = singleLiquidation.batch.entireDebt * singleLiquidation.batch.annualManagementFee;
            activePool.mintBatchManagementFeeAndAccountForChange(troveChange, batchAddress);
        } else {
            singleLiquidation.oldWeightedRecordedDebt = singleLiquidation.trove.weightedRecordedDebt;
        }

        // Differencen between liquidation penalty and liquidation threshold
        if (singleLiquidation.collSurplus > 0) {
            collSurplusPool.accountSurplus(owner, singleLiquidation.collSurplus);
        }

        emit TroveUpdated(
            _troveId,
            0, // _debt
            0, // _coll
            0, // _stake
            0, // _annualInterestRate
            0, // _snapshotOfTotalDebtRedist
            0 // _snapshotOfTotalCollRedist
        );

        emit TroveOperation(
            _troveId,
            Operation.liquidate,
            0, // _annualInterestRate
            singleLiquidation.trove.redistBoldDebtGain,
            0, // _debtIncreaseFromUpfrontFee
            -int256(singleLiquidation.trove.entireDebt),
            singleLiquidation.trove.redistETHGain,
            -int256(singleLiquidation.trove.entireColl)
        );
    }

    /* In a full liquidation, returns the values for a trove's coll and debt to be offset, and coll and debt to be
    * redistributed to active troves.
    */
    function _getOffsetAndRedistributionVals(
        uint256 _entireTroveDebt,
        uint256 _collToLiquidate, // gas compensation is already subtracted
        uint256 _boldInStabPool,
        uint256 _price
    )
        internal
        view
        returns (
            uint256 debtToOffset,
            uint256 collToSendToSP,
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
        if (_boldInStabPool > 0) {
            debtToOffset = LiquityMath._min(_entireTroveDebt, _boldInStabPool);
            collSPPortion = _collToLiquidate * debtToOffset / _entireTroveDebt;
            (collToSendToSP, collSurplus) =
                _getCollPenaltyAndSurplus(collSPPortion, debtToOffset, LIQUIDATION_PENALTY_SP, _price);
        }
        // TODO: this fails if debt in gwei is less than price (rounding coll to zero)
        //assert(debtToOffset == 0 || collToSendToSP > 0);

        // Redistribution
        debtToRedistribute = _entireTroveDebt - debtToOffset;
        if (debtToRedistribute > 0) {
            uint256 collRedistributionPortion = _collToLiquidate - collSPPortion;
            if (collRedistributionPortion > 0) {
                (collToRedistribute, collSurplus) = _getCollPenaltyAndSurplus(
                    collRedistributionPortion + collSurplus, // Coll surplus from offset can be eaten up by red. penalty
                    debtToRedistribute,
                    LIQUIDATION_PENALTY_REDISTRIBUTION, // _penaltyRatio
                    _price
                );
            }
        }
        assert(_collToLiquidate == collToSendToSP + collToRedistribute + collSurplus);
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
        require(_troveArray.length != 0, "TroveManager: Calldata address array must not be empty");

        IActivePool activePoolCached = activePool;
        IDefaultPool defaultPoolCached = defaultPool;
        IStabilityPool stabilityPoolCached = stabilityPool;

        LiquidationTotals memory totals;

        uint256 price = priceFeed.fetchPrice();
        uint256 boldInStabPool = stabilityPoolCached.getTotalBoldDeposits();

        // Perform the appropriate liquidation sequence - tally values and obtain their totals.
        _batchLiquidateTroves(defaultPoolCached, price, boldInStabPool, _troveArray, totals);

        require(totals.troveChange.debtDecrease > 0, "TroveManager: nothing to liquidate");

        activePool.mintAggInterestAndAccountForTroveChange(totals.troveChange, address(0));

        // Move liquidated ETH and Bold to the appropriate pools
        if (totals.totalDebtToOffset > 0 || totals.totalCollToSendToSP > 0) {
            stabilityPoolCached.offset(totals.totalDebtToOffset, totals.totalCollToSendToSP);
        }
        // we check amount is not zero inside
        _redistributeDebtAndColl(
            activePoolCached, defaultPoolCached, totals.totalDebtToRedistribute, totals.totalCollToRedistribute
        );
        if (totals.totalCollSurplus > 0) {
            activePoolCached.sendETH(address(collSurplusPool), totals.totalCollSurplus);
        }

        // Update system snapshots
        _updateSystemSnapshots_excludeCollRemainder(activePoolCached, totals.totalCollGasCompensation);

        emit Liquidation(
            totals.totalDebtToOffset,
            totals.totalDebtToRedistribute,
            totals.totalBoldGasCompensation,
            totals.totalCollGasCompensation,
            totals.totalCollToSendToSP,
            totals.totalCollToRedistribute,
            totals.totalCollSurplus,
            L_ETH,
            L_boldDebt,
            price
        );

        // Send gas compensation to caller
        _sendGasCompensation(
            activePoolCached, msg.sender, totals.totalBoldGasCompensation, totals.totalCollGasCompensation
        );
    }

    function _isLiquidatableStatus(Status _status) internal pure returns (bool) {
        return _status == Status.active || _status == Status.unredeemable;
    }

    function _batchLiquidateTroves(
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

                _liquidate(_defaultPool, vars.troveId, vars.remainingBoldInStabPool, _price, singleLiquidation);
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
        totals.totalBoldGasCompensation += BOLD_GAS_COMPENSATION;
        totals.troveChange.debtDecrease += singleLiquidation.trove.entireDebt;
        totals.troveChange.collDecrease += singleLiquidation.trove.entireColl;
        totals.troveChange.appliedRedistBoldDebtGain += singleLiquidation.trove.redistBoldDebtGain;
        totals.troveChange.oldWeightedRecordedDebt += singleLiquidation.oldWeightedRecordedDebt;
        totals.troveChange.newWeightedRecordedDebt += singleLiquidation.newWeightedRecordedDebt;
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
        SingleRedemptionValues memory singleRedemption,
        uint256 _maxBoldamount,
        uint256 _price,
        uint256 _redemptionRate
    ) internal {
        _getLatestTroveData(singleRedemption.troveId, singleRedemption.trove);

        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the Trove minus the liquidation reserve
        singleRedemption.BoldLot = LiquityMath._min(_maxBoldamount, singleRedemption.trove.entireDebt - BOLD_GAS_COMPENSATION);

        // Get the amount of ETH equal in USD value to the BoldLot redeemed
        uint256 correspondingETH = singleRedemption.BoldLot * DECIMAL_PRECISION / _price;
        // Calculate the ETHFee separately (for events)
        singleRedemption.ETHFee = correspondingETH * _redemptionRate / DECIMAL_PRECISION;
        // Get the final ETHLot to send to redeemer, leaving the fee in the Trove
        singleRedemption.ETHLot = correspondingETH - singleRedemption.ETHFee;

        // Decrease the debt and collateral of the current Trove according to the Bold lot and corresponding ETH to send
        uint256 newDebt = singleRedemption.trove.entireDebt - singleRedemption.BoldLot;
        uint256 newColl = singleRedemption.trove.entireColl - singleRedemption.ETHLot;

        singleRedemption.appliedRedistBoldDebtGain = singleRedemption.trove.redistBoldDebtGain;

        bool isTroveInBatch = singleRedemption.batchAddress != address(0);
        if (newDebt < MIN_DEBT) {
            Troves[singleRedemption.troveId].status = Status.unredeemable;
            if (isTroveInBatch) {
                sortedTroves.removeFromBatch(singleRedemption.troveId);
            } else {
                sortedTroves.remove(singleRedemption.troveId);
            }
            // TODO: should we also remove from the Troves array? Seems unneccessary as it's only used for off-chain hints.
            // We save borrowers gas by not removing
        }

        if (isTroveInBatch) {
            _getLatestBatchData(singleRedemption.batchAddress, singleRedemption.batch);
            singleRedemption.oldWeightedRecordedDebt = singleRedemption.batch.weightedRecordedDebt + singleRedemption.BoldLot * singleRedemption.batch.annualInterestRate;
            singleRedemption.newWeightedRecordedDebt = singleRedemption.batch.entireDebt * singleRedemption.batch.annualInterestRate;

            TroveChange memory troveChange;
            troveChange.debtDecrease = singleRedemption.BoldLot;
            troveChange.collDecrease = singleRedemption.ETHLot;
            troveChange.appliedRedistBoldDebtGain = singleRedemption.trove.redistBoldDebtGain;
            troveChange.appliedRedistETHGain = singleRedemption.trove.redistETHGain;
            // batchAccruedManagementFee is handled in the outer function
            troveChange.oldWeightedRecordedBatchManagementFee = singleRedemption.batch.weightedRecordedBatchManagementFee + singleRedemption.BoldLot * singleRedemption.batch.annualManagementFee;
            troveChange.newWeightedRecordedBatchManagementFee = singleRedemption.batch.entireDebt * singleRedemption.batch.annualManagementFee;

            // TODO: optimize: as redemptions are consecutive inside a batch, we can do this in the outer loop, only once per batch
            activePool.mintBatchManagementFeeAndAccountForChange(troveChange, singleRedemption.batchAddress);

            // interest and fee were updated in the outer function
            _updateBatchShares(
                singleRedemption.troveId, singleRedemption.batchAddress, troveChange, singleRedemption.batch.entireColl, singleRedemption.batch.entireDebt
            );
        } else {
            singleRedemption.oldWeightedRecordedDebt = singleRedemption.trove.weightedRecordedDebt;
            singleRedemption.newWeightedRecordedDebt = newDebt * singleRedemption.trove.annualInterestRate;
            Troves[singleRedemption.troveId].debt = newDebt;
            Troves[singleRedemption.troveId].coll = newColl;
            Troves[singleRedemption.troveId].lastDebtUpdateTime = uint64(block.timestamp);
        }

        // TODO: Gas optimize? We update totalStakes N times for a sequence of N Troves(!).
        singleRedemption.newStake = _updateStakeAndTotalStakes(singleRedemption.troveId, newColl);
        // TODO: Gas optimize? We move pending rewards N times for a sequence of N Troves(!).
        _movePendingTroveRewardsToActivePool(_contractsCache.defaultPool, singleRedemption.trove.redistBoldDebtGain, singleRedemption.trove.redistETHGain);
        _updateTroveRewardSnapshots(singleRedemption.troveId);

        emit TroveUpdated(singleRedemption.troveId, newDebt, newColl, singleRedemption.newStake, singleRedemption.trove.annualInterestRate, L_ETH, L_boldDebt);

        emit TroveOperation(
            singleRedemption.troveId,
            Operation.redeemCollateral,
            singleRedemption.trove.annualInterestRate,
            singleRedemption.trove.redistBoldDebtGain,
            0, // _debtIncreaseFromUpfrontFee
            -int256(singleRedemption.BoldLot),
            singleRedemption.trove.redistETHGain,
            -int256(singleRedemption.ETHLot)
        );

        emit RedemptionFeePaidToTrove(singleRedemption.troveId, singleRedemption.ETHFee);
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

        uint256 remainingBold = _boldamount;

        SingleRedemptionValues memory singleRedemption;
        singleRedemption.troveId = contractsCache.sortedTroves.getLast();
        address lastBatchUpdatedInterest = address(0);

        // Loop through the Troves starting from the one with lowest collateral ratio until _amount of Bold is exchanged for collateral
        if (_maxIterations == 0) _maxIterations = type(uint256).max;
        while (singleRedemption.troveId != 0 && remainingBold > 0 && _maxIterations > 0) {
            _maxIterations--;
            // Save the uint256 of the Trove preceding the current one
            uint256 nextUserToCheck = contractsCache.sortedTroves.getPrev(singleRedemption.troveId);
            // Skip if ICR < 100%, to make sure that redemptions always improve the CR of hit Troves
            if (getCurrentICR(singleRedemption.troveId, _price) < _100pct) {
                singleRedemption.troveId = nextUserToCheck;
                continue;
            }

            // If it’s in a batch, we need to update interest first
            // We do it here outside, to avoid repeating for each trove in the same batch
            singleRedemption.batchAddress = _getBatchManager(singleRedemption.troveId);
            if (
                singleRedemption.batchAddress != address(0) && singleRedemption.batchAddress != lastBatchUpdatedInterest
            ) {
                LatestBatchData memory batch;
                _getLatestBatchData(singleRedemption.batchAddress, batch);
                batches[singleRedemption.batchAddress].debt = batch.entireDebt;
                batches[singleRedemption.batchAddress].lastDebtUpdateTime = uint64(block.timestamp);
                lastBatchUpdatedInterest = singleRedemption.batchAddress;
                // As we are updating the batch, we update the ActivePool weighted sum too
                TroveChange memory batchTroveChange;
                batchTroveChange.oldWeightedRecordedDebt = batch.weightedRecordedDebt;
                batchTroveChange.newWeightedRecordedDebt = batch.entireDebt * batch.annualInterestRate;
                batchTroveChange.batchAccruedManagementFee = batch.accruedManagementFee;
                batchTroveChange.oldWeightedRecordedBatchManagementFee = batch.weightedRecordedBatchManagementFee;
                batchTroveChange.newWeightedRecordedBatchManagementFee = batch.entireDebt * batch.annualManagementFee;

                activePool.mintAggInterestAndAccountForTroveChange(batchTroveChange, singleRedemption.batchAddress);
            }

            _redeemCollateralFromTrove(contractsCache, singleRedemption, remainingBold, _price, _redemptionRate);

            totals.troveChange.collDecrease += singleRedemption.ETHLot;
            totals.troveChange.debtDecrease += singleRedemption.BoldLot;
            totals.troveChange.appliedRedistBoldDebtGain += singleRedemption.appliedRedistBoldDebtGain;
            // For recorded and weighted recorded debt totals, we need to capture the increases and decreases,
            // since the net debt change for a given Trove could be positive or negative: redemptions decrease a Trove's recorded
            // (and weighted recorded) debt, but the accrued interest increases it.
            totals.troveChange.newWeightedRecordedDebt += singleRedemption.newWeightedRecordedDebt;
            totals.troveChange.oldWeightedRecordedDebt += singleRedemption.oldWeightedRecordedDebt;
            totals.ETHFee += singleRedemption.ETHFee;

            remainingBold -= singleRedemption.BoldLot;
            singleRedemption.troveId = nextUserToCheck;
        }

        // We are removing this condition to prevent blocking redemptions
        //require(totals.totalETHDrawn > 0, "TroveManager: Unable to redeem any amount");

        emit Redemption(
            _boldamount, totals.troveChange.debtDecrease, totals.troveChange.collDecrease, totals.ETHFee, _price
        );

        // TODO: batch fee
        activePool.mintAggInterestAndAccountForTroveChange(totals.troveChange, address(0));

        // Send the redeemed ETH to sender
        contractsCache.activePool.sendETH(_sender, totals.troveChange.collDecrease);
        // We’ll burn all the Bold together out in the CollateralRegistry, to save gas

        return totals.troveChange.debtDecrease;
    }

    // --- Helper functions ---

    // Return the current collateral ratio (ICR) of a given Trove. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getCurrentICR(uint256 _troveId, uint256 _price) public view override returns (uint256) {
        LatestTroveData memory trove;
        _getLatestTroveData(_troveId, trove);
        return LiquityMath._computeCR(trove.entireColl, trove.entireDebt, _price);
    }

    function _updateTroveRewardSnapshots(uint256 _troveId) internal {
        rewardSnapshots[_troveId].ETH = L_ETH;
        rewardSnapshots[_troveId].boldDebt = L_boldDebt;
    }

    // Get the borrower's pending accumulated ETH reward, earned by their stake
    function getPendingETHReward(uint256 _troveId) external view override returns (uint256 redistETHGain) {
        LatestTroveData memory trove;
        _getLatestTroveData(_troveId, trove);
        return trove.redistETHGain;
    }

    // Get the borrower's pending accumulated Bold reward, earned by their stake
    function getPendingBoldDebtReward(uint256 _troveId) external view override returns (uint256 redistBoldDebtGain) {
        LatestTroveData memory trove;
        _getLatestTroveData(_troveId, trove);
        return trove.redistBoldDebtGain;
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
    function _getLatestTroveData(uint256 _troveId, LatestTroveData memory trove) internal view {
        // If trove belongs to a batch, we fetch the batch and apply its share to obtained values
        address batchAddress = _getBatchManager(_troveId);
        if (batchAddress != address(0)) {
            LatestBatchData memory batch;
            _getLatestBatchData(batchAddress, batch);
            _getLatestTroveDataFromBatch(_troveId, batchAddress, trove, batch);
            return;
        }

        uint256 stake = Troves[_troveId].stake;
        trove.redistBoldDebtGain = stake * (L_boldDebt - rewardSnapshots[_troveId].boldDebt) / DECIMAL_PRECISION;
        trove.redistETHGain = stake * (L_ETH - rewardSnapshots[_troveId].ETH) / DECIMAL_PRECISION;

        trove.recordedDebt = Troves[_troveId].debt;
        trove.annualInterestRate = Troves[_troveId].annualInterestRate;
        trove.weightedRecordedDebt = trove.recordedDebt * trove.annualInterestRate;
        trove.accruedInterest =
            _calcInterest(trove.weightedRecordedDebt, block.timestamp - Troves[_troveId].lastDebtUpdateTime);

        trove.entireDebt = trove.recordedDebt + trove.redistBoldDebtGain + trove.accruedInterest;
        trove.entireColl = Troves[_troveId].coll + trove.redistETHGain;
        trove.lastInterestRateAdjTime = Troves[_troveId].lastInterestRateAdjTime;
    }

    function _getLatestTroveDataFromBatch(
        uint256 _troveId,
        address _batchAddress,
        LatestTroveData memory _latestTroveData,
        LatestBatchData memory _latestBatchData
    ) internal view {
        Trove memory trove = Troves[_troveId];
        Batch memory batch = batches[_batchAddress];
        uint256 batchDebtShares = trove.batchDebtShares;
        uint256 totalDebtShares = batch.totalDebtShares;

        uint256 stake = trove.stake;
        //uint256 batchRedistBoldDebtGain = stake * (L_boldDebt - rewardBatchSnapshots[_batchAddress].boldDebt) / DECIMAL_PRECISION;
        _latestTroveData.redistBoldDebtGain =
            stake * (L_boldDebt - rewardSnapshots[_troveId].boldDebt) / DECIMAL_PRECISION;
        _latestTroveData.redistETHGain = stake * (L_ETH - rewardSnapshots[_troveId].ETH) / DECIMAL_PRECISION;

        _latestTroveData.recordedDebt = _latestBatchData.recordedDebt * batchDebtShares / totalDebtShares;
        _latestTroveData.annualInterestRate = _latestBatchData.annualInterestRate;
        _latestTroveData.weightedRecordedDebt =
            _latestBatchData.weightedRecordedDebt * batchDebtShares / totalDebtShares;
        _latestTroveData.accruedInterest = _latestBatchData.accruedInterest * batchDebtShares / totalDebtShares;
        _latestTroveData.accruedBatchManagementFee = _latestBatchData.accruedManagementFee * batchDebtShares / totalDebtShares;

        // We can’t do pro-rata batch entireDebt, because redist gains are proportional to coll, not to debt
        _latestTroveData.entireDebt = _latestTroveData.recordedDebt + _latestTroveData.redistBoldDebtGain
            + _latestTroveData.accruedInterest + _latestTroveData.accruedBatchManagementFee;
        _latestTroveData.entireColl = trove.coll + _latestTroveData.redistETHGain;
        _latestTroveData.lastInterestRateAdjTime = LiquityMath._max(_latestBatchData.lastInterestRateAdjTime, trove.lastInterestRateAdjTime);
    }

    function getLatestTroveData(uint256 _troveId) external view returns (LatestTroveData memory trove) {
        _getLatestTroveData(_troveId, trove);
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
        LatestTroveData memory trove;
        _getLatestTroveData(_troveId, trove);

        return
            (trove.entireDebt, trove.entireColl, trove.redistBoldDebtGain, trove.redistETHGain, trove.accruedInterest);
    }

    function getTroveEntireDebt(uint256 _troveId) public view returns (uint256) {
        LatestTroveData memory trove;
        _getLatestTroveData(_troveId, trove);
        return trove.entireDebt;
    }

    function getTroveEntireColl(uint256 _troveId) external view returns (uint256) {
        LatestTroveData memory trove;
        _getLatestTroveData(_troveId, trove);
        return trove.entireColl;
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

        latestBatchData.recordedDebt = batch.debt;
        latestBatchData.annualInterestRate = batch.annualInterestRate;
        latestBatchData.weightedRecordedDebt = latestBatchData.recordedDebt * latestBatchData.annualInterestRate;
        uint256 timeSinceLastUpdate = block.timestamp - batch.lastDebtUpdateTime;
        latestBatchData.accruedInterest = _calcInterest(latestBatchData.weightedRecordedDebt, timeSinceLastUpdate);
        latestBatchData.annualManagementFee = batch.annualManagementFee;
        latestBatchData.accruedManagementFee =
            _calcInterest(latestBatchData.recordedDebt * latestBatchData.annualManagementFee, timeSinceLastUpdate);
        latestBatchData.weightedRecordedBatchManagementFee = latestBatchData.recordedDebt * latestBatchData.annualManagementFee;

        latestBatchData.entireDebt =
            latestBatchData.recordedDebt + latestBatchData.accruedInterest + latestBatchData.accruedManagementFee;
        latestBatchData.entireColl = batch.coll;
        latestBatchData.lastDebtUpdateTime = batch.lastDebtUpdateTime;
        latestBatchData.lastInterestRateAdjTime = batch.lastInterestRateAdjTime;
    }

    function getLatestBatchData(address _batchAddress) external view returns (LatestBatchData memory batch) {
        _getLatestBatchData(_batchAddress, batch);
    }

    function getBatchAnnualInterestRate(address _batchAddress) external view returns (uint256) {
        return batches[_batchAddress].annualInterestRate;
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

        _defaultPool.increaseBoldDebt(_debtToRedistribute);
        _activePool.sendETHToDefaultPool(_collToRedistribute);
    }

    function onCloseTrove(
        uint256 _troveId,
        TroveChange memory _troveChange, // decrease vars: entire, with interest, batch fee and redistribution
        address _batchAddress,
        uint256 _newBatchColl,
        uint256 _newBatchDebt // entire, with interest and batch fee
    ) external override {
        _requireCallerIsBorrowerOperations();
        _closeTrove(
            _troveId,
            _troveChange,
            _batchAddress,
            _newBatchColl,
            _newBatchDebt,
            Status.closedByOwner
        );
        _movePendingTroveRewardsToActivePool(
            defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistETHGain
        );

        emit TroveUpdated(
            _troveId,
            0, // _debt
            0, // _coll
            0, // _stake
            0, // _annualInterestRate
            0, // _snapshotOfTotalDebtRedist
            0 // _snapshotOfTotalCollRedist
        );

        emit TroveOperation(
            _troveId,
            Operation.closeTrove,
            0, // _annualInterestRate
            _troveChange.appliedRedistBoldDebtGain,
            _troveChange.upfrontFee,
            int256(_troveChange.debtIncrease) - int256(_troveChange.debtDecrease),
            _troveChange.appliedRedistETHGain,
            int256(_troveChange.collIncrease) - int256(_troveChange.collDecrease)
        );
    }

    function _closeTrove(
        uint256 _troveId,
        TroveChange memory _troveChange, // decrease vars: entire, with interest, batch fee and redistribution
        address _batchAddress,
        uint256 _newBatchColl,
        uint256 _newBatchDebt, // entire, with interest and batch fee
        Status closedStatus
    ) internal {
        assert(closedStatus == Status.closedByLiquidation || closedStatus == Status.closedByOwner);

        uint256 TroveIdsArrayLength = TroveIds.length;
        _requireMoreThanOneTroveInSystem(TroveIdsArrayLength);

        _removeTroveId(_troveId, TroveIdsArrayLength);

        Trove memory trove = Troves[_troveId];

        // If trove belongs to a batch, remove from it
        if (_batchAddress != address(0)) {
            if (trove.status == Status.active) {
                sortedTroves.removeFromBatch(_troveId);
            }

            _removeTroveSharesFromBatch(_troveId, _troveChange.collDecrease, _troveChange.debtDecrease, _troveChange, _batchAddress, _newBatchColl, _newBatchDebt);
        } else {
            if (trove.status == Status.active) {
                sortedTroves.remove(_troveId);
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
    }

    /*
    * Remove a Trove owner from the TroveIds array, not preserving array order. Removing owner 'B' does the following:
    * [A B C D E] => [A E C D], and updates E's Trove struct to point to its new array index.
    */
    function _removeTroveId(uint256 _troveId, uint256 TroveIdsArrayLength) internal {
        uint64 index = Troves[_troveId].arrayIndex;
        uint256 idxLast = TroveIdsArrayLength - 1;

        assert(index <= idxLast);

        uint256 idToMove = TroveIds[idxLast];

        TroveIds[index] = idToMove;
        Troves[idToMove].arrayIndex = index;

        TroveIds.pop();
    }

    // --- TCR functions ---

    function getTCR(uint256 _price) external view override returns (uint256) {
        return _getTCR(_price);
    }

    function checkBelowCriticalThreshold(uint256 _price) external view override returns (bool) {
        return _checkBelowCriticalThreshold(_price);
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

    // --- Interest rate calculations ---

    // TODO: analyze precision loss in interest functions and decide upon the minimum granularity
    // (per-second, per-block, etc)
    function calcTroveAccruedInterest(uint256 _troveId) external view returns (uint256) {
        Trove memory trove = Troves[_troveId];

        // If trove belongs to a batch, we fetch the batch and apply its share to obtained values
        address batchAddress = _getBatchManager(_troveId);
        if (batchAddress != address(0)) {
            uint256 batchAccruedInterest = calcBatchAccruedInterest(batchAddress);
            return batchAccruedInterest * trove.batchDebtShares / batches[batchAddress].totalDebtShares;
        }

        uint256 recordedDebt = trove.debt;
        // convert annual interest to per-second and multiply by the principal
        uint256 annualInterestRate = trove.annualInterestRate;
        uint256 lastDebtUpdateTime = trove.lastDebtUpdateTime;

        return _calcInterest(recordedDebt * annualInterestRate, block.timestamp - lastDebtUpdateTime);
    }

    function calcBatchAccruedInterest(address _batchAddress) public view returns (uint256) {
        Batch memory batch = batches[_batchAddress];
        uint256 recordedDebt = batch.debt;
        // convert annual interest to per-second and multiply by the principal
        uint256 annualInterestRate = batch.annualInterestRate;
        uint256 lastDebtUpdateTime = batch.lastDebtUpdateTime;

        return _calcInterest(recordedDebt * annualInterestRate, block.timestamp - lastDebtUpdateTime);
    }

    function calcTroveAccruedBatchManagementFee(uint256 _troveId) external view returns (uint256) {
        Trove memory trove = Troves[_troveId];

        // If trove doesn’t belong to a batch, there’s no fee
        address batchAddress = _getBatchManager(_troveId);
        if (batchAddress == address(0)) return 0;

        // If trove belongs to a batch, we fetch the batch and apply its share to obtained values
        uint256 batchAccruedManagementFee = calcBatchAccruedManagementFee(batchAddress);
        return batchAccruedManagementFee * trove.batchDebtShares / batches[batchAddress].totalDebtShares;
    }

    function calcBatchAccruedManagementFee(address _batchAddress) public view returns (uint256) {
        Batch memory batch = batches[_batchAddress];
        // convert annual interest to per-second and multiply by the principal
        return _calcInterest(batch.debt * batch.annualManagementFee, block.timestamp - batch.lastDebtUpdateTime);
    }

    // --- 'require' wrapper functions ---

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "TroveManager: Caller is not the BorrowerOperations contract");
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

    function getTroveStatus(uint256 _troveId) external view override returns (Status) {
        return Troves[_troveId].status;
    }

    function getTroveStake(uint256 _troveId) external view override returns (uint256) {
        return Troves[_troveId].stake;
    }

    function getTroveDebt(uint256 _troveId) external view override returns (uint256) {
        Trove memory trove = Troves[_troveId];
        address batchAddress = _getBatchManager(trove);
        if (batchAddress != address(0)) {
            Batch memory batch = batches[batchAddress];
            return batch.debt * trove.batchDebtShares / batch.totalDebtShares;
        }
        return trove.debt;
    }

    function getTroveWeightedRecordedDebt(uint256 _troveId) public view returns (uint256) {
        Trove memory trove = Troves[_troveId];
        address batchAddress = _getBatchManager(trove);
        if (batchAddress != address(0)) {
            Batch memory batch = batches[batchAddress];
            return batch.debt * trove.batchDebtShares / batch.totalDebtShares * batch.annualInterestRate;
        }
        return trove.debt * trove.annualInterestRate;
    }

    function getTroveColl(uint256 _troveId) external view override returns (uint256) {
        Trove memory trove = Troves[_troveId];
        return trove.coll;
    }

    function getTroveAnnualInterestRate(uint256 _troveId) external view returns (uint256) {
        Trove memory trove = Troves[_troveId];
        address batchAddress = _getBatchManager(trove);
        if (batchAddress != address(0)) {
            return batches[batchAddress].annualInterestRate;
        }
        return trove.annualInterestRate;
    }

    function getTroveLastDebtUpdateTime(uint256 _troveId) external view returns (uint256) {
        Trove memory trove = Troves[_troveId];
        address batchAddress = _getBatchManager(trove);
        if (batchAddress != address(0)) {
            return batches[batchAddress].lastDebtUpdateTime;
        }
        return trove.lastDebtUpdateTime;
    }

    function getBatchLastDebtUpdateTime(address _batchAddress) external view returns (uint256) {
        return batches[_batchAddress].lastDebtUpdateTime;
    }

    function troveIsStale(uint256 _troveId) external view returns (bool) {
        Trove memory trove = Troves[_troveId];
        address batchAddress = _getBatchManager(trove);
        if (batchAddress != address(0)) {
            return block.timestamp - batches[batchAddress].lastDebtUpdateTime > STALE_TROVE_DURATION;
        }
        return block.timestamp - trove.lastDebtUpdateTime > STALE_TROVE_DURATION;
    }

    function getUnbackedPortionPriceAndRedeemability() external returns (uint256, uint256, bool) {
        uint256 totalDebt = getEntireSystemDebt();
        uint256 spSize = stabilityPool.getTotalBoldDeposits();
        uint256 unbackedPortion = totalDebt > spSize ? totalDebt - spSize : 0;

        uint256 price = priceFeed.fetchPrice();
        bool redeemable = _getTCR(price) >= _100pct;

        return (unbackedPortion, price, redeemable);
    }

    // --- Trove property setters, called by BorrowerOperations ---

    function onOpenTrove(
        address _owner,
        uint256 _troveId,
        TroveChange memory _troveChange,
        uint256 _annualInterestRate
    ) external {
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
        _mint(_owner, _troveId);

        _updateTroveRewardSnapshots(_troveId);

        emit TroveUpdated(_troveId, _troveChange.debtIncrease + _troveChange.upfrontFee, _troveChange.collIncrease, newStake, _annualInterestRate, L_ETH, L_boldDebt);

        emit TroveOperation(
            _troveId,
            Operation.openTrove,
            _annualInterestRate,
            0, // _debtIncreaseFromRedist
            _troveChange.upfrontFee,
            int256(_troveChange.debtIncrease),
            0, // _collIncreaseFromRedist
            int256(_troveChange.collIncrease)
        );
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
        assert(batchIds[batches[_batchAddress].arrayIndex] == _batchAddress);

        uint256 newStake = _computeNewStake(_troveChange.collIncrease);

        // Trove memory newTrove;
        Troves[_troveId].debt = 0;
        Troves[_troveId].coll = 0;
        Troves[_troveId].stake = newStake;
        Troves[_troveId].status = Status.active;
        Troves[_troveId].arrayIndex = uint64(TroveIds.length);
        Troves[_troveId].annualInterestRate = 0;
        Troves[_troveId].lastDebtUpdateTime = 0;
        Troves[_troveId].lastInterestRateAdjTime = 0;
        Troves[_troveId].interestBatchManager = _batchAddress;

        _updateTroveRewardSnapshots(_troveId);

        // Push the trove's id to the Trove list
        TroveIds.push(_troveId);

        _updateBatchShares(_troveId, _batchAddress, _troveChange, _batchColl, _batchDebt);

        uint256 newTotalStakes = totalStakes + newStake;
        totalStakes = newTotalStakes;

        // mint ERC721
        _mint(_owner, _troveId);

        uint256 annualInterestRate = batches[_batchAddress].annualInterestRate;
        emit TroveUpdated(_troveId, _troveChange.debtIncrease, _troveChange.collIncrease, newStake, annualInterestRate, L_ETH, L_boldDebt);

        emit TroveOperation(
            _troveId,
            Operation.openTrove,
            annualInterestRate,
            0, // _debtIncreaseFromRedist
            _troveChange.upfrontFee,
            int256(_troveChange.debtIncrease),
            0, // _collIncreaseFromRedist
            int256(_troveChange.collIncrease)
        );
    }

    function setTroveStatusToActive(uint256 _troveId) external {
        _requireCallerIsBorrowerOperations();
        Troves[_troveId].status = Status.active;
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
            defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistETHGain
        );

        _updateTroveRewardSnapshots(_troveId);

        emit TroveUpdated(
            _troveId, _newDebt, _newColl, Troves[_troveId].stake, _newAnnualInterestRate, L_ETH, L_boldDebt
        );

        emit TroveOperation(
            _troveId,
            Operation.adjustTroveInterestRate,
            _newAnnualInterestRate,
            _troveChange.appliedRedistBoldDebtGain,
            _troveChange.upfrontFee,
            0, // debt increase / decrease
            _troveChange.appliedRedistETHGain,
            0  // coll increase / decrease
        );
    }

    function onAdjustTrove(uint256 _troveId, uint256 _newColl, uint256 _newDebt, TroveChange calldata _troveChange)
        external
    {
        _requireCallerIsBorrowerOperations();

        Troves[_troveId].coll = _newColl;
        Troves[_troveId].debt = _newDebt;
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);

        _movePendingTroveRewardsToActivePool(
            defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistETHGain
        );

        uint256 newStake = _updateStakeAndTotalStakes(_troveId, _newColl);
        _updateTroveRewardSnapshots(_troveId);

        emit TroveUpdated(
            _troveId, _newDebt, _newColl, newStake, Troves[_troveId].annualInterestRate, L_ETH, L_boldDebt
        );

        emit TroveOperation(
            _troveId,
            Operation.adjustTrove,
            Troves[_troveId].annualInterestRate,
            _troveChange.appliedRedistBoldDebtGain,
            _troveChange.upfrontFee,
            int256(_troveChange.debtIncrease) - int256(_troveChange.debtDecrease),
            _troveChange.appliedRedistETHGain,
            int256(_troveChange.collIncrease) - int256(_troveChange.collDecrease)
        );
    }

    function onAdjustTroveInsideBatch(
        uint256 _troveId,
        uint256 _newTroveColl, // entire, with reditribution and trove change
        TroveChange memory _troveChange,
        address _batchAddress,
        uint256 _newBatchColl, // without trove change
        uint256 _newBatchDebt // entire (with interest, batch fee and redistribution), but without trove change
    ) external {
        _requireCallerIsBorrowerOperations();

        // Trove
        _updateTroveRewardSnapshots(_troveId);
        _updateStakeAndTotalStakes(_troveId, _newTroveColl);

        // Batch
        _updateBatchShares(_troveId, _batchAddress, _troveChange, _newBatchColl, _newBatchDebt);

        _movePendingTroveRewardsToActivePool(
            defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistETHGain
        );
    }

    function onApplyTroveInterest(
        uint256 _troveId,
        uint256 _newColl,
        uint256 _newDebt,
        TroveChange calldata _troveChange
    ) external {
        _requireCallerIsBorrowerOperations();

        Troves[_troveId].coll = _newColl;
        Troves[_troveId].debt = _newDebt;
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);

        _movePendingTroveRewardsToActivePool(
            defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistETHGain
        );

        _updateTroveRewardSnapshots(_troveId);

        emit TroveUpdated(
            _troveId, _newDebt, _newColl, Troves[_troveId].stake, Troves[_troveId].annualInterestRate, L_ETH, L_boldDebt
        );

        emit TroveOperation(
            _troveId,
            Operation.applyTroveInterestPermissionless,
            Troves[_troveId].annualInterestRate,
            _troveChange.appliedRedistBoldDebtGain,
            _troveChange.upfrontFee,
            int256(_troveChange.debtIncrease) - int256(_troveChange.debtDecrease),
            _troveChange.appliedRedistETHGain,
            int256(_troveChange.collIncrease) - int256(_troveChange.collDecrease)
        );
    }

    function onApplyBatchInterestAndFee(address _batchAddress, uint256 _newColl, uint256 _newDebt) external {
        _requireCallerIsBorrowerOperations();

        batches[_batchAddress].coll = _newColl;
        batches[_batchAddress].debt = _newDebt;
        batches[_batchAddress].lastDebtUpdateTime = uint64(block.timestamp);
    }

    function onRegisterBatchManager(address _account, uint256 _annualInterestRate, uint256 _annualManagementFee) external {
        _requireCallerIsBorrowerOperations();

        batches[_account].arrayIndex = uint64(batchIds.length);
        batches[_account].annualInterestRate = _annualInterestRate;
        batches[_account].annualManagementFee = _annualManagementFee;
        batches[_account].lastInterestRateAdjTime = uint64(block.timestamp);

        batchIds.push(_account);
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
    }

    function onSetBatchManagerAnnualInterestRate(
        address _batchAddress,
        uint256 _newColl,
        uint256 _newDebt,
        uint256 _newAnnualInterestRate
    ) external {
        _requireCallerIsBorrowerOperations();

        batches[_batchAddress].coll = _newColl;
        batches[_batchAddress].debt = _newDebt;
        batches[_batchAddress].annualInterestRate = _newAnnualInterestRate;
        batches[_batchAddress].lastDebtUpdateTime = uint64(block.timestamp);
        batches[_batchAddress].lastInterestRateAdjTime = uint64(block.timestamp);
    }

    function onSetInterestBatchManager(
        uint256 _troveId,
        uint256 _troveColl, // entire, with redistribution
        uint256 _troveDebt, // entire, with interest, batch fee and redistribution
        TroveChange memory _troveChange,
        address _oldBatchAddress,
        address _newBatchAddress,
        uint256 _oldBatchColl, // collateral for previous batch manager (without trove change)
        uint256 _oldBatchDebt, // entire debt (w/interest+fee) for previous batch manager (without trove change)
        uint256 _newBatchColl, // collateral for new batch manager (without trove change)
        uint256 _newBatchDebt // entire debt (w/interest+fee) for new batch manager (without trove change)
    ) external {
        _requireCallerIsBorrowerOperations();
        assert(batchIds[batches[_newBatchAddress].arrayIndex] == _newBatchAddress);

        _updateTroveRewardSnapshots(_troveId);

        // Subtract from old manager
        if (_oldBatchAddress != address(0)) {
            _removeTroveSharesFromBatch(
                _troveId,
                _troveColl,
                _troveDebt,
                _troveChange,
                _oldBatchAddress,
                _oldBatchColl,
                _oldBatchDebt
            );
        } else {
            // If trove didn’t belong to a batch before, let’s clean its state
            Troves[_troveId].debt = 0;
            Troves[_troveId].coll = 0;
            Troves[_troveId].annualInterestRate = 0;
            Troves[_troveId].lastDebtUpdateTime = 0;
        }

        Troves[_troveId].interestBatchManager = _newBatchAddress;
        Troves[_troveId].lastInterestRateAdjTime = uint64(block.timestamp);

        _troveChange.collIncrease = _troveColl;
        _troveChange.debtIncrease = _troveDebt - _troveChange.upfrontFee - _troveChange.appliedRedistBoldDebtGain;
        _updateBatchShares(_troveId, _newBatchAddress, _troveChange, _newBatchColl, _newBatchDebt);

        _movePendingTroveRewardsToActivePool(
            defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistETHGain
        );
    }

    function _updateBatchShares(
        uint256 _troveId,
        address _batchAddress,
        TroveChange memory _troveChange,
        uint256 _batchColl, // without trove change
        uint256 _batchDebt // entire (with interest, batch fee and redistribution), but without trove change
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
                    batchDebtSharesDelta = currentBatchDebtShares * debtIncrease / _batchDebt;
                }

                Troves[_troveId].batchDebtShares += batchDebtSharesDelta;
                batches[_batchAddress].debt = _batchDebt + debtIncrease;
                batches[_batchAddress].totalDebtShares = currentBatchDebtShares + batchDebtSharesDelta;
            } else if (debtDecrease > 0) {
                // Subtract debt
                batchDebtSharesDelta = currentBatchDebtShares * debtDecrease / _batchDebt;

                Troves[_troveId].batchDebtShares -= batchDebtSharesDelta;
                batches[_batchAddress].debt = _batchDebt - debtDecrease;
                batches[_batchAddress].totalDebtShares = currentBatchDebtShares - batchDebtSharesDelta;
            }
        }
        // Update debt checkpoint
        batches[_batchAddress].lastDebtUpdateTime = uint64(block.timestamp);

        // Collateral
        uint256 collIncrease = _troveChange.collIncrease + _troveChange.appliedRedistETHGain;
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
                Troves[_troveId].coll += collIncrease;
                batches[_batchAddress].coll = _batchColl + collIncrease;
            } else if (collDecrease > 0) {
                // Subtract coll
                Troves[_troveId].coll -= collDecrease;
                batches[_batchAddress].coll = _batchColl - collDecrease;
            }
        }
    }

    function onRemoveInterestBatchManager(
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
        assert(batchIds[batches[_batchAddress].arrayIndex] == _batchAddress);

        // Subtract from batch
        _removeTroveSharesFromBatch(
            _troveId, _newTroveColl, _newTroveDebt, _troveChange, _batchAddress, _newBatchColl, _newBatchDebt
        );

        // Restore Trove state
        Troves[_troveId].debt = _newTroveDebt;
        Troves[_troveId].coll = _newTroveColl;
        Troves[_troveId].stake = _computeNewStake(_newTroveColl);
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);
        if (batches[_batchAddress].annualInterestRate != _newAnnualInterestRate) {
            Troves[_troveId].annualInterestRate = _newAnnualInterestRate;
            Troves[_troveId].lastInterestRateAdjTime = uint64(block.timestamp);
        }

        _updateTroveRewardSnapshots(_troveId);
        _movePendingTroveRewardsToActivePool(defaultPool, _troveChange.appliedRedistBoldDebtGain, _troveChange.appliedRedistETHGain);
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
        assert(_newBatchDebt > 0);
        assert(_newBatchColl > 0);

        Trove memory trove = Troves[_troveId];

        // We don’t need to increase the shares corresponding to redistribution first, because they would be subtracted immediately after
        // We don’t need to account for interest nor batch fee because it’s proportional to debt shares
        uint256 batchDebtDecrease = _newTroveDebt - _troveChange.upfrontFee - _troveChange.appliedRedistBoldDebtGain;
        uint256 batchCollDecrease = _newTroveColl - _troveChange.appliedRedistETHGain;

        batches[_batchAddress].totalDebtShares -= trove.batchDebtShares;
        batches[_batchAddress].debt = _newBatchDebt - batchDebtDecrease;
        batches[_batchAddress].coll = _newBatchColl - batchCollDecrease;
        batches[_batchAddress].lastDebtUpdateTime = uint64(block.timestamp);

        Troves[_troveId].interestBatchManager = address(0);
        Troves[_troveId].batchDebtShares = 0;
    }
}
