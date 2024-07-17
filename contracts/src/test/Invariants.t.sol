// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {console2 as console} from "forge-std/console2.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {IActivePool} from "../Interfaces/IActivePool.sol";
import {ISortedTroves} from "../Interfaces/ISortedTroves.sol";
import {IStabilityPool} from "../Interfaces/IStabilityPool.sol";
import {ITroveManager} from "../Interfaces/ITroveManager.sol";
import {BatchId} from "../Types/BatchId.sol";
import {_deployAndConnectContracts, LiquityContracts, TroveManagerParams} from "../deployment.sol";
import {StringFormatting} from "./Utils/StringFormatting.sol";
import {BaseInvariantTest} from "./TestContracts/BaseInvariantTest.sol";
import {BaseMultiCollateralTest} from "./TestContracts/BaseMultiCollateralTest.sol";
import {AdjustedTroveProperties, InvariantsTestHandler} from "./TestContracts/InvariantsTestHandler.sol";

struct BatchIdSet {
    mapping(BatchId => bool) _has;
    BatchId[] _batchIds;
}

library BatchIdSetMethods {
    function add(BatchIdSet storage set, BatchId batchId) internal {
        if (!set._has[batchId]) {
            set._has[batchId] = true;
            set._batchIds.push(batchId);
        }
    }

    function clear(BatchIdSet storage set) internal {
        for (uint256 i = 0; i < set._batchIds.length; ++i) {
            delete set._has[set._batchIds[i]];
        }
        delete set._batchIds;
    }

    function has(BatchIdSet storage set, BatchId batchId) internal view returns (bool) {
        return set._has[batchId];
    }
}

library SortedTrovesHelpers {
    function getBatchOf(ISortedTroves sortedTroves, uint256 troveId) internal view returns (BatchId batchId) {
        (,, batchId,) = sortedTroves.nodes(troveId);
    }

    function getBatchHead(ISortedTroves sortedTroves, BatchId batchId) internal view returns (uint256 batchHead) {
        (batchHead,) = sortedTroves.batches(batchId);
    }

    function getBatchTail(ISortedTroves sortedTroves, BatchId batchId) internal view returns (uint256 batchTail) {
        (, batchTail) = sortedTroves.batches(batchId);
    }
}

contract InvariantsTest is BaseInvariantTest, BaseMultiCollateralTest {
    using Strings for uint256;
    using StringFormatting for uint256;
    using BatchIdSetMethods for BatchIdSet;
    using SortedTrovesHelpers for ISortedTroves;

    InvariantsTestHandler handler;
    BatchIdSet seenBatches;

    function setUp() public override {
        super.setUp();

        // TODO: randomize params? How to do it with Foundry invariant testing?
        TroveManagerParams[] memory params = new TroveManagerParams[](4);
        params[0] = TroveManagerParams(1.1 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        params[1] = TroveManagerParams(1.2 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        params[2] = TroveManagerParams(1.2 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        params[3] = TroveManagerParams(1.2 ether, 1.01 ether, 0.05 ether, 0.1 ether);

        Contracts memory contracts;
        (contracts.branches, contracts.collateralRegistry, contracts.boldToken, contracts.hintHelpers,, contracts.weth)
        = _deployAndConnectContracts(params);
        setupContracts(contracts);

        handler = new InvariantsTestHandler(contracts);
        vm.label(address(handler), "handler");
        targetContract(address(handler));
    }

    // Not a real invariant, but we want to make sure our actors always have empty wallets before a handler call
    function invariant_FundsAreSwept() external view {
        for (uint256 i = 0; i < actors.length; ++i) {
            address actor = actors[i].account;

            assertEqDecimal(boldToken.balanceOf(actor), 0, 18, "Incomplete BOLD sweep");
            assertEqDecimal(weth.balanceOf(actor), 0, 18, "Incomplete WETH sweep");

            for (uint256 j = 0; j < branches.length; ++j) {
                IERC20 collToken = branches[j].collToken;
                address borrowerOperations = address(branches[j].borrowerOperations);

                assertEqDecimal(weth.allowance(actor, borrowerOperations), 0, 18, "WETH allowance != 0");
                assertEqDecimal(collToken.balanceOf(actor), 0, 18, "Incomplete coll sweep");
                assertEqDecimal(collToken.allowance(actor, borrowerOperations), 0, 18, "Coll allowance != 0");
            }
        }
    }

    function invariant_SystemVariablesMatchGhostVariables() external view {
        for (uint256 i = 0; i < branches.length; ++i) {
            LiquityContracts memory c = branches[i];

            assertEq(c.troveManager.getTroveIdsCount(), handler.numTroves(i), "Wrong number of Troves");
            assertEq(c.sortedTroves.getSize(), handler.numTroves(i) - handler.numZombies(i), "Wrong SortedTroves size");
            assertEqDecimal(c.activePool.getCollBalance(), handler.activeColl(i), 18, "Wrong ActivePool coll");
            assertEqDecimal(
                c.activePool.getBoldDebt(),
                handler.activeDebt(i) + handler.getPendingInterest(i),
                18,
                "Wrong ActivePool debt"
            );
            assertEqDecimal(c.defaultPool.getCollBalance(), handler.defaultColl(i), 18, "Wrong DefaultPool coll");
            assertEqDecimal(c.defaultPool.getBoldDebt(), handler.defaultDebt(i), 18, "Wrong DefaultPool debt");
            assertEqDecimal(weth.balanceOf(address(c.gasPool)), handler.getGasPool(i), 18, "Wrong GasPool balance");
            assertEqDecimal(
                c.collSurplusPool.getCollBalance(), handler.collSurplus(i), 18, "Wrong CollSurplusPool balance"
            );
            assertEqDecimal(
                c.stabilityPool.getTotalBoldDeposits(),
                handler.spBoldDeposits(i),
                18,
                "Wrong StabilityPool total BOLD deposits"
            );
            assertEqDecimal(
                c.stabilityPool.getYieldGainsOwed(), handler.spBoldYield(i), 18, "Wrong StabilityPool yield gains owed"
            );
            assertEqDecimal(c.stabilityPool.getCollBalance(), handler.spColl(i), 18, "Wrong StabilityPool Coll balance");
        }

        assertEqDecimal(boldToken.totalSupply(), handler.getBoldSupply(), 18, "Wrong BOLD supply");
        assertEqDecimal(
            collateralRegistry.getRedemptionRateWithDecay(), handler.getRedemptionRate(), 18, "Wrong redemption rate"
        );
    }

    function invariant_AllBoldBackedByTroveDebt() external view {
        uint256 totalBold = boldToken.totalSupply();
        uint256 totalPendingInterest = 0;
        uint256 totalDebt = 0;

        for (uint256 j = 0; j < branches.length; ++j) {
            LiquityContracts memory c = branches[j];
            uint256 numTroves = c.troveManager.getTroveIdsCount();

            totalPendingInterest += c.activePool.calcPendingAggInterest();

            for (uint256 i = 0; i < numTroves; ++i) {
                totalDebt += c.troveManager.getTroveEntireDebt(c.troveManager.getTroveFromTroveIdsArray(i));
            }
        }

        assertApproxEqAbsDecimal(
            totalBold + totalPendingInterest, totalDebt, 1e-10 ether, 18, "Total Bold !~= total debt"
        );
    }

    function invariant_AllCollClaimable() external view {
        for (uint256 j = 0; j < branches.length; ++j) {
            ITroveManager troveManager = branches[j].troveManager;
            uint256 numTroves = troveManager.getTroveIdsCount();
            uint256 systemColl = troveManager.getEntireSystemColl();
            uint256 trovesColl = 0;

            for (uint256 i = 0; i < numTroves; ++i) {
                trovesColl += troveManager.getTroveEntireColl(troveManager.getTroveFromTroveIdsArray(i));
            }

            assertApproxEqAbsDecimal(
                systemColl,
                trovesColl,
                1e-10 ether,
                18,
                string.concat("Branch #", j.toString(), ": System coll !~= Troves coll")
            );
        }
    }

    function invariant_StabilityPool_AllBoldClaimable_ExceptYieldReceivedWhileEmpty() external view {
        for (uint256 j = 0; j < branches.length; ++j) {
            IStabilityPool stabilityPool = branches[j].stabilityPool;

            uint256 sumBoldDeposit = 0;
            uint256 sumYieldGain = 0;

            for (uint256 i = 0; i < actors.length; ++i) {
                sumBoldDeposit += stabilityPool.getCompoundedBoldDeposit(actors[i].account);
                sumYieldGain += stabilityPool.getDepositorYieldGain(actors[i].account);
            }

            assertApproxEqAbsDecimal(
                stabilityPool.getTotalBoldDeposits(),
                sumBoldDeposit,
                1e-3 ether,
                18,
                string.concat("Branch #", j.toString(), ": totalBoldDeposits !~= sum(boldDeposit)")
            );

            assertApproxEqAbsDecimal(
                stabilityPool.getYieldGainsOwed(),
                sumYieldGain,
                1e-3 ether,
                18,
                string.concat("Branch #", j.toString(), ": yieldGainsOwed !~= sum(yieldGain)")
            );

            // This only holds as long as no one sends BOLD directly to the SP's address other than ActivePool
            assertApproxEqAbsDecimal(
                boldToken.balanceOf(address(stabilityPool)),
                sumBoldDeposit + sumYieldGain + handler.spUnclaimableBoldYield(j),
                1e-3 ether,
                18,
                string.concat("Branch #", j.toString(), ": SP BOLD balance !~= claimable + unclaimable BOLD")
            );
        }
    }

    function invariant_StabilityPool_AllCollClaimable() external view {
        for (uint256 j = 0; j < branches.length; ++j) {
            IStabilityPool stabilityPool = branches[j].stabilityPool;
            uint256 stabilityPoolEth = stabilityPool.getCollBalance();
            uint256 claimableEth = 0;

            for (uint256 i = 0; i < actors.length; ++i) {
                claimableEth += stabilityPool.getDepositorCollGain(actors[i].account);
                claimableEth += stabilityPool.stashedColl(actors[i].account);
            }

            assertApproxEqAbsDecimal(
                stabilityPoolEth,
                claimableEth,
                1e-5 ether,
                18,
                string.concat("Branch #", j.toString(), ": SP Coll !~= claimable Coll")
            );
        }
    }

    function invariant_SortedTroves_OrderedByInterestRate() external view {
        for (uint256 j = 0; j < branches.length; ++j) {
            ITroveManager troveManager = branches[j].troveManager;
            ISortedTroves sortedTroves = branches[j].sortedTroves;

            uint256 i = 0;
            uint256 size = sortedTroves.getSize();
            uint256[] memory troveIds = new uint256[](size);
            uint256 curr = sortedTroves.getFirst();

            if (curr == 0) {
                assertEq(
                    size,
                    0,
                    string.concat("Branch #", j.toString(), ": SortedTroves forward node count doesn't match size")
                );

                assertEq(
                    sortedTroves.getLast(),
                    0,
                    string.concat("Branch #", j.toString(), ": SortedTroves reverse node count doesn't match size")
                );

                // empty list is ordered by definition
                continue;
            }

            troveIds[i++] = curr;
            uint256 prevAnnualInterestRate = troveManager.getTroveAnnualInterestRate(curr);
            curr = sortedTroves.getNext(curr);

            while (curr != 0) {
                uint256 currAnnualInterestRate = troveManager.getTroveAnnualInterestRate(curr);

                assertLeDecimal(
                    currAnnualInterestRate,
                    prevAnnualInterestRate,
                    18,
                    string.concat("Branch #", j.toString(), ": SortedTroves ordering is broken")
                );

                troveIds[i++] = curr;
                prevAnnualInterestRate = currAnnualInterestRate;
                curr = sortedTroves.getNext(curr);
            }

            assertEq(
                i, size, string.concat("Branch #", j.toString(), ": SortedTroves forward node count doesn't match size")
            );

            // Verify reverse ordering
            curr = sortedTroves.getLast();

            while (i > 0) {
                assertNotEq(
                    curr,
                    0,
                    string.concat("Branch #", j.toString(), ": SortedTroves reverse node count doesn't match size")
                );

                assertEq(
                    curr,
                    troveIds[--i],
                    string.concat("Branch #", j.toString(), ": SortedTroves reverse ordering is broken")
                );

                curr = sortedTroves.getPrev(curr);
            }

            assertEq(
                curr, 0, string.concat("Branch #", j.toString(), ": SortedTroves reverse node count doesn't match size")
            );
        }
    }

    function invariant_SortedTroves_BatchesAreContiguous() external {
        for (uint256 j = 0; j < branches.length; ++j) {
            ISortedTroves sortedTroves = branches[j].sortedTroves;
            uint256 prev = sortedTroves.getFirst();

            if (prev == 0) {
                continue;
            }

            BatchId prevBatch = sortedTroves.getBatchOf(prev);

            if (prevBatch.isNotZero()) {
                assertEq(
                    prev,
                    sortedTroves.getBatchHead(prevBatch),
                    string.concat("Branch #", j.toString(), ": Wrong batch head")
                );
            }

            uint256 curr = sortedTroves.getNext(prev);
            BatchId currBatch = sortedTroves.getBatchOf(curr);

            while (curr != 0) {
                if (currBatch.notEquals(prevBatch)) {
                    if (prevBatch.isNotZero()) {
                        assertFalse(
                            seenBatches.has(prevBatch), string.concat("Branch #", j.toString(), ": Batch already seen")
                        );

                        seenBatches.add(prevBatch);

                        assertEq(
                            prev,
                            sortedTroves.getBatchTail(prevBatch),
                            string.concat("Branch #", j.toString(), ": Wrong batch tail")
                        );
                    }

                    if (currBatch.isNotZero()) {
                        assertEq(
                            curr,
                            sortedTroves.getBatchHead(currBatch),
                            string.concat("Branch #", j.toString(), ": Wrong batch head")
                        );
                    }
                }

                prev = curr;
                prevBatch = currBatch;

                curr = sortedTroves.getNext(prev);
                currBatch = sortedTroves.getBatchOf(curr);
            }

            if (prevBatch.isNotZero()) {
                assertFalse(seenBatches.has(prevBatch), string.concat("Branch #", j.toString(), ": Batch already seen"));
                assertEq(
                    prev,
                    sortedTroves.getBatchTail(prevBatch),
                    string.concat("Branch #", j.toString(), ": Wrong batch tail")
                );
            }

            seenBatches.clear();
        }
    }
}
