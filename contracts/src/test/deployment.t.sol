pragma solidity 0.8.18;

import "./TestContracts/DevTestSetup.sol";

contract Deployment is DevTestSetup {
    function testContractsDeployed() public {
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
        logContractAddresses();
    }

    function testTroveManagerHasCorrectPriceFeedAddress() public {
        address priceFeedAddress = address(priceFeed);
        address recordedPriceFeedAddress = address(troveManager.priceFeed());
        assertEq(priceFeedAddress, recordedPriceFeedAddress);
    }

    function testTroveManagerHasCorrectBoldTokenAddress() public {
        address boldTokenAddress = address(boldToken);
        address recordedBoldTokenAddress = address(troveManager.boldToken());
        assertEq(boldTokenAddress, recordedBoldTokenAddress);
    }

    function testTroveManagerHasCorrectSortedTrovesAddress() public {
        address sortedTrovesAddress = address(sortedTroves);
        address recordedSortedTrovesAddress = address(troveManager.sortedTroves());
        assertEq(sortedTrovesAddress, recordedSortedTrovesAddress);
    }

    function testTroveManagerHasCorrectBorrowerOpsAddress() public {
        address borrowerOperationsAddress = address(borrowerOperations);
        address recordedBorrowerOperationsAddress = troveManager.borrowerOperationsAddress();
        assertEq(borrowerOperationsAddress, recordedBorrowerOperationsAddress);
    }

    // ActivePool in TroveM
    function testTroveManagerHasCorrectActivePoolAddress() public {
        address activePoolAddress = address(activePool);
        address recordedActivePoolAddress = address(troveManager.activePool());
        assertEq(activePoolAddress, recordedActivePoolAddress);
    }

    // DefaultPool in TroveM
    function testTroveManagerHasCorrectDefaultPoolAddress() public {
        address defaultPoolAddress = address(defaultPool);
        address recordedDefaultPoolAddress = address(troveManager.defaultPool());
        assertEq(defaultPoolAddress, recordedDefaultPoolAddress);
    }

    // StabilityPool in TroveM
    function testTroveManagerHasCorrectSPAddress() public {
        address stabilityPoolAddress = address(stabilityPool);
        address recordedStabilityPoolAddress = address(troveManager.stabilityPool());
        assertEq(stabilityPoolAddress, recordedStabilityPoolAddress);
    }

    // Active Pool

    function testActivePoolHasCorrectInterestRouterAddress() public {
        address interestRouter = address(mockInterestRouter);
        address recordedInterestRouterAddress = address(activePool.interestRouter());
        assertEq(interestRouter, recordedInterestRouterAddress);
    }

    function testActivePoolHasCorrectStabilityPoolAddress() public {
        address stabilityPoolAddress = address(stabilityPool);
        address recordedStabilityPoolAddress = activePool.stabilityPoolAddress();
        assertEq(stabilityPoolAddress, recordedStabilityPoolAddress);
    }

    function testActivePoolHasCorrectDefaultPoolAddress() public {
        address defaultPoolAddress = address(defaultPool);
        address recordedDefaultPoolAddress = activePool.defaultPoolAddress();
        assertEq(defaultPoolAddress, recordedDefaultPoolAddress);
    }

    function testActivePoolHasCorrectBorrowerOpsAddress() public {
        address borrowerOperationsAddress = address(borrowerOperations);
        address recordedBorrowerOperationsAddress = activePool.borrowerOperationsAddress();
        assertEq(borrowerOperationsAddress, recordedBorrowerOperationsAddress);
    }

    function testActivePoolHasCorrectTroveManagerAddress() public {
        address troveManagerAddress = address(troveManager);
        address recordedTroveManagerAddress = activePool.troveManagerAddress();
        assertEq(troveManagerAddress, recordedTroveManagerAddress);
    }

    // Stability Pool

    function testStabilityPoolHasCorrectActivePoolAddress() public {
        address activePoolAddress = address(activePool);
        address recordedActivePoolAddress = address(stabilityPool.activePool());
        assertEq(activePoolAddress, recordedActivePoolAddress);
    }

    function testStabilityPoolHasCorrectCorrectBorrowerOpsAddress() public {
        address borrowerOperationsAddress = address(borrowerOperations);
        address recordedBorrowerOperationsAddress = address(stabilityPool.borrowerOperations());
        assertEq(borrowerOperationsAddress, recordedBorrowerOperationsAddress);
    }

    function testStabilityPoolHasCorrectCorrectBoldTokenAddress() public {
        address boldTokenAddress = address(boldToken);
        address recordedBoldTokenAddress = address(stabilityPool.boldToken());
        assertEq(boldTokenAddress, recordedBoldTokenAddress);
    }

    function testStabilityPoolHasCorrectTroveManagerAddress() public {
        address troveManagerAddress = address(troveManager);
        address recordedTroveManagerAddress = address(stabilityPool.troveManager());
        assertEq(troveManagerAddress, recordedTroveManagerAddress);
    }

    // Default Pool

    function testDefaultPoolHasCorrectTroveManagerAddress() public {
        address troveManagerAddress = address(troveManager);
        address recordedTroveManagerAddress = defaultPool.troveManagerAddress();
        assertEq(troveManagerAddress, recordedTroveManagerAddress);
    }

    function testDefaultPoolHasCorrectActivePoolAddress() public {
        address activePoolAddress = address(activePool);
        address recordedActivePoolAddress = defaultPool.activePoolAddress();
        assertEq(activePoolAddress, recordedActivePoolAddress);
    }

    // Sorted Troves

    function testSortedTrovesHasCorrectBorrowerOperationsAddress() public {
        address borrowerOperationsAddress = address(borrowerOperations);
        address recordedBorrowerOperationsAddress = sortedTroves.borrowerOperationsAddress();
        assertEq(borrowerOperationsAddress, recordedBorrowerOperationsAddress);
    }

    function testSortedTrovesHasCorrectTroveManagerAddress() public {
        address troveManagerAddress = address(troveManager);
        address recordedTroveManagerAddress = address(sortedTroves.troveManager());
        assertEq(troveManagerAddress, recordedTroveManagerAddress);
    }

    //--- BorrowerOperations ---

    function testBorrowerOperationsHasCorrectTroveManagerAddress() public {
        address troveManagerAddress = address(troveManager);
        address recordedTroveManagerAddress = address(borrowerOperations.troveManager());
        assertEq(troveManagerAddress, recordedTroveManagerAddress);
    }

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

    function testBorrowerOperationsHasCorrectActivePoolAddress() public {
        address activePoolAddress = address(activePool);
        address recordedActivePoolAddress = address(borrowerOperations.activePool());
        assertEq(activePoolAddress, recordedActivePoolAddress);
    }

    function testBorrowerOperationsHasCorrectDefaultPoolAddress() public {
        address defaultPoolAddress = address(defaultPool);
        address recordedDefaultPoolAddress = address(borrowerOperations.defaultPool());
        assertEq(defaultPoolAddress, recordedDefaultPoolAddress);
    }
}
