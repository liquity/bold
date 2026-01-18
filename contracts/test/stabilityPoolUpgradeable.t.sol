// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import {SPTest} from "./stabilityPool.t.sol";
import {StabilityPool} from "../src/StabilityPool.sol";
import {IStabilityPool} from "../src/Interfaces/IStabilityPool.sol";
import {TransparentUpgradeableProxy, ITransparentUpgradeableProxy} from "openzeppelin-contracts/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "openzeppelin-contracts/contracts/proxy/transparent/ProxyAdmin.sol";

/*
 * Tests for upgradeable StabilityPool with the P initialization fix.
 */
contract SPUpgradeableTest is SPTest {
    bytes32 private constant IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 private constant ADMIN_SLOT =
        0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    address proxyAdmin;

    function setUp() public override {
        super.setUp();

        address SPAddress = address(stabilityPool);

        StabilityPool spImplementation = new StabilityPool(true, systemParams);

        proxyAdmin = address(new ProxyAdmin());

        TransparentUpgradeableProxy tempProxy = new TransparentUpgradeableProxy(
            address(spImplementation),
            proxyAdmin,
            ""
        );

        bytes memory proxyBytecode = address(tempProxy).code;

        vm.etch(SPAddress, proxyBytecode);

        for (uint256 i = 0; i < 70; i++) {
            vm.store(SPAddress, bytes32(i), bytes32(0));
        }

        vm.store(
            SPAddress,
            IMPLEMENTATION_SLOT,
            bytes32(uint256(uint160(address(spImplementation))))
        );
        vm.store(SPAddress, ADMIN_SLOT, bytes32(uint256(uint160(proxyAdmin))));

        vm.store(SPAddress, bytes32(uint256(0)), bytes32(uint256(0)));

        IStabilityPool(SPAddress).initialize(addressesRegistry);
    }

    function testPValue() public view {
        assertEq(stabilityPool.P(), stabilityPool.P_PRECISION());
        assertEq(stabilityPool.P(), 1e36);
    }

    function testGetDepositorBoldGain_2SPDepositor1LiqFreshDeposit_Upgraded_EarnFairShareOfSPYield()
        public
    {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustments();
        ABCDEF[2] memory expectedShareOfReward;

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest_0 = activePool.calcPendingAggInterest();
        uint256 expectedSpYield_0 = (SP_YIELD_SPLIT * pendingAggInterest_0) /
            1e18;

        expectedShareOfReward[0].A = getShareofSPReward(A, expectedSpYield_0);
        expectedShareOfReward[0].B = getShareofSPReward(B, expectedSpYield_0);
        uint256 totalSPDeposits_0 = stabilityPool.getTotalBoldDeposits();

        makeSPWithdrawalAndClaim(A, 500e18);

        // Upgrade SP to similar impl
        address spImplementation = address(
            new StabilityPool(true, systemParams)
        );
        vm.prank(proxyAdmin);
        ITransparentUpgradeableProxy(address(stabilityPool)).upgradeTo(
            spImplementation
        );

        // A liquidates D
        liquidate(A, troveIDs.D);
        // Check SP has only 1e18 BOLD now, and A and B have small remaining deposits
        assertEq(
            stabilityPool.getTotalBoldDeposits(),
            1e18,
            "SP total bold deposits should be 1e18"
        );
        assertLt(
            stabilityPool.getCompoundedBoldDeposit(A),
            1e18,
            "A should have <1e18 deposit"
        );
        assertLt(
            stabilityPool.getCompoundedBoldDeposit(B),
            1e18,
            "B should have <1e18 deposit"
        );
        assertLe(
            stabilityPool.getCompoundedBoldDeposit(B) +
                stabilityPool.getCompoundedBoldDeposit(A),
            1e18,
            "A & B deposits should sum to <=1e18"
        );

        // C and D makes fresh deposit
        uint256 deposit_C = 1e18;
        uint256 deposit_D = 1e18;
        makeSPDepositAndClaim(C, deposit_C);
        transferBold(C, D, deposit_D);
        makeSPDepositAndClaim(D, deposit_D);

        // Check SP still has funds
        uint256 totalSPDeposits_1 = stabilityPool.getTotalBoldDeposits();
        assertGt(totalSPDeposits_1, 0);
        assertLt(totalSPDeposits_1, totalSPDeposits_0);

        // fast-forward time again and accrue interest
        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);
        uint256 expectedSpYield_1 = (SP_YIELD_SPLIT * pendingAggInterest_1) /
            1e18;

        // Expected reward round 2 calculated with a different totalSPDeposits denominator. Expect A and B to earn a small share of
        // this reward.
        expectedShareOfReward[1].A = getShareofSPReward(A, expectedSpYield_1);
        expectedShareOfReward[1].B = getShareofSPReward(B, expectedSpYield_1);
        expectedShareOfReward[1].C = getShareofSPReward(C, expectedSpYield_1);
        expectedShareOfReward[1].D = getShareofSPReward(D, expectedSpYield_1);
        assertGt(expectedShareOfReward[1].A, 0);
        assertGt(expectedShareOfReward[1].B, 0);
        assertGt(expectedShareOfReward[1].C, 0);
        assertGt(expectedShareOfReward[1].D, 0);
        // A and B should get small rewards from reward 2, as their deposits were reduced to 1e18.
        // Confirm A, B are smaller than C, D's rewards
        assertLt(expectedShareOfReward[1].A, expectedShareOfReward[1].C);
        assertLt(expectedShareOfReward[1].A, expectedShareOfReward[1].D);
        assertLt(expectedShareOfReward[1].B, expectedShareOfReward[1].C);
        assertLt(expectedShareOfReward[1].B, expectedShareOfReward[1].D);

        // Confirm the expected shares sum up to the total expected yield
        assertApproximatelyEqual(
            expectedShareOfReward[1].A +
                expectedShareOfReward[1].B +
                expectedShareOfReward[1].C +
                expectedShareOfReward[1].D,
            expectedSpYield_1,
            1e4,
            "expected shares should sum up to the total expected yield"
        );

        // A trove gets poked again, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        // Expect A to receive only their share of 2nd reward, since they already claimed first
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(A),
            expectedShareOfReward[1].A,
            1e4,
            "A should receive only 2nd reward"
        );
        // Expect B to receive their share of 1st and 2nd rewards
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(B),
            expectedShareOfReward[0].B + expectedShareOfReward[1].B,
            1e4,
            "B should receive only their share of 1st and 2nd"
        );
        // Expect C to receive a share of only 2nd reward
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(C),
            expectedShareOfReward[1].C,
            1e4,
            "C should receive a share of both reward 1 and 2"
        );
    }

    function testGetDepositorBoldGain_2SPDepositor1LiqScaleChangeFreshDeposit_Upgraded_EarnFairShareOfSPYield()
        public
    {
        ABCDEF memory troveIDs = _setupForSPDepositAdjustmentsBigTroves();
        ABCDEF[3] memory expectedShareOfReward;

        vm.warp(block.timestamp + 90 days + 1);

        uint256 pendingAggInterest_0 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_0, 0);
        uint256 expectedSpYield_0 = (SP_YIELD_SPLIT * pendingAggInterest_0) /
            1e18;

        expectedShareOfReward[0].A = getShareofSPReward(A, expectedSpYield_0);
        expectedShareOfReward[0].B = getShareofSPReward(B, expectedSpYield_0);
        assertGt(expectedShareOfReward[0].A, 0);
        assertGt(expectedShareOfReward[0].B, 0);
        uint256 totalSPDeposits_0 = stabilityPool.getTotalBoldDeposits();

        // Confirm the expected shares sum up to the total expected yield
        assertApproximatelyEqual(
            expectedShareOfReward[0].A + expectedShareOfReward[0].B,
            expectedSpYield_0,
            1e3
        );

        // A withdraws some deposit so that D's liq will trigger a scale change.
        // This also mints interest and pays the yield to the SP
        uint256 debtSPDelta = totalSPDeposits_0 -
            troveManager.getTroveEntireDebt(troveIDs.D);
        makeSPWithdrawalAndClaim(A, debtSPDelta - 1e12);
        assertEq(stabilityPool.getDepositorYieldGain(A), 0);
        assertEq(activePool.calcPendingAggInterest(), 0);

        assertEq(stabilityPool.currentScale(), 0);

        // A liquidates D
        liquidate(A, troveIDs.D);

        // Upgrade SP to similar impl
        address spImplementation = address(
            new StabilityPool(true, systemParams)
        );
        vm.prank(proxyAdmin);
        ITransparentUpgradeableProxy(address(stabilityPool)).upgradeTo(
            spImplementation
        );

        // Check scale increased
        assertEq(stabilityPool.currentScale(), 1);

        // C and D makes fresh deposit
        uint256 deposit_C = 1e27;
        uint256 deposit_D = 1e27;
        makeSPDepositAndClaim(C, deposit_C);
        transferBold(C, D, deposit_D);
        makeSPDepositAndClaim(D, deposit_D);

        // fast-forward time again and accrue interest
        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 pendingAggInterest_1 = activePool.calcPendingAggInterest();
        assertGt(pendingAggInterest_1, 0);
        uint256 expectedSpYield_1 = (SP_YIELD_SPLIT * pendingAggInterest_1) /
            1e18;

        // Expected reward round 2 calculated with a different totalSPDeposits denominator.
        expectedShareOfReward[1].A = getShareofSPReward(A, expectedSpYield_1);
        expectedShareOfReward[1].B = getShareofSPReward(B, expectedSpYield_1);
        expectedShareOfReward[1].C = getShareofSPReward(C, expectedSpYield_1);
        expectedShareOfReward[1].D = getShareofSPReward(D, expectedSpYield_1);

        // Expect A, B, C and D to get reward 2
        assertGt(expectedShareOfReward[1].A, 0);
        assertGt(expectedShareOfReward[1].B, 0);
        assertGt(expectedShareOfReward[1].C, 0);
        assertGt(expectedShareOfReward[1].D, 0);
        // ... though A, B's share should be smaller than C, D's share
        assertLt(expectedShareOfReward[1].A, expectedShareOfReward[1].C);
        assertLt(expectedShareOfReward[1].A, expectedShareOfReward[1].D);
        assertLt(expectedShareOfReward[1].B, expectedShareOfReward[1].C);
        assertLt(expectedShareOfReward[1].B, expectedShareOfReward[1].D);

        // A trove gets poked again, interst minted and yield paid to SP
        applyPendingDebt(B, troveIDs.A);

        // A only gets reward 2 since already claimed reward 1
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(A),
            expectedShareOfReward[1].A,
            1e15
        );

        // B gets reward 1 + 2
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(B),
            expectedShareOfReward[0].B + expectedShareOfReward[1].B,
            1e14
        );
        // C, D get reward 2
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(C),
            expectedShareOfReward[1].C,
            1e14
        );
        assertApproximatelyEqual(
            stabilityPool.getDepositorYieldGain(D),
            expectedShareOfReward[1].D,
            1e14
        );
    }
}
