// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {IBoldToken} from "../Interfaces/IBoldToken.sol";
import {IStabilityPool} from "../Interfaces/IStabilityPool.sol";
import {HintHelpers} from "../HintHelpers.sol";
import {TestDeployer} from "./TestContracts/Deployment.t.sol";
import {BaseInvariantTest} from "./TestContracts/BaseInvariantTest.sol";
import {SPInvariantsTestHandler} from "./TestContracts/SPInvariantsTestHandler.t.sol";

contract SPInvariantsTest is BaseInvariantTest {
    IStabilityPool stabilityPool;
    SPInvariantsTestHandler handler;

    function setUp() public override {
        super.setUp();

        TestDeployer deployer = new TestDeployer();
        (TestDeployer.LiquityContractsDev memory contracts,, IBoldToken boldToken, HintHelpers hintHelpers,,,) =
            deployer.deployAndConnectContracts();
        stabilityPool = contracts.stabilityPool;

        handler = new SPInvariantsTestHandler(
            SPInvariantsTestHandler.Contracts({
                boldToken: boldToken,
                borrowerOperations: contracts.borrowerOperations,
                collateralToken: contracts.collToken,
                priceFeed: contracts.priceFeed,
                stabilityPool: contracts.stabilityPool,
                troveManager: contracts.troveManager,
                collSurplusPool: contracts.collSurplusPool
            }),
            hintHelpers
        );

        vm.label(address(handler), "handler");
        targetContract(address(handler));
    }

    function invariant_allFundsClaimable() external view {
        uint256 stabilityPoolColl = stabilityPool.getCollBalance();
        uint256 stabilityPoolBold = stabilityPool.getTotalBoldDeposits();
        uint256 yieldGainsOwed = stabilityPool.getYieldGainsOwed();

        uint256 claimableColl = 0;
        uint256 claimableBold = 0;
        uint256 sumYieldGains = 0;

        for (uint256 i = 0; i < actors.length; ++i) {
            claimableColl += stabilityPool.getDepositorCollGain(actors[i].account);
            claimableBold += stabilityPool.getCompoundedBoldDeposit(actors[i].account);
            sumYieldGains += stabilityPool.getDepositorYieldGain(actors[i].account);
        }

        assertApproxEqAbsDecimal(stabilityPoolColl, claimableColl, 0.00001 ether, 18, "SP Coll !~ claimable Coll");
        assertApproxEqAbsDecimal(stabilityPoolBold, claimableBold, 0.001 ether, 18, "SP BOLD !~ claimable BOLD");
        assertApproxEqAbsDecimal(yieldGainsOwed, sumYieldGains, 0.001 ether, 18, "SP yieldGainsOwed !~= sum(yieldGain)");
    }

    function test_Issue_NoLossOfFundsAfterAnyTwoLiquidationsFollowingTinyP() external {
        vm.prank(adam);
        handler.openTrove(100_000 ether); // used as funds

        vm.prank(barb); // can't use startPrank because of the handler's internal pranking
        uint256 debt = handler.openTrove(2_000 ether);
        vm.prank(barb);
        handler.provideToSp(debt + debt / 1 ether + 1, false);
        vm.prank(barb);
        handler.liquidateMe();

        vm.prank(barb);
        debt = handler.openTrove(2_000 ether);
        vm.prank(barb);
        handler.provideToSp(debt, false);
        vm.prank(barb);
        handler.liquidateMe();

        this.invariant_allFundsClaimable();

        vm.prank(adam);
        handler.provideToSp(80_000 ether, false);

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
