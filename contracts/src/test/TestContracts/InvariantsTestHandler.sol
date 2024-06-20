// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {LiquityContracts} from "../../deployment.sol";
import {IBorrowerOperations} from "../../Interfaces/IBorrowerOperations.sol";
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
    BOLD_GAS_COMPENSATION,
    CCR,
    COLL_GAS_COMPENSATION_DIVISOR,
    DECIMAL_PRECISION,
    MAX_ANNUAL_INTEREST_RATE,
    ONE_YEAR,
    SP_YIELD_SPLIT,
    UPFRONT_INTEREST_PERIOD
} from "../../Dependencies/Constants.sol";

uint256 constant WARP_SECONDS_MIN = 0;
uint256 constant WARP_SECONDS_MAX = 10 * ONE_YEAR;

uint256 constant BORROWED_MIN = 2_000 ether;
uint256 constant BORROWED_MAX = 100_000 ether;

uint256 constant INTEREST_RATE_MIN = 0; // TODO
uint256 constant INTEREST_RATE_MAX = MAX_ANNUAL_INTEREST_RATE;

uint256 constant ICR_MIN = 0.9 ether;
uint256 constant ICR_MAX = 2 * CCR;

uint256 constant TCR_MIN = 0.9 ether;
uint256 constant TCR_MAX = 2 * CCR;

struct LiquidationTotals {
    int256 activeCollDelta;
    int256 activeDebtDelta;
    int256 defaultCollDelta;
    int256 defaultDebtDelta;
    int256 interestAccrualDelta;
    uint256 spBoldDepositsDecrease;
    uint256 spETHIncrease;
    uint256 collSurplus;
    uint256 collGasComp;
    uint256 boldGasComp;
}

function equals(string memory a, string memory b) pure returns (bool) {
    return keccak256(bytes(a)) == keccak256(bytes(b));
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

contract InvariantsTestHandler is BaseHandler, BaseMultiCollateralTest {
    using Strings for uint256;
    using Strings for int256;
    using StringFormatting for bool;
    using StringFormatting for uint256;
    using StringFormatting for string[];
    using {equals} for string;
    using {update} for mapping(uint256 => uint256);
    using {isOpen} for TroveManagerTester;

    uint256 constant OWNER_INDEX = 0;

    uint256[] liqBatch;
    string[] liqBatchLabels;
    uint256[] liqBatchLiquidatable;
    string[] liqBatchLiquidatableLabels;
    mapping(uint256 => bool) liqBatchHasSeen;

    // All free-floating BOLD is kept in the handler, to be dealt out to actors as needed
    uint256 handlerBold;

    // Ghost variables
    mapping(uint256 => uint256) public numTroves;
    mapping(uint256 => uint256) public activeDebt;
    mapping(uint256 => uint256) public activeColl;
    mapping(uint256 => uint256) public defaultDebt;
    mapping(uint256 => uint256) public defaultColl;
    mapping(uint256 => uint256) public boldGasComp;
    mapping(uint256 => uint256) public collSurplus;
    mapping(uint256 => uint256) public spBoldDeposits;
    mapping(uint256 => uint256) public spBoldYield;
    mapping(uint256 => uint256) public spETH;

    // Used to keep track of interest accrual
    mapping(uint256 => uint256) interestAccrual;
    mapping(uint256 => uint256) pendingInterest;

    // Bold yield sent to the SP at a time when there are no deposits is lost forever
    // We keep track of the lost amount so we can use it in invariants
    mapping(uint256 => uint256) public spUnclaimableBoldYield;

    constructor(string memory handlerName, Contracts memory contracts) BaseHandler(handlerName) {
        setupContracts(contracts);
    }

    // We open at most one Trove per actor per branch, for reasons of simplicity,
    // as Troves aren't enumerable per user, only globally.
    function _troveIdOf(address owner) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(owner, OWNER_INDEX)));
    }

    function getPendingInterest(uint256 i) public view returns (uint256) {
        return pendingInterest[i] / ONE_YEAR / DECIMAL_PRECISION;
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

    function _dealCollAndApprove(uint256 i, address to, uint256 amount, address spender) internal {
        IERC20 collToken = branches[i].WETH;
        deal(address(collToken), to, amount);
        vm.prank(to);
        collToken.approve(spender, amount);
    }

    function _sweepColl(uint256 i, address from, uint256 amount) internal {
        vm.prank(from);
        branches[i].WETH.transfer(address(this), amount);
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
        liqBatch.push(_troveIdOf(owner));
        liqBatchLabels.push(vm.getLabel(owner));
    }

    function _aggregateLiquidationBatch(uint256 i, LiquidationTotals memory t) internal {
        LiquityContracts memory c = branches[i];
        uint256 MCR = c.troveManager.MCR();
        uint256 price = c.priceFeed.getPrice();

        for (uint256 j = 0; j < liqBatch.length; ++j) {
            uint256 troveId = liqBatch[j];

            if (liqBatchHasSeen[troveId]) continue;
            liqBatchHasSeen[troveId] = true;

            LatestTroveData memory trove = c.troveManager.getLatestTroveData(troveId);
            if (trove.entireDebt == 0 || trove.entireColl * price / trove.entireDebt >= MCR) continue;

            liqBatchLiquidatable.push(liqBatch[j]);
            liqBatchLiquidatableLabels.push(liqBatchLabels[j]);

            uint256 collRemaining = trove.entireColl;

            // Apply pending BOLD debt redist
            t.activeDebtDelta += int256(trove.redistBoldDebtGain);
            t.defaultDebtDelta -= int256(trove.redistBoldDebtGain);

            // Apply pending ETH redist
            t.activeCollDelta += int256(trove.redistETHGain);
            t.defaultCollDelta -= int256(trove.redistETHGain);

            // BOLD gas comp
            t.boldGasComp += BOLD_GAS_COMPENSATION;

            // Coll gas comp
            uint256 collGasComp = trove.entireColl / COLL_GAS_COMPENSATION_DIVISOR;
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
            t.spETHIncrease += collOffset;
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

    function openTrove(uint256 i, uint256 borrowed, uint256 icr, uint256 interestRate) external {
        i = _bound(i, 0, branches.length - 1);
        borrowed = _bound(borrowed, BORROWED_MIN, BORROWED_MAX);
        icr = _bound(icr, ICR_MIN, ICR_MAX);
        interestRate = _bound(interestRate, INTEREST_RATE_MIN, INTEREST_RATE_MAX);

        LiquityContracts memory c = branches[i];
        uint256 upfrontFee = hintHelpers.predictOpenTroveUpfrontFee(i, borrowed, interestRate);
        uint256 debt = borrowed + BOLD_GAS_COMPENSATION + upfrontFee;
        uint256 price = c.priceFeed.getPrice();
        uint256 coll = debt * icr / price;

        info("coll: ", coll.decimal());
        info("debt: ", debt.decimal());
        logCall("openTrove", i.toString(), borrowed.decimal(), icr.decimal(), interestRate.decimal());

        uint256 troveId = _troveIdOf(msg.sender);
        bool wasOpen = c.troveManager.isOpen(troveId);

        // TODO: randomly deal less than coll?
        _dealCollAndApprove(i, msg.sender, coll, address(c.borrowerOperations));

        vm.prank(msg.sender);
        try c.borrowerOperations.openTrove(msg.sender, OWNER_INDEX, coll, borrowed, 0, 0, interestRate, upfrontFee) {
            assertFalse(wasOpen, "Should have failed as Trove was open");
            assertGeDecimal(coll * price / debt, c.troveManager.MCR(), 18, "Should have failed as ICR < MCR");
            assertGeDecimal(c.troveManager.getTCR(price), CCR, 18, "Should have failed as TCR < CCR");

            assertEqDecimal(c.troveManager.getTroveEntireDebt(troveId), debt, 18, "Wrong debt");
            assertEqDecimal(c.troveManager.getTroveEntireColl(troveId), coll, 18, "Wrong coll");

            numTroves[i] += 1;
            activeColl[i] += coll;
            activeDebt[i] += debt - upfrontFee;
            boldGasComp[i] += BOLD_GAS_COMPENSATION;

            _mintYield(i, upfrontFee);
            interestAccrual[i] += debt * interestRate;

            _sweepColl(i, msg.sender, 0); // there should be no ETH left
            _sweepBold(msg.sender, borrowed);
        } catch Error(string memory reason) {
            if (reason.equals("BorrowerOps: Trove is open")) {
                assertTrue(wasOpen, "Should not have failed as Trove wasn't open");
            } else if (reason.equals("BorrowerOps: An operation that would result in ICR < MCR is not permitted")) {
                assertLtDecimal(coll * price / debt, c.troveManager.MCR(), 18, "Should not have failed as ICR >= MCR");
            } else if (reason.equals("BorrowerOps: An operation that would result in TCR < CCR is not permitted")) {
                uint256 totalColl = c.troveManager.getEntireSystemColl();
                uint256 totalDebt = c.troveManager.getEntireSystemDebt();
                uint256 newTCR = (totalColl + coll) * price / (totalDebt + debt);
                assertLtDecimal(newTCR, CCR, 18, "Should not have failed as new TCR >= CCR");
                info("New TCR would have been: ", newTCR.decimal());
            } else if (reason.equals("BorrowerOps: Operation not permitted below CT")) {
                uint256 tcr = c.troveManager.getTCR(price);
                assertLtDecimal(tcr, CCR, 18, "Should not have failed as TCR >= CCR");
                info("TCR: ", tcr.decimal());
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();

            _sweepColl(i, msg.sender, coll); // Take back the coll that was dealt
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

            assertGt(liqBatch.length, 0, "Should have failed as batch was empty");
            assertGt(liqBatchLiquidatable.length, 0, "Should have failed as there was nothing to liquidate");
            assertGt(numTroves[i], 1, "Should have failed as there was only one Trove in the system");

            _mintYield(i, 0);
            interestAccrual.update(i, t.interestAccrualDelta);

            info("Ghost deposits: ", spBoldDeposits[i].decimal());
            info("Decrease: ", t.spBoldDepositsDecrease.decimal());

            numTroves[i] -= liqBatchLiquidatable.length;
            activeColl.update(i, t.activeCollDelta);
            activeDebt.update(i, t.activeDebtDelta);
            defaultColl.update(i, t.defaultCollDelta);
            defaultDebt.update(i, t.defaultDebtDelta);
            spBoldDeposits[i] -= t.spBoldDepositsDecrease;
            spETH[i] += t.spETHIncrease;
            collSurplus[i] += t.collSurplus;
            boldGasComp[i] -= t.boldGasComp;

            for (uint256 j = 0; j < liqBatchLiquidatable.length; ++j) {
                uint256 troveId = liqBatchLiquidatable[j];
                assertEqDecimal(c.troveManager.getTroveEntireColl(troveId), 0, 18, "Coll should have been zeroed");
                assertEqDecimal(c.troveManager.getTroveEntireDebt(troveId), 0, 18, "Debt should have been zeroed");
                assertEq(
                    uint8(c.troveManager.getTroveStatus(troveId)),
                    uint8(ITroveManager.Status.closedByLiquidation),
                    "Status should have been set to closedByLiquidation"
                );
            }

            _sweepColl(i, msg.sender, t.collGasComp);
            _sweepBold(msg.sender, t.boldGasComp);
        } catch Error(string memory reason) {
            if (reason.equals("TroveManager: Calldata address array must not be empty")) {
                assertEq(liqBatch.length, 0, "Should not have failed as batch was not empty");
            } else if (reason.equals("TroveManager: nothing to liquidate")) {
                assertEq(liqBatchLiquidatable.length, 0, "Should not have failed as there were liquidatable Troves");
            } else if (reason.equals("TroveManager: Only one trove in the system")) {
                assertEq(
                    numTroves[i] - liqBatchLiquidatable.length,
                    0,
                    "Should not have failed as there was at least one Trove left in the system"
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
        uint256 ethGain = c.stabilityPool.getDepositorETHGain(msg.sender);
        uint256 ethStash = c.stabilityPool.stashedETH(msg.sender);

        info("initial deposit: ", initialBoldDeposit.decimal());
        info("compounded deposit: ", boldDeposit.decimal());
        info("yield gain: ", boldYield.decimal());
        info("ETH gain: ", ethGain.decimal());
        info("stashed ETH: ", ethStash.decimal());
        logCall("provideToSP", i.toString(), amount.decimal(), claim.toString());

        // TODO: randomly deal less than amount?
        _dealBold(msg.sender, amount);

        vm.prank(msg.sender);
        try c.stabilityPool.provideToSP(amount, claim) {
            assertGtDecimal(amount, 0, 18, "Should have failed as amount was zero");

            _mintYield(i, 0);
            boldDeposit += amount;
            spBoldDeposits[i] += amount;

            if (claim) {
                _sweepBold(msg.sender, boldYield);
                _sweepColl(i, msg.sender, ethGain + ethStash);
                spETH[i] -= ethGain + ethStash;
                ethStash = 0;
            } else {
                boldDeposit += boldYield;
                spBoldDeposits[i] += boldYield;
                ethStash += ethGain;
            }

            spBoldYield[i] -= boldYield;
            boldYield = 0;
            ethGain = 0;

            assertEqDecimal(c.stabilityPool.getCompoundedBoldDeposit(msg.sender), boldDeposit, 18, "Wrong deposit");
            assertEqDecimal(c.stabilityPool.getDepositorYieldGain(msg.sender), boldYield, 18, "Wrong yield gain");
            assertEqDecimal(c.stabilityPool.getDepositorETHGain(msg.sender), ethGain, 18, "Wrong ETH gain");
            assertEqDecimal(c.stabilityPool.stashedETH(msg.sender), ethStash, 18, "Wrong stashed ETH");
        } catch Error(string memory reason) {
            if (reason.equals("StabilityPool: Amount must be non-zero")) {
                assertEqDecimal(amount, 0, 18, "Should not have failed as amount was non-zero");
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();

            _sweepBold(msg.sender, amount); // Take back the BOLD that was dealt
        }
    }

    function withdrawFromSP(uint256 i, uint256 amount, bool claim) external {
        i = _bound(i, 0, branches.length - 1);

        LiquityContracts memory c = branches[i];
        uint256 initialBoldDeposit = c.stabilityPool.deposits(msg.sender);
        uint256 boldDeposit = c.stabilityPool.getCompoundedBoldDeposit(msg.sender);
        uint256 boldYield = c.stabilityPool.getDepositorYieldGainWithPending(msg.sender);
        uint256 ethGain = c.stabilityPool.getDepositorETHGain(msg.sender);
        uint256 ethStash = c.stabilityPool.stashedETH(msg.sender);

        amount = _bound(amount, 0, boldDeposit * 11 / 10); // sometimes try withdrawing too much
        uint256 withdrawn = Math.min(amount, boldDeposit);

        info("initial deposit: ", initialBoldDeposit.decimal());
        info("compounded deposit: ", boldDeposit.decimal());
        info("yield gain: ", boldYield.decimal());
        info("ETH gain: ", ethGain.decimal());
        info("stashed ETH: ", ethStash.decimal());
        logCall("withdrawFromSP", i.toString(), amount.decimal(), claim.toString());

        vm.prank(msg.sender);
        try c.stabilityPool.withdrawFromSP(amount, claim) {
            assertGtDecimal(initialBoldDeposit, 0, 18, "Should have failed as user had zero deposit");

            _mintYield(i, 0);
            boldDeposit -= withdrawn;
            spBoldDeposits[i] -= withdrawn;
            _sweepBold(msg.sender, withdrawn);

            if (claim) {
                _sweepBold(msg.sender, boldYield);
                _sweepColl(i, msg.sender, ethGain + ethStash);
                spETH[i] -= ethGain + ethStash;
                ethStash = 0;
            } else {
                boldDeposit += boldYield;
                spBoldDeposits[i] += boldYield;
                ethStash += ethGain;
            }

            spBoldYield[i] -= boldYield;
            boldYield = 0;
            ethGain = 0;

            assertEqDecimal(c.stabilityPool.getCompoundedBoldDeposit(msg.sender), boldDeposit, 18, "Wrong deposit");
            assertEqDecimal(c.stabilityPool.getDepositorYieldGain(msg.sender), boldYield, 18, "Wrong yield gain");
            assertEqDecimal(c.stabilityPool.getDepositorETHGain(msg.sender), ethGain, 18, "Wrong ETH gain");
            assertEqDecimal(c.stabilityPool.stashedETH(msg.sender), ethStash, 18, "Wrong stashed ETH");
        } catch Error(string memory reason) {
            if (reason.equals("StabilityPool: User must have a non-zero deposit")) {
                assertEqDecimal(
                    c.stabilityPool.deposits(msg.sender), 0, 18, "Should not have failed as user had a non-zero deposit"
                );
            } else {
                revert(reason);
            }

            info("Expected revert: ", reason);
            _log();
        }
    }
}
