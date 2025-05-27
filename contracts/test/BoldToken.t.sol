// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";
import "src/BoldToken.sol";

contract BoldTokenTest is DevTestSetup {
    // TODO: need more tests for:
    // - transfer protection
    // - sendToPool() / returnFromPool()

    function test_InfiniteApprovalPersistsAfterTransfer() external {
        uint256 initialBalance_A = 10_000 ether;

        openTroveHelper(A, 0, 100 ether, initialBalance_A, 0.01 ether);
        assertEq(boldToken.balanceOf(A), initialBalance_A, "A's balance is wrong");

        vm.prank(A);
        assertTrue(boldToken.approve(B, UINT256_MAX));
        assertEq(boldToken.allowance(A, B), UINT256_MAX, "Allowance should be infinite");

        uint256 value = 1_000 ether;

        vm.prank(B);
        assertTrue(boldToken.transferFrom(A, C, value));
        assertEq(boldToken.balanceOf(A), initialBalance_A - value, "A's balance should have decreased by value");
        assertEq(boldToken.balanceOf(C), value, "C's balance should have increased by value");
        assertEq(boldToken.allowance(A, B), UINT256_MAX, "Allowance should still be infinite");
    }

    function test_OnlyOwnerCanSetMinter() public {
        vm.expectRevert("Owned/not-owner");
        boldToken.setMinter(address(1234), true);

        vm.prank(boldToken.owner());
        boldToken.setMinter(address(1234), true);

        assertEq(boldToken.isMinter(address(1234)), true);

        vm.prank(boldToken.owner());
        boldToken.setMinter(address(1234), false);

        assertEq(boldToken.isMinter(address(1234)), false);
    }

    function test_OnlyOwnerCanSetBurner() public {
        vm.expectRevert("Owned/not-owner");
        boldToken.setBurner(address(1234), true);

        vm.prank(boldToken.owner());
        boldToken.setBurner(address(1234), true);

        assertEq(boldToken.isBurner(address(1234)), true);

        vm.prank(boldToken.owner());
        boldToken.setBurner(address(1234), false);

        assertEq(boldToken.isBurner(address(1234)), false);
    }

    function test_OnlyOwnerCanSetStabilityPool() public {
        vm.expectRevert("Owned/not-owner");
        boldToken.setStabilityPool(address(1234), true);

        vm.prank(boldToken.owner());
        boldToken.setStabilityPool(address(1234), true);

        assertEq(boldToken.isStabilityPool(address(1234)), true);

        vm.prank(boldToken.owner());
        boldToken.setStabilityPool(address(1234), false);

        assertEq(boldToken.isStabilityPool(address(1234)), false);
    }

    function test_OnlyMinterCanMint() public {
        vm.expectRevert("BoldToken: Caller is not a minter");
        boldToken.mint(address(1234), 100 ether);

        vm.prank(boldToken.owner());
        boldToken.setMinter(address(1234), true);

        vm.prank(address(1234));
        boldToken.mint(address(1234), 100 ether);

        assertEq(boldToken.balanceOf(address(1234)), 100 ether);
    }

    function test_OnlyBurnerCanBurn() public {
        test_OnlyMinterCanMint();

        vm.expectRevert("BoldToken: Caller is not a burner");
        boldToken.burn(address(1234), 100 ether);

        vm.prank(boldToken.owner());
        boldToken.setBurner(address(1234), true);

        vm.prank(address(1234));
        boldToken.burn(address(1234), 100 ether);

        assertEq(boldToken.balanceOf(address(1234)), 0);
    }
}
