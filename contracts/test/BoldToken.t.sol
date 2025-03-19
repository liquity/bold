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
        boldToken.acceptNewMinters();

        address[] memory newMinters = new address[](2);
        newMinters[0] = A;
        newMinters[1] = B;
        uint256 timestamp = block.timestamp;

        // only owner can propose 
        vm.expectRevert("Owned/not-owner");
        boldToken.proposeNewMinters(newMinters);

        vm.prank(boldToken.getOwner());
        boldToken.proposeNewMinters(newMinters);

        // the proposal is stored correctly
        BoldToken boldContract = BoldToken(address(boldToken));
        (uint256 proposalTimestamp, address[] memory proposedMinters) = boldContract.getMinterProposal();

        assertEq(proposedMinters[0], A);
        assertEq(proposedMinters[1], B);

        // only owner can accept 
        vm.expectRevert("Owned/not-owner");
        boldToken.acceptNewMinters();

        // cannot accept before 3 days 
        vm.prank(boldToken.getOwner());
        vm.expectRevert("Invalid");
        boldToken.acceptNewMinters();

        // roll 3 days and accept
        vm.warp(block.timestamp + 3 days);
        
        vm.prank(boldToken.getOwner());
        boldToken.acceptNewMinters();

        // new minters are stored
        assertTrue(boldContract.minterAddresses(A));
        assertTrue(boldContract.minterAddresses(B));

        // proposal is deleted
        (proposalTimestamp, proposedMinters) = boldContract.getMinterProposal();
        assertEq(proposalTimestamp, 0);
        assertEq(proposedMinters.length, 0);
    }

    function test_only_minters_can_mint() external {
        address[] memory newMinters = new address[](2);
        newMinters[0] = A;
        newMinters[1] = B;

        vm.prank(boldToken.getOwner());
        boldToken.proposeNewMinters(newMinters);

        // roll 3 days and accept
        vm.warp(block.timestamp + 3 days);

        vm.prank(boldToken.getOwner());
        boldToken.acceptNewMinters();

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

        vm.prank(boldToken.getOwner());
        boldToken.proposeNewMinters(newMinters);

        // roll 3 days and accept
        vm.warp(block.timestamp + 3 days);

        vm.prank(boldToken.getOwner());
        boldToken.acceptNewMinters();

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

    // BURNERS
    function test_propose_accept_burners_onlyOwner() external {
        // cannot be "accepted" before initialization
        vm.prank(boldToken.getOwner());
        vm.expectRevert("Invalid");
        boldToken.acceptNewBurners();

        address[] memory newBurners = new address[](2);
        newBurners[0] = A;
        newBurners[1] = B;
        uint256 timestamp = block.timestamp;

        // only owner can propose 
        vm.expectRevert("Owned/not-owner");
        boldToken.proposeNewBurners(newBurners);

        vm.prank(boldToken.getOwner());
        boldToken.proposeNewBurners(newBurners);

        // the proposal is stored correctly
        BoldToken boldContract = BoldToken(address(boldToken));
        (uint256 proposalTimestamp, address[] memory proposedBurners) = boldContract.getBurnerProposal();

        assertEq(proposedBurners[0], A);
        assertEq(proposedBurners[1], B);

        // only owner can accept 
        vm.expectRevert("Owned/not-owner");
        boldToken.acceptNewBurners();

        // cannot accept before 3 days 
        vm.prank(boldToken.getOwner());
        vm.expectRevert("Invalid");
        boldToken.acceptNewBurners();

        // roll 3 days and accept
        vm.warp(block.timestamp + 3 days);
        
        vm.prank(boldToken.getOwner());
        boldToken.acceptNewBurners();

        // new burners are stored
        assertTrue(boldContract.burnerAddresses(A));
        assertTrue(boldContract.burnerAddresses(B));

        // proposal is deleted
        (proposalTimestamp, proposedBurners) = boldContract.getBurnerProposal();
        assertEq(proposalTimestamp, 0);
        assertEq(proposedBurners.length, 0);
    }

    function test_only_burners_can_burn() external {
        address[] memory newBurners = new address[](2);
        newBurners[0] = A;
        newBurners[1] = B;
        uint256 timestamp = block.timestamp;

        vm.prank(boldToken.getOwner());
        boldToken.proposeNewBurners(newBurners);
        
        vm.warp(block.timestamp + 3 days);
        
        vm.prank(boldToken.getOwner());
        boldToken.acceptNewBurners();

        // deal tokens
        deal(address(boldToken), A, 100);
        assertEq(boldToken.balanceOf(A), 100);

        // C cannot burn
        vm.prank(C);
        vm.expectRevert();
        boldToken.burn(A, 100);
        
        // A and B can burn
        vm.prank(A);
        boldToken.burn(A, 50);

        vm.prank(B);
        boldToken.burn(A, 50);

        assertEq(boldToken.balanceOf(A), 0);

        // burners cannot mint
        vm.prank(A);
        vm.expectRevert();
        boldToken.mint(A, 100);

        vm.prank(B);
        vm.expectRevert();
        boldToken.mint(A, 100);
    }

    function test_only_owner_can_remove_burners() external {
        address[] memory newBurners = new address[](2);
        newBurners[0] = A;
        newBurners[1] = B;
        uint256 timestamp = block.timestamp;

        vm.prank(boldToken.getOwner());
        boldToken.proposeNewBurners(newBurners);
        
        vm.warp(block.timestamp + 3 days);
        
        vm.prank(boldToken.getOwner());
        boldToken.acceptNewBurners();

        BoldToken boldContract = BoldToken(address(boldToken));

        assertTrue(boldContract.burnerAddresses(A));
        assertTrue(boldContract.burnerAddresses(B));

        // onlyOwner can remove
        vm.expectRevert("Owned/not-owner");
        boldToken.removeBurners(newBurners);

        // owner remove
        vm.prank(boldToken.getOwner());
        boldToken.removeBurners(newBurners);

        assertFalse(boldContract.burnerAddresses(A));
        assertFalse(boldContract.burnerAddresses(B));
    }
}
