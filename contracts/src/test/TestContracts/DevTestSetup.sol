
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.18;

import "./Interfaces/IPriceFeedTestnet.sol";

import "../../ActivePool.sol";
import "../../BoldToken.sol";
import "../../BorrowerOperations.sol";
import "../../CollSurplusPool.sol";
import "../../DefaultPool.sol";
import "../../GasPool.sol";
import "../../HintHelpers.sol";
import "../../MultiTroveGetter.sol";
import "../../TestContracts/PriceFeedTestnet.sol";
import "../../SortedTroves.sol";
import "../../StabilityPool.sol";
import "../../TroveManager.sol";

import "./BaseTest.sol";

contract DevTestSetup is BaseTest {

    IPriceFeedTestnet priceFeed;

    function setUp() public virtual {
        // Start tests at a non-zero timestamp
        vm.warp(block.timestamp + 600);

        accounts = new Accounts();
        createAccounts();

        (A, B, C, D, E, F) =
            (accountsList[0], accountsList[1], accountsList[2], accountsList[3], accountsList[4], accountsList[5]);

        // Give some StETH to test accounts
        uint256 initialETHAmount = 10_000e18;
        deal(A, initialETHAmount);
        deal(B, initialETHAmount);
        deal(C, initialETHAmount);
        deal(D, initialETHAmount);
        deal(E, initialETHAmount);
        deal(F, initialETHAmount);

        // Check accounts are funded
        assertEq(A.balance, initialETHAmount);
        assertEq(B.balance, initialETHAmount);
        assertEq(C.balance, initialETHAmount);
        assertEq(D.balance, initialETHAmount);
        assertEq(E.balance, initialETHAmount);
        assertEq(F.balance, initialETHAmount);

        // TODO: optimize deployment order & constructor args & connector functions
        
        // Deploy all contracts
        activePool = new ActivePool();
        borrowerOperations = new BorrowerOperations();
        collSurplusPool = new CollSurplusPool();
        defaultPool = new DefaultPool();
        gasPool = new GasPool();
        priceFeed = new PriceFeedTestnet();
        sortedTroves = new SortedTroves();
        stabilityPool = new StabilityPool();
        troveManager = new TroveManager();    
        boldToken = new BoldToken(address(troveManager), address(stabilityPool), address(borrowerOperations));

        // Connect contracts
        sortedTroves.setParams(
            MAX_UINT256,
            address(troveManager),  
            address(borrowerOperations)
        );

        // set contracts in the Trove Manager
        troveManager.setAddresses(
            address(borrowerOperations),
            address(activePool),
            address(defaultPool),
            address(stabilityPool),
            address(gasPool),
            address(collSurplusPool),
            address(priceFeed),
            address(boldToken),
            address(sortedTroves)
        );

        // set contracts in BorrowerOperations 
        borrowerOperations.setAddresses(
            address(troveManager),
            address(activePool),
            address(defaultPool),
            address(stabilityPool),
            address(gasPool),
            address(collSurplusPool),
            address(priceFeed),
            address(sortedTroves),
            address(boldToken)
        );

        // set contracts in the Pools
        stabilityPool.setAddresses(
            address(borrowerOperations),
            address(troveManager),
            address(activePool),
            address(boldToken),
            address(sortedTroves),
            address(priceFeed)
        );

        activePool.setAddresses(
            address(borrowerOperations),
            address(troveManager),
            address(stabilityPool),
            address(defaultPool)
        );

        defaultPool.setAddresses(
            address(troveManager),
            address(activePool)
        );

        collSurplusPool.setAddresses(
            address(borrowerOperations),
            address(troveManager),
            address(activePool)
        );
    }
}