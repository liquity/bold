// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {Test} from "forge-std/Test.sol";
import {IBoldToken} from "../Interfaces/IBoldToken.sol";
import {IStabilityPool} from "../Interfaces/IStabilityPool.sol";
import {LiquityContracts, _deployAndConnectContracts} from "../deployment.sol";
import {SPInvariantsTestHandler} from "./TestContracts/SPInvariantsTestHandler.sol";

contract SPInvariantsTest is Test {
    string[] actorLabels = ["Adam", "Barb", "Carl", "Dana", "Eric", "Fran", "Gabe", "Hope"];
    address[] actors;

    IStabilityPool stabilityPool;
    SPInvariantsTestHandler handler;

    function setUp() external {
        (LiquityContracts memory contracts,, IBoldToken boldToken,,) = _deployAndConnectContracts();
        stabilityPool = contracts.stabilityPool;

        handler = new SPInvariantsTestHandler(
            SPInvariantsTestHandler.Contracts({
                boldToken: boldToken,
                borrowerOperations: contracts.borrowerOperations,
                collateralToken: contracts.WETH,
                priceFeed: contracts.priceFeed,
                stabilityPool: contracts.stabilityPool,
                troveManager: contracts.troveManager,
                collSurplusPool: contracts.collSurplusPool
            })
        );

        targetContract(address(handler));

        for (uint160 i = 0; i < actorLabels.length; ++i) {
            address actor = address((i + 1) * uint160(0x1111111111111111111111111111111111111111));
            vm.label(actor, actorLabels[i]);
            targetSender(actor);
            actors.push(actor);
        }

        assert(actors.length == actorLabels.length);
    }

    function invariant_allFundsClaimable() external {
        uint256 stabilityPoolEth = stabilityPool.getETHBalance();
        uint256 stabilityPoolBold = stabilityPool.getTotalBoldDeposits();
        uint256 claimableEth = 0;
        uint256 claimableBold = 0;

        for (uint256 i = 0; i < actors.length; ++i) {
            claimableEth += stabilityPool.getDepositorETHGain(actors[i]);
            claimableBold += stabilityPool.getCompoundedBoldDeposit(actors[i]);
        }

        assertApproxEqAbsDecimal(stabilityPoolEth, claimableEth, 0.00001 ether, 18, "SP ETH !~ claimable ETH");
        assertApproxEqAbsDecimal(stabilityPoolBold, claimableBold, 0.001 ether, 18, "SP BOLD !~ claimable BOLD");
    }

    function test_Issue_NoLossOfFundsAfterAnyTwoLiquidationsFollowingTinyP() external {
        address adam = actors[0];
        address barb = actors[1];

        vm.prank(adam);
        handler.openTrove(100_000 ether); // used as funds

        vm.prank(barb); // can't use startPrank because of the handler's internal pranking
        uint256 debt = handler.openTrove(2_000 ether);
        vm.prank(barb);
        handler.provideToSp(debt + debt / 1 ether + 1, true);
        vm.prank(barb);
        handler.liquidateMe();

        vm.prank(barb);
        debt = handler.openTrove(2_000 ether);
        vm.prank(barb);
        handler.provideToSp(debt, true);
        vm.prank(barb);
        handler.liquidateMe();

        this.invariant_allFundsClaimable();

        vm.prank(adam);
        handler.provideToSp(80_000 ether, true);

        this.invariant_allFundsClaimable();

        vm.prank(barb);
        debt = handler.openTrove(2_000 ether);
        vm.prank(barb);
        handler.liquidateMe();

        this.invariant_allFundsClaimable();

        vm.prank(barb);
        debt = handler.openTrove(2_000 ether);
        vm.prank(barb);
        handler.liquidateMe();

        // Expect SP LUSD ~ claimable LUSD: ...
        this.invariant_allFundsClaimable();

        // Adam still has non-zero deposit
        assertGt(stabilityPool.getCompoundedBoldDeposit(adam), 0, "Adam deposit 0");
    }
}
