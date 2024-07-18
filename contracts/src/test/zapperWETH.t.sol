pragma solidity ^0.8.18;

import "./TestContracts/DevTestSetup.sol";
import "./TestContracts/WETH.sol";
import "../Zappers/WETHZapper.sol";

contract ZapperWETHTest is DevTestSetup {
    WETHZapper wethZapper;

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

        TroveManagerParams[] memory troveManagerParams = new TroveManagerParams[](1);
        troveManagerParams[0] = TroveManagerParams(110e16, 110e16, 5e16, 10e16);

        LiquityContractsDev[] memory contractsArray;
        (contractsArray, collateralRegistry, boldToken,,) = _deployAndConnectContracts(troveManagerParams, WETH);

        // Set price feeds
        contractsArray[0].priceFeed.setPrice(2000e18);

        // Give some Collateral to test accounts
        uint256 initialCollateralAmount = 10_000e18;

        // A to F
        for (uint256 i = 0; i < 6; i++) {
            // Give some raw ETH to test accounts
            deal(accountsList[i], initialCollateralAmount);
        }

        // Set first branch as default
        borrowerOperations = contractsArray[0].borrowerOperations;
        troveManager = contractsArray[0].troveManager;

        // Deploy zapper (TODO: should we move it to deployment.sol?)
        wethZapper = new WETHZapper(troveManager);
    }

    function testCanOpenTrove() external {
        uint256 ethAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        uint256 ethBalanceBefore = A.balance;

        WETHZapper.OpenTroveParams memory params = WETHZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 5e16,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        uint256 troveId = wethZapper.openTroveWithRawETH{value: ethAmount + ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        assertEq(troveManager.ownerOf(troveId), A, "Wrong owner");
        assertGt(troveId, 0, "Trove id should be set");
        assertEq(troveManager.getTroveEntireColl(troveId), ethAmount, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore - (ethAmount + ETH_GAS_COMPENSATION), "ETH bal mismatch");
    }

    function testCanAddColl() external {
        uint256 ethAmount1 = 10 ether;
        uint256 boldAmount = 10000e18;
        uint256 ethAmount2 = 5 ether;

        WETHZapper.OpenTroveParams memory params = WETHZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 5e16,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        uint256 troveId = wethZapper.openTroveWithRawETH{value: ethAmount1 + ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 ethBalanceBefore = A.balance;
        vm.startPrank(A);
        wethZapper.addCollWithRawETH{value: ethAmount2}(troveId);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), ethAmount1 + ethAmount2, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore - ethAmount2, "ETH bal mismatch");
    }

    function testCanWithdrawColl() external {
        uint256 ethAmount1 = 10 ether;
        uint256 boldAmount = 10000e18;
        uint256 ethAmount2 = 1 ether;

        WETHZapper.OpenTroveParams memory params = WETHZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 5e16,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        uint256 troveId = wethZapper.openTroveWithRawETH{value: ethAmount1 + ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 ethBalanceBefore = A.balance;
        vm.startPrank(A);
        wethZapper.withdrawCollToRawETH(troveId, ethAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), ethAmount1 - ethAmount2, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore + ethAmount2, "ETH bal mismatch");
    }

    function testCanRepayBold() external {
        uint256 ethAmount = 10 ether;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        WETHZapper.OpenTroveParams memory params = WETHZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 0,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        uint256 troveId = wethZapper.openTroveWithRawETH{value: ethAmount + ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 ethBalanceBeforeA = A.balance;
        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 ethBalanceBeforeB = B.balance;

        // Add a remove manager for the zapper, and send bold
        vm.startPrank(A);
        wethZapper.setRemoveManager(troveId, B, A);
        boldToken.transfer(B, boldAmount2);
        vm.stopPrank();

        // Approve and repay
        vm.startPrank(B);
        boldToken.approve(address(wethZapper), boldAmount2);
        wethZapper.repayBold(troveId, boldAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), ethAmount, "Trove coll mismatch");
        assertEq(troveManager.getTroveEntireDebt(troveId), boldAmount1 - boldAmount2, "Trove  debt mismatch");
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA - boldAmount2, "A BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBeforeA, "A ETH bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB, "B BOLD bal mismatch");
        assertEq(B.balance, ethBalanceBeforeB, "B ETH bal mismatch");
    }

    function testCanWithdrawBold() external {
        uint256 ethAmount = 10 ether;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        WETHZapper.OpenTroveParams memory params = WETHZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 0,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        uint256 troveId = wethZapper.openTroveWithRawETH{value: ethAmount + ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 ethBalanceBeforeA = A.balance;
        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 ethBalanceBeforeB = B.balance;

        // Add a remove manager for the zapper
        vm.startPrank(A);
        wethZapper.setRemoveManager(troveId, B, A);
        vm.stopPrank();

        // Withdraw bold
        vm.startPrank(B);
        wethZapper.withdrawBold(troveId, boldAmount2, boldAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), ethAmount, "Trove coll mismatch");
        assertEq(troveManager.getTroveEntireDebt(troveId), boldAmount1 + boldAmount2, "Trove  debt mismatch");
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBeforeA, "A ETH bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB, "B BOLD bal mismatch");
        assertEq(B.balance, ethBalanceBeforeB, "B ETH bal mismatch");
    }

    // TODO: more adjustment combinations
    function testCanAdjustTroveWithdrawCollAndBold() external {
        uint256 ethAmount1 = 10 ether;
        uint256 ethAmount2 = 1 ether;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        WETHZapper.OpenTroveParams memory params = WETHZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 0,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        uint256 troveId = wethZapper.openTroveWithRawETH{value: ethAmount1 + ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 ethBalanceBeforeA = A.balance;
        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 ethBalanceBeforeB = B.balance;

        // Add a remove manager for the zapper
        vm.startPrank(A);
        wethZapper.setRemoveManager(troveId, B, A);
        vm.stopPrank();

        // Adjust (withdraw coll and Bold)
        vm.startPrank(B);
        wethZapper.adjustTroveWithRawETH(troveId, ethAmount2, false, boldAmount2, true, boldAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), ethAmount1 - ethAmount2, "Trove coll mismatch");
        assertEq(troveManager.getTroveEntireDebt(troveId), boldAmount1 + boldAmount2, "Trove  debt mismatch");
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBeforeA + ethAmount2, "A ETH bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB, "B BOLD bal mismatch");
        assertEq(B.balance, ethBalanceBeforeB, "B ETH bal mismatch");
    }

    // TODO: more adjustment combinations
    function testCanAdjustUnredeemableTroveWithdrawCollAndBold() external {
        uint256 ethAmount1 = 10 ether;
        uint256 ethAmount2 = 1 ether;
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        WETHZapper.OpenTroveParams memory params = WETHZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            boldAmount: boldAmount1,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 0,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        uint256 troveId = wethZapper.openTroveWithRawETH{value: ethAmount1 + ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        // Add a remove manager for the zapper
        vm.startPrank(A);
        wethZapper.setRemoveManager(troveId, B, A);
        vm.stopPrank();

        // Redeem to make trove unredeemable
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(boldAmount1 - boldAmount2, 10, 1e18);
        vm.stopPrank();

        uint256 troveCollBefore = troveManager.getTroveEntireColl(troveId);
        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 ethBalanceBeforeA = A.balance;
        uint256 ethBalanceBeforeB = B.balance;

        // Adjust (withdraw coll and Bold)
        vm.startPrank(B);
        wethZapper.adjustUnredeemableTroveWithRawETH(troveId, ethAmount2, false, boldAmount2, true, 0, 0, boldAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), troveCollBefore - ethAmount2, "Trove coll mismatch");
        assertEq(troveManager.getTroveEntireDebt(troveId), 2 * boldAmount2, "Trove  debt mismatch");
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBeforeA + ethAmount2, "A ETH bal mismatch");
        assertEq(boldToken.balanceOf(B), 0, "B BOLD bal mismatch");
        assertEq(B.balance, ethBalanceBeforeB, "B ETH bal mismatch");
    }

    function testCanCloseTrove() external {
        uint256 ethAmount = 10 ether;
        uint256 boldAmount = 10000e18;

        uint256 ethBalanceBefore = A.balance;

        WETHZapper.OpenTroveParams memory params = WETHZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 0,
            maxUpfrontFee: 1000e18
        });
        vm.startPrank(A);
        uint256 troveId = wethZapper.openTroveWithRawETH{value: ethAmount + ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        // open a 2nd trove so we can close the 1st one
        //openTroveNoHints100pct(B, 100 ether, 100_000e18, 0);
        vm.startPrank(B);
        deal(address(WETH), B, 100 ether + ETH_GAS_COMPENSATION);
        WETH.approve(address(borrowerOperations), 100 ether + ETH_GAS_COMPENSATION);
        borrowerOperations.openTrove(
            B,
            0, // index,
            100 ether, // coll,
            10000e18, //boldAmount,
            0, // _upperHint
            0, // _lowerHint
            0, // annualInterestRate,
            10000e18 // upfrontFee
        );
        vm.stopPrank();

        vm.startPrank(A);
        boldToken.approve(address(wethZapper), boldAmount);
        wethZapper.closeTroveToRawETH(troveId);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), 0, "Coll mismatch");
        assertEq(troveManager.getTroveEntireDebt(troveId), 0, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), 0, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore, "ETH bal mismatch");
    }
}
