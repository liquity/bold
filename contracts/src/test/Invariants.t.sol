// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {IActivePool} from "../Interfaces/IActivePool.sol";
import {IStabilityPool} from "../Interfaces/IStabilityPool.sol";
import {ITroveManager} from "../Interfaces/ITroveManager.sol";
import {_deployAndConnectContracts, LiquityContracts, TroveManagerParams} from "../deployment.sol";
import {BaseInvariantTest} from "./TestContracts/BaseInvariantTest.sol";
import {BaseMultiCollateralTest} from "./TestContracts/BaseMultiCollateralTest.sol";
import {InvariantsTestHandler} from "./TestContracts/InvariantsTestHandler.sol";

contract InvariantsTest is BaseInvariantTest, BaseMultiCollateralTest {
    using Strings for uint256;

    InvariantsTestHandler handler;

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

        handler = new InvariantsTestHandler("handler", contracts);
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
}
