// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";
import "./TestContracts/WETH.sol";
import "src/Zappers/GasCompZapper.sol";

contract ZapperGasCompTest is DevTestSetup {
    function setUp() public override {
        // Start tests at a non-zero timestamp
        vm.warp(block.timestamp + 600);

        accounts = new Accounts();
        createAccounts();

        (A, B, C, D, E, F, G) = (
            accountsList[0],
            accountsList[1],
            accountsList[2],
            accountsList[3],
            accountsList[4],
            accountsList[5],
            accountsList[6]
        );

        WETH = new WETH9();

        TestDeployer.TroveManagerParams[] memory troveManagerParams = new TestDeployer.TroveManagerParams[](2);
        troveManagerParams[0] = TestDeployer.TroveManagerParams(150e16, 110e16, 10e16, 110e16, 10_000_000e18, 5e16, 10e16, 0);
        troveManagerParams[1] = TestDeployer.TroveManagerParams(160e16, 120e16, 10e16, 120e16, 10_000_000e18, 5e16, 10e16, 1);

        TestDeployer deployer = new TestDeployer();
        TestDeployer.LiquityContractsDev[] memory contractsArray;
        TestDeployer.Zappers[] memory zappersArray;
        (contractsArray, collateralRegistry, boldToken,,, zappersArray) =
            deployer.deployAndConnectContracts(troveManagerParams, WETH);

        // Set price feeds
        contractsArray[1].priceFeed.setPrice(2000e18);

        // Set first branch as default
        addressesRegistry = contractsArray[1].addressesRegistry;
        borrowerOperations = contractsArray[1].borrowerOperations;
        troveManager = contractsArray[1].troveManager;
        troveNFT = contractsArray[1].troveNFT;
        collToken = contractsArray[1].collToken;
        gasCompZapper = zappersArray[1].gasCompZapper;

        // Give some Collateral to test accounts
        uint256 initialCollateralAmount = 10_000e18;

        // A to F
        for (uint256 i = 0; i < 6; i++) {
            // Give some raw ETH to test accounts
            deal(accountsList[i], initialCollateralAmount);
            // Give and approve some coll token to test accounts
            deal(address(collToken), accountsList[i], initialCollateralAmount);
            vm.startPrank(accountsList[i]);
            collToken.approve(address(gasCompZapper), initialCollateralAmount);
            vm.stopPrank();
        }
    }

    function testCanOpenTrove() external {
        uint256 collAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        uint256 ethBalanceBefore = A.balance;
        uint256 collBalanceBefore = collToken.balanceOf(A);

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 5e16,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        assertEq(troveNFT.ownerOf(troveId), A, "Wrong owner");
        assertGt(troveId, 0, "Trove id should be set");
        assertEq(troveManager.getTroveEntireColl(troveId), collAmount, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore - ETH_GAS_COMPENSATION, "ETH bal mismatch");
        assertEq(collToken.balanceOf(A), collBalanceBefore - collAmount, "Coll bal mismatch");
    }

    function testCanOpenTroveWithBatchManager() external {
        uint256 collAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        uint256 ethBalanceBefore = A.balance;
        uint256 collBalanceBefore = collToken.balanceOf(A);

        registerBatchManager(B);

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 0,
            batchManager: B,
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        assertEq(troveNFT.ownerOf(troveId), A, "Wrong owner");
        assertGt(troveId, 0, "Trove id should be set");
        assertEq(troveManager.getTroveEntireColl(troveId), collAmount, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore - ETH_GAS_COMPENSATION, "ETH bal mismatch");
        assertEq(collToken.balanceOf(A), collBalanceBefore - collAmount, "Coll bal mismatch");
        assertEq(borrowerOperations.interestBatchManagerOf(troveId), B, "Wrong batch manager");
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(troveId);
        assertEq(tmBatchManagerAddress, B, "Wrong batch manager (TM)");
    }

    function testCanNotOpenTroveWithBatchManagerAndInterest() external {
        uint256 collAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        registerBatchManager(B);

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 5e16,
            batchManager: B,
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        vm.expectRevert("GCZ: Cannot choose interest if joining a batch");
        gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();
    }

    function testCanAddColl() external {
        uint256 collAmount1 = 10 ether;
        uint256 boldAmount = 10000e18;
        uint256 collAmount2 = 5 ether;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount1,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 5e16,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 collBalanceBefore = collToken.balanceOf(A);
        vm.startPrank(A);
        gasCompZapper.addColl(troveId, collAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), collAmount1 + collAmount2, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(collToken.balanceOf(A), collBalanceBefore - collAmount2, "Coll bal mismatch");
    }

    function testCanWithdrawColl() external {
        uint256 collAmount1 = 10 ether;
        uint256 boldAmount = 10000e18;
        uint256 collAmount2 = 1 ether;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount1,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 5e16,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 collBalanceBefore = collToken.balanceOf(A);
        vm.startPrank(A);
        gasCompZapper.withdrawColl(troveId, collAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), collAmount1 - collAmount2, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(collToken.balanceOf(A), collBalanceBefore + collAmount2, "Coll bal mismatch");
    }

    function testCanontWithdrawCollIfZapperIsNotReceiver() external {
        uint256 collAmount1 = 10 ether;
        uint256 boldAmount = 10000e18;
        uint256 collAmount2 = 1 ether;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount1,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 5e16,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        vm.startPrank(A);
        // Change receiver
        borrowerOperations.setRemoveManagerWithReceiver(troveId, address(gasCompZapper), B);
        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        gasCompZapper.withdrawColl(troveId, collAmount2);
        vm.stopPrank();
    }

    function testCanNotAddReceiverWithoutRemoveManager() external {
        uint256 collAmount = 10 ether;
        uint256 boldAmount1 = 10000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        // Try to add a receiver for the zapper without remove manager
        vm.startPrank(A);
        vm.expectRevert(AddRemoveManagers.EmptyManager.selector);
        gasCompZapper.setRemoveManagerWithReceiver(troveId, address(0), B);
        vm.stopPrank();
    }

    function testCanRepayBold() external {
        uint256 collAmount = 10 ether;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 collBalanceBeforeA = collToken.balanceOf(A);
        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 collBalanceBeforeB = collToken.balanceOf(B);

        // Add a remove manager for the zapper, and send bold
        vm.startPrank(A);
        gasCompZapper.setRemoveManagerWithReceiver(troveId, B, A);
        boldToken.transfer(B, boldAmount2);
        vm.stopPrank();

        // Approve and repay
        vm.startPrank(B);
        boldToken.approve(address(gasCompZapper), boldAmount2);
        gasCompZapper.repayBold(troveId, boldAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), collAmount, "Trove coll mismatch");
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId), boldAmount1 - boldAmount2, 2e18, "Trove  debt mismatch"
        );
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA - boldAmount2, "A BOLD bal mismatch");
        assertEq(collToken.balanceOf(A), collBalanceBeforeA, "A Coll bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB, "B BOLD bal mismatch");
        assertEq(collToken.balanceOf(B), collBalanceBeforeB, "B Coll bal mismatch");
    }

    function testCanWithdrawBold() external {
        uint256 collAmount = 10 ether;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 collBalanceBeforeA = collToken.balanceOf(A);
        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 collBalanceBeforeB = collToken.balanceOf(B);

        // Add a remove manager for the zapper
        vm.startPrank(A);
        gasCompZapper.setRemoveManagerWithReceiver(troveId, B, A);
        vm.stopPrank();

        // Withdraw bold
        vm.startPrank(B);
        gasCompZapper.withdrawBold(troveId, boldAmount2, boldAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), collAmount, "Trove coll mismatch");
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId), boldAmount1 + boldAmount2, 2e18, "Trove  debt mismatch"
        );
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(collToken.balanceOf(A), collBalanceBeforeA, "A Coll bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB, "B BOLD bal mismatch");
        assertEq(collToken.balanceOf(B), collBalanceBeforeB, "B Coll bal mismatch");
    }

    function testCannotWithdrawBoldIfZapperIsNotReceiver() external {
        uint256 collAmount = 10 ether;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        vm.startPrank(A);
        // Add a remove manager for the zapper
        gasCompZapper.setRemoveManagerWithReceiver(troveId, B, A);
        // Change receiver in BO
        borrowerOperations.setRemoveManagerWithReceiver(troveId, address(gasCompZapper), B);
        vm.stopPrank();

        // Withdraw bold
        vm.startPrank(B);
        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        gasCompZapper.withdrawBold(troveId, boldAmount2, boldAmount2);
        vm.stopPrank();
    }

    function testCanAdjustTroveWithdrawCollAndBold() external {
        uint256 collAmount1 = 10 ether;
        uint256 collAmount2 = 1 ether;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount1,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 collBalanceBeforeA = collToken.balanceOf(A);
        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 collBalanceBeforeB = collToken.balanceOf(B);

        // Add a remove manager for the zapper
        vm.startPrank(A);
        gasCompZapper.setRemoveManagerWithReceiver(troveId, B, A);
        vm.stopPrank();

        // Adjust (withdraw coll and Bold)
        vm.startPrank(B);
        gasCompZapper.adjustTrove(troveId, collAmount2, false, boldAmount2, true, boldAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), collAmount1 - collAmount2, "Trove coll mismatch");
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId), boldAmount1 + boldAmount2, 2e18, "Trove  debt mismatch"
        );
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(collToken.balanceOf(A), collBalanceBeforeA + collAmount2, "A Coll bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB, "B BOLD bal mismatch");
        assertEq(collToken.balanceOf(B), collBalanceBeforeB, "B Coll bal mismatch");
    }

    function testCannotAdjustTroveWithdrawCollAndBoldIfZapperIsNotReceiver() external {
        uint256 collAmount1 = 10 ether;
        uint256 collAmount2 = 1 ether;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount1,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        vm.startPrank(A);
        // Add a remove manager for the zapper
        gasCompZapper.setRemoveManagerWithReceiver(troveId, B, A);
        // Change receiver in BO
        borrowerOperations.setRemoveManagerWithReceiver(troveId, address(gasCompZapper), B);
        vm.stopPrank();

        // Adjust (withdraw coll and Bold)
        vm.startPrank(B);
        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        gasCompZapper.adjustTrove(troveId, collAmount2, false, boldAmount2, true, boldAmount2);
        vm.stopPrank();
    }

    function testCanAdjustTroveAddCollAndWithdrawBold() external {
        uint256 collAmount1 = 10 ether;
        uint256 collAmount2 = 1 ether;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount1,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 collBalanceBeforeA = collToken.balanceOf(A);
        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 collBalanceBeforeB = collToken.balanceOf(B);

        // Add a remove manager for the zapper
        vm.startPrank(A);
        gasCompZapper.setRemoveManagerWithReceiver(troveId, B, A);
        vm.stopPrank();

        // Adjust (add coll and withdraw Bold)
        vm.startPrank(B);
        gasCompZapper.adjustTrove(troveId, collAmount2, true, boldAmount2, true, boldAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), collAmount1 + collAmount2, "Trove coll mismatch");
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId), boldAmount1 + boldAmount2, 2e18, "Trove  debt mismatch"
        );
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(collToken.balanceOf(A), collBalanceBeforeA, "A Coll bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB, "B BOLD bal mismatch");
        assertEq(collToken.balanceOf(B), collBalanceBeforeB - collAmount2, "B Coll bal mismatch");
    }

    function testCannotAdjustTroveAddCollAndWithdrawBoldIfZapperIsNotReceiver() external {
        uint256 collAmount1 = 10 ether;
        uint256 collAmount2 = 1 ether;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount1,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        vm.startPrank(A);
        // Add a remove manager for the zapper
        gasCompZapper.setRemoveManagerWithReceiver(troveId, B, A);
        // Change receiver in BO
        borrowerOperations.setRemoveManagerWithReceiver(troveId, address(gasCompZapper), B);
        vm.stopPrank();

        // Adjust (add coll and withdraw Bold)
        vm.startPrank(B);
        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        gasCompZapper.adjustTrove(troveId, collAmount2, true, boldAmount2, true, boldAmount2);
        vm.stopPrank();
    }

    // TODO: more adjustment combinations
    function testCanAdjustZombieTroveWithdrawCollAndBold() external {
        uint256 collAmount1 = 10 ether;
        uint256 collAmount2 = 1 ether;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount1,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        // Add a remove manager for the zapper
        vm.startPrank(A);
        gasCompZapper.setRemoveManagerWithReceiver(troveId, B, A);
        vm.stopPrank();

        // Redeem to make trove zombie
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(boldAmount1 - boldAmount2, 10, 1e18);
        vm.stopPrank();

        uint256 troveCollBefore = troveManager.getTroveEntireColl(troveId);
        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 collBalanceBeforeA = collToken.balanceOf(A);
        uint256 collBalanceBeforeB = collToken.balanceOf(B);

        // Adjust (withdraw coll and Bold)
        vm.startPrank(B);
        gasCompZapper.adjustZombieTrove(troveId, collAmount2, false, boldAmount2, true, 0, 0, boldAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), troveCollBefore - collAmount2, "Trove coll mismatch");
        assertApproxEqAbs(troveManager.getTroveEntireDebt(troveId), 2 * boldAmount2, 2e18, "Trove  debt mismatch");
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(collToken.balanceOf(A), collBalanceBeforeA + collAmount2, "A Coll bal mismatch");
        assertEq(boldToken.balanceOf(B), 0, "B BOLD bal mismatch");
        assertEq(collToken.balanceOf(B), collBalanceBeforeB, "B Coll bal mismatch");
    }

    function testCannotAdjustZombieTroveWithdrawCollAndBoldIfZapperIsNotReceiver() external {
        uint256 collAmount1 = 10 ether;
        uint256 collAmount2 = 1 ether;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount1,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        vm.startPrank(A);
        // Add a remove manager for the zapper
        gasCompZapper.setRemoveManagerWithReceiver(troveId, B, A);
        // Change receiver in BO
        borrowerOperations.setRemoveManagerWithReceiver(troveId, address(gasCompZapper), B);
        vm.stopPrank();

        // Redeem to make trove zombie
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(boldAmount1 - boldAmount2, 10, 1e18);
        vm.stopPrank();

        // Adjust (withdraw coll and Bold)
        vm.startPrank(B);
        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        gasCompZapper.adjustZombieTrove(troveId, collAmount2, false, boldAmount2, true, 0, 0, boldAmount2);
        vm.stopPrank();
    }

    function testCanCloseTrove() external {
        uint256 collAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        uint256 ethBalanceBefore = A.balance;
        uint256 collBalanceBefore = collToken.balanceOf(A);

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        // open a 2nd trove so we can close the 1st one, and send Bold to account for interest and fee
        vm.startPrank(B);
        deal(address(WETH), B, ETH_GAS_COMPENSATION);
        WETH.approve(address(borrowerOperations), ETH_GAS_COMPENSATION);
        deal(address(collToken), B, 100 ether);
        collToken.approve(address(borrowerOperations), 100 ether);
        borrowerOperations.openTrove(
            B,
            0, // index,
            100 ether, // coll,
            10000e18, //boldAmount,
            0, // _upperHint
            0, // _lowerHint
            MIN_ANNUAL_INTEREST_RATE, // annualInterestRate,
            10000e18, // upfrontFee
            address(0),
            address(0),
            address(0)
        );
        boldToken.transfer(A, troveManager.getTroveEntireDebt(troveId) - boldAmount);
        vm.stopPrank();

        vm.startPrank(A);
        boldToken.approve(address(gasCompZapper), type(uint256).max);
        gasCompZapper.closeTroveToRawETH(troveId);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), 0, "Coll mismatch");
        assertEq(troveManager.getTroveEntireDebt(troveId), 0, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), 0, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore, "ETH bal mismatch");
        assertEq(collToken.balanceOf(A), collBalanceBefore, "Coll bal mismatch");
    }

    function testCannotCloseTroveIfZapperIsNotReceiver() external {
        uint256 collAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        // open a 2nd trove so we can close the 1st one, and send Bold to account for interest and fee
        vm.startPrank(B);
        deal(address(WETH), B, ETH_GAS_COMPENSATION);
        WETH.approve(address(borrowerOperations), ETH_GAS_COMPENSATION);
        deal(address(collToken), B, 100 ether);
        collToken.approve(address(borrowerOperations), 100 ether);
        borrowerOperations.openTrove(
            B,
            0, // index,
            100 ether, // coll,
            10000e18, //boldAmount,
            0, // _upperHint
            0, // _lowerHint
            MIN_ANNUAL_INTEREST_RATE, // annualInterestRate,
            10000e18, // upfrontFee
            address(0),
            address(0),
            address(0)
        );
        boldToken.transfer(A, troveManager.getTroveEntireDebt(troveId) - boldAmount);
        vm.stopPrank();

        vm.startPrank(A);
        // Change receiver in BO
        borrowerOperations.setRemoveManagerWithReceiver(troveId, address(gasCompZapper), C);
        boldToken.approve(address(gasCompZapper), type(uint256).max);
        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        gasCompZapper.closeTroveToRawETH(troveId);
        vm.stopPrank();
    }

    function testExcessRepaymentByAdjustGoesBackToUser() external {
        uint256 collAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 ethBalanceBefore = A.balance;
        uint256 collBalanceBefore = collToken.balanceOf(A);
        uint256 boldDebtBefore = troveManager.getTroveEntireDebt(troveId);

        // Adjust trove: remove 1 ETH and try to repay 9k (only will repay ~8k, up to MIN_DEBT)
        vm.startPrank(A);
        boldToken.approve(address(gasCompZapper), type(uint256).max);
        gasCompZapper.adjustTrove(troveId, 1 ether, false, 9000e18, false, 0);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldAmount + MIN_DEBT - boldDebtBefore, "BOLD bal mismatch");
        assertEq(boldToken.balanceOf(address(gasCompZapper)), 0, "Zapper BOLD bal should be zero");
        assertEq(A.balance, ethBalanceBefore, "ETH bal mismatch");
        assertEq(address(gasCompZapper).balance, 0, "Zapper ETH bal should be zero");
        assertEq(collToken.balanceOf(A), collBalanceBefore + 1 ether, "Coll bal mismatch");
        assertEq(collToken.balanceOf(address(gasCompZapper)), 0, "Zapper Coll bal should be zero");
    }

    function testExcessRepaymentByRepayGoesBackToUser() external {
        uint256 collAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collAmount,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = gasCompZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 boldDebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 collBalanceBefore = collToken.balanceOf(A);

        // Adjust trove: try to repay 9k (only will repay ~8k, up to MIN_DEBT)
        vm.startPrank(A);
        boldToken.approve(address(gasCompZapper), type(uint256).max);
        gasCompZapper.repayBold(troveId, 9000e18);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldAmount + MIN_DEBT - boldDebtBefore, "BOLD bal mismatch");
        assertEq(boldToken.balanceOf(address(gasCompZapper)), 0, "Zapper BOLD bal should be zero");
        assertEq(address(gasCompZapper).balance, 0, "Zapper ETH bal should be zero");
        assertEq(collToken.balanceOf(A), collBalanceBefore, "Coll bal mismatch");
        assertEq(collToken.balanceOf(address(gasCompZapper)), 0, "Zapper Coll bal should be zero");
    }

    // TODO: tests for add/remove managers of zapper contract
}
