// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {DeployGovernance} from "./DeployGovernance.s.sol";

import {ERC20Faucet} from "../test/TestContracts/ERC20Faucet.sol";

import "forge-std/console2.sol";

contract DeployOnlyGovernance is DeployGovernance {
    ERC20Faucet constant boldToken = ERC20Faucet(0x0E18B884eC3095F7C27bbbeB0a266a5674BCAffd);
    ERC20Faucet constant usdc = ERC20Faucet(0xF00ad39d0aC1A422DAB5A2EceBAa5268ea909aD4);

    bytes32 SALT;
    address deployer;

    function run() external {
        SALT = keccak256(abi.encodePacked(block.timestamp));

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

        console2.log(deployer, "deployer");
        console2.log(deployer.balance, "deployer balance");

        deployGovernance(deployer, SALT, boldToken, usdc);
    }
}
