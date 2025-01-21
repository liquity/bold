// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {UseDeployment} from "test/Utils/UseDeployment.sol";

contract ProvideCurveLiquidity is Script, UseDeployment {
    function run() external {
        vm.startBroadcast();
        _loadDeploymentFromManifest("deployment-manifest.json");

        uint256 boldAmount = 200_000 ether;
        uint256 usdcAmount = boldAmount * 10 ** usdc.decimals() / 10 ** boldToken.decimals();

        uint256[] memory amounts = new uint256[](2);
        (amounts[0], amounts[1]) = curveUsdcBold.coins(0) == BOLD ? (boldAmount, usdcAmount) : (usdcAmount, boldAmount);

        boldToken.approve(address(curveUsdcBold), boldAmount);
        usdc.approve(address(curveUsdcBold), usdcAmount);
        curveUsdcBold.add_liquidity(amounts, 0);
    }
}
