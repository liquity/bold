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

    // Minimum collateral ratio for individual troves
    uint256 public immutable MCR;
    // Liquidation penalty for troves offset to the SP
    uint256 public immutable LIQUIDATION_PENALTY_SP;
    // Liquidation penalty for troves redistributed
    uint256 public immutable LIQUIDATION_PENALTY_REDISTRIBUTION;

    uint256 public constant SECONDS_IN_ONE_YEAR = 31536000; // 60 * 60 * 24 * 365,
    uint256 public constant STALE_TROVE_DURATION = 7776000; // 90 days: 60*60*24*90 = 7776000

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
        uint256 liquidatedDebt;
        uint256 liquidatedColl;
        uint256 totalRecordedDebtPlusInterestInSequence;
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
        uint256 entireSystemDebt;
        uint256 entireSystemColl;
    }

    struct LiquidationValues {
        uint256 entireTroveDebt;
        uint256 entireTroveColl;
        uint256 collGasCompensation;
        uint256 BoldGasCompensation;
        uint256 debtToOffset;
        uint256 collToSendToSP;
        uint256 debtToRedistribute;
        uint256 collToRedistribute;
        uint256 collSurplus;
        uint256 accruedTroveInterest;
        uint256 weightedRecordedTroveDebt;
        uint256 recordedTroveDebt;
        uint256 pendingDebtReward;
    }

    struct LiquidationTotals {
        uint256 totalCollInSequence;
        uint256 totalDebtInSequence;
        uint256 totalRecordedDebtInSequence;
        uint256 totalWeightedRecordedDebtInSequence;
        uint256 totalAccruedInterestInSequence;
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
        uint256 price;
        uint256 totalRedistDebtGains;
        uint256 totalNewWeightedRecordedTroveDebts;
        uint256 totalOldWeightedRecordedTroveDebts;
    }

    struct SingleRedemptionValues {
        uint256 BoldLot;
        uint256 ETHLot;
        uint256 ETHFee;
        uint256 redistDebtGain;
        uint256 oldRecordedTroveDebt;
        uint256 newRecordedTroveDebt;
        uint256 oldWeightedRecordedTroveDebt;
        uint256 newWeightedRecordedTroveDebt;
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
    event TroveUpdated(
        uint256 indexed _troveId, uint256 _debt, uint256 _coll, uint256 _stake, TroveManagerOperation _operation
    );
    event TroveLiquidated(uint256 indexed _troveId, uint256 _debt, uint256 _coll, TroveManagerOperation _operation);
    event TotalStakesUpdated(uint256 _newTotalStakes);
    event SystemSnapshotsUpdated(uint256 _totalStakesSnapshot, uint256 _totalCollateralSnapshot);
    event LTermsUpdated(uint256 _L_ETH, uint256 _L_boldDebt);
    event TroveSnapshotsUpdated(uint256 _L_ETH, uint256 _L_boldDebt);
    event TroveIndexUpdated(uint256 _troveId, uint256 _newIndex);
    event RedemptionFeePaidToTrove(uint256 indexed _troveId, uint256 _ETHFee);
    enum TroveManagerOperation {
        getAndApplyRedistributionGains,
        liquidate,
        redeemCollateral
    }

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

    // Liquidate one trove, in Normal Mode.
    function _liquidate(IDefaultPool _defaultPool, uint256 _troveId, uint256 _boldInStabPool, uint256 _price)
        internal
        returns (LiquidationValues memory singleLiquidation)
    {
        address owner = ownerOf(_troveId);

        LocalVariables_InnerSingleLiquidateFunction memory vars;
        (
            singleLiquidation.entireTroveDebt,
            singleLiquidation.entireTroveColl,
            singleLiquidation.pendingDebtReward,
            vars.pendingCollReward,
            singleLiquidation.accruedTroveInterest
        ) = getEntireDebtAndColl(_troveId);

        singleLiquidation.weightedRecordedTroveDebt = getTroveWeightedRecordedDebt(_troveId);

        //TODO - GAS: We already read this inside getEntireDebtAndColl - so add it to the returned vals?
        singleLiquidation.recordedTroveDebt = Troves[_troveId].debt;

        _movePendingTroveRewardsToActivePool(_defaultPool, singleLiquidation.pendingDebtReward, vars.pendingCollReward);
        _removeStake(_troveId);

        singleLiquidation.collGasCompensation = _getCollGasCompensation(singleLiquidation.entireTroveColl);
        singleLiquidation.BoldGasCompensation = BOLD_GAS_COMPENSATION;
        uint256 collToLiquidate = singleLiquidation.entireTroveColl - singleLiquidation.collGasCompensation;

        (
            singleLiquidation.debtToOffset,
            singleLiquidation.collToSendToSP,
            singleLiquidation.debtToRedistribute,
            singleLiquidation.collToRedistribute,
            singleLiquidation.collSurplus
        ) = _getOffsetAndRedistributionVals(singleLiquidation.entireTroveDebt, collToLiquidate, _boldInStabPool, _price);

        _closeTrove(_troveId, Status.closedByLiquidation);

        // Differencen between liquidation penalty and liquidation threshold
        if (singleLiquidation.collSurplus > 0) {
            collSurplusPool.accountSurplus(owner, singleLiquidation.collSurplus);
        }

        emit TroveLiquidated(
            _troveId,
            singleLiquidation.entireTroveDebt,
            singleLiquidation.entireTroveColl,
            TroveManagerOperation.liquidate
        );
        emit TroveUpdated(_troveId, 0, 0, 0, TroveManagerOperation.liquidate);
        return singleLiquidation;
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
    *  Get its offset coll/debt and ETH gas comp.
    */
    function _getCappedOffsetVals(
        uint256 _entireTroveDebt,
        uint256 _entireTroveColl,
        uint256 _recordedTroveDebt,
        uint256 _weightedRecordedTroveDebt,
        uint256 _price
    ) internal view returns (LiquidationValues memory singleLiquidation) {
        singleLiquidation.entireTroveDebt = _entireTroveDebt;
        singleLiquidation.entireTroveColl = _entireTroveColl;
        singleLiquidation.recordedTroveDebt = _recordedTroveDebt;
        singleLiquidation.weightedRecordedTroveDebt = _weightedRecordedTroveDebt;
        // TODO: We don’t bother updating this because we are removing RM
        uint256 cappedCollPortion = _entireTroveDebt * MCR / _price;

        singleLiquidation.collGasCompensation = _getCollGasCompensation(cappedCollPortion);
        singleLiquidation.BoldGasCompensation = BOLD_GAS_COMPENSATION;

        singleLiquidation.debtToOffset = _entireTroveDebt;
        singleLiquidation.collToSendToSP = cappedCollPortion - singleLiquidation.collGasCompensation;
        singleLiquidation.collSurplus = _entireTroveColl - cappedCollPortion;
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

        // Perform the appropriate liquidation sequence - tally values and obtain their totals.
        totals = _getTotalsFromBatchLiquidate(defaultPoolCached, vars.price, vars.boldInStabPool, _troveArray);

        require(totals.totalDebtInSequence > 0, "TroveManager: nothing to liquidate");

        vars.totalRecordedDebtPlusInterestInSequence =
            totals.totalRecordedDebtInSequence + totals.totalAccruedInterestInSequence;

        activePool.mintAggInterestAndAccountForTroveChange(
            0, vars.totalRecordedDebtPlusInterestInSequence, 0, totals.totalWeightedRecordedDebtInSequence
        );

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

    function _getTotalsFromBatchLiquidate(
        IDefaultPool _defaultPool,
        uint256 _price,
        uint256 _boldInStabPool,
        uint256[] memory _troveArray
    ) internal returns (LiquidationTotals memory totals) {
        LocalVariables_LiquidationSequence memory vars;
        LiquidationValues memory singleLiquidation;

        vars.remainingBoldInStabPool = _boldInStabPool;

        for (vars.i = 0; vars.i < _troveArray.length; vars.i++) {
            vars.troveId = _troveArray[vars.i];

            // Skip non-liquidatable troves
            if (!_isLiquidatableStatus(Troves[vars.troveId].status)) continue;

            vars.ICR = getCurrentICR(vars.troveId, _price);

            if (vars.ICR < MCR) {
                singleLiquidation = _liquidate(_defaultPool, vars.troveId, vars.remainingBoldInStabPool, _price);
                vars.remainingBoldInStabPool = vars.remainingBoldInStabPool - singleLiquidation.debtToOffset;

                // Add liquidation values to their respective running totals
                totals = _addLiquidationValuesToTotals(totals, singleLiquidation);
            }
        }
    }

    // --- Liquidation helper functions ---

    function _addLiquidationValuesToTotals(
        LiquidationTotals memory oldTotals,
        LiquidationValues memory singleLiquidation
    ) internal pure returns (LiquidationTotals memory newTotals) {
        // Tally all the values with their respective running totals
        newTotals.totalCollGasCompensation = oldTotals.totalCollGasCompensation + singleLiquidation.collGasCompensation;
        newTotals.totalBoldGasCompensation = oldTotals.totalBoldGasCompensation + singleLiquidation.BoldGasCompensation;
        newTotals.totalDebtInSequence = oldTotals.totalDebtInSequence + singleLiquidation.entireTroveDebt;
        newTotals.totalCollInSequence = oldTotals.totalCollInSequence + singleLiquidation.entireTroveColl;
        newTotals.totalRecordedDebtInSequence =
            oldTotals.totalRecordedDebtInSequence + singleLiquidation.recordedTroveDebt;
        newTotals.totalWeightedRecordedDebtInSequence =
            oldTotals.totalWeightedRecordedDebtInSequence + singleLiquidation.weightedRecordedTroveDebt;
        newTotals.totalAccruedInterestInSequence =
            oldTotals.totalAccruedInterestInSequence + singleLiquidation.accruedTroveInterest;
        newTotals.totalDebtToOffset = oldTotals.totalDebtToOffset + singleLiquidation.debtToOffset;
        newTotals.totalCollToSendToSP = oldTotals.totalCollToSendToSP + singleLiquidation.collToSendToSP;
        newTotals.totalDebtToRedistribute = oldTotals.totalDebtToRedistribute + singleLiquidation.debtToRedistribute;
        newTotals.totalCollToRedistribute = oldTotals.totalCollToRedistribute + singleLiquidation.collToRedistribute;
        newTotals.totalCollSurplus = oldTotals.totalCollSurplus + singleLiquidation.collSurplus;

        return newTotals;
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
        uint256 _redemptionRate
    ) internal returns (SingleRedemptionValues memory singleRedemption) {
        singleRedemption.oldWeightedRecordedTroveDebt = getTroveWeightedRecordedDebt(_troveId);
        singleRedemption.oldRecordedTroveDebt = Troves[_troveId].debt;

        (, singleRedemption.redistDebtGain) = _getAndApplyRedistributionGains(_contractsCache.defaultPool, _troveId);

        // TODO: Gas. We apply accrued interest here, but could gas optimize this, since all-but-one Trove in the sequence will have their
        // debt zero'd by redemption. However, gas optimization for redemption is not as critical as for borrower & SP ops.
        uint256 entireTroveDebt = getTroveEntireDebt(_troveId);
        _updateTroveDebt(_troveId, entireTroveDebt);

        // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the Trove minus the liquidation reserve
        // TODO: should we leave gas compensation (and corresponding debt) untouched for zombie Troves? Currently it's not touched.
        singleRedemption.BoldLot = LiquityMath._min(_maxBoldamount, entireTroveDebt - BOLD_GAS_COMPENSATION);

        // Get the amount of ETH equal in USD value to the BoldLot redeemed 
        uint256 correspondingETH = singleRedemption.BoldLot * DECIMAL_PRECISION / _price;
        // Calculate the ETHFee separately (for events)
        singleRedemption.ETHFee = correspondingETH * _redemptionRate / DECIMAL_PRECISION; 
        // Get the final ETHLot to send to redeemer, leaving the fee in the Trove
        singleRedemption.ETHLot = correspondingETH - singleRedemption.ETHFee;

        // Decrease the debt and collateral of the current Trove according to the Bold lot and ETH to send
        singleRedemption.newRecordedTroveDebt = entireTroveDebt - singleRedemption.BoldLot;
        uint256 newColl = Troves[_troveId].coll - singleRedemption.ETHLot;

        if (_getNetDebt(singleRedemption.newRecordedTroveDebt) < MIN_NET_DEBT) {
            Troves[_troveId].status = Status.unredeemable;
            sortedTroves.remove(_troveId);
            // TODO: should we also remove from the Troves array? Seems unneccessary as it's only used for off-chain hints.
            // We save borrowers gas by not removing
        }
        Troves[_troveId].debt = singleRedemption.newRecordedTroveDebt;
        Troves[_troveId].coll = newColl;

        singleRedemption.newWeightedRecordedTroveDebt = getTroveWeightedRecordedDebt(_troveId);

        // TODO: Gas optimize? We update totalStakes N times for a sequence of N Trovres(!).
        _updateStakeAndTotalStakes(_troveId);

        emit TroveUpdated(
            _troveId,
            singleRedemption.newRecordedTroveDebt,
            newColl,
            Troves[_troveId].stake,
            TroveManagerOperation.redeemCollateral
        );

        emit RedemptionFeePaidToTrove(_troveId, singleRedemption.ETHFee);

        return singleRedemption;
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

            SingleRedemptionValues memory singleRedemption =
                _redeemCollateralFromTrove(contractsCache, currentTroveId, totals.remainingBold, _price, _redemptionRate);

            totals.totalBoldToRedeem = totals.totalBoldToRedeem + singleRedemption.BoldLot;
            totals.totalRedistDebtGains = totals.totalRedistDebtGains + singleRedemption.redistDebtGain;
            // For recorded and weighted recorded debt totals, we need to capture the increases and decreases,
            // since the net debt change for a given Trove could be positive or negative: redemptions decrease a Trove's recorded
            // (and weighted recorded) debt, but the accrued interest increases it.
            totals.totalNewWeightedRecordedTroveDebts =
                totals.totalNewWeightedRecordedTroveDebts + singleRedemption.newWeightedRecordedTroveDebt;
            totals.totalOldWeightedRecordedTroveDebts =
                totals.totalOldWeightedRecordedTroveDebts + singleRedemption.oldWeightedRecordedTroveDebt;

            totals.totalETHDrawn = totals.totalETHDrawn + singleRedemption.ETHLot;
            totals.ETHFee = totals.ETHFee + singleRedemption.ETHFee;
            totals.remainingBold = totals.remainingBold - singleRedemption.BoldLot;
            currentTroveId = nextUserToCheck;
        }

        // We are removing this condition to prevent blocking redemptions
        //require(totals.totalETHDrawn > 0, "TroveManager: Unable to redeem any amount");

        emit Redemption(_boldamount, totals.totalBoldToRedeem, totals.totalETHDrawn, totals.ETHFee);

        activePool.mintAggInterestAndAccountForTroveChange(
            totals.totalRedistDebtGains,
            totals.totalBoldToRedeem,
            totals.totalNewWeightedRecordedTroveDebts,
            totals.totalOldWeightedRecordedTroveDebts
        );

        // Send the redeemed ETH to sender
        contractsCache.activePool.sendETH(_sender, totals.totalETHDrawn);
        // We’ll burn all the Bold together out in the CollateralRegistry, to save gas

        return totals.totalBoldToRedeem;
    }

    // --- Helper functions ---

    // Return the current collateral ratio (ICR) of a given Trove. Takes a trove's pending coll and debt rewards from redistributions into account.
    function getCurrentICR(uint256 _troveId, uint256 _price) public view override returns (uint256) {
        (uint256 currentETH, uint256 currentBoldDebt) = _getCurrentTroveAmounts(_troveId);

        uint256 ICR = LiquityMath._computeCR(currentETH, currentBoldDebt, _price);
        return ICR;
    }

    function _getCurrentTroveAmounts(uint256 _troveId) internal view returns (uint256, uint256) {
        uint256 pendingETHReward = getPendingETHReward(_troveId);
        uint256 pendingBoldDebtReward = getPendingBoldDebtReward(_troveId);

        uint256 accruedTroveInterest = calcTroveAccruedInterest(_troveId);

        uint256 currentETH = Troves[_troveId].coll + pendingETHReward;
        uint256 currentBoldDebt = Troves[_troveId].debt + pendingBoldDebtReward + accruedTroveInterest;

        return (currentETH, currentBoldDebt);
    }

    function getAndApplyRedistributionGains(uint256 _troveId) external override returns (uint256, uint256) {
        _requireCallerIsBorrowerOperations();
        return _getAndApplyRedistributionGains(defaultPool, _troveId);
    }

    // Add the borrowers's coll and debt rewards earned from redistributions, to their Trove
    function _getAndApplyRedistributionGains(IDefaultPool _defaultPool, uint256 _troveId)
        internal
        returns (uint256, uint256)
    {
        uint256 pendingETHReward;
        uint256 pendingBoldDebtReward;

        if (hasRedistributionGains(_troveId)) {
            _requireTroveIsOpen(_troveId);

            // Compute redistribution gains
            pendingETHReward = getPendingETHReward(_troveId);
            pendingBoldDebtReward = getPendingBoldDebtReward(_troveId);

            // Apply redistribution gains to trove's state
            Troves[_troveId].coll = Troves[_troveId].coll + pendingETHReward;
            Troves[_troveId].debt = Troves[_troveId].debt + pendingBoldDebtReward;

            _updateTroveRewardSnapshots(_troveId);

            // Transfer redistribution gains from DefaultPool to ActivePool
            _movePendingTroveRewardsToActivePool(_defaultPool, pendingBoldDebtReward, pendingETHReward);

            emit TroveUpdated(
                _troveId,
                Troves[_troveId].debt,
                Troves[_troveId].coll,
                Troves[_troveId].stake,
                TroveManagerOperation.getAndApplyRedistributionGains
            );
        }

        return (pendingETHReward, pendingBoldDebtReward);
    }

    function _updateTroveRewardSnapshots(uint256 _troveId) internal {
        rewardSnapshots[_troveId].ETH = L_ETH;
        rewardSnapshots[_troveId].boldDebt = L_boldDebt;
        emit TroveSnapshotsUpdated(L_ETH, L_boldDebt);
    }

    // Get the borrower's pending accumulated ETH reward, earned by their stake
    function getPendingETHReward(uint256 _troveId) public view override returns (uint256) {
        uint256 snapshotETH = rewardSnapshots[_troveId].ETH;
        uint256 rewardPerUnitStaked = L_ETH - snapshotETH;

        if (rewardPerUnitStaked == 0 || !checkTroveIsOpen(_troveId)) return 0;

        uint256 stake = Troves[_troveId].stake;

        uint256 pendingETHReward = stake * rewardPerUnitStaked / DECIMAL_PRECISION;

        return pendingETHReward;
    }

    // Get the borrower's pending accumulated Bold reward, earned by their stake
    function getPendingBoldDebtReward(uint256 _troveId) public view override returns (uint256) {
        uint256 snapshotBoldDebt = rewardSnapshots[_troveId].boldDebt;
        uint256 rewardPerUnitStaked = L_boldDebt - snapshotBoldDebt;

        if (rewardPerUnitStaked == 0 || !checkTroveIsOpen(_troveId)) return 0;

        uint256 stake = Troves[_troveId].stake;

        uint256 pendingBoldDebtReward = stake * rewardPerUnitStaked / DECIMAL_PRECISION;

        return pendingBoldDebtReward;
    }

    function hasRedistributionGains(uint256 _troveId) public view override returns (bool) {
        /*
        * A Trove has redistribution gains if its snapshot is less than the current rewards per-unit-staked sum:
        * this indicates that rewards have occured since the snapshot was made, and the user therefore has
        * redistribution gains
        */
        if (!checkTroveIsOpen(_troveId)) return false;

        return (rewardSnapshots[_troveId].ETH < L_ETH);
    }

    // Return the Troves entire debt and coll, including redistribution gains from redistributions.
    function getEntireDebtAndColl(uint256 _troveId)
        public
        view
        override
        returns (
            uint256 entireDebt,
            uint256 entireColl,
            uint256 pendingBoldDebtReward,
            uint256 pendingETHReward,
            uint256 accruedTroveInterest
        )
    {
        uint256 recordedDebt = Troves[_troveId].debt;
        uint256 recordedColl = Troves[_troveId].coll;

        pendingBoldDebtReward = getPendingBoldDebtReward(_troveId);
        accruedTroveInterest = calcTroveAccruedInterest(_troveId);
        pendingETHReward = getPendingETHReward(_troveId);

        entireDebt = recordedDebt + pendingBoldDebtReward + accruedTroveInterest;
        entireColl = recordedColl + pendingETHReward;
    }

    function getTroveEntireDebt(uint256 _troveId) public view returns (uint256) {
        (uint256 entireTroveDebt,,,,) = getEntireDebtAndColl(_troveId);
        return entireTroveDebt;
    }

    function getTroveEntireColl(uint256 _troveId) external view returns (uint256) {
        (, uint256 entireTroveColl,,,) = getEntireDebtAndColl(_troveId);
        return entireTroveColl;
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

        return recordedDebt * annualInterestRate * (block.timestamp - lastDebtUpdateTime) / SECONDS_IN_ONE_YEAR / 1e18;
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
        uint256 _annualInterestRate
    ) external returns (uint256, uint256) {
        _requireCallerIsBorrowerOperations();
        // TODO: optimize gas for writing to this struct
        Troves[_troveId].status = Status.active;
        Troves[_troveId].coll = _coll;

        _updateTroveDebtAndInterest(_troveId, _debt, _annualInterestRate);

        _updateTroveRewardSnapshots(_troveId);

        // mint ERC721
        _mint(_owner, _troveId);

        uint256 index = _addTroveIdToArray(_troveId);

        // Record the Trove's stake (for redistributions) and update the total stakes
        uint256 stake = _updateStakeAndTotalStakes(_troveId);
        return (stake, index);
    }

    function setTroveStatusToActive(uint256 _troveId) external {
        _requireCallerIsBorrowerOperations();
        Troves[_troveId].status = Status.active;
    }

    function updateTroveDebtAndInterest(uint256 _troveId, uint256 _entireTroveDebt, uint256 _newAnnualInterestRate)
        external
    {
        _requireCallerIsBorrowerOperations();
        _updateTroveDebtAndInterest(_troveId, _entireTroveDebt, _newAnnualInterestRate);
    }

    function _updateTroveDebtAndInterest(uint256 _troveId, uint256 _entireTroveDebt, uint256 _newAnnualInterestRate)
        internal
    {
        _updateTroveDebt(_troveId, _entireTroveDebt);
        Troves[_troveId].annualInterestRate = _newAnnualInterestRate;
    }

    function updateTroveDebtFromInterestApplication(uint256 _troveId, uint256 _entireTroveDebt) external {
        _requireCallerIsBorrowerOperations();
        _updateTroveDebt(_troveId, _entireTroveDebt);
    }

    function updateTroveDebt(address _sender, uint256 _troveId, uint256 _entireTroveDebt, bool _isDebtIncrease)
        external
    {
        _requireCallerIsBorrowerOperations();
        if (_isDebtIncrease) {
            _requireIsOwnerOrRemoveManager(_troveId, _sender);
        } else {
            _requireIsOwnerOrAddManager(_troveId, _sender);
        }
        _updateTroveDebt(_troveId, _entireTroveDebt);
    }

    function _updateTroveDebt(uint256 _troveId, uint256 _entireTroveDebt) internal {
        Troves[_troveId].debt = _entireTroveDebt;
        Troves[_troveId].lastDebtUpdateTime = uint64(block.timestamp);
    }

    function updateTroveColl(address _sender, uint256 _troveId, uint256 _entireTroveColl, bool _isCollIncrease)
        external
        override
    {
        _requireCallerIsBorrowerOperations();
        if (_isCollIncrease) {
            _requireIsOwnerOrAddManager(_troveId, _sender);
        } else {
            _requireIsOwnerOrRemoveManager(_troveId, _sender);
        }

        Troves[_troveId].coll = _entireTroveColl;
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
