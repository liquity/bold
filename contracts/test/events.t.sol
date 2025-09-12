// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "openzeppelin-contracts/contracts/utils/math/Math.sol";
import "src/Interfaces/IStabilityPoolEvents.sol";
import "./TestContracts/DevTestSetup.sol";
import "src/Dependencies/Constants.sol";

struct LiquidationParams {
    uint256 collSentToSP;
    uint256 collRedistributed;
    uint256 collGasCompensation;
    uint256 collSurplus;
    uint256 debtOffsetBySP;
    uint256 debtRedistributed;
    uint256 ethGasCompensation;
}

function aggregateLiquidation(LiquidationParams memory aggregate, LiquidationParams memory single) pure {
    aggregate.collSentToSP += single.collSentToSP;
    aggregate.collRedistributed += single.collRedistributed;
    aggregate.collGasCompensation += single.collGasCompensation;
    aggregate.collSurplus += single.collSurplus;
    aggregate.debtOffsetBySP += single.debtOffsetBySP;
    aggregate.debtRedistributed += single.debtRedistributed;
    aggregate.ethGasCompensation += single.ethGasCompensation;
}

function filter(Vm.Log[] memory logs, bytes32 selector) pure returns (Vm.Log[] memory matchingLogs) {
    uint256 j = 0;

    for (uint256 i = 0; i < logs.length; ++i) {
        if (logs[i].topics[0] == selector) {
            ++j;
        }
    }

    matchingLogs = new Vm.Log[](j);
    j = 0;

    for (uint256 i = 0; i < logs.length; ++i) {
        if (logs[i].topics[0] == selector) {
            matchingLogs[j++] = logs[i];
        }
    }
}

function concat(string memory a, string memory b) pure returns (string memory ab) {
    return string(abi.encodePacked(a, b));
}

contract EventsTest is DevTestSetup {
    function assertEqLogs(Vm.Log[] memory a, Vm.Log[] memory b, string memory errPrefix) internal pure {
        assertEq(a.length, b.length, concat(errPrefix, " - log count mismatch"));

        for (uint256 i = 0; i < a.length; ++i) {
            assertEq(a[i].topics.length, b[i].topics.length, concat(errPrefix, " - topic count mismatch"));

            for (uint256 j = 0; j < a[i].topics.length; ++j) {
                assertEq(a[i].topics[j], b[i].topics[j], concat(errPrefix, " - topic mismatch"));
            }

            assertEq0(a[i].data, b[i].data, concat(errPrefix, " - data mismatch"));
        }
    }
}

contract TroveEventsTest is EventsTest, ITroveEvents {
    using {filter} for Vm.Log[];
    using {aggregateLiquidation} for LiquidationParams;

    function test_OpenTroveEmitsTroveUpdated() external {
        address owner = A;
        uint256 ownerIndex = 0;
        uint256 coll = 100 ether;
        uint256 borrow = 10_000 ether;
        uint256 interestRate = 0.01 ether;

        uint256 troveId = addressToTroveId(owner, ownerIndex);
        uint256 upfrontFee = predictOpenTroveUpfrontFee(borrow, interestRate);
        uint256 debt = borrow + upfrontFee;
        uint256 stake = coll;

        vm.expectEmit();
        emit TroveUpdated(
            troveId,
            debt,
            coll,
            stake,
            interestRate,
            0, // _snapshotOfTotalDebtRedist
            0 // _snapshotOfTotalCollRedist
        );

        vm.prank(owner);
        borrowerOperations.openTrove(
            owner, ownerIndex, coll, borrow, 0, 0, interestRate, upfrontFee, address(0), address(0), address(0)
        );
    }

    function test_OpenTroveEmitsTroveOperation() external {
        address owner = A;
        uint256 ownerIndex = 0;
        uint256 coll = 100 ether;
        uint256 borrow = 10_000 ether;
        uint256 interestRate = 0.01 ether;

        uint256 troveId = addressToTroveId(owner, ownerIndex);
        uint256 upfrontFee = predictOpenTroveUpfrontFee(borrow, interestRate);

        vm.expectEmit();
        emit TroveOperation(
            troveId,
            Operation.openTrove,
            interestRate,
            0, // _debtIncreaseFromRedist
            upfrontFee,
            int256(borrow),
            0, // _collIncreaseFromRedist
            int256(coll)
        );

        vm.prank(owner);
        borrowerOperations.openTrove(
            owner, ownerIndex, coll, borrow, 0, 0, interestRate, upfrontFee, address(0), address(0), address(0)
        );
    }

    function test_AdjustTroveEmitsTroveUpdated() external {
        uint256 interestRate = 0.01 ether;
        (uint256 troveId,) = openTroveHelper(A, 0, 100 ether, 10_000 ether, interestRate);

        uint256 deposit = 10 ether;
        uint256 borrow = 1_000 ether;

        uint256 upfrontFee = predictAdjustTroveUpfrontFee(troveId, borrow);
        uint256 coll = troveManager.getTroveEntireColl(troveId) + deposit;
        uint256 debt = troveManager.getTroveEntireDebt(troveId) + borrow + upfrontFee;
        uint256 stake = coll;

        vm.expectEmit();
        emit TroveUpdated(
            troveId,
            debt,
            coll,
            stake,
            interestRate,
            0, // _snapshotOfTotalDebtRedist
            0 // _snapshotOfTotalCollRedist
        );

        vm.prank(A);
        borrowerOperations.adjustTrove(troveId, deposit, true, borrow, true, upfrontFee);
    }

    function test_AdjustTroveEmitsTroveOperation() external {
        uint256 interestRate = 0.01 ether;
        (uint256 troveId,) = openTroveHelper(A, 0, 100 ether, 10_000 ether, interestRate);

        uint256 deposit = 10 ether;
        uint256 borrow = 1_000 ether;

        uint256 upfrontFee = predictAdjustTroveUpfrontFee(troveId, borrow);

        vm.expectEmit();
        emit TroveOperation(
            troveId,
            Operation.adjustTrove,
            interestRate,
            0, // _debtIncreaseFromRedist
            upfrontFee,
            int256(borrow),
            0, // _collIncreaseFromRedist
            int256(deposit)
        );

        vm.prank(A);
        borrowerOperations.adjustTrove(troveId, deposit, true, borrow, true, upfrontFee);
    }

    function test_AdjustTroveInterestRateEmitsTroveUpdated() external {
        (uint256 troveId,) = openTroveHelper(A, 0, 100 ether, 10_000 ether, 0.01 ether);

        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN);

        uint256 coll = troveManager.getTroveEntireColl(troveId);
        uint256 debt = troveManager.getTroveEntireDebt(troveId);
        uint256 stake = coll;

        uint256 newInterestRate = 0.02 ether;

        vm.expectEmit();
        emit TroveUpdated(
            troveId,
            debt,
            coll,
            stake,
            newInterestRate,
            0, // _snapshotOfTotalDebtRedist
            0 // _snapshotOfTotalCollRedist
        );

        vm.prank(A);
        borrowerOperations.adjustTroveInterestRate(troveId, newInterestRate, 0, 0, 0);
    }

    function test_AdjustTroveInterestRateEmitsTroveOperation() external {
        (uint256 troveId,) = openTroveHelper(A, 0, 100 ether, 10_000 ether, 0.01 ether);

        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN);

        uint256 newInterestRate = 0.02 ether;

        vm.expectEmit();
        emit TroveOperation(
            troveId,
            Operation.adjustTroveInterestRate,
            newInterestRate,
            0, // _debtIncreaseFromRedist
            0, // _debtIncreaseFromUpfrontFee
            0, // _debtChangeFromOperation
            0, // _collIncreaseFromRedist
            0 // _collChangeFromOperation
        );

        vm.prank(A);
        borrowerOperations.adjustTroveInterestRate(troveId, newInterestRate, 0, 0, 0);
    }

    function test_ApplyTroveInterestPermissionlessEmitsTroveUpdated() external {
        uint256 interestRate = 0.01 ether;
        (uint256 troveId,) = openTroveHelper(A, 0, 100 ether, 10_000 ether, interestRate);

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 coll = troveManager.getTroveEntireColl(troveId);
        uint256 debt = troveManager.getTroveEntireDebt(troveId);
        uint256 stake = coll;

        vm.expectEmit();
        emit TroveUpdated(
            troveId,
            debt,
            coll,
            stake,
            interestRate,
            0, // _snapshotOfTotalDebtRedist
            0 // _snapshotOfTotalCollRedist
        );

        vm.prank(A);
        borrowerOperations.applyPendingDebt(troveId);
    }

    function test_ApplyTroveInterestPermissionlessEmitsTroveOperation() external {
        uint256 interestRate = 0.01 ether;
        (uint256 troveId,) = openTroveHelper(A, 0, 100 ether, 10_000 ether, interestRate);

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        vm.expectEmit();
        emit TroveOperation(
            troveId,
            Operation.applyPendingDebt,
            interestRate,
            0, // _debtIncreaseFromRedist
            0, // _debtIncreaseFromUpfrontFee
            0, // _debtChangeFromOperation
            0, // _collIncreaseFromRedist
            0 // _collChangeFromOperation
        );

        vm.prank(A);
        borrowerOperations.applyPendingDebt(troveId);
    }

    function test_CloseTroveEmitsTroveUpdated() external {
        uint256 coll = 100 ether;
        (uint256 troveId,) = openTroveHelper(A, 0, coll, 10_000 ether, 0.01 ether);

        // one more Trove so we're allowed to close the 1st one
        openTroveHelper(B, 0, 100 ether, 10_000 ether, 0.01 ether);

        uint256 debt = troveManager.getTroveEntireDebt(troveId);
        uint256 balance = boldToken.balanceOf(A);
        assertGe(debt, balance, "expected debt >= balance");

        // B helps A close their Trove
        vm.prank(B);
        boldToken.transfer(A, debt - balance);

        vm.expectEmit();
        emit TroveUpdated(
            troveId,
            0, // _debt
            0, // _coll
            0, // _stake
            0, // _annualInterestRate
            0, // _snapshotOfTotalDebtRedist
            0 // _snapshotOfTotalCollRedist
        );

        vm.prank(A);
        borrowerOperations.closeTrove(troveId);
    }

    function test_CloseTroveEmitsTroveOperation() external {
        uint256 coll = 100 ether;
        (uint256 troveId,) = openTroveHelper(A, 0, coll, 10_000 ether, 0.01 ether);

        // one more Trove so we're allowed to close the 1st one
        openTroveHelper(B, 0, 100 ether, 10_000 ether, 0.01 ether);

        uint256 debt = troveManager.getTroveEntireDebt(troveId);
        uint256 balance = boldToken.balanceOf(A);
        assertGe(debt, balance, "expected debt >= balance");

        // B helps A close their Trove
        vm.prank(B);
        boldToken.transfer(A, debt - balance);

        vm.expectEmit();
        emit TroveOperation(
            troveId,
            Operation.closeTrove,
            0, // _annualInterestRate
            0, // _debtIncreaseFromRedist
            0, // _debtIncreaseFromUpfrontFee
            -int256(debt), // _debtChangeFromOperation
            0, // _collIncreaseFromRedist
            -int256(coll) // _collChangeFromOperation
        );

        vm.prank(A);
        borrowerOperations.closeTrove(troveId);
    }

    function test_LiquidateEmitsTroveUpdated() external {
        // open a Trove to keep TCR afloat and let us liquidate the 2nd one
        openTroveWithExactICRAndDebt(B, 0, 2 * CCR, 10_000 ether, 0.01 ether);

        (uint256 liquidatedTroveId,) = openTroveWithExactICRAndDebt(A, 0, MCR, 10_000 ether, 0.01 ether);

        // drop price by 1%
        priceFeed.setPrice(priceFeed.getPrice() * 99 / 100);

        vm.expectEmit();
        emit TroveUpdated(
            liquidatedTroveId,
            0, // _debt
            0, // _coll
            0, // _stake
            0, // _annualInterestRate
            0, // _snapshotOfTotalDebtRedist
            0 // _snapshotOfTotalCollRedist
        );

        troveManager.liquidate(liquidatedTroveId);
    }

    function test_LiquidateEmitsTroveOperation() external {
        // open a Trove to keep TCR afloat and let us liquidate the 2nd one
        openTroveWithExactICRAndDebt(B, 0, 2 * CCR, 10_000 ether, 0.01 ether);

        (uint256 liquidatedTroveId,) = openTroveWithExactICRAndDebt(A, 0, MCR, 10_000 ether, 0.01 ether);

        uint256 debt = troveManager.getTroveEntireDebt(liquidatedTroveId);
        uint256 coll = troveManager.getTroveEntireColl(liquidatedTroveId);

        // drop price by 1%
        priceFeed.setPrice(priceFeed.getPrice() * 99 / 100);

        vm.expectEmit();
        emit TroveOperation(
            liquidatedTroveId,
            Operation.liquidate,
            0, // _annualInterestRate
            0, // _debtIncreaseFromRedist
            0, // _debtIncreaseFromUpfrontFee
            -int256(debt), // _debtChangeFromOperation
            0, // _collIncreaseFromRedist
            -int256(coll) // _collChangeFromOperation
        );

        troveManager.liquidate(liquidatedTroveId);
    }

    function test_LiquidateEmitsLiquidation() external {
        // open a Trove to keep TCR afloat and let us liquidate the 2nd one
        (, uint256 otherColl) = openTroveWithExactICRAndDebt(B, 0, 2 * CCR, 10_000 ether, 0.01 ether);

        uint256 liquidatedDebt = 10_000 ether;
        (uint256 liquidatedTroveId, uint256 liquidatedColl) =
            openTroveWithExactICRAndDebt(A, 0, MCR, liquidatedDebt, 0.01 ether);

        // drop price by 1%
        uint256 price = priceFeed.getPrice() * 99 / 100;
        priceFeed.setPrice(price);

        LiquidationParams memory l;
        l.collRedistributed = liquidatedColl;
        l.debtRedistributed = liquidatedDebt;
        l.ethGasCompensation = ETH_GAS_COMPENSATION;

        vm.expectEmit();
        emit Liquidation(
            l.debtOffsetBySP,
            l.debtRedistributed,
            l.ethGasCompensation,
            l.collGasCompensation,
            l.collSentToSP,
            l.collRedistributed,
            l.collSurplus,
            l.collRedistributed * DECIMAL_PRECISION / otherColl,
            l.debtRedistributed * DECIMAL_PRECISION / otherColl,
            price
        );

        troveManager.liquidate(liquidatedTroveId);
    }

    function test_BatchLiquidateTrovesEmitsTroveUpdatedForEachLiquidatedTrove() external {
        // open a Trove to keep TCR afloat and let us liquidate the other Troves
        openTroveHelper(B, 0, 1_000 ether, 10_000 ether, 0.01 ether);

        uint256[] memory liquidateTroveIds = new uint256[](3);
        for (uint256 i = 0; i < liquidateTroveIds.length; ++i) {
            (liquidateTroveIds[i],) = openTroveWithExactICRAndDebt(A, i, MCR, 10_000 ether, 0.01 ether);
        }

        // drop price by 1%
        priceFeed.setPrice(priceFeed.getPrice() * 99 / 100);

        vm.recordLogs();
        for (uint256 i = 0; i < liquidateTroveIds.length; ++i) {
            emit TroveUpdated(
                liquidateTroveIds[i],
                0, // _debt
                0, // _coll
                0, // _stake
                0, // _annualInterestRate
                0, // _snapshotOfTotalDebtRedist
                0 // _snapshotOfTotalCollRedist
            );
        }
        Vm.Log[] memory expectedTroveUpdatedEvents = vm.getRecordedLogs();

        troveManager.batchLiquidateTroves(liquidateTroveIds);

        Vm.Log[] memory actualTroveUpdatedEvents = vm.getRecordedLogs().filter(TroveUpdated.selector);
        assertEqLogs(actualTroveUpdatedEvents, expectedTroveUpdatedEvents, "Wrong TroveUpdated events");
    }

    function test_BatchLiquidateTrovesEmitsTroveOperationForEachLiquidatedTrove() external {
        // open a Trove to keep TCR afloat and let us liquidate the other Troves
        openTroveHelper(B, 0, 1_000 ether, 10_000 ether, 0.01 ether);

        uint256[] memory liquidateTroveIds = new uint256[](3);
        for (uint256 i = 0; i < liquidateTroveIds.length; ++i) {
            (liquidateTroveIds[i],) = openTroveWithExactICRAndDebt(A, i, MCR, 10_000 ether, 0.01 ether);
        }

        // drop price by 1%
        priceFeed.setPrice(priceFeed.getPrice() * 99 / 100);

        vm.recordLogs();
        for (uint256 i = 0; i < liquidateTroveIds.length; ++i) {
            uint256 debt = troveManager.getTroveEntireDebt(liquidateTroveIds[i]);
            uint256 coll = troveManager.getTroveEntireColl(liquidateTroveIds[i]);

            emit TroveOperation(
                liquidateTroveIds[i],
                Operation.liquidate,
                0, // _annualInterestRate
                0, // _debtIncreaseFromRedist
                0, // _debtIncreaseFromUpfrontFee
                -int256(debt), // _debtChangeFromOperation
                0, // _collIncreaseFromRedist
                -int256(coll) // _collChangeFromOperation
            );
        }
        Vm.Log[] memory expectedTroveUpdatedEvents = vm.getRecordedLogs();

        troveManager.batchLiquidateTroves(liquidateTroveIds);

        Vm.Log[] memory actualTroveUpdatedEvents = vm.getRecordedLogs().filter(TroveOperation.selector);
        assertEqLogs(actualTroveUpdatedEvents, expectedTroveUpdatedEvents, "Wrong TroveOperation events");
    }

    function test_BatchLiquidateTrovesEmitsLiquidation() external {
        // open a Trove to keep TCR afloat and let us liquidate the other Troves
        (, uint256 otherColl) = openTroveWithExactICRAndDebt(B, 0, 10 * CCR, 100_000 ether, 0.01 ether);

        // deposit to SP less than the total liquidated debt, so we get a mix of SP offset & redistribution
        uint256 boldInSP = 25_000 ether;
        makeSPDepositNoClaim(B, boldInSP);

        uint256[3] memory liquidatedDebt;
        liquidatedDebt[0] = 10_000 ether;
        liquidatedDebt[1] = 20_000 ether;
        liquidatedDebt[2] = 30_000 ether;

        uint256[] memory liquidatedTroveIds = new uint256[](liquidatedDebt.length);
        uint256[] memory liquidatedColl = new uint256[](liquidatedDebt.length);

        for (uint256 i = 0; i < liquidatedDebt.length; ++i) {
            (liquidatedTroveIds[i], liquidatedColl[i]) =
                openTroveWithExactICRAndDebt(A, i, MCR, liquidatedDebt[i], 0.01 ether);
        }

        // drop price by 1%
        uint256 price = priceFeed.getPrice() * 99 / 100;
        priceFeed.setPrice(price);

        LiquidationParams memory t;
        for (uint256 i = 0; i < liquidatedDebt.length; ++i) {
            uint256 collRemaining = liquidatedColl[i];

            LiquidationParams memory l;
            l.debtOffsetBySP = Math.min(liquidatedDebt[i], boldInSP - t.debtOffsetBySP - 1e18);
            l.debtRedistributed = liquidatedDebt[i] - l.debtOffsetBySP;

            l.ethGasCompensation = ETH_GAS_COMPENSATION;
            uint256 collToOffset = liquidatedColl[i] * l.debtOffsetBySP / liquidatedDebt[i];
            collRemaining -= l.collGasCompensation = collToOffset / COLL_GAS_COMPENSATION_DIVISOR;

            collRemaining -= l.collSentToSP = Math.min(
                collToOffset - l.collGasCompensation,
                l.debtOffsetBySP * (DECIMAL_PRECISION + LIQUIDATION_PENALTY_SP) / price
            );

            l.collSurplus = collRemaining -= l.collRedistributed = Math.min(
                collRemaining, l.debtRedistributed * (DECIMAL_PRECISION + LIQUIDATION_PENALTY_REDISTRIBUTION) / price
            );

            t.aggregateLiquidation(l);
        }

        vm.expectEmit();
        emit Liquidation(
            t.debtOffsetBySP,
            t.debtRedistributed,
            t.ethGasCompensation,
            t.collGasCompensation,
            t.collSentToSP,
            t.collRedistributed,
            t.collSurplus,
            t.collRedistributed * DECIMAL_PRECISION / otherColl,
            t.debtRedistributed * DECIMAL_PRECISION / otherColl,
            price
        );

        troveManager.batchLiquidateTroves(liquidatedTroveIds);
    }

    function test_RedeemCollateralEmitsTroveUpdatedForEachRedeemedTrove() external {
        uint256[3] memory troveId;
        (troveId[0],) = openTroveHelper(A, 0, 100 ether, 10_000 ether, 0.01 ether);
        (troveId[1],) = openTroveHelper(A, 1, 200 ether, 20_000 ether, 0.02 ether);
        (troveId[2],) = openTroveHelper(A, 2, 300 ether, 30_000 ether, 0.03 ether);

        // Fully redeem first 2 Troves, and partially the 3rd
        uint256[3] memory redeemBold;
        redeemBold[0] = troveManager.getTroveEntireDebt(troveId[0]);
        redeemBold[1] = troveManager.getTroveEntireDebt(troveId[1]);
        redeemBold[2] = troveManager.getTroveEntireDebt(troveId[2]) / 2;

        uint256 price = priceFeed.getPrice();
        uint256 totalRedeemedBold = redeemBold[0] + redeemBold[1] + redeemBold[2];
        uint256 redemptionRate = collateralRegistry.getRedemptionRateForRedeemedAmount(totalRedeemedBold);

        vm.recordLogs();
        for (uint256 i = 0; i < 3; ++i) {
            uint256 redeemEth = redeemBold[i] * DECIMAL_PRECISION / price;
            uint256 redeemFee = redeemEth * redemptionRate / DECIMAL_PRECISION;
            uint256 debt = troveManager.getTroveEntireDebt(troveId[i]) - redeemBold[i];
            uint256 coll = troveManager.getTroveEntireColl(troveId[i]) - redeemEth + redeemFee;
            uint256 stake = coll;
            uint256 interestRate = troveManager.getTroveAnnualInterestRate(troveId[i]);

            emit TroveUpdated(
                troveId[i],
                debt,
                coll,
                stake,
                interestRate,
                0, // _snapshotOfTotalDebtRedist
                0 // _snapshotOfTotalCollRedist
            );
        }
        Vm.Log[] memory expectedTroveUpdatedEvents = vm.getRecordedLogs();

        vm.prank(A);
        collateralRegistry.redeemCollateral(totalRedeemedBold, 3, _100pct);

        Vm.Log[] memory actualTroveUpdatedEvents = vm.getRecordedLogs().filter(TroveUpdated.selector);
        assertEqLogs(actualTroveUpdatedEvents, expectedTroveUpdatedEvents, "Wrong TroveUpdated events");
    }

    function test_RedeemCollateralEmitsTroveOperationForEachRedeemedTrove() external {
        uint256[3] memory troveId;
        (troveId[0],) = openTroveHelper(A, 0, 100 ether, 10_000 ether, 0.01 ether);
        (troveId[1],) = openTroveHelper(A, 1, 200 ether, 20_000 ether, 0.02 ether);
        (troveId[2],) = openTroveHelper(A, 2, 300 ether, 30_000 ether, 0.03 ether);

        // Fully redeem first 2 Troves, and partially the 3rd
        uint256[3] memory redeemBold;
        redeemBold[0] = troveManager.getTroveEntireDebt(troveId[0]);
        redeemBold[1] = troveManager.getTroveEntireDebt(troveId[1]);
        redeemBold[2] = troveManager.getTroveEntireDebt(troveId[2]) / 2;

        uint256 price = priceFeed.getPrice();
        uint256 totalRedeemedBold = redeemBold[0] + redeemBold[1] + redeemBold[2];
        uint256 redemptionRate = collateralRegistry.getRedemptionRateForRedeemedAmount(totalRedeemedBold);

        vm.recordLogs();
        for (uint256 i = 0; i < 3; ++i) {
            uint256 redeemEth = redeemBold[i] * DECIMAL_PRECISION / price;
            uint256 redeemFee = redeemEth * redemptionRate / DECIMAL_PRECISION;
            uint256 interestRate = troveManager.getTroveAnnualInterestRate(troveId[i]);

            emit TroveOperation(
                troveId[i],
                Operation.redeemCollateral,
                interestRate,
                0, // _debtIncreaseFromRedist
                0, // _debtIncreaseFromUpfrontFee
                -int256(redeemBold[i]),
                0, // _collIncreaseFromRedist
                -int256(redeemEth - redeemFee)
            );
        }
        Vm.Log[] memory expectedTroveUpdatedEvents = vm.getRecordedLogs();

        vm.prank(A);
        collateralRegistry.redeemCollateral(totalRedeemedBold, 3, _100pct);

        Vm.Log[] memory actualTroveUpdatedEvents = vm.getRecordedLogs().filter(TroveOperation.selector);
        assertEqLogs(actualTroveUpdatedEvents, expectedTroveUpdatedEvents, "Wrong TroveOperation events");
    }
}

struct Deposit {
    uint256 recordedBold;
    uint256 stashedColl;
    uint256 pendingBoldLoss;
    uint256 pendingCollGain;
    uint256 pendingBoldYieldGain;
}

struct StabilityPoolRewardsState {
    uint256 scale;
    uint256 P;
    uint256 S;
    uint256 B;
}

contract StabilityPoolEventsTest is EventsTest, IStabilityPoolEvents {
    function makeSPDepositAndGenerateRewards()
        internal
        returns (Deposit memory deposit, StabilityPoolRewardsState memory current)
    {
        uint256 liquidatedDebt = 10_000_000_000 ether;

        openTroveWithExactICRAndDebt(A, 0, 10 * CCR, 10 * liquidatedDebt, 0.01 ether);

        uint256[3] memory liquidatedTroveId;
        (liquidatedTroveId[0],) = openTroveWithExactICRAndDebt(B, 0, MCR, liquidatedDebt, 0.01 ether);
        (liquidatedTroveId[1],) = openTroveWithExactICRAndDebt(C, 0, MCR, liquidatedDebt, 0.01 ether);
        (liquidatedTroveId[2],) = openTroveWithExactICRAndDebt(D, 0, MCR, liquidatedDebt, 0.01 ether);

        priceFeed.setPrice(priceFeed.getPrice() * 99 / 100);

        makeSPDepositNoClaim(A, liquidatedDebt);
        makeSPWithdrawalAndClaim(A, 0); // Claim yield from first troves

        // Increase scale
        makeSPDepositNoClaim(A, liquidatedDebt / 1e9); // XXX magic const
        troveManager.liquidate(liquidatedTroveId[1]);

        current.scale = stabilityPool.currentScale();
        assertEq(current.scale, 1, "Expected scale change");

        // Touch the deposit for one last time
        makeSPDepositNoClaim(A, 2 * liquidatedDebt);

        deposit.recordedBold = stabilityPool.getCompoundedBoldDeposit(A);
        assertGt(deposit.recordedBold, 0, "Recorded BOLD deposit should be > 0");

        deposit.stashedColl = stabilityPool.stashedColl(A);
        assertGt(deposit.stashedColl, 0, "Stashed Coll should be > 0");

        // Generate Coll gain (P, S)
        troveManager.liquidate(liquidatedTroveId[2]);

        current.P = stabilityPool.P();
        assertLt(current.P, stabilityPool.P_PRECISION(), "P should be < 1");

        current.S = stabilityPool.scaleToS(current.scale);
        assertGt(current.S, 0, "S should be > 0");

        deposit.pendingBoldLoss = deposit.recordedBold - stabilityPool.getCompoundedBoldDeposit(A);
        assertGt(deposit.pendingBoldLoss, 0, "Pending BOLD loss should be > 0");

        deposit.pendingCollGain = stabilityPool.getDepositorCollGain(A);
        assertGt(deposit.pendingCollGain, 0, "Pending Coll gain should be > 0");

        // Generate yield gain (B)
        vm.warp(block.timestamp + 100 days);
        openTroveWithExactICRAndDebt(E, 0, MCR, 10_000 ether, 0.01 ether); // dummy Trove to trigger interest minting

        current.B = stabilityPool.scaleToB(current.scale);
        assertGt(current.B, 0, "B should be > 0");

        deposit.pendingBoldYieldGain = stabilityPool.getDepositorYieldGain(A);
        assertGt(deposit.pendingBoldYieldGain, 0, "Pending BOLD yield gain should be > 0");
    }

    function test_ProvideToSPNoClaimEmitsDepositUpdated() external {
        (Deposit memory deposit, StabilityPoolRewardsState memory current) = makeSPDepositAndGenerateRewards();

        uint256 topUp = 20_000 ether;

        vm.expectEmit();
        emit DepositUpdated(
            A,
            deposit.recordedBold - deposit.pendingBoldLoss + deposit.pendingBoldYieldGain + topUp,
            deposit.stashedColl + deposit.pendingCollGain,
            current.P,
            current.S,
            current.B,
            current.scale
        );

        makeSPDepositNoClaim(A, topUp);
    }

    function test_ProvideToSPAndClaimEmitsDepositUpdated() external {
        (Deposit memory deposit, StabilityPoolRewardsState memory current) = makeSPDepositAndGenerateRewards();

        uint256 topUp = 20_000 ether;

        vm.expectEmit();
        emit DepositUpdated(
            A, deposit.recordedBold - deposit.pendingBoldLoss + topUp, 0, current.P, current.S, current.B, current.scale
        );

        makeSPDepositAndClaim(A, topUp);
    }

    function test_ProvideToSPNoClaimEmitsDepositOperation() external {
        (Deposit memory deposit,) = makeSPDepositAndGenerateRewards();

        uint256 topUp = 20_000 ether;

        vm.expectEmit();
        emit DepositOperation(
            A,
            Operation.provideToSP,
            deposit.pendingBoldLoss,
            int256(topUp),
            deposit.pendingBoldYieldGain,
            0, // _yieldGainClaimed
            deposit.pendingCollGain,
            0 // _ethGainClaimed
        );

        makeSPDepositNoClaim(A, topUp);
    }

    function test_ProvideToSPAndClaimEmitsDepositOperation() external {
        (Deposit memory deposit,) = makeSPDepositAndGenerateRewards();

        uint256 topUp = 20_000 ether;

        vm.expectEmit();
        emit DepositOperation(
            A,
            Operation.provideToSP,
            deposit.pendingBoldLoss,
            int256(topUp),
            deposit.pendingBoldYieldGain,
            deposit.pendingBoldYieldGain,
            deposit.pendingCollGain,
            deposit.pendingCollGain + deposit.stashedColl
        );

        makeSPDepositAndClaim(A, topUp);
    }

    function test_WithdrawFromSPNoClaimEmitsDepositUpdated() external {
        (Deposit memory deposit, StabilityPoolRewardsState memory current) = makeSPDepositAndGenerateRewards();

        uint256 withdrawal = deposit.recordedBold / 2;

        vm.expectEmit();
        emit DepositUpdated(
            A,
            deposit.recordedBold - deposit.pendingBoldLoss + deposit.pendingBoldYieldGain - withdrawal,
            deposit.stashedColl + deposit.pendingCollGain,
            current.P,
            current.S,
            current.B,
            current.scale
        );

        makeSPWithdrawalNoClaim(A, withdrawal);
    }

    function test_WithdrawFromSPAndClaimEmitsDepositUpdated() external {
        (Deposit memory deposit, StabilityPoolRewardsState memory current) = makeSPDepositAndGenerateRewards();

        uint256 withdrawal = deposit.recordedBold / 2;

        vm.expectEmit();
        emit DepositUpdated(
            A,
            deposit.recordedBold - deposit.pendingBoldLoss - withdrawal,
            0,
            current.P,
            current.S,
            current.B,
            current.scale
        );

        makeSPWithdrawalAndClaim(A, withdrawal);
    }

    function test_WithdrawFromSPNoClaimEmitsDepositOperation() external {
        (Deposit memory deposit,) = makeSPDepositAndGenerateRewards();

        uint256 withdrawal = deposit.recordedBold / 2;

        vm.expectEmit();
        emit DepositOperation(
            A,
            Operation.withdrawFromSP,
            deposit.pendingBoldLoss,
            -int256(withdrawal),
            deposit.pendingBoldYieldGain,
            0, // _yieldGainClaimed
            deposit.pendingCollGain,
            0 // _ethGainClaimed
        );

        makeSPWithdrawalNoClaim(A, withdrawal);
    }

    function test_WithdrawFromSPAndClaimEmitsDepositOperation() external {
        (Deposit memory deposit,) = makeSPDepositAndGenerateRewards();

        uint256 withdrawal = deposit.recordedBold / 2;

        vm.expectEmit();
        emit DepositOperation(
            A,
            Operation.withdrawFromSP,
            deposit.pendingBoldLoss,
            -int256(withdrawal),
            deposit.pendingBoldYieldGain,
            deposit.pendingBoldYieldGain,
            deposit.pendingCollGain,
            deposit.pendingCollGain + deposit.stashedColl
        );

        makeSPWithdrawalAndClaim(A, withdrawal);
    }

    function test_ClaimAllCollGainsEmitsDepositUpdated() external {
        (Deposit memory deposit, StabilityPoolRewardsState memory curr) = makeSPDepositAndGenerateRewards();

        uint256 stashedColl = deposit.stashedColl + deposit.pendingCollGain;

        // B deposits so A can fully claim
        makeSPDepositNoClaim(B, 1e18);

        vm.expectEmit();
        emit DepositUpdated(A, deposit.pendingBoldYieldGain, stashedColl, curr.P, curr.S, curr.B, curr.scale);
        makeSPWithdrawalNoClaim(A, deposit.recordedBold - deposit.pendingBoldLoss); // can't withdraw pending yield

        vm.expectEmit();
        emit DepositUpdated(A, 0, stashedColl, 0, 0, 0, 0);
        makeSPWithdrawalNoClaim(A, deposit.pendingBoldYieldGain); // now we can withdraw previously pending yield

        // Now we have a deposit with stashed Coll gains and nothing else

        vm.expectEmit();
        emit DepositUpdated(A, 0, 0, 0, 0, 0, 0);
        claimAllCollGains(A);
    }

    function test_ClaimAllCollGainsEmitsDepositOperation() external {
        (Deposit memory deposit,) = makeSPDepositAndGenerateRewards();

        uint256 stashedColl = deposit.stashedColl + deposit.pendingCollGain;

        // B deposits so A can fully claim
        makeSPDepositNoClaim(B, 1e18);

        makeSPWithdrawalNoClaim(A, deposit.recordedBold - deposit.pendingBoldLoss); // can't withdraw pending yield
        makeSPWithdrawalNoClaim(A, deposit.pendingBoldYieldGain); // now we can withdraw previously pending yield

        // Now we have a deposit with stashed Coll gains and nothing else

        vm.expectEmit();
        emit DepositOperation(A, Operation.claimAllCollGains, 0, 0, 0, 0, 0, stashedColl);
        claimAllCollGains(A);
    }
}
