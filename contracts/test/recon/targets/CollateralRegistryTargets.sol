
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseTargetFunctions} from "@chimera/BaseTargetFunctions.sol";
import {vm} from "@chimera/Hevm.sol";
import "forge-std/console2.sol";

import {Properties} from "../Properties.sol";

abstract contract CollateralRegistryTargets is BaseTargetFunctions, Properties  {
    function collateralRegistry_redeemCollateral(uint256 _boldAmount, uint256 _maxIterationsPerCollateral, uint256 _maxFeePercentage) public asActor {
        collateralRegistry.redeemCollateral(_boldAmount, _maxIterationsPerCollateral, _maxFeePercentage);
        hasDoneRedemption = true;
    }

    function collateralRegistry_redeemCollateral_clamped(uint256 _boldAmount) public {
        _boldAmount = _boldAmount % (boldToken.balanceOf(_getActor()) + 1);
        collateralRegistry_redeemCollateral(_boldAmount, 100, 1e18); // DECIMAL_PRECISION = 1e18
    }
}