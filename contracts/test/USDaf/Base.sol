// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "../../script/DeployUSDaf.s.sol";

import "forge-std/Test.sol";

abstract contract Base is DeployUsdAsFuckScript, Test {

    function setUp() public virtual {
        uint256 _blockNumber = 22_817_924; // Caching for faster tests
        vm.selectFork(vm.createFork(vm.envString("FORK_URL"), _blockNumber));
        // vm.selectFork(vm.createFork(vm.envString("FORK_URL")));
    }

    function deploy() public returns (DeploymentResult memory) {
        return run();
    }
}