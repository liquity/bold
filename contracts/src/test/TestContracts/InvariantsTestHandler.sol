// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
import {Address} from "openzeppelin-contracts/contracts/utils/Address.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {REDEMPTION_FEE_FLOOR} from "../../Dependencies/Constants.sol";
import {LiquityContractsDev} from "../../deployment.sol";
import {IBorrowerOperations} from "../../Interfaces/IBorrowerOperations.sol";
import {ISortedTroves} from "../../Interfaces/ISortedTroves.sol";
import {ITroveManager} from "../../Interfaces/ITroveManager.sol";
import {LatestTroveData} from "../../Types/LatestTroveData.sol";
import {TroveChange} from "../../Types/TroveChange.sol";
import {StringFormatting} from "../Utils/StringFormatting.sol";
import {mulDivCeil, pow} from "../Utils/Math.sol";
import {IPriceFeedTestnet} from "./Interfaces/IPriceFeedTestnet.sol";
import {BaseHandler} from "./BaseHandler.sol";
import {BaseMultiCollateralTest} from "./BaseMultiCollateralTest.sol";
import {ITroveManagerTester} from "./Interfaces/ITroveManagerTester.sol";

import {
    _100pct,
    _1pct,
    CCR,
    COLL_GAS_COMPENSATION_CAP,
    COLL_GAS_COMPENSATION_DIVISOR,
    DECIMAL_PRECISION,
    ETH_GAS_COMPENSATION,
    INITIAL_BASE_RATE,
    INTEREST_RATE_ADJ_COOLDOWN,
    MAX_ANNUAL_INTEREST_RATE,
    MIN_DEBT,
    ONE_MINUTE,
    ONE_YEAR,
    REDEMPTION_BETA,
    REDEMPTION_MINUTE_DECAY_FACTOR,
    SP_YIELD_SPLIT,
    UPFRONT_INTEREST_PERIOD,
    URGENT_REDEMPTION_BONUS
} from "../../Dependencies/Constants.sol";

uint256 constant TIME_DELTA_MIN = 0;
uint256 constant TIME_DELTA_MAX = ONE_YEAR;

uint256 constant BORROWED_MIN = 0 ether; // Sometimes try borrowing too little
uint256 constant BORROWED_MAX = 100_000 ether;

uint256 constant INTEREST_RATE_MIN = 0; // TODO
uint256 constant INTEREST_RATE_MAX = MAX_ANNUAL_INTEREST_RATE * 11 / 10; // Sometimes try rates exceeding the max

uint256 constant ICR_MIN = 0.9 ether;
uint256 constant ICR_MAX = 2 * CCR;

uint256 constant TCR_MIN = 0.9 ether;
uint256 constant TCR_MAX = 2 * CCR;

enum AdjustedTroveProperties {
    onlyColl,
    onlyDebt,
    both,
    _COUNT
}

function add(uint256 x, int256 delta) pure returns (uint256) {
    return uint256(int256(x) + delta);
}

function update(mapping(uint256 => uint256) storage m, uint256 i, int256 delta) {
    if (delta > 0) {
        m[i] += uint256(delta);
    } else {
        m[i] -= uint256(-delta);
    }
}

library ToStringFunctions {
    function toString(ITroveManager.Status status) internal pure returns (string memory) {
        if (status == ITroveManager.Status.nonExistent) return "ITroveManager.Status.nonExistent";
        if (status == ITroveManager.Status.active) return "ITroveManager.Status.active";
        if (status == ITroveManager.Status.closedByOwner) return "ITroveManager.Status.closedByOwner";
        if (status == ITroveManager.Status.closedByLiquidation) return "ITroveManager.Status.closedByLiquidation";
        if (status == ITroveManager.Status.unredeemable) return "ITroveManager.Status.unredeemable";
        revert("Invalid status");
    }

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

contract InvariantsTestHandler is BaseHandler, BaseMultiCollateralTest {
    using Strings for *;
    using StringFormatting for *;
    using ToStringFunctions for *;
    using {add, pow} for uint256;
    using {update} for mapping(uint256 => uint256);

    struct OpenTroveContext {
        uint256 upperHint;
        uint256 lowerHint;
        LiquityContractsDev c;
        uint256 upfrontFee;
        uint256 debt;
        uint256 coll;
        uint256 troveId;
        bool wasOpen;
    }

    struct AdjustTroveContext {
        AdjustedTroveProperties prop;
        LiquityContractsDev c;
        uint256 troveId;
        LatestTroveData t;
        bool wasActive;
        uint256 oldTCR;
        int256 collDelta;
        int256 debtDelta;
        int256 $collDelta;
        uint256 upfrontFee;
    }

    struct AdjustTroveInterestRateContext {
        uint256 upperHint;
        uint256 lowerHint;
        LiquityContractsDev c;
        uint256 troveId;
        LatestTroveData t;
        bool wasActive;
        bool premature;
        uint256 upfrontFee;
    }

    struct LiquidationTotals {
        uint256 appliedCollRedist;
        uint256 appliedDebtRedist;
        uint256 collGasComp;
        uint256 spCollGain;
        uint256 spOffset;
        uint256 collRedist;
        uint256 debtRedist;
        uint256 collSurplus;
        uint256 interestAccrualDecrease;
    }

    struct RedeemedTrove {
        uint256 id;
        uint256 newColl;
        uint256 newDebt;
    }

    struct RedemptionTotals {
        uint256 attemptedAmount;
        uint256 appliedCollRedist;
        uint256 appliedDebtRedist;
        uint256 collRedeemed;
        uint256 debtRedeemed;
        int256 interestAccrualDelta;
    }

    uint256 constant OWNER_INDEX = 0;

    // Aliases
    ITroveManager.Status constant NON_EXISTENT = ITroveManager.Status.nonExistent;
    ITroveManager.Status constant ACTIVE = ITroveManager.Status.active;
    ITroveManager.Status constant CLOSED_BY_OWNER = ITroveManager.Status.closedByOwner;
    ITroveManager.Status constant CLOSED_BY_LIQ = ITroveManager.Status.closedByLiquidation;
    ITroveManager.Status constant UNREDEEMABLE = ITroveManager.Status.unredeemable;

    FunctionCaller immutable _functionCaller;

    // Constants (per branch)
    mapping(uint256 => uint256) MCR;
    mapping(uint256 => uint256) SCR;
    mapping(uint256 => uint256) LIQ_PENALTY_SP;
    mapping(uint256 => uint256) LIQ_PENALTY_REDIST;

    // Ghost variables (per branch)
    // TODO: also ghost Troves?
    mapping(uint256 => uint256) public numTroves;
    mapping(uint256 => uint256) public numZombies;
    mapping(uint256 => uint256) public activeDebt;
    mapping(uint256 => uint256) public activeColl;
    mapping(uint256 => uint256) public defaultDebt;
    mapping(uint256 => uint256) public defaultColl;
    mapping(uint256 => uint256) public collSurplus;
    mapping(uint256 => uint256) public spBoldDeposits;
    mapping(uint256 => uint256) public spBoldYield;
    mapping(uint256 => uint256) public spColl;
    mapping(uint256 => bool) public isShutdown;

    // Price per branch
    mapping(uint256 => uint256) _price;

    // Bold yield sent to the SP at a time when there are no deposits is lost forever
    // We keep track of the lost amount so we can use it in invariants
    mapping(uint256 => uint256) public spUnclaimableBoldYield; // branch index =>

    // All free-floating BOLD is kept in the handler, to be dealt out to actors as needed
    uint256 _handlerBold;

    // Used to keep track of base rate
    uint256 _baseRate = INITIAL_BASE_RATE;
    uint256 _timeSinceLastRedemption = 0;

    // Used to keep track of interest accrual (per branch)
    mapping(uint256 => uint256) _interestAccrual;
    mapping(uint256 => uint256) _pendingInterest;

    // Batch liquidation transient state
    mapping(uint256 => bool) _liquidationHasSeen; // TroveID =>
    address[] _liquidationBatch;
    address[] _liquidationPlan;

    // Redemption transient state (redeemed Troves per branch)
    mapping(uint256 => RedeemedTrove[]) _redemptionPlan;

    // Urgent redemption transient state
    mapping(uint256 => bool) _urgentRedemptionHasSeen; // TroveID =>
    address[] _urgentRedemptionBatch;
    RedeemedTrove[] _urgentRedemptionPlan;

    constructor(Contracts memory contracts) {
        _functionCaller = new FunctionCaller();
        setupContracts(contracts);

        for (uint256 i = 0; i < branches.length; ++i) {
            LiquityContractsDev memory c = branches[i];
            MCR[i] = c.troveManager.MCR();
            SCR[i] = c.troveManager.SCR();
            LIQ_PENALTY_SP[i] = c.troveManager.LIQUIDATION_PENALTY_SP();
            LIQ_PENALTY_REDIST[i] = c.troveManager.LIQUIDATION_PENALTY_REDISTRIBUTION();
            _price[i] = c.priceFeed.getPrice();
        }
    }

    //////////////////////////////////////////////
    // Public view functions used in invariants //
    //////////////////////////////////////////////

    function getRedemptionRate() public view returns (uint256) {
        return _getRedemptionRate(_getBaseRate());
    }

    function getBoldSupply() public view returns (uint256 boldSupply) {
        for (uint256 i = 0; i < branches.length; ++i) {
            boldSupply += activeDebt[i];
            boldSupply += defaultDebt[i];
        }
    }

    function getGasPool(uint256 i) external view returns (uint256) {
        return numTroves[i] * ETH_GAS_COMPENSATION;
    }

    function getPendingInterest(uint256 i) public view returns (uint256) {
        return Math.ceilDiv(_pendingInterest[i], ONE_YEAR * DECIMAL_PRECISION);
    }

    /////////////////////////////////////////
    // External functions called by fuzzer //
    /////////////////////////////////////////

    function warp(uint256 timeDelta) external {
        timeDelta = _bound(timeDelta, TIME_DELTA_MIN, TIME_DELTA_MAX);

        logCall("warp", timeDelta.groupRight());
        vm.warp(block.timestamp + timeDelta);

        _timeSinceLastRedemption += timeDelta;

        for (uint256 i = 0; i < branches.length; ++i) {
            if (!isShutdown[i]) _pendingInterest[i] += _interestAccrual[i] * timeDelta;
        }
    }

    function setPrice(uint256 i, uint256 tcr) external {
        i = _bound(i, 0, branches.length - 1);
        tcr = _bound(tcr, TCR_MIN, TCR_MAX);

        LiquityContractsDev memory c = branches[i];
        uint256 totalColl = _getTotalColl(i);
        vm.assume(totalColl > 0);

        uint256 totalDebt = _getTotalDebt(i);
        uint256 price = totalDebt * tcr / totalColl;
        vm.assume(price > 0); // This can happen if the branch only has empty zombies

        info("price: ", price.decimal());
        logCall("setPrice", i.toString(), tcr.decimal());

        c.priceFeed.setPrice(price);
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

        i = _bound(i, 0, branches.length - 1);
        borrowed = _bound(borrowed, BORROWED_MIN, BORROWED_MAX);
        icr = _bound(icr, ICR_MIN, ICR_MAX);
        interestRate = _bound(interestRate, INTEREST_RATE_MIN, INTEREST_RATE_MAX);
        v.upperHint = _pickHint(i, upperHintSeed);
        v.lowerHint = _pickHint(i, lowerHintSeed);

        v.c = branches[i];
        v.upfrontFee = hintHelpers.predictOpenTroveUpfrontFee(i, borrowed, interestRate);
        v.debt = borrowed + v.upfrontFee;
        v.coll = v.debt * icr / _price[i];

        info("upper hint: ", _hintToString(i, v.upperHint));
        info("lower hint: ", _hintToString(i, v.lowerHint));
        info("upfront fee: ", v.upfrontFee.decimal());
        info("coll: ", v.coll.decimal());
        info("debt: ", v.debt.decimal());

        logCall(
            "openTrove",
            i.toString(),
            borrowed.decimal(),
            icr.decimal(),
            interestRate.decimal(),
            upperHintSeed.toString(),
            lowerHintSeed.toString()
        );

        v.troveId = _troveIdOf(msg.sender);
        v.wasOpen = _isOpen(i, v.troveId);

        // TODO: randomly deal less than coll?
        _dealCollAndApprove(i, msg.sender, v.coll, address(v.c.borrowerOperations));
        _dealWETHAndApprove(msg.sender, ETH_GAS_COMPENSATION, address(v.c.borrowerOperations));

        vm.prank(msg.sender);
        try v.c.borrowerOperations.openTrove(
            msg.sender, OWNER_INDEX, v.coll, borrowed, v.upperHint, v.lowerHint, interestRate, v.upfrontFee
        ) {
            uint256 icr_ = _CR(i, v.coll, v.debt); // can be slightly different from `icr` due to int division
            uint256 newTCR = _TCR(i, int256(v.coll), int256(borrowed), v.upfrontFee);

            // Preconditions
            assertFalse(isShutdown[i], "Should have failed as branch had been shut down");
            assertFalse(v.wasOpen, "Should have failed as Trove was open");
            assertLeDecimal(interestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Should have failed as interest rate > max");
            assertGeDecimal(v.debt, MIN_DEBT, 18, "Should have failed as debt < min");
            assertGeDecimal(icr_, MCR[i], 18, "Should have failed as ICR < MCR");
            assertGeDecimal(newTCR, CCR, 18, "Should have failed as new TCR < CCR");

            // Effects (Trove)
            assertEqDecimal(v.c.troveManager.getTroveEntireColl(v.troveId), v.coll, 18, "Wrong coll");
            assertEqDecimal(v.c.troveManager.getTroveEntireDebt(v.troveId), v.debt, 18, "Wrong debt");
            assertEqDecimal(
                v.c.troveManager.getTroveAnnualInterestRate(v.troveId), interestRate, 18, "Wrong interest rate"
            );
            assertEq(v.c.troveManager.getTroveStatus(v.troveId).toString(), ACTIVE.toString(), "Wrong status");
            assertTrue(v.c.sortedTroves.contains(v.troveId), "Trove should have been inserted into SortedTroves");

            // Effects (system)
            _mintYield(i, v.upfrontFee);

            activeColl[i] += v.coll;
            activeDebt[i] += borrowed;

            _interestAccrual[i] += v.debt * interestRate;
            numTroves[i] += 1;

            // Cleanup
            _sweepBold(msg.sender, borrowed);
        } catch Error(string memory reason) {
            // Justify failures
            if (reason.equals("BO: Branch shut down")) {
                assertTrue(isShutdown[i], "Shouldn't have failed as branch hadn't been shut down");
            } else if (reason.equals("BorrowerOps: Trove is open")) {
                assertTrue(v.wasOpen, "Shouldn't have failed as Trove wasn't open");
            } else if (reason.equals("Interest rate must not be greater than max")) {
                assertGtDecimal(
                    interestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Shouldn't have failed as interest rate <= max"
                );
            } else if (reason.equals("BorrowerOps: Trove's debt must be greater than minimum")) {
                assertLtDecimal(v.debt, MIN_DEBT, 18, "Shouldn't have failed as debt >= min");
            } else if (reason.equals("BorrowerOps: An operation that would result in ICR < MCR is not permitted")) {
                uint256 icr_ = _CR(i, v.coll, v.debt);
                assertLtDecimal(icr_, MCR[i], 18, "Shouldn't have failed as ICR >= MCR");
            } else if (reason.equals("BorrowerOps: An operation that would result in TCR < CCR is not permitted")) {
                uint256 newTCR = _TCR(i, int256(v.coll), int256(borrowed), v.upfrontFee);
                assertLtDecimal(newTCR, CCR, 18, "Shouldn't have failed as new TCR >= CCR");
                info("New TCR would have been: ", newTCR.decimal());
            } else if (reason.equals("BorrowerOps: Operation not permitted below CT")) {
                uint256 tcr = _TCR(i);
                assertLtDecimal(tcr, CCR, 18, "Shouldn't have failed as TCR >= CCR");
                info("TCR: ", tcr.decimal());
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();

            // Cleanup
            _sweepCollAndUnapprove(i, msg.sender, v.coll, address(v.c.borrowerOperations));
            _sweepWETHAndUnapprove(msg.sender, ETH_GAS_COMPENSATION, address(v.c.borrowerOperations));
        }
    }

    function adjustTrove(
        uint256 i,
        uint8 prop,
        uint256 collChange,
        bool isCollIncrease,
        uint256 debtChange,
        bool isDebtIncrease
    ) external {
        AdjustTroveContext memory v;

        i = _bound(i, 0, branches.length - 1);
        v.prop = AdjustedTroveProperties(_bound(prop, 0, uint8(AdjustedTroveProperties._COUNT) - 1));

        v.c = branches[i];
        v.troveId = _troveIdOf(msg.sender);
        v.t = v.c.troveManager.getLatestTroveData(v.troveId);
        v.wasActive = v.c.troveManager.getTroveStatus(v.troveId) == ACTIVE;
        v.oldTCR = _TCR(i);

        collChange = v.prop != AdjustedTroveProperties.onlyDebt ? _bound(collChange, 0, v.t.entireColl * 11 / 10) : 0;
        debtChange = v.prop != AdjustedTroveProperties.onlyColl ? _bound(debtChange, 0, v.t.entireDebt * 11 / 10) : 0;
        if (!isDebtIncrease) debtChange = Math.min(debtChange, _handlerBold);

        v.collDelta = isCollIncrease ? int256(collChange) : -int256(collChange);
        v.debtDelta = isDebtIncrease ? int256(debtChange) : -int256(debtChange);
        v.$collDelta = v.collDelta * int256(_price[i]) / int256(DECIMAL_PRECISION);
        v.upfrontFee = hintHelpers.predictAdjustTroveUpfrontFee(i, v.troveId, isDebtIncrease ? debtChange : 0);

        info("upfront fee: ", v.upfrontFee.decimal());
        info("coll: ", v.t.entireColl.decimal());
        info("debt: ", v.t.entireDebt.decimal());
        info("coll redist: ", v.t.redistCollGain.decimal());
        info("debt redist: ", v.t.redistBoldDebtGain.decimal());
        info("accrued interest: ", v.t.accruedInterest.decimal());

        logCall(
            "adjustTrove",
            i.toString(),
            v.prop.toString(),
            collChange.decimal(),
            isCollIncrease.toString(),
            debtChange.decimal(),
            isDebtIncrease.toString()
        );

        // TODO: randomly deal less?
        if (isCollIncrease) _dealCollAndApprove(i, msg.sender, collChange, address(v.c.borrowerOperations));
        if (!isDebtIncrease) _dealBold(msg.sender, debtChange);

        vm.prank(msg.sender);
        try _functionCaller.call(
            address(v.c.borrowerOperations),
            _encodeTroveAdjustment(
                v.prop, v.troveId, collChange, isCollIncrease, debtChange, isDebtIncrease, v.upfrontFee
            )
        ) {
            uint256 newICR = _ICR(i, v.collDelta, v.debtDelta, v.upfrontFee, v.t);
            uint256 newTCR = _TCR(i, v.collDelta, v.debtDelta, v.upfrontFee);

            // Preconditions
            assertFalse(isShutdown[i], "Should have failed as branch had been shut down");
            assertTrue(collChange > 0 || debtChange > 0, "Should have failed as there was no change");
            assertTrue(v.wasActive, "Should have failed as Trove was not active");

            assertLeDecimal(-v.collDelta, int256(v.t.entireColl), 18, "Should have failed as coll decrease > coll");
            uint256 newColl = v.t.entireColl.add(v.collDelta);

            assertLeDecimal(-v.debtDelta, int256(v.t.entireDebt), 18, "Should have failed as debt decrease > debt");
            uint256 newDebt = (v.t.entireDebt + v.upfrontFee).add(v.debtDelta);

            assertGeDecimal(newDebt, MIN_DEBT, 28, "Should have failed as new debt < MIN_DEBT");
            assertGeDecimal(newICR, MCR[i], 18, "Should have failed as new ICR < MCR");

            if (v.oldTCR >= CCR) {
                assertGeDecimal(newTCR, CCR, 18, "Should have failed as new TCR < CCR");
            } else {
                assertLeDecimal(v.debtDelta, 0, 18, "Borrowing should have failed as TCR < CCR");
                assertGeDecimal(-v.debtDelta, -v.$collDelta, 18, "Repayment < withdrawal when TCR < CCR");
            }

            // Effects (Trove)
            assertEqDecimal(v.c.troveManager.getTroveEntireColl(v.troveId), newColl, 18, "Wrong coll");
            assertEqDecimal(v.c.troveManager.getTroveEntireDebt(v.troveId), newDebt, 18, "Wrong debt");
            if (v.upfrontFee > 0) assertGtDecimal(v.debtDelta, 0, 18, "Only debt increase should incur upfront fee");

            // Effects (system)
            _mintYield(i, v.upfrontFee);

            activeColl[i] += v.t.redistCollGain;
            defaultColl[i] -= v.t.redistCollGain;

            activeDebt[i] += v.t.redistBoldDebtGain;
            defaultDebt[i] -= v.t.redistBoldDebtGain;

            activeColl.update(i, v.collDelta);
            activeDebt.update(i, v.debtDelta);

            _interestAccrual[i] += newDebt * v.t.annualInterestRate;
            _interestAccrual[i] -= v.t.recordedDebt * v.t.annualInterestRate;

            // Cleanup
            if (!isCollIncrease) _sweepColl(i, msg.sender, collChange);
            if (isDebtIncrease) _sweepBold(msg.sender, debtChange);
        } catch Error(string memory reason) {
            // Justify errors
            if (reason.equals("BO: Branch shut down")) {
                assertTrue(isShutdown[i], "Shouldn't have failed as branch hadn't been shut down");
            } else if (reason.equals("BorrowerOps: There must be either a collateral change or a debt change")) {
                assertEqDecimal(collChange, 0, 18, "Shouldn't have failed as there was a coll change");
                assertEqDecimal(debtChange, 0, 18, "Shouldn't have failed as there was a debt change");
            } else if (reason.equals("BorrowerOps: Trove does not have active status")) {
                assertFalse(v.wasActive, "Shouldn't have failed as Trove was active");
            } else if (reason.equals("BorrowerOps: Can't withdraw more than the Trove's entire collateral")) {
                assertGtDecimal(-v.collDelta, int256(v.t.entireColl), 18, "Shouldn't have failed as withdrawal <= coll");
            } else if (reason.equals("BorrowerOps: Amount repaid must not be larger than the Trove's debt")) {
                assertGtDecimal(-v.debtDelta, int256(v.t.entireDebt), 18, "Shouldn't have failed as repayment <= debt");
            } else if (reason.equals("BorrowerOps: Trove's debt must be greater than minimum")) {
                uint256 newDebt = (v.t.entireDebt + v.upfrontFee).add(v.debtDelta);
                assertLtDecimal(newDebt, MIN_DEBT, 18, "Shouldn't have failed as new debt >= MIN_DEBT");
                info("New debt would have been: ", newDebt.decimal());
            } else if (reason.equals("BorrowerOps: An operation that would result in ICR < MCR is not permitted")) {
                uint256 newICR = _ICR(i, v.collDelta, v.debtDelta, v.upfrontFee, v.t);
                assertLtDecimal(newICR, MCR[i], 18, "Shouldn't have failed as new ICR >= MCR");
                info("New ICR would have been: ", newICR.decimal());
            } else if (reason.equals("BorrowerOps: An operation that would result in TCR < CCR is not permitted")) {
                uint256 newTCR = _TCR(i, v.collDelta, v.debtDelta, v.upfrontFee);
                assertGeDecimal(v.oldTCR, CCR, 18, "TCR was already < CCR");
                assertLtDecimal(newTCR, CCR, 18, "Shouldn't have failed as new TCR >= CCR");
                info("New TCR would have been: ", newTCR.decimal());
            } else if (reason.equals("BorrowerOps: Borrowing not permitted below CT")) {
                assertLtDecimal(v.oldTCR, CCR, 18, "Shouldn't have failed as TCR >= CCR");
                assertGtDecimal(v.debtDelta, 0, 18, "Shouldn't have failed as there was no borrowing");
            } else if (reason.equals("BorrowerOps: below CT, repayment must be >= coll withdrawal")) {
                assertLtDecimal(v.oldTCR, CCR, 18, "Shouldn't have failed as TCR >= CCR");
                assertLtDecimal(-v.debtDelta, -v.$collDelta, 18, "Shouldn't have failed as repayment >= withdrawal");
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();

            // Cleanup
            if (isCollIncrease) _sweepCollAndUnapprove(i, msg.sender, collChange, address(v.c.borrowerOperations));
            if (!isDebtIncrease) _sweepBold(msg.sender, debtChange);
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
        v.troveId = _troveIdOf(msg.sender);
        v.t = v.c.troveManager.getLatestTroveData(v.troveId);
        v.wasActive = v.c.troveManager.getTroveStatus(v.troveId) == ACTIVE;
        v.premature = block.timestamp < v.t.lastInterestRateAdjTime + INTEREST_RATE_ADJ_COOLDOWN;
        v.upfrontFee = hintHelpers.predictAdjustInterestRateUpfrontFee(i, v.troveId, newInterestRate);

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
            uint256 newICR = _ICR(i, 0, 0, v.upfrontFee, v.t);
            uint256 newTCR = _TCR(i, 0, 0, v.upfrontFee);

            // Preconditions
            assertFalse(isShutdown[i], "Should have failed as branch had been shut down");
            assertTrue(v.wasActive, "Should have failed as Trove was not active");
            assertLeDecimal(newInterestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Should have failed as interest rate > max");

            if (v.premature) {
                assertGeDecimal(newICR, MCR[i], 18, "Should have failed as new ICR < MCR");
                assertGeDecimal(newTCR, CCR, 18, "Should have failed as new TCR < CCR");
            }

            // Effects (Trove)
            assertEqDecimal(v.c.troveManager.getTroveEntireColl(v.troveId), v.t.entireColl, 18, "Wrong coll");
            assertEqDecimal(
                v.c.troveManager.getTroveEntireDebt(v.troveId), v.t.entireDebt + v.upfrontFee, 18, "Wrong debt"
            );
            assertEqDecimal(
                v.c.troveManager.getTroveAnnualInterestRate(v.troveId), newInterestRate, 18, "Wrong interest rate"
            );
            if (v.upfrontFee > 0) assertTrue(v.premature, "Only premature adjustment should incur upfront fee");

            // Effects (system)
            _mintYield(i, v.upfrontFee);

            activeColl[i] += v.t.redistCollGain;
            defaultColl[i] -= v.t.redistCollGain;

            activeDebt[i] += v.t.redistBoldDebtGain;
            defaultDebt[i] -= v.t.redistBoldDebtGain;

            _interestAccrual[i] += (v.t.entireDebt + v.upfrontFee) * newInterestRate;
            _interestAccrual[i] -= v.t.recordedDebt * v.t.annualInterestRate;
        } catch Error(string memory reason) {
            // Justify failures
            if (reason.equals("BO: Branch shut down")) {
                assertTrue(isShutdown[i], "Shouldn't have failed as branch hadn't been shut down");
            } else if (reason.equals("ERC721: invalid token ID")) {
                assertFalse(_isOpen(i, v.troveId), "Open Trove should have an NFT");
            } else if (reason.equals("BorrowerOps: Trove does not have active status")) {
                assertFalse(v.wasActive, "Shouldn't have failed as Trove was active");
            } else if (reason.equals("Interest rate must not be greater than max")) {
                assertGtDecimal(
                    newInterestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Shouldn't have failed as interest rate <= max"
                );
            } else if (reason.equals("BorrowerOps: An operation that would result in ICR < MCR is not permitted")) {
                uint256 newICR = _ICR(i, 0, 0, v.upfrontFee, v.t);
                assertTrue(v.premature, "Shouldn't have failed as adjustment was not premature");
                assertLtDecimal(newICR, MCR[i], 18, "Shouldn't have failed as new ICR >= MCR");
                info("New ICR would have been: ", newICR.decimal());
            } else if (reason.equals("BorrowerOps: An operation that would result in TCR < CCR is not permitted")) {
                uint256 newTCR = _TCR(i, 0, 0, v.upfrontFee);
                assertTrue(v.premature, "Shouldn't have failed as adjustment was not premature");
                assertLtDecimal(newTCR, CCR, 18, "Shouldn't have failed as new TCR >= CCR");
                info("New TCR would have been: ", newTCR.decimal());
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();
        }
    }

    function closeTrove(uint256 i) external {
        i = _bound(i, 0, branches.length - 1);

        LiquityContractsDev memory c = branches[i];
        uint256 troveId = _troveIdOf(msg.sender);
        LatestTroveData memory t = c.troveManager.getLatestTroveData(troveId);
        bool wasOpen = _isOpen(i, troveId);

        logCall("closeTrove", i.toString());

        uint256 dealt = Math.min(t.entireDebt, _handlerBold);
        _dealBold(msg.sender, dealt);

        vm.prank(msg.sender);
        try c.borrowerOperations.closeTrove(troveId) {
            uint256 newTCR = _TCR(i, -int256(t.entireColl), -int256(t.entireDebt), 0);

            // Preconditions
            assertTrue(wasOpen, "Should have failed as Trove wasn't open");
            assertGt(numTroves[i], 1, "Should have failed to close last Trove in the system");
            if (!isShutdown[i]) assertGeDecimal(newTCR, CCR, 18, "Should have failed as new TCR < CCR");

            // Effects (Trove)
            assertEqDecimal(c.troveManager.getTroveEntireColl(troveId), 0, 18, "Coll should have been zeroed");
            assertEqDecimal(c.troveManager.getTroveEntireDebt(troveId), 0, 18, "Debt should have been zeroed");
            assertEq(c.troveManager.getTroveStatus(troveId).toString(), CLOSED_BY_OWNER.toString(), "Wrong status");
            assertFalse(c.sortedTroves.contains(troveId), "Trove should have been removed from SortedTroves");

            // Effects (system)
            _mintYield(i, 0);

            activeColl[i] += t.redistCollGain;
            defaultColl[i] -= t.redistCollGain;

            activeDebt[i] += t.redistBoldDebtGain;
            defaultDebt[i] -= t.redistBoldDebtGain;

            activeColl[i] -= t.entireColl;
            activeDebt[i] -= t.entireDebt;

            _interestAccrual[i] -= t.recordedDebt * t.annualInterestRate;
            numTroves[i] -= 1;
            if (t.recordedDebt < MIN_DEBT) numZombies[i] -= 1;

            // Cleanup
            _sweepColl(i, msg.sender, t.entireColl);
            _sweepWETH(msg.sender, ETH_GAS_COMPENSATION);
        } catch Error(string memory reason) {
            // Justify failures
            if (reason.equals("ERC721: invalid token ID")) {
                assertFalse(wasOpen, "Open Trove should have an NFT");
            } else if (reason.equals("BorrowerOps: Caller doesnt have enough Bold to make repayment")) {
                assertLtDecimal(dealt, t.entireDebt, 18, "Shouldn't have failed as caller had enough Bold");
            } else if (reason.equals("TroveManager: Only one trove in the system")) {
                assertEq(numTroves[i], 1, "Shouldn't have failed as there was at least one Trove left in the system");
            } else if (reason.equals("BorrowerOps: An operation that would result in TCR < CCR is not permitted")) {
                uint256 newTCR = _TCR(i, -int256(t.entireColl), -int256(t.entireDebt), 0);
                assertFalse(isShutdown[i], "Shouldn't have failed as branch had been shut down");
                assertLtDecimal(newTCR, CCR, 18, "Shouldn't have failed as new TCR >= CCR");
                info("New TCR would have been: ", newTCR.decimal());
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();

            // Cleanup
            _sweepBold(msg.sender, dealt);
        }
    }

    function addMeToLiquidationBatch() external {
        logCall("addMeToLiquidationBatch");
        _addToLiquidationBatch(msg.sender);
    }

    function batchLiquidateTroves(uint256 i) external {
        i = _bound(i, 0, branches.length - 1);

        LiquityContractsDev memory c = branches[i];
        LiquidationTotals memory t;
        _planLiquidation(i, t);

        info("batch: [", _labelsFrom(_liquidationBatch).join(", "), "]");
        info("liquidatable: [", _labelsFrom(_liquidationPlan).join(", "), "]");
        logCall("batchLiquidateTroves", i.toString());

        vm.prank(msg.sender);
        try c.troveManager.batchLiquidateTroves(_troveIdsFrom(_liquidationBatch)) {
            info("SP BOLD: ", c.stabilityPool.getTotalBoldDeposits().decimal());
            info("P: ", c.stabilityPool.P().decimal());
            _log();

            // Preconditions
            assertGt(_liquidationBatch.length, 0, "Should have failed as batch was empty");
            assertGt(_liquidationPlan.length, 0, "Should have failed as there was nothing to liquidate");
            assertGt(numTroves[i] - _liquidationPlan.length, 0, "Should have failed to liquidate last Trove");

            // Effects (Troves)
            for (uint256 j = 0; j < _liquidationPlan.length; ++j) {
                uint256 troveId = _troveIdOf(_liquidationPlan[j]);
                assertEqDecimal(c.troveManager.getTroveEntireColl(troveId), 0, 18, "Coll should have been zeroed");
                assertEqDecimal(c.troveManager.getTroveEntireDebt(troveId), 0, 18, "Debt should have been zeroed");
                assertEq(c.troveManager.getTroveStatus(troveId).toString(), CLOSED_BY_LIQ.toString(), "Wrong status");
                assertFalse(c.sortedTroves.contains(troveId), "Trove should have been removed from SortedTroves");
            }

            // Effects (system)
            _mintYield(i, 0);

            activeColl[i] += t.appliedCollRedist;
            defaultColl[i] -= t.appliedCollRedist;

            activeDebt[i] += t.appliedDebtRedist;
            defaultDebt[i] -= t.appliedDebtRedist;

            spColl[i] += t.spCollGain;
            activeColl[i] -= t.spCollGain;

            spBoldDeposits[i] -= t.spOffset;
            activeDebt[i] -= t.spOffset;

            defaultColl[i] += t.collRedist;
            activeColl[i] -= t.collRedist;

            defaultDebt[i] += t.debtRedist;
            activeDebt[i] -= t.debtRedist;

            collSurplus[i] += t.collSurplus;
            activeColl[i] -= t.collSurplus;

            activeColl[i] -= t.collGasComp;
            _interestAccrual[i] -= t.interestAccrualDecrease;
            numTroves[i] -= _liquidationPlan.length;

            // Cleanup
            _sweepColl(i, msg.sender, t.collGasComp);
            _sweepWETH(msg.sender, _liquidationPlan.length * ETH_GAS_COMPENSATION);
        } catch Error(string memory reason) {
            // Justify failures
            if (reason.equals("TroveManager: Calldata address array must not be empty")) {
                assertEq(_liquidationBatch.length, 0, "Shouldn't have failed as batch was not empty");
            } else if (reason.equals("TroveManager: nothing to liquidate")) {
                assertEq(_liquidationPlan.length, 0, "Shouldn't have failed as there were liquidatable Troves");
            } else if (reason.equals("TroveManager: Only one trove in the system")) {
                assertEq(numTroves[i] - _liquidationPlan.length, 0, "Shouldn't have failed as there were Troves left");
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();
        }

        _resetLiquidation();
    }

    function redeemCollateral(uint256 amount, uint256 maxIterationsPerCollateral) external {
        uint256 maxNumTroves = 0;

        for (uint256 i = 0; i < branches.length; ++i) {
            maxNumTroves = Math.max(numTroves[i], maxNumTroves);
        }

        amount = _bound(amount, 0, _handlerBold);
        maxIterationsPerCollateral = _bound(maxIterationsPerCollateral, 0, maxNumTroves * 11 / 10);

        uint256 oldBaseRate = _getBaseRate();
        uint256 redemptionRate = _getRedemptionRate(oldBaseRate + _getBaseRateIncrease(amount));

        RedemptionTotals[] memory t = new RedemptionTotals[](branches.length);
        uint256 redeemedBold = _planRedemption(amount, maxIterationsPerCollateral, redemptionRate, t);
        assertLeDecimal(redeemedBold, amount, 18, "Total redeemed exceeds input amount");

        info("redemption rate: ", redemptionRate.decimal());
        info("redeemed BOLD: ", redeemedBold.decimal());
        info("redeemed Troves: [");
        for (uint256 i = 0; i < branches.length; ++i) {
            info("  [", isShutdown[i] ? "/* shutdown */" : _labelsFrom(_redemptionPlan, i).join(", "), "],");
        }
        info("]");
        logCall("redeemCollateral", amount.decimal(), maxIterationsPerCollateral.toString());

        // TODO: randomly deal less than amount?
        _dealBold(msg.sender, amount);

        vm.prank(msg.sender);
        try collateralRegistry.redeemCollateral(amount, maxIterationsPerCollateral, redemptionRate) {
            // Preconditions
            assertGtDecimal(amount, 0, 18, "Should have failed as amount was zero");

            // Effects (global)
            _baseRate = Math.min(oldBaseRate + _getBaseRateIncrease(redeemedBold), _100pct);
            if (_timeSinceLastRedemption >= ONE_MINUTE) _timeSinceLastRedemption = 0;

            for (uint256 j = 0; j < branches.length; ++j) {
                if (t[j].attemptedAmount == 0) continue; // no effects on unredeemed branches

                LiquityContractsDev memory c = branches[j];
                RedeemedTrove[] storage troves = _redemptionPlan[j];

                // Effects (Troves)
                for (uint256 i = 0; i < troves.length; ++i) {
                    RedeemedTrove memory trove = troves[i];

                    assertEqDecimal(c.troveManager.getTroveEntireColl(trove.id), trove.newColl, 18, "Wrong coll");
                    assertEqDecimal(c.troveManager.getTroveEntireDebt(trove.id), trove.newDebt, 18, "Wrong debt");

                    if (trove.newDebt < MIN_DEBT) {
                        assertEq(
                            c.troveManager.getTroveStatus(trove.id).toString(), UNREDEEMABLE.toString(), "Wrong status"
                        );
                        assertFalse(
                            c.sortedTroves.contains(trove.id), "Trove should have been removed from SortedTroves"
                        );
                    }
                }

                // Effects (system)
                _mintYield(j, 0);

                activeColl[j] += t[j].appliedCollRedist;
                defaultColl[j] -= t[j].appliedCollRedist;

                activeDebt[j] += t[j].appliedDebtRedist;
                defaultDebt[j] -= t[j].appliedDebtRedist;

                activeColl[j] -= t[j].collRedeemed;
                activeDebt[j] -= t[j].debtRedeemed;

                _interestAccrual.update(j, t[j].interestAccrualDelta);

                if (troves.length > 0) {
                    numZombies[j] += troves.length - 1; // all except last are guaranteed zombies
                    if (troves[troves.length - 1].newDebt < MIN_DEBT) numZombies[j] += 1;
                }

                // Cleanup (coll)
                _sweepColl(j, msg.sender, t[j].collRedeemed);
            }

            // Cleanup (remaining BOLD)
            _sweepBold(msg.sender, amount - redeemedBold);
        } catch Error(string memory reason) {
            // Justify failures
            if (reason.equals("TroveManager: Amount must be greater than zero")) {
                assertEqDecimal(amount, 0, 18, "Shouldn't have failed as amount was greater than zero");
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();

            // Cleanup
            _sweepBold(msg.sender, amount);
        }

        _resetRedemption();
    }

    function shutdown(uint256 i) external {
        i = _bound(i, 0, branches.length - 1);
        LiquityContractsDev memory c = branches[i];

        logCall("shutdown", i.toString());

        vm.prank(msg.sender);
        try c.borrowerOperations.shutdown() {
            // Preconditions
            assertLtDecimal(_TCR(i), SCR[i], 18, "Should have failed as TCR >= SCR");
            assertFalse(isShutdown[i], "Should have failed as branch had been shut down");

            // Effects
            isShutdown[i] = true;
            _mintYield(i, 0);
        } catch Error(string memory reason) {
            // Justify failures
            if (reason.equals("BO: TCR is not below SCR")) {
                assertGeDecimal(_TCR(i), SCR[i], 18, "Shouldn't have failed as TCR < SCR");
            } else if (reason.equals("BO: already shutdown")) {
                assertTrue(isShutdown[i], "Shouldn't have failed as branch hadn't been shut down");
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
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

        LiquityContractsDev memory c = branches[i];
        RedemptionTotals memory t;
        _planUrgentRedemption(i, amount, t);
        assertLeDecimal(t.debtRedeemed, amount, 18, "Total redeemed exceeds input amount");

        info("redeemed BOLD: ", t.debtRedeemed.decimal());
        info("batch: [", _labelsFrom(_urgentRedemptionBatch).join(", "), "]");
        logCall("urgentRedemption", i.toString(), amount.decimal());

        // TODO: randomly deal less than amount?
        _dealBold(msg.sender, amount);

        vm.prank(msg.sender);
        try c.troveManager.urgentRedemption(amount, _troveIdsFrom(_urgentRedemptionBatch), t.collRedeemed) {
            // Preconditions
            assertTrue(isShutdown[i], "Should have failed as branch hadn't been shut down");

            // Effects (Troves)
            for (uint256 j = 0; j < _urgentRedemptionPlan.length; ++j) {
                RedeemedTrove memory trove = _urgentRedemptionPlan[j];
                assertEqDecimal(c.troveManager.getTroveEntireColl(trove.id), trove.newColl, 18, "Wrong coll");
                assertEqDecimal(c.troveManager.getTroveEntireDebt(trove.id), trove.newDebt, 18, "Wrong debt");
            }

            // Effects (system)
            _mintYield(i, 0);

            activeColl[i] += t.appliedCollRedist;
            defaultColl[i] -= t.appliedCollRedist;

            activeDebt[i] += t.appliedDebtRedist;
            defaultDebt[i] -= t.appliedDebtRedist;

            activeColl[i] -= t.collRedeemed;
            activeDebt[i] -= t.debtRedeemed;

            _interestAccrual.update(i, t.interestAccrualDelta);

            // Cleanup (coll)
            _sweepColl(i, msg.sender, t.collRedeemed);

            // Cleanup (remaining BOLD)
            _sweepBold(msg.sender, amount - t.debtRedeemed);
        } catch Error(string memory reason) {
            // Justify failures
            if (reason.equals("TroveManager: Branch is not shut down")) {
                assertFalse(isShutdown[i], "Shouldn't have failed as branch had been shut down");
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();

            // Cleanup
            _sweepBold(msg.sender, amount);
        }

        _resetUrgentRedemption();
    }

    function provideToSP(uint256 i, uint256 amount, bool claim) external {
        i = _bound(i, 0, branches.length - 1);
        amount = _bound(amount, 0, _handlerBold);

        LiquityContractsDev memory c = branches[i];
        uint256 initialBoldDeposit = c.stabilityPool.deposits(msg.sender);
        uint256 boldDeposit = c.stabilityPool.getCompoundedBoldDeposit(msg.sender);
        uint256 boldYield = c.stabilityPool.getDepositorYieldGainWithPending(msg.sender);
        uint256 ethGain = c.stabilityPool.getDepositorCollGain(msg.sender);
        uint256 ethStash = c.stabilityPool.stashedColl(msg.sender);

        info("initial deposit: ", initialBoldDeposit.decimal());
        info("compounded deposit: ", boldDeposit.decimal());
        info("yield gain: ", boldYield.decimal());
        info("coll gain: ", ethGain.decimal());
        info("stashed coll: ", ethStash.decimal());
        logCall("provideToSP", i.toString(), amount.decimal(), claim.toString());

        // TODO: randomly deal less than amount?
        _dealBold(msg.sender, amount);

        vm.prank(msg.sender);
        try c.stabilityPool.provideToSP(amount, claim) {
            // Preconditions
            assertGtDecimal(amount, 0, 18, "Should have failed as amount was zero");

            // Effects (deposit)
            uint256 ethClaimed = claim ? ethStash + ethGain : 0;
            uint256 boldClaimed = claim ? boldYield : 0;

            ethStash += ethGain;
            ethStash -= ethClaimed;

            boldDeposit += amount;
            boldDeposit += boldYield;
            boldDeposit -= boldClaimed;

            assertEqDecimal(c.stabilityPool.getCompoundedBoldDeposit(msg.sender), boldDeposit, 18, "Wrong deposit");
            assertEqDecimal(c.stabilityPool.getDepositorYieldGain(msg.sender), 0, 18, "Wrong yield gain");
            assertEqDecimal(c.stabilityPool.getDepositorCollGain(msg.sender), 0, 18, "Wrong coll gain");
            assertEqDecimal(c.stabilityPool.stashedColl(msg.sender), ethStash, 18, "Wrong stashed coll");

            // Effects (system)
            _mintYield(i, 0);

            spColl[i] -= ethClaimed;
            spBoldDeposits[i] += amount;
            spBoldDeposits[i] += boldYield;
            spBoldDeposits[i] -= boldClaimed;
            spBoldYield[i] -= boldYield;

            // Cleanup
            _sweepBold(msg.sender, boldClaimed);
            _sweepColl(i, msg.sender, ethClaimed);
        } catch Error(string memory reason) {
            // Justify failures
            if (reason.equals("StabilityPool: Amount must be non-zero")) {
                assertEqDecimal(amount, 0, 18, "Shouldn't have failed as amount was non-zero");
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();

            // Cleanup
            _sweepBold(msg.sender, amount); // Take back the BOLD that was dealt
        }
    }

    function withdrawFromSP(uint256 i, uint256 amount, bool claim) external {
        i = _bound(i, 0, branches.length - 1);

        LiquityContractsDev memory c = branches[i];
        uint256 initialBoldDeposit = c.stabilityPool.deposits(msg.sender);
        uint256 boldDeposit = c.stabilityPool.getCompoundedBoldDeposit(msg.sender);
        uint256 boldYield = c.stabilityPool.getDepositorYieldGainWithPending(msg.sender);
        uint256 ethGain = c.stabilityPool.getDepositorCollGain(msg.sender);
        uint256 ethStash = c.stabilityPool.stashedColl(msg.sender);

        amount = _bound(amount, 0, boldDeposit * 11 / 10); // sometimes try withdrawing too much
        uint256 withdrawn = Math.min(amount, boldDeposit);

        info("initial deposit: ", initialBoldDeposit.decimal());
        info("compounded deposit: ", boldDeposit.decimal());
        info("yield gain: ", boldYield.decimal());
        info("coll gain: ", ethGain.decimal());
        info("stashed coll: ", ethStash.decimal());
        logCall("withdrawFromSP", i.toString(), amount.decimal(), claim.toString());

        vm.prank(msg.sender);
        try c.stabilityPool.withdrawFromSP(amount, claim) {
            // Preconditions
            assertGtDecimal(initialBoldDeposit, 0, 18, "Should have failed as user had zero deposit");

            // Effects (deposit)
            uint256 ethClaimed = claim ? ethStash + ethGain : 0;
            uint256 boldClaimed = claim ? boldYield : 0;

            ethStash += ethGain;
            ethStash -= ethClaimed;

            boldDeposit += boldYield;
            boldDeposit -= boldClaimed;
            boldDeposit -= withdrawn;

            assertEqDecimal(c.stabilityPool.getCompoundedBoldDeposit(msg.sender), boldDeposit, 18, "Wrong deposit");
            assertEqDecimal(c.stabilityPool.getDepositorYieldGain(msg.sender), 0, 18, "Wrong yield gain");
            assertEqDecimal(c.stabilityPool.getDepositorCollGain(msg.sender), 0, 18, "Wrong coll gain");
            assertEqDecimal(c.stabilityPool.stashedColl(msg.sender), ethStash, 18, "Wrong stashed coll");

            // Effects (system)
            _mintYield(i, 0);

            spColl[i] -= ethClaimed;
            spBoldDeposits[i] += boldYield;
            spBoldDeposits[i] -= boldClaimed;
            spBoldDeposits[i] -= withdrawn;
            spBoldYield[i] -= boldYield;

            // Cleanup
            _sweepBold(msg.sender, boldClaimed + withdrawn);
            _sweepColl(i, msg.sender, ethClaimed);
        } catch Error(string memory reason) {
            // Justify failures
            if (reason.equals("StabilityPool: User must have a non-zero deposit")) {
                assertEqDecimal(
                    c.stabilityPool.deposits(msg.sender), 0, 18, "Shouldn't have failed as user had a non-zero deposit"
                );
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();
        }
    }

    // XXX unfinished
    // function registerBatchManager(
    //     uint256 i,
    //     uint128 minInterestRate,
    //     uint128 maxInterestRate,
    //     uint128 currentInterestRate,
    //     uint128 annualManagementFee,
    //     uint128 minInterestRateChangePeriod
    // ) external {
    //     i = _bound(i, 0, branches.length - 1);
    //     minInterestRate = uint128(_bound(minInterestRate, INTEREST_RATE_MIN, INTEREST_RATE_MAX));
    //     maxInterestRate = uint128(_bound(maxInterestRate, minInterestRate * 9 / 10, INTEREST_RATE_MAX));
    //     currentInterestRate = uint128(_bound(currentInterestRate, minInterestRate * 9 / 10, maxInterestRate * 11 / 10));

    //     LiquityContractsDev memory c = branches[i];
    //     bool existed = c.borrowerOperations.getInterestBatchManager(msg.sender).maxInterestRate > 0;

    //     vm.prank(msg.sender);
    //     try c.borrowerOperations.registerBatchManager(
    //         minInterestRate, maxInterestRate, currentInterestRate, annualManagementFee, minInterestRateChangePeriod
    //     ) {
    //         // Preconditions
    //         assertFalse(existed, "Should have failed as batch manager already existed");

    //         // Effects
    //         IBorrowerOperations.InterestBatchManager memory params =
    //             c.borrowerOperations.getInterestBatchManager(msg.sender);

    //     } catch Error(string memory reason) {
    //         // Justify failures
    //         if (reason.equals("BO: Batch Manager already exists")) {
    //             assertTrue(existed, "Shouldn't have failed as batch manager did not exist");
    //         } else {
    //             revert(reason);
    //         }

    //         info("Expected revert: ", reason);
    //         _log();
    //     }
    // }

    ///////////////////////////////
    // Internal helper functions //
    ///////////////////////////////

    function _getBaseRate() internal view returns (uint256) {
        uint256 minutesSinceLastRedemption = _timeSinceLastRedemption / ONE_MINUTE;
        uint256 decaySinceLastRedemption = REDEMPTION_MINUTE_DECAY_FACTOR.pow(minutesSinceLastRedemption);
        return _baseRate * decaySinceLastRedemption / DECIMAL_PRECISION;
    }

    function _getBaseRateIncrease(uint256 redeemed) internal view returns (uint256) {
        uint256 boldSupply = getBoldSupply();
        return boldSupply > 0 ? redeemed * DECIMAL_PRECISION / boldSupply / REDEMPTION_BETA : 0;
    }

    function _getRedemptionRate(uint256 baseRate) internal pure returns (uint256) {
        return Math.min(REDEMPTION_FEE_FLOOR + baseRate, _100pct);
    }

    function _getTotalColl(uint256 i) internal view returns (uint256) {
        return activeColl[i] + defaultColl[i];
    }

    function _getTotalDebt(uint256 i) internal view returns (uint256) {
        return activeDebt[i] + defaultDebt[i] + getPendingInterest(i);
    }

    function _getUnbacked(uint256 i) internal view returns (uint256) {
        uint256 sp = spBoldDeposits[i];
        uint256 totalDebt = _getTotalDebt(i);

        return sp < totalDebt ? totalDebt - sp : 0;
    }

    function _CR(uint256 i, uint256 coll, uint256 debt) internal view returns (uint256) {
        return debt > 0 ? coll * _price[i] / debt : type(uint256).max;
    }

    function _ICR(uint256 i, LatestTroveData memory trove) internal view returns (uint256) {
        return _ICR(i, 0, 0, 0, trove);
    }

    function _ICR(uint256 i, int256 collDelta, int256 debtDelta, uint256 upfrontFee, LatestTroveData memory trove)
        internal
        view
        returns (uint256)
    {
        uint256 coll = trove.entireColl.add(collDelta);
        uint256 debt = (trove.entireDebt + upfrontFee).add(debtDelta);

        return _CR(i, coll, debt);
    }

    function _TCR(uint256 i) internal view returns (uint256) {
        return _TCR(i, 0, 0, 0);
    }

    function _TCR(uint256 i, int256 collDelta, int256 debtDelta, uint256 upfrontFee) internal view returns (uint256) {
        uint256 totalColl = _getTotalColl(i).add(collDelta);
        uint256 totalDebt = (_getTotalDebt(i) + upfrontFee).add(debtDelta);

        return _CR(i, totalColl, totalDebt);
    }

    // We open at most one Trove per actor per branch, for reasons of simplicity,
    // as Troves aren't enumerable per user, only globally.
    function _troveIdOf(address owner) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(owner, OWNER_INDEX)));
    }

    function _troveIdsFrom(address[] storage owners) internal view returns (uint256[] memory ret) {
        ret = new uint256[](owners.length);

        for (uint256 i = 0; i < owners.length; ++i) {
            ret[i] = _troveIdOf(owners[i]);
        }
    }

    function _labelsFrom(address[] storage owners) internal view returns (string[] memory ret) {
        ret = new string[](owners.length);

        for (uint256 i = 0; i < owners.length; ++i) {
            ret[i] = vm.getLabel(owners[i]);
        }
    }

    function _labelsFrom(mapping(uint256 => RedeemedTrove[]) storage redemptionPlan, uint256 i)
        internal
        view
        returns (string[] memory ret)
    {
        RedeemedTrove[] storage redeemed = redemptionPlan[i];
        ret = new string[](redeemed.length);

        for (uint256 j = 0; j < redeemed.length; ++j) {
            ret[j] = vm.getLabel(branches[i].troveManager.ownerOf(redeemed[j].id));
        }
    }

    function _isOpen(uint256 i, uint256 troveId) internal view returns (bool) {
        ITroveManager.Status status = branches[i].troveManager.getTroveStatus(troveId);
        return status == ACTIVE || status == UNREDEEMABLE;
    }

    function _pickHint(uint256 i, uint256 seed) internal view returns (uint256) {
        ITroveManager troveManager = branches[i].troveManager;

        // We're going to pull:
        // - 50% of the time a valid ID, including 0 (end of list)
        // - 50% of the time a random (nonexistent) ID
        uint256 rem = seed % (2 * (numTroves[i] + 1));

        if (rem == 0) {
            return 0;
        } else if (rem <= numTroves[i]) {
            return troveManager.getTroveFromTroveIdsArray(numTroves[i] - 1);
        } else {
            // pick a pseudo-random number
            return uint256(keccak256(abi.encodePacked(seed)));
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

    // function _dumpSortedTroves(uint256 i) internal {
    //     ISortedTroves sortedTroves = branches[i].sortedTroves;
    //     ITroveManager troveManager = branches[i].troveManager;

    //     info("SortedTroves: [");
    //     for (uint256 curr = sortedTroves.getFirst(); curr != 0; curr = sortedTroves.getNext(curr)) {
    //         info(
    //             "  Trove({owner: ",
    //             vm.getLabel(troveManager.ownerOf(curr)),
    //             ", annualInterestRate: ",
    //             troveManager.getTroveAnnualInterestRate(curr).decimal(),
    //             "}),"
    //         );
    //     }
    //     info("]");
    // }

    function _mintYield(uint256 i, uint256 upfrontFee) internal {
        uint256 mintedInterest = getPendingInterest(i);
        _pendingInterest[i] = 0;

        uint256 mintedYield = mintedInterest + upfrontFee;
        activeDebt[i] += mintedYield;

        uint256 mintedSPBoldYield = mintedYield * SP_YIELD_SPLIT / DECIMAL_PRECISION;
        if (spBoldDeposits[i] == 0) {
            spUnclaimableBoldYield[i] += mintedSPBoldYield;
        } else {
            spBoldYield[i] += mintedSPBoldYield;
        }
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
        _liquidationBatch.push(owner);
    }

    function _aggregateLiquidation(uint256 i, LatestTroveData memory trove, LiquidationTotals memory t) internal view {
        // Pending redist
        t.appliedDebtRedist += trove.redistBoldDebtGain;
        t.appliedCollRedist += trove.redistCollGain;

        // Coll gas comp
        uint256 collRemaining = trove.entireColl;
        uint256 collGasComp = Math.min(collRemaining / COLL_GAS_COMPENSATION_DIVISOR, COLL_GAS_COMPENSATION_CAP);
        t.collGasComp += collGasComp;
        collRemaining -= collGasComp;

        // Offset debt by SP
        uint256 spOffset = Math.min(trove.entireDebt, spBoldDeposits[i] - t.spOffset);
        t.spOffset += spOffset;

        // Send coll to SP
        uint256 collSPPortion = collRemaining * spOffset / trove.entireDebt;
        uint256 spCollGain = Math.min(collSPPortion, spOffset * (_100pct + LIQ_PENALTY_SP[i]) / _price[i]);
        t.spCollGain += spCollGain;
        collRemaining -= spCollGain;

        // Redistribute debt
        uint256 debtRedist = trove.entireDebt - spOffset;
        t.debtRedist += debtRedist;

        // Redistribute coll
        uint256 collRedist = Math.min(collRemaining, debtRedist * (_100pct + LIQ_PENALTY_REDIST[i]) / _price[i]);
        t.collRedist += collRedist;
        collRemaining -= collRedist;

        // Surplus
        t.collSurplus += collRemaining;

        // Interest accrual
        t.interestAccrualDecrease += trove.recordedDebt * trove.annualInterestRate;
    }

    function _planLiquidation(uint256 i, LiquidationTotals memory t) internal {
        ITroveManager troveManager = branches[i].troveManager;

        for (uint256 j = 0; j < _liquidationBatch.length; ++j) {
            uint256 troveId = _troveIdOf(_liquidationBatch[j]);

            if (_liquidationHasSeen[troveId]) continue; // skip duplicate entry
            _liquidationHasSeen[troveId] = true;

            LatestTroveData memory trove = troveManager.getLatestTroveData(troveId);
            if (trove.entireDebt == 0 || _ICR(i, trove) >= MCR[i]) continue;

            _liquidationPlan.push(_liquidationBatch[j]);
            _aggregateLiquidation(i, trove, t);
        }
    }

    function _resetLiquidation() internal {
        for (uint256 i = 0; i < _liquidationBatch.length; ++i) {
            delete _liquidationHasSeen[_troveIdOf(_liquidationBatch[i])];
        }

        delete _liquidationBatch;
        delete _liquidationPlan;
    }

    function _planRedemption(
        uint256 amount,
        uint256 maxIterationsPerCollateral,
        uint256 feePct,
        RedemptionTotals[] memory t
    ) internal returns (uint256 totalRedeemed) {
        uint256 totalUnbacked = 0;
        uint256[] memory unbacked = new uint256[](branches.length);

        for (uint256 j = 0; j < branches.length; ++j) {
            if (isShutdown[j] || _TCR(j) < SCR[j]) continue;
            totalUnbacked += unbacked[j] = _getUnbacked(j);
        }

        if (totalUnbacked == 0) return 0;

        for (uint256 j = 0; j < branches.length; ++j) {
            t[j].attemptedAmount = amount * unbacked[j] / totalUnbacked;
            if (t[j].attemptedAmount == 0) continue;

            LiquityContractsDev memory c = branches[j];
            uint256 remainingAmount = t[j].attemptedAmount;
            uint256 troveId = 0; // "root node" ID

            for (uint256 i = 0; i < maxIterationsPerCollateral || maxIterationsPerCollateral == 0; ++i) {
                if (remainingAmount == 0) break;

                troveId = c.sortedTroves.getPrev(troveId);
                if (troveId == 0) break;

                LatestTroveData memory trove = c.troveManager.getLatestTroveData(troveId);
                if (_ICR(j, trove) < _100pct) continue;

                uint256 debtRedeemed = Math.min(remainingAmount, trove.entireDebt);
                uint256 collRedeemedPlusFee = debtRedeemed * DECIMAL_PRECISION / _price[j];
                uint256 fee = collRedeemedPlusFee * feePct / _100pct;
                uint256 collRedeemed = collRedeemedPlusFee - fee;

                RedeemedTrove storage redeemedTrove = _redemptionPlan[j].push() = RedeemedTrove({
                    id: troveId,
                    newColl: trove.entireColl - collRedeemed,
                    newDebt: trove.entireDebt - debtRedeemed
                });

                // Pending redist
                t[j].appliedDebtRedist += trove.redistBoldDebtGain;
                t[j].appliedCollRedist += trove.redistCollGain;

                // Total redeemed
                t[j].collRedeemed += collRedeemed;
                t[j].debtRedeemed += debtRedeemed;

                // Interest accrual
                t[j].interestAccrualDelta += int256(redeemedTrove.newDebt * trove.annualInterestRate);
                t[j].interestAccrualDelta -= int256(trove.recordedDebt * trove.annualInterestRate);

                totalRedeemed += debtRedeemed;
                remainingAmount -= debtRedeemed;
            }
        }
    }

    function _resetRedemption() internal {
        for (uint256 i = 0; i < branches.length; ++i) {
            delete _redemptionPlan[i];
        }
    }

    function _addToUrgentRedemptionBatch(address owner) internal {
        _urgentRedemptionBatch.push(owner);
    }

    function _planUrgentRedemption(uint256 i, uint256 amount, RedemptionTotals memory t) internal {
        for (uint256 j = 0; j < _urgentRedemptionBatch.length; ++j) {
            uint256 troveId = _troveIdOf(_urgentRedemptionBatch[j]);

            if (_urgentRedemptionHasSeen[troveId]) continue; // skip duplicate entry
            _urgentRedemptionHasSeen[troveId] = true;

            LatestTroveData memory trove = branches[i].troveManager.getLatestTroveData(troveId);
            uint256 debtRedeemed = Math.min(amount, trove.entireDebt);
            uint256 collRedeemed = debtRedeemed * (DECIMAL_PRECISION + URGENT_REDEMPTION_BONUS) / _price[i];

            if (collRedeemed > trove.entireColl) {
                collRedeemed = trove.entireColl;
                debtRedeemed = trove.entireColl * _price[i] / (DECIMAL_PRECISION + URGENT_REDEMPTION_BONUS);
            }

            RedeemedTrove storage redeemedTrove = _urgentRedemptionPlan.push() = RedeemedTrove({
                id: troveId,
                newColl: trove.entireColl - collRedeemed,
                newDebt: trove.entireDebt - debtRedeemed
            });

            // Pending redist
            t.appliedDebtRedist += trove.redistBoldDebtGain;
            t.appliedCollRedist += trove.redistCollGain;

            // Total redeemed
            t.collRedeemed += collRedeemed;
            t.debtRedeemed += debtRedeemed;

            // Interest accrual (although accrual has stopped, it doesn't hurt to keep track of this)
            t.interestAccrualDelta += int256(redeemedTrove.newDebt * trove.annualInterestRate);
            t.interestAccrualDelta -= int256(trove.recordedDebt * trove.annualInterestRate);

            amount -= debtRedeemed;
        }
    }

    function _resetUrgentRedemption() internal {
        for (uint256 i = 0; i < _urgentRedemptionBatch.length; ++i) {
            delete _urgentRedemptionHasSeen[_troveIdOf(_urgentRedemptionBatch[i])];
        }

        delete _urgentRedemptionBatch;
        delete _urgentRedemptionPlan;
    }

    function _encodeTroveAdjustment(
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
}
