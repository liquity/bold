// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {MIN_DEBT} from "../src/Dependencies/Constants.sol";
import {IAddressesRegistry} from "../src/Interfaces/IAddressesRegistry.sol";
import {IRedemptionHelper} from "../src/Interfaces/IRedemptionHelper.sol";
import {TroveChange} from "../src/Types/TroveChange.sol";
import {RedemptionHelper} from "../src/RedemptionHelper.sol";
import {Accounts} from "./TestContracts/Accounts.sol";
import {TestDeployer} from "./TestContracts/Deployment.t.sol";
import {DevTestSetup} from "./TestContracts/DevTestSetup.sol";

uint256 constant NUM_BRANCHES = 3;
uint256 constant NUM_TROVES = 20;

contract RedemptionHelperTest is DevTestSetup {
    using Strings for *;

    struct TroveParams {
        uint256 branchIdx;
        uint256 collRatio;
        uint256 debt;
    }

    TestDeployer.TroveManagerParams[] params;
    TestDeployer.LiquityContractsDev[] branch;
    IRedemptionHelper redemptionHelper;

    function setUp() public override {
        // Start tests at a non-zero timestamp
        vm.warp(block.timestamp + 600);

        accounts = new Accounts();
        createAccounts();

        (A, B, C, D, E, F, G) = (
            accountsList[0],
            accountsList[1],
            accountsList[2],
            accountsList[3],
            accountsList[4],
            accountsList[5],
            accountsList[6]
        );

        params.push(TestDeployer.TroveManagerParams(1.5 ether, 1.1 ether, 0.1 ether, 1.1 ether, 0.05 ether, 0.1 ether));
        params.push(TestDeployer.TroveManagerParams(1.6 ether, 1.2 ether, 0.1 ether, 1.2 ether, 0.05 ether, 0.2 ether));
        params.push(TestDeployer.TroveManagerParams(1.6 ether, 1.2 ether, 0.1 ether, 1.2 ether, 0.05 ether, 0.2 ether));
        assertEq(NUM_BRANCHES, 3, "Must update params");

        TestDeployer.LiquityContractsDev[] memory tmpBranch;
        TestDeployer deployer = new TestDeployer();
        (tmpBranch, collateralRegistry, boldToken, hintHelpers,, WETH,) =
            deployer.deployAndConnectContractsMultiColl(params);

        for (uint256 i = 0; i < tmpBranch.length; ++i) {
            branch.push(tmpBranch[i]);
        }

        branch[0].priceFeed.setPrice(2000e18);
        branch[1].priceFeed.setPrice(3000e18);
        branch[2].priceFeed.setPrice(4000e18);
        assertEq(NUM_BRANCHES, 3, "Must update initial prices");

        for (uint256 i = 0; i < branch.length; ++i) {
            for (uint256 j = 0; j < accountsList.length; ++j) {
                // Give some Collateral to test accounts, and approve it to BorrowerOperations
                giveAndApproveCollateral(
                    branch[i].collToken, accountsList[j], 10_000 ether, address(branch[i].borrowerOperations)
                );

                // Approve WETH for gas compensation in all branches
                vm.prank(accountsList[j]);
                WETH.approve(address(branch[i].borrowerOperations), type(uint256).max);
            }
        }

        IAddressesRegistry[] memory addresses = new IAddressesRegistry[](branch.length);
        for (uint256 i = 0; i < branch.length; ++i) {
            addresses[i] = branch[i].addressesRegistry;
        }

        redemptionHelper = new RedemptionHelper(collateralRegistry, addresses);
    }

    function findAmountToBorrow(uint256 branchIdx, uint256 targetDebt, uint256 interestRate)
        internal
        view
        returns (uint256 borrow, uint256 upfrontFee)
    {
        uint256 borrowRight = targetDebt;
        upfrontFee = hintHelpers.predictOpenTroveUpfrontFee(branchIdx, borrowRight, interestRate);
        uint256 borrowLeft = borrowRight - upfrontFee;

        for (uint256 i = 0; i < 256; ++i) {
            borrow = (borrowLeft + borrowRight) / 2;
            upfrontFee = hintHelpers.predictOpenTroveUpfrontFee(branchIdx, borrow, interestRate);
            uint256 actualDebt = borrow + upfrontFee;

            if (actualDebt == targetDebt) {
                break;
            } else if (actualDebt < targetDebt) {
                borrowLeft = borrow;
            } else {
                borrowRight = borrow;
            }
        }
    }

    function openTrove(
        uint256 branchIdx,
        address owner,
        uint256 ownerIdx,
        uint256 collRatio,
        uint256 debt,
        uint256 interestRate
    ) internal {
        (uint256 borrow, uint256 upfrontFee) = findAmountToBorrow(branchIdx, debt, interestRate);
        uint256 coll = Math.ceilDiv(debt * collRatio, branch[branchIdx].priceFeed.getPrice());

        vm.prank(owner);
        branch[branchIdx].borrowerOperations.openTrove({
            _owner: owner,
            _ownerIndex: ownerIdx,
            _ETHAmount: coll,
            _boldAmount: borrow,
            _upperHint: 0,
            _lowerHint: 0,
            _annualInterestRate: interestRate,
            _maxUpfrontFee: upfrontFee,
            _addManager: address(0),
            _removeManager: address(0),
            _receiver: address(0)
        });
    }

    function openTroves(address owner, TroveParams[NUM_TROVES] memory trove) internal {
        for (uint256 i = 0; i < trove.length; ++i) {
            trove[i].branchIdx = _bound(trove[i].branchIdx, 0, branch.length - 1);
            trove[i].collRatio = _bound(trove[i].collRatio, params[trove[i].branchIdx].CCR, 3 ether);
            trove[i].debt = _bound(trove[i].debt, MIN_DEBT, 100 * MIN_DEBT);
            openTrove(trove[i].branchIdx, owner, i, trove[i].collRatio, trove[i].debt, 0.05 ether);
        }
    }

    function provideToSP(uint256 branchIdx, address account, uint256 bold) public {
        vm.prank(account);
        branch[branchIdx].stabilityPool.provideToSP(bold, true);
    }

    function provideToSPs(address account, uint256[NUM_BRANCHES] memory bold) public {
        for (uint256 i = 0; i < bold.length; ++i) {
            bold[i] = _bound(bold[i], 0, boldToken.balanceOf(account) - 1);
            if (bold[i] > 0) provideToSP(i, account, bold[i]);
        }
    }

    function setTotalCollRatio(uint256[NUM_BRANCHES] memory totalCollRatio) internal {
        for (uint256 i = 0; i < totalCollRatio.length; ++i) {
            totalCollRatio[i] = _bound(totalCollRatio[i], 0.9 ether, 3 ether);
            uint256 totalColl = branch[i].troveManager.getEntireBranchColl();
            uint256 totalDebt = branch[i].troveManager.getEntireBranchDebt();
            if (totalColl > 0) branch[i].priceFeed.setPrice(totalCollRatio[i] * totalDebt / totalColl);
        }
    }

    function test_SimulateRedemption(
        uint256 delay,
        TroveParams[NUM_TROVES] memory troves,
        uint256[NUM_BRANCHES] memory spBold,
        uint256[NUM_BRANCHES] memory totalCollRatio,
        uint256 attemptedRedeemedBold,
        uint256 maxIterations
    ) external {
        skip(_bound(delay, 0, 30 days)); // decay the baserate

        openTroves(A, troves);
        provideToSPs(A, spBold);
        setTotalCollRatio(totalCollRatio);

        attemptedRedeemedBold = _bound(attemptedRedeemedBold, 1, boldToken.balanceOf(A));
        maxIterations = _bound(maxIterations, 0, NUM_TROVES);

        (IRedemptionHelper.SimulationContext[] memory sim,) =
            redemptionHelper.simulateRedemption(attemptedRedeemedBold, maxIterations);

        uint256 expectedRedeemedBold = 0;
        uint256 expectedMaxIterations = 0;

        for (uint256 i = 0; i < sim.length; ++i) {
            expectedRedeemedBold += sim[i].redeemedBold;
            expectedMaxIterations = Math.max(expectedMaxIterations, sim[i].iterations);
        }

        assertLeDecimal(expectedRedeemedBold, attemptedRedeemedBold, 18, "expectedRedeemedBold > attemptedRedeemedBold");
        if (maxIterations != 0) assertLe(expectedMaxIterations, maxIterations, "expectedMaxIterations > maxIterations");

        uint256 boldBalanceBefore = boldToken.balanceOf(A);
        vm.prank(A);
        collateralRegistry.redeemCollateral(attemptedRedeemedBold, expectedMaxIterations, 1 ether);
        uint256 actualRedeemedBold = boldBalanceBefore - boldToken.balanceOf(A);

        // There can be a tiny difference between the simulated and actually redeemed BOLD amounts,
        // since RedemptionHelper doesn't implement error feedback similar to what CollateralRegistry
        // does when proportionally splitting the redeemed amount.
        //
        // We deem this acceptable, since the frontend will eventually apply significantly larger
        // slippage tolerance margins to the corresponding min collateral amounts anyway.
        assertApproxEqAbsDecimal(
            actualRedeemedBold, expectedRedeemedBold, 2, 18, "actualRedeemedBold != expectedRedeemedBold"
        );
    }

    function test_TruncateRedemption(
        uint256 delay,
        TroveParams[NUM_TROVES] memory troves,
        uint256[NUM_BRANCHES] memory spBold,
        uint256[NUM_BRANCHES] memory totalCollRatio,
        uint256 attemptedRedeemedBold,
        uint256 maxIterations
    ) external {
        skip(_bound(delay, 0, 30 days)); // decay the baserate

        openTroves(A, troves);
        provideToSPs(A, spBold);
        setTotalCollRatio(totalCollRatio);

        attemptedRedeemedBold = _bound(attemptedRedeemedBold, 1, boldToken.balanceOf(A));
        maxIterations = _bound(maxIterations, 0, NUM_TROVES);

        (uint256 truncatedRedeemedBold, uint256 feePct, IRedemptionHelper.Redeemed[] memory expectedRedeemed) =
            redemptionHelper.truncateRedemption(attemptedRedeemedBold, maxIterations);
        vm.assume(truncatedRedeemedBold > 0);

        assertLeDecimal(
            truncatedRedeemedBold, attemptedRedeemedBold, 18, "truncatedRedeemedBold > attemptedRedeemedBold"
        );

        uint256 boldBalanceBefore = boldToken.balanceOf(A);
        uint256[] memory collBalanceBefore = new uint256[](branch.length);
        for (uint256 i = 0; i < branch.length; ++i) {
            collBalanceBefore[i] = branch[i].collToken.balanceOf(A);
        }

        vm.prank(A);
        collateralRegistry.redeemCollateral(truncatedRedeemedBold, maxIterations, feePct);

        uint256 actualRedeemedBold = boldBalanceBefore - boldToken.balanceOf(A);
        assertApproxEqAbsDecimal(
            actualRedeemedBold, truncatedRedeemedBold, 1, 18, "actualRedeemedBold != truncatedRedeemedBold"
        );

        for (uint256 i = 0; i < branch.length; ++i) {
            uint256 actualRedeemedColl = branch[i].collToken.balanceOf(A) - collBalanceBefore[i];

            assertApproxEqAbsDecimal(
                actualRedeemedColl,
                expectedRedeemed[i].coll,
                10,
                18,
                string.concat("actualRedeemedColl != expectedRedeemed[", i.toString(), "].coll")
            );
        }
    }

    function test_RedeemCollateral_RefundsRemainingBold() external {
        skip(100 days);

        for (uint256 i = 0; i < branch.length - 1; ++i) {
            openTrove(i, A, 0, 2 ether, 10_000 ether, 0.05 ether);
        }

        // All branches have the same unbacked portions,
        // but on the last branch only 2K can be redeemed in 1 iteration
        openTrove(branch.length - 1, A, 0, 2 ether, 2_000 ether, 0.05 ether);
        openTrove(branch.length - 1, A, 1, 2 ether, 8_000 ether, 0.06 ether);

        uint256 boldBalanceBefore = boldToken.balanceOf(A);
        uint256 attemptedRedeemedBold = branch.length * 3_000 ether;

        vm.startPrank(A);
        boldToken.approve(address(redemptionHelper), attemptedRedeemedBold);
        redemptionHelper.redeemCollateral(attemptedRedeemedBold, 1, 1 ether, new uint256[](branch.length));
        vm.stopPrank();

        uint256 actualRedeemedBold = boldBalanceBefore - boldToken.balanceOf(A);
        assertEqDecimal(actualRedeemedBold, attemptedRedeemedBold - 1_000 ether, 18, "actualRedeemedBold");
        assertEqDecimal(boldToken.balanceOf(address(redemptionHelper)), 0, 18, "boldToken.balanceOf(redemptionHelper)");
    }

    function test_RedeemCollateral_ForwardsRedeemedColl() external {
        skip(100 days);

        for (uint256 i = 0; i < branch.length; ++i) {
            openTrove(i, A, 0, 2 ether, 10_000 ether, 0.05 ether);
        }

        uint256[] memory collBalanceBefore = new uint256[](branch.length);
        for (uint256 i = 0; i < branch.length; ++i) {
            collBalanceBefore[i] = branch[i].collToken.balanceOf(A);
        }

        uint256 redeemedBold = branch.length * 1_000 ether; // a tenth of the supply

        vm.startPrank(A);
        boldToken.approve(address(redemptionHelper), redeemedBold);
        redemptionHelper.redeemCollateral(redeemedBold, 1, 1 ether, new uint256[](branch.length));
        vm.stopPrank();

        for (uint256 i = 0; i < branch.length; ++i) {
            uint256 actualRedeemedColl = branch[i].collToken.balanceOf(A) - collBalanceBefore[i];

            assertApproxEqAbsDecimal(
                actualRedeemedColl,
                1_000 ether * 0.895 ether / branch[i].priceFeed.getPrice(),
                1,
                18,
                "actualRedeemedColl"
            );

            assertEqDecimal(
                branch[i].collToken.balanceOf(address(redemptionHelper)), 0, 18, "collToken.balanceOf(redemptionHelper)"
            );
        }
    }

    function test_RedeemCollateral_RevertsWhenRedeemedCollLtMin() external {
        skip(100 days);

        for (uint256 i = 0; i < branch.length; ++i) {
            // Use the same price on each branch for simplicity
            branch[i].priceFeed.setPrice(1_000 ether);
            openTrove(i, A, 0, 2 ether, 10_000 ether, 0.05 ether);
        }

        uint256 redeemedBold = branch.length * 1_000 ether; // a tenth of the supply

        uint256[] memory minCollRedeemed = new uint256[](branch.length);
        for (uint256 i = 0; i < branch.length; ++i) {
            minCollRedeemed[i] = 0.895 ether;
        }

        vm.startPrank(A);
        {
            boldToken.approve(address(redemptionHelper), redeemedBold);

            for (uint256 i = 0; i < branch.length; ++i) {
                // Make one of the parameters too high
                ++minCollRedeemed[i];

                // This should cause the redemption to revert
                vm.expectRevert("Insufficient collateral redeemed");
                redemptionHelper.redeemCollateral(redeemedBold, 1, 1 ether, minCollRedeemed);

                // Fix the parameter that was made too high
                --minCollRedeemed[i];
            }

            // Should succeed now that all parameters are fixed
            redemptionHelper.redeemCollateral(redeemedBold, 1, 1 ether, minCollRedeemed);
        }
        vm.stopPrank();
    }
}
