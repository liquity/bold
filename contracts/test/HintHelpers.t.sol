// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";

contract HintHelpersTest is DevTestSetup {
    function test_GetApproxHintNeverReturnsZombies(uint256 seed) external {
        for (uint256 i = 1; i <= 10; ++i) {
            openTroveHelper(A, i, 100 ether, 10_000 ether, i * 0.01 ether);
        }

        uint256 redeemedTroveId = sortedTroves.getLast();
        uint256 redeemable = troveManager.getTroveEntireDebt(redeemedTroveId);

        redeem(A, redeemable);

        assertEq(
            uint8(troveManager.getTroveStatus(redeemedTroveId)),
            uint8(ITroveManager.Status.zombie),
            "Redeemed Trove should have become a zombie"
        );

        // Choose an interest rate very close to the redeemed Trove's
        uint256 interestRate = troveManager.getTroveAnnualInterestRate(redeemedTroveId) + 1;

        (uint256 hintId,,) = hintHelpers.getApproxHint(0, interestRate, 10, seed);
        assertNotEq(hintId, redeemedTroveId, "Zombies should not be hints");
    }
}
