// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Whitelist} from "src/Dependencies/Whitelist.sol";

contract WhitelistTest is Test {
    Whitelist public whitelistContract;

    address public owner;
    address public user;

    function setUp() public {
        owner = makeAddr("owner");
        user = makeAddr("user");

        whitelistContract = new Whitelist(owner);
    }

    function test_addWhitelist() public {
        assertEq(whitelistContract.isWhitelisted(user), false);

        vm.prank(owner);
        whitelistContract.addToWhitelist(user);

        assertEq(whitelistContract.isWhitelisted(user), true);
    }

    function test_removeWhitelist() public {
        assertEq(whitelistContract.isWhitelisted(user), false);

        vm.startPrank(owner);
        whitelistContract.addToWhitelist(user);

        assertEq(whitelistContract.isWhitelisted(user), true);

        whitelistContract.removeFromWhitelist(user);

        assertEq(whitelistContract.isWhitelisted(user), false);

        vm.stopPrank();
    }

    function test_addWhitelist_onlyOwner() public {
        vm.expectRevert(bytes("Owned/not-owner"));

        vm.prank(user);
        whitelistContract.addToWhitelist(user);
    }

    function test_removeWhitelist_onlyOwner() public {
        vm.prank(owner);
        whitelistContract.addToWhitelist(user);

        vm.expectRevert(bytes("Owned/not-owner"));
        vm.prank(user);
        whitelistContract.removeFromWhitelist(user);
    }
}
