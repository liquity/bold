// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "../../script/DeployUSA.D.s.sol";

import "forge-std/Test.sol";

abstract contract Base is DeployUSADScript, Test {

    function setUp() public virtual {
        vm.selectFork(vm.createFork(vm.envString("FORK_URL")));
    }

    function deploy() public returns (DeploymentResult memory) {
        return run();
    }
}