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
        params[0] = TroveManagerParams(1.1 ether, 0.05 ether, 0.1 ether);
        params[1] = TroveManagerParams(1.2 ether, 0.05 ether, 0.1 ether);
        params[2] = TroveManagerParams(1.2 ether, 0.05 ether, 0.1 ether);
        params[3] = TroveManagerParams(1.2 ether, 0.05 ether, 0.1 ether);

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
    }

    function invariant_AllBoldBackedByTroveDebt() external view {
        uint256 totalBold = boldToken.totalSupply();
        uint256 totalDebt = 0;
        uint256 totalPendingInterest = 0;

        for (uint256 j = 0; j < branches.length; ++j) {
            LiquityContracts memory c = branches[j];
            uint256 numTroves = c.troveManager.getTroveIdsCount();

            for (uint256 i = 0; i < numTroves; ++i) {
                totalDebt += c.troveManager.getTroveEntireDebt(c.troveManager.getTroveFromTroveIdsArray(i));
            }

            totalPendingInterest += c.activePool.calcPendingAggInterest();
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

    function test_XXX() external {
        // batch: []
        // liquidatable: []
        vm.prank(dana);
        handler.batchLiquidateTroves(2);

        // Expected revert: TroveManager: Calldata address array must not be empty

        // upper hint: 30246076129467464594090080447872540948197330609836947493093576206562742804430
        // lower hint: 0
        // upfront fee: 0 ether
        // coll: 0.000000000000000044 ether
        // debt: 0.000000000000004272 ether
        vm.prank(carl);
        handler.openTrove(
            3, 0.000000000000004272 ether, 2.100000000000012482 ether, 0.000000000000015575 ether, 7723, 19858
        );

        // Expected revert: BorrowerOps: Trove's debt must be greater than minimum

        vm.prank(dana);
        handler.addMeToLiquidationBatch();

        // upper hint: 27750008343791586097295710466941256554010738621566943407062180607643822645792
        // lower hint: 16067009688728882652490097800170345506102883954093153296105590916951930111500
        // upfront fee: 1_201.566489794206439726 ether
        // coll: 864.846482193828959226 ether
        // debt: 101_201.566489794206439726 ether
        vm.prank(adam);
        handler.openTrove(
            1, 100_000 ether, 1.709156314850216161 ether, 0.626531098249836215 ether, 4294967295, 83662261
        );

        // upper hint: 0
        // lower hint: 0
        // upfront fee: 450.373510990799953282 ether
        // coll: 142.535628344860862273 ether
        // debt: 31_674.584076635747171997 ether
        vm.prank(gabe);
        handler.openTrove(2, 31_224.210565644947218715 ether, 0.9 ether, 0.752101052968133473 ether, 4, 28);

        // Expected revert: BorrowerOps: An operation that would result in ICR < MCR is not permitted

        vm.prank(barb);
        handler.addMeToLiquidationBatch();

        // batch: [dana, barb]
        // liquidatable: []
        vm.prank(carl);
        handler.batchLiquidateTroves(3);

        // Expected revert: TroveManager: nothing to liquidate

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        vm.prank(dana);
        handler.provideToSP(3, 13_244.021558651854363757 ether, true);

        vm.prank(dana);
        handler.warp(8_052_444);

        // upper hint: adam
        // lower hint: adam
        // upfront fee: 0 ether
        vm.prank(hope);
        handler.adjustTroveInterestRate(1, 0.854936278466460882 ether, 206417, 47238097);

        // Expected revert: ERC721: invalid token ID

        // upfront fee: 0 ether
        // coll: 0 ether
        // debt: 0 ether
        // coll redist: 0 ether
        // debt redist: 0 ether
        // accrued interest: 0 ether
        vm.prank(gabe);
        handler.adjustTrove(0, uint8(AdjustedTroveProperties.both), 0 ether, true, 0 ether, false);

        // Expected revert: BorrowerOps: Trove does not have active status

        // batch: []
        // liquidatable: []
        vm.prank(hope);
        handler.batchLiquidateTroves(0);

        // Expected revert: TroveManager: Calldata address array must not be empty

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        vm.prank(hope);
        handler.withdrawFromSP(3, 0 ether, true);

        // Expected revert: StabilityPool: User must have a non-zero deposit

        // upper hint: 910030357925706599779227635327256991071043935031835496317309045580501137596
        // lower hint: 5367099133711769804941217402111576108035736495091864510656482702915891540584
        // upfront fee: 0 ether
        vm.prank(dana);
        handler.adjustTroveInterestRate(3, 0.002666393566627752 ether, 7847, 70435);

        // Expected revert: ERC721: invalid token ID

        // upper hint: 13536707816115945274445152639204998904240288430085816120759684370747458632973
        // lower hint: 31043029142677115247611143645140544890284207797318024896150045075920477918961
        // upfront fee: 0 ether
        vm.prank(adam);
        handler.adjustTroveInterestRate(1, 0.189729080289350284 ether, 221143, 18771);

        // batch: []
        // liquidatable: []
        vm.prank(eric);
        handler.batchLiquidateTroves(2);

        // Expected revert: TroveManager: Calldata address array must not be empty

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        vm.prank(fran);
        handler.withdrawFromSP(1, 0 ether, true);

        // Expected revert: StabilityPool: User must have a non-zero deposit

        // upper hint: 85132265227373323920646982008700665285372487404100026353002862162415903746185
        // lower hint: 0
        // upfront fee: 0 ether
        // coll: 0.000000000000000177 ether
        // debt: 0.000000000000016878 ether
        vm.prank(eric);
        handler.openTrove(
            3, 0.000000000000016878 ether, 2.100000000000003881 ether, 0.000000000000003564 ether, 1869881427, 1216
        );

        // Expected revert: BorrowerOps: Trove's debt must be greater than minimum

        vm.prank(adam);
        handler.warp(18_459);

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        vm.prank(hope);
        handler.withdrawFromSP(1, 0 ether, false);

        // Expected revert: StabilityPool: User must have a non-zero deposit

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        vm.prank(hope);
        handler.withdrawFromSP(0, 0 ether, true);

        // Expected revert: StabilityPool: User must have a non-zero deposit

        // upper hint: 25023245989019577020304678245203235786251334281572637956179059632869372434080
        // lower hint: 87903029871075914254377627908054574944891091886930582284385770809450030037083
        // upfront fee: 0 ether
        vm.prank(gabe);
        handler.adjustTroveInterestRate(0, 0.000000000044489335 ether, 25021, 3);

        // Expected revert: ERC721: invalid token ID

        vm.prank(carl);
        handler.addMeToLiquidationBatch();

        // initial deposit: 0 ether
        // compounded deposit: 0 ether
        // yield gain: 0 ether
        // coll gain: 0 ether
        // stashed coll: 0 ether
        vm.prank(hope);
        handler.withdrawFromSP(2, 0 ether, false);

        // Expected revert: StabilityPool: User must have a non-zero deposit

        // batch: [carl]
        // liquidatable: []
        vm.prank(dana);
        handler.batchLiquidateTroves(2);

        // Expected revert: TroveManager: nothing to liquidate

        // batch: []
        // liquidatable: []
        vm.prank(carl);
        handler.batchLiquidateTroves(0);

        // Expected revert: TroveManager: Calldata address array must not be empty

        // batch: []
        // liquidatable: []
        vm.prank(dana);
        handler.batchLiquidateTroves(0);

        // Expected revert: TroveManager: Calldata address array must not be empty

        // upper hint: 0
        // lower hint: 98197216311439117187599629143273946693421604893830872388540787401495566614597
        // upfront fee: 0 ether
        vm.prank(adam);
        handler.adjustTroveInterestRate(1, 0 ether, 904, 63306);
    }
}
