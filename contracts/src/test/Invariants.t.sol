// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {BatchId} from "../Types/BatchId.sol";
import {LatestBatchData} from "../Types/LatestBatchData.sol";
import {LatestTroveData} from "../Types/LatestTroveData.sol";
import {ISortedTroves} from "../Interfaces/ISortedTroves.sol";
import {IStabilityPool} from "../Interfaces/IStabilityPool.sol";
import {ITroveManager} from "../Interfaces/ITroveManager.sol";
import {BatchIdSet} from "./Utils/BatchIdSet.sol";
import {Logging} from "./Utils/Logging.sol";
import {StringFormatting} from "./Utils/StringFormatting.sol";
import {ITroveManagerTester} from "./TestContracts/Interfaces/ITroveManagerTester.sol";
import {BaseInvariantTest} from "./TestContracts/BaseInvariantTest.sol";
import {BaseMultiCollateralTest} from "./TestContracts/BaseMultiCollateralTest.sol";
import {TestDeployer} from "./TestContracts/Deployment.t.sol";
import {AdjustedTroveProperties, InvariantsTestHandler} from "./TestContracts/InvariantsTestHandler.t.sol";

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

library ToStringFunctions {
    function toString(ITroveManager.Status status) internal pure returns (string memory) {
        if (status == ITroveManager.Status.nonExistent) return "ITroveManager.Status.nonExistent";
        if (status == ITroveManager.Status.active) return "ITroveManager.Status.active";
        if (status == ITroveManager.Status.closedByOwner) return "ITroveManager.Status.closedByOwner";
        if (status == ITroveManager.Status.closedByLiquidation) return "ITroveManager.Status.closedByLiquidation";
        if (status == ITroveManager.Status.unredeemable) return "ITroveManager.Status.unredeemable";
        revert("Invalid status");
    }
}

function getBatchManager(ITroveManager troveManager, uint256 troveId) view returns (address batchManager) {
    (,,,,,,,, batchManager,) = troveManager.Troves(troveId);
}

contract InvariantsTest is Logging, BaseInvariantTest, BaseMultiCollateralTest {
    using Strings for uint256;
    using StringFormatting for uint256;
    using SortedTrovesHelpers for ISortedTroves;
    using ToStringFunctions for *;
    using {getBatchManager} for ITroveManagerTester;

    InvariantsTestHandler handler;
    BatchIdSet seenBatches;

    function setUp() public override {
        super.setUp();

        // TODO: randomize params? How to do it with Foundry invariant testing?
        TestDeployer.TroveManagerParams[] memory paramsList = new TestDeployer.TroveManagerParams[](4);
        paramsList[0] = TestDeployer.TroveManagerParams(1.5 ether, 1.1 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        paramsList[1] = TestDeployer.TroveManagerParams(1.6 ether, 1.2 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        paramsList[2] = TestDeployer.TroveManagerParams(1.6 ether, 1.2 ether, 1.01 ether, 0.05 ether, 0.1 ether);
        paramsList[3] = TestDeployer.TroveManagerParams(1.6 ether, 1.25 ether, 1.01 ether, 0.05 ether, 0.1 ether);

        TestDeployer deployer = new TestDeployer();
        Contracts memory contracts;
        (contracts.branches, contracts.collateralRegistry, contracts.boldToken, contracts.hintHelpers,, contracts.weth,)
        = deployer.deployAndConnectContractsMultiColl(paramsList);
        setupContracts(contracts);

        handler = new InvariantsTestHandler({contracts: contracts, assumeNoExpectedFailures: true});
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

    function invariant_SystemStateMatchesGhostState() external view {
        for (uint256 i = 0; i < branches.length; ++i) {
            TestDeployer.LiquityContractsDev memory c = branches[i];

            assertEq(c.troveManager.getTroveIdsCount(), handler.numTroves(i), "Wrong number of Troves");
            assertEq(c.sortedTroves.getSize(), handler.numTroves(i) - handler.numZombies(i), "Wrong SortedTroves size");
            assertApproxEqAbsDecimal(
                c.activePool.calcPendingAggInterest(), handler.getPendingInterest(i), 1e-10 ether, 18, "Wrong interest"
            );
            assertApproxEqAbsDecimal(
                c.activePool.aggWeightedDebtSum(), handler.getInterestAccrual(i), 1e26, 36, "Wrong interest accrual"
            );
            assertApproxEqAbsDecimal(
                c.activePool.aggWeightedBatchManagementFeeSum(),
                handler.getBatchManagementFeeAccrual(i),
                1e26,
                36,
                "Wrong batch management fee accrual"
            );
            assertEqDecimal(weth.balanceOf(address(c.gasPool)), handler.getGasPool(i), 18, "Wrong GasPool");
            assertEqDecimal(c.collSurplusPool.getCollBalance(), handler.collSurplus(i), 18, "Wrong CollSurplusPool");
            assertApproxEqAbsDecimal(
                c.stabilityPool.getTotalBoldDeposits(),
                handler.spBoldDeposits(i),
                100,
                18,
                "Wrong StabilityPool deposits"
            );
            assertEqDecimal(
                c.stabilityPool.getYieldGainsOwed(), handler.spBoldYield(i), 18, "Wrong StabilityPool yield"
            );
            assertEqDecimal(c.stabilityPool.getCollBalance(), handler.spColl(i), 18, "Wrong StabilityPool coll");

            for (uint256 j = 0; j < handler.numTroves(i); ++j) {
                (uint256 troveId, uint256 coll, uint256 debt, ITroveManager.Status status, address batchManager) =
                    handler.getTrove(i, j);

                LatestTroveData memory t = c.troveManager.getLatestTroveData(troveId);
                assertApproxEqAbsDecimal(t.entireColl, coll, 1e-10 ether, 18, "Wrong Trove coll");
                assertApproxEqAbsDecimal(t.entireDebt, debt, 1e-10 ether, 18, "Wrong Trove debt");
                assertEq(c.troveManager.getTroveStatus(troveId).toString(), status.toString(), "Wrong Trove status");
                assertEq(c.troveManager.getBatchManager(troveId), batchManager, "Wrong batch manager (TM)");
                assertEq(c.borrowerOperations.interestBatchManagerOf(troveId), batchManager, "Wrong batch manager (BO)");

                if (status == ITroveManager.Status.active) {
                    assertEq(
                        BatchId.unwrap(c.sortedTroves.getBatchOf(troveId)), batchManager, "Wrong batch manager (ST)"
                    );
                }
            }

            for (uint256 j = 0; j < actors.length; ++j) {
                LatestBatchData memory b = c.troveManager.getLatestBatchData(actors[j].account);

                assertApproxEqAbsDecimal(
                    b.accruedManagementFee,
                    handler.getPendingBatchManagementFee(i, actors[j].account),
                    1e-10 ether,
                    18,
                    "Wrong batch management fee"
                );
            }
        }

        assertEqDecimal(
            collateralRegistry.getRedemptionRateWithDecay(), handler.getRedemptionRate(), 18, "Wrong redemption rate"
        );
    }

    function invariant_OnlyActiveTrovesInSortedTroves() external view {
        for (uint256 j = 0; j < branches.length; ++j) {
            TestDeployer.LiquityContractsDev memory c = branches[j];
            uint256 numTroves = c.troveManager.getTroveIdsCount();

            for (uint256 i = 0; i < numTroves; ++i) {
                uint256 troveId = c.troveManager.getTroveFromTroveIdsArray(i);
                ITroveManager.Status status = c.troveManager.getTroveStatus(troveId);

                assertTrue(
                    status == ITroveManager.Status.active || status == ITroveManager.Status.unredeemable,
                    "Unexpected status"
                );

                if (status == ITroveManager.Status.active) {
                    assertTrue(c.sortedTroves.contains(troveId), "SortedTroves should contain active Troves");
                } else {
                    assertFalse(c.sortedTroves.contains(troveId), "SortedTroves shouldn't contain unredeemable Troves");
                }
            }
        }
    }

    function invariant_AllBoldBackedByTroveDebt() external view {
        uint256 totalBold = boldToken.totalSupply();
        uint256 totalPendingInterest = 0;
        uint256 totalPendingBatchManagementFees = 0;
        uint256 totalDebt = 0;

        for (uint256 j = 0; j < branches.length; ++j) {
            TestDeployer.LiquityContractsDev memory c = branches[j];
            uint256 numTroves = c.troveManager.getTroveIdsCount();
            // info("Troves (branch #", j.toString(), "): [");

            totalPendingInterest += c.activePool.calcPendingAggInterest();
            totalPendingBatchManagementFees += c.activePool.aggBatchManagementFees();
            totalPendingBatchManagementFees += c.activePool.calcPendingAggBatchManagementFee();

            for (uint256 i = 0; i < numTroves; ++i) {
                uint256 troveId = c.troveManager.getTroveFromTroveIdsArray(i);
                uint256 debt = c.troveManager.getTroveEntireDebt(troveId);
                // info("  Trove({owner: ", vm.getLabel(c.troveNFT.ownerOf(troveId)), ", debt: ", debt.decimal(), "}),");

                totalDebt += debt;
            }

            // info("]");
            // _log();
        }

        // TODO: precisely track upper bound of error by counting int divisions in interest accrual.
        // (Redistributions have a feedback loop that prevents errors from accumulating there).
        assertApproxEqAbsDecimal(
            totalBold + totalPendingInterest + totalPendingBatchManagementFees,
            totalDebt,
            1e-10 ether,
            18,
            "Total Bold !~= total debt"
        );
    }

    function invariant_AllCollClaimable() external view {
        for (uint256 j = 0; j < branches.length; ++j) {
            ITroveManagerTester troveManager = branches[j].troveManager;
            uint256 numTroves = troveManager.getTroveIdsCount();
            uint256 systemColl = troveManager.getEntireSystemColl();
            uint256 trovesColl = 0;

            for (uint256 i = 0; i < numTroves; ++i) {
                trovesColl += troveManager.getTroveEntireColl(troveManager.getTroveFromTroveIdsArray(i));
            }

            assertApproxEqAbsDecimal(systemColl, trovesColl, 1e-10 ether, 18, "System coll !~= Troves coll");
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
                "totalBoldDeposits !~= sum(boldDeposit)"
            );

            assertApproxEqAbsDecimal(
                stabilityPool.getYieldGainsOwed(), sumYieldGain, 1e-3 ether, 18, "yieldGainsOwed !~= sum(yieldGain)"
            );

            // This only holds as long as no one sends BOLD directly to the SP's address other than ActivePool
            assertApproxEqAbsDecimal(
                boldToken.balanceOf(address(stabilityPool)),
                sumBoldDeposit + sumYieldGain + handler.spUnclaimableBoldYield(j),
                1e-3 ether,
                18,
                "SP BOLD balance !~= claimable + unclaimable BOLD"
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

            assertApproxEqAbsDecimal(stabilityPoolEth, claimableEth, 1e-5 ether, 18, "SP Coll !~= claimable Coll");
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
                assertEq(size, 0, "SortedTroves forward node count doesn't match size");
                assertEq(sortedTroves.getLast(), 0, "SortedTroves reverse node count doesn't match size");

                // empty list is ordered by definition
                continue;
            }

            troveIds[i++] = curr;
            uint256 prevAnnualInterestRate = troveManager.getTroveAnnualInterestRate(curr);
            curr = sortedTroves.getNext(curr);

            while (curr != 0) {
                uint256 currAnnualInterestRate = troveManager.getTroveAnnualInterestRate(curr);
                assertLeDecimal(currAnnualInterestRate, prevAnnualInterestRate, 18, "SortedTroves ordering is broken");

                troveIds[i++] = curr;
                prevAnnualInterestRate = currAnnualInterestRate;
                curr = sortedTroves.getNext(curr);
            }

            assertEq(i, size, "SortedTroves forward node count doesn't match size");

            // Verify reverse ordering
            curr = sortedTroves.getLast();

            while (i > 0) {
                assertNotEq(curr, 0, "SortedTroves reverse node count doesn't match size");
                assertEq(curr, troveIds[--i], "SortedTroves reverse ordering is broken");

                curr = sortedTroves.getPrev(curr);
            }

            assertEq(curr, 0, "SortedTroves reverse node count doesn't match size");
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
                assertEq(prev, sortedTroves.getBatchHead(prevBatch), "Wrong batch head");
            }

            uint256 curr = sortedTroves.getNext(prev);
            BatchId currBatch = sortedTroves.getBatchOf(curr);

            while (curr != 0) {
                if (currBatch.notEquals(prevBatch)) {
                    if (prevBatch.isNotZero()) {
                        assertFalse(seenBatches.has(prevBatch), "Batch already seen");
                        assertEq(prev, sortedTroves.getBatchTail(prevBatch), "Wrong batch tail");

                        seenBatches.add(prevBatch);
                    }

                    if (currBatch.isNotZero()) {
                        assertEq(curr, sortedTroves.getBatchHead(currBatch), "Wrong batch head");
                    }
                }

                prev = curr;
                prevBatch = currBatch;

                curr = sortedTroves.getNext(prev);
                currBatch = sortedTroves.getBatchOf(curr);
            }

            if (prevBatch.isNotZero()) {
                assertFalse(seenBatches.has(prevBatch), "Batch already seen");
                assertEq(prev, sortedTroves.getBatchTail(prevBatch), "Wrong batch tail");
            }

            seenBatches.clear();
        }
    }
}
