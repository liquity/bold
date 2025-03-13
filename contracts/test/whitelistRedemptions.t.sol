// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/WhitelistTestSetup.sol";
import {Redemptions} from "./redemptions.t.sol";

contract WhitelistedRedemptions is Redemptions, WhitelistTestSetup {
    address[5] whitelistedUsers;
    address nonWhitelistedUser;

    function setUp() public override {
        super.setUp();
        
        // set internal owner
        _setOwner(address(deployer));

        // add whitelist to the branch
        _deployAndSetWhitelist(addressesRegistry);
        
        // whitelist users
        whitelistedUsers = [A, B, C, D, E];             
        for(uint8 i=0; i<5; i++){
            _addToWhitelist(whitelistedUsers[i]);
        }

        // set a non whitelisted address
        nonWhitelistedUser = address(123);

    }

    // a not whitelisted user try redeeming from a branch with whitelist
    // all branch troves are skipped and remain untouched 
    // redeemer bold balance is not burned
    function test_NonWhitelistedRedemption() public {
        (uint256 coll,, ABCDEF memory troveIDs) = _setupForRedemptionAscendingInterest();

        uint256 debt_A = troveManager.getTroveEntireDebt(troveIDs.A);
        uint256 coll_A = troveManager.getTroveEntireColl(troveIDs.A);

        uint256 debt_B = troveManager.getTroveEntireDebt(troveIDs.B);
        uint256 coll_B = troveManager.getTroveEntireColl(troveIDs.B);

        uint256 debt_C = troveManager.getTroveEntireDebt(troveIDs.C);
        uint256 coll_C = troveManager.getTroveEntireColl(troveIDs.C);

        uint256 debt_D = troveManager.getTroveEntireDebt(troveIDs.D);
        uint256 coll_D = troveManager.getTroveEntireColl(troveIDs.D);

        uint256 branchDebt = troveManager.getEntireBranchDebt();
        uint256 branchColl = troveManager.getEntireBranchColl();

        uint256 redeemerBoldBalance = boldToken.balanceOf(nonWhitelistedUser);

        // nonWhitelistedUser tries to redeem but doesn't get anyting out
        uint256 redeemAmount = debt_A + debt_B + debt_C + debt_D;
        redeem(nonWhitelistedUser, redeemAmount);

        // Check Trove A debt and coll unchanged
        assertEq(troveManager.getTroveEntireDebt(troveIDs.A), debt_A);
        assertEq(troveManager.getTroveEntireColl(troveIDs.A), coll_A);

        // Check Trove B debt and coll unchanged
        assertEq(troveManager.getTroveEntireDebt(troveIDs.B), debt_B);
        assertEq(troveManager.getTroveEntireColl(troveIDs.B), coll_B);

        // Check Trove C debt and coll unchanged
        assertEq(troveManager.getTroveEntireDebt(troveIDs.C), debt_C);
        assertEq(troveManager.getTroveEntireColl(troveIDs.C), coll_C);

        // Check Trove C debt and coll unchanged
        assertEq(troveManager.getTroveEntireDebt(troveIDs.D), debt_D);
        assertEq(troveManager.getTroveEntireColl(troveIDs.D), coll_D);

        // Check branch level debt and coll unchanged
        assertEq(troveManager.getEntireBranchDebt(), branchDebt);
        assertEq(troveManager.getEntireBranchColl(), branchColl);

        // redeemer balance unchanged (no burn)
        assertEq(boldToken.balanceOf(nonWhitelistedUser), redeemerBoldBalance);
    }
}
