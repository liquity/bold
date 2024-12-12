// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";

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
}
