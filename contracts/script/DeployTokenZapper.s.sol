// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import "test/Utils/Logging.sol";
import "src/Zappers/WrappedTokenZapper.sol";
import "src/Zappers/CollateralZapper.sol";
import "src/Dependencies/TokenWrapper.sol";
import "forge-std/Script.sol";

contract DeployWrappedTokenZapper is Logging, Script { 
    // modify 
    IAddressesRegistry addressesRegistry = IAddressesRegistry(address(0));
    ITokenWrapper tokenWrapper = ITokenWrapper(address(0));
    address deployer;

    function run() external {
        if (vm.envBytes("DEPLOYER").length == 20) {
            // address
            deployer = vm.envAddress("DEPLOYER");
            vm.startBroadcast(deployer);
        } else {
            // private key
            uint256 privateKey = vm.envUint("DEPLOYER");
            deployer = vm.addr(privateKey);
            vm.startBroadcast(privateKey);
        }

        console.log("Deployer:               ", deployer);

        WrappedTokenZapper zapper = new WrappedTokenZapper(addressesRegistry, tokenWrapper);
        
        console.log("DEPLOYED Wrapped collateral ZAPPER", address(zapper));
        
        vm.stopBroadcast();
    }
}

contract DeployCollateralZapper is Logging, Script { 
    // modify 
    IAddressesRegistry addressesRegistry = IAddressesRegistry(address(0));
    IERC20 collateralToken = IERC20(address(0));
    address deployer;

    function run() external {
        if (vm.envBytes("DEPLOYER").length == 20) {
            // address
            deployer = vm.envAddress("DEPLOYER");
            vm.startBroadcast(deployer);
        } else {
            // private key
            uint256 privateKey = vm.envUint("DEPLOYER");
            deployer = vm.addr(privateKey);
            vm.startBroadcast(privateKey);
        }

        console.log("Deployer:               ", deployer);

        CollateralZapper zapper = new CollateralZapper(addressesRegistry, collateralToken);
        
        console.log("DEPLOYED collateral ZAPPER", address(zapper));
        
        vm.stopBroadcast();
    }
}
