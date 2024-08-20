pragma solidity ^0.8.18;

import "../Dependencies/AddRemoveManagers.sol";
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

    function testCanSetAddManagerOnOpenTrove() public {
        vm.startPrank(A);
        uint256 ATroveId = borrowerOperations.openTrove(
            A, // owner
            0, //index
            100 ether,
            ///coll
            10000e18, //boldAmount
            0, // _upperHint
            0, // _lowerHint
            5e16, //annualInterestRate
            10000e18, // maxUpfrontFee
            B, // add manager
            address(0), // remove manager
            address(0) // receiver of remove manager
        );
        vm.stopPrank();

        // Check it’s properly set
        assertEq(borrowerOperations.addManagerOf(ATroveId), B);
    }

    function testSetAddManagerFailsFromNonOwner() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Try to set add manager
        vm.startPrank(B);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s still unset
        assertEq(borrowerOperations.addManagerOf(ATroveId), ZERO_ADDRESS);

        vm.startPrank(C);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s still unset
        assertEq(borrowerOperations.addManagerOf(ATroveId), ZERO_ADDRESS);
    }

    function testSetRemoveManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Set remove manager
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s properly set
        assertEq(borrowerOperations.removeManagerReceiverOf(ATroveId, B), A);
    }

    function testCanSetRemoveManagerOnOpenTrove() public {
        vm.startPrank(A);
        uint256 ATroveId = borrowerOperations.openTrove(
            A, // owner
            0, //index
            100 ether,
            ///coll
            10000e18, //boldAmount
            0, // _upperHint
            0, // _lowerHint
            5e16, //annualInterestRate
            10000e18, // maxUpfrontFee
            address(0), // add manager
            B, // remove manager
            A // receiver of remove manager
        );
        vm.stopPrank();

        // Check it’s properly set
        assertEq(borrowerOperations.removeManagerReceiverOf(ATroveId, B), A);
    }

    function testSetRemoveManagerWithRemoveAsReceiver() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Set remove manager
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B, B);
        vm.stopPrank();

        // Check it’s properly set
        assertEq(borrowerOperations.removeManagerReceiverOf(ATroveId, B), B);
    }

    function testCanSetRemoveManagerWithRemoveAsReceiverOnOpenTrove() public {
        vm.startPrank(A);
        uint256 ATroveId = borrowerOperations.openTrove(
            A, // owner
            0, //index
            100 ether,
            ///coll
            10000e18, //boldAmount
            0, // _upperHint
            0, // _lowerHint
            5e16, //annualInterestRate
            10000e18, // maxUpfrontFee
            address(0), // add manager
            B, // remove manager
            B // receiver of remove manager
        );
        vm.stopPrank();

        // Check it’s properly set
        assertEq(borrowerOperations.removeManagerReceiverOf(ATroveId, B), B);
    }

    function testSetRemoveManagerWithOtherAsReceiver() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Set remove manager
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B, C);
        vm.stopPrank();

        // Check it’s properly set
        assertEq(borrowerOperations.removeManagerReceiverOf(ATroveId, B), C);
    }

    function testCanSetRemoveManagerWithOtherAsReceiverOnOpenTrove() public {
        vm.startPrank(A);
        uint256 ATroveId = borrowerOperations.openTrove(
            A, // owner
            0, //index
            100 ether,
            ///coll
            10000e18, //boldAmount
            0, // _upperHint
            0, // _lowerHint
            5e16, //annualInterestRate
            10000e18, // maxUpfrontFee
            address(0), // add manager
            B, // remove manager
            C // receiver of remove manager
        );
        vm.stopPrank();

        // Check it’s properly set
        assertEq(borrowerOperations.removeManagerReceiverOf(ATroveId, B), C);
    }

    function testSetRemoveManagerFailsWithZeroReceiver() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Try to set remove manager
        vm.startPrank(A);
        vm.expectRevert(AddRemoveManagers.EmptyReceiver.selector);
        borrowerOperations.setRemoveManager(ATroveId, B, address(0));
        vm.stopPrank();

        // Check it’s still unset
        assertEq(borrowerOperations.removeManagerReceiverOf(ATroveId, B), ZERO_ADDRESS);
    }

    function testSetRemoveManagerFailsWithZeroReceiverOnOpenTrove() public {
        vm.startPrank(A);
        vm.expectRevert(AddRemoveManagers.EmptyReceiver.selector);
        uint256 ATroveId = borrowerOperations.openTrove(
            A, // owner
            0, //index
            100 ether,
            ///coll
            10000e18, //boldAmount
            0, // _upperHint
            0, // _lowerHint
            5e16, //annualInterestRate
            10000e18, // maxUpfrontFee
            address(0), // add manager
            B, // remove manager
            address(0) // receiver of remove manager
        );
        vm.stopPrank();

        // Check it’s still unset
        assertEq(borrowerOperations.removeManagerReceiverOf(ATroveId, B), ZERO_ADDRESS);
    }

    function testSetRemoveManagerFailsFromNonOwner() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);

        // Try to set add manager
        vm.startPrank(B);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s still unset
        assertEq(borrowerOperations.removeManagerReceiverOf(ATroveId, B), ZERO_ADDRESS);

        vm.startPrank(C);
        vm.expectRevert(AddRemoveManagers.NotBorrower.selector);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s still unset
        assertEq(borrowerOperations.removeManagerReceiverOf(ATroveId, B), ZERO_ADDRESS);
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
        vm.expectRevert(AddRemoveManagers.NotOwnerNorAddManager.selector);
        borrowerOperations.addColl(ATroveId, 1 ether);
        vm.stopPrank();

        // Set remove manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, C);
        vm.stopPrank();

        vm.startPrank(C);
        vm.expectRevert(AddRemoveManagers.NotOwnerNorAddManager.selector);
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

        // Owner can withdraw coll
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

        // Owner can withdraw coll
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

        vm.expectRevert(AddRemoveManagers.NotOwnerNorRemoveManager.selector);
        borrowerOperations.withdrawColl(ATroveId, 1 ether);
        vm.stopPrank();

        // Set add manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert(AddRemoveManagers.NotOwnerNorRemoveManager.selector);
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
        deal(address(boldToken), B, 100e18);
        vm.startPrank(B);
        uint256 BInitialBoldBalance = boldToken.balanceOf(B);

        borrowerOperations.repayBold(ATroveId, 10e18);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireDebt(ATroveId), initialDebt - 20e18, "Wrong trove debt 2");
        assertEq(boldToken.balanceOf(B), BInitialBoldBalance - 10e18, "Wrong manager balance 2");

        // Others can’t repay bold
        deal(address(boldToken), C, 100e18);
        vm.startPrank(C);
        uint256 CInitialBoldBalance = boldToken.balanceOf(C);

        vm.expectRevert(AddRemoveManagers.NotOwnerNorAddManager.selector);
        borrowerOperations.repayBold(ATroveId, 10e18);
        vm.stopPrank();

        // Set remove manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, C);
        vm.stopPrank();

        vm.startPrank(C);
        vm.expectRevert(AddRemoveManagers.NotOwnerNorAddManager.selector);
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
        deal(address(boldToken), B, 100e18);
        uint256 BInitialBoldBalance = boldToken.balanceOf(B);

        vm.startPrank(B);
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

        vm.expectRevert(AddRemoveManagers.NotOwnerNorRemoveManager.selector);
        this.withdrawBold100pct(B, ATroveId, 10e18);

        // Set add manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        vm.expectRevert(AddRemoveManagers.NotOwnerNorRemoveManager.selector);
        this.withdrawBold100pct(B, ATroveId, 10e18);

        assertEq(boldToken.balanceOf(A), AInitialBoldBalance + 10e18, "Wrong owner balance");
        assertEq(boldToken.balanceOf(B), BInitialBoldBalance, "Wrong manager balance");
    }

    // Close trove

    function testCloseTroveByOwnerWithRemoveManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);
        // open a second trove so that we don’t try to close the last one
        openTroveNoHints100pct(D, 100 ether, 10000e18, 1e17);

        // Set remove manager
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        uint256 AInitialCollBalance = collToken.balanceOf(A);

        // Owner can close trove
        deal(address(boldToken), A, troveManager.getTroveEntireDebt(ATroveId));
        vm.startPrank(A);
        borrowerOperations.closeTrove(ATroveId);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), 0, "Wrong trove coll");
        assertEq(collToken.balanceOf(A), AInitialCollBalance + 100 ether + ETH_GAS_COMPENSATION, "Wrong owner balance");
    }

    function testCloseTroveByManagerWithRemoveManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);
        // open a second trove so that we don’t try to close the last one
        openTroveNoHints100pct(D, 100 ether, 10000e18, 1e17);

        // Set remove manager
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        uint256 AInitialCollBalance = collToken.balanceOf(A);
        uint256 BInitialCollBalance = collToken.balanceOf(B);

        // Manager can close trove
        deal(address(boldToken), B, troveManager.getTroveEntireDebt(ATroveId));
        vm.startPrank(B);
        borrowerOperations.closeTrove(ATroveId);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), 0, "Wrong trove coll");
        assertEq(collToken.balanceOf(A), AInitialCollBalance + 100 ether + ETH_GAS_COMPENSATION, "Wrong owner balance");
        assertEq(collToken.balanceOf(B), BInitialCollBalance, "Wrong manager balance");
    }

    function testCloseTroveByOtherWithRemoveManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);
        // open a second trove so that we don’t try to close the last one
        openTroveNoHints100pct(D, 100 ether, 10000e18, 1e17);

        // Set remove manager
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Other cannot close trove
        deal(address(boldToken), C, troveManager.getTroveEntireDebt(ATroveId));
        vm.startPrank(C);
        vm.expectRevert(AddRemoveManagers.NotOwnerNorRemoveManager.selector);
        borrowerOperations.closeTrove(ATroveId);
        vm.stopPrank();
    }

    function testCloseTroveWithoutRemoveManager() public {
        uint256 ATroveId = openTroveNoHints100pct(A, 100 ether, 10000e18, 1e17);
        // open a second trove so that we don’t try to close the last one
        openTroveNoHints100pct(D, 100 ether, 10000e18, 1e17);

        uint256 BInitialCollBalance = collToken.balanceOf(B);

        // Other can’t close trove
        deal(address(boldToken), B, troveManager.getTroveEntireDebt(ATroveId));
        vm.startPrank(B);
        vm.expectRevert(AddRemoveManagers.NotOwnerNorRemoveManager.selector);
        borrowerOperations.closeTrove(ATroveId);
        vm.stopPrank();

        // Set add manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        deal(address(boldToken), B, troveManager.getTroveEntireDebt(ATroveId));
        vm.startPrank(B);
        vm.expectRevert(AddRemoveManagers.NotOwnerNorRemoveManager.selector);
        borrowerOperations.closeTrove(ATroveId);
        vm.stopPrank();

        // Owner can close trove
        uint256 AInitialCollBalance = collToken.balanceOf(A);

        deal(address(boldToken), A, troveManager.getTroveEntireDebt(ATroveId));
        vm.startPrank(A);
        borrowerOperations.closeTrove(ATroveId);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), 0, "Wrong trove coll");
        assertEq(collToken.balanceOf(A), AInitialCollBalance + 100 ether + ETH_GAS_COMPENSATION, "Wrong owner balance");
        assertEq(collToken.balanceOf(B), BInitialCollBalance, "Wrong manager balance");
    }
}
