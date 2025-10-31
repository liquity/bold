// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {console} from "forge-std/console.sol";
import {Script} from "forge-std/Script.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {IAddressesRegistry} from "../src/Interfaces/IAddressesRegistry.sol";
import {RedemptionHelper} from "../src/RedemptionHelper.sol";
import {UseDeployment} from "../test/Utils/UseDeployment.sol";

contract DeployRedemptionHelper is Script, UseDeployment {
    using Strings for *;

    function run() external {
        if (block.chainid != 1 && block.chainid != 11155111) {
            revert("Unsupported chain");
        }

        _loadDeploymentFromManifest(string.concat("addresses/", block.chainid.toString(), ".json"));

        IAddressesRegistry[] memory addresses = new IAddressesRegistry[](branches.length);
        for (uint256 i = 0; i < branches.length; ++i) {
            addresses[i] = branches[i].addressesRegistry;
        }

        vm.startBroadcast();
        RedemptionHelper redemptionHelper =
            new RedemptionHelper({_collateralRegistry: collateralRegistry, _addresses: addresses});

        console.log("redemptionHelper:", address(redemptionHelper));
    }
}
