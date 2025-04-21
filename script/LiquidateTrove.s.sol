// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {IAddressesRegistry} from "src/Interfaces/IAddressesRegistry.sol";
import {ICollateralRegistry} from "src/Interfaces/ICollateralRegistry.sol";
import {LatestTroveData} from "src/Types/LatestTroveData.sol";
import {ITroveManager} from "src/Interfaces/ITroveManager.sol";
import {IPriceFeedTestnet} from "test/TestContracts/Interfaces/IPriceFeedTestnet.sol";

contract LiquidateTrove is Script {
    using Strings for uint256;

    function run() external {
        vm.startBroadcast();

        IAddressesRegistry addressesRegistry;
        try vm.envAddress("ADDRESSES_REGISTRY") returns (address value) {
            addressesRegistry = IAddressesRegistry(value);
        } catch {
            uint256 i = vm.envUint("BRANCH");
            string memory manifestJson = vm.readFile("deployment-manifest.json");
            addressesRegistry = IAddressesRegistry(
                vm.parseJsonAddress(manifestJson, string.concat(".branches[", i.toString(), "].addressesRegistry"))
            );
        }
        vm.label(address(addressesRegistry), "AddressesRegistry");

        ITroveManager troveManager = addressesRegistry.troveManager();
        vm.label(address(troveManager), "TroveManager");
        IPriceFeedTestnet priceFeed = IPriceFeedTestnet(address(addressesRegistry.priceFeed()));
        vm.label(address(priceFeed), "PriceFeedTestnet");

        uint256 troveId = vm.envUint("TROVE_ID");
        LatestTroveData memory trove = troveManager.getLatestTroveData(troveId);

        uint256 originalPrice = priceFeed.getPrice();
        uint256 liquidationPrice = (addressesRegistry.MCR() - 0.01 ether) * trove.entireDebt / trove.entireColl;
        priceFeed.setPrice(liquidationPrice);

        uint256[] memory troveIds = new uint256[](1);
        troveIds[0] = troveId;
        troveManager.batchLiquidateTroves(troveIds);

        priceFeed.setPrice(originalPrice);
    }
}
