// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {GasCompZapper} from "src/Zappers/GasCompZapper.sol";
import {IAddressesRegistry} from "src/Interfaces/IAddressesRegistry.sol";
import {ICollateralRegistry} from "src/Interfaces/ICollateralRegistry.sol";
import {ITroveManager} from "src/Interfaces/ITroveManager.sol";
import {IERC20Metadata} from "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IFlashLoanProvider} from "src/Zappers/Interfaces/IFlashLoanProvider.sol";
import {IExchange} from "src/Zappers/Interfaces/IExchange.sol";
import {StringEquality} from "test/Utils/StringEquality.sol";

contract RedeployGasCompZapper is Script {
    using Strings for uint256;
    using StringEquality for string;

    address constant COLLATERAL_REGISTRY = 0xF39bdCfB55374dDb0948a28af00b6474A566Ac22;

    struct DeploymentInfo {
        uint256 branchIndex;
        string collSymbol;
        address newGasCompZapper;
    }

    function run() external {
        vm.startBroadcast();

        // Use CollateralRegistry constant
        ICollateralRegistry collateralRegistry = ICollateralRegistry(COLLATERAL_REGISTRY);
        uint256 numBranches = collateralRegistry.totalCollaterals();

        console.log("Found", numBranches, "branches");
        console.log("");

        // Array to store deployment info for summary
        DeploymentInfo[] memory deployments = new DeploymentInfo[](numBranches);
        uint256 deploymentCount = 0;

        // Iterate through each branch/collateral
        for (uint256 i = 0; i < numBranches; ++i) {
            // Get collateral token from registry
            IERC20Metadata collToken = IERC20Metadata(collateralRegistry.getToken(i));
            string memory collSymbol = collToken.symbol();

            console.log("Branch", i, "- Collateral:", collSymbol);
            console.log("  CollToken:", address(collToken));

            // Skip wrapped tokens (SAGA and stATOM get WrappedTokenZapper, not GasCompZapper)
            if (collSymbol.eq("SAGA") || collSymbol.eq("stATOM")) {
                console.log("  Skipping wrapped token collateral");
                console.log("");
                continue;
            }

            // Get addresses registry from TroveManager
            ITroveManager troveManager = collateralRegistry.getTroveManager(i);
            IAddressesRegistry addressesRegistry = troveManager.addressesRegistry();

            console.log("  AddressesRegistry:", address(addressesRegistry));

            // Deploy new GasCompZapper with address(0) for flashLoanProvider and exchange
            // (as per the deployment script pattern)
            GasCompZapper newGasCompZapper = new GasCompZapper(
                addressesRegistry,
                IFlashLoanProvider(address(0)),
                IExchange(address(0))
            );

            console.log("  New GasCompZapper:", address(newGasCompZapper));
            console.log("");

            // Store deployment info for summary
            deployments[deploymentCount] = DeploymentInfo({
                branchIndex: i,
                collSymbol: collSymbol,
                newGasCompZapper: address(newGasCompZapper)
            });
            deploymentCount++;
        }

        vm.stopBroadcast();

        // Print summary at the end
        console.log("");
        console.log("========================================");
        console.log("Deployment Summary");
        console.log("========================================");
        console.log("");

        for (uint256 i = 0; i < deploymentCount; ++i) {
            console.log("Branch", deployments[i].branchIndex, "-", deployments[i].collSymbol);
            console.log("  GasCompZapper:", deployments[i].newGasCompZapper);
            console.log("");
        }

        console.log("Total deployed:", deploymentCount, "GasCompZapper contracts");
    }
}

