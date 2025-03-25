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

    function test_propose_accept_minters_onlyOwner() external {
        // cannot be "accepted" before initialization
        vm.prank(boldToken.getOwner());
        vm.expectRevert("Invalid");
        boldToken.acceptMinterBurnerProposal();

        address[] memory newMinters = new address[](2);
        newMinters[0] = A;
        newMinters[1] = B;
        uint256 timestamp = block.timestamp;

        address[] memory newBurners = new address[](2);
        newBurners[0] = C;
        newBurners[1] = D;

        // only owner can propose 
        vm.expectRevert("Owned/not-owner");
        boldToken.proposeNewMintersAndBurners(newMinters, newBurners);

        vm.prank(boldToken.getOwner());
        boldToken.proposeNewMintersAndBurners(newMinters, newBurners);

        // the proposal is stored correctly
        BoldToken boldContract = BoldToken(address(boldToken));
        (uint256 proposalTimestamp, address[] memory proposedMinters, address[] memory proposedBurners) = boldContract.getMinterBurnerProposal();

        assertEq(timestamp, proposalTimestamp);

        assertEq(proposedMinters[0], A);
        assertEq(proposedMinters[1], B);

        assertEq(proposedBurners[0], C);
        assertEq(proposedBurners[1], D);

        // only owner can accept 
        vm.expectRevert("Owned/not-owner");
        boldToken.acceptMinterBurnerProposal();

        // cannot accept before 3 days 
        vm.prank(boldToken.getOwner());
        vm.expectRevert("Invalid");
        boldToken.acceptMinterBurnerProposal();

        // roll 3 days and accept
        vm.warp(block.timestamp + 3 days);
        
        vm.prank(boldToken.getOwner());
        boldToken.acceptMinterBurnerProposal();

        // new minters are stored
        assertTrue(boldContract.minterAddresses(A));
        assertTrue(boldContract.minterAddresses(B));

        // new burners are stored
        assertTrue(boldContract.burnerAddresses(C));
        assertTrue(boldContract.burnerAddresses(D));

        // proposal is deleted
        (proposalTimestamp, proposedMinters, proposedBurners) = boldContract.getMinterBurnerProposal();
        assertEq(proposalTimestamp, 0);
        assertEq(proposedMinters.length, 0);
        assertEq(proposedBurners.length, 0);
    }

    function test_only_minters_can_mint() external {
        address[] memory newMinters = new address[](2);
        newMinters[0] = A;
        newMinters[1] = B;

        address[] memory newBurners;
    
        _proposeAndAcceptMintersBurners(newMinters, newBurners);

        // C cannot mint
        vm.prank(C);
        vm.expectRevert();
        boldToken.mint(C, 100);

        // mint and check balance
        uint256 boldBalanceBefore = boldToken.balanceOf(A);

        vm.prank(A);
        boldToken.mint(A, 100);

        vm.prank(B);
        boldToken.mint(A, 100);

        assertEq(boldToken.balanceOf(A), boldBalanceBefore + 200);

        // minters cannot burn 
        vm.prank(A);
        vm.expectRevert();
        boldToken.burn(A, 100);

        vm.prank(B);
        vm.expectRevert();
        boldToken.burn(A, 100);
    }

    function test_only_owner_can_remove_minters() external {
        address[] memory newMinters = new address[](2);
        newMinters[0] = A;
        newMinters[1] = B;

        address[] memory newBurners;
    
        _proposeAndAcceptMintersBurners(newMinters, newBurners);

        BoldToken boldContract = BoldToken(address(boldToken));

        assertTrue(boldContract.minterAddresses(A));
        assertTrue(boldContract.minterAddresses(B));

        // onlyOwner can remove
        vm.expectRevert("Owned/not-owner");
        boldToken.removeMinters(newMinters);

        // owner remove
        vm.prank(boldToken.getOwner());
        boldToken.removeMinters(newMinters);

        assertFalse(boldContract.minterAddresses(A));
        assertFalse(boldContract.minterAddresses(B));
    }

    function test_only_burners_can_burn() external {
        address[] memory newMinters;

        address[] memory newBurners = new address[](2);
        newBurners[0] = C;
        newBurners[1] = D;
        
        _proposeAndAcceptMintersBurners(newMinters, newBurners);

        // deal tokens
        deal(address(boldToken), A, 100);
        assertEq(boldToken.balanceOf(A), 100);

        // A cannot burn
        vm.prank(A);
        vm.expectRevert();
        boldToken.burn(A, 100);
        
        // C and D can burn
        vm.prank(C);
        boldToken.burn(A, 50);

        vm.prank(D);
        boldToken.burn(A, 50);

        assertEq(boldToken.balanceOf(A), 0);

        // burners cannot mint
        vm.prank(C);
        vm.expectRevert();
        boldToken.mint(A, 100);

        vm.prank(D);
        vm.expectRevert();
        boldToken.mint(A, 100);
    }

    function test_only_owner_can_remove_burners() external {
        address[] memory newMinters;

        address[] memory newBurners = new address[](2);
        newBurners[0] = C;
        newBurners[1] = D;
        
        _proposeAndAcceptMintersBurners(newMinters, newBurners);

        BoldToken boldContract = BoldToken(address(boldToken));

        assertTrue(boldContract.burnerAddresses(C));
        assertTrue(boldContract.burnerAddresses(D));

        // onlyOwner can remove
        vm.expectRevert("Owned/not-owner");
        boldToken.removeBurners(newBurners);

        // owner remove
        vm.prank(boldToken.getOwner());
        boldToken.removeBurners(newBurners);

        assertFalse(boldContract.burnerAddresses(C));
        assertFalse(boldContract.burnerAddresses(D));
    }

    function _proposeAndAcceptMintersBurners(address[] memory newMinters, address[] memory newBurners) internal {
        vm.prank(boldToken.getOwner());
        boldToken.proposeNewMintersAndBurners(newMinters, newBurners);

        // roll 3 days and accept
        vm.warp(block.timestamp + 3 days);

        vm.prank(boldToken.getOwner());
        boldToken.acceptMinterBurnerProposal();
    }
}
