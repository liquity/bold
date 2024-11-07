// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {ICollateralRegistry} from "../Interfaces/ICollateralRegistry.sol";
import {ITroveManager} from "../Interfaces/ITroveManager.sol";

contract LiquidateTrove is Script {
    function run() external {
        vm.startBroadcast();

        string memory manifestJson;
        try vm.readFile("deployment-manifest.json") returns (string memory content) {
            manifestJson = content;
        } catch {}

        ICollateralRegistry collateralRegistry;
        try vm.envAddress("COLLATERAL_REGISTRY") returns (address value) {
            collateralRegistry = ICollateralRegistry(value);
        } catch {
            collateralRegistry = ICollateralRegistry(vm.parseJsonAddress(manifestJson, ".collateralRegistry"));
        }
        vm.label(address(collateralRegistry), "CollateralRegistry");

        uint256 i = vm.envUint("BRANCH");
        ITroveManager troveManager = ITroveManager(collateralRegistry.getTroveManager(i));
        vm.label(address(troveManager), "TroveManager");

        uint256[] memory troveIds = new uint256[](1);
        troveIds[0] = vm.envUint("TROVE_ID");
        troveManager.batchLiquidateTroves(troveIds);
    }
}
