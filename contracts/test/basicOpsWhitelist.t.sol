// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/WhitelistTestSetup.sol";
import "src/StabilityPool.sol";
import {BasicOps} from "./basicOps.t.sol";

contract WhitelistedBasicOps is BasicOps, WhitelistTestSetup {
    address[3] whitelistedUsers;
    address notWhitelistedUser;

    function setUp() public override {
        super.setUp();
        
        // set internal owner
        _setOwner(address(deployer));

        // add whitelist to the branch
        _deployAndSetWhitelist(addressesRegistry);
        
        // whitelist users
        whitelistedUsers = [A, B, G];             
        for(uint8 i=0; i<3; i++){
            _addToWhitelist(whitelistedUsers[i]);
        }

        // set a not whitelisted address
        notWhitelistedUser = address(123);

    }

    // a not whitelisted owner try opening a trove on a whitelisted branch
    function test_openTrove_NotWhitelistedOwner() public {
        priceFeed.setPrice(2000e18);
        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        vm.startPrank(notWhitelistedUser);
        vm.expectRevert(BorrowerOperations.NotWhitelisted.selector);
        borrowerOperations.openTrove(
            notWhitelistedUser, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );
        vm.stopPrank();
    }

    // a whitelisted owner try opening a trove on a whitelisted branch
    // but sets a not whitelisted receiver
    function test_openTrove_WhitelistOwner_NotWhitelistedReceiver() public {
        priceFeed.setPrice(2000e18);
        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.NotWhitelisted.selector);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), notWhitelistedUser
        );
        vm.stopPrank();
    }

    // not whitelisted msg.sender
    function test_openTrove_NotWhitelistedSender() public {
        priceFeed.setPrice(2000e18);
        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        vm.startPrank(notWhitelistedUser);
        vm.expectRevert(BorrowerOperations.NotWhitelisted.selector);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), A
        );
        vm.stopPrank();
    }

    // a not whitelisted user try opening a trove on a whitelisted branch
    function test_openTroveJoinInterestBatchManager_NotWhitelistedOwner() public {
        priceFeed.setPrice(2000e18);
        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        registerBatchManager(B);

        vm.startPrank(notWhitelistedUser);
        vm.expectRevert(BorrowerOperations.NotWhitelisted.selector);

        IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams memory params = IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams(
            notWhitelistedUser, 0, 2e18, 2000e18, 0, 0, B, 1000e18, address(0), address(0), address(0)
        );

        borrowerOperations.openTroveAndJoinInterestBatchManager(params);
        vm.stopPrank();
    }

    // a whitelisted user try opening a trove on a whitelisted branch
    // but sets a not whitelisted receiver
    function test_openTroveJoinInterestBatchManager_NotWhitelistedReceiver() public {
        priceFeed.setPrice(2000e18);
        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        registerBatchManager(B);

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.NotWhitelisted.selector);

        IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams memory params = IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams(
            A, 0, 2e18, 2000e18, 0, 0, B, 1000e18, address(0), address(0), notWhitelistedUser
        );

        borrowerOperations.openTroveAndJoinInterestBatchManager(params);
        vm.stopPrank();
    }

    // not whitelisted msg.sender
    function test_openTroveJoinInterestBatchManager_NotWhitelistedSender() public {
        priceFeed.setPrice(2000e18);
        uint256 trovesCount = troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        registerBatchManager(B);

        vm.startPrank(notWhitelistedUser);
        vm.expectRevert(BorrowerOperations.NotWhitelisted.selector);

        IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams memory params = IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams(
            A, 0, 2e18, 2000e18, 0, 0, B, 1000e18, address(0), address(0), A
        );

        borrowerOperations.openTroveAndJoinInterestBatchManager(params);
        vm.stopPrank();
    }

    // STABILITY POOL 

    // not whitelisted user deposits into Stability Pol
    function test_SPDeposit_NotWhitelisted() public {
        priceFeed.setPrice(2000e18);
        vm.startPrank(A);
        borrowerOperations.openTrove(
            A, 0, 2e18, 2000e18, 0, 0, MIN_ANNUAL_INTEREST_RATE, 1000e18, address(0), address(0), address(0)
        );

        boldToken.transfer(notWhitelistedUser, 100e18);
        vm.stopPrank();

        // notWhitelistedUser makes an SP deposit
        vm.expectRevert(StabilityPool.NotWhitelisted.selector);
        makeSPDepositAndClaim(notWhitelistedUser, 100e18);
    }
}