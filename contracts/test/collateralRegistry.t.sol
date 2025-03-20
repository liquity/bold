// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/WhitelistTestSetup.sol";
import {ERC20Faucet} from "./TestContracts/ERC20Faucet.sol";
import {MulticollateralTest} from "./multicollateral.t.sol";

contract CollateralRegistry is MulticollateralTest, WhitelistTestSetup {
    address[5] whitelistedUsers;
    address nonWhitelistedUser;

    function setUp() public override (MulticollateralTest, DevTestSetup) {
        super.setUp();
        
        // set internal owner
        _setOwner(address(deployer));

        // add whitelist to one of the branches
        _deployAndSetWhitelist(contractsArray[0].addressesRegistry);
        
        // whitelist all users involved in base tests
        whitelistedUsers = [A, B, C, D, E];             
        for(uint8 i=0; i<5; i++){
            _addToWhitelist(whitelistedUsers[i]);
        }

        // set a non whitelisted address
        nonWhitelistedUser = address(123);
    }

    function deployNewCollateralBranch() public returns (
        ITroveManager newTroveManager,
        IERC20Metadata newCollateralToken
    ) 
    {
        TestDeployer.TroveManagerParams[] memory troveManagerParamsArray =
            new TestDeployer.TroveManagerParams[](1);
        troveManagerParamsArray[0] = TestDeployer.TroveManagerParams(150e16, 110e16, 10e16, 110e16, 5e16, 10e16);

        TestDeployer.LiquityContractsDev memory _contractsArray;

        IERC20Metadata collToken = new ERC20Faucet(
                "TEST", // _name
                "TST", // _symbol
                100 ether, //     _tapAmount
                1 days //         _tapPeriod
            );

        (_contractsArray, ) = deployer.deployBranch(
            troveManagerParamsArray[0],
            collToken,
            WETH,
            boldToken,
            collateralRegistry
        );

        contractsArray.push(_contractsArray);
                
        // Set price feeed
        contractsArray[4].priceFeed.setPrice(2000e18);

        // Give some Collateral to test accounts, and approve it to BorrowerOperations
        uint256 initialCollateralAmount = 10_000e18;

        for (uint256 i = 0; i < 6; i++) {
            // A to F
            giveAndApproveCollateral(
                collToken,
                accountsList[i],
                initialCollateralAmount,
                address(contractsArray[4].borrowerOperations)
            );
            // Approve WETH for gas compensation in all branches
            vm.startPrank(accountsList[i]);
            WETH.approve(address(contractsArray[4].borrowerOperations), type(uint256).max);
            vm.stopPrank();
        }

        return (_contractsArray.troveManager, collToken);
    }

    // only the system owner can add a new branch to the collateral registry
    function test_onlyOwner_addNewBranch() public {
        assertEq(collateralRegistry.totalCollaterals(), 4);

        IERC20Metadata[] memory _tokens = new IERC20Metadata[](1);
        ITroveManager[] memory _troveManagers = new ITroveManager[](1);

        // deploy the branch 
        (_troveManagers[0], _tokens[0]) = deployNewCollateralBranch();

        uint256[] memory indexes = new uint256[](1);
        indexes[0] = 4; // append new branch

        vm.expectRevert("Only owner");
        collateralRegistry.addNewCollaterals(indexes, _tokens, _troveManagers);
    
        vm.prank(boldToken.getOwner());
        collateralRegistry.addNewCollaterals(indexes, _tokens, _troveManagers);

        assertEq(collateralRegistry.totalCollaterals(), 5);
    }

    // add a branch after initialisation and then perform a multicollateral redemption
    function test_addNewBranch_multiCollateralRedemption() public {
        // deploy the branch 
        (ITroveManager troveManager, IERC20Metadata collateralToken) = deployNewCollateralBranch();

        uint256[] memory indexes = new uint256[](1);
        indexes[0] = 4; 

        IERC20Metadata[] memory _tokens = new IERC20Metadata[](1);
        _tokens[0] = collateralToken;

        ITroveManager[] memory _troveManagers = new ITroveManager[](1);
        _troveManagers[0] = troveManager;

        vm.prank(boldToken.getOwner());
        collateralRegistry.addNewCollaterals(indexes, _tokens, _troveManagers);

        assertEq(collateralRegistry.totalCollaterals(), 5);

        // OPEN TROVES AND REDEEM 
        TestValues memory testValues1;
        TestValues memory testValues2;
        TestValues memory testValues3;
        TestValues memory testValues4;
        TestValues memory testValues5;

        uint256 redeemAmount = 1600e18;

        // First collateral unbacked Bold: 10k (SP empty) - but whitelisted
        testValues1.troveId = openMulticollateralTroveNoHints100pctWithIndex(0, A, 0, 10e18, 10000e18, 5e16);

        // Second collateral unbacked Bold: 5k
        testValues2.troveId = openMulticollateralTroveNoHints100pctWithIndex(1, A, 0, 100e18, 10000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(1, A, 5000e18);

        // Third collateral unbacked Bold: 1k
        testValues3.troveId = openMulticollateralTroveNoHints100pctWithIndex(2, A, 0, 10e18, 10000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(2, A, 9000e18);

        // Fourth collateral unbacked Bold: 0
        testValues4.troveId = openMulticollateralTroveNoHints100pctWithIndex(3, A, 0, 10e18, 10000e18, 5e16);
        makeMulticollateralSPDepositAndClaim(3, A, 10000e18);

        // Fifth collateral unbacked Bold: 1k
        testValues5.troveId = openMulticollateralTroveNoHints100pctWithIndex(4, A, 0, 10e18, 10000e18, 5e16);
        vm.prank(A);
        boldToken.approve(address(contractsArray[4].stabilityPool), type(uint256).max);
        
        makeMulticollateralSPDepositAndClaim(4, A, 9000e18);

        // let time go by to reduce redemption rate (/16)
        vm.warp(block.timestamp + 1 days);

        // initial balances
        testValues1.collInitialBalance = contractsArray[0].collToken.balanceOf(nonWhitelistedUser);
        testValues2.collInitialBalance = contractsArray[1].collToken.balanceOf(nonWhitelistedUser);
        testValues3.collInitialBalance = contractsArray[2].collToken.balanceOf(nonWhitelistedUser);
        testValues4.collInitialBalance = contractsArray[3].collToken.balanceOf(nonWhitelistedUser);
        testValues5.collInitialBalance = contractsArray[4].collToken.balanceOf(nonWhitelistedUser);

        testValues1.price = contractsArray[0].priceFeed.getPrice();
        testValues2.price = contractsArray[1].priceFeed.getPrice();
        testValues3.price = contractsArray[2].priceFeed.getPrice();
        testValues4.price = contractsArray[3].priceFeed.getPrice();
        testValues5.price = contractsArray[4].priceFeed.getPrice();

        testValues1.unbackedPortion = contractsArray[0].troveManager.getTroveEntireDebt(testValues1.troveId);
        testValues2.unbackedPortion = contractsArray[1].troveManager.getTroveEntireDebt(testValues2.troveId) - 5000e18;
        testValues3.unbackedPortion = contractsArray[2].troveManager.getTroveEntireDebt(testValues3.troveId) - 9000e18;
        testValues4.unbackedPortion = contractsArray[3].troveManager.getTroveEntireDebt(testValues4.troveId) - 10000e18;
        testValues5.unbackedPortion = contractsArray[4].troveManager.getTroveEntireDebt(testValues4.troveId) - 9000e18;

        // branch 1 is not counted as it's skipped
        uint256 totalUnbacked = testValues2.unbackedPortion + testValues3.unbackedPortion
            + testValues4.unbackedPortion + testValues5.unbackedPortion;

        // testValues1.redeemAmount = redeemAmount * testValues1.unbackedPortion / totalUnbacked; // whitelisted branch
        testValues2.redeemAmount = redeemAmount * testValues2.unbackedPortion / totalUnbacked;
        testValues3.redeemAmount = redeemAmount * testValues3.unbackedPortion / totalUnbacked;
        testValues4.redeemAmount = redeemAmount * testValues4.unbackedPortion / totalUnbacked;
        testValues5.redeemAmount = redeemAmount * testValues5.unbackedPortion / totalUnbacked;

        // fees
        uint256 fee = collateralRegistry.getEffectiveRedemptionFeeInBold(redeemAmount);
        // testValues1.fee = fee * testValues1.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues1.price;
        testValues2.fee = fee * testValues2.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues2.price;
        testValues3.fee = fee * testValues3.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues3.price;
        testValues4.fee = fee * testValues4.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues4.price;
        testValues5.fee = fee * testValues5.redeemAmount / redeemAmount * DECIMAL_PRECISION / testValues5.price;

        // Check redemption rate
        assertApproxEqAbs(
            collateralRegistry.getRedemptionFeeWithDecay(redeemAmount),
            redeemAmount * (INITIAL_BASE_RATE / 16 + REDEMPTION_FEE_FLOOR) / DECIMAL_PRECISION,
            1e7,
            "Wrong redemption fee with decay"
        );

        // Transfer bold from A to nonWhitelistedUser for redemption
        vm.prank(A);
        boldToken.transfer(nonWhitelistedUser, 16000e18);
        assertEq(boldToken.balanceOf(nonWhitelistedUser), 16000e18, "Wrong Bold balance before redemption");

        uint256 initialBoldSupply = boldToken.totalSupply();

        // nonWhitelisted user redeems 1.6k
        redeem(nonWhitelistedUser, redeemAmount);

        // Check redemption rate
        assertApproxEqAbs(
            collateralRegistry.getRedemptionRate(),
            INITIAL_BASE_RATE / 16 + REDEMPTION_FEE_FLOOR + redeemAmount * DECIMAL_PRECISION / initialBoldSupply,
            1e5,
            "Wrong redemption rate"
        );

        // Check bold balance
        assertApproxEqAbs(boldToken.balanceOf(nonWhitelistedUser), 14400e18, 10, "Wrong Bold balance after redemption");

        // Check collateral balances
        // final balances
        testValues1.collFinalBalance = contractsArray[0].collToken.balanceOf(nonWhitelistedUser);
        testValues2.collFinalBalance = contractsArray[1].collToken.balanceOf(nonWhitelistedUser);
        testValues3.collFinalBalance = contractsArray[2].collToken.balanceOf(nonWhitelistedUser);
        testValues4.collFinalBalance = contractsArray[3].collToken.balanceOf(nonWhitelistedUser);
        testValues5.collFinalBalance = contractsArray[4].collToken.balanceOf(nonWhitelistedUser);

        // first branch was not redeemed
        assertApproxEqAbs(
            testValues1.collFinalBalance, 
            testValues1.collInitialBalance,
            1,
            "Wrong Collateral 1 balance"
        );
        assertApproxEqAbs(
            testValues2.collFinalBalance - testValues2.collInitialBalance,
            testValues2.redeemAmount * DECIMAL_PRECISION / testValues2.price - testValues2.fee,
            1e14,
            "Wrong Collateral 2 balance"
        );
        assertApproxEqAbs(
            testValues3.collFinalBalance - testValues3.collInitialBalance,
            testValues3.redeemAmount * DECIMAL_PRECISION / testValues3.price - testValues3.fee,
            1e13,
            "Wrong Collateral 3 balance"
        );
        assertApproxEqAbs(
            testValues4.collFinalBalance - testValues4.collInitialBalance,
            testValues4.redeemAmount * DECIMAL_PRECISION / testValues4.price - testValues4.fee,
            1e11,
            "Wrong Collateral 4 balance"
        );
        assertApproxEqAbs(
            testValues5.collFinalBalance - testValues5.collInitialBalance,
            testValues5.redeemAmount * DECIMAL_PRECISION / testValues5.price - testValues5.fee,
            1e11,
            "Wrong Collateral 5 balance"
        );
    }

    // cannot add more thna 10 branches
    function test_revert_AddMoreThan10Branches() public {
         assertEq(collateralRegistry.totalCollaterals(), 4);

        IERC20Metadata[] memory _tokens = new IERC20Metadata[](7);
        ITroveManager[] memory _troveManagers = new ITroveManager[](7);
        uint256[] memory indexes = new uint256[](7);

         (_troveManagers[0], _tokens[0]) = deployNewCollateralBranch();
         (_troveManagers[1], _tokens[1]) = deployNewCollateralBranch();
         (_troveManagers[2], _tokens[2]) = deployNewCollateralBranch();
         (_troveManagers[3], _tokens[3]) = deployNewCollateralBranch();
         (_troveManagers[4], _tokens[4]) = deployNewCollateralBranch();
         (_troveManagers[5], _tokens[5]) = deployNewCollateralBranch();
         (_troveManagers[6], _tokens[6]) = deployNewCollateralBranch();

             
        vm.prank(boldToken.getOwner());
        vm.expectRevert("Max collaterals");
        collateralRegistry.addNewCollaterals(indexes, _tokens, _troveManagers);
    }

    // cannot overwrite an existing branch
    function test_revert_OverwriteBranch() public {
         assertEq(collateralRegistry.totalCollaterals(), 4);

        IERC20Metadata[] memory _tokens = new IERC20Metadata[](1);
        ITroveManager[] memory _troveManagers = new ITroveManager[](1);
        uint256[] memory indexes = new uint256[](1);
        indexes[0] = 0; // try to overwrite branch 0

        (_troveManagers[0], _tokens[0]) = deployNewCollateralBranch();

        vm.prank(boldToken.getOwner());
        vm.expectRevert("Collateral already initialised");
        collateralRegistry.addNewCollaterals(indexes, _tokens, _troveManagers);
    }

    // cannot send an invalid branch index
    function test_revert_InvalidIndex() public {
        assertEq(collateralRegistry.totalCollaterals(), 4);

        IERC20Metadata[] memory _tokens = new IERC20Metadata[](1);
        ITroveManager[] memory _troveManagers = new ITroveManager[](1);
        uint256[] memory indexes = new uint256[](1);
        indexes[0] = 10; // try to overwrite branch 0

        (_troveManagers[0], _tokens[0]) = deployNewCollateralBranch();

        vm.prank(boldToken.getOwner());
        vm.expectRevert("Invalid index");
        collateralRegistry.addNewCollaterals(indexes, _tokens, _troveManagers);
    }

    function test_onlyOwner_removeBranch() public {
        assertEq(collateralRegistry.totalCollaterals(), 4);

        IERC20Metadata[] memory _tokens = new IERC20Metadata[](1);
        ITroveManager[] memory _troveManagers = new ITroveManager[](1);

        // deploy the branch 
        (_troveManagers[0], _tokens[0]) = deployNewCollateralBranch();

        uint256[] memory indexes = new uint256[](1);
        indexes[0] = 4; // append new branch

        vm.prank(boldToken.getOwner());
        collateralRegistry.addNewCollaterals(indexes, _tokens, _troveManagers);

        assertEq(collateralRegistry.totalCollaterals(), 5);

        assertEq(address(collateralRegistry.getToken(4)), address(_tokens[0]));
        assertEq(address(collateralRegistry.getTroveManager(4)), address(_troveManagers[0]));

        // only owner can remove branch
        vm.expectRevert("Only owner");
        collateralRegistry.removeCollaterals(indexes);

        // cannot remove more than existing branches
        uint256[] memory invalidIndexes = new uint256[](7);
        vm.prank(boldToken.getOwner());
        vm.expectRevert("Invalid input");
        collateralRegistry.removeCollaterals(invalidIndexes);

        // cannot remove a not initialised branch
        invalidIndexes = new uint256[](1);
        invalidIndexes[0] = 8;

        vm.prank(boldToken.getOwner());
        vm.expectRevert("Branch not initialised");
        collateralRegistry.removeCollaterals(invalidIndexes);

        // invalid index
        invalidIndexes = new uint256[](1);
        invalidIndexes[0] = 11;

        vm.prank(boldToken.getOwner());
        vm.expectRevert("Invalid index");
        collateralRegistry.removeCollaterals(invalidIndexes);

        // owner remove
        vm.prank(boldToken.getOwner());
        collateralRegistry.removeCollaterals(indexes);

        assertEq(collateralRegistry.totalCollaterals(), 4);

        assertEq(address(collateralRegistry.getToken(4)), address(0));
        assertEq(address(collateralRegistry.getTroveManager(4)), address(0));
    }
}
