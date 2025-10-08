// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
import {Address} from "openzeppelin-contracts/contracts/utils/Address.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {LatestBatchData} from "src/Types/LatestBatchData.sol";
import {LatestTroveData} from "src/Types/LatestTroveData.sol";
import {IBorrowerOperations} from "src/Interfaces/IBorrowerOperations.sol";
import {ISortedTroves} from "src/Interfaces/ISortedTroves.sol";
import {ITroveManager} from "src/Interfaces/ITroveManager.sol";
import {AddressesRegistry} from "src/AddressesRegistry.sol";
import {AddRemoveManagers} from "src/Dependencies/AddRemoveManagers.sol";
import {BorrowerOperations} from "src/BorrowerOperations.sol";
import {TroveManager} from "src/TroveManager.sol";
import {EnumerableAddressSet, EnumerableSet} from "../Utils/EnumerableSet.sol";
import {pow} from "../Utils/Math.sol";
import {StringFormatting} from "../Utils/StringFormatting.sol";
import {Trove} from "../Utils/Trove.sol";
import {ITroveManagerTester} from "./Interfaces/ITroveManagerTester.sol";
import {Assertions} from "./Assertions.sol";
import {BaseHandler} from "./BaseHandler.sol";
import {BaseMultiCollateralTest} from "./BaseMultiCollateralTest.sol";
import {TestDeployer} from "./Deployment.t.sol";
import {ISystemParams} from "src/Interfaces/ISystemParams.sol";

import {
    _100pct,
    _1pct,
    DECIMAL_PRECISION,
    ONE_MINUTE,
    ONE_YEAR,
    MAX_ANNUAL_INTEREST_RATE,
    MAX_ANNUAL_BATCH_MANAGEMENT_FEE,
    MIN_INTEREST_RATE_CHANGE_PERIOD,
    INTEREST_RATE_ADJ_COOLDOWN,
    URGENT_REDEMPTION_BONUS
} from "src/Dependencies/Constants.sol";

uint256 constant TIME_DELTA_MIN = 0;
uint256 constant TIME_DELTA_MAX = ONE_YEAR;

uint256 constant BORROWED_MIN = 0 ether; // Sometimes try borrowing too little
uint256 constant BORROWED_MAX = 100_000 ether;

uint256 constant ICR_MIN = 1.1 ether - 1;
uint256 constant ICR_MAX = 3 ether;

uint256 constant TCR_MIN = 0.9 ether;
uint256 constant TCR_MAX = 3 ether;

enum AdjustedTroveProperties {
    onlyColl,
    onlyDebt,
    both,
    _COUNT
}

function add(uint256 x, int256 delta) pure returns (uint256) {
    return uint256(int256(x) + delta);
}

library ToStringFunctions {
    function toString(AdjustedTroveProperties prop) internal pure returns (string memory) {
        if (prop == AdjustedTroveProperties.onlyColl) return "uint8(AdjustedTroveProperties.onlyColl)";
        if (prop == AdjustedTroveProperties.onlyDebt) return "uint8(AdjustedTroveProperties.onlyDebt)";
        if (prop == AdjustedTroveProperties.both) return "uint8(AdjustedTroveProperties.both)";
        revert("Invalid prop");
    }
}

// Helper contract to make low-level calls in a way that works with try-catch
contract FunctionCaller is Test {
    using Address for address;

    function call(address to, bytes calldata callData) external returns (bytes memory) {
        vm.prank(msg.sender);
        return to.functionCall(callData);
    }
}

contract InvariantsTestHandler is Assertions, BaseHandler, BaseMultiCollateralTest {
    using Strings for *;
    using StringFormatting for *;
    using ToStringFunctions for *;
    using {add, pow} for uint256;

    struct OpenTroveContext {
        // input params
        uint256 i;
        uint256 borrowed;
        uint256 icr;
        bool join;
        uint256 interestRate;
        uint32 batchManagerSeed;
        uint32 upperHintSeed;
        uint32 lowerHintSeed;
        // locals
        address batchManager;
        uint256 upperHint;
        uint256 lowerHint;
        TestDeployer.LiquityContractsDev c;
        uint256 pendingInterest;
        uint256 batchManagementFee;
        uint256 upfrontFee;
        uint256 debt;
        uint256 coll;
        uint256 troveId;
        bool wasOpen;
        string errorString;
    }

    struct AdjustTroveContext {
        uint256 i;
        AdjustedTroveProperties prop;
        uint256 upperHint;
        uint256 lowerHint;
        TestDeployer.LiquityContractsDev c;
        uint256 pendingInterest;
        uint256 oldTCR;
        uint256 troveId;
        LatestTroveData t;
        address batchManager;
        uint256 batchManagementFee;
        Trove trove;
        bool wasActive;
        bool wasZombie;
        bool useZombie;
        uint256 maxDebtDec;
        int256 collDelta;
        int256 debtDelta;
        int256 $collDelta36;
        uint256 upfrontFee;
        string functionName;
        uint256 newICR;
        uint256 newTCR;
        uint256 newDebt;
        string errorString;
    }

    struct AdjustTroveInterestRateContext {
        uint256 upperHint;
        uint256 lowerHint;
        TestDeployer.LiquityContractsDev c;
        uint256 pendingInterest;
        uint256 troveId;
        address batchManager;
        LatestTroveData t;
        Trove trove;
        bool wasActive;
        bool premature;
        uint256 upfrontFee;
        string errorString;
    }

    struct CloseTroveContext {
        TestDeployer.LiquityContractsDev c;
        uint256 pendingInterest;
        uint256 troveId;
        LatestTroveData t;
        address batchManager;
        uint256 batchManagementFee;
        bool wasOpen;
        uint256 dealt;
        string errorString;
    }

    struct ApplyMyPendingDebtContext {
        uint256 upperHint;
        uint256 lowerHint;
        TestDeployer.LiquityContractsDev c;
        uint256 pendingInterest;
        uint256 troveId;
        address batchManager;
        uint256 batchManagementFee;
        LatestTroveData t;
        Trove trove;
        bool wasOpen;
        string errorString;
    }

    struct ProvideToSPContext {
        TestDeployer.LiquityContractsDev c;
        uint256 pendingInterest;
        uint256 totalBoldDeposits;
        uint256 blockedSPYield;
        uint256 initialBoldDeposit;
        uint256 boldDeposit;
        uint256 boldYield;
        uint256 ethGain;
        uint256 ethStash;
        uint256 ethClaimed;
        uint256 boldClaimed;
        string errorString;
    }

    struct WithdrawFromSPContext {
        TestDeployer.LiquityContractsDev c;
        uint256 pendingInterest;
        uint256 totalBoldDeposits;
        uint256 blockedSPYield;
        uint256 initialBoldDeposit;
        uint256 boldDeposit;
        uint256 boldYield;
        uint256 ethGain;
        uint256 ethStash;
        uint256 ethClaimed;
        uint256 boldClaimed;
        uint256 withdrawn;
        string errorString;
    }

    struct SetInterestBatchManagerContext {
        address newBatchManager;
        uint256 upperHint;
        uint256 lowerHint;
        TestDeployer.LiquityContractsDev c;
        uint256 pendingInterest;
        uint256 troveId;
        LatestTroveData t;
        uint256 batchManagementFee;
        Trove trove;
        bool wasOpen;
        bool wasActive;
        uint256 upfrontFee;
        string errorString;
    }

    struct RemoveFromBatchContext {
        uint256 upperHint;
        uint256 lowerHint;
        TestDeployer.LiquityContractsDev c;
        uint256 pendingInterest;
        uint256 troveId;
        LatestTroveData t;
        address batchManager;
        uint256 batchManagementFee;
        bool wasActive;
        bool premature;
        uint256 upfrontFee;
        string errorString;
    }

    struct SetBatchManagerAnnualInterestRateContext {
        uint256 upperHint;
        uint256 lowerHint;
        TestDeployer.LiquityContractsDev c;
        uint256 pendingInterest;
        LatestBatchData b;
        bool premature;
        uint256 upfrontFee;
        string errorString;
    }

    struct LiquidationTotals {
        uint256 collGasComp;
        uint256 spCollGain;
        uint256 spOffset;
        uint256 collRedist;
        uint256 debtRedist;
        uint256 collSurplus;
    }

    struct LiquidationTransientState {
        address[] batch;
        EnumerableSet remaining;
        EnumerableAddressSet liquidated;
        EnumerableAddressSet batchManagers; // batch managers touched by liquidation
        LiquidationTotals t;
    }

    struct Redeemed {
        uint256 troveId;
        uint256 coll;
        uint256 debt;
        bool becomesZombie;
    }

    struct RedemptionTransientState {
        uint256 attemptedAmount;
        uint256 totalCollRedeemed;
        Redeemed[] redeemed;
        EnumerableAddressSet batchManagers; // batch managers touched by redemption
        uint256 newDesignatedVictimId;
    }

    struct UrgentRedemptionTransientState {
        address[] batch;
        EnumerableSet redeemedIds;
        uint256 totalDebtRedeemed;
        uint256 totalCollRedeemed;
        Redeemed[] redeemed;
        EnumerableAddressSet batchManagers; // batch managers touched by urgent redemption
    }

    struct Batch {
        uint256 interestRateMin;
        uint256 interestRateMax;
        uint256 interestRate;
        uint256 managementRate;
        uint256 pendingManagementFee;
        uint256 period;
        EnumerableSet troves;
    }

    // Aliases
    ITroveManager.Status constant NON_EXISTENT = ITroveManager.Status.nonExistent;
    ITroveManager.Status constant ACTIVE = ITroveManager.Status.active;
    ITroveManager.Status constant CLOSED_BY_OWNER = ITroveManager.Status.closedByOwner;
    ITroveManager.Status constant CLOSED_BY_LIQ = ITroveManager.Status.closedByLiquidation;
    ITroveManager.Status constant ZOMBIE = ITroveManager.Status.zombie;

    FunctionCaller immutable _functionCaller;
    bool immutable _assumeNoExpectedFailures; // vm.assume() away calls that fail extectedly

    // Constants (per branch)
    mapping(uint256 branchIdx => uint256) CCR;
    mapping(uint256 branchIdx => uint256) BCR;
    mapping(uint256 branchIdx => uint256) MCR;
    mapping(uint256 branchIdx => uint256) SCR;
    mapping(uint256 branchIdx => uint256) LIQ_PENALTY_SP;
    mapping(uint256 branchIdx => uint256) LIQ_PENALTY_REDIST;

    // Public ghost variables (per branch, exposed to InvariantsTest)
    mapping(uint256 branchIdx => uint256) public designatedVictimId; // ID of zombie Trove that'll be redeemed first
    mapping(uint256 branchIdx => uint256) public collSurplus;
    mapping(uint256 branchIdx => uint256) public spBoldDeposits;
    mapping(uint256 branchIdx => uint256) public spBoldYield;
    mapping(uint256 branchIdx => uint256) public spColl;
    mapping(uint256 branchIdx => uint256) public totalCollRedist;
    mapping(uint256 branchIdx => uint256) public totalDebtRedist;
    mapping(uint256 branchIdx => bool) public isShutdown;

    // Price per branch
    mapping(uint256 branchIdx => uint256) _price;

    // All free-floating BOLD is kept in the handler, to be dealt out to actors as needed
    uint256 _handlerBold;

    // Used to keep track of base rate
    uint256 _baseRate;
    uint256 _timeSinceLastRedemption = 0;

    // Used to keep track of mintable interest
    mapping(uint256 branchIdx => uint256) _pendingInterest;

    // Troves ghost state
    mapping(uint256 branchIdx => mapping(address owner => uint256)) _troveIndexOf;
    mapping(uint256 branchIdx => EnumerableSet) _troveIds;
    mapping(uint256 branchIdx => EnumerableSet) _zombieTroveIds;
    mapping(uint256 branchIdx => mapping(uint256 troveId => Trove)) _troves;
    mapping(uint256 branchIdx => mapping(uint256 troveId => uint256)) _timeSinceLastTroveInterestRateAdjustment;

    // Batch management ghost state
    mapping(uint256 branchIdx => EnumerableAddressSet) _batchManagers;
    mapping(uint256 branchIdx => mapping(address batchManager => Batch)) _batches;
    mapping(uint256 branchIdx => mapping(address batchManager => uint256)) _timeSinceLastBatchInterestRateAdjustment;
    mapping(uint256 branchIdx => mapping(uint256 troveId => address)) _batchManagerOf;

    // Batch liquidation transient state
    LiquidationTransientState _liquidation;

    // Redemption transient state
    mapping(uint256 branchIdx => RedemptionTransientState) _redemption;

    // Urgent redemption transient state
    UrgentRedemptionTransientState _urgentRedemption;

    uint256 constant BATCH_MANAGEMENT_FEE_MIN = 0;
    uint256 constant BATCH_MANAGEMENT_FEE_MAX = MAX_ANNUAL_BATCH_MANAGEMENT_FEE + 1; // Sometimes try too high
    uint256 constant INTEREST_RATE_MAX = MAX_ANNUAL_INTEREST_RATE + 1; // Sometimes try rates exceeding the max
    uint256 constant RATE_CHANGE_PERIOD_MIN = MIN_INTEREST_RATE_CHANGE_PERIOD - 1; // Sometimes try too low

    // System params-based variables
    uint256 immutable INTEREST_RATE_MIN;
    uint256 immutable RATE_CHANGE_PERIOD_MAX = TIME_DELTA_MAX;
    uint256 immutable ETH_GAS_COMPENSATION;
    uint256 immutable MIN_ANNUAL_INTEREST_RATE;
    uint256 immutable MIN_DEBT;
    uint256 immutable MIN_BOLD_IN_SP;
    uint256 immutable REDEMPTION_MINUTE_DECAY_FACTOR;
    uint256 immutable REDEMPTION_BETA;
    uint256 immutable REDEMPTION_FEE_FLOOR;
    uint256 immutable SP_YIELD_SPLIT;
    uint256 immutable COLL_GAS_COMPENSATION_DIVISOR;
    uint256 immutable COLL_GAS_COMPENSATION_CAP;

    constructor(Contracts memory contracts, bool assumeNoExpectedFailures) {
        _functionCaller = new FunctionCaller();
        _assumeNoExpectedFailures = assumeNoExpectedFailures;
        setupContracts(contracts);

        for (uint256 i = 0; i < branches.length; ++i) {
            TestDeployer.LiquityContractsDev memory c = branches[i];
            CCR[i] = c.troveManager.get_CCR();
            BCR[i] = c.troveManager.get_BCR();
            MCR[i] = c.troveManager.get_MCR();
            SCR[i] = c.troveManager.get_SCR();
            LIQ_PENALTY_SP[i] = c.troveManager.get_LIQUIDATION_PENALTY_SP();
            LIQ_PENALTY_REDIST[i] = c.troveManager.get_LIQUIDATION_PENALTY_REDISTRIBUTION();
            _price[i] = c.priceFeed.getPrice();
        }

        // Set system params-based variables
        INTEREST_RATE_MIN = systemParams.MIN_ANNUAL_INTEREST_RATE() - 1; // Sometimes try rates lower than the min
        _baseRate = systemParams.INITIAL_BASE_RATE();
        ETH_GAS_COMPENSATION = systemParams.ETH_GAS_COMPENSATION();
        MIN_ANNUAL_INTEREST_RATE = systemParams.MIN_ANNUAL_INTEREST_RATE();
        MIN_DEBT = systemParams.MIN_DEBT();
        MIN_BOLD_IN_SP = systemParams.MIN_BOLD_IN_SP();
        REDEMPTION_MINUTE_DECAY_FACTOR = systemParams.REDEMPTION_MINUTE_DECAY_FACTOR();
        REDEMPTION_BETA = systemParams.REDEMPTION_BETA();
        REDEMPTION_FEE_FLOOR = systemParams.REDEMPTION_FEE_FLOOR();
        SP_YIELD_SPLIT = systemParams.SP_YIELD_SPLIT();
        COLL_GAS_COMPENSATION_DIVISOR = systemParams.COLL_GAS_COMPENSATION_DIVISOR();
        COLL_GAS_COMPENSATION_CAP = systemParams.COLL_GAS_COMPENSATION_CAP();
    }

    //////////////////////////////////////////////
    // Public view functions used in invariants //
    //////////////////////////////////////////////

    function numTroves(uint256 i) public view returns (uint256) {
        return _troveIds[i].size();
    }

    function numZombies(uint256 i) external view returns (uint256) {
        return _zombieTroveIds[i].size();
    }

    function troveIdOf(uint256 i, address owner) external view returns (uint256) {
        return _troveIdOf(i, owner);
    }

    function getTrove(uint256 i, uint256 j)
        external
        view
        returns (
            uint256 troveId,
            uint256 coll,
            uint256 debt,
            ITroveManager.Status status,
            address batchManager,
            uint256 totalCollRedist_,
            uint256 totalDebtRedist_
        )
    {
        troveId = _troveIds[i].get(j);
        (coll, debt, status, batchManager, totalCollRedist_, totalDebtRedist_) = getTroveById(i, troveId);
    }

    function getTroveById(uint256 i, uint256 troveId)
        public
        view
        returns (
            uint256 coll,
            uint256 debt,
            ITroveManager.Status status,
            address batchManager,
            uint256 totalCollRedist_,
            uint256 totalDebtRedist_
        )
    {
        Trove memory trove = _troves[i][troveId];
        trove.applyPending();

        coll = trove.coll;
        debt = trove.debt;
        status = _isZombie(i, troveId) ? ZOMBIE : ACTIVE;
        batchManager = _batchManagerOf[i][troveId];
        totalCollRedist_ = trove.totalCollRedist;
        totalDebtRedist_ = trove.totalDebtRedist;
    }

    function getBatchSize(uint256 i, address batchManager) external view returns (uint256) {
        return _batches[i][batchManager].troves.size();
    }

    function getTroveIdFromBatch(uint256 i, address batchManager, uint256 j) external view returns (uint256) {
        return _batches[i][batchManager].troves.get(j);
    }

    function getRedemptionRate() external view returns (uint256) {
        return _getRedemptionRate(_getBaseRate());
    }

    function getGasPool(uint256 i) external view returns (uint256) {
        return numTroves(i) * ETH_GAS_COMPENSATION;
    }

    function getPendingInterest(uint256 i) external view returns (uint256) {
        return Math.ceilDiv(_pendingInterest[i], ONE_YEAR * DECIMAL_PRECISION);
    }

    function getPendingBatchManagementFee(uint256 i, address batchManager) external view returns (uint256) {
        return _batches[i][batchManager].pendingManagementFee / (ONE_YEAR * DECIMAL_PRECISION);
    }

    function getInterestAccrual(uint256 i) external view returns (uint256 interestAccrual) {
        for (uint256 j = 0; j < _troveIds[i].size(); ++j) {
            Trove storage trove = _troves[i][_troveIds[i].get(j)];
            interestAccrual += trove.debt * trove.interestRate;
        }
    }

    function getBatchManagementFeeAccrual(uint256 i) external view returns (uint256 batchManagementFeeAccrual) {
        for (uint256 j = 0; j < _troveIds[i].size(); ++j) {
            Trove storage trove = _troves[i][_troveIds[i].get(j)];
            batchManagementFeeAccrual += trove.debt * trove.batchManagementRate;
        }
    }

    /////////////////////////////////////////
    // External functions called by fuzzer //
    /////////////////////////////////////////

    function warp(uint256 timeDelta) external {
        timeDelta = _bound(timeDelta, TIME_DELTA_MIN, TIME_DELTA_MAX);

        logCall("warp", timeDelta.groupRight());
        vm.warp(block.timestamp + timeDelta);

        _timeSinceLastRedemption += timeDelta;

        for (uint256 j = 0; j < branches.length; ++j) {
            for (uint256 i = 0; i < _troveIds[j].size(); ++i) {
                uint256 troveId = _troveIds[j].get(i);
                address batchManager = _batchManagerOf[j][troveId];
                Trove storage trove = _troves[j][troveId];

                _timeSinceLastTroveInterestRateAdjustment[j][troveId] += timeDelta;
                if (isShutdown[j]) continue; // shutdown branches stop accruing interest & batch management fees

                uint256 interest = trove.accrueInterest(timeDelta);
                uint256 batchManagementFee = trove.accrueBatchManagementFee(timeDelta);

                if (batchManagementFee > 0) {
                    assertNotEq(
                        batchManager, address(0), "Trove accruing batch management fee should have batch manager"
                    );
                }

                _pendingInterest[j] += interest;
                _batches[j][batchManager].pendingManagementFee += batchManagementFee;
            }

            for (uint256 i = 0; i < _batchManagers[j].size(); ++i) {
                address batchManager = _batchManagers[j].get(i);
                _timeSinceLastBatchInterestRateAdjustment[j][batchManager] += timeDelta;
            }
        }
    }

    function setPrice(uint256 i, uint256 tcr) external {
        i = _bound(i, 0, branches.length - 1);
        tcr = _bound(tcr, TCR_MIN, TCR_MAX);

        uint256 totalColl = branches[i].troveManager.getEntireBranchColl();
        uint256 totalDebt = branches[i].troveManager.getEntireBranchDebt();

        vm.assume(totalColl > 0);
        uint256 price = totalDebt * tcr / totalColl;
        vm.assume(price > DECIMAL_PRECISION);

        info("price: ", price.decimal());
        logCall("setPrice", i.toString(), tcr.decimal());

        branches[i].priceFeed.setPrice(price);
        _price[i] = price;
    }

    function openTrove(
        uint256 i,
        uint256 borrowed,
        uint256 icr,
        uint256 interestRate,
        uint32 upperHintSeed,
        uint32 lowerHintSeed
    ) external {
        OpenTroveContext memory v;
        v.i = i;
        v.borrowed = borrowed;
        v.icr = icr;
        v.interestRate = interestRate;
        v.upperHintSeed = upperHintSeed;
        v.lowerHintSeed = lowerHintSeed;
        _openTrove(v);
    }

    function openTroveAndJoinInterestBatchManager(
        uint256 i,
        uint256 borrowed,
        uint256 icr,
        uint32 batchManagerSeed,
        uint32 upperHintSeed,
        uint32 lowerHintSeed
    ) external {
        OpenTroveContext memory v;
        v.i = i;
        v.borrowed = borrowed;
        v.icr = icr;
        v.join = true;
        v.batchManagerSeed = batchManagerSeed;
        v.upperHintSeed = upperHintSeed;
        v.lowerHintSeed = lowerHintSeed;
        _openTrove(v);
    }

    function _openTrove(OpenTroveContext memory v) internal {
        v.i = _bound(v.i, 0, branches.length - 1);
        v.borrowed = _bound(v.borrowed, BORROWED_MIN, BORROWED_MAX);
        if (!v.join) v.icr = _bound(v.icr, ICR_MIN, ICR_MAX);
        if (v.join) v.icr = _bound(v.icr, ICR_MIN + BCR[v.i], ICR_MAX);
        if (!v.join) v.interestRate = _bound(v.interestRate, INTEREST_RATE_MIN, INTEREST_RATE_MAX);
        if (v.join) v.batchManager = _pickBatchManager(v.i, v.batchManagerSeed);
        v.upperHint = _pickHint(v.i, v.upperHintSeed);
        v.lowerHint = _pickHint(v.i, v.lowerHintSeed);

        v.c = branches[v.i];
        v.pendingInterest = v.c.activePool.calcPendingAggInterest();
        if (v.join) v.batchManagementFee = v.c.troveManager.getLatestBatchData(v.batchManager).accruedManagementFee;
        if (v.join) v.upfrontFee = hintHelpers.predictOpenTroveAndJoinBatchUpfrontFee(v.i, v.borrowed, v.batchManager);
        if (!v.join) v.upfrontFee = hintHelpers.predictOpenTroveUpfrontFee(v.i, v.borrowed, v.interestRate);
        v.debt = v.borrowed + v.upfrontFee;
        v.coll = v.debt * v.icr / _price[v.i];
        v.troveId = _troveIdOf(v.i, msg.sender);
        v.wasOpen = _isOpen(v.i, v.troveId);

        Trove storage trove = _troves[v.i][v.troveId];
        Batch storage batch = _batches[v.i][v.batchManager];

        if (v.join) info("batch manager: ", vm.getLabel(v.batchManager));
        info("upper hint: ", _hintToString(v.i, v.upperHint));
        info("lower hint: ", _hintToString(v.i, v.lowerHint));
        info("upfront fee: ", v.upfrontFee.decimal());

        logCall(
            v.join ? "openTroveAndJoinInterestBatchManager" : "openTrove",
            v.i.toString(),
            v.borrowed.decimal(),
            v.icr.decimal(),
            v.join ? v.batchManagerSeed.toString() : v.interestRate.decimal(),
            v.upperHintSeed.toString(),
            v.lowerHintSeed.toString()
        );

        // TODO: randomly deal less than coll?
        _dealCollAndApprove(v.i, msg.sender, v.coll, address(v.c.borrowerOperations));
        _dealWETHAndApprove(msg.sender, ETH_GAS_COMPENSATION, address(v.c.borrowerOperations));

        vm.prank(msg.sender);
        try _functionCaller.call(address(v.c.borrowerOperations), _encodeOpenTrove(v)) {
            uint256 icr_ = _CR(v.i, v.coll, v.debt); // can be slightly different from `icr` due to int division
            uint256 newTCR = _TCR(v.i);

            // Preconditions
            if (v.join) {
                assertTrue(_batchManagers[v.i].has(v.batchManager), "Should have failed as batch manager wasn't valid");
            } else {
                assertGeDecimal(v.interestRate, MIN_ANNUAL_INTEREST_RATE, 18, "Should have failed as rate < min");
                assertLeDecimal(v.interestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Should have failed as rate > max");
            }

            assertFalse(isShutdown[v.i], "Should have failed as branch had been shut down");
            assertFalse(v.wasOpen, "Should have failed as Trove was open");
            assertGeDecimal(v.debt, MIN_DEBT, 18, "Should have failed as debt < min");
            if (!v.join) assertGeDecimal(icr_, MCR[v.i], 18, "Should have failed as ICR < MCR");
            if (v.join) assertGeDecimal(icr_, MCR[v.i] + BCR[v.i], 18, "Should have failed as ICR < MCR + BCR");
            assertGeDecimal(newTCR, CCR[v.i], 18, "Should have failed as new TCR < CCR");

            // Effects (Trove)
            trove.coll = v.coll;
            trove.debt = v.debt;
            trove.interestRate = v.join ? batch.interestRate : v.interestRate;
            trove.batchManagementRate = v.join ? batch.managementRate : 0;
            _batchManagerOf[v.i][v.troveId] = v.join ? v.batchManager : address(0);
            _troveIds[v.i].add(v.troveId);

            // Effects (batch)
            if (v.join) {
                batch.troves.add(v.troveId);
                _touchBatch(v.i, v.batchManager);
            }

            // Effects (system)
            _mintYield(v.i, v.pendingInterest, v.upfrontFee);
        } catch (bytes memory revertData) {
            bytes4 selector;
            (selector, v.errorString) = _decodeCustomError(revertData);

            // Justify failures
            if (selector == BorrowerOperations.InvalidInterestBatchManager.selector) {
                assertTrue(v.join, "Shouldn't have failed as a batch wasn't joined");
                assertFalse(_batchManagers[v.i].has(v.batchManager), "Shouldn't have failed as batch manager was valid");
            } else if (selector == BorrowerOperations.InterestRateTooLow.selector) {
                assertFalse(v.join, "Shouldn't have failed as a batch was joined");
                assertLtDecimal(v.interestRate, MIN_ANNUAL_INTEREST_RATE, 18, "Shouldn't have failed as rate >= min");
            } else if (selector == BorrowerOperations.InterestRateTooHigh.selector) {
                assertFalse(v.join, "Shouldn't have failed as a batch was joined");
                assertGtDecimal(v.interestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Shouldn't have failed as rate <= max");
            } else if (selector == BorrowerOperations.IsShutDown.selector) {
                assertTrue(isShutdown[v.i], "Shouldn't have failed as branch hadn't been shut down");
            } else if (selector == BorrowerOperations.TroveExists.selector) {
                // We increment `_troveIndexOf` whenever a Trove is closed, thus it always points to a Trove that's
                // either non-existent or open. Thus, not being open implies that the Trove doesn't exist.
                assertTrue(v.wasOpen, "Shouldn't have failed as Trove didn't exist");
            } else if (selector == BorrowerOperations.DebtBelowMin.selector) {
                assertLtDecimal(v.debt, MIN_DEBT, 18, "Shouldn't have failed as debt >= min");
            } else if (selector == BorrowerOperations.ICRBelowMCR.selector) {
                assertFalse(v.join, "Shouldn't have thrown ICRBelowMCR as a batch was joined");
                uint256 icr_ = _CR(v.i, v.coll, v.debt);
                assertLtDecimal(icr_, MCR[v.i], 18, "Shouldn't have failed as ICR >= MCR");
            } else if (selector == BorrowerOperations.ICRBelowMCRPlusBCR.selector) {
                assertTrue(v.join, "Shouldn't have thrown ICRBelowMCRPlusBCR as a batch wasn't joined");
                uint256 icr_ = _CR(v.i, v.coll, v.debt);
                assertLtDecimal(icr_, MCR[v.i] + BCR[v.i], 18, "Shouldn't have failed as ICR >= MCR + BCR");
            } else if (selector == BorrowerOperations.TCRBelowCCR.selector) {
                uint256 newTCR = _TCR(v.i, int256(v.coll), int256(v.borrowed), v.upfrontFee);
                assertLtDecimal(newTCR, CCR[v.i], 18, "Shouldn't have failed as new TCR >= CCR");
                info("New TCR would have been: ", newTCR.decimal());
            } else {
                revert(string.concat("Unexpected error: ", v.errorString));
            }
        }

        if (bytes(v.errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", v.errorString);
            _log();

            // Cleanup (failure)
            _sweepCollAndUnapprove(v.i, msg.sender, v.coll, address(v.c.borrowerOperations));
            _sweepWETHAndUnapprove(msg.sender, ETH_GAS_COMPENSATION, address(v.c.borrowerOperations));
        } else {
            // Cleanup (success)
            _sweepBold(msg.sender, v.borrowed);
            if (v.join) _sweepBold(v.batchManager, v.batchManagementFee);
        }
    }

    function adjustTrove(
        uint256 i,
        uint8 prop,
        uint256 collChange,
        bool isCollInc,
        uint256 debtChange,
        bool isDebtInc,
        uint32 useZombieSeed,
        uint32 upperHintSeed,
        uint32 lowerHintSeed
    ) external {
        AdjustTroveContext memory v;

        v.i = i = _bound(i, 0, branches.length - 1);
        v.prop = AdjustedTroveProperties(_bound(prop, 0, uint8(AdjustedTroveProperties._COUNT) - 1));
        useZombieSeed %= 100;
        v.upperHint = _pickHint(i, upperHintSeed);
        v.lowerHint = _pickHint(i, lowerHintSeed);

        v.c = branches[i];
        v.pendingInterest = v.c.activePool.calcPendingAggInterest();
        v.oldTCR = _TCR(i);
        v.troveId = _troveIdOf(i, msg.sender);
        v.t = v.c.troveManager.getLatestTroveData(v.troveId);
        v.batchManager = _batchManagerOf[i][v.troveId];
        v.batchManagementFee = v.c.troveManager.getLatestBatchData(v.batchManager).accruedManagementFee;
        v.trove = _troves[i][v.troveId];
        v.wasActive = _isActive(i, v.troveId);
        v.wasZombie = _isZombie(i, v.troveId);

        if (v.wasActive || v.wasZombie) {
            // Choose the wrong type of adjustment 1% of the time
            if (v.wasZombie) {
                v.useZombie = useZombieSeed != 0;
            } else {
                v.useZombie = useZombieSeed == 0;
            }
        } else {
            // Choose with equal probability between normal vs. zombie adjustment
            v.useZombie = useZombieSeed < 50;
        }

        collChange = v.prop != AdjustedTroveProperties.onlyDebt ? _bound(collChange, 0, v.t.entireColl + 1) : 0;
        debtChange = v.prop != AdjustedTroveProperties.onlyColl ? _bound(debtChange, 0, v.t.entireDebt + 1) : 0;
        if (!isDebtInc) debtChange = Math.min(debtChange, _handlerBold);
        v.maxDebtDec = v.t.entireDebt > MIN_DEBT ? v.t.entireDebt - MIN_DEBT : 0;
        v.collDelta = isCollInc ? int256(collChange) : -int256(collChange);
        v.debtDelta = isDebtInc ? int256(debtChange) : -int256(Math.min(debtChange, v.maxDebtDec));
        v.$collDelta36 = v.collDelta * int256(_price[i]);
        v.upfrontFee = hintHelpers.predictAdjustTroveUpfrontFee(i, v.troveId, isDebtInc ? debtChange : 0);
        if (v.upfrontFee > 0) assertGtDecimal(v.debtDelta, 0, 18, "Only debt increase should incur upfront fee");
        v.functionName = _getAdjustmentFunctionName(v.prop, isCollInc, isDebtInc, v.useZombie);

        info("upper hint: ", _hintToString(i, v.upperHint));
        info("lower hint: ", _hintToString(i, v.lowerHint));
        info("upfront fee: ", v.upfrontFee.decimal());
        info("function: ", v.functionName);

        logCall(
            "adjustTrove",
            i.toString(),
            v.prop.toString(),
            collChange.decimal(),
            isCollInc.toString(),
            debtChange.decimal(),
            isDebtInc.toString(),
            useZombieSeed.toString(),
            upperHintSeed.toString(),
            lowerHintSeed.toString()
        );

        // TODO: randomly deal less?
        if (isCollInc) _dealCollAndApprove(i, msg.sender, collChange, address(v.c.borrowerOperations));
        if (!isDebtInc) _dealBold(msg.sender, debtChange);

        vm.prank(msg.sender);
        try _functionCaller.call(
            address(v.c.borrowerOperations),
            v.useZombie
                ? _encodeZombieTroveAdjustment(
                    v.troveId, collChange, isCollInc, debtChange, isDebtInc, v.upperHint, v.lowerHint, v.upfrontFee
                )
                : _encodeActiveTroveAdjustment(
                    v.prop, v.troveId, collChange, isCollInc, debtChange, isDebtInc, v.upfrontFee
                )
        ) {
            v.newICR = _ICR(i, v.troveId);
            v.newTCR = _TCR(i);

            // Preconditions
            assertFalse(isShutdown[i], "Should have failed as branch had been shut down");
            assertFalse(v.collDelta == 0 && v.debtDelta == 0, "Should have failed as there was no change");
            if (v.useZombie) assertTrue(v.wasZombie, "Should have failed as Trove wasn't zombie");
            if (!v.useZombie) assertTrue(v.wasActive, "Should have failed as Trove wasn't active");
            assertLeDecimal(-v.collDelta, int256(v.t.entireColl), 18, "Should have failed as withdrawal > coll");
            assertLeDecimal(-v.debtDelta, int256(v.t.entireDebt), 18, "Should have failed as repayment > debt");
            v.newDebt = v.t.entireDebt.add(v.debtDelta) + v.upfrontFee;
            assertGeDecimal(v.newDebt, MIN_DEBT, 18, "Should have failed as new debt < MIN_DEBT");

            if (v.batchManager == address(0)) {
                assertGeDecimal(v.newICR, MCR[i], 18, "Should have failed as new ICR < MCR");
            } else {
                assertGeDecimal(v.newICR, MCR[i] + BCR[i], 18, "Should have failed as new ICR < MCR + BCR");
            }

            if (v.oldTCR >= CCR[i]) {
                assertGeDecimal(v.newTCR, CCR[i], 18, "Should have failed as new TCR < CCR");
            } else {
                if (v.debtDelta > 0) {
                    assertGtDecimal(v.newTCR, CCR[i], 18, "Borrowing should have failed as new TCR < CCR");
                }
                assertGeDecimal(-v.debtDelta * 1e18, -v.$collDelta36, 36, "Repayment < withdrawal when TCR < CCR");
            }

            // Effects (Trove)
            v.trove.applyPending();
            v.trove.coll = v.trove.coll.add(v.collDelta);
            v.trove.debt = v.trove.debt.add(v.debtDelta) + v.upfrontFee;
            _troves[i][v.troveId] = v.trove;
            _zombieTroveIds[i].remove(v.troveId);
            if (designatedVictimId[i] == v.troveId) designatedVictimId[i] = 0;

            // Effects (batch)
            if (v.batchManager != address(0)) _touchBatch(i, v.batchManager);

            // Effects (system)
            _mintYield(i, v.pendingInterest, v.upfrontFee);
        } catch (bytes memory revertData) {
            bytes4 selector;
            (selector, v.errorString) = _decodeCustomError(revertData);

            // Justify failures
            if (selector == BorrowerOperations.IsShutDown.selector) {
                assertTrue(isShutdown[i], "Shouldn't have failed as branch hadn't been shut down");
            } else if (selector == BorrowerOperations.ZeroAdjustment.selector) {
                assertEqDecimal(v.collDelta, 0, 18, "Shouldn't have failed as there was a coll change");
                assertEqDecimal(v.debtDelta, 0, 18, "Shouldn't have failed as there was a debt change");
            } else if (selector == BorrowerOperations.TroveNotActive.selector) {
                assertFalse(v.useZombie, string.concat("Shouldn't have been thrown by ", v.functionName));
                assertFalse(v.wasActive, "Shouldn't have failed as Trove was active");
            } else if (selector == BorrowerOperations.TroveNotZombie.selector) {
                assertTrue(v.useZombie, string.concat("Shouldn't have been thrown by ", v.functionName));
                assertFalse(v.wasZombie, "Shouldn't have failed as Trove was zombie");
            } else if (selector == BorrowerOperations.CollWithdrawalTooHigh.selector) {
                assertGtDecimal(-v.collDelta, int256(v.t.entireColl), 18, "Shouldn't have failed as withdrawal <= coll");
            } else if (selector == BorrowerOperations.DebtBelowMin.selector) {
                v.newDebt = (v.t.entireDebt + v.upfrontFee).add(v.debtDelta);
                assertLtDecimal(v.newDebt, MIN_DEBT, 18, "Shouldn't have failed as new debt >= MIN_DEBT");
                info("New debt would have been: ", v.newDebt.decimal());
            } else if (selector == BorrowerOperations.ICRBelowMCR.selector) {
                assertEq(v.batchManager, address(0), "Shouldn't have thrown ICRBelowMCR as Trove was in a batch");
                v.newICR = _ICR(i, v.collDelta, v.debtDelta, v.upfrontFee, v.t);
                assertLtDecimal(v.newICR, MCR[i], 18, "Shouldn't have failed as new ICR >= MCR");
                info("New ICR would have been: ", v.newICR.decimal());
            } else if (selector == BorrowerOperations.ICRBelowMCRPlusBCR.selector) {
                assertNotEq(
                    v.batchManager, address(0), "Shouldn't have thrown ICRBelowMCRPlusBCR as Trove wasn't in a batch"
                );
                v.newICR = _ICR(v.i, v.collDelta, v.debtDelta, v.upfrontFee, v.t);
                assertLtDecimal(v.newICR, MCR[v.i] + BCR[v.i], 18, "Shouldn't have failed as new ICR >= MCR + BCR");
                info("New ICR would have been: ", v.newICR.decimal());
            } else if (selector == BorrowerOperations.TCRBelowCCR.selector) {
                v.newTCR = _TCR(i, v.collDelta, v.debtDelta, v.upfrontFee);
                assertLtDecimal(v.newTCR, CCR[i], 18, "Shouldn't have failed as new TCR >= CCR");
                info("New TCR would have been: ", v.newTCR.decimal());
            } else if (selector == BorrowerOperations.RepaymentNotMatchingCollWithdrawal.selector) {
                assertLtDecimal(v.oldTCR, CCR[i], 18, "Shouldn't have failed as TCR >= CCR");
                assertLtDecimal(
                    -v.debtDelta * 1e18, -v.$collDelta36, 36, "Shouldn't have failed as repayment >= withdrawal"
                );
            } else {
                revert(string.concat("Unexpected error: ", v.errorString));
            }
        }

        if (bytes(v.errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", v.errorString);
            _log();

            // Cleanup (failure)
            if (isCollInc) _sweepCollAndUnapprove(i, msg.sender, collChange, address(v.c.borrowerOperations));
            if (!isDebtInc) _sweepBold(msg.sender, debtChange);
        } else {
            // Cleanup (success)
            if (!isCollInc) _sweepColl(i, msg.sender, collChange);
            if (isDebtInc) _sweepBold(msg.sender, debtChange);
            // Take back remaining BOLD after repayment truncation
            if (!isDebtInc) _sweepBold(msg.sender, debtChange - uint256(-v.debtDelta));
            if (v.batchManager != address(0)) _sweepBold(v.batchManager, v.batchManagementFee);
        }
    }

    function adjustTroveInterestRate(uint256 i, uint256 newInterestRate, uint32 upperHintSeed, uint32 lowerHintSeed)
        external
    {
        AdjustTroveInterestRateContext memory v;

        i = _bound(i, 0, branches.length - 1);
        newInterestRate = _bound(newInterestRate, INTEREST_RATE_MIN, INTEREST_RATE_MAX);
        v.upperHint = _pickHint(i, upperHintSeed);
        v.lowerHint = _pickHint(i, lowerHintSeed);

        v.c = branches[i];
        v.pendingInterest = v.c.activePool.calcPendingAggInterest();
        v.troveId = _troveIdOf(i, msg.sender);
        v.batchManager = _batchManagerOf[i][v.troveId];
        v.t = v.c.troveManager.getLatestTroveData(v.troveId);
        v.trove = _troves[i][v.troveId];
        v.wasActive = _isActive(i, v.troveId);
        v.premature = newInterestRate != v.t.annualInterestRate
            && _timeSinceLastTroveInterestRateAdjustment[i][v.troveId] < INTEREST_RATE_ADJ_COOLDOWN;

        if (v.batchManager == address(0)) {
            v.upfrontFee = hintHelpers.predictAdjustInterestRateUpfrontFee(i, v.troveId, newInterestRate);
            if (v.upfrontFee > 0) assertTrue(v.premature, "Only premature adjustment should incur upfront fee");
        }

        info("upper hint: ", _hintToString(i, v.upperHint));
        info("lower hint: ", _hintToString(i, v.lowerHint));
        info("upfront fee: ", v.upfrontFee.decimal());

        logCall(
            "adjustTroveInterestRate",
            i.toString(),
            newInterestRate.decimal(),
            upperHintSeed.toString(),
            lowerHintSeed.toString()
        );

        vm.prank(msg.sender);
        try v.c.borrowerOperations.adjustTroveInterestRate(
            v.troveId, newInterestRate, v.upperHint, v.lowerHint, v.upfrontFee
        ) {
            uint256 newICR = _ICR(i, v.troveId);
            uint256 newTCR = _TCR(i);

            // Preconditions
            assertFalse(isShutdown[i], "Should have failed as branch had been shut down");
            assertTrue(v.wasActive, "Should have failed as Trove wasn't active");
            assertEq(v.batchManager, address(0), "Should have failed as Trove was in a batch");
            assertNotEqDecimal(newInterestRate, v.t.annualInterestRate, 18, "Should have failed as rate == old");
            assertGeDecimal(newInterestRate, MIN_ANNUAL_INTEREST_RATE, 18, "Should have failed as rate < min");
            assertLeDecimal(newInterestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Should have failed as rate > max");

            if (v.premature) {
                assertGeDecimal(newICR, MCR[i], 18, "Should have failed as new ICR < MCR");
                assertGeDecimal(newTCR, CCR[i], 18, "Should have failed as new TCR < CCR");
            }

            // Effects (Trove)
            v.trove.applyPending();
            v.trove.debt += v.upfrontFee;
            v.trove.interestRate = newInterestRate;
            _troves[i][v.troveId] = v.trove;
            _timeSinceLastTroveInterestRateAdjustment[i][v.troveId] = 0;

            // Effects (system)
            _mintYield(i, v.pendingInterest, v.upfrontFee);
        } catch Error(string memory reason) {
            v.errorString = reason;

            // Justify failures
            if (reason.equals("ERC721: invalid token ID")) {
                assertFalse(_isOpen(i, v.troveId), "Open Trove should have an NFT");
            } else {
                revert(reason);
            }
        } catch (bytes memory revertData) {
            bytes4 selector;
            (selector, v.errorString) = _decodeCustomError(revertData);

            // Justify failures
            if (selector == BorrowerOperations.IsShutDown.selector) {
                assertTrue(isShutdown[i], "Shouldn't have failed as branch hadn't been shut down");
            } else if (selector == BorrowerOperations.TroveNotActive.selector) {
                assertFalse(v.wasActive, "Shouldn't have failed as Trove was active");
            } else if (selector == BorrowerOperations.TroveInBatch.selector) {
                assertNotEq(v.batchManager, address(0), "Shouldn't have failed as Trove wasn't in a batch");
            } else if (selector == BorrowerOperations.InterestRateNotNew.selector) {
                assertEqDecimal(newInterestRate, v.t.annualInterestRate, 18, "Shouldn't have failed as rate != old");
            } else if (selector == BorrowerOperations.InterestRateTooLow.selector) {
                assertLtDecimal(newInterestRate, MIN_ANNUAL_INTEREST_RATE, 18, "Shouldn't have failed as rate >= min");
            } else if (selector == BorrowerOperations.InterestRateTooHigh.selector) {
                assertGtDecimal(newInterestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Shouldn't have failed as rate <= max");
            } else if (selector == BorrowerOperations.ICRBelowMCR.selector) {
                uint256 newICR = _ICR(i, 0, 0, v.upfrontFee, v.t);
                assertTrue(v.premature, "Shouldn't have failed as adjustment was not premature");
                assertLtDecimal(newICR, MCR[i], 18, "Shouldn't have failed as new ICR >= MCR");
                info("New ICR would have been: ", newICR.decimal());
            } else if (selector == BorrowerOperations.TCRBelowCCR.selector) {
                uint256 newTCR = _TCR(i, 0, 0, v.upfrontFee);
                assertTrue(v.premature, "Shouldn't have failed as adjustment was not premature");
                assertLtDecimal(newTCR, CCR[i], 18, "Shouldn't have failed as new TCR >= CCR");
                info("New TCR would have been: ", newTCR.decimal());
            } else {
                revert(string.concat("Unexpected error: ", v.errorString));
            }
        }

        if (bytes(v.errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", v.errorString);
            _log();
        }
    }

    function closeTrove(uint256 i) external {
        CloseTroveContext memory v;

        i = _bound(i, 0, branches.length - 1);

        v.c = branches[i];
        v.pendingInterest = v.c.activePool.calcPendingAggInterest();
        v.troveId = _troveIdOf(i, msg.sender);
        v.t = v.c.troveManager.getLatestTroveData(v.troveId);
        v.batchManager = _batchManagerOf[i][v.troveId];
        v.batchManagementFee = v.c.troveManager.getLatestBatchData(v.batchManager).accruedManagementFee;
        v.wasOpen = _isOpen(i, v.troveId);

        logCall("closeTrove", i.toString());

        v.dealt = Math.min(v.t.entireDebt, _handlerBold);
        _dealBold(msg.sender, v.dealt);

        vm.prank(msg.sender);
        try v.c.borrowerOperations.closeTrove(v.troveId) {
            uint256 newTCR = _TCR(i);

            // Preconditions
            assertTrue(v.wasOpen, "Should have failed as Trove wasn't open");
            if (!isShutdown[i]) assertGt(numTroves(i), 1, "Should have failed to close last Trove in the system");
            if (!isShutdown[i]) assertGeDecimal(newTCR, CCR[i], 18, "Should have failed as new TCR < CCR");

            // Effects (Trove)
            delete _troves[i][v.troveId];
            delete _batchManagerOf[i][v.troveId];
            delete _timeSinceLastTroveInterestRateAdjustment[i][v.troveId];
            ++_troveIndexOf[i][msg.sender];
            _troveIds[i].remove(v.troveId);
            _zombieTroveIds[i].remove(v.troveId);
            if (designatedVictimId[i] == v.troveId) designatedVictimId[i] = 0;

            // Effects (batch)
            if (v.batchManager != address(0)) {
                _batches[i][v.batchManager].troves.remove(v.troveId);
                _touchBatch(i, v.batchManager);
            }

            // Effects (system)
            _mintYield(i, v.pendingInterest, 0);
        } catch Error(string memory reason) {
            v.errorString = reason;

            // Justify failures
            if (reason.equals("ERC721: invalid token ID")) {
                assertFalse(v.wasOpen, "Open Trove should have an NFT");
            } else {
                revert(reason);
            }
        } catch (bytes memory revertData) {
            bytes4 selector;
            (selector, v.errorString) = _decodeCustomError(revertData);

            // Justify failures
            if (selector == BorrowerOperations.NotEnoughBoldBalance.selector) {
                assertLtDecimal(v.dealt, v.t.entireDebt, 18, "Shouldn't have failed as caller had enough Bold");
            } else if (selector == BorrowerOperations.TCRBelowCCR.selector) {
                uint256 newTCR = _TCR(i, -int256(v.t.entireColl), -int256(v.t.entireDebt), 0);
                assertFalse(isShutdown[i], "Shouldn't have failed as branch had been shut down");
                assertLtDecimal(newTCR, CCR[i], 18, "Shouldn't have failed as new TCR >= CCR");
                info("New TCR would have been: ", newTCR.decimal());
            } else if (selector == TroveManager.OnlyOneTroveLeft.selector) {
                assertEq(numTroves(i), 1, "Shouldn't have failed as there was at least one Trove left in the system");
            } else {
                revert(string.concat("Unexpected error: ", v.errorString));
            }
        }

        if (bytes(v.errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", v.errorString);
            _log();

            // Cleanup (failure)
            _sweepBold(msg.sender, v.dealt);
        } else {
            // Cleanup (success)
            _sweepColl(i, msg.sender, v.t.entireColl);
            _sweepWETH(msg.sender, ETH_GAS_COMPENSATION);
            if (v.batchManager != address(0)) _sweepBold(v.batchManager, v.batchManagementFee);
        }
    }

    function addMeToLiquidationBatch() external {
        logCall("addMeToLiquidationBatch");
        _addToLiquidationBatch(msg.sender);
    }

    function batchLiquidateTroves(uint256 i) external {
        i = _bound(i, 0, branches.length - 1);

        TestDeployer.LiquityContractsDev memory c = branches[i];
        uint256 pendingInterest = c.activePool.calcPendingAggInterest();
        LiquidationTransientState storage l = _planLiquidation(i);

        uint256[] memory batchManagementFee = new uint256[](l.batchManagers.size());
        for (uint256 j = 0; j < l.batchManagers.size(); ++j) {
            batchManagementFee[j] = c.troveManager.getLatestBatchData(l.batchManagers.get(j)).accruedManagementFee;
        }

        info("batch: [", _labelsFrom(l.batch).join(", "), "]");
        info("liquidated: [", _labelsFrom(l.liquidated).join(", "), "]");
        info("SP offset: ", l.t.spOffset.decimal());
        info("coll redist: ", l.t.collRedist.decimal());
        info("debt redist: ", l.t.debtRedist.decimal());
        logCall("batchLiquidateTroves", i.toString());

        string memory errorString;
        vm.prank(msg.sender);

        try c.troveManager.batchLiquidateTroves(_troveIdsFrom(i, l.batch)) {
            info("SP BOLD: ", c.stabilityPool.getTotalBoldDeposits().decimal());
            info("P: ", c.stabilityPool.P().decimal());
            _log();

            // Preconditions
            assertGt(l.batch.length, 0, "Should have failed as batch was empty");
            assertGt(l.liquidated.size(), 0, "Should have failed as there was nothing to liquidate");
            assertGt(numTroves(i) - l.liquidated.size(), 0, "Should have failed to liquidate last Trove");

            // Effects (Troves)
            for (uint256 j = 0; j < l.liquidated.size(); ++j) {
                address owner = l.liquidated.get(j);
                uint256 troveId = _troveIdOf(i, owner);
                address batchManager = _batchManagerOf[i][troveId];
                delete _troves[i][troveId];
                delete _batchManagerOf[i][troveId];
                delete _timeSinceLastTroveInterestRateAdjustment[i][troveId];
                ++_troveIndexOf[i][owner];
                _troveIds[i].remove(troveId);
                _zombieTroveIds[i].remove(troveId);
                if (designatedVictimId[i] == troveId) designatedVictimId[i] = 0;
                if (batchManager != address(0)) _batches[i][batchManager].troves.remove(troveId);
            }

            if (l.t.debtRedist > 0) {
                uint256[] memory stakes = new uint256[](_troveIds[i].size());
                uint256 totalStakes = 0;

                for (uint256 j = 0; j < _troveIds[i].size(); ++j) {
                    Trove memory trove = _troves[i][_troveIds[i].get(j)];
                    trove.applyPendingRedist();
                    totalStakes += stakes[j] = trove.coll;
                }

                assertGtDecimal(totalStakes, 0, 18, "No stakes");

                for (uint256 j = 0; j < _troveIds[i].size(); ++j) {
                    uint256 stake = stakes[j];
                    uint256 troveId = _troveIds[i].get(j);
                    Trove memory trove = _troves[i][troveId];
                    trove.redist(l.t.collRedist * stake / totalStakes, l.t.debtRedist * stake / totalStakes);
                    _troves[i][troveId] = trove;
                }
            }

            // Effects (batches)
            for (uint256 j = 0; j < l.batchManagers.size(); ++j) {
                _touchBatch(i, l.batchManagers.get(j));
            }

            // Effects (system)
            _mintYield(i, pendingInterest, 0);
            spColl[i] += l.t.spCollGain;
            spBoldDeposits[i] -= l.t.spOffset;
            collSurplus[i] += l.t.collSurplus;
            totalCollRedist[i] += l.t.collRedist;
            totalDebtRedist[i] += l.t.debtRedist;
        } catch Panic(uint256 code) {
            uint256 totalStakes = 0;

            for (uint256 j = 0; j < l.remaining.size(); ++j) {
                Trove memory trove = _troves[i][l.remaining.get(j)];
                trove.applyPendingRedist();
                totalStakes += trove.coll;
            }

            assertEq(code, 0x12, "Unexpected panic code");
            assertGtDecimal(l.t.debtRedist, 0, 18, "Shouldn't have failed as there was nothing to redistribute");
            assertApproxEqAbsDecimal(totalStakes, 0, 1e5, 18, "Shouldn't have failed as there was stake remaining");
            errorString = "Division by zero due to totalStakes == 0";
        } catch (bytes memory revertData) {
            bytes4 selector;
            (selector, errorString) = _decodeCustomError(revertData);

            // Justify failures
            if (selector == TroveManager.EmptyData.selector) {
                assertEq(l.batch.length, 0, "Shouldn't have failed as batch was not empty");
            } else if (selector == TroveManager.NothingToLiquidate.selector) {
                assertEq(l.liquidated.size(), 0, "Shouldn't have failed as there were liquidatable Troves");
            } else if (selector == TroveManager.OnlyOneTroveLeft.selector) {
                assertEq(numTroves(i) - l.liquidated.size(), 0, "Shouldn't have failed as there were Troves left");
            } else {
                revert(string.concat("Unexpected error: ", errorString));
            }
        }

        if (bytes(errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", errorString);
            _log();
        } else {
            // Cleanup (success)
            _sweepColl(i, msg.sender, l.t.collGasComp);
            _sweepWETH(msg.sender, l.liquidated.size() * ETH_GAS_COMPENSATION);

            for (uint256 j = 0; j < l.batchManagers.size(); ++j) {
                _sweepBold(l.batchManagers.get(j), batchManagementFee[j]);
            }
        }

        _resetLiquidation();
    }

    function redeemCollateral(uint256 amount, uint256 maxIterationsPerCollateral) external {
        uint256 maxNumTroves = 0;

        for (uint256 i = 0; i < branches.length; ++i) {
            maxNumTroves = Math.max(numTroves(i), maxNumTroves);
        }

        amount = _bound(amount, 0, _handlerBold);
        maxIterationsPerCollateral = _bound(maxIterationsPerCollateral, 0, maxNumTroves * 11 / 10);

        uint256 totalUnbacked = _getTotalUnbacked();
        if (totalUnbacked > 0) amount = Math.min(amount, totalUnbacked);

        uint256 oldBaseRate = _getBaseRate();
        uint256 boldSupply = boldToken.totalSupply();
        uint256 redemptionRate = _getRedemptionRate(oldBaseRate + _getBaseRateIncrease(boldSupply, amount));

        uint256[] memory pendingInterest = new uint256[](branches.length);
        for (uint256 i = 0; i < branches.length; ++i) {
            pendingInterest[i] = branches[i].activePool.calcPendingAggInterest();
        }

        (uint256 totalDebtRedeemed, mapping(uint256 branchIdx => RedemptionTransientState) storage r) =
            _planRedemption(amount, maxIterationsPerCollateral, redemptionRate);
        assertLeDecimal(totalDebtRedeemed, amount, 18, "Total redeemed exceeds input amount");

        uint256[][] memory batchManagementFee = new uint256[][](branches.length);
        for (uint256 j = 0; j < branches.length; ++j) {
            batchManagementFee[j] = new uint256[](r[j].batchManagers.size());
            for (uint256 i = 0; i < r[j].batchManagers.size(); ++i) {
                batchManagementFee[j][i] =
                    branches[j].troveManager.getLatestBatchData(r[j].batchManagers.get(i)).accruedManagementFee;
            }
        }

        info("redemption rate: ", redemptionRate.decimal());
        info("redeemed BOLD: ", totalDebtRedeemed.decimal());
        info("redeemed Troves: [");
        for (uint256 i = 0; i < branches.length; ++i) {
            info("  [", isShutdown[i] ? "/* shutdown */" : _labelsFrom(i, r[i].redeemed).join(", "), "],");
        }
        info("]");
        logCall("redeemCollateral", amount.decimal(), maxIterationsPerCollateral.toString());

        // TODO: randomly deal less than amount?
        _dealBold(msg.sender, amount);

        string memory errorString;
        vm.prank(msg.sender);

        try collateralRegistry.redeemCollateral(amount, maxIterationsPerCollateral, redemptionRate) {
            // Preconditions
            assertGtDecimal(amount, 0, 18, "Should have failed as amount was zero");

            // Effects (global)
            _baseRate = Math.min(oldBaseRate + _getBaseRateIncrease(boldSupply, totalDebtRedeemed), _100pct);
            _timeSinceLastRedemption %= ONE_MINUTE;

            for (uint256 j = 0; j < branches.length; ++j) {
                if (r[j].attemptedAmount == 0) continue; // no effects on unredeemed branches

                // Effects (Troves)
                for (uint256 i = 0; i < r[j].redeemed.length; ++i) {
                    Redeemed storage redeemed = r[j].redeemed[i];
                    Trove memory trove = _troves[j][redeemed.troveId];
                    trove.applyPending();

                    if (redeemed.coll > trove.coll) {
                        // There can be a slight discrepancy when hitting batched Troves
                        assertApproxEq(redeemed.coll, trove.coll, 1e8, "Coll underflow");
                        trove.coll = 0;
                    } else {
                        trove.coll -= redeemed.coll;
                    }

                    if (redeemed.debt > trove.debt) {
                        // There can be a slight discrepancy when hitting batched Troves
                        assertApproxEq(redeemed.debt, trove.debt, 1e8, "Debt underflow");
                        trove.debt = 0;
                    } else {
                        trove.debt -= redeemed.debt;
                    }

                    _troves[j][redeemed.troveId] = trove;

                    if (redeemed.becomesZombie) _zombieTroveIds[j].add(redeemed.troveId);
                }

                designatedVictimId[j] = r[j].newDesignatedVictimId;

                // Effects (batches)
                for (uint256 i = 0; i < r[j].batchManagers.size(); ++i) {
                    _touchBatch(j, r[j].batchManagers.get(i));
                }

                // Effects (system)
                _mintYield(j, pendingInterest[j], 0);
            }
        } catch Error(string memory reason) {
            errorString = reason;

            // Justify failures
            if (reason.equals("CollateralRegistry: Amount must be greater than zero")) {
                assertEqDecimal(amount, 0, 18, "Shouldn't have failed as amount was greater than zero");
            } else {
                revert(reason);
            }
        }

        if (bytes(errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", errorString);
            _log();

            // Cleanup (failure)
            _sweepBold(msg.sender, amount);
        } else {
            // Cleanup (success)
            for (uint256 j = 0; j < branches.length; ++j) {
                // There can be a slight discrepancy when hitting batched Troves
                uint256 collReceived = branches[j].collToken.balanceOf(msg.sender);
                assertApproxEqAbsDecimal(collReceived, r[j].totalCollRedeemed, 1e5, 18, "Wrong coll amount received");
                _sweepColl(j, msg.sender, collReceived);

                for (uint256 i = 0; i < r[j].batchManagers.size(); ++i) {
                    _sweepBold(r[j].batchManagers.get(i), batchManagementFee[j][i]);
                }
            }

            // There can be a slight discrepancy when hitting batched Troves
            uint256 remainingAmount = boldToken.balanceOf(msg.sender);
            assertApproxEqAbsDecimal(remainingAmount, amount - totalDebtRedeemed, 1e5, 18, "Wrong remaining BOLD");
            _sweepBold(msg.sender, remainingAmount);
        }

        _resetRedemption();
    }

    function shutdown(uint256 i) external {
        i = _bound(i, 0, branches.length - 1);
        TestDeployer.LiquityContractsDev memory c = branches[i];
        uint256 pendingInterest = c.activePool.calcPendingAggInterest();
        uint256 tcr = _TCR(i);

        logCall("shutdown", i.toString());

        string memory errorString;
        vm.prank(msg.sender);

        try c.borrowerOperations.shutdown() {
            // Preconditions
            assertLtDecimal(tcr, SCR[i], 18, "Should have failed as TCR >= SCR");
            assertFalse(isShutdown[i], "Should have failed as branch had been shut down");

            // Effects
            isShutdown[i] = true;
            _mintYield(i, pendingInterest, 0);
        } catch (bytes memory revertData) {
            bytes4 selector;
            (selector, errorString) = _decodeCustomError(revertData);

            // Justify failures
            if (selector == BorrowerOperations.TCRNotBelowSCR.selector) {
                assertGeDecimal(tcr, SCR[i], 18, "Shouldn't have failed as TCR < SCR");
            } else if (selector == BorrowerOperations.IsShutDown.selector) {
                assertTrue(isShutdown[i], "Shouldn't have failed as branch hadn't been shut down");
            } else {
                revert(string.concat("Unexpected error: ", errorString));
            }
        }

        if (bytes(errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", errorString);
            _log();
        }
    }

    function addMeToUrgentRedemptionBatch() external {
        logCall("addMeToUrgentRedemptionBatch");
        _addToUrgentRedemptionBatch(msg.sender);
    }

    function urgentRedemption(uint256 i, uint256 amount) external {
        i = _bound(i, 0, branches.length - 1);
        amount = _bound(amount, 0, _handlerBold);

        TestDeployer.LiquityContractsDev memory c = branches[i];
        uint256 pendingInterest = c.activePool.calcPendingAggInterest();
        UrgentRedemptionTransientState storage r = _planUrgentRedemption(i, amount);
        assertLeDecimal(r.totalDebtRedeemed, amount, 18, "Total redeemed exceeds input amount");

        uint256[] memory batchManagementFee = new uint256[](r.batchManagers.size());
        for (uint256 j = 0; j < r.batchManagers.size(); ++j) {
            batchManagementFee[j] = c.troveManager.getLatestBatchData(r.batchManagers.get(j)).accruedManagementFee;
        }

        info("redeemed BOLD: ", r.totalDebtRedeemed.decimal());
        info("batch: [", _labelsFrom(r.batch).join(", "), "]");
        logCall("urgentRedemption", i.toString(), amount.decimal());

        // TODO: randomly deal less than amount?
        _dealBold(msg.sender, amount);

        string memory errorString;
        vm.prank(msg.sender);

        try c.troveManager.urgentRedemption(amount, _troveIdsFrom(i, r.batch), r.totalCollRedeemed) {
            // Preconditions
            assertTrue(isShutdown[i], "Should have failed as branch hadn't been shut down");
            assertGtDecimal(amount, 0, 18, "Should have failed as amount was zero");

            // Effects (Troves)
            for (uint256 j = 0; j < r.redeemed.length; ++j) {
                Redeemed storage redeemed = r.redeemed[j];
                Trove memory trove = _troves[i][redeemed.troveId];
                trove.applyPending();

                if (redeemed.coll > trove.coll) {
                    // There can be a slight discrepancy when hitting batched Troves
                    assertApproxEq(redeemed.coll, trove.coll, 1e8, "Coll underflow");
                    trove.coll = 0;
                } else {
                    trove.coll -= redeemed.coll;
                }

                if (redeemed.debt > trove.debt) {
                    // There can be a slight discrepancy when hitting batched Troves
                    assertApproxEq(redeemed.debt, trove.debt, 1e8, "Debt underflow");
                    trove.debt = 0;
                } else {
                    trove.debt -= redeemed.debt;
                }

                _troves[i][redeemed.troveId] = trove;
            }

            // Effects (batches)
            for (uint256 j = 0; j < r.batchManagers.size(); ++j) {
                _touchBatch(i, r.batchManagers.get(j));
            }

            // Effects (system)
            _mintYield(i, pendingInterest, 0);
        } catch (bytes memory revertData) {
            bytes4 selector;
            (selector, errorString) = _decodeCustomError(revertData);

            // Justify failures
            if (selector == TroveManager.NotShutDown.selector) {
                assertFalse(isShutdown[i], "Shouldn't have failed as branch had been shut down");
            } else if (selector == TroveManager.ZeroAmount.selector) {
                assertEqDecimal(amount, 0, 18, "Shouldn't have failed as amount was greater than zero");
            } else if (selector == TroveManager.MinCollNotReached.selector) {
                // There can be a slight discrepancy when hitting batched Troves
                uint256 collReceived = uint256(bytes32(revertData.slice(4)));
                assertLtDecimal(collReceived, r.totalCollRedeemed, 18, "Shouldn't have failed as min coll was reached");
                assertApproxEqAbsDecimal(collReceived, r.totalCollRedeemed, 1e5, 18, "Wrong coll amount received");
            } else {
                revert(string.concat("Unexpected error: ", errorString));
            }
        }

        if (bytes(errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", errorString);
            _log();

            // Cleanup (failure)
            _sweepBold(msg.sender, amount);
        } else {
            // Cleanup (success)

            // There can be a slight discrepancy when hitting batched Troves
            uint256 collReceived = branches[i].collToken.balanceOf(msg.sender);
            assertApproxEqAbsDecimal(collReceived, r.totalCollRedeemed, 1e5, 18, "Wrong coll amount received");
            _sweepColl(i, msg.sender, collReceived);

            for (uint256 j = 0; j < r.batchManagers.size(); ++j) {
                _sweepBold(r.batchManagers.get(j), batchManagementFee[j]);
            }

            // There can be a slight discrepancy when hitting batched Troves
            uint256 remainingAmount = boldToken.balanceOf(msg.sender);
            assertApproxEqAbsDecimal(remainingAmount, amount - r.totalDebtRedeemed, 1e5, 18, "Wrong remaining BOLD");
            _sweepBold(msg.sender, remainingAmount);
        }

        _resetUrgentRedemption();
    }

    function applyMyPendingDebt(uint256 i, uint32 upperHintSeed, uint32 lowerHintSeed) external {
        ApplyMyPendingDebtContext memory v;

        i = _bound(i, 0, branches.length - 1);
        v.upperHint = _pickHint(i, upperHintSeed);
        v.lowerHint = _pickHint(i, lowerHintSeed);

        v.c = branches[i];
        v.pendingInterest = v.c.activePool.calcPendingAggInterest();
        v.troveId = _troveIdOf(i, msg.sender);
        v.batchManager = _batchManagerOf[i][v.troveId];
        v.batchManagementFee = v.c.troveManager.getLatestBatchData(v.batchManager).accruedManagementFee;
        v.t = v.c.troveManager.getLatestTroveData(v.troveId);
        v.trove = _troves[i][v.troveId];
        v.wasOpen = _isOpen(i, v.troveId);

        info("upper hint: ", _hintToString(i, v.upperHint));
        info("lower hint: ", _hintToString(i, v.lowerHint));
        logCall("applyMyPendingDebt", i.toString(), upperHintSeed.toString(), lowerHintSeed.toString());

        try v.c.borrowerOperations.applyPendingDebt(v.troveId, v.lowerHint, v.upperHint) {
            // Preconditions
            assertTrue(v.wasOpen, "Should have failed as Trove wasn't open");
            assertGtDecimal(v.t.entireDebt, 0, 18, "Should have failed as debt was zero");
            assertFalse(isShutdown[i], "Should have failed as branch had been shut down");

            // Effects (Trove)
            v.trove.applyPending();
            _troves[i][v.troveId] = v.trove;

            if (v.t.entireDebt >= MIN_DEBT) {
                _zombieTroveIds[i].remove(v.troveId);
                if (designatedVictimId[i] == v.troveId) designatedVictimId[i] = 0;
            }

            // Effects (batch)
            if (v.batchManager != address(0)) _touchBatch(i, v.batchManager);

            // Effects (system)
            _mintYield(i, v.pendingInterest, 0);
        } catch (bytes memory revertData) {
            bytes4 selector;
            (selector, v.errorString) = _decodeCustomError(revertData);

            // Justify failures
            if (selector == BorrowerOperations.TroveNotOpen.selector) {
                assertFalse(v.wasOpen, "Shouldn't have failed as Trove was open");
            } else if (selector == BorrowerOperations.TroveWithZeroDebt.selector) {
                assertEqDecimal(v.t.entireDebt, 0, 18, "Shouldn't have failed as debt was non-zero");
            } else if (selector == BorrowerOperations.IsShutDown.selector) {
                assertTrue(isShutdown[i], "Shouldn't have failed as branch hadn't been shut down");
            } else {
                revert(string.concat("Unexpected error: ", v.errorString));
            }
        }

        if (bytes(v.errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", v.errorString);
            _log();
        } else {
            // Cleanup (success)
            if (v.batchManager != address(0)) _sweepBold(v.batchManager, v.batchManagementFee);
        }
    }

    function provideToSP(uint256 i, uint256 amount, bool claim) external {
        ProvideToSPContext memory v;

        i = _bound(i, 0, branches.length - 1);
        amount = _bound(amount, 0, _handlerBold);

        v.c = branches[i];
        v.pendingInterest = v.c.activePool.calcPendingAggInterest();
        v.totalBoldDeposits = v.c.stabilityPool.getTotalBoldDeposits();
        v.blockedSPYield = v.totalBoldDeposits < DECIMAL_PRECISION
            ? v.c.activePool.calcPendingSPYield() + v.c.stabilityPool.getYieldGainsPending()
            : 0;
        v.initialBoldDeposit = v.c.stabilityPool.deposits(msg.sender);
        v.boldDeposit = v.c.stabilityPool.getCompoundedBoldDeposit(msg.sender);
        v.boldYield = v.c.stabilityPool.getDepositorYieldGainWithPending(msg.sender);
        v.ethGain = v.c.stabilityPool.getDepositorCollGain(msg.sender);
        v.ethStash = v.c.stabilityPool.stashedColl(msg.sender);
        v.ethClaimed = claim ? v.ethStash + v.ethGain : 0;
        v.boldClaimed = claim ? v.boldYield : 0;

        info("initial deposit: ", v.initialBoldDeposit.decimal());
        info("compounded deposit: ", v.boldDeposit.decimal());
        info("yield gain: ", v.boldYield.decimal());
        info("coll gain: ", v.ethGain.decimal());
        info("stashed coll: ", v.ethStash.decimal());
        info("blocked SP yield: ", v.blockedSPYield.decimal());
        logCall("provideToSP", i.toString(), amount.decimal(), claim.toString());

        // TODO: randomly deal less than amount?
        _dealBold(msg.sender, amount);

        vm.prank(msg.sender);
        try v.c.stabilityPool.provideToSP(amount, claim) {
            // Preconditions
            assertGtDecimal(amount, 0, 18, "Should have failed as amount was zero");

            // Effects (deposit)
            v.ethStash += v.ethGain;
            v.ethStash -= v.ethClaimed;

            v.boldDeposit += amount;
            v.boldDeposit += v.boldYield;
            v.boldDeposit -= v.boldClaimed;

            // See if the change unblocked any pending yield
            v.totalBoldDeposits += amount;
            v.totalBoldDeposits += v.boldYield;
            v.totalBoldDeposits -= v.boldClaimed;

            uint256 newBoldYield =
                v.totalBoldDeposits >= DECIMAL_PRECISION ? v.blockedSPYield * v.boldDeposit / v.totalBoldDeposits : 0;

            assertApproxEqAbsDecimal(
                v.c.stabilityPool.getCompoundedBoldDeposit(msg.sender), v.boldDeposit, 1e7, 18, "Wrong deposit"
            );
            assertApproxEq(v.c.stabilityPool.getDepositorYieldGain(msg.sender), newBoldYield, 1e11, "Wrong yield gain");
            assertEqDecimal(v.c.stabilityPool.getDepositorCollGain(msg.sender), 0, 18, "Wrong coll gain");
            assertEqDecimal(v.c.stabilityPool.stashedColl(msg.sender), v.ethStash, 18, "Wrong stashed coll");

            // Effects (system)
            _mintYield(i, v.pendingInterest, 0);

            spColl[i] -= v.ethClaimed;
            spBoldDeposits[i] += amount;
            spBoldDeposits[i] += v.boldYield;
            spBoldDeposits[i] -= v.boldClaimed;
            spBoldYield[i] -= v.boldYield;
        } catch Error(string memory reason) {
            v.errorString = reason;

            // Justify failures
            if (reason.equals("StabilityPool: Amount must be non-zero")) {
                assertEqDecimal(amount, 0, 18, "Shouldn't have failed as amount was non-zero");
            } else {
                revert(reason);
            }
        }

        if (bytes(v.errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", v.errorString);
            _log();

            // Cleanup (failure)
            _sweepBold(msg.sender, amount); // Take back the BOLD that was dealt
        } else {
            // Cleanup (success)
            _sweepBold(msg.sender, v.boldClaimed);
            _sweepColl(i, msg.sender, v.ethClaimed);
        }
    }

    function withdrawFromSP(uint256 i, uint256 amount, bool claim) external {
        WithdrawFromSPContext memory v;

        i = _bound(i, 0, branches.length - 1);

        v.c = branches[i];
        v.pendingInterest = v.c.activePool.calcPendingAggInterest();
        v.totalBoldDeposits = v.c.stabilityPool.getTotalBoldDeposits();
        v.blockedSPYield = v.totalBoldDeposits < DECIMAL_PRECISION
            ? v.c.activePool.calcPendingSPYield() + v.c.stabilityPool.getYieldGainsPending()
            : 0;
        v.initialBoldDeposit = v.c.stabilityPool.deposits(msg.sender);
        v.boldDeposit = v.c.stabilityPool.getCompoundedBoldDeposit(msg.sender);
        v.boldYield = v.c.stabilityPool.getDepositorYieldGainWithPending(msg.sender);
        v.ethGain = v.c.stabilityPool.getDepositorCollGain(msg.sender);
        v.ethStash = v.c.stabilityPool.stashedColl(msg.sender);
        v.ethClaimed = claim ? v.ethStash + v.ethGain : 0;
        v.boldClaimed = claim ? v.boldYield : 0;

        amount = _bound(amount, 0, v.boldDeposit * 11 / 10); // sometimes try withdrawing too much
        v.withdrawn = Math.min(amount, v.boldDeposit);

        info("initial deposit: ", v.initialBoldDeposit.decimal());
        info("compounded deposit: ", v.boldDeposit.decimal());
        info("yield gain: ", v.boldYield.decimal());
        info("coll gain: ", v.ethGain.decimal());
        info("stashed coll: ", v.ethStash.decimal());
        info("blocked SP yield: ", v.blockedSPYield.decimal());
        logCall("withdrawFromSP", i.toString(), amount.decimal(), claim.toString());

        vm.prank(msg.sender);
        try v.c.stabilityPool.withdrawFromSP(amount, claim) {
            // Preconditions
            assertGtDecimal(v.initialBoldDeposit, 0, 18, "Should have failed as user had zero deposit");
            assertGeDecimal(
                v.totalBoldDeposits + v.boldYield,
                v.boldClaimed + v.withdrawn + MIN_BOLD_IN_SP,
                18,
                "Should have failed as withdrawal left less than MIN_BOLD_IN_SP"
            );

            // Effects (deposit)
            v.ethStash += v.ethGain;
            v.ethStash -= v.ethClaimed;

            v.boldDeposit += v.boldYield;
            v.boldDeposit -= v.boldClaimed;
            v.boldDeposit -= v.withdrawn;

            assertApproxEqAbsDecimal(
                v.c.stabilityPool.getCompoundedBoldDeposit(msg.sender), v.boldDeposit, 1e7, 18, "Wrong deposit"
            );
            assertEqDecimal(v.c.stabilityPool.getDepositorYieldGain(msg.sender), 0, 18, "Wrong yield gain");
            assertEqDecimal(v.c.stabilityPool.getDepositorCollGain(msg.sender), 0, 18, "Wrong coll gain");
            assertEqDecimal(v.c.stabilityPool.stashedColl(msg.sender), v.ethStash, 18, "Wrong stashed coll");

            // Effects (system)
            _mintYield(i, v.pendingInterest, 0);

            spColl[i] -= v.ethClaimed;
            spBoldDeposits[i] += v.boldYield;
            spBoldDeposits[i] -= v.boldClaimed;
            spBoldDeposits[i] -= v.withdrawn;
            spBoldYield[i] -= v.boldYield;
        } catch Error(string memory reason) {
            v.errorString = reason;

            // Justify failures
            if (reason.equals("StabilityPool: User must have a non-zero deposit")) {
                assertEqDecimal(v.initialBoldDeposit, 0, 18, "Shouldn't have failed as user had a non-zero deposit");
            } else if (reason.equals("Withdrawal must leave totalBoldDeposits >= MIN_BOLD_IN_SP")) {
                assertLtDecimal(
                    v.totalBoldDeposits + v.boldYield,
                    v.boldClaimed + v.withdrawn + MIN_BOLD_IN_SP,
                    18,
                    "Shouldn't have failed as withdrawal left more than MIN_BOLD_IN_SP"
                );
            } else {
                revert(reason);
            }
        }

        if (bytes(v.errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", v.errorString);
            _log();
        } else {
            // Cleanup (success)
            _sweepBold(msg.sender, v.boldClaimed + v.withdrawn);
            _sweepColl(i, msg.sender, v.ethClaimed);
        }
    }

    function claimAllCollGains(uint256 i) external {
        i = _bound(i, 0, branches.length - 1);

        TestDeployer.LiquityContractsDev memory c = branches[i];
        uint256 pendingInterest = c.activePool.calcPendingAggInterest();
        uint256 initialBoldDeposit = c.stabilityPool.deposits(msg.sender);
        uint256 ethStash = c.stabilityPool.stashedColl(msg.sender);

        logCall("claimAllCollGains", i.toString());

        string memory errorString;
        vm.prank(msg.sender);

        try c.stabilityPool.claimAllCollGains() {
            // Preconditions
            assertEqDecimal(initialBoldDeposit, 0, 18, "Should have failed as user had a non-zero deposit");
            assertGtDecimal(ethStash, 0, 18, "Should have failed as ETH stash was zero");

            // Effects (deposit)
            assertEqDecimal(c.stabilityPool.getCompoundedBoldDeposit(msg.sender), 0, 18, "Wrong deposit");
            assertEqDecimal(c.stabilityPool.getDepositorYieldGain(msg.sender), 0, 18, "Wrong yield gain");
            assertEqDecimal(c.stabilityPool.getDepositorCollGain(msg.sender), 0, 18, "Wrong coll gain");
            assertEqDecimal(c.stabilityPool.stashedColl(msg.sender), 0, 18, "Wrong stashed coll");

            // Effects (system)
            _mintYield(i, pendingInterest, 0);
            spColl[i] -= ethStash;
        } catch Error(string memory reason) {
            errorString = reason;

            // Justify failures
            if (reason.equals("StabilityPool: User must have no deposit")) {
                assertGtDecimal(initialBoldDeposit, 0, 18, "Shouldn't have failed as user had no deposit");
            } else if (reason.equals("StabilityPool: Amount must be non-zero")) {
                assertEqDecimal(ethStash, 0, 18, "Shouldn't have failed as ETH stash was non-zero");
            } else {
                revert(reason);
            }
        }

        if (bytes(errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", errorString);
            _log();
        } else {
            // Cleanup (success)
            _sweepColl(i, msg.sender, ethStash);
        }
    }

    //////////////////////
    // Batch management //
    //////////////////////

    function registerBatchManager(
        uint256 i,
        uint256 minInterestRate,
        uint256 maxInterestRate,
        uint256 currentInterestRate,
        uint256 annualManagementFee,
        uint256 minInterestRateChangePeriod
    ) external {
        i = _bound(i, 0, branches.length - 1);
        minInterestRate = _bound(minInterestRate, INTEREST_RATE_MIN, INTEREST_RATE_MAX);
        maxInterestRate = _bound(maxInterestRate, minInterestRate - 1, INTEREST_RATE_MAX);
        currentInterestRate = _bound(currentInterestRate, minInterestRate - 1, maxInterestRate + 1);
        annualManagementFee = _bound(annualManagementFee, BATCH_MANAGEMENT_FEE_MIN, BATCH_MANAGEMENT_FEE_MAX);
        minInterestRateChangePeriod =
            _bound(minInterestRateChangePeriod, RATE_CHANGE_PERIOD_MIN, RATE_CHANGE_PERIOD_MAX);

        TestDeployer.LiquityContractsDev memory c = branches[i];
        Batch storage batch = _batches[i][msg.sender];

        logCall(
            "registerBatchManager",
            i.toString(),
            minInterestRate.decimal(),
            maxInterestRate.decimal(),
            currentInterestRate.decimal(),
            annualManagementFee.decimal(),
            minInterestRateChangePeriod.toString()
        );

        string memory errorString;
        vm.prank(msg.sender);

        try c.borrowerOperations.registerBatchManager(
            uint128(minInterestRate),
            uint128(maxInterestRate),
            uint128(currentInterestRate),
            uint128(annualManagementFee),
            uint128(minInterestRateChangePeriod)
        ) {
            // Preconditions
            assertFalse(isShutdown[i], "Should have failed as branch had been shut down");
            assertFalse(_batchManagers[i].has(msg.sender), "Should have failed as batch manager had already registered");
            assertGeDecimal(minInterestRate, MIN_ANNUAL_INTEREST_RATE, 18, "Wrong: min declared < min allowed");
            assertGeDecimal(currentInterestRate, minInterestRate, 18, "Wrong: curr rate < min declared");
            assertGeDecimal(maxInterestRate, currentInterestRate, 18, "Wrong: curr rate > max declared");
            assertGeDecimal(MAX_ANNUAL_INTEREST_RATE, maxInterestRate, 18, "Wrong: max declared > max allowed");
            assertNotEqDecimal(minInterestRate, maxInterestRate, 18, "Should have failed as min == max");
            assertLeDecimal(annualManagementFee, MAX_ANNUAL_BATCH_MANAGEMENT_FEE, 18, "Should have failed as fee > max");
            assertGe(minInterestRateChangePeriod, MIN_INTEREST_RATE_CHANGE_PERIOD, "Should have failed as period < min");

            // Effects
            _batchManagers[i].add(msg.sender);
            batch.interestRateMin = minInterestRate;
            batch.interestRateMax = maxInterestRate;
            batch.interestRate = currentInterestRate;
            batch.managementRate = annualManagementFee;
            batch.period = minInterestRateChangePeriod;
        } catch (bytes memory revertData) {
            bytes4 selector;
            (selector, errorString) = _decodeCustomError(revertData);

            // Justify failures
            if (selector == BorrowerOperations.IsShutDown.selector) {
                assertTrue(isShutdown[i], "Shouldn't have failed as branch hadn't been shut down");
            } else if (selector == BorrowerOperations.BatchManagerExists.selector) {
                assertTrue(
                    _batchManagers[i].has(msg.sender), "Shouldn't have failed as batch manager hadn't registered yet"
                );
            } else if (selector == BorrowerOperations.InterestRateTooLow.selector) {
                assertTrue(
                    minInterestRate < MIN_ANNUAL_INTEREST_RATE || maxInterestRate < MIN_ANNUAL_INTEREST_RATE,
                    "Shouldn't have failed as min and max declared >= min allowed"
                );
            } else if (selector == BorrowerOperations.InterestRateTooHigh.selector) {
                assertTrue(
                    minInterestRate > MAX_ANNUAL_INTEREST_RATE || maxInterestRate > MAX_ANNUAL_INTEREST_RATE,
                    "Shouldn't have failed as min and max declared >= min allowed"
                );
            } else if (selector == BorrowerOperations.InterestNotInRange.selector) {
                assertTrue(
                    currentInterestRate < minInterestRate || currentInterestRate > maxInterestRate,
                    "Shouldn't have failed as interest rate was in range"
                );
            } else if (selector == BorrowerOperations.MinGeMax.selector) {
                assertGeDecimal(minInterestRate, maxInterestRate, 18, "Shouldn't have failed as min < max");
            } else if (selector == BorrowerOperations.AnnualManagementFeeTooHigh.selector) {
                assertGtDecimal(
                    annualManagementFee, MAX_ANNUAL_BATCH_MANAGEMENT_FEE, 18, "Shouldn't have failed as fee <= max"
                );
            } else if (selector == BorrowerOperations.MinInterestRateChangePeriodTooLow.selector) {
                assertLt(
                    minInterestRateChangePeriod,
                    MIN_INTEREST_RATE_CHANGE_PERIOD,
                    "Shouldn't have failed as period >= min"
                );
            } else {
                revert(string.concat("Unexpected error: ", errorString));
            }
        }

        if (bytes(errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", errorString);
            _log();
        }
    }

    function lowerBatchManagementFee(uint256 i, uint256 newManagementFee) external {
        i = _bound(i, 0, branches.length - 1);
        Batch storage batch = _batches[i][msg.sender];
        newManagementFee = _bound(newManagementFee, BATCH_MANAGEMENT_FEE_MIN, batch.managementRate);

        TestDeployer.LiquityContractsDev memory c = branches[i];
        uint256 pendingInterest = c.activePool.calcPendingAggInterest();
        uint256 batchManagementFee = c.troveManager.getLatestBatchData(msg.sender).accruedManagementFee;

        logCall("lowerBatchManagementFee", i.toString(), newManagementFee.decimal());

        string memory errorString;
        vm.prank(msg.sender);

        try c.borrowerOperations.lowerBatchManagementFee(newManagementFee) {
            // Preconditions
            assertFalse(isShutdown[i], "Should have failed as branch had been shut down");
            assertTrue(_batchManagers[i].has(msg.sender), "Should have failed as batch manager wasn't valid");
            assertLtDecimal(newManagementFee, batch.managementRate, 18, "Should have failed as new fee wasn't lower");

            // Effects (Troves)
            for (uint256 j = 0; j < batch.troves.size(); ++j) {
                Trove storage trove = _troves[i][batch.troves.get(j)];
                trove.batchManagementRate = newManagementFee;
            }

            // Effects (batch)
            _touchBatch(i, msg.sender);
            batch.managementRate = newManagementFee;

            // Effects (system)
            _mintYield(i, pendingInterest, 0);
        } catch (bytes memory revertData) {
            bytes4 selector;
            (selector, errorString) = _decodeCustomError(revertData);

            // Justify failures
            if (selector == BorrowerOperations.IsShutDown.selector) {
                assertTrue(isShutdown[i], "Shouldn't have failed as branch hadn't been shut down");
            } else if (selector == BorrowerOperations.InvalidInterestBatchManager.selector) {
                assertFalse(_batchManagers[i].has(msg.sender), "Shouldn't have failed as batch manager was valid");
            } else if (selector == BorrowerOperations.NewFeeNotLower.selector) {
                assertGeDecimal(
                    newManagementFee, batch.managementRate, 18, "Shouldn't have failed as new fee was lower"
                );
            } else {
                revert(string.concat("Unexpected error: ", errorString));
            }
        }

        if (bytes(errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", errorString);
            _log();
        } else {
            // Cleanup (success)
            _sweepBold(msg.sender, batchManagementFee);
        }
    }

    function setInterestBatchManager(uint256 i, uint32 newBatchManagerSeed, uint32 upperHintSeed, uint32 lowerHintSeed)
        external
    {
        SetInterestBatchManagerContext memory v;

        i = _bound(i, 0, branches.length - 1);
        v.newBatchManager = _pickBatchManager(i, newBatchManagerSeed);
        v.upperHint = _pickHint(i, upperHintSeed);
        v.lowerHint = _pickHint(i, lowerHintSeed);

        Batch storage batch = _batches[i][v.newBatchManager];
        v.c = branches[i];
        v.pendingInterest = v.c.activePool.calcPendingAggInterest();
        v.troveId = _troveIdOf(i, msg.sender);
        v.t = v.c.troveManager.getLatestTroveData(v.troveId);
        v.batchManagementFee = v.c.troveManager.getLatestBatchData(v.newBatchManager).accruedManagementFee;
        v.trove = _troves[i][v.troveId];
        v.wasOpen = _isOpen(i, v.troveId);
        v.wasActive = _isActive(i, v.troveId);

        if (_batchManagerOf[i][v.troveId] == address(0)) {
            v.upfrontFee = hintHelpers.predictJoinBatchInterestRateUpfrontFee(i, v.troveId, v.newBatchManager);
        }

        info("batch manager: ", vm.getLabel(v.newBatchManager));
        info("upper hint: ", _hintToString(i, v.upperHint));
        info("lower hint: ", _hintToString(i, v.lowerHint));
        info("upfront fee: ", v.upfrontFee.decimal());

        logCall(
            "setInterestBatchManager",
            i.toString(),
            newBatchManagerSeed.toString(),
            upperHintSeed.toString(),
            lowerHintSeed.toString()
        );

        vm.prank(msg.sender);
        try v.c.borrowerOperations.setInterestBatchManager(
            v.troveId, v.newBatchManager, v.upperHint, v.lowerHint, v.upfrontFee
        ) {
            uint256 newICR = _ICR(i, v.troveId);
            uint256 newTCR = _TCR(i);

            // Preconditions
            assertFalse(isShutdown[i], "Should have failed as branch had been shut down");
            assertTrue(v.wasActive, "Should have failed as Trove wasn't active");
            assertEq(_batchManagerOf[i][v.troveId], address(0), "Should have failed as Trove was in a batch");
            assertTrue(_batchManagers[i].has(v.newBatchManager), "Should have failed as batch manager wasn't valid");
            assertGeDecimal(newICR, MCR[i] + BCR[i], 18, "Should have failed as new ICR < MCR + BCR");
            assertGeDecimal(newTCR, CCR[i], 18, "Should have failed as new TCR < CCR");

            // Effects (Trove)
            v.trove.applyPending();
            v.trove.debt += v.upfrontFee;
            v.trove.interestRate = batch.interestRate;
            v.trove.batchManagementRate = batch.managementRate;
            _troves[i][v.troveId] = v.trove;
            _timeSinceLastTroveInterestRateAdjustment[i][v.troveId] = 0;
            _batchManagerOf[i][v.troveId] = v.newBatchManager;

            // Effects (batch)
            _touchBatch(i, v.newBatchManager);
            batch.troves.add(v.troveId);

            // Effects (system)
            _mintYield(i, v.pendingInterest, v.upfrontFee);
        } catch Error(string memory reason) {
            v.errorString = reason;

            // Justify failures
            if (reason.equals("ERC721: invalid token ID")) {
                assertFalse(v.wasOpen, "Open Trove should have an NFT");
            } else {
                revert(reason);
            }
        } catch (bytes memory revertData) {
            bytes4 selector;
            (selector, v.errorString) = _decodeCustomError(revertData);

            // Justify failures
            if (selector == BorrowerOperations.IsShutDown.selector) {
                assertTrue(isShutdown[i], "Shouldn't have failed as branch hadn't been shut down");
            } else if (selector == BorrowerOperations.TroveNotActive.selector) {
                assertFalse(v.wasActive, "Shouldn't have failed as Trove was active");
            } else if (selector == BorrowerOperations.TroveInBatch.selector) {
                assertNotEq(
                    _batchManagerOf[i][v.troveId], address(0), "Shouldn't have failed as Trove wasn't in a batch"
                );
            } else if (selector == BorrowerOperations.InvalidInterestBatchManager.selector) {
                assertFalse(
                    _batchManagers[i].has(v.newBatchManager), "Shouldn't have failed as batch manager was valid"
                );
            } else if (selector == BorrowerOperations.ICRBelowMCRPlusBCR.selector) {
                uint256 newICR = _ICR(i, 0, 0, v.upfrontFee, v.t);
                assertLtDecimal(newICR, MCR[i] + BCR[i], 18, "Shouldn't have failed as new ICR >= MCR + BCR");
                info("New ICR would have been: ", newICR.decimal());
            } else if (selector == BorrowerOperations.TCRBelowCCR.selector) {
                uint256 newTCR = _TCR(i, 0, 0, v.upfrontFee);
                assertLtDecimal(newTCR, CCR[i], 18, "Shouldn't have failed as new TCR >= CCR");
                info("New TCR would have been: ", newTCR.decimal());
            } else {
                revert(string.concat("Unexpected error: ", v.errorString));
            }
        }

        if (bytes(v.errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", v.errorString);
            _log();
        } else {
            // Cleanup (success)
            _sweepBold(v.newBatchManager, v.batchManagementFee);
        }
    }

    function removeFromBatch(uint256 i, uint256 newInterestRate, uint32 upperHintSeed, uint32 lowerHintSeed) external {
        RemoveFromBatchContext memory v;

        i = _bound(i, 0, branches.length - 1);
        newInterestRate = _bound(newInterestRate, INTEREST_RATE_MIN, INTEREST_RATE_MAX);
        v.upperHint = _pickHint(i, upperHintSeed);
        v.lowerHint = _pickHint(i, lowerHintSeed);

        v.c = branches[i];
        v.pendingInterest = v.c.activePool.calcPendingAggInterest();
        v.troveId = _troveIdOf(i, msg.sender);
        v.t = v.c.troveManager.getLatestTroveData(v.troveId);
        v.batchManager = _batchManagerOf[i][v.troveId];
        v.batchManagementFee = v.c.troveManager.getLatestBatchData(v.batchManager).accruedManagementFee;
        v.wasActive = _isActive(i, v.troveId);
        v.premature = newInterestRate != v.t.annualInterestRate
            && Math.min(
                _timeSinceLastTroveInterestRateAdjustment[i][v.troveId],
                _timeSinceLastBatchInterestRateAdjustment[i][v.batchManager]
            ) < INTEREST_RATE_ADJ_COOLDOWN;

        if (v.batchManager != address(0)) {
            v.upfrontFee = hintHelpers.predictRemoveFromBatchUpfrontFee(i, v.troveId, newInterestRate);
            if (v.upfrontFee > 0) assertTrue(v.premature, "Only premature adjustment should incur upfront fee");
        }

        Trove memory trove = _troves[i][v.troveId];
        Batch storage batch = _batches[i][v.batchManager];

        info("upper hint: ", _hintToString(i, v.upperHint));
        info("lower hint: ", _hintToString(i, v.lowerHint));
        info("upfront fee: ", v.upfrontFee.decimal());

        logCall(
            "removeFromBatch",
            i.toString(),
            newInterestRate.decimal(),
            upperHintSeed.toString(),
            lowerHintSeed.toString()
        );

        vm.prank(msg.sender);
        try v.c.borrowerOperations.removeFromBatch(v.troveId, newInterestRate, v.upperHint, v.lowerHint, v.upfrontFee) {
            uint256 newICR = _ICR(i, v.troveId);
            uint256 newTCR = _TCR(i);

            // Preconditions
            assertFalse(isShutdown[i], "Should have failed as branch had been shut down");
            assertTrue(v.wasActive, "Should have failed as Trove wasn't active");
            assertNotEq(v.batchManager, address(0), "Should have failed as Trove wasn't in a batch");
            assertGeDecimal(newInterestRate, MIN_ANNUAL_INTEREST_RATE, 18, "Should have failed as rate < min");
            assertLeDecimal(newInterestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Should have failed as rate > max");

            if (v.premature) {
                assertGeDecimal(newICR, MCR[i], 18, "Should have failed as new ICR < MCR");
                assertGeDecimal(newTCR, CCR[i], 18, "Should have failed as new TCR < CCR");
            }

            // Effects (Trove)
            trove.applyPending();
            trove.debt += v.upfrontFee;
            trove.interestRate = newInterestRate;
            trove.batchManagementRate = 0;
            _troves[i][v.troveId] = trove;
            _timeSinceLastTroveInterestRateAdjustment[i][v.troveId] = 0;
            delete _batchManagerOf[i][v.troveId];

            // Effects (batch)
            _touchBatch(i, v.batchManager);
            batch.troves.remove(v.troveId);

            // Effects (system)
            _mintYield(i, v.pendingInterest, v.upfrontFee);
        } catch (bytes memory revertData) {
            bytes4 selector;
            (selector, v.errorString) = _decodeCustomError(revertData);

            // Justify failures
            if (selector == BorrowerOperations.IsShutDown.selector) {
                assertTrue(isShutdown[i], "Shouldn't have failed as branch hadn't been shut down");
            } else if (selector == BorrowerOperations.TroveNotActive.selector) {
                assertFalse(v.wasActive, "Shouldn't have failed as Trove was active");
            } else if (selector == BorrowerOperations.TroveNotInBatch.selector) {
                assertEq(v.batchManager, address(0), "Shouldn't have failed as Trove was in a batch");
            } else if (selector == BorrowerOperations.InterestRateTooLow.selector) {
                assertLtDecimal(newInterestRate, MIN_ANNUAL_INTEREST_RATE, 18, "Shouldn't have failed as rate >= min");
            } else if (selector == BorrowerOperations.InterestRateTooHigh.selector) {
                assertGtDecimal(newInterestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Shouldn't have failed as rate <= max");
            } else if (selector == BorrowerOperations.ICRBelowMCR.selector) {
                uint256 newICR = _ICR(i, 0, 0, v.upfrontFee, v.t);
                assertTrue(v.premature, "Shouldn't have failed as adjustment was not premature");
                assertLtDecimal(newICR, MCR[i], 18, "Shouldn't have failed as new ICR >= MCR");
                info("New ICR would have been: ", newICR.decimal());
            } else if (selector == BorrowerOperations.TCRBelowCCR.selector) {
                uint256 newTCR = _TCR(i, 0, 0, v.upfrontFee);
                assertTrue(v.premature, "Shouldn't have failed as adjustment was not premature");
                assertLtDecimal(newTCR, CCR[i], 18, "Shouldn't have failed as new TCR >= CCR");
                info("New TCR would have been: ", newTCR.decimal());
            } else {
                revert(string.concat("Unexpected error: ", v.errorString));
            }
        }

        if (bytes(v.errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", v.errorString);
            _log();
        } else {
            // Cleanup (success)
            _sweepBold(v.batchManager, v.batchManagementFee);
        }
    }

    function setBatchManagerAnnualInterestRate(
        uint256 i,
        uint256 newAnnualInterestRate,
        uint32 upperHintSeed,
        uint32 lowerHintSeed
    ) external {
        SetBatchManagerAnnualInterestRateContext memory v;

        i = _bound(i, 0, branches.length - 1);
        Batch storage batch = _batches[i][msg.sender];
        newAnnualInterestRate = _bound(
            newAnnualInterestRate, batch.interestRateMin > 0 ? batch.interestRateMin - 1 : 0, batch.interestRateMax + 1
        );
        v.upperHint = _pickHint(i, upperHintSeed);
        v.lowerHint = _pickHint(i, lowerHintSeed);

        v.c = branches[i];
        v.pendingInterest = v.c.activePool.calcPendingAggInterest();
        v.b = v.c.troveManager.getLatestBatchData(msg.sender);
        v.premature = newAnnualInterestRate != batch.interestRate
            && _timeSinceLastBatchInterestRateAdjustment[i][msg.sender] < INTEREST_RATE_ADJ_COOLDOWN;

        v.upfrontFee = hintHelpers.predictAdjustBatchInterestRateUpfrontFee(i, msg.sender, newAnnualInterestRate);
        if (v.upfrontFee > 0) assertTrue(v.premature, "Only premature adjustment should incur upfront fee");

        info("upper hint: ", _hintToString(i, v.upperHint));
        info("lower hint: ", _hintToString(i, v.lowerHint));
        info("upfront fee: ", v.upfrontFee.decimal());

        logCall(
            "setBatchManagerAnnualInterestRate",
            i.toString(),
            newAnnualInterestRate.decimal(),
            upperHintSeed.toString(),
            lowerHintSeed.toString()
        );

        vm.prank(msg.sender);
        try v.c.borrowerOperations.setBatchManagerAnnualInterestRate(
            uint128(newAnnualInterestRate), v.upperHint, v.lowerHint, v.upfrontFee
        ) {
            uint256 newTCR = _TCR(i);

            // Preconditions
            assertFalse(isShutdown[i], "Should have failed as branch had been shut down");
            assertTrue(_batchManagers[i].has(msg.sender), "Should have failed as batch manager wasn't valid");
            assertGeDecimal(
                newAnnualInterestRate, batch.interestRateMin, 18, "Should have failed as interest rate wasn't in range"
            );
            assertLeDecimal(
                newAnnualInterestRate, batch.interestRateMax, 18, "Should have failed as interest rate wasn't in range"
            );
            assertGe(
                _timeSinceLastBatchInterestRateAdjustment[i][msg.sender],
                batch.period,
                "Should have failed as period hasn't passed"
            );
            if (v.premature) assertGeDecimal(newTCR, CCR[i], 18, "Should have failed as new TCR < CCR");

            // Effects (Troves)
            for (uint256 j = 0; j < batch.troves.size(); ++j) {
                Trove storage trove = _troves[i][batch.troves.get(j)];
                trove.interestRate = newAnnualInterestRate;
            }

            // Effects (batch)
            _timeSinceLastBatchInterestRateAdjustment[i][msg.sender] = 0;
            batch.interestRate = newAnnualInterestRate;
            _touchBatch(i, msg.sender);

            if (v.upfrontFee > 0) {
                uint256 batchDebt = _getBatchDebt(i, msg.sender);
                if (batchDebt == 0) {
                    assertApproxEqAbsDecimal(
                        v.b.entireDebtWithoutRedistribution, 0, 1e3, 18, "Batch debt should be negligible"
                    );
                    assertApproxEqAbsDecimal(v.upfrontFee, 0, 10, 18, "Upfront fee should be negligible");
                } else {
                    for (uint256 j = 0; j < batch.troves.size(); ++j) {
                        Trove storage trove = _troves[i][batch.troves.get(j)];
                        trove.debt += v.upfrontFee * trove.debt / batchDebt;
                    }
                }
            }

            // Effects (system)
            _mintYield(i, v.pendingInterest, v.upfrontFee);
        } catch (bytes memory revertData) {
            bytes4 selector;
            (selector, v.errorString) = _decodeCustomError(revertData);

            // Justify failures
            if (selector == BorrowerOperations.IsShutDown.selector) {
                assertTrue(isShutdown[i], "Shouldn't have failed as branch hadn't been shut down");
            } else if (selector == BorrowerOperations.InvalidInterestBatchManager.selector) {
                assertFalse(_batchManagers[i].has(msg.sender), "Shouldn't have failed as batch manager was valid");
            } else if (selector == BorrowerOperations.InterestNotInRange.selector) {
                assertFalse(
                    batch.interestRateMin <= newAnnualInterestRate && newAnnualInterestRate <= batch.interestRateMax,
                    "Shouldn't have failed as interest rate was in range"
                );
            } else if (selector == BorrowerOperations.BatchInterestRateChangePeriodNotPassed.selector) {
                assertLt(
                    _timeSinceLastBatchInterestRateAdjustment[i][msg.sender],
                    batch.period,
                    "Shouldn't have failed as period has passed"
                );
            } else if (selector == BorrowerOperations.TCRBelowCCR.selector) {
                uint256 newTCR = _TCR(i, 0, 0, v.upfrontFee);
                assertTrue(v.premature, "Shouldn't have failed as adjustment was not premature");
                assertLtDecimal(newTCR, CCR[i], 18, "Shouldn't have failed as new TCR >= CCR");
                info("New TCR would have been: ", newTCR.decimal());
            } else {
                revert(string.concat("Unexpected error: ", v.errorString));
            }
        }

        if (bytes(v.errorString).length > 0) {
            if (_assumeNoExpectedFailures) vm.assume(false);

            info("Expected error: ", v.errorString);
            _log();
        } else {
            // Cleanup (success)
            _sweepBold(msg.sender, v.b.accruedManagementFee);
        }
    }

    ///////////////////////////////
    // Internal helper functions //
    ///////////////////////////////

    function _getBaseRate() internal view returns (uint256) {
        uint256 minutesSinceLastRedemption = _timeSinceLastRedemption / ONE_MINUTE;
        uint256 decaySinceLastRedemption = REDEMPTION_MINUTE_DECAY_FACTOR.pow(minutesSinceLastRedemption);
        return _baseRate * decaySinceLastRedemption / DECIMAL_PRECISION;
    }

    function _getBaseRateIncrease(uint256 boldSupply, uint256 redeemed) internal view returns (uint256) {
        return boldSupply > 0 ? redeemed * DECIMAL_PRECISION / boldSupply / REDEMPTION_BETA : 0;
    }

    function _getRedemptionRate(uint256 baseRate) internal view returns (uint256) {
        return Math.min(REDEMPTION_FEE_FLOOR + baseRate, _100pct);
    }

    function _getTotalDebt(uint256 i) internal view returns (uint256) {
        return branches[i].troveManager.getEntireBranchDebt();
    }

    function _getUnbacked(uint256 i) internal view returns (uint256) {
        uint256 sp = spBoldDeposits[i];
        uint256 totalDebt = _getTotalDebt(i);

        return sp < totalDebt ? totalDebt - sp : 0;
    }

    function _getTotalUnbacked() internal view returns (uint256 totalUnbacked) {
        for (uint256 i = 0; i < branches.length; ++i) {
            if (isShutdown[i] || _TCR(i) < SCR[i]) continue;
            totalUnbacked += _getUnbacked(i);
        }
    }

    function _CR(uint256 i, uint256 coll, uint256 debt) internal view returns (uint256) {
        return debt > 0 ? coll * _price[i] / debt : type(uint256).max;
    }

    function _ICR(uint256 i, uint256 troveId) internal view returns (uint256) {
        return _ICR(i, 0, 0, 0, troveId);
    }

    function _ICR(uint256 i, LatestTroveData memory trove) internal view returns (uint256) {
        return _ICR(i, 0, 0, 0, trove);
    }

    function _ICR(uint256 i, int256 collDelta, int256 debtDelta, uint256 upfrontFee, uint256 troveId)
        internal
        view
        returns (uint256)
    {
        return _ICR(i, collDelta, debtDelta, upfrontFee, branches[i].troveManager.getLatestTroveData(troveId));
    }

    function _ICR(uint256 i, int256 collDelta, int256 debtDelta, uint256 upfrontFee, LatestTroveData memory trove)
        internal
        view
        returns (uint256)
    {
        uint256 coll = trove.entireColl.add(collDelta);
        uint256 debt = trove.entireDebt.add(debtDelta) + upfrontFee;

        return _CR(i, coll, debt);
    }

    function _TCR(uint256 i) internal view returns (uint256) {
        return _TCR(i, 0, 0, 0);
    }

    function _TCR(uint256 i, int256 collDelta, int256 debtDelta, uint256 upfrontFee) internal view returns (uint256) {
        uint256 coll = branches[i].troveManager.getEntireBranchColl().add(collDelta);
        uint256 debt = branches[i].troveManager.getEntireBranchDebt().add(debtDelta) + upfrontFee;

        return _CR(i, coll, debt);
    }

    // We open at most one Trove per actor per branch, for reasons of simplicity,
    // as Troves aren't enumerable per user, only globally.
    function _troveIdOf(uint256 i, address owner) internal view returns (uint256) {
        return uint256(keccak256(abi.encode(owner, owner, _troveIndexOf[i][owner])));
    }

    function _troveIdsFrom(uint256 i, address[] storage owners) internal view returns (uint256[] memory ret) {
        ret = new uint256[](owners.length);

        for (uint256 j = 0; j < owners.length; ++j) {
            ret[j] = _troveIdOf(i, owners[j]);
        }
    }

    function _labelsFrom(address[] storage owners) internal view returns (string[] memory ret) {
        ret = new string[](owners.length);

        for (uint256 i = 0; i < owners.length; ++i) {
            ret[i] = vm.getLabel(owners[i]);
        }
    }

    function _labelsFrom(EnumerableAddressSet storage owners) internal view returns (string[] memory ret) {
        ret = new string[](owners.size());

        for (uint256 i = 0; i < owners.size(); ++i) {
            ret[i] = vm.getLabel(owners.get(i));
        }
    }

    function _labelsFrom(uint256 i, Redeemed[] storage redeemed) internal view returns (string[] memory ret) {
        ret = new string[](redeemed.length);

        for (uint256 j = 0; j < redeemed.length; ++j) {
            ret[j] = vm.getLabel(branches[i].troveManager.ownerOf(redeemed[j].troveId));
        }
    }

    function _isOpen(uint256 i, uint256 troveId) internal view returns (bool) {
        return _troveIds[i].has(troveId);
    }

    function _isZombie(uint256 i, uint256 troveId) internal view returns (bool) {
        return _zombieTroveIds[i].has(troveId);
    }

    function _isActive(uint256 i, uint256 troveId) internal view returns (bool) {
        return _isOpen(i, troveId) && !_isZombie(i, troveId);
    }

    function _pickHint(uint256 i, uint256 seed) internal view returns (uint256) {
        // We're going to pull:
        // - 50% of the time a valid ID, including 0 (end of list)
        // - 50% of the time a random (nonexistent) ID
        uint256 rem = seed % (2 * (_troveIds[i].size() + 1));

        if (rem == 0) {
            return 0;
        } else if (rem <= _troveIds[i].size()) {
            return _troveIds[i].get(rem - 1);
        } else {
            // pick a pseudo-random number
            return uint256(keccak256(abi.encodePacked(seed)));
        }
    }

    function _pickBatchManager(uint256 i, uint256 seed) internal view returns (address) {
        uint256 rem = seed % (_batchManagers[i].size() + 1);

        if (rem < _batchManagers[i].size()) {
            return _batchManagers[i].get(rem);
        } else {
            return address(uint160(uint256(keccak256(abi.encodePacked(seed)))));
        }
    }

    function _hintToString(uint256 i, uint256 troveId) internal view returns (string memory) {
        ITroveManagerTester troveManager = branches[i].troveManager;

        if (_isOpen(i, troveId)) {
            return vm.getLabel(troveManager.ownerOf(troveId));
        } else {
            return troveId.toString();
        }
    }

    // function dumpSortedTroves(uint256 i) public view {
    //     TestDeployer.LiquityContractsDev memory c = branches[i];

    //     info("SortedTroves: [");
    //     for (uint256 curr = c.sortedTroves.getFirst(); curr != 0; curr = c.sortedTroves.getNext(curr)) {
    //         info(
    //             "  Trove({owner: ",
    //             vm.getLabel(c.troveNFT.ownerOf(curr)),
    //             ", annualInterestRate: ",
    //             c.troveManager.getTroveAnnualInterestRate(curr).decimal(),
    //             "}),"
    //         );
    //     }
    //     info("]");
    // }

    function _mintYield(uint256 i, uint256 pendingInterest, uint256 upfrontFee) internal {
        uint256 mintedYield = pendingInterest + upfrontFee;
        uint256 mintedSPBoldYield = mintedYield * SP_YIELD_SPLIT / DECIMAL_PRECISION;

        spBoldYield[i] += mintedSPBoldYield;
        _pendingInterest[i] = 0;
    }

    function _getBatchDebt(uint256 i, address batchManager) internal view returns (uint256 batchDebt) {
        EnumerableSet storage batchTroves = _batches[i][batchManager].troves;

        for (uint256 j = 0; j < batchTroves.size(); ++j) {
            batchDebt += _troves[i][batchTroves.get(j)].debt;
        }
    }

    function _touchBatch(uint256 i, address batchManager) internal {
        for (uint256 j = 0; j < _batches[i][batchManager].troves.size(); ++j) {
            uint256 troveId = _batches[i][batchManager].troves.get(j);
            Trove memory trove = _troves[i][troveId];
            trove.applyPendingInterest();
            trove.applyPendingBatchManagementFee();
            _troves[i][troveId] = trove;
        }

        _batches[i][batchManager].pendingManagementFee = 0;
    }

    function _dealWETHAndApprove(address to, uint256 amount, address spender) internal {
        uint256 balance = weth.balanceOf(to);
        uint256 allowance = weth.allowance(to, spender);

        deal(address(weth), to, balance + amount);
        vm.prank(to);
        weth.approve(spender, allowance + amount);
    }

    function _dealCollAndApprove(uint256 i, address to, uint256 amount, address spender) internal {
        IERC20 collToken = branches[i].collToken;
        uint256 balance = collToken.balanceOf(to);
        uint256 allowance = collToken.allowance(to, spender);

        deal(address(collToken), to, balance + amount);
        vm.prank(to);
        collToken.approve(spender, allowance + amount);
    }

    function _sweepWETH(address from, uint256 amount) internal {
        vm.prank(from);
        weth.transfer(address(this), amount);
    }

    function _sweepWETHAndUnapprove(address from, uint256 amount, address spender) internal {
        _sweepWETH(from, amount);

        uint256 allowance = weth.allowance(from, spender);
        vm.prank(from);
        weth.approve(spender, allowance - amount);
    }

    function _sweepColl(uint256 i, address from, uint256 amount) internal {
        vm.prank(from);
        branches[i].collToken.transfer(address(this), amount);
    }

    function _sweepCollAndUnapprove(uint256 i, address from, uint256 amount, address spender) internal {
        _sweepColl(i, from, amount);

        IERC20 collToken = branches[i].collToken;
        uint256 allowance = collToken.allowance(from, spender);
        vm.prank(from);
        collToken.approve(spender, allowance - amount);
    }

    function _dealBold(address to, uint256 amount) internal {
        boldToken.transfer(to, amount);
        _handlerBold -= amount;
    }

    function _sweepBold(address from, uint256 amount) internal {
        vm.prank(from);
        boldToken.transfer(address(this), amount);
        _handlerBold += amount;
    }

    function _addToLiquidationBatch(address owner) internal {
        _liquidation.batch.push(owner);
    }

    function _aggregateLiquidation(uint256 i, LatestTroveData memory trove, LiquidationTotals storage t) internal {
        // Offset debt by SP
        uint256 spRemaining = spBoldDeposits[i] - t.spOffset;
        uint256 spOffset = Math.min(trove.entireDebt, spRemaining > MIN_BOLD_IN_SP ? spRemaining - MIN_BOLD_IN_SP : 0);
        t.spOffset += spOffset;

        // Share coll proportionally between SP and redistribution based on offset fraction
        uint256 collRemaining = trove.entireColl;
        uint256 collSPPortion = collRemaining * spOffset / trove.entireDebt;

        // Deduct coll gas comp from SP portion
        uint256 collGasComp = Math.min(collSPPortion / COLL_GAS_COMPENSATION_DIVISOR, COLL_GAS_COMPENSATION_CAP);
        t.collGasComp += collGasComp;
        collRemaining -= collGasComp;

        // Send remainder of SP portion to SP, capped by liq penalty
        uint256 spCollGain = Math.min(collSPPortion - collGasComp, spOffset * (_100pct + LIQ_PENALTY_SP[i]) / _price[i]);
        t.spCollGain += spCollGain;
        collRemaining -= spCollGain;

        // Redistribute remaining debt
        uint256 debtRedist = trove.entireDebt - spOffset;
        t.debtRedist += debtRedist;

        // Redistribute remaining coll, capped by redist penalty
        uint256 collRedist = Math.min(collRemaining, debtRedist * (_100pct + LIQ_PENALTY_REDIST[i]) / _price[i]);
        t.collRedist += collRedist;
        collRemaining -= collRedist;

        // Send remaining coll to surplus pool
        t.collSurplus += collRemaining;
    }

    function _planLiquidation(uint256 i) internal returns (LiquidationTransientState storage l) {
        ITroveManager troveManager = branches[i].troveManager;
        l = _liquidation;
        l.remaining.add(_troveIds[i]);

        for (uint256 j = 0; j < l.batch.length; ++j) {
            if (l.liquidated.has(l.batch[j])) continue; // skip duplicate entry

            uint256 troveId = _troveIdOf(i, l.batch[j]);
            address batchManager = _batchManagerOf[i][troveId];

            LatestTroveData memory trove = troveManager.getLatestTroveData(troveId);
            if (_ICR(i, trove) >= MCR[i]) continue;

            l.remaining.remove(troveId);
            l.liquidated.add(l.batch[j]);
            if (batchManager != address(0)) l.batchManagers.add(batchManager);

            _aggregateLiquidation(i, trove, l.t);
        }
    }

    function _resetLiquidation() internal {
        _liquidation.remaining.reset();
        _liquidation.liquidated.reset();
        _liquidation.batchManagers.reset();
        delete _liquidation;
    }

    function _planOneRedemption(uint256 i, uint256 troveId, uint256 remainingAmount, uint256 feePct)
        internal
        returns (uint256 debtRedeemed)
    {
        LatestTroveData memory trove = branches[i].troveManager.getLatestTroveData(troveId);
        if (_ICR(i, trove) < _100pct) return 0;

        debtRedeemed = Math.min(remainingAmount, trove.entireDebt);
        uint256 newDebt = trove.entireDebt - debtRedeemed;
        uint256 collRedeemedPlusFee = debtRedeemed * DECIMAL_PRECISION / _price[i];
        uint256 fee = collRedeemedPlusFee * feePct / _100pct;
        uint256 collRedeemed = collRedeemedPlusFee - fee;

        mapping(uint256 branchIdx => RedemptionTransientState) storage r = _redemption;
        r[i].redeemed.push(
            Redeemed({troveId: troveId, coll: collRedeemed, debt: debtRedeemed, becomesZombie: newDebt < MIN_DEBT})
        );
        r[i].totalCollRedeemed += collRedeemed;

        address batchManager = _batchManagerOf[i][troveId];
        if (batchManager != address(0)) r[i].batchManagers.add(batchManager);

        if (troveId == designatedVictimId[i] && newDebt == 0) r[i].newDesignatedVictimId = 0;
        if (0 < newDebt && newDebt < MIN_DEBT) r[i].newDesignatedVictimId = troveId;
    }

    function _planRedemption(uint256 amount, uint256 maxIterationsPerCollateral, uint256 feePct)
        internal
        returns (uint256 totalDebtRedeemed, mapping(uint256 branchIdx => RedemptionTransientState) storage r)
    {
        uint256 totalProportions = 0;
        uint256[] memory proportions = new uint256[](branches.length);
        r = _redemption;

        // Try in proportion to unbacked
        for (uint256 i = 0; i < branches.length; ++i) {
            if (isShutdown[i] || _TCR(i) < SCR[i]) continue;
            totalProportions += proportions[i] = _getUnbacked(i);
        }

        // Fallback: in proportion to branch debt
        if (totalProportions == 0) {
            for (uint256 i = 0; i < branches.length; ++i) {
                if (isShutdown[i] || _TCR(i) < SCR[i]) continue;
                totalProportions += proportions[i] = _getTotalDebt(i);
            }
        }

        for (uint256 i = 0; i < branches.length; ++i) {
            r[i].newDesignatedVictimId = designatedVictimId[i];
            if (totalProportions == 0) continue;

            r[i].attemptedAmount = amount * proportions[i] / totalProportions;
            amount -= r[i].attemptedAmount;
            totalProportions -= proportions[i];
            if (r[i].attemptedAmount == 0) continue;

            uint256 remainingAmount = r[i].attemptedAmount;
            uint256 lastTrove = branches[i].sortedTroves.getPrev(0);

            (uint256 troveId, uint256 nextTroveId) = designatedVictimId[i] != 0
                ? (designatedVictimId[i], lastTrove)
                : (lastTrove, branches[i].sortedTroves.getPrev(lastTrove));

            for (uint256 j = 0; j < maxIterationsPerCollateral || maxIterationsPerCollateral == 0; ++j) {
                if (remainingAmount == 0 || troveId == 0) break;

                uint256 debtRedeemed = _planOneRedemption(i, troveId, remainingAmount, feePct);
                totalDebtRedeemed += debtRedeemed;
                remainingAmount -= debtRedeemed;

                troveId = nextTroveId;
                nextTroveId = branches[i].sortedTroves.getPrev(nextTroveId);
            }
        }
    }

    function _resetRedemption() internal {
        for (uint256 i = 0; i < branches.length; ++i) {
            _redemption[i].batchManagers.reset();
            delete _redemption[i];
        }
    }

    function _addToUrgentRedemptionBatch(address owner) internal {
        _urgentRedemption.batch.push(owner);
    }

    function _planUrgentRedemption(uint256 i, uint256 amount)
        internal
        returns (UrgentRedemptionTransientState storage r)
    {
        r = _urgentRedemption;

        for (uint256 j = 0; j < r.batch.length; ++j) {
            if (amount == 0) break;

            uint256 troveId = _troveIdOf(i, r.batch[j]);
            if (!_troveIds[i].has(troveId)) continue; // skip non-existent Trove

            if (r.redeemedIds.has(troveId)) continue; // skip duplicate entry
            r.redeemedIds.add(troveId);

            LatestTroveData memory trove = branches[i].troveManager.getLatestTroveData(troveId);
            if (trove.entireDebt == 0) continue; // nothing to redeem

            uint256 debtRedeemed = Math.min(amount, trove.entireDebt);
            uint256 collRedeemed = debtRedeemed * (DECIMAL_PRECISION + URGENT_REDEMPTION_BONUS) / _price[i];

            if (collRedeemed > trove.entireColl) {
                collRedeemed = trove.entireColl;
                debtRedeemed = trove.entireColl * _price[i] / (DECIMAL_PRECISION + URGENT_REDEMPTION_BONUS);
            }

            r.redeemed.push(Redeemed({troveId: troveId, coll: collRedeemed, debt: debtRedeemed, becomesZombie: false}));

            address batchManager = _batchManagerOf[i][troveId];
            if (batchManager != address(0)) r.batchManagers.add(batchManager);

            r.totalCollRedeemed += collRedeemed;
            r.totalDebtRedeemed += debtRedeemed;

            amount -= debtRedeemed;
        }
    }

    function _resetUrgentRedemption() internal {
        _urgentRedemption.redeemedIds.reset();
        _urgentRedemption.batchManagers.reset();
        delete _urgentRedemption;
    }

    function _encodeOpenTrove(OpenTroveContext memory v) internal view returns (bytes memory) {
        return v.join
            ? abi.encodeCall(
                IBorrowerOperations.openTroveAndJoinInterestBatchManager,
                (
                    IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams({
                        owner: msg.sender,
                        ownerIndex: _troveIndexOf[v.i][msg.sender],
                        collAmount: v.coll,
                        boldAmount: v.borrowed,
                        upperHint: v.upperHint,
                        lowerHint: v.lowerHint,
                        interestBatchManager: v.batchManager,
                        maxUpfrontFee: v.upfrontFee,
                        addManager: address(0),
                        removeManager: address(0),
                        receiver: address(0)
                    })
                )
            )
            : abi.encodeCall(
                IBorrowerOperations.openTrove,
                (
                    msg.sender,
                    _troveIndexOf[v.i][msg.sender],
                    v.coll,
                    v.borrowed,
                    v.upperHint,
                    v.lowerHint,
                    v.interestRate,
                    v.upfrontFee,
                    address(0),
                    address(0),
                    address(0)
                )
            );
    }

    function _getAdjustmentFunctionName(
        AdjustedTroveProperties prop,
        bool isCollIncrease,
        bool isDebtIncrease,
        bool zombie
    ) internal pure returns (string memory) {
        if (zombie) {
            return "adjustZombieTrove()";
        }

        if (prop == AdjustedTroveProperties.onlyColl) {
            if (isCollIncrease) {
                return "addColl()";
            } else {
                return "withdrawColl()";
            }
        }

        if (prop == AdjustedTroveProperties.onlyDebt) {
            if (isDebtIncrease) {
                return "withdrawBold()";
            } else {
                return "repayBold()";
            }
        }

        if (prop == AdjustedTroveProperties.both) {
            return "adjustTrove()";
        }

        revert("Invalid prop");
    }

    function _encodeActiveTroveAdjustment(
        AdjustedTroveProperties prop,
        uint256 troveId,
        uint256 collChange,
        bool isCollIncrease,
        uint256 debtChange,
        bool isDebtIncrease,
        uint256 maxUpfrontFee
    ) internal pure returns (bytes memory) {
        if (prop == AdjustedTroveProperties.onlyColl) {
            if (isCollIncrease) {
                return abi.encodeCall(IBorrowerOperations.addColl, (troveId, collChange));
            } else {
                return abi.encodeCall(IBorrowerOperations.withdrawColl, (troveId, collChange));
            }
        }

        if (prop == AdjustedTroveProperties.onlyDebt) {
            if (isDebtIncrease) {
                return abi.encodeCall(IBorrowerOperations.withdrawBold, (troveId, debtChange, maxUpfrontFee));
            } else {
                return abi.encodeCall(IBorrowerOperations.repayBold, (troveId, debtChange));
            }
        }

        if (prop == AdjustedTroveProperties.both) {
            return abi.encodeCall(
                IBorrowerOperations.adjustTrove,
                (troveId, collChange, isCollIncrease, debtChange, isDebtIncrease, maxUpfrontFee)
            );
        }

        revert("Invalid prop");
    }

    function _encodeZombieTroveAdjustment(
        uint256 troveId,
        uint256 collChange,
        bool isCollIncrease,
        uint256 debtChange,
        bool isDebtIncrease,
        uint256 upperHint,
        uint256 lowerHint,
        uint256 maxUpfrontFee
    ) internal pure returns (bytes memory) {
        return abi.encodeCall(
            IBorrowerOperations.adjustZombieTrove,
            (troveId, collChange, isCollIncrease, debtChange, isDebtIncrease, upperHint, lowerHint, maxUpfrontFee)
        );
    }

    // The only way to catch custom errors is through the generic `catch (bytes memory revertData)`.
    // This will catch more than just custom errors though. If we manage to catch something that's not an error we
    // intended to catch, there's no built-in way of rethrowing it, thus we need to resort to assembly.
    function _revert(bytes memory revertData) internal pure {
        assembly {
            revert(
                add(32, revertData), // offset (skip first 32 bytes, where the size of the array is stored)
                mload(revertData) // size
            )
        }
    }

    function _decodeCustomError(bytes memory revertData)
        public
        pure
        returns (bytes4 selector, string memory errorString)
    {
        selector = bytes4(revertData);

        if (revertData.length == 4) {
            if (selector == AddRemoveManagers.NotBorrower.selector) {
                return (selector, "AddRemoveManagers.NotBorrower()");
            }

            if (selector == AddRemoveManagers.NotOwnerNorAddManager.selector) {
                return (selector, "AddRemoveManagers.NotOwnerNorAddManager()");
            }

            if (selector == AddRemoveManagers.NotOwnerNorRemoveManager.selector) {
                return (selector, "AddRemoveManagers.NotOwnerNorRemoveManager()");
            }

            if (selector == ISystemParams.InvalidMCR.selector) {
                return (selector, "BorrowerOperations.InvalidMCR()");
            }

            if (selector == ISystemParams.InvalidSCR.selector) {
                return (selector, "BorrowerOperations.InvalidSCR()");
            }

            if (selector == BorrowerOperations.IsShutDown.selector) {
                return (selector, "BorrowerOperations.IsShutDown()");
            }

            if (selector == BorrowerOperations.TCRNotBelowSCR.selector) {
                return (selector, "BorrowerOperations.TCRNotBelowSCR()");
            }

            if (selector == BorrowerOperations.ZeroAdjustment.selector) {
                return (selector, "BorrowerOperations.ZeroAdjustment()");
            }

            if (selector == BorrowerOperations.NotOwnerNorInterestManager.selector) {
                return (selector, "BorrowerOperations.NotOwnerNorInterestManager()");
            }

            if (selector == BorrowerOperations.TroveInBatch.selector) {
                return (selector, "BorrowerOperations.TroveInBatch()");
            }

            if (selector == BorrowerOperations.TroveNotInBatch.selector) {
                return (selector, "BorrowerOperations.TroveNotInBatch()");
            }

            if (selector == BorrowerOperations.InterestNotInRange.selector) {
                return (selector, "BorrowerOperations.InterestNotInRange()");
            }

            if (selector == BorrowerOperations.BatchInterestRateChangePeriodNotPassed.selector) {
                return (selector, "BorrowerOperations.BatchInterestRateChangePeriodNotPassed()");
            }

            if (selector == BorrowerOperations.TroveExists.selector) {
                return (selector, "BorrowerOperations.TroveExists()");
            }

            if (selector == BorrowerOperations.TroveNotOpen.selector) {
                return (selector, "BorrowerOperations.TroveNotOpen()");
            }

            if (selector == BorrowerOperations.TroveNotActive.selector) {
                return (selector, "BorrowerOperations.TroveNotActive()");
            }

            if (selector == BorrowerOperations.TroveNotZombie.selector) {
                return (selector, "BorrowerOperations.TroveNotZombie()");
            }

            if (selector == BorrowerOperations.TroveWithZeroDebt.selector) {
                return (selector, "BorrowerOperations.TroveWithZeroDebt()");
            }

            if (selector == BorrowerOperations.UpfrontFeeTooHigh.selector) {
                return (selector, "BorrowerOperations.UpfrontFeeTooHigh()");
            }

            if (selector == BorrowerOperations.ICRBelowMCR.selector) {
                return (selector, "BorrowerOperations.ICRBelowMCR()");
            }

            if (selector == BorrowerOperations.ICRBelowMCRPlusBCR.selector) {
                return (selector, "BorrowerOperations.ICRBelowMCRPlusBCR()");
            }

            if (selector == BorrowerOperations.RepaymentNotMatchingCollWithdrawal.selector) {
                return (selector, "BorrowerOperations.RepaymentNotMatchingCollWithdrawal()");
            }

            if (selector == BorrowerOperations.TCRBelowCCR.selector) {
                return (selector, "BorrowerOperations.TCRBelowCCR()");
            }

            if (selector == BorrowerOperations.DebtBelowMin.selector) {
                return (selector, "BorrowerOperations.DebtBelowMin()");
            }

            if (selector == BorrowerOperations.CollWithdrawalTooHigh.selector) {
                return (selector, "BorrowerOperations.CollWithdrawalTooHigh()");
            }

            if (selector == BorrowerOperations.NotEnoughBoldBalance.selector) {
                return (selector, "BorrowerOperations.NotEnoughBoldBalance()");
            }

            if (selector == BorrowerOperations.InterestRateNotNew.selector) {
                return (selector, "BorrowerOperations.InterestRateNotNew");
            }

            if (selector == BorrowerOperations.InterestRateTooLow.selector) {
                return (selector, "BorrowerOperations.InterestRateTooLow()");
            }

            if (selector == BorrowerOperations.InterestRateTooHigh.selector) {
                return (selector, "BorrowerOperations.InterestRateTooHigh()");
            }

            if (selector == BorrowerOperations.InvalidInterestBatchManager.selector) {
                return (selector, "BorrowerOperations.InvalidInterestBatchManager()");
            }

            if (selector == BorrowerOperations.BatchManagerExists.selector) {
                return (selector, "BorrowerOperations.BatchManagerExists()");
            }

            if (selector == BorrowerOperations.BatchManagerNotNew.selector) {
                return (selector, "BorrowerOperations.BatchManagerNotNew()");
            }

            if (selector == BorrowerOperations.NewFeeNotLower.selector) {
                return (selector, "BorrowerOperations.NewFeeNotLower()");
            }

            if (selector == BorrowerOperations.CallerNotPriceFeed.selector) {
                return (selector, "BorrowerOperations.CallerNotPriceFeed()");
            }

            if (selector == BorrowerOperations.MinGeMax.selector) {
                return (selector, "BorrowerOperations.MinGeMax()");
            }

            if (selector == BorrowerOperations.AnnualManagementFeeTooHigh.selector) {
                return (selector, "BorrowerOperations.AnnualManagementFeeTooHigh()");
            }

            if (selector == BorrowerOperations.MinInterestRateChangePeriodTooLow.selector) {
                return (selector, "BorrowerOperations.MinInterestRateChangePeriodTooLow()");
            }

            if (selector == TroveManager.EmptyData.selector) {
                return (selector, "TroveManager.EmptyData()");
            }

            if (selector == TroveManager.NothingToLiquidate.selector) {
                return (selector, "TroveManager.NothingToLiquidate()");
            }

            if (selector == TroveManager.CallerNotBorrowerOperations.selector) {
                return (selector, "TroveManager.CallerNotBorrowerOperations()");
            }

            if (selector == TroveManager.CallerNotCollateralRegistry.selector) {
                return (selector, "TroveManager.CallerNotCollateralRegistry()");
            }

            if (selector == TroveManager.OnlyOneTroveLeft.selector) {
                return (selector, "TroveManager.OnlyOneTroveLeft()");
            }

            if (selector == TroveManager.NotShutDown.selector) {
                return (selector, "TroveManager.NotShutDown()");
            }

            if (selector == TroveManager.ZeroAmount.selector) {
                return (selector, "TroveManager.ZeroAmount()");
            }
        }

        if (revertData.length == 4 + 32) {
            bytes32 param = bytes32(revertData.slice(4));

            if (selector == TroveManager.MinCollNotReached.selector) {
                return (selector, string.concat("TroveManager.MinCollNotReached(", uint256(param).decimal(), ")"));
            }
        }

        _revert(revertData);
    }
}
