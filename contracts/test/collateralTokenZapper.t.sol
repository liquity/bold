// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-contracts/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./TestContracts/DevTestSetup.sol";
import "./TestContracts/WETH.sol";
import "src/Dependencies/TokenWrapper.sol";
import "src/Zappers/CollateralZapper.sol";
import "src/Zappers/Interfaces/ITokenZapper.sol";
import {ETH_GAS_COMPENSATION} from "src/Dependencies/Constants.sol";

contract TestToken is ERC20 {
    uint8 internal _decimals;

    constructor(uint8 dec, string memory name, string memory symbol) ERC20(name, symbol) {
        _decimals = dec;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

contract WrappedTokenZapperTest is DevTestSetup {
    IERC20Metadata public collateralToken;

    CollateralZapper public tokenZapper;
    TestDeployer.LiquityContractsDev[] public contractsArray;

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

        // ETH BRANCHES
        TestDeployer.TroveManagerParams[] memory troveManagerParams = new TestDeployer.TroveManagerParams[](1);
        troveManagerParams[0] = TestDeployer.TroveManagerParams(150e16, 110e16, 10e16, 110e16, 5e16, 10e16);

        TestDeployer deployer = new TestDeployer();
        TestDeployer.Zappers[] memory zappersArray;

        TestDeployer.LiquityContractsDev[] memory _contractsArray;
        (_contractsArray, collateralRegistry, boldToken,,, zappersArray) =
            deployer.deployAndConnectContracts(troveManagerParams, WETH);

        contractsArray.push(_contractsArray[0]);

        // BTC BRANCH
        collateralToken = IERC20Metadata(new TestToken(18, "Bitcoin", "BTC"));

        TestDeployer.LiquityContractsDev memory btcBranchArray;
        (btcBranchArray,) =
            deployer.deployBranch(troveManagerParams[0], collateralToken, WETH, boldToken, collateralRegistry);

        // btc branch is index 1
        contractsArray.push(btcBranchArray);

        // Set price feeds
        contractsArray[1].priceFeed.setPrice(2000e18);

        // Give some Collateral to test accounts
        uint256 initialCollateralAmount = 10_000e18;

        addressesRegistry = contractsArray[1].addressesRegistry;
        borrowerOperations = contractsArray[1].borrowerOperations;
        troveManager = contractsArray[1].troveManager;
        troveNFT = contractsArray[1].troveNFT;

        tokenZapper = new CollateralZapper(addressesRegistry, collateralToken);

        // add branch to collateralReegistry
        uint256[] memory indexes = new uint256[](1);
        indexes[0] = 1;
        IERC20Metadata[] memory tokens = new IERC20Metadata[](1);
        tokens[0] = collateralToken;
        ITroveManager[] memory troveManagers = new ITroveManager[](1);
        troveManagers[0] = troveManager;

        vm.prank(boldToken.owner());
        collateralRegistry.addNewCollaterals(indexes, tokens, troveManagers);

        // A to F
        for (uint256 i = 0; i < 6; i++) {
            deal(accountsList[i], 10 ether);
            deal(address(collateralToken), accountsList[i], initialCollateralAmount);

            vm.prank(accountsList[i]);
            collateralToken.approve(address(tokenZapper), type(uint256).max);
        }
    }

    function testCanOpenTroveWithRawTokenWithBatchManager() external {
        uint256 collateralAmount = 10e18;
        
        uint256 boldAmount = 10000e18;

        uint256 ethBalanceBefore = A.balance;

        registerBatchManager(B);

        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collateralAmount,
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
        uint256 troveId = tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        assertEq(troveNFT.ownerOf(troveId), A, "Wrong owner");
        assertGt(troveId, 0, "Trove id should be set");
        assertEq(troveManager.getTroveEntireColl(troveId), collateralAmount, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore - ETH_GAS_COMPENSATION, "ETH bal mismatch");
        assertEq(borrowerOperations.interestBatchManagerOf(troveId), B, "Wrong batch manager");
        (,,,,,,,, address tmBatchManagerAddress,) = troveManager.Troves(troveId);
        assertEq(tmBatchManagerAddress, B, "Wrong batch manager (TM)");
    }

    function testCanNotOpenTroveWithBatchManagerAndInterest() external {
        uint256 collateralAmount = 10e18;
        uint256 boldAmount = 10000e18;

        registerBatchManager(B);

        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collateralAmount,
            boldAmount: boldAmount,
            upperHint: 0,
            lowerHint: 0,
            annualInterestRate: 500e16,
            batchManager: B,
            maxUpfrontFee: 1000e18,
            addManager: address(0),
            removeManager: address(0),
            receiver: address(0)
        });
        vm.startPrank(A);
        vm.expectRevert("WZ: Cannot choose interest if joining a batch");
        tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();
    }

    function testCanAddColl() external {
        uint256 collateralAmount = 10e18;
        uint256 collateralAmount2 = 5e18;

        uint256 boldAmount = 10000e18;

        uint256 ethBalanceBefore = A.balance;

        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collateralAmount,
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
        uint256 troveId = tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        vm.startPrank(A);
        tokenZapper.addCollWithRawETH(troveId, collateralAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), collateralAmount + collateralAmount2, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore - ETH_GAS_COMPENSATION, "ETH bal mismatch");
    }

    function testCanWithdrawColl() external {
        uint256 collateralAmount = 10e18;
        uint256 collateralToWithdraw = 2e18;

        uint256 boldAmount = 10000e18;

        uint256 ethBalanceBefore = A.balance;

        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collateralAmount,
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
        uint256 troveId = tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        vm.startPrank(A);
        tokenZapper.withdrawCollToRawETH(troveId, collateralToWithdraw);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), collateralAmount - collateralToWithdraw, "Coll mismatch");
        assertGt(troveManager.getTroveEntireDebt(troveId), boldAmount, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), boldAmount, "BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBefore - ETH_GAS_COMPENSATION, "ETH bal mismatch");
    }

    function testCanNotAddReceiverWithoutRemoveManager() external {
        uint256 collateralAmount = 10e18;
        uint256 boldAmount = 10000e18;

        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collateralAmount,
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
        uint256 troveId = tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        // Try to add a receiver for the zapper without remove manager
        vm.startPrank(A);
        vm.expectRevert(AddRemoveManagers.EmptyManager.selector);
        tokenZapper.setRemoveManagerWithReceiver(troveId, address(0), B);
        vm.stopPrank();
    }

    function testCanRepayBold() external {
        uint256 collateralAmount = 100e18;
        
        uint256 boldAmount = 10000e18;
        uint256 boldAmount2 = 1000e18;

        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collateralAmount,
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
        uint256 troveId = tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 ethBalanceBeforeA = A.balance;
        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 ethBalanceBeforeB = B.balance;

        // Add a remove manager for the zapper, and send bold
        vm.startPrank(A);
        tokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        boldToken.transfer(B, boldAmount2);
        vm.stopPrank();

        // Approve and repay
        vm.startPrank(B);
        boldToken.approve(address(tokenZapper), boldAmount2);
        tokenZapper.repayBold(troveId, boldAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), collateralAmount, "Trove coll mismatch");
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId), boldAmount - boldAmount2, 2e18, "Trove  debt mismatch"
        );
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA - boldAmount2, "A BOLD bal mismatch");
        assertEq(A.balance, ethBalanceBeforeA, "A ETH bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB, "B BOLD bal mismatch");
        assertEq(B.balance, ethBalanceBeforeB, "B ETH bal mismatch");
    }

    function testCanWithdrawBold() external {
        uint256 collateralAmount = 100e18;
        
        uint256 boldAmount = 10000e18;
        uint256 boldAmount2 = 1000e18;

        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collateralAmount,
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
        uint256 troveId = tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 collateralBalanceBeforeA = collateralToken.balanceOf(A);
        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 collateralBalanceBeforeB = collateralToken.balanceOf(B);

        // Add a remove manager for the zapper
        vm.startPrank(A);
        tokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        vm.stopPrank();

        // Withdraw bold
        vm.startPrank(B);
        tokenZapper.withdrawBold(troveId, boldAmount2, boldAmount2);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), collateralAmount, "Trove coll mismatch");
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId), boldAmount + boldAmount2, 2e18, "Trove  debt mismatch"
        );
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(collateralToken.balanceOf(A), collateralBalanceBeforeA, "A ETH bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB, "B BOLD bal mismatch");
        assertEq(collateralToken.balanceOf(B), collateralBalanceBeforeB, "B ETH bal mismatch");
    }

    // // TODO: more adjustment combinations
    function testCanAdjustTroveWithdrawCollAndBold() external {
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        uint256 collateralAmount = 10e18;
        uint256 collateralAmount2 = 1e18;

        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collateralAmount,
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
        uint256 troveId = tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 collateralBalanceBefore = collateralToken.balanceOf(A);

        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 collateralBalanceBeforeB = collateralToken.balanceOf(B);

        // Add a remove manager for the zapper
        vm.startPrank(A);
        tokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        vm.stopPrank();

        // Adjust (withdraw coll and Bold)
        vm.startPrank(B);
        tokenZapper.adjustTroveWithRawETH(troveId, collateralAmount2, false, boldAmount2, true, boldAmount2);
        vm.stopPrank();

        assertEq(
            troveManager.getTroveEntireColl(troveId),
            (collateralAmount - collateralAmount2) ,
            "Trove coll mismatch"
        );
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId), boldAmount1 + boldAmount2, 2e18, "Trove  debt mismatch"
        );
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(collateralToken.balanceOf(A), collateralBalanceBefore + collateralAmount2, "A ETH bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB, "B BOLD bal mismatch");
        assertEq(collateralToken.balanceOf(B), collateralBalanceBeforeB, "A ETH bal mismatch");
    }

    function testCanAdjustTroveAddCollAndBold() external {
        uint256 boldAmount1 = 10000e18;
        uint256 boldAmount2 = 1000e18;

        uint256 collateralAmount = 10e18;
        uint256 collateralAmount2 = 1e18;

        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collateralAmount,
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
        uint256 troveId = tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        boldToken.transfer(B, boldAmount2);
        vm.stopPrank();

        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 collateralBalanceBefore = collateralToken.balanceOf(A);

        uint256 boldBalanceBeforeB = boldToken.balanceOf(B);
        uint256 collateralBalanceBeforeB = collateralToken.balanceOf(B);

        // Add an add manager for the zapper
        vm.startPrank(A);
        tokenZapper.setAddManager(troveId, B);
        vm.stopPrank();

        // Adjust (add coll and Bold)
        vm.startPrank(B);
        boldToken.approve(address(tokenZapper), boldAmount2);
        tokenZapper.adjustTroveWithRawETH(troveId, collateralAmount2, true, boldAmount2, false, boldAmount2);
        vm.stopPrank();

        assertEq(
            troveManager.getTroveEntireColl(troveId),
            (collateralAmount + collateralAmount2) ,
            "Trove coll mismatch"
        );
        assertApproxEqAbs(
            troveManager.getTroveEntireDebt(troveId), boldAmount1 - boldAmount2, 2e18, "Trove  debt mismatch"
        );
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA, "A BOLD bal mismatch");
        assertEq(collateralToken.balanceOf(A), collateralBalanceBefore, "A ETH bal mismatch");
        assertEq(boldToken.balanceOf(B), boldBalanceBeforeB - boldAmount2, "B BOLD bal mismatch");
        assertEq(collateralToken.balanceOf(B), collateralBalanceBeforeB - collateralAmount2, "B ETH bal mismatch");
    }

    function testCanAdjustZombieTroveWithdrawCollAndBold() external {
        uint256 boldAmount1 = 10000e18;

        uint256 collateralAmount = 10e18;
        uint256 collateralAmount2 = 1e18;
        uint256 boldAmount2 = 1000e18;

        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collateralAmount,
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
        uint256 troveId = tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        // Add a remove manager for the zapper
        vm.startPrank(A);
        tokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        vm.stopPrank();

        // Redeem to make trove zombie
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(boldAmount1 - boldAmount2, 10, 1e18);
        vm.stopPrank();

        uint256 troveCollBefore = troveManager.getTroveEntireColl(troveId);
        uint256 collateralBalanceBefore = collateralToken.balanceOf(A);
        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        
        uint256 collateralBalanceBeforeB = collateralToken.balanceOf(B);

        // Adjust (withdraw coll and Bold)
        vm.startPrank(B);
        tokenZapper.adjustZombieTroveWithRawETH(troveId, collateralAmount2, false, boldAmount2, true, 0, 0, boldAmount2);
        vm.stopPrank();

        assertEq(
            troveManager.getTroveEntireColl(troveId),
            troveCollBefore - collateralAmount2 ,
            "Trove coll mismatch"
        );
        assertApproxEqAbs(troveManager.getTroveEntireDebt(troveId), 2 * boldAmount2, 2e18, "Trove  debt mismatch");
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(collateralToken.balanceOf(A), collateralBalanceBefore + collateralAmount2, "A ETH bal mismatch");
        assertEq(boldToken.balanceOf(B), 0, "B BOLD bal mismatch");
        assertEq(collateralToken.balanceOf(B), collateralBalanceBeforeB, "B ETH bal mismatch");
    }

    function testCanAdjustZombieTroveAddCollAndWithdrawBold() external {
        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: 10e18,
            boldAmount: 10000e18,
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
        uint256 troveId = tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        // Add a remove manager for the zapper
        vm.startPrank(A);
        tokenZapper.setRemoveManagerWithReceiver(troveId, B, A);
        vm.stopPrank();

        uint256 collateralAmount2 = 1e18;
        uint256 boldAmount2 = 1000e18;

        // Redeem to make trove zombie
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(10000e18 - boldAmount2, 10, 1e18);
        vm.stopPrank();

        uint256 troveCollBefore = troveManager.getTroveEntireColl(troveId);
        uint256 boldBalanceBeforeA = boldToken.balanceOf(A);
        uint256 collateralBalanceBefore = collateralToken.balanceOf(A);

        uint256 collateralBalanceBeforeB = collateralToken.balanceOf(B);

        // Adjust (add coll and withdraw Bold)
        vm.startPrank(B);
        tokenZapper.adjustZombieTroveWithRawETH(troveId, collateralAmount2, true, boldAmount2, true, 0, 0, boldAmount2);
        vm.stopPrank();

        assertEq(
            troveManager.getTroveEntireColl(troveId),
            troveCollBefore + collateralAmount2 ,
            "Trove coll mismatch"
        );
        assertApproxEqAbs(troveManager.getTroveEntireDebt(troveId), 2 * boldAmount2, 2e18, "Trove  debt mismatch");
        assertEq(boldToken.balanceOf(A), boldBalanceBeforeA + boldAmount2, "A BOLD bal mismatch");
        assertEq(collateralToken.balanceOf(A), collateralBalanceBefore, "A ETH bal mismatch");
        assertEq(boldToken.balanceOf(B), 0, "B BOLD bal mismatch");
        assertEq(collateralToken.balanceOf(B), collateralBalanceBeforeB - collateralAmount2, "B ETH bal mismatch");
    }

    function testCanCloseTrove() external {
        uint256 collateralAmount = 10e18;
        uint256 boldAmount = 10000e18;        

        uint256 collateralBalanceBefore = collateralToken.balanceOf(A);

        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collateralAmount,
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
        uint256 troveId = tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        // open a 2nd trove so we can close the 1st one, and send Bold to account for interest and fee
        vm.startPrank(B);
        deal(address(collateralToken), B, 100e18 + ETH_GAS_COMPENSATION);
        deal(address(WETH), B, 100 ether + ETH_GAS_COMPENSATION);
        WETH.approve(address(borrowerOperations), ETH_GAS_COMPENSATION);
        collateralToken.approve(address(borrowerOperations), 100e18);

        borrowerOperations.openTrove(
            B,
            0, // index,
            100e18, // coll,
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
        boldToken.approve(address(tokenZapper), type(uint256).max);
        tokenZapper.closeTroveToRawETH(troveId);
        vm.stopPrank();

        assertEq(troveManager.getTroveEntireColl(troveId), 0, "Coll mismatch");
        assertEq(troveManager.getTroveEntireDebt(troveId), 0, "Debt mismatch");
        assertEq(boldToken.balanceOf(A), 0, "BOLD bal mismatch");
        assertEq(collateralToken.balanceOf(A), collateralBalanceBefore, "ETH bal mismatch");
    }

    function testExcessRepaymentByAdjustGoesBackToUser() external {
        uint256 collateralAmount = 10e18;
        uint256 boldAmount = 10000e18;

        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collateralAmount,
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
        uint256 troveId = tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 collateralBalanceBefore = collateralToken.balanceOf(A);
        uint256 boldDebtBefore = troveManager.getTroveEntireDebt(troveId);

        // Adjust trove: remove 1 ETH and try to repay 9k (only will repay ~8k, up to MIN_DEBT)
        vm.startPrank(A);
        boldToken.approve(address(tokenZapper), type(uint256).max);
        tokenZapper.adjustTroveWithRawETH(troveId, 1e18, false, 9000e18, false, 0);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldAmount + MIN_DEBT - boldDebtBefore, "BOLD bal mismatch");
        assertEq(boldToken.balanceOf(address(tokenZapper)), 0, "Zapper BOLD bal should be zero");
        assertEq(collateralToken.balanceOf(A), collateralBalanceBefore + 1e18, "Coll bal mismatch");
        assertEq(address(tokenZapper).balance, 0, "Zapper ETH bal should be zero");
        assertEq(collateralToken.balanceOf(address(tokenZapper)), 0, "Zapper Coll bal should be zero");
    }

    function testExcessRepaymentByRepayGoesBackToUser() external {
        uint256 collateralAmount = 10e18;
        uint256 boldAmount = 10000e18;

        ITokenZapper.OpenTroveParams memory params = ITokenZapper.OpenTroveParams({
            owner: A,
            ownerIndex: 0,
            collAmount: collateralAmount,
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
        uint256 troveId = tokenZapper.openTroveWithRawETH{value: ETH_GAS_COMPENSATION}(params);
        vm.stopPrank();

        uint256 boldDebtBefore = troveManager.getTroveEntireDebt(troveId);
        uint256 collateralBalanceBefore = collateralToken.balanceOf(A);

        // Adjust trove: try to repay 9k (only will repay ~8k, up to MIN_DEBT)
        vm.startPrank(A);
        boldToken.approve(address(tokenZapper), type(uint256).max);
        tokenZapper.repayBold(troveId, 9000e18);
        vm.stopPrank();

        assertEq(boldToken.balanceOf(A), boldAmount + MIN_DEBT - boldDebtBefore, "BOLD bal mismatch");
        assertEq(boldToken.balanceOf(address(tokenZapper)), 0, "Zapper BOLD bal should be zero");
        assertEq(address(tokenZapper).balance, 0, "Zapper ETH bal should be zero");
        assertEq(collateralToken.balanceOf(A), collateralBalanceBefore, "Coll bal mismatch");
        assertEq(WETH.balanceOf(address(tokenZapper)), 0, "Zapper Coll bal should be zero");
    }
}
