pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract BorrowerOperationsOnBehalfTroveManagamentTest is DevTestSetup {
    function testSetAddManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Check it’s initially empty
        assertEq(borrowerOperations.addManagerOf(ATroveId), ZERO_ADDRESS);

        // Set add manager
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s properly set
        assertEq(borrowerOperations.addManagerOf(ATroveId), B);
    }

    function testSetAddManagerFailsFromNonOwner() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Try to set add manager
        vm.startPrank(B);
        vm.expectRevert("BorrowerOps: sender is not Trove owner");
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s still unset
        assertEq(borrowerOperations.addManagerOf(ATroveId), ZERO_ADDRESS);

        vm.startPrank(C);
        vm.expectRevert("BorrowerOps: sender is not Trove owner");
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s still unset
        assertEq(borrowerOperations.addManagerOf(ATroveId), ZERO_ADDRESS);
    }

    function testRemoveAddManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Check it’s initially empty
        assertEq(borrowerOperations.removeManagerOf(ATroveId), ZERO_ADDRESS);

        // Set remove manager
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s properly set
        assertEq(borrowerOperations.removeManagerOf(ATroveId), B);
    }

    function testSetRemoveManagerFailsFromNonOwner() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Try to set add manager
        vm.startPrank(B);
        vm.expectRevert("BorrowerOps: sender is not Trove owner");
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s still unset
        assertEq(borrowerOperations.removeManagerOf(ATroveId), ZERO_ADDRESS);

        vm.startPrank(C);
        vm.expectRevert("BorrowerOps: sender is not Trove owner");
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s still unset
        assertEq(borrowerOperations.removeManagerOf(ATroveId), ZERO_ADDRESS);
    }

    function testAddCollWithAddManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Set add manager
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        // Owner can add coll
        vm.startPrank(A);
        uint256 AInitialCollBalance = collToken.balanceOf(A);

        borrowerOperations.addColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), 101 ether, "Wrong trove coll");
        assertEq(collToken.balanceOf(A), AInitialCollBalance - 1 ether, "Wrong owner balance");

        // Manager can add coll
        vm.startPrank(B);
        uint256 BInitialCollBalance = collToken.balanceOf(B);

        borrowerOperations.addColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), 102 ether, "Wrong trove coll");
        assertEq(collToken.balanceOf(B), BInitialCollBalance - 1 ether, "Wrong manager balance");

        // 3rd party cannot add coll
        vm.startPrank(C);
        vm.expectRevert("BorrowerOps: sender is neither Trove owner nor add-manager");
        borrowerOperations.addColl(ATroveId, 1 ether);
        vm.stopPrank();

        // Set remove manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, C);
        vm.stopPrank();

        vm.startPrank(C);
        vm.expectRevert("BorrowerOps: sender is neither Trove owner nor add-manager");
        borrowerOperations.addColl(ATroveId, 1 ether);
        vm.stopPrank();
    }

    function testAddCollWithoutAddManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        assertEq(borrowerOperations.addManagerOf(ATroveId), address(0));

        // Owner can add coll
        vm.startPrank(A);
        uint256 AInitialCollBalance = collToken.balanceOf(A);

        borrowerOperations.addColl(ATroveId, 1 ether);

        assertEq(troveManager.getTroveColl(ATroveId), 101 ether, "Wrong trove coll");
        assertEq(collToken.balanceOf(A), AInitialCollBalance - 1 ether, "Wrong owner balance");
        vm.stopPrank();

        // Others can add coll
        vm.startPrank(B);
        uint256 BInitialCollBalance = collToken.balanceOf(B);
        borrowerOperations.addColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), 102 ether, "Wrong trove coll");
        assertEq(collToken.balanceOf(B), BInitialCollBalance - 1 ether, "Wrong manager balance");
    }

    function testWithdrawCollWithRemoveManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Set remove manager
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Owner can withdraw bold
        vm.startPrank(A);
        uint256 AInitialCollBalance = collToken.balanceOf(A);
        uint256 initialColl = troveManager.getTroveColl(ATroveId);

        borrowerOperations.withdrawColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), initialColl - 1 ether, "Wrong trove coll");
        assertEq(collToken.balanceOf(A), AInitialCollBalance + 1 ether, "Wrong owner balance");

        // Manager can withdraw coll
        vm.startPrank(B);
        uint256 BInitialCollBalance = collToken.balanceOf(B);

        borrowerOperations.withdrawColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), initialColl - 2 ether, "Wrong trove coll");
        assertEq(collToken.balanceOf(A), AInitialCollBalance + 2 ether, "Wrong owner balance");
        assertEq(collToken.balanceOf(B), BInitialCollBalance, "Wrong manager balance");
    }

    function testWithdrawCollWithoutRemoveManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        assertEq(borrowerOperations.removeManagerOf(ATroveId), address(0));

        // Owner can withdraw bold
        vm.startPrank(A);
        uint256 AInitialCollBalance = collToken.balanceOf(A);
        uint256 initialColl = troveManager.getTroveColl(ATroveId);

        borrowerOperations.withdrawColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), initialColl - 1 ether, "Wrong trove coll");
        assertEq(collToken.balanceOf(A), AInitialCollBalance + 1 ether, "Wrong owner balance");

        // Manager can’t withdraw coll
        vm.startPrank(B);
        uint256 BInitialCollBalance = collToken.balanceOf(B);

        vm.expectRevert("BorrowerOps: sender is neither Trove owner nor remove-manager");
        borrowerOperations.withdrawColl(ATroveId, 1 ether);
        vm.stopPrank();

        // Set add manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("BorrowerOps: sender is neither Trove owner nor remove-manager");
        borrowerOperations.withdrawColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), initialColl - 1 ether, "Wrong trove coll");
        assertEq(collToken.balanceOf(A), AInitialCollBalance + 1 ether, "Wrong owner balance");
        assertEq(collToken.balanceOf(B), BInitialCollBalance, "Wrong manager balance");
    }

    function testRepayBoldWithAddManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Set add manager
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        // Owner can repay bold
        vm.startPrank(A);
        uint256 AInitialBoldBalance = boldToken.balanceOf(A);
        uint256 initialDebt = troveManager.getTroveEntireDebt(ATroveId);

        borrowerOperations.repayBold(ATroveId, 10e18);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireDebt(ATroveId), initialDebt - 10e18, "Wrong trove debt 1");
        assertEq(boldToken.balanceOf(A), AInitialBoldBalance - 10e18, "Wrong owner balance 1");

        // Manager can repay bold
        vm.startPrank(B);
        deal(address(boldToken), B, 100e18);
        uint256 BInitialBoldBalance = boldToken.balanceOf(B);

        borrowerOperations.repayBold(ATroveId, 10e18);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireDebt(ATroveId), initialDebt - 20e18, "Wrong trove debt 2");
        assertEq(boldToken.balanceOf(B), BInitialBoldBalance - 10e18, "Wrong manager balance 2");

        // Others can’t repay bold
        vm.startPrank(C);
        deal(address(boldToken), C, 100e18);
        uint256 CInitialBoldBalance = boldToken.balanceOf(C);

        vm.expectRevert("BorrowerOps: sender is neither Trove owner nor add-manager");
        borrowerOperations.repayBold(ATroveId, 10e18);
        vm.stopPrank();

        // Set remove manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, C);
        vm.stopPrank();

        vm.startPrank(C);
        vm.expectRevert("BorrowerOps: sender is neither Trove owner nor add-manager");
        borrowerOperations.repayBold(ATroveId, 10e18);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireDebt(ATroveId), initialDebt - 20e18, "Wrong trove debt 3");
        assertEq(boldToken.balanceOf(C), CInitialBoldBalance, "Wrong manager balance 3");
    }

    function testRepayBoldWithoutAddManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Owner can repay bold
        vm.startPrank(A);
        uint256 AInitialBoldBalance = boldToken.balanceOf(A);
        uint256 initialDebt = troveManager.getTroveEntireDebt(ATroveId);

        borrowerOperations.repayBold(ATroveId, 10e18);

        assertEq(troveManager.getTroveEntireDebt(ATroveId), initialDebt - 10e18, "Wrong trove debt");
        assertEq(boldToken.balanceOf(A), AInitialBoldBalance - 10e18, "Wrong owner balance");
        vm.stopPrank();

        assertEq(borrowerOperations.addManagerOf(ATroveId), address(0));

        // Others can repay bold
        vm.startPrank(B);
        deal(address(boldToken), B, 100e18);
        uint256 BInitialBoldBalance = boldToken.balanceOf(B);

        borrowerOperations.repayBold(ATroveId, 10e18);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireDebt(ATroveId), initialDebt - 20e18, "Wrong trove debt");
        assertEq(boldToken.balanceOf(B), BInitialBoldBalance - 10e18, "Wrong manager balance");
    }

    function testWithdrawBoldWithRemoveManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Set remove manager
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Owner can withdraw bold
        uint256 AInitialBoldBalance = boldToken.balanceOf(A);

        withdrawBold100pct(A, ATroveId, 10e18);

        assertEq(boldToken.balanceOf(A), AInitialBoldBalance + 10e18, "Wrong owner balance");

        // Manager can withdraw bold
        uint256 BInitialBoldBalance = boldToken.balanceOf(B);

        withdrawBold100pct(B, ATroveId, 10e18);

        assertEq(boldToken.balanceOf(A), AInitialBoldBalance + 20e18, "Wrong owner balance");
        assertEq(boldToken.balanceOf(B), BInitialBoldBalance, "Wrong manager balance");
    }

    function testWithdrawBoldWithoutRemoveManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Owner can withdraw bold
        uint256 AInitialBoldBalance = boldToken.balanceOf(A);

        withdrawBold100pct(A, ATroveId, 10e18);

        assertEq(boldToken.balanceOf(A), AInitialBoldBalance + 10e18, "Wrong owner balance");

        // Manager can’t withdraw bold
        uint256 BInitialBoldBalance = boldToken.balanceOf(B);

        vm.expectRevert("BorrowerOps: sender is neither Trove owner nor remove-manager");
        this.withdrawBold100pct(B, ATroveId, 10e18);

        // Set add manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        vm.expectRevert("BorrowerOps: sender is neither Trove owner nor remove-manager");
        this.withdrawBold100pct(B, ATroveId, 10e18);

        assertEq(boldToken.balanceOf(A), AInitialBoldBalance + 10e18, "Wrong owner balance");
        assertEq(boldToken.balanceOf(B), BInitialBoldBalance, "Wrong manager balance");
    }
}
