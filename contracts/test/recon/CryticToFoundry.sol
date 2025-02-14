// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {TargetFunctions} from "./TargetFunctions.sol";
import {FoundryAsserts} from "@chimera/FoundryAsserts.sol";
import "forge-std/console2.sol";

// forge test --match-contract CryticToFoundry -vv
contract CryticToFoundry is Test, TargetFunctions, FoundryAsserts {
    function setUp() public {
        setup();
    }

    // forge test --match-test test_crytic -vvv
    function test_crytic() public {
        // TODO: add failing property tests here for debugging
        borrowerOperations_openTrove(address(this), 123, 100e18, 2000e18, 0, 0, 1e18, 100e18, address(this), address(this), address(this));
        borrowerOperations_openTrove(address(this), 13232, 100e18, 2000e18, 0, 0, 1e18, 100e18, address(this), address(this), address(this));
        borrowerOperations_adjustTrove_clamped(123, true, 0, true, 0);
        priceFeed_setPrice(1);
        troveManager_liquidate_clamped();
    }
}
