// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";
import "./TestContracts/WETH.sol";
import "src/Zappers/WETHZapper.sol";
import "./TestContracts/ERC20Faucet6.sol";
import "src/ERC20Wrappers/WrappedToken.sol";
import "src/Zappers/WrappedTokenZapper.sol";
import "src/Interfaces/IWrappedToken.sol";

contract ZapperWrappedTokenTest is DevTestSetup {
    ERC20Faucet6 underlyingToken;
    IWrappedToken wrappedToken;

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
        underlyingToken = new ERC20Faucet6("Underlying Token", "UND", 10000e6, 1 days);
        wrappedToken = IWrappedToken(address(new WrappedToken(underlyingToken)));

        TestDeployer.TroveManagerParams[] memory troveManagerParams = new TestDeployer.TroveManagerParams[](2);
        troveManagerParams[0] = TestDeployer.TroveManagerParams(150e16, 110e16, 10e16, 110e16, 10_000_000e18, 5e16, 10e16, 0);
        troveManagerParams[1] = TestDeployer.TroveManagerParams(150e16, 110e16, 10e16, 110e16, 10_000_000e18, 5e16, 10e16, 1);

        TestDeployer deployer = new TestDeployer();
        TestDeployer.LiquityContractsDev[] memory contractsArray;
        TestDeployer.Zappers[] memory zappersArray;
        (contractsArray, collateralRegistry, boldToken,,, zappersArray) =
            deployer.deployAndConnectContracts(troveManagerParams, WETH, wrappedToken);

        // Set price feeds
        contractsArray[0].priceFeed.setPrice(2000e18);
        contractsArray[1].priceFeed.setPrice(2000e18);

        // Give some Collateral to test accounts
        uint256 initialCollateralAmount = 10_000e6;

        // Set first branch as default
        addressesRegistry = contractsArray[1].addressesRegistry;
        borrowerOperations = contractsArray[1].borrowerOperations;
        troveManager = contractsArray[1].troveManager;
        troveNFT = contractsArray[1].troveNFT;
        collToken = contractsArray[1].collToken;
        wrappedTokenZapper = zappersArray[1].wrappedTokenZapper;

        // A to F
        for (uint256 i = 0; i < 6; i++) {
            // Give and approve some underlying token to test accounts
            deal(address(underlyingToken), accountsList[i], initialCollateralAmount);
            vm.startPrank(accountsList[i]);
            underlyingToken.approve(address(wrappedTokenZapper), initialCollateralAmount);
            vm.stopPrank();
        }
    }

    function testCanOpenTrove() external {
        uint256 underlyingAmount = 10e6;
        uint256 boldAmount = 10000e18;

        uint256 underlyingBalanceBefore = underlyingToken.balanceOf(A);
        uint256 expectedWrappedAmount = wrappedTokenZapper.convertUnderlyingToWrapped(underlyingAmount);

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        assertEq(troveNFT.ownerOf(troveId), A, "Wrong owner");
        assertGt(troveId, 0, "Trove id should be set");
        assertEq(troveManager.getTroveEntireColl(troveId), expectedWrappedAmount, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(A), underlyingBalanceBefore - underlyingAmount, "Underlying bal mismatch");
    }

    function testCanOpenTroveWithBatchManager() external {
        uint256 underlyingAmount = 10e6;
        uint256 boldAmount = 10000e18;

        uint256 underlyingBalanceBefore = underlyingToken.balanceOf(A);
        uint256 expectedWrappedAmount = wrappedTokenZapper.convertUnderlyingToWrapped(underlyingAmount);

        registerBatchManager(B);

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        assertEq(troveNFT.ownerOf(troveId), A, "Wrong owner");
        assertGt(troveId, 0, "Trove id should be set");
        assertEq(troveManager.getTroveEntireColl(troveId), expectedWrappedAmount, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(A), underlyingBalanceBefore - underlyingAmount, "Underlying bal mismatch");
        assertEq(borrowerOperations.interestBatchManagerOf(troveId), B, "Wrong batch manager");
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(troveId);
        assertEq(tmBatchManagerAddress, B, "Wrong batch manager (TM)");
    }

    function testCanNotOpenTroveWithBatchManagerAndInterest() external {
        uint256 underlyingAmount = 10e6;
        uint256 boldAmount = 10000e18;

        registerBatchManager(B);

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount,
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
        vm.expectRevert("WTZ: Cannot choose interest if joining a batch");
        wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();
    }

    function testCanAddColl() external {
        uint256 underlyingAmount1 = 10e6;
        uint256 boldAmount = 10000e18;
        uint256 underlyingAmount2 = 5e6;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        uint256 underlyingBalanceBefore = underlyingToken.balanceOf(A);
        vm.startPrank(A);
        wrappedTokenZapper.addCollWithRawETH(troveId, underlyingAmount2);
        vm.stopPrank();

        uint256 expectedWrappedAmount = wrappedTokenZapper.convertUnderlyingToWrapped(underlyingAmount1 + underlyingAmount2);

        assertEq(troveManager.getTroveEntireColl(troveId), expectedWrappedAmount, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(A), underlyingBalanceBefore - underlyingAmount2, "Underlying bal mismatch");
    }

    function testCanWithdrawColl() external {
        uint256 underlyingAmount1 = 10e6;
        uint256 boldAmount = 10000e18;
        uint256 underlyingAmount2 = 1e6;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        uint256 underlyingBalanceBefore = underlyingToken.balanceOf(A);
        vm.startPrank(A);
        wrappedTokenZapper.withdrawCollToRawETH(troveId, underlyingAmount2);
        vm.stopPrank();

        uint256 expectedWrappedAmountAfterWithdrawal = wrappedTokenZapper.convertUnderlyingToWrapped(underlyingAmount1 - underlyingAmount2);

        assertEq(troveManager.getTroveEntireColl(troveId), expectedWrappedAmountAfterWithdrawal, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(A), underlyingBalanceBefore + underlyingAmount2, "Underlying bal mismatch");
    }

    function testCannotWithdrawCollIfZapperIsNotReceiver() external {
        uint256 underlyingAmount1 = 10e6;
        uint256 boldAmount = 10000e18;
        uint256 underlyingAmount2 = 1e6;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        vm.startPrank(A);
        // Change receiver in BO
        borrowerOperations.setRemoveManagerWithReceiver(troveId, address(wrappedTokenZapper), B);
        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        wrappedTokenZapper.withdrawCollToRawETH(troveId, underlyingAmount2);
        vm.stopPrank();
    }

    function testCanNotAddReceiverWithoutRemoveManager() external {
        uint256 underlyingAmount1 = 10e6;
        uint256 boldAmount1 = 10000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        // Try to add a receiver for the zapper without remove manager
        vm.startPrank(A);
        vm.expectRevert(AddRemoveManagers.EmptyManager.selector);
        wrappedTokenZapper.setRemoveManagerWithReceiver(troveId, address(0), B);
        vm.stopPrank();
    }

    function testCanRepayBold() external {
        uint256 underlyingAmount = 10e6;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 underlyingBalanceBeforeA = underlyingToken.balanceOf(A);
        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 underlyingBalanceBeforeB = underlyingToken.balanceOf(B);

        // Add a remove manager for the zapper, and send bold
        vm.startPrank(A);
        wrappedTokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        boldToken.transfer(B, boldAmount2);
        vm.stopPrank();

        // Approve and repay
        vm.startPrank(B);
        boldToken.approve(address(wrappedTokenZapper), boldAmount2);
        wrappedTokenZapper.repayBold(troveId, boldAmount2);
        vm.stopPrank();

        uint256 expectedWrappedAmount = wrappedTokenZapper.convertUnderlyingToWrapped(underlyingAmount);

        assertEq(troveManager.getTroveEntireColl(troveId), expectedWrappedAmount, "Trove coll mismatch");
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId), boldAmount1 - boldAmount2, 2e18, "Trove  debt mismatch"
        );
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA - boldAmount2, "A BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(A), underlyingBalanceBeforeA, "A Underlying bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB, "B BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(B), underlyingBalanceBeforeB, "B Underlying bal mismatch");
    }

    function testCanWithdrawBold() external {
        uint256 underlyingAmount = 10e6;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 underlyingBalanceBeforeA = underlyingToken.balanceOf(A);
        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 underlyingBalanceBeforeB = underlyingToken.balanceOf(B);

        // Add a remove manager for the zapper
        vm.startPrank(A);
        wrappedTokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        vm.stopPrank();

        // Withdraw bold
        vm.startPrank(B);
        wrappedTokenZapper.withdrawBold(troveId, boldAmount2, boldAmount2);
        vm.stopPrank();

        uint256 expectedWrappedAmount = wrappedTokenZapper.convertUnderlyingToWrapped(underlyingAmount);

        assertEq(troveManager.getTroveEntireColl(troveId), expectedWrappedAmount, "Trove coll mismatch");
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId), boldAmount1 + boldAmount2, 2e18, "Trove  debt mismatch"
        );
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(A), underlyingBalanceBeforeA, "A Underlying bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB, "B BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(B), underlyingBalanceBeforeB, "B Underlying bal mismatch");
    }

    function testCannotWithdrawBoldIfZapperIsNotReceiver() external {
        uint256 underlyingAmount = 10e6;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        // Add a remove manager for the zapper
        vm.startPrank(A);
        wrappedTokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        // Change receiver in BO
        borrowerOperations.setRemoveManagerWithReceiver(troveId, address(wrappedTokenZapper), C);
        vm.stopPrank();

        // Withdraw bold
        vm.startPrank(B);
        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        wrappedTokenZapper.withdrawBold(troveId, boldAmount2, boldAmount2);
        vm.stopPrank();
    }

    // TODO: more adjustment combinations
    function testCanAdjustTroveWithdrawCollAndBold() external {
        uint256 underlyingAmount1 = 10e6;
        uint256 underlyingAmount2 = 1e6;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 underlyingBalanceBeforeA = underlyingToken.balanceOf(A);
        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 underlyingBalanceBeforeB = underlyingToken.balanceOf(B);

        // Add a remove manager for the zapper
        vm.startPrank(A);
        wrappedTokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        vm.stopPrank();

        // Adjust (withdraw coll and Bold)
        vm.startPrank(B);
        wrappedTokenZapper.adjustTroveWithRawETH(troveId, underlyingAmount2, false, boldAmount2, true, boldAmount2);
        vm.stopPrank();

        uint256 expectedWrappedAmountAfterAdjustment = wrappedTokenZapper.convertUnderlyingToWrapped(underlyingAmount1 - underlyingAmount2);

        assertEq(troveManager.getTroveEntireColl(troveId), expectedWrappedAmountAfterAdjustment, "Trove coll mismatch");
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId), boldAmount1 + boldAmount2, 2e18, "Trove  debt mismatch"
        );
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(A), underlyingBalanceBeforeA + underlyingAmount2, "A Underlying bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB, "B BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(B), underlyingBalanceBeforeB, "B Underlying bal mismatch");
    }

    function testCannotAdjustTroveWithdrawCollAndBoldIfZapperIsNotReceiver() external {
        uint256 underlyingAmount1 = 10e6;
        uint256 underlyingAmount2 = 1e6;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        vm.startPrank(A);
        // Add a remove manager for the zapper
        wrappedTokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        // Change receiver in BO
        borrowerOperations.setRemoveManagerWithReceiver(troveId, address(wrappedTokenZapper), C);
        vm.stopPrank();

        // Adjust (withdraw coll and Bold)
        vm.startPrank(B);
        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        wrappedTokenZapper.adjustTroveWithRawETH(troveId, underlyingAmount2, false, boldAmount2, true, boldAmount2);
        vm.stopPrank();
    }

    function testCanAdjustTroveAddCollAndBold() external {
        uint256 underlyingAmount1 = 10e6;
        uint256 underlyingAmount2 = 1e6;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        // A sends Bold to B
        boldToken.transfer(B, boldAmount2);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 underlyingBalanceBeforeA = underlyingToken.balanceOf(A);
        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 underlyingBalanceBeforeB = underlyingToken.balanceOf(B);

        // Add an add manager for the zapper
        vm.startPrank(A);
        wrappedTokenZapper.setAddManager(troveId, B);
        vm.stopPrank();

        // Adjust (add coll and Bold)
        vm.startPrank(B);
        boldToken.approve(address(wrappedTokenZapper), boldAmount2);
        wrappedTokenZapper.adjustTroveWithRawETH(troveId, underlyingAmount2, true, boldAmount2, false, boldAmount2);
        vm.stopPrank();

        uint256 expectedWrappedAmountAfterAdjustment = wrappedTokenZapper.convertUnderlyingToWrapped(underlyingAmount1 + underlyingAmount2);

        assertEq(troveManager.getTroveEntireColl(troveId), expectedWrappedAmountAfterAdjustment, "Trove coll mismatch");
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId), boldAmount1 - boldAmount2, 2e18, "Trove  debt mismatch"
        );
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA, "A BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(A), underlyingBalanceBeforeA, "A Underlying bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB - boldAmount2, "B BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(B), underlyingBalanceBeforeB - underlyingAmount2, "B Underlying bal mismatch");
    }

    function testCanAdjustZombieTroveWithdrawCollAndBold() external {
        uint256 underlyingAmount1 = 10e6;
        uint256 underlyingAmount2 = 1e6;
        uint256 boldAmount1 = 1000e18;
        uint256 boldAmount2 = 100e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 100e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        // Add a remove manager for the zapper
        vm.startPrank(A);
        wrappedTokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        vm.stopPrank();

        // Redeem to make trove zombie
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(boldAmount1 - boldAmount2, 10, 1e18);
        vm.stopPrank();

        uint256 troveCollBefore = troveManager.getTroveEntireColl(troveId);
        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 underlyingBalanceBeforeA = underlyingToken.balanceOf(A);
        uint256 underlyingBalanceBeforeB = underlyingToken.balanceOf(B);

        // Adjust (withdraw coll and Bold)
        vm.startPrank(B);
        wrappedTokenZapper.adjustZombieTroveWithRawETH(troveId, underlyingAmount2, false, boldAmount2, true, 0, 0, boldAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), troveCollBefore - wrappedTokenZapper.convertUnderlyingToWrapped(underlyingAmount2), "Trove coll mismatch");
        assertApproxEqAbs(troveManager.getTroveEntireDebt(troveId), 2 * boldAmount2, 2e18, "Trove  debt mismatch");
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(A), underlyingBalanceBeforeA + underlyingAmount2, "A Underlying bal mismatch");
        assertEq(boldToken.balanceOf(B), 0, "B BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(B), underlyingBalanceBeforeB, "B Underlying bal mismatch");
    }

    function testCannotAdjustZombieTroveWithdrawCollAndBoldIfZapperIsNotReceiver() external {
        uint256 underlyingAmount1 = 10e6;
        uint256 underlyingAmount2 = 1e6;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        vm.startPrank(A);
        // Add a remove manager for the zapper
        wrappedTokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        // Change receiver in BO
        borrowerOperations.setRemoveManagerWithReceiver(troveId, address(wrappedTokenZapper), C);
        vm.stopPrank();

        // Redeem to make trove zombie
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(boldAmount1 - boldAmount2, 10, 1e18);
        vm.stopPrank();

        // Adjust (withdraw coll and Bold)
        vm.startPrank(B);
        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        wrappedTokenZapper.adjustZombieTroveWithRawETH(troveId, underlyingAmount2, false, boldAmount2, true, 0, 0, boldAmount2);
        vm.stopPrank();
    }

    function testCanAdjustZombieTroveAddCollAndWithdrawBold() external {
        uint256 underlyingAmount1 = 1e6;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
            boldAmount: 1000e18,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        // Add a remove manager for the zapper
        vm.startPrank(A);
        wrappedTokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        vm.stopPrank();

        uint256 underlyingAmount2 = 1e5;
        uint256 boldAmount2 = 100e18;

        // Redeem to make trove zombie
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(1000e18 - boldAmount2, 10, 1e18);
        vm.stopPrank();

        uint256 troveCollBefore = troveManager.getTroveEntireColl(troveId);
        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 underlyingBalanceBeforeA = underlyingToken.balanceOf(A);
        uint256 underlyingBalanceBeforeB = underlyingToken.balanceOf(B);

        // Adjust (add coll and withdraw Bold)
        vm.startPrank(B);
        wrappedTokenZapper.adjustZombieTroveWithRawETH(
            troveId, underlyingAmount2, true, boldAmount2, true, 0, 0, boldAmount2
        );
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), troveCollBefore + wrappedTokenZapper.convertUnderlyingToWrapped(underlyingAmount2), "Trove coll mismatch");
        assertApproxEqAbs(troveManager.getTroveEntireDebt(troveId), 2 * boldAmount2, 2e18, "Trove  debt mismatch");
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(A), underlyingBalanceBeforeA, "A ETH bal mismatch");
        assertEq(boldToken.balanceOf(B), 0, "B BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(B), underlyingBalanceBeforeB - underlyingAmount2, "B Underlying bal mismatch");
    }

    function testCannotAdjustZombieTroveAddCollAndWithdrawBoldIfZapperIsNotReceiver() external {
        uint256 underlyingAmount1 = 1e6;
        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
            boldAmount: 1000e18,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: MIN_ANNUAL_INTEREST_RATE,
            batchManager: address(0),
            maxUpfrontFee: 100e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        vm.startPrank(A);
        // Add a remove manager for the zapper
        wrappedTokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        // Change receiver in BO
        borrowerOperations.setRemoveManagerWithReceiver(troveId, address(wrappedTokenZapper), C);
        vm.stopPrank();

        uint256 underlyingAmount2 = 1e5;
        uint256 boldAmount2 = 100e18;

        // Redeem to make trove zombie
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(1000e18 - boldAmount2, 10, 1e18);
        vm.stopPrank();

        // Adjust (add coll and withdraw Bold)
        vm.startPrank(B);
        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        wrappedTokenZapper.adjustZombieTroveWithRawETH(
            troveId, underlyingAmount2, true, boldAmount2, true, 0, 0, boldAmount2
        );
        vm.stopPrank();
    }

    function testCanCloseTrove() external {
        uint256 underlyingAmount1 = 10e6;
        uint256 boldAmount = 10000e18;

        uint256 underlyingBalanceBefore = underlyingToken.balanceOf(A);

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        // open a 2nd trove so we can close the 1st one, and send Bold to account for interest and fee
        vm.startPrank(B);
        deal(address(underlyingToken), B, 100e6);
        underlyingToken.approve(address(wrappedToken), 100e6);
        wrappedToken.depositFor(address(B), 100e6);
        wrappedToken.approve(address(borrowerOperations), 100 ether);
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
        boldToken.approve(address(wrappedTokenZapper), type(uint256).max);
        wrappedTokenZapper.closeTroveToRawETH(troveId);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), 0, "Coll mismatch");
        assertEq(troveManager.getTroveEntireDebt(troveId), 0, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), 0, "BOLD bal mismatch");
        assertEq(underlyingToken.balanceOf(A), underlyingBalanceBefore, "Underlying bal mismatch");
    }

    function testCannotCloseTroveIfZapperIsNotReceiver() external {
        uint256 underlyingAmount1 = 10e6;
        uint256 boldAmount = 10000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        // open a 2nd trove so we can close the 1st one, and send Bold to account for interest and fee
        vm.startPrank(B);
        deal(address(underlyingToken), B, 100e6);
        underlyingToken.approve(address(wrappedToken), 100e6);
        wrappedToken.depositFor(address(B), 100e6);
        wrappedToken.approve(address(borrowerOperations), 100 ether);
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
        borrowerOperations.setRemoveManagerWithReceiver(troveId, address(wrappedTokenZapper), C);

        boldToken.approve(address(wrappedTokenZapper), type(uint256).max);
        vm.expectRevert("BZ: Zapper is not receiver for this trove");
        wrappedTokenZapper.closeTroveToRawETH(troveId);
        vm.stopPrank();
    }

    function testExcessRepaymentByAdjustGoesBackToUser() external {
        uint256 underlyingAmount1 = 10e6;
        uint256 boldAmount = 10000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        uint256 underlyingBalanceBefore = underlyingToken.balanceOf(A);
        uint256 collBalanceBefore = wrappedToken.balanceOf(A);
        uint256 boldDebtBefore = troveManager.getTroveEntireDebt(troveId);

        // Adjust trove: remove 1 ETH and try to repay 9.9k (only will repay ~8.8k, up to MIN_DEBT)
        vm.startPrank(A);
        boldToken.approve(address(wrappedTokenZapper), type(uint256).max);
        wrappedTokenZapper.adjustTroveWithRawETH(troveId, 1e6, false, 9900e18, false, 0);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldAmount + MIN_DEBT - boldDebtBefore, "BOLD bal mismatch");
        assertEq(boldToken.balanceOf(address(wrappedTokenZapper)), 0, "Zapper BOLD bal should be zero");
        assertEq(underlyingToken.balanceOf(A), underlyingBalanceBefore + 1e6, "Underlying bal mismatch");
        assertEq(address(wrappedTokenZapper).balance, 0, "Zapper ETH bal should be zero");
        assertEq(wrappedToken.balanceOf(A), collBalanceBefore, "Coll bal mismatch");
        assertEq(wrappedToken.balanceOf(address(wrappedTokenZapper)), 0, "Zapper Coll bal should be zero");
    }

    function testExcessRepaymentByRepayGoesBackToUser() external {
        uint256 underlyingAmount1 = 10e6;
        uint256 boldAmount = 10000e18;

        IZapper.OpenTroveParams memory params = IZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: underlyingAmount1,
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
        uint256 troveId = wrappedTokenZapper.openTroveWithRawETH(params);
        vm.stopPrank();

        uint256 boldDebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 collBalanceBefore = wrappedToken.balanceOf(A);

        // Adjust trove: try to repay 9.9k (only will repay ~8.8k, up to MIN_DEBT)
        vm.startPrank(A);
        boldToken.approve(address(wrappedTokenZapper), type(uint256).max);
        wrappedTokenZapper.repayBold(troveId, 9900e18);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldAmount + MIN_DEBT - boldDebtBefore, "BOLD bal mismatch");
        assertEq(boldToken.balanceOf(address(wrappedTokenZapper)), 0, "Zapper BOLD bal should be zero");
        assertEq(address(wrappedTokenZapper).balance, 0, "Zapper ETH bal should be zero");
        assertEq(wrappedToken.balanceOf(A), collBalanceBefore, "Coll bal mismatch");
        assertEq(wrappedToken.balanceOf(address(wrappedTokenZapper)), 0, "Zapper Coll bal should be zero");
    }

    // TODO: tests for add/remove managers of zapper contract
}
