// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";
import {mulDivCeil} from "./Utils/Math.sol";

contract StabilityScalingTest is DevTestSetup {
    address liquidityStrategy;

    function setUp() override public {
      super.setUp();
      liquidityStrategy = addressesRegistry.liquidityStrategy();
      deal(address(collToken), liquidityStrategy, 1e60);
      vm.prank(liquidityStrategy);
      collToken.approve(address(stabilityPool), type(uint256).max);
    }

    function _setupStabilityPool(uint256 magnitude) internal {
      uint256 amount = 1e18 * 10 ** magnitude;
      deal(address(boldToken), A, amount);
      deal(address(boldToken), B, amount);
      deal(address(boldToken), C, amount);
      makeSPDepositAndClaim(A, amount);
      makeSPDepositAndClaim(B, amount);
      makeSPDepositAndClaim(C, amount);
    }

    function _topUpStabilityPoolBold(uint256 amount) internal {
      deal(address(boldToken), D, amount);
      makeSPDepositAndClaim(D, amount);
    }

    function testStabilityScaling_canScaleALot() public {
      _setupStabilityPool(13);

      for (uint256 i = 0; i < 5000; ++i) {
        uint256 spBalance = boldToken.balanceOf(address(stabilityPool));
        uint256 boldOut = spBalance / 2;
        uint256 collIn = boldOut / 2000;
        vm.prank(liquidityStrategy);
        stabilityPool.swapCollateralForStable(collIn, boldOut);
        _topUpStabilityPoolBold(boldOut);
      }

      assertEq(stabilityPool.currentScale(), 167);
    }
}
