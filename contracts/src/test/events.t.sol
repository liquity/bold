// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";
import {mulDivCeil} from "./Utils/math.sol";

contract TroveEventsTest is DevTestSetup, ITroveEvents {
    function test_OpenTroveEmitsTroveUpdated() external {
        address owner = A;
        uint256 ownerIndex = 0;
        uint256 coll = 100 ether;
        uint256 borrow = 10_000 ether;
        uint256 interestRate = 0.01 ether;

        uint256 troveId = predictTroveId(owner, ownerIndex);
        uint256 upfrontFee = predictOpenTroveUpfrontFee(borrow, interestRate);
        uint256 debt = borrow + BOLD_GAS_COMP + upfrontFee;

        vm.expectEmit();
        emit TroveUpdated(troveId, debt, coll, Operation.openTrove);

        vm.prank(owner);
        borrowerOperations.openTrove(owner, ownerIndex, coll, borrow, 0, 0, interestRate, upfrontFee);
    }

    function test_AdjustTroveEmitsTroveUpdated() external {
        (uint256 troveId,) = openTroveHelper(A, 0, 100 ether, 10_000 ether, 0.01 ether);

        uint256 deposit = 10 ether;
        uint256 borrow = 1_000 ether;

        uint256 upfrontFee = predictAdjustTroveUpfrontFee(troveId, borrow);
        uint256 coll = troveManager.getTroveEntireColl(troveId) + deposit;
        uint256 debt = troveManager.getTroveEntireDebt(troveId) + borrow + upfrontFee;

        vm.expectEmit();
        emit TroveUpdated(troveId, debt, coll, Operation.adjustTrove);

        vm.prank(A);
        borrowerOperations.adjustTrove(troveId, deposit, true, borrow, true, upfrontFee);
    }

    function test_AdjustTroveInterestRateEmitsTroveUpdated() external {
        (uint256 troveId,) = openTroveHelper(A, 0, 100 ether, 10_000 ether, 0.01 ether);

        vm.warp(block.timestamp + INTEREST_RATE_ADJ_COOLDOWN);

        uint256 coll = troveManager.getTroveEntireColl(troveId);
        uint256 debt = troveManager.getTroveEntireDebt(troveId);

        vm.expectEmit();
        emit TroveUpdated(troveId, debt, coll, Operation.adjustTroveInterestRate);

        vm.prank(A);
        borrowerOperations.adjustTroveInterestRate(troveId, 0.02 ether, 0, 0, 0);
    }

    function test_ApplyTroveInterestPermissionlessEmitsTroveUpdated() external {
        (uint256 troveId,) = openTroveHelper(A, 0, 100 ether, 10_000 ether, 0.01 ether);

        vm.warp(block.timestamp + STALE_TROVE_DURATION + 1);

        uint256 coll = troveManager.getTroveEntireColl(troveId);
        uint256 debt = troveManager.getTroveEntireDebt(troveId);

        vm.expectEmit();
        emit TroveUpdated(troveId, debt, coll, Operation.applyTroveInterestPermissionless);

        vm.prank(A);
        borrowerOperations.applyTroveInterestPermissionless(troveId);
    }

    function test_CloseTroveEmitsTroveUpdated() external {
        (uint256 troveId,) = openTroveHelper(A, 0, 100 ether, 10_000 ether, 0.01 ether);

        // one more Trove so we're allowed to close the 1st one
        openTroveHelper(B, 0, 100 ether, 10_000 ether, 0.01 ether);

        uint256 debt = troveManager.getTroveEntireDebt(troveId);
        uint256 balance = boldToken.balanceOf(A);
        assertGe(debt, balance, "expected debt >= balance");

        // B helps A close their Trove
        vm.prank(B);
        boldToken.transfer(A, debt - balance);

        vm.expectEmit();
        emit TroveUpdated(troveId, 0, 0, Operation.closeTrove);

        vm.prank(A);
        borrowerOperations.closeTrove(troveId);
    }

    function test_LiquidateEmitsTroveUpdated() external {
        // open a Trove to keep TCR afloat and let us liquidate the 2nd one
        openTroveHelper(B, 0, 100 ether, 10_000 ether, 0.01 ether);

        uint256 debt = 10_000 ether;
        uint256 interestRate = 0.01 ether;

        uint256 price = priceFeed.getPrice();
        uint256 coll = mulDivCeil(debt, MCR, price);
        (uint256 borrow, uint256 upfrontFee) = findAmountToBorrowWithOpenTrove(debt, interestRate);

        vm.prank(A);
        uint256 troveId = borrowerOperations.openTrove(A, 0, coll, borrow, 0, 0, interestRate, upfrontFee);

        priceFeed.setPrice(price * 99 / 100); // drop by 1%

        vm.expectEmit();
        emit TroveUpdated(troveId, 0, 0, Operation.liquidate);

        troveManager.liquidate(troveId);
    }

    function test_RedeemCollateralEmitsTroveUpdated() external {
        (uint256 troveId,) = openTroveHelper(A, 0, 100 ether, 10_000 ether, 0.01 ether);

        uint256 redeemBold = 1_000 ether;

        uint256 price = priceFeed.getPrice();
        uint256 redeemEth = redeemBold * DECIMAL_PRECISION / price;
        uint256 redeemFee = collateralRegistry.getEffectiveRedemptionFee(redeemBold, price);
        uint256 coll = troveManager.getTroveEntireColl(troveId) - redeemEth + redeemFee;
        uint256 debt = troveManager.getTroveEntireDebt(troveId) - redeemBold;

        vm.expectEmit();
        emit TroveUpdated(troveId, debt, coll, Operation.redeemCollateral);

        vm.prank(A);
        collateralRegistry.redeemCollateral(redeemBold, 1, _100pct);
    }
}
