// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/WhitelistTestSetup.sol";
import {MulticollateralTest} from "./multicollateral.t.sol";

contract MultiCollateralWhitelistedRedemptions is MulticollateralTest, WhitelistTestSetup {
    address[5] whitelistedUsers;
    address nonWhitelistedUser;

    function setUp() public override(MulticollateralTest, DevTestSetup) {
        super.setUp();

        // set internal owner
        _setOwner(address(deployer));

        // add whitelist to one of the branches
        _deployAndSetWhitelist(contractsArray[0].addressesRegistry);

        // whitelist all users involved in base tests
        whitelistedUsers = [A, B, C, D, E];
        for (uint8 i = 0; i < 5; i++) {
            _addToWhitelist(address(contractsArray[0].borrowerOperations), whitelistedUsers[i]);
            _addToWhitelist(address(contractsArray[0].stabilityPool), whitelistedUsers[i]);
            _addToWhitelist(address(contractsArray[0].troveManager), whitelistedUsers[i]);
        }

        // set a non whitelisted address
        nonWhitelistedUser = address(123);
    }

    // a not whitelisted user try redeeming from a branch with whitelist
    // all whitelisted branch troves are skipped and remain untouched
    // redeemer can redeem only non whitelisted branches
    function test_multiCollateralRedemption_Whitelist() public {
        TestValues memory testValues1;
        TestValues memory testValues2;
        TestValues memory testValues3;
        TestValues memory testValues4;

        uint256 redeemAmount = 1600e18;

        // First collateral unbacked Bold: 10k (SP empty) - but whitelisted
        testValues1.troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 10e18, 10000e18, 5e16);

        // Second collateral unbacked Bold: 5k
        testValues2.troveId = openMulticollateralTroveNoHints100pctWithIndex(1, A, 0, 100e18, 10000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(1, A, 5000e18);

        // Third collateral unbacked Bold: 1k
        testValues3.troveId = openMulticollateralTroveNoHints100pctWithIndex(2, A, 0, 10e18, 10000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(2, A, 9000e18);

        // Fourth collateral unbacked Bold: 0
        testValues4.troveId = openMulticollateralTroveNoHints100pctWithIndex(3, A, 0, 10e18, 10000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(3, A, 10000e18);

        // let time go by to reduce redemption rate (/16)
        vm.warp(block.timestamp + 1 days);

        // initial balances
        testValues1.collInitialBalance = contractsArray[0].collToken.balanceOf(nonWhitelistedUser);
        testValues2.collInitialBalance = contractsArray[1].collToken.balanceOf(nonWhitelistedUser);
        testValues3.collInitialBalance = contractsArray[2].collToken.balanceOf(nonWhitelistedUser);
        testValues4.collInitialBalance = contractsArray[3].collToken.balanceOf(nonWhitelistedUser);

        testValues1.price = contractsArray[0].priceFeed.getPrice();
        testValues2.price = contractsArray[1].priceFeed.getPrice();
        testValues3.price = contractsArray[2].priceFeed.getPrice();
        testValues4.price = contractsArray[3].priceFeed.getPrice();

        testValues1.unbackedPortion = contractsArray[0].troveManager.getTroveEntireDebt(testValues1.troveId);
        testValues2.unbackedPortion = contractsArray[1].troveManager.getTroveEntireDebt(testValues2.troveId) - 5000e18;
        testValues3.unbackedPortion = contractsArray[2].troveManager.getTroveEntireDebt(testValues3.troveId) - 9000e18;
        testValues4.unbackedPortion = contractsArray[3].troveManager.getTroveEntireDebt(testValues4.troveId) - 10000e18;

        // branch 1 is not counted as it's skipped
        uint256 totalUnbacked = testValues2.unbackedPortion + testValues3.unbackedPortion + testValues4.unbackedPortion;

        // testValues1.redeemAmount = redeemAmount * testValues1.unbackedPortion / totalUnbacked; // whitelisted branch
        testValues2.redeemAmount = redeemAmount * testValues2.unbackedPortion / totalUnbacked;
        testValues3.redeemAmount = redeemAmount * testValues3.unbackedPortion / totalUnbacked;
        testValues4.redeemAmount = redeemAmount * testValues4.unbackedPortion / totalUnbacked;

        // fees
        uint256 fee = collateralRegistry.getEffectiveRedemptionFeeInBold(redeemAmount);
        // testValues1.fee = fee * testValues1.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues1.price;
        testValues2.fee = fee * testValues2.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues2.price;
        testValues3.fee = fee * testValues3.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues3.price;
        testValues4.fee = fee * testValues4.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues4.price;

        // Check redemption rate
        assertApproxEqAbs(
            collateralRegistry.getRedemptionFeeWithDecay(redeemAmount),
            redeemAmount * (INITIAL_BASE_RATE / 16 + REDEMPTION_FEE_FLOOR) / DECIMAL_PRECISION,
            1e7,
            "Wrong redemption fee with decay"
        );

        // Transfer bold from A to nonWhitelistedUser for redemption
        vm.prank(A);
        boldToken.transfer(nonWhitelistedUser, 16000e18);
        assertEq(boldToken.balanceOf(nonWhitelistedUser), 16000e18, "Wrong Bold balance before redemption");

        uint256 initialBoldSupply = boldToken.totalSupply();

        // nonWhitelisted user redeems 1.6k
        redeem(nonWhitelistedUser, redeemAmount);

        // Check redemption rate
        assertApproxEqAbs(
            collateralRegistry.getRedemptionRate(),
            INITIAL_BASE_RATE / 16 + REDEMPTION_FEE_FLOOR + redeemAmount * DECIMAL_PRECISION / initialBoldSupply,
            1e5,
            "Wrong redemption rate"
        );

        // Check bold balance
        assertApproxEqAbs(boldToken.balanceOf(nonWhitelistedUser), 14400e18, 10, "Wrong Bold balance after redemption");

        // Check collateral balances
        // final balances
        testValues1.collFinalBalance = contractsArray[0].collToken.balanceOf(nonWhitelistedUser);
        testValues2.collFinalBalance = contractsArray[1].collToken.balanceOf(nonWhitelistedUser);
        testValues3.collFinalBalance = contractsArray[2].collToken.balanceOf(nonWhitelistedUser);
        testValues4.collFinalBalance = contractsArray[3].collToken.balanceOf(nonWhitelistedUser);

        // first branch was not redeemed
        assertApproxEqAbs(testValues1.collFinalBalance, testValues1.collInitialBalance, 1, "Wrong Collateral 1 balance");
        assertApproxEqAbs(
            testValues2.collFinalBalance - testValues2.collInitialBalance,
            testValues2.redeemAmount * DECIMAL_PRECISION / testValues2.price - testValues2.fee,
            1e14,
            "Wrong Collateral 2 balance"
        );
        assertApproxEqAbs(
            testValues3.collFinalBalance - testValues3.collInitialBalance,
            testValues3.redeemAmount * DECIMAL_PRECISION / testValues3.price - testValues3.fee,
            1e13,
            "Wrong Collateral 3 balance"
        );
        assertApproxEqAbs(
            testValues4.collFinalBalance - testValues4.collInitialBalance,
            testValues4.redeemAmount * DECIMAL_PRECISION / testValues4.price - testValues4.fee,
            1e11,
            "Wrong Collateral 4 balance"
        );
    }
}
