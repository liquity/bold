// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Whitelist} from "src/Dependencies/Whitelist.sol";

contract WhitelistTest is Test {
    Whitelist public whitelistContract;

    address public owner;
    address public user;
    address public mockContract = address(123345);

    function setUp() public {
        owner = makeAddr("owner");
        user = makeAddr("user");

        whitelistContract = new Whitelist(owner);
    }

    function test_addWhitelist() public {
        assertEq(whitelistContract.isWhitelisted(mockContract, user), false);

        vm.prank(owner);
        whitelistContract.addToWhitelist(mockContract, user);

        assertEq(whitelistContract.isWhitelisted(mockContract, user), true);
    }

    function test_removeWhitelist() public {
        assertEq(whitelistContract.isWhitelisted(mockContract, user), false);

        vm.startPrank(owner);
        whitelistContract.addToWhitelist(mockContract, user);

        assertEq(whitelistContract.isWhitelisted(mockContract, user), true);

        whitelistContract.removeFromWhitelist(mockContract, user);

        assertEq(whitelistContract.isWhitelisted(mockContract, user), false);

        vm.stopPrank();
    }

    function test_addWhitelist_onlyOwner() public {
        vm.expectRevert(bytes("Owned/not-owner"));

        vm.prank(user);
        whitelistContract.addToWhitelist(mockContract, user);
    }

    function test_removeWhitelist_onlyOwner() public {
        vm.prank(owner);
        whitelistContract.addToWhitelist(mockContract, user);

        vm.expectRevert(bytes("Owned/not-owner"));
        vm.prank(user);
        whitelistContract.removeFromWhitelist(mockContract, user);
    }
}
