// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import "test/Utils/Logging.sol";
import "src/Zappers/WrappedTokenZapper.sol";
import "src/Zappers/CollateralZapper.sol";
import "src/Dependencies/TokenWrapper.sol";
import "forge-std/Script.sol";

contract DeployWrappedTokenZapper is Logging, Script { 
    // modify 
    IAddressesRegistry addressesRegistry = IAddressesRegistry(0xa5A4e62E16C71E9bb6EF785ab242669B98173c0F);
    ITokenWrapper tokenWrapper = ITokenWrapper(0xF329F1BF880760bE580f0422475f8d101cb29Ad6);
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
    IAddressesRegistry addressesRegistry = IAddressesRegistry(0xC3A86dAE98Ef5D92E872cb02b1B85D5D4917eB1b);
    IERC20 collateralToken = IERC20(0x2170Ed0880ac9A755fd29B2688956BD959F933F8);
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
