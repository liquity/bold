pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract BorrowerOperationsOnBehalfTroveManagamentTest is DevTestSetup {
    function testSetAddManager() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // Check it’s initially empty
        assertEq(troveManager.TroveAddManagers(ATroveId), ZERO_ADDRESS);

        // Set add manager
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s properly set
        assertEq(troveManager.TroveAddManagers(ATroveId), B);
    }

    function testSetAddManagerFailsFromNonOwner() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // Try to set add manager
        vm.startPrank(B);
        vm.expectRevert("TroveManager: sender is not trove owner");
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s still unset
        assertEq(troveManager.TroveAddManagers(ATroveId), ZERO_ADDRESS);

        vm.startPrank(C);
        vm.expectRevert("TroveManager: sender is not trove owner");
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s still unset
        assertEq(troveManager.TroveAddManagers(ATroveId), ZERO_ADDRESS);
    }

    function testRemoveAddManager() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // Check it’s initially empty
        assertEq(troveManager.TroveRemoveManagers(ATroveId), ZERO_ADDRESS);

        // Set remove manager
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s properly set
        assertEq(troveManager.TroveRemoveManagers(ATroveId), B);
    }

    function testSetRemoveManagerFailsFromNonOwner() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // Try to set add manager
        vm.startPrank(B);
        vm.expectRevert("TroveManager: sender is not trove owner");
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s still unset
        assertEq(troveManager.TroveRemoveManagers(ATroveId), ZERO_ADDRESS);

        vm.startPrank(C);
        vm.expectRevert("TroveManager: sender is not trove owner");
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Check it’s still unset
        assertEq(troveManager.TroveRemoveManagers(ATroveId), ZERO_ADDRESS);
    }

    function testAddCollWithAddManager() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // Set add manager
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        // Owner can add coll
        vm.startPrank(A);
        uint256 AInitialCollBalance = WETH.balanceOf(A);

        borrowerOperations.addColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), 101 ether, "Wrong trove coll");
        assertEq(WETH.balanceOf(A), AInitialCollBalance - 1 ether, "Wrong owner balance");

        // Manager can add coll
        vm.startPrank(B);
        uint256 BInitialCollBalance = WETH.balanceOf(B);

        borrowerOperations.addColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), 102 ether, "Wrong trove coll");
        assertEq(WETH.balanceOf(B), BInitialCollBalance - 1 ether, "Wrong manager balance");
    }

    function testAddCollWithoutAddManager() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // Owner can add coll
        vm.startPrank(A);
        uint256 AInitialCollBalance = WETH.balanceOf(A);

        borrowerOperations.addColl(ATroveId, 1 ether);

        assertEq(troveManager.getTroveColl(ATroveId), 101 ether, "Wrong trove coll");
        assertEq(WETH.balanceOf(A), AInitialCollBalance - 1 ether, "Wrong owner balance");
        vm.stopPrank();

        // Others can’t add coll
        vm.startPrank(B);
        uint256 BInitialCollBalance = WETH.balanceOf(B);

        vm.expectRevert("TroveManager: sender is not trove owner nor manager");
        borrowerOperations.addColl(ATroveId, 1 ether);
        vm.stopPrank();

        // Set remove manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("TroveManager: sender is not trove owner nor manager");
        borrowerOperations.addColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), 101 ether, "Wrong trove coll");
        assertEq(WETH.balanceOf(B), BInitialCollBalance, "Wrong manager balance");
    }

    function testWithdrawCollWithRemoveManager() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // Set remove manager
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Owner can withdraw bold
        vm.startPrank(A);
        uint256 AInitialCollBalance = WETH.balanceOf(A);
        uint256 initialColl = troveManager.getTroveColl(ATroveId);

        borrowerOperations.withdrawColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), initialColl - 1 ether, "Wrong trove coll");
        assertEq(WETH.balanceOf(A), AInitialCollBalance + 1 ether, "Wrong owner balance");

        // Manager can withdraw coll
        vm.startPrank(B);
        uint256 BInitialCollBalance = WETH.balanceOf(B);

        borrowerOperations.withdrawColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), initialColl - 2 ether, "Wrong trove coll");
        assertEq(WETH.balanceOf(A), AInitialCollBalance + 2 ether, "Wrong owner balance");
        assertEq(WETH.balanceOf(B), BInitialCollBalance, "Wrong manager balance");
    }

    function testWithdrawCollWithoutRemoveManager() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // Owner can withdraw bold
        vm.startPrank(A);
        uint256 AInitialCollBalance = WETH.balanceOf(A);
        uint256 initialColl = troveManager.getTroveColl(ATroveId);

        borrowerOperations.withdrawColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), initialColl - 1 ether, "Wrong trove coll");
        assertEq(WETH.balanceOf(A), AInitialCollBalance + 1 ether, "Wrong owner balance");

        // Manager can’t withdraw coll
        vm.startPrank(B);
        uint256 BInitialCollBalance = WETH.balanceOf(B);

        vm.expectRevert("TroveManager: sender is not trove owner nor manager");
        borrowerOperations.withdrawColl(ATroveId, 1 ether);
        vm.stopPrank();

        // Set add manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("TroveManager: sender is not trove owner nor manager");
        borrowerOperations.withdrawColl(ATroveId, 1 ether);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), initialColl - 1 ether, "Wrong trove coll");
        assertEq(WETH.balanceOf(A), AInitialCollBalance + 1 ether, "Wrong owner balance");
        assertEq(WETH.balanceOf(B), BInitialCollBalance, "Wrong manager balance");
    }

    function testRepayBoldWithAddManager() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // Set add manager
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        // Owner can repay bold
        vm.startPrank(A);
        uint256 AInitialBoldBalance = boldToken.balanceOf(A);
        uint256 initialDebt = troveManager.getTroveDebt(ATroveId);

        borrowerOperations.repayBold(ATroveId, 10e18);
        vm.stopPrank();

        assertEq(troveManager.getTroveDebt(ATroveId), initialDebt - 10e18, "Wrong trove debt");
        assertEq(boldToken.balanceOf(A), AInitialBoldBalance - 10e18, "Wrong owner balance");

        // Manager can repay bold
        vm.startPrank(B);
        deal(address(boldToken), B, 100e18);
        uint256 BInitialBoldBalance = boldToken.balanceOf(B);

        borrowerOperations.repayBold(ATroveId, 10e18);
        vm.stopPrank();

        assertEq(troveManager.getTroveDebt(ATroveId), initialDebt - 20e18, "Wrong trove debt");
        assertEq(boldToken.balanceOf(B), BInitialBoldBalance - 10e18, "Wrong manager balance");
    }

    function testRepayBoldWithoutAddManager() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // Owner can repay bold
        vm.startPrank(A);
        uint256 AInitialBoldBalance = boldToken.balanceOf(A);
        uint256 initialDebt = troveManager.getTroveDebt(ATroveId);

        borrowerOperations.repayBold(ATroveId, 10e18);

        assertEq(troveManager.getTroveDebt(ATroveId), initialDebt - 10e18, "Wrong trove debt");
        assertEq(boldToken.balanceOf(A), AInitialBoldBalance - 10e18, "Wrong owner balance");
        vm.stopPrank();

        // Manager can’t repay bold
        vm.startPrank(B);
        deal(address(boldToken), B, 100e18);
        uint256 BInitialBoldBalance = boldToken.balanceOf(B);

        vm.expectRevert("TroveManager: sender is not trove owner nor manager");
        borrowerOperations.repayBold(ATroveId, 10e18);
        vm.stopPrank();

        // Set remove manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("TroveManager: sender is not trove owner nor manager");
        borrowerOperations.repayBold(ATroveId, 10e18);
        vm.stopPrank();

        assertEq(troveManager.getTroveDebt(ATroveId), initialDebt - 10e18, "Wrong trove debt");
        assertEq(boldToken.balanceOf(B), BInitialBoldBalance, "Wrong manager balance");
    }

    function testWithdrawBoldWithRemoveManager() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // Set remove manager
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        // Owner can withdraw bold
        vm.startPrank(A);
        uint256 AInitialBoldBalance = boldToken.balanceOf(A);
        uint256 initialDebt = troveManager.getTroveDebt(ATroveId);

        borrowerOperations.withdrawBold(ATroveId, 1e18, 10e18);
        vm.stopPrank();

        assertEq(troveManager.getTroveDebt(ATroveId), initialDebt + 10e18, "Wrong trove debt");
        assertEq(boldToken.balanceOf(A), AInitialBoldBalance + 10e18, "Wrong owner balance");

        // Manager can’t withdraw bold
        vm.startPrank(B);
        uint256 BInitialBoldBalance = boldToken.balanceOf(B);

        borrowerOperations.withdrawBold(ATroveId, 1e18, 10e18);
        vm.stopPrank();

        assertEq(troveManager.getTroveDebt(ATroveId), initialDebt + 20e18, "Wrong trove debt");
        assertEq(boldToken.balanceOf(A), AInitialBoldBalance + 20e18, "Wrong owner balance");
        assertEq(boldToken.balanceOf(B), BInitialBoldBalance, "Wrong manager balance");
    }

    function testWithdrawBoldWithoutRemoveManager() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // Owner can withdraw bold
        vm.startPrank(A);
        uint256 AInitialBoldBalance = boldToken.balanceOf(A);
        uint256 initialDebt = troveManager.getTroveDebt(ATroveId);

        borrowerOperations.withdrawBold(ATroveId, 1e18, 10e18);
        vm.stopPrank();

        assertEq(troveManager.getTroveDebt(ATroveId), initialDebt + 10e18, "Wrong trove debt");
        assertEq(boldToken.balanceOf(A), AInitialBoldBalance + 10e18, "Wrong owner balance");

        // Manager can’t withdraw bold
        vm.startPrank(B);
        uint256 BInitialBoldBalance = boldToken.balanceOf(B);

        vm.expectRevert("TroveManager: sender is not trove owner nor manager");
        borrowerOperations.withdrawBold(ATroveId, 1e18, 10e18);
        vm.stopPrank();

        // Set add manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("TroveManager: sender is not trove owner nor manager");
        borrowerOperations.withdrawBold(ATroveId, 1e18, 10e18);
        vm.stopPrank();

        assertEq(troveManager.getTroveDebt(ATroveId), initialDebt + 10e18, "Wrong trove debt");
        assertEq(boldToken.balanceOf(A), AInitialBoldBalance + 10e18, "Wrong owner balance");
        assertEq(boldToken.balanceOf(B), BInitialBoldBalance, "Wrong manager balance");
    }

    // TODO: withdrawETHGainToTrove

    function testWithdrawETHGainToTroveWithAddManager() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // Set add manager
        vm.startPrank(A);
        borrowerOperations.setAddManager(ATroveId, B);
        // A provides to SP
        stabilityPool.provideToSP(10000e18);
        vm.stopPrank();

        // B provides to SP
        deal(address(boldToken), B, 10000e18);
        vm.startPrank(B);
        stabilityPool.provideToSP(10000e18);
        vm.stopPrank();

        // C opens trove, price drops and gets liquidated
        uint256 CTroveId = openTroveNoHints100pctMaxFee(C, 100 ether, 14000e18, 1e17);
        priceFeed.setPrice(priceFeed.getPrice() * 3 / 4);
        troveManager.liquidate(CTroveId);

        // Owner can withdraw ETH gain to trove
        vm.startPrank(A);
        uint256 AInitialGain = stabilityPool.getDepositorETHGain(A);

        stabilityPool.withdrawETHGainToTrove(ATroveId);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), 100 ether + AInitialGain, "Wrong trove coll");
        assertEq(stabilityPool.getDepositorETHGain(A), 0, "Wrong owner SP ETH balance");

        // Manager can withdraw ETH gain to trove
        vm.startPrank(B);
        uint256 BInitialGain = stabilityPool.getDepositorETHGain(B);

        stabilityPool.withdrawETHGainToTrove(ATroveId);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), 100 ether + AInitialGain + BInitialGain, "Wrong trove coll");
        assertEq(stabilityPool.getDepositorETHGain(B), 0, "Wrong manager balance");
    }

    function testWithdrawETHGainToTroveWithoutAddManager() public {
        uint256 ATroveId = openTroveNoHints100pctMaxFee(A, 100 ether, 10000e18, 1e17);

        // A provides to SP
        vm.startPrank(A);
        stabilityPool.provideToSP(10000e18);
        vm.stopPrank();

        // B provides to SP
        deal(address(boldToken), B, 10000e18);
        vm.startPrank(B);
        stabilityPool.provideToSP(10000e18);
        vm.stopPrank();

        // C opens trove, price drops and gets liquidated
        uint256 CTroveId = openTroveNoHints100pctMaxFee(C, 100 ether, 14000e18, 1e17);
        priceFeed.setPrice(priceFeed.getPrice() * 3 / 4);
        troveManager.liquidate(CTroveId);

        // Owner can withdraw ETH gain to trove
        vm.startPrank(A);
        uint256 AInitialGain = stabilityPool.getDepositorETHGain(A);

        stabilityPool.withdrawETHGainToTrove(ATroveId);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), 100 ether + AInitialGain, "Wrong trove coll");
        assertEq(stabilityPool.getDepositorETHGain(A), 0, "Wrong owner SP ETH balance");

        // Others can’t withdraw ETH gain to trove
        vm.startPrank(B);
        uint256 BInitialGain = stabilityPool.getDepositorETHGain(B);

        vm.expectRevert("TroveManager: sender is not trove owner nor manager");
        stabilityPool.withdrawETHGainToTrove(ATroveId);
        vm.stopPrank();

        // Set remove manager - still won’t work
        vm.startPrank(A);
        borrowerOperations.setRemoveManager(ATroveId, B);
        vm.stopPrank();

        vm.startPrank(B);
        vm.expectRevert("TroveManager: sender is not trove owner nor manager");
        stabilityPool.withdrawETHGainToTrove(ATroveId);
        vm.stopPrank();

        assertEq(troveManager.getTroveColl(ATroveId), 100 ether + AInitialGain, "Wrong trove coll");
        assertEq(stabilityPool.getDepositorETHGain(B), BInitialGain, "Wrong manager SP ETH balance");
    }
}
