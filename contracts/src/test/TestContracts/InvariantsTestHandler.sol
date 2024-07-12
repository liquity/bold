// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
import {Address} from "openzeppelin-contracts/contracts/utils/Address.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {REDEMPTION_FEE_FLOOR} from "../../Dependencies/Constants.sol";
import {LiquityContracts} from "../../deployment.sol";
import {IBorrowerOperations} from "../../Interfaces/IBorrowerOperations.sol";
import {ISortedTroves} from "../../Interfaces/ISortedTroves.sol";
import {ITroveManager} from "../../Interfaces/ITroveManager.sol";
import {LatestTroveData} from "../../Types/LatestTroveData.sol";
import {TroveChange} from "../../Types/TroveChange.sol";
import {StringFormatting} from "../Utils/StringFormatting.sol";
import {mulDivCeil} from "../Utils/Math.sol";
import {IPriceFeedTestnet} from "./Interfaces/IPriceFeedTestnet.sol";
import {BaseHandler} from "./BaseHandler.sol";
import {BaseMultiCollateralTest} from "./BaseMultiCollateralTest.sol";
import {TroveManagerTester} from "./TroveManagerTester.sol";

import {
    _100pct,
    _1pct,
    CCR,
    COLL_GAS_COMPENSATION_CAP,
    COLL_GAS_COMPENSATION_DIVISOR,
    DECIMAL_PRECISION,
    ETH_GAS_COMPENSATION,
    INTEREST_RATE_ADJ_COOLDOWN,
    MAX_ANNUAL_INTEREST_RATE,
    MIN_DEBT,
    ONE_YEAR,
    SP_YIELD_SPLIT,
    UPFRONT_INTEREST_PERIOD
} from "../../Dependencies/Constants.sol";

uint256 constant WARP_SECONDS_MIN = 0;
uint256 constant WARP_SECONDS_MAX = ONE_YEAR;

uint256 constant BORROWED_MIN = 0 ether; // Sometimes try borrowing too little
uint256 constant BORROWED_MAX = 100_000 ether;

uint256 constant INTEREST_RATE_MIN = 0; // TODO
uint256 constant INTEREST_RATE_MAX = MAX_ANNUAL_INTEREST_RATE * 11 / 10; // Sometimes try rates exceeding the max

uint256 constant ICR_MIN = 0.9 ether;
uint256 constant ICR_MAX = 2 * CCR;

uint256 constant TCR_MIN = 0.9 ether;
uint256 constant TCR_MAX = 2 * CCR;

uint256 constant OWNER_INDEX = 0;

enum AdjustedTroveProperties {
    onlyColl,
    onlyDebt,
    both,
    _COUNT
}

struct TroveIDAndData {
    uint256 id;
    LatestTroveData data;
}

function equals(string memory a, string memory b) pure returns (bool) {
    return keccak256(bytes(a)) == keccak256(bytes(b));
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

function isOpen(ITroveManager troveManager, uint256 troveId) view returns (bool) {
    ITroveManager.Status status = troveManager.getTroveStatus(troveId);
    return status == ITroveManager.Status.active || status == ITroveManager.Status.unredeemable;
}

// Convert a SortedTroves list to an array in redemption order, and include LatestTroveData for each Trove
function toArray(ISortedTroves sortedTroves) view returns (TroveIDAndData[] memory arr) {
    ITroveManager troveManager = sortedTroves.troveManager();
    arr = new TroveIDAndData[](sortedTroves.getSize());
    uint256 id = sortedTroves.getLast();

    for (uint256 i = 0; i < arr.length; ++i) {
        assert(id != 0);
        arr[i].id = id;
        arr[i].data = troveManager.getLatestTroveData(id);
        id = sortedTroves.getPrev(id);
    }

    assert(id == 0);
}

// We open at most one Trove per actor per branch, for reasons of simplicity,
// as Troves aren't enumerable per user, only globally.
function troveIdOf(address owner) pure returns (uint256) {
    return uint256(keccak256(abi.encode(owner, OWNER_INDEX)));
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
    using {equals} for string;
    using {add} for uint256;
    using {update} for mapping(uint256 => uint256);
    using {isOpen} for TroveManagerTester;
    using {toArray} for ISortedTroves;

    struct LiquidationTotals {
        int256 activeCollDelta;
        int256 activeDebtDelta;
        int256 defaultCollDelta;
        int256 defaultDebtDelta;
        int256 interestAccrualDelta;
        uint256 spBoldDepositsDecrease;
        uint256 spCollIncrease;
        uint256 collSurplus;
        uint256 collGasComp;
    }

    struct OpenTroveContext {
        uint256 upperHint;
        uint256 lowerHint;
        LiquityContracts c;
        uint256 upfrontFee;
        uint256 debt;
        uint256 price;
        uint256 coll;
        uint256 troveId;
        bool wasOpen;
    }

    struct AdjustTroveContext {
        AdjustedTroveProperties prop;
        LiquityContracts c;
        uint256 troveId;
        LatestTroveData t;
        ITroveManager.Status status;
        uint256 oldTCR;
        int256 collDelta;
        int256 debtDelta;
        int256 $collDelta;
        uint256 upfrontFee;
    }

    struct AdjustTroveInterestRateContext {
        uint256 upperHint;
        uint256 lowerHint;
        LiquityContracts c;
        uint256 troveId;
        LatestTroveData t;
        ITroveManager.Status status;
        bool premature;
        uint256 upfrontFee;
    }

    FunctionCaller immutable functionCaller;

    uint256[] liqBatch;
    string[] liqBatchLabels;
    uint256[] liqBatchLiquidatable;
    string[] liqBatchLiquidatableLabels;
    mapping(uint256 => bool) liqBatchHasSeen;

    // All free-floating BOLD is kept in the handler, to be dealt out to actors as needed
    uint256 handlerBold;

    // Ghost variables
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

    // Used to keep track of interest accrual
    mapping(uint256 => uint256) interestAccrual;
    mapping(uint256 => uint256) pendingInterest;

    // Bold yield sent to the SP at a time when there are no deposits is lost forever
    // We keep track of the lost amount so we can use it in invariants
    mapping(uint256 => uint256) public spUnclaimableBoldYield;

    constructor(Contracts memory contracts) {
        functionCaller = new FunctionCaller();
        setupContracts(contracts);
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
        TroveManagerTester troveManager = branches[i].troveManager;

        if (troveManager.isOpen(troveId)) {
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

    function _MCR(uint256 i) internal view returns (uint256) {
        return branches[i].troveManager.MCR();
    }

    function _ICR(uint256 i, uint256 troveId) internal view returns (uint256) {
        return _ICR(i, troveId, 0, 0, 0);
    }

    function _ICR(uint256 i, uint256 troveId, int256 collDelta, int256 debtDelta, uint256 upfrontFee)
        internal
        view
        returns (uint256)
    {
        LiquityContracts memory c = branches[i];
        uint256 coll = c.troveManager.getTroveEntireColl(troveId).add(collDelta);
        uint256 debt = (c.troveManager.getTroveEntireDebt(troveId) + upfrontFee).add(debtDelta);
        uint256 price = c.priceFeed.getPrice();

        return debt > 0 ? coll * price / debt : type(uint256).max;
    }

    function _TCR(uint256 i) internal view returns (uint256) {
        return _TCR(i, 0, 0, 0);
    }

    function _TCR(uint256 i, int256 collDelta, int256 debtDelta, uint256 upfrontFee) internal view returns (uint256) {
        LiquityContracts memory c = branches[i];
        uint256 totalColl = c.troveManager.getEntireSystemColl().add(collDelta);
        uint256 totalDebt = (c.troveManager.getEntireSystemDebt() + upfrontFee).add(debtDelta);
        uint256 price = c.priceFeed.getPrice();

        return totalDebt > 0 ? totalColl * price / totalDebt : type(uint256).max;
    }

    function getGasPool(uint256 i) external view returns (uint256) {
        return numTroves[i] * ETH_GAS_COMPENSATION;
    }

    function getPendingInterest(uint256 i) public view returns (uint256) {
        return pendingInterest[i] / ONE_YEAR / DECIMAL_PRECISION;
    }

    function _getRedemptionFeePct(uint256 amount) internal view returns (uint256) {
        return boldToken.totalSupply() > 0
            ? collateralRegistry.getRedemptionRateForRedeemedAmount(amount)
            : DECIMAL_PRECISION;
    }

    function _mintYield(uint256 i, uint256 upfrontFee) internal {
        uint256 mintedInterest = getPendingInterest(i);
        pendingInterest[i] = 0;

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
        handlerBold -= amount;
    }

    function _sweepBold(address from, uint256 amount) internal {
        vm.prank(from);
        boldToken.transfer(address(this), amount);
        handlerBold += amount;
    }

    function _addToLiquidationBatch(address owner) internal {
        liqBatch.push(troveIdOf(owner));
        liqBatchLabels.push(vm.getLabel(owner));
    }

    function _aggregateLiquidationBatch(uint256 i, LiquidationTotals memory t) internal {
        LiquityContracts memory c = branches[i];
        uint256 price = c.priceFeed.getPrice();

        for (uint256 j = 0; j < liqBatch.length; ++j) {
            uint256 troveId = liqBatch[j];

            if (liqBatchHasSeen[troveId]) continue;
            liqBatchHasSeen[troveId] = true;

            LatestTroveData memory trove = c.troveManager.getLatestTroveData(troveId);
            if (trove.entireDebt == 0 || trove.entireColl * price / trove.entireDebt >= _MCR(i)) continue;

            liqBatchLiquidatable.push(liqBatch[j]);
            liqBatchLiquidatableLabels.push(liqBatchLabels[j]);

            uint256 collRemaining = trove.entireColl;

            // Apply pending BOLD debt redist
            t.activeDebtDelta += int256(trove.redistBoldDebtGain);
            t.defaultDebtDelta -= int256(trove.redistBoldDebtGain);

            // Apply pending coll redist
            t.activeCollDelta += int256(trove.redistCollGain);
            t.defaultCollDelta -= int256(trove.redistCollGain);

            // Coll gas comp
            uint256 collGasComp = Math.min(trove.entireColl / COLL_GAS_COMPENSATION_DIVISOR, COLL_GAS_COMPENSATION_CAP);
            t.activeCollDelta -= int256(collGasComp);
            t.collGasComp += collGasComp;
            collRemaining -= collGasComp;

            // Offset debt by SP
            uint256 debtOffset = Math.min(trove.entireDebt, spBoldDeposits[i] - t.spBoldDepositsDecrease);
            t.activeDebtDelta -= int256(debtOffset);
            t.spBoldDepositsDecrease += debtOffset;

            // Send coll to SP
            uint256 collOffset = Math.min(
                collRemaining * debtOffset / trove.entireDebt,
                debtOffset * (_100pct + c.troveManager.LIQUIDATION_PENALTY_SP()) / price
            );
            t.activeCollDelta -= int256(collOffset);
            t.spCollIncrease += collOffset;
            collRemaining -= collOffset;

            // Redistribute debt
            uint256 debtRedist = trove.entireDebt - debtOffset;
            t.activeDebtDelta -= int256(debtRedist);
            t.defaultDebtDelta += int256(debtRedist);

            // Redistribute coll
            uint256 collRedist = Math.min(
                collRemaining, debtRedist * (_100pct + c.troveManager.LIQUIDATION_PENALTY_REDISTRIBUTION()) / price
            );
            t.activeCollDelta -= int256(collRedist);
            t.defaultCollDelta += int256(collRedist);
            collRemaining -= collRedist;

            // Surplus
            t.activeCollDelta -= int256(collRemaining);
            t.collSurplus += collRemaining;

            t.interestAccrualDelta -= int256(trove.weightedRecordedDebt);
        }
    }

    function _resetLiquidationBatch() internal {
        for (uint256 i = 0; i < liqBatch.length; ++i) {
            delete liqBatchHasSeen[liqBatch[i]];
        }

        delete liqBatch;
        delete liqBatchLabels;
        delete liqBatchLiquidatable;
        delete liqBatchLiquidatableLabels;
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

    /////////////////////////////////////////
    // External functions called by fuzzer //
    /////////////////////////////////////////

    function warp(uint256 secs) external {
        secs = _bound(secs, WARP_SECONDS_MIN, WARP_SECONDS_MAX);

        logCall("warp", secs.groupRight());
        vm.warp(block.timestamp + secs);

        for (uint256 i = 0; i < branches.length; ++i) {
            pendingInterest[i] += interestAccrual[i] * secs;
        }
    }

    function setPrice(uint256 i, uint256 tcr) external {
        i = _bound(i, 0, branches.length - 1);
        tcr = _bound(tcr, TCR_MIN, TCR_MAX);

        LiquityContracts memory c = branches[i];
        uint256 totalColl = c.troveManager.getEntireSystemColl();
        uint256 totalDebt = c.troveManager.getEntireSystemDebt();

        vm.assume(totalColl > 0);
        uint256 price = totalDebt * tcr / totalColl;

        info("price: ", price.decimal());
        logCall("setPrice", i.toString(), tcr.decimal());

        c.priceFeed.setPrice(price);
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
        v.price = v.c.priceFeed.getPrice();
        v.coll = v.debt * icr / v.price;

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

        v.troveId = troveIdOf(msg.sender);
        v.wasOpen = v.c.troveManager.isOpen(v.troveId);

        // TODO: randomly deal less than coll?
        _dealCollAndApprove(i, msg.sender, v.coll, address(v.c.borrowerOperations));
        _dealWETHAndApprove(msg.sender, ETH_GAS_COMPENSATION, address(v.c.borrowerOperations));

        vm.prank(msg.sender);
        try v.c.borrowerOperations.openTrove(
            msg.sender, OWNER_INDEX, v.coll, borrowed, v.upperHint, v.lowerHint, interestRate, v.upfrontFee
        ) {
            // Preconditions
            assertFalse(v.wasOpen, "Should have failed as Trove was open");
            assertLeDecimal(interestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Should have failed as interest rate > max");
            assertGeDecimal(v.debt, MIN_DEBT, 18, "Should have failed as debt < min");
            assertGeDecimal(_ICR(i, v.troveId), _MCR(i), 18, "Should have failed as ICR < MCR");
            assertGeDecimal(_TCR(i), CCR, 18, "Should have failed as new TCR < CCR");

            // Effects (Trove)
            assertEqDecimal(v.c.troveManager.getTroveEntireColl(v.troveId), v.coll, 18, "Wrong coll");
            assertEqDecimal(v.c.troveManager.getTroveEntireDebt(v.troveId), v.debt, 18, "Wrong debt");
            assertEqDecimal(
                v.c.troveManager.getTroveAnnualInterestRate(v.troveId), interestRate, 18, "Wrong interest rate"
            );
            assertEq(
                v.c.troveManager.getTroveStatus(v.troveId).toString(),
                ITroveManager.Status.active.toString(),
                "Status should have been set to active"
            );
            assertTrue(v.c.sortedTroves.contains(v.troveId), "Trove should have been inserted into SortedTroves");

            // Effects (system)
            numTroves[i] += 1;

            _mintYield(i, v.upfrontFee);
            activeColl[i] += v.coll;
            activeDebt[i] += borrowed;

            interestAccrual[i] += v.debt * interestRate;

            // Cleanup
            _sweepBold(msg.sender, borrowed);
        } catch Error(string memory reason) {
            // Justify failures
            if (reason.equals("BorrowerOps: Trove is open")) {
                assertTrue(v.wasOpen, "Shouldn't have failed as Trove wasn't open");
            } else if (reason.equals("Interest rate must not be greater than max")) {
                assertGtDecimal(
                    interestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Shouldn't have failed as interest rate <= max"
                );
            } else if (reason.equals("BorrowerOps: Trove's debt must be greater than minimum")) {
                assertLtDecimal(v.debt, MIN_DEBT, 18, "Shouldn't have failed as debt >= min");
            } else if (reason.equals("BorrowerOps: An operation that would result in ICR < MCR is not permitted")) {
                assertLtDecimal(v.coll * v.price / v.debt, _MCR(i), 18, "Shouldn't have failed as ICR >= MCR");
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
        v.troveId = troveIdOf(msg.sender);
        v.t = v.c.troveManager.getLatestTroveData(v.troveId);
        v.status = v.c.troveManager.getTroveStatus(v.troveId);
        v.oldTCR = _TCR(i);

        collChange = v.prop != AdjustedTroveProperties.onlyDebt ? _bound(collChange, 0, v.t.entireColl * 11 / 10) : 0;
        debtChange = v.prop != AdjustedTroveProperties.onlyColl ? _bound(debtChange, 0, v.t.entireDebt * 11 / 10) : 0;
        if (!isDebtIncrease) debtChange = Math.min(debtChange, handlerBold);

        v.collDelta = isCollIncrease ? int256(collChange) : -int256(collChange);
        v.debtDelta = isDebtIncrease ? int256(debtChange) : -int256(debtChange);
        v.$collDelta = v.collDelta * int256(v.c.priceFeed.getPrice()) / int256(DECIMAL_PRECISION);
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
        try functionCaller.call(
            address(v.c.borrowerOperations),
            _encodeTroveAdjustment(
                v.prop, v.troveId, collChange, isCollIncrease, debtChange, isDebtIncrease, v.upfrontFee
            )
        ) {
            // Preconditions
            assertTrue(collChange > 0 || debtChange > 0, "Should have failed as there was no change");

            assertEq(
                v.status.toString(),
                ITroveManager.Status.active.toString(),
                "Should have failed as Trove was not active"
            );

            if (v.upfrontFee > 0) assertGtDecimal(v.debtDelta, 0, 18, "Only debt increase should incur upfront fee");

            assertLeDecimal(-v.collDelta, int256(v.t.entireColl), 18, "Should have failed as coll decrease > coll");
            uint256 newColl = v.t.entireColl.add(v.collDelta);

            assertLeDecimal(-v.debtDelta, int256(v.t.entireDebt), 18, "Should have failed as debt decrease > debt");
            uint256 newDebt = (v.t.entireDebt + v.upfrontFee).add(v.debtDelta);

            assertGeDecimal(newDebt, MIN_DEBT, 28, "Should have failed as new debt < MIN_DEBT");
            assertGeDecimal(_ICR(i, v.troveId), _MCR(i), 18, "Should have failed as new ICR < MCR");

            if (v.oldTCR >= CCR) {
                assertGeDecimal(_TCR(i), CCR, 18, "Should have failed as new TCR < CCR");
            } else {
                assertLeDecimal(v.debtDelta, 0, 18, "Borrowing should have failed as TCR < CCR");
                assertGeDecimal(-v.debtDelta, -v.$collDelta, 18, "Repayment < withdrawal when TCR < CCR");
            }

            // Effects (Trove)
            assertEqDecimal(v.c.troveManager.getTroveEntireColl(v.troveId), newColl, 18, "Wrong coll");
            assertEqDecimal(v.c.troveManager.getTroveEntireDebt(v.troveId), newDebt, 18, "Wrong debt");

            // Effects (system)
            activeColl[i] += v.t.redistCollGain;
            defaultColl[i] -= v.t.redistCollGain;

            activeDebt[i] += v.t.redistBoldDebtGain;
            defaultDebt[i] -= v.t.redistBoldDebtGain;

            _mintYield(i, v.upfrontFee);
            activeColl.update(i, v.collDelta);
            activeDebt.update(i, v.debtDelta);

            interestAccrual[i] += newDebt * v.t.annualInterestRate;
            interestAccrual[i] -= v.t.recordedDebt * v.t.annualInterestRate;

            // Cleanup
            if (!isCollIncrease) _sweepColl(i, msg.sender, collChange);
            if (isDebtIncrease) _sweepBold(msg.sender, debtChange);
        } catch Error(string memory reason) {
            // Justify errors
            if (reason.equals("BorrowerOps: There must be either a collateral change or a debt change")) {
                assertEqDecimal(collChange, 0, 18, "Shouldn't have failed as there was a coll change");
                assertEqDecimal(debtChange, 0, 18, "Shouldn't have failed as there was a debt change");
            } else if (reason.equals("BorrowerOps: Trove does not have active status")) {
                assertNotEq(
                    v.status.toString(),
                    ITroveManager.Status.active.toString(),
                    "Shouldn't have failed as Trove was active"
                );
            } else if (reason.equals("BorrowerOps: Can't withdraw more than the Trove's entire collateral")) {
                assertGtDecimal(-v.collDelta, int256(v.t.entireColl), 18, "Shouldn't have failed as withdrawal <= coll");
            } else if (reason.equals("BorrowerOps: Amount repaid must not be larger than the Trove's debt")) {
                assertGtDecimal(-v.debtDelta, int256(v.t.entireDebt), 18, "Shouldn't have failed as repayment <= debt");
            } else if (reason.equals("BorrowerOps: Trove's debt must be greater than minimum")) {
                uint256 newDebt = (v.t.entireDebt + v.upfrontFee).add(v.debtDelta);
                assertLtDecimal(newDebt, MIN_DEBT, 18, "Shouldn't have failed as new debt >= MIN_DEBT");
                info("New debt would have been: ", newDebt.decimal());
            } else if (reason.equals("BorrowerOps: An operation that would result in ICR < MCR is not permitted")) {
                uint256 newICR = _ICR(i, v.troveId, v.collDelta, v.debtDelta, v.upfrontFee);
                assertLtDecimal(newICR, _MCR(i), 18, "Shouldn't have failed as new ICR >= MCR");
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
        } catch Panic(uint256 code) {
            // TODO: instead of checking for debtDecrease <= entireDebt in adjustTrove,
            // check debtDecrease <= entireDebt - MIN_DEBT to avoid underflow
            assertEq(code, 0x11, "Unexpected panic code");

            int256 newActiveDebt = int256(activeDebt[i]);
            newActiveDebt += int256(getPendingInterest(i));
            newActiveDebt += int256(v.t.redistBoldDebtGain);
            newActiveDebt -= int256(v.t.entireDebt);

            assertLtDecimal(newActiveDebt, 0, 18, "Unexpected underflow or overflow");
            assertLtDecimal(-newActiveDebt, 100, 18, "Unexpectedly large underflow");

            info("Expected arithmetic underflow when trying to adjust debt of last Trove to 0");
            info("New active debt would have been: ", newActiveDebt.decimal());
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
        v.troveId = troveIdOf(msg.sender);
        v.t = v.c.troveManager.getLatestTroveData(v.troveId);
        ITroveManager.Status status = v.c.troveManager.getTroveStatus(v.troveId);
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
            // Preconditions
            assertEq(
                status.toString(), ITroveManager.Status.active.toString(), "Should have failed as Trove was not active"
            );
            assertLeDecimal(newInterestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Should have failed as interest rate > max");

            if (v.premature) {
                assertGeDecimal(_ICR(i, v.troveId), _MCR(i), 18, "Should have failed as new ICR < MCR");
                assertGeDecimal(_TCR(i), CCR, 18, "Should have failed as new TCR < CCR");
            }

            // Effects (Trove)
            assertEqDecimal(v.c.troveManager.getTroveEntireColl(v.troveId), v.t.entireColl, 18, "Wrong coll");
            assertEqDecimal(
                v.c.troveManager.getTroveEntireDebt(v.troveId), v.t.entireDebt + v.upfrontFee, 18, "Wrong debt"
            );
            assertEqDecimal(
                v.c.troveManager.getTroveAnnualInterestRate(v.troveId), newInterestRate, 18, "Wrong interest rate"
            );

            // Effects (system)
            activeColl[i] += v.t.redistCollGain;
            defaultColl[i] -= v.t.redistCollGain;

            activeDebt[i] += v.t.redistBoldDebtGain;
            defaultDebt[i] -= v.t.redistBoldDebtGain;

            _mintYield(i, v.upfrontFee);

            interestAccrual[i] += (v.t.entireDebt + v.upfrontFee) * newInterestRate;
            interestAccrual[i] -= v.t.recordedDebt * v.t.annualInterestRate;
        } catch Error(string memory reason) {
            // Justify failures
            if (reason.equals("ERC721: invalid token ID")) {
                assertTrue(
                    status != ITroveManager.Status.active && status != ITroveManager.Status.unredeemable,
                    string.concat("Trove with ", status.toString(), " status should have an NFT")
                );
            } else if (reason.equals("Interest rate must not be greater than max")) {
                assertGtDecimal(
                    newInterestRate, MAX_ANNUAL_INTEREST_RATE, 18, "Shouldn't have failed as interest rate <= max"
                );
            } else if (reason.equals("BorrowerOps: An operation that would result in ICR < MCR is not permitted")) {
                uint256 newICR = _ICR(i, v.troveId, 0, 0, v.upfrontFee);
                assertTrue(v.premature, "Shouldn't have failed as adjustment was not premature");
                assertLtDecimal(newICR, _MCR(i), 18, "Shouldn't have failed as new ICR >= MCR");
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

        LiquityContracts memory c = branches[i];
        uint256 troveId = troveIdOf(msg.sender);
        LatestTroveData memory t = c.troveManager.getLatestTroveData(troveId);
        ITroveManager.Status status = c.troveManager.getTroveStatus(troveId);

        logCall("closeTrove", i.toString());

        uint256 dealt = Math.min(t.entireDebt, handlerBold);
        _dealBold(msg.sender, dealt);

        vm.prank(msg.sender);
        try c.borrowerOperations.closeTrove(troveId) {
            // Preconditions
            assertTrue(
                status == ITroveManager.Status.active || status == ITroveManager.Status.unredeemable,
                "Should have failed as Trove wasn't open"
            );
            assertGt(numTroves[i], 1, "Should have failed to close last Trove in the system");
            assertGeDecimal(_TCR(i), CCR, 18, "Should have failed as new TCR < CCR");

            // Effects (Trove)
            assertEqDecimal(c.troveManager.getTroveEntireColl(troveId), 0, 18, "Coll should have been zeroed");
            assertEqDecimal(c.troveManager.getTroveEntireDebt(troveId), 0, 18, "Debt should have been zeroed");
            assertEq(
                c.troveManager.getTroveStatus(troveId).toString(),
                ITroveManager.Status.closedByOwner.toString(),
                "Status should have been set to closedByOwner"
            );
            assertFalse(c.sortedTroves.contains(troveId), "Trove should have been removed from SortedTroves");

            // Effects (system)
            numTroves[i] -= 1;

            activeColl[i] += t.redistCollGain;
            defaultColl[i] -= t.redistCollGain;

            activeDebt[i] += t.redistBoldDebtGain;
            defaultDebt[i] -= t.redistBoldDebtGain;

            _mintYield(i, 0);
            activeColl[i] -= t.entireColl;
            activeDebt[i] -= t.entireDebt;

            interestAccrual[i] -= t.recordedDebt * t.annualInterestRate;

            // Cleanup
            _sweepColl(i, msg.sender, t.entireColl);
            _sweepWETH(msg.sender, ETH_GAS_COMPENSATION);
        } catch Error(string memory reason) {
            // Justify failures
            if (reason.equals("ERC721: invalid token ID")) {
                assertTrue(
                    status != ITroveManager.Status.active && status != ITroveManager.Status.unredeemable,
                    string.concat("Trove with ", status.toString(), " status should have an NFT")
                );
            } else if (reason.equals("BorrowerOps: Caller doesnt have enough Bold to make repayment")) {
                assertLtDecimal(dealt, t.entireDebt, 18, "Shouldn't have failed as caller had enough Bold");
            } else if (reason.equals("TroveManager: Only one trove in the system")) {
                assertEq(numTroves[i], 1, "Shouldn't have failed as there was at least one Trove left in the system");
            } else if (reason.equals("BorrowerOps: An operation that would result in TCR < CCR is not permitted")) {
                uint256 newTCR = _TCR(i, -int256(t.entireColl), -int256(t.entireDebt), 0);
                assertLtDecimal(newTCR, CCR, 18, "Shouldn't have failed as new TCR >= CCR");
                info("New TCR would have been: ", newTCR.decimal());
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();

            // Cleanup
            _sweepBold(msg.sender, dealt);
        } catch Panic(uint256 code) {
            // TODO: check for this being the last Trove earlier in closeTrove, so we don't run into underflow
            assertEq(code, 0x11, "Unexpected panic code");

            int256 newActiveDebt = int256(activeDebt[i]);
            newActiveDebt += int256(getPendingInterest(i));
            newActiveDebt += int256(t.redistBoldDebtGain);
            newActiveDebt -= int256(t.entireDebt);

            assertLtDecimal(newActiveDebt, 0, 18, "Unexpected underflow or overflow");
            assertLtDecimal(-newActiveDebt, 100, 18, "Unexpectedly large underflow");

            info("Expected arithmetic underflow when trying to close last Trove");
            info("New active debt would have been: ", newActiveDebt.decimal());
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

        LiquityContracts memory c = branches[i];
        LiquidationTotals memory t;
        _aggregateLiquidationBatch(i, t);

        info("batch: [", liqBatchLabels.join(", "), "]");
        info("liquidatable: [", liqBatchLiquidatableLabels.join(", "), "]");
        logCall("batchLiquidateTroves", i.toString());

        vm.prank(msg.sender);
        try c.troveManager.batchLiquidateTroves(liqBatch) {
            info("SP BOLD: ", c.stabilityPool.getTotalBoldDeposits().decimal());
            info("P: ", c.stabilityPool.P().decimal());
            _log();

            // Preconditions
            assertGt(liqBatch.length, 0, "Should have failed as batch was empty");
            assertGt(liqBatchLiquidatable.length, 0, "Should have failed as there was nothing to liquidate");
            assertGt(
                numTroves[i] - liqBatchLiquidatable.length,
                0,
                "Should have failed to liquidate last Trove in the system"
            );

            // Effects (Troves)
            for (uint256 j = 0; j < liqBatchLiquidatable.length; ++j) {
                uint256 troveId = liqBatchLiquidatable[j];
                assertEqDecimal(c.troveManager.getTroveEntireColl(troveId), 0, 18, "Coll should have been zeroed");
                assertEqDecimal(c.troveManager.getTroveEntireDebt(troveId), 0, 18, "Debt should have been zeroed");
                assertEq(
                    c.troveManager.getTroveStatus(troveId).toString(),
                    ITroveManager.Status.closedByLiquidation.toString(),
                    "Status should have been set to closedByLiquidation"
                );
                assertFalse(c.sortedTroves.contains(troveId), "Trove should have been removed from SortedTroves");
            }

            // Effects (system)
            numTroves[i] -= liqBatchLiquidatable.length;

            defaultColl.update(i, t.defaultCollDelta);
            defaultDebt.update(i, t.defaultDebtDelta);

            _mintYield(i, 0);
            activeColl.update(i, t.activeCollDelta);
            activeDebt.update(i, t.activeDebtDelta);

            interestAccrual.update(i, t.interestAccrualDelta);
            spBoldDeposits[i] -= t.spBoldDepositsDecrease;
            spColl[i] += t.spCollIncrease;
            collSurplus[i] += t.collSurplus;

            // Cleanup
            _sweepColl(i, msg.sender, t.collGasComp);
            _sweepWETH(msg.sender, liqBatchLiquidatable.length * ETH_GAS_COMPENSATION);
        } catch Error(string memory reason) {
            // Justify failures
            if (reason.equals("TroveManager: Calldata address array must not be empty")) {
                assertEq(liqBatch.length, 0, "Shouldn't have failed as batch was not empty");
            } else if (reason.equals("TroveManager: nothing to liquidate")) {
                assertEq(liqBatchLiquidatable.length, 0, "Shouldn't have failed as there were liquidatable Troves");
            } else if (reason.equals("TroveManager: Only one trove in the system")) {
                assertEq(
                    numTroves[i] - liqBatchLiquidatable.length,
                    0,
                    "Shouldn't have failed as there was at least one Trove left in the system"
                );
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();
        }

        _resetLiquidationBatch();
    }

    function provideToSP(uint256 i, uint256 amount, bool claim) external {
        i = _bound(i, 0, branches.length - 1);
        amount = _bound(amount, 0, handlerBold);

        LiquityContracts memory c = branches[i];
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

        LiquityContracts memory c = branches[i];
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

    //     LiquityContracts memory c = branches[i];
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

    // XXX unfinished
    // function redeemCollateral(uint256 amount, uint256 maxIterationsPerCollateral) external {
    //     uint256 maxNumTroves;
    //     TroveIDAndData[][] memory troves = new TroveIDAndData[][](branches.length);

    //     for (uint256 i = 0; i < branches.length; ++i) {
    //         maxNumTroves = Math.max(numTroves[i], maxNumTroves);
    //         troves[i] = branches[i].sortedTroves.toArray();
    //     }

    //     amount = _bound(amount, 0, handlerBold);
    //     maxIterationsPerCollateral = _bound(maxIterationsPerCollateral, 0, maxNumTroves);

    //     uint256 feePct = _getRedemptionFeePct(amount);
    //     info("fee %: ", feePct.decimal());
    //     logCall("redeemCollateral", amount.decimal(), maxIterationsPerCollateral.toString());

    //     // TODO: randomly deal less than amount?
    //     _dealBold(msg.sender, amount);

    //     vm.prank(msg.sender);
    //     try collateralRegistry.redeemCollateral(amount, maxIterationsPerCollateral, feePct) {
    //         assertGtDecimal(amount, 0, 18, "Should have failed as amount was zero");
    //     } catch Error(string memory reason) {
    //         if (reason.equals("TroveManager: Amount must be greater than zero")) {
    //             assertEqDecimal(amount, 0, 18, "Shouldn't have failed as amount was greater than zero");
    //         } else {
    //             revert(reason);
    //         }

    //         info("Expected revert: ", reason);
    //         _log();
    //     } catch Panic(uint256 code) {
    //         assertEq(code, 1, "Unexpected panic code");
    //         if (feePct == REDEMPTION_FEE_FLOOR) {
    //             info("Expected assertion failure due to newBaseRate == 0");
    //         } else {
    //             revert("Unexpected assertion failure");
    //         }
    //         _log();
    //     }
    // }
}
