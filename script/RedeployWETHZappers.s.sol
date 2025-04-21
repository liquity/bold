// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {BaseZapper} from "src/Zappers/BaseZapper.sol";
import {WETHZapper} from "src/Zappers/WETHZapper.sol";
import {LeverageWETHZapper} from "src/Zappers/LeverageWETHZapper.sol";
import {UseDeployment} from "test/Utils/UseDeployment.sol";
import {StringEquality} from "test/Utils/StringEquality.sol";

contract RedeployWETHZappers is Script, UseDeployment {
    using StringEquality for string;

    function run() external {
        vm.startBroadcast();
        _loadDeploymentFromManifest("addresses/1.json");

        BranchContracts storage wethBranch = branches[0];
        require(wethBranch.collToken.symbol().eq("WETH"), "Wrong branch");

        BaseZapper oldWETHZapper = BaseZapper(address(wethBranch.zapper));
        BaseZapper oldLeverageWETHZapper = BaseZapper(address(wethBranch.leverageZapper));

        WETHZapper newWETHZapper = new WETHZapper({
            _addressesRegistry: wethBranch.addressesRegistry,
            _flashLoanProvider: oldWETHZapper.flashLoanProvider(),
            _exchange: oldWETHZapper.exchange()
        });

        LeverageWETHZapper newLeverageWETHZapper = new LeverageWETHZapper({
            _addressesRegistry: wethBranch.addressesRegistry,
            _flashLoanProvider: oldLeverageWETHZapper.flashLoanProvider(),
            _exchange: oldLeverageWETHZapper.exchange()
        });

        console.log("newWETHZapper:        ", address(newWETHZapper));
        console.log("newLeverageWETHZapper:", address(newLeverageWETHZapper));
    }
}
