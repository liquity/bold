// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;

import "./TestContracts/DevTestSetup.sol";
import "./TestContracts/ERC20Faucet.sol";
import "./TestContracts/CollateralRegistryTester.sol";
import "../src/MultiTroveGetter.sol";
import "../src/Interfaces/IMultiTroveGetter.sol";
import "../src/HintHelpers.sol";
import {BoldToken} from "../src/BoldToken.sol";

contract BasicOps is DevTestSetup {
    function testOpenTroveFailsWithoutAllowance() public {
        priceFeed.setPrice(2000e18);

        vm.startPrank(G);
        vm.expectRevert("ERC20: insufficient allowance");
        borrowerOperations.openTrove(
            G, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();
    }

    function testOpenTroveFailsWithoutBalance() public {
        priceFeed.setPrice(2000e18);

        vm.startPrank(G);
        collToken.approve(address(borrowerOperations), 2e18);
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        borrowerOperations.openTrove(
            G, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();
    }

    function testOpenTrove() public {
        priceFeed.setPrice(2000e18);
        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    function testCloseTrove() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        // Transfer some Bold to B so that B can close Trove accounting for interest and upfront fee
        boldToken.transfer(B, 100e18);
        vm.stopPrank();

        vm.startPrank(B);
        uint256 B_Id = borrowerOperations.openTrove(
            B, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        vm.startPrank(B);
        borrowerOperations.closeTrove(B_Id);
        vm.stopPrank();

        // Check Troves count reduced by 1
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    function testAdjustTrove() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        uint256 A_Id = borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        // Check Trove coll and debt
        uint256 debt_1 = troveManager.getTroveDebt(A_Id);
        assertGt(debt_1, 0);
        uint256 coll_1 = troveManager.getTroveColl(A_Id);
        assertGt(coll_1, 0);

        // Adjust trove
        adjustTrove100pct(A, A_Id, 1e18, 500e18, true, true);

        // Check coll and debt altered
        uint256 debt_2 = troveManager.getTroveDebt(A_Id);
        assertGt(debt_2, debt_1);
        uint256 coll_2 = troveManager.getTroveColl(A_Id);
        assertGt(coll_2, coll_1);
    }

    function testRedeem() public {
        priceFeed.setPrice(2000e18);

        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 5e18, 5_000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();

        vm.startPrank(B);
        uint256 B_Id = borrowerOperations.openTrove(
            B, 0, 5e18, 4_000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        uint256 debt_1 = troveManager.getTroveDebt(B_Id);
        assertGt(debt_1, 0, "Debt cannot be zero");
        uint256 coll_1 = troveManager.getTroveColl(B_Id);
        assertGt(coll_1, 0, "Coll cannot be zero");
        vm.stopPrank();

        // B is now first in line to get redeemed, as they both have the same interest rate,
        // but B's Trove is younger.

        uint256 redemptionAmount = 1000e18; // 1k BOLD

        // Wait some time so that redemption rate is not 100%
        vm.warp(block.timestamp + 7 days);

        // A redeems 1k BOLD
        vm.startPrank(A);
        collateralRegistry.redeemCollateral(redemptionAmount, 10, 1e18);

        // Check B's coll and debt reduced
        uint256 debt_2 = troveManager.getTroveDebt(B_Id);
        assertLt(debt_2, debt_1, "Debt mismatch after");
        uint256 coll_2 = troveManager.getTroveColl(B_Id);
        assertLt(coll_2, coll_1, "Coll mismatch after");
    }

    function testLiquidation() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        uint256 A_Id = borrowerOperations.openTrove(
            A, 0, 2e18, 2200e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();

        vm.startPrank(B);
        borrowerOperations.openTrove(
            B, 0, 10e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        // Price drops
        priceFeed.setPrice(1200e18);
        (uint256 price,) = priceFeed.fetchPrice();

        // Check CR_A < MCR and TCR > CCR
        assertLt(troveManager.getCurrentICR(A_Id, price), MCR);
        assertGt(troveManager.getTCR(price), CCR);

        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 2);

        troveManager.liquidate(A_Id);

        // Check Troves count reduced by 1
        trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    function testSPDeposit() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        // A makes an SP deposit
        makeSPDepositAndClaim(A, 100e18);

        // time passes
        vm.warp(block.timestamp + 7 days);

        // A tops up their SP deposit
        makeSPDepositAndClaim(A, 100e18);

        // Check A's balance decreased and SP deposit increased (A gained some interest)
        assertGt(boldToken.balanceOf(A), 1800e18, "Wrong bold balance");
        assertLt(boldToken.balanceOf(A), 1801e18, "Wrong bold balance");
        assertApproximatelyEqual(stabilityPool.getCompoundedBoldDeposit(A), 200e18, 1e3, "Wrong SP deposit");
    }

    function testSPWithdrawal() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        // A makes an SP deposit
        makeSPDepositAndClaim(A, 100e18);

        // time passes
        vm.warp(block.timestamp + 7 days);

        // Check A's balance decreased and SP deposit increased
        assertEq(boldToken.balanceOf(A), 1900e18);
        assertApproximatelyEqual(stabilityPool.getCompoundedBoldDeposit(A), 100e18, 1e2);

        // A withdraws their full SP deposit less 1e18
        makeSPWithdrawalAndClaim(A, 99e18);

        // Check A's balance increased and SP deposit decreased to 0 (A gained some interest)
        assertGt(boldToken.balanceOf(A), 1999e18, "Wrong bold balance");
        assertLt(boldToken.balanceOf(A), 2000e18, "Wrong bold balance");
        assertEq(stabilityPool.getCompoundedBoldDeposit(A), 1e18, "Wrong SP deposit");
    }


    function testAddCollateral() public {
        IERC20Metadata[] memory tokens = new IERC20Metadata[](1);
        tokens[0] = IERC20Metadata(address(0x0000000000000000000000000000000000000000));
        ITroveManager[] memory troveManagers = new ITroveManager[](1);
        troveManagers[0] = ITroveManager(address(0x0000000000000000000000000000000000000000));

        // Deploy a new collateral registry
        CollateralRegistry myCollateralRegistry = new CollateralRegistryTester(boldToken, tokens, troveManagers, address(0x123));
        uint256 count = myCollateralRegistry.branches();
        uint256 branchId = count;

        assertEq(count, 1);

        vm.startPrank(address(0x123));
        IERC20Metadata collToken = addressesRegistry.collToken();
        ITroveManager troveManager = new TroveManager(addressesRegistry, branchId);
        myCollateralRegistry.addCollateral(collToken, troveManager);
        vm.stopPrank();

        uint256[] memory activeBranchIds = myCollateralRegistry.activeBranchIds();
        count = myCollateralRegistry.branches();
        assertEq(activeBranchIds.length, 2);
        assertEq(count, 2);
        assertEq(activeBranchIds[1], branchId);
    }

    function testAddCollateralRevertsIfTokenDoesNotMatchTroveManagerCollateralToken() public {
        IERC20Metadata[] memory tokens = new IERC20Metadata[](1);
        tokens[0] = IERC20Metadata(address(0x0000000000000000000000000000000000000000));
        ITroveManager[] memory troveManagers = new ITroveManager[](1);
        troveManagers[0] = ITroveManager(address(0x0000000000000000000000000000000000000000));

        // Deploy a new collateral registry
        CollateralRegistry myCollateralRegistry = new CollateralRegistryTester(boldToken, tokens, troveManagers, address(0x123));
        uint256 count = myCollateralRegistry.branches();

        assertEq(count, 1);

        uint256 branchId = count;

        vm.startPrank(address(0x123));
        IERC20Metadata collToken = new ERC20Faucet("Test", "TEST", 100 ether, 1 days);
        ITroveManager troveManager = new TroveManager(addressesRegistry, branchId);
        vm.expectRevert("CollateralRegistry: Token does not match TroveManager collateral token");
        myCollateralRegistry.addCollateral(collToken, troveManager);
        vm.stopPrank();

        uint256[] memory activeBranchIds = myCollateralRegistry.activeBranchIds();
        count = myCollateralRegistry.branches();
        assertEq(activeBranchIds.length, 1);
        assertEq(count, 1);
    }

    function testRemoveCollateral() public {
        IERC20Metadata[] memory tokens = new IERC20Metadata[](2);
        tokens[0] = new ERC20Faucet("Test", "TEST", 100 ether, 1 days);
        tokens[1] = new ERC20Faucet("Test", "TEST", 100 ether, 1 days);
        ITroveManager[] memory troveManagers = new ITroveManager[](2);
        troveManagers[0] = new TroveManager(addressesRegistry, 0);
        troveManagers[1] = new TroveManager(addressesRegistry, 1);

        // Deploy a new collateral registry
        CollateralRegistry myCollateralRegistry = new CollateralRegistryTester(boldToken, tokens, troveManagers, address(0x123));

        vm.prank(address(0x123));
        myCollateralRegistry.removeCollateral(1);

        uint256[] memory removedBranchIds = myCollateralRegistry.removedBranchIds();
        assertEq(removedBranchIds.length, 1);
        assertEq(removedBranchIds[0], 1);
    }

    function testCleanRemovedCollaterals() public {
        IERC20Metadata[] memory tokens = new IERC20Metadata[](2);
        tokens[0] = new ERC20Faucet("Test", "TEST", 100 ether, 1 days);
        tokens[1] = new ERC20Faucet("Test", "TEST", 100 ether, 1 days);
        ITroveManager[] memory troveManagers = new ITroveManager[](2);
        troveManagers[0] = new TroveManager(addressesRegistry, 0);
        troveManagers[1] = new TroveManager(addressesRegistry, 1);

        // Deploy a new collateral registry
        CollateralRegistry myCollateralRegistry = new CollateralRegistryTester(boldToken, tokens, troveManagers, address(0x123));

        vm.startPrank(address(0x123));
        myCollateralRegistry.removeCollateral(0);
        myCollateralRegistry.removeCollateral(0);
        vm.stopPrank();

        uint256[] memory removedBranchIds = myCollateralRegistry.removedBranchIds();
        assertEq(removedBranchIds.length, 2);
        assertEq(removedBranchIds[0], 0);
        assertEq(removedBranchIds[1], 1);

        myCollateralRegistry.cleanRemovedCollaterals(0);

        removedBranchIds = myCollateralRegistry.removedBranchIds();
        assertEq(removedBranchIds.length, 1);
        assertEq(removedBranchIds[0], 1);
    }

    function testMultiTroveGetterBranchIdAfterRemoval() public {
        IERC20Metadata[] memory tokens = new IERC20Metadata[](2);
        tokens[0] = new ERC20Faucet("Test", "TEST", 100 ether, 1 days);
        tokens[1] = new ERC20Faucet("Test", "TEST", 100 ether, 1 days);
        ITroveManager[] memory troveManagers = new ITroveManager[](2);
        troveManagers[0] = new TroveManager(addressesRegistry, 0);
        troveManagers[1] = new TroveManager(addressesRegistry, 1);

        // Deploy a new collateral registry
        CollateralRegistry myCollateralRegistry = new CollateralRegistryTester(boldToken, tokens, troveManagers, address(0x123));

        priceFeed.setPrice(2000e18);
        vm.prank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        vm.prank(address(0x123));
        myCollateralRegistry.removeCollateral(1);

        uint256[] memory removedBranchIds = myCollateralRegistry.removedBranchIds();
        assertEq(removedBranchIds.length, 1);
        assertEq(removedBranchIds[0], 1);

        MultiTroveGetter multiTroveGetter = new MultiTroveGetter(myCollateralRegistry);
        IMultiTroveGetter.CombinedTroveData[] memory _troves = multiTroveGetter.getMultipleSortedTroves(1, 0, 1);
        assertEq(_troves.length, 1);


        vm.expectRevert("Invalid collateral index");
        multiTroveGetter.getMultipleSortedTroves(2, 0, 1);
    }

    function testHintHelpersBranchIdAfterRemoval() public {
        IERC20Metadata[] memory tokens = new IERC20Metadata[](2);
        tokens[0] = new ERC20Faucet("Test", "TEST", 100 ether, 1 days);
        tokens[1] = new ERC20Faucet("Test", "TEST", 100 ether, 1 days);
        ITroveManager[] memory troveManagers = new ITroveManager[](2);
        troveManagers[0] = new TroveManager(addressesRegistry, 0);
        troveManagers[1] = new TroveManager(addressesRegistry, 1);

        // Deploy a new collateral registry
        CollateralRegistry myCollateralRegistry = new CollateralRegistryTester(boldToken, tokens, troveManagers, address(0x123));
        
        priceFeed.setPrice(2000e18);
        vm.prank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );


        vm.prank(address(0x123));
        myCollateralRegistry.removeCollateral(1);

        uint256[] memory removedBranchIds = myCollateralRegistry.removedBranchIds();
        assertEq(removedBranchIds.length, 1);
        assertEq(removedBranchIds[0], 1);

        HintHelpers hintHelpers = new HintHelpers(myCollateralRegistry);
        hintHelpers.predictOpenTroveUpfrontFee(1, 100e18, 1000e18);

        vm.expectRevert();
        hintHelpers.predictOpenTroveUpfrontFee(2, 100e18, 1000e18);
    }

    function testUpdateBranchAddressesInBoldToken() public {
        IERC20Metadata[] memory tokens = new IERC20Metadata[](2);
        tokens[0] = new ERC20Faucet("Test", "TEST", 100 ether, 1 days);
        tokens[1] = new ERC20Faucet("Test", "TEST", 100 ether, 1 days);
        ITroveManager[] memory troveManagers = new ITroveManager[](2);
        troveManagers[0] = new TroveManager(addressesRegistry, 0);
        troveManagers[1] = new TroveManager(addressesRegistry, 1);

        address governor = makeAddr("governor");

        ITroveManager newTroveManager = new TroveManager(addressesRegistry, 2);

        // Deploy a new collateral registry
        BoldToken newBoldToken = new BoldToken(governor);
        CollateralRegistry myCollateralRegistry = new CollateralRegistryTester(newBoldToken, tokens, troveManagers, governor);

        vm.startPrank(governor);
        newBoldToken.setCollateralRegistry(address(myCollateralRegistry));
        vm.stopPrank();

        vm.startPrank(governor);
        vm.expectEmit();
        emit BoldToken.TroveManagerAddressAdded(address(newTroveManager));

        myCollateralRegistry.setBranchAddressesInBoldToken(
            address(newTroveManager), 
            address(stabilityPool), 
            address(borrowerOperations), 
            address(activePool)
        );
        vm.stopPrank();

        ITroveManager newTroveManager2 = new TroveManager(addressesRegistry, 3);

        vm.startPrank(makeAddr("notCollateralRegistry"));
        vm.expectRevert("BoldToken: Caller is not the CollateralRegistry");
        newBoldToken.setBranchAddressesViaCollateralRegistry(
            address(newTroveManager2), 
            address(stabilityPool), 
            address(borrowerOperations), 
            address(activePool)
        );
        vm.stopPrank();
    }
}
