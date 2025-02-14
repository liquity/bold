
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseTargetFunctions} from "@chimera/BaseTargetFunctions.sol";
import {vm} from "@chimera/Hevm.sol";
import "forge-std/console2.sol";

import {ActivePoolTargets} from "./targets/ActivePoolTargets.sol";
import {BorrowerOperationsTargets} from "./targets/BorrowerOperationsTargets.sol";
import {CollateralRegistryTargets} from "./targets/CollateralRegistryTargets.sol";
import {CollTokenTargets} from "./targets/CollTokenTargets.sol";
import {ManagersTargets} from "./targets/ManagersTargets.sol";
import {PriceFeedTargets} from "./targets/PriceFeedTargets.sol";
import {StabilityPoolTargets} from "./targets/StabilityPoolTargets.sol";
import {TroveManagerTargets} from "./targets/TroveManagerTargets.sol";

abstract contract TargetFunctions is 
    ActivePoolTargets,
    BorrowerOperationsTargets,
    CollateralRegistryTargets,
    CollTokenTargets,
    ManagersTargets,
    PriceFeedTargets,
    StabilityPoolTargets,
    TroveManagerTargets

 {

    function canary_liquidation() public {
        t(!hasDoneLiquidation, "canary_liquidation");
    }
    function canary_redemption() public {
        t(!hasDoneRedemption, "canary_redemption");
    }

}