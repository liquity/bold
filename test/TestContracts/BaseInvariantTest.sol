// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

contract BaseInvariantTest is Test {
    struct Actor {
        string label;
        address account;
    }

    address constant adam = 0x1111111111111111111111111111111111111111;
    address constant barb = 0x2222222222222222222222222222222222222222;
    address constant carl = 0x3333333333333333333333333333333333333333;
    address constant dana = 0x4444444444444444444444444444444444444444;
    address constant eric = 0x5555555555555555555555555555555555555555;
    address constant fran = 0x6666666666666666666666666666666666666666;
    address constant gabe = 0x7777777777777777777777777777777777777777;
    address constant hope = 0x8888888888888888888888888888888888888888;

    Actor[] actors;

    constructor() {
        actors.push(Actor("adam", adam));
        actors.push(Actor("barb", barb));
        actors.push(Actor("carl", carl));
        actors.push(Actor("dana", dana));
        actors.push(Actor("eric", eric));
        actors.push(Actor("fran", fran));
        actors.push(Actor("gabe", gabe));
        actors.push(Actor("hope", hope));
    }

    function setUp() public virtual {
        for (uint256 i = 0; i < actors.length; ++i) {
            vm.label(actors[i].account, actors[i].label);
            targetSender(actors[i].account);
        }
    }
}
