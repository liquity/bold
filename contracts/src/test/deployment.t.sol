// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";

contract Deployment is DevTestSetup {
    function testContractsDeployed() public view {
        assertNotEq(address(activePool), address(0));
        assertNotEq(address(boldToken), address(0));
        assertNotEq(address(borrowerOperations), address(0));
        assertNotEq(address(collSurplusPool), address(0));
        assertNotEq(address(gasPool), address(0));
        assertNotEq(address(priceFeed), address(0));
        assertNotEq(address(sortedTroves), address(0));
        assertNotEq(address(stabilityPool), address(0));
        assertNotEq(address(troveManager), address(0));
        assertNotEq(address(mockInterestRouter), address(0));
        assertNotEq(address(collateralRegistry), address(0));
        logContractAddresses();
    }

    // TODO: re-enable
    /*
    function testTroveManagerHasCorrectPriceFeedAddress() public view {
        address priceFeedAddress = address(priceFeed);
        address recordedPriceFeedAddress = address(troveManager.priceFeed());
        assertEq(priceFeedAddress, recordedPriceFeedAddress);
    }

    function testTroveManagerHasCorrectBoldTokenAddress() public view {
        address boldTokenAddress = address(boldToken);
        address recordedBoldTokenAddress = address(troveManager.boldToken());
        assertEq(boldTokenAddress, recordedBoldTokenAddress);
    }
    */

    function testTroveManagerHasCorrectSortedTrovesAddress() public view {
        address sortedTrovesAddress = address(sortedTroves);
        address recordedSortedTrovesAddress = address(troveManager.sortedTroves());
        assertEq(sortedTrovesAddress, recordedSortedTrovesAddress);
    }

    function testTroveManagerHasCorrectBorrowerOpsAddress() public view {
        address borrowerOperationsAddress = address(borrowerOperations);
        address recordedBorrowerOperationsAddress = address(troveManager.borrowerOperations());
        assertEq(borrowerOperationsAddress, recordedBorrowerOperationsAddress);
    }

    // ActivePool in TroveM
    function testTroveManagerHasCorrectActivePoolAddress() public view {
        address activePoolAddress = address(activePool);
        address recordedActivePoolAddress = address(troveManager.activePool());
        assertEq(activePoolAddress, recordedActivePoolAddress);
    }

    // DefaultPool in TroveM
    /*
    function testTroveManagerHasCorrectDefaultPoolAddress() public {
        address defaultPoolAddress = address(defaultPool);
        address recordedDefaultPoolAddress = address(troveManager.defaultPool());
        assertEq(defaultPoolAddress, recordedDefaultPoolAddress);
    }
    */

    // StabilityPool in TroveM
    function testTroveManagerHasCorrectSPAddress() public view {
        address stabilityPoolAddress = address(stabilityPool);
        address recordedStabilityPoolAddress = address(troveManager.stabilityPool());
        assertEq(stabilityPoolAddress, recordedStabilityPoolAddress);
    }

    // Active Pool

    function testActivePoolHasCorrectInterestRouterAddress() public view {
        address interestRouter = address(mockInterestRouter);
        address recordedInterestRouterAddress = address(activePool.interestRouter());
        assertEq(interestRouter, recordedInterestRouterAddress);
    }

    function testActivePoolHasCorrectStabilityPoolAddress() public view {
        address stabilityPoolAddress = address(stabilityPool);
        address recordedStabilityPoolAddress = address(activePool.stabilityPool());
        assertEq(stabilityPoolAddress, recordedStabilityPoolAddress);
    }

    function testActivePoolHasCorrectDefaultPoolAddress() public view {
        address defaultPoolAddress = address(defaultPool);
        address recordedDefaultPoolAddress = activePool.defaultPoolAddress();
        assertEq(defaultPoolAddress, recordedDefaultPoolAddress);
    }

    function testActivePoolHasCorrectBorrowerOpsAddress() public view {
        address borrowerOperationsAddress = address(borrowerOperations);
        address recordedBorrowerOperationsAddress = activePool.borrowerOperationsAddress();
        assertEq(borrowerOperationsAddress, recordedBorrowerOperationsAddress);
    }

    function testActivePoolHasCorrectTroveManagerAddress() public view {
        address troveManagerAddress = address(troveManager);
        address recordedTroveManagerAddress = activePool.troveManagerAddress();
        assertEq(troveManagerAddress, recordedTroveManagerAddress);
    }

    // Stability Pool

    function testStabilityPoolHasCorrectActivePoolAddress() public view {
        address activePoolAddress = address(activePool);
        address recordedActivePoolAddress = address(stabilityPool.activePool());
        assertEq(activePoolAddress, recordedActivePoolAddress);
    }

    function testStabilityPoolHasCorrectCorrectBoldTokenAddress() public view {
        address boldTokenAddress = address(boldToken);
        address recordedBoldTokenAddress = address(stabilityPool.boldToken());
        assertEq(boldTokenAddress, recordedBoldTokenAddress);
    }

    function testStabilityPoolHasCorrectTroveManagerAddress() public view {
        address troveManagerAddress = address(troveManager);
        address recordedTroveManagerAddress = address(stabilityPool.troveManager());
        assertEq(troveManagerAddress, recordedTroveManagerAddress);
    }

    // Default Pool

    function testDefaultPoolHasCorrectTroveManagerAddress() public view {
        address troveManagerAddress = address(troveManager);
        address recordedTroveManagerAddress = defaultPool.troveManagerAddress();
        assertEq(troveManagerAddress, recordedTroveManagerAddress);
    }

    function testDefaultPoolHasCorrectActivePoolAddress() public view {
        address activePoolAddress = address(activePool);
        address recordedActivePoolAddress = defaultPool.activePoolAddress();
        assertEq(activePoolAddress, recordedActivePoolAddress);
    }

    // Sorted Troves

    function testSortedTrovesHasCorrectBorrowerOperationsAddress() public view {
        address borrowerOperationsAddress = address(borrowerOperations);
        address recordedBorrowerOperationsAddress = sortedTroves.borrowerOperationsAddress();
        assertEq(borrowerOperationsAddress, recordedBorrowerOperationsAddress);
    }

    function testSortedTrovesHasCorrectTroveManagerAddress() public view {
        address troveManagerAddress = address(troveManager);
        address recordedTroveManagerAddress = address(sortedTroves.troveManager());
        assertEq(troveManagerAddress, recordedTroveManagerAddress);
    }

    //--- BorrowerOperations ---

    /*
    function testBorrowerOperationsHasCorrectTroveManagerAddress() public {
        address troveManagerAddress = address(troveManager);
        address recordedTroveManagerAddress = address(borrowerOperations.troveManager());
        assertEq(troveManagerAddress, recordedTroveManagerAddress);
    }
    */

    /*
    function testBorrowerOperationsHasCorrectPriceFeedAddress() public {
        address priceFeedAddress = address(priceFeed);
        address recordedPriceFeedAddress = address(borrowerOperations.priceFeed());
        assertEq(priceFeedAddress, recordedPriceFeedAddress);
    }

    function testBorrowerOperationsHasCorrectSortedTrovesAddress() public {
        address sortedTrovesAddress = address(sortedTroves);
        address recordedSortedTrovesAddress = address(borrowerOperations.sortedTroves());
        assertEq(sortedTrovesAddress, recordedSortedTrovesAddress);
    }
    */

    function testBorrowerOperationsHasCorrectActivePoolAddress() public view {
        address activePoolAddress = address(activePool);
        address recordedActivePoolAddress = address(borrowerOperations.activePool());
        assertEq(activePoolAddress, recordedActivePoolAddress);
    }

    /*
    function testBorrowerOperationsHasCorrectDefaultPoolAddress() public {
        address defaultPoolAddress = address(defaultPool);
        address recordedDefaultPoolAddress = address(borrowerOperations.defaultPool());
        assertEq(defaultPoolAddress, recordedDefaultPoolAddress);
    }
    */
}
