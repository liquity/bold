// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

import "./ActivePool.sol";
import "./BoldToken.sol";
import "./BorrowerOperations.sol";
import "./CollSurplusPool.sol";
import "./DefaultPool.sol";
import "./GasPool.sol";
import "./HintHelpers.sol";
import "./MultiTroveGetter.sol";
import "./SortedTroves.sol";
import "./StabilityPool.sol";
import "./TroveManager.sol";
import "./MockInterestRouter.sol";
import "./test/TestContracts/PriceFeedTestnet.sol";

struct LiquityContracts {
    IActivePool activePool;
    IBorrowerOperations borrowerOperations;
    ICollSurplusPool collSurplusPool;
    IDefaultPool defaultPool;
    ISortedTroves sortedTroves;
    IStabilityPool stabilityPool;
    ITroveManager troveManager;
    IBoldToken boldToken;
    IPriceFeedTestnet priceFeed;
    GasPool gasPool;
    IInterestRouter interestRouter;
    IERC20 WETH;
}

function _deployAndConnectContracts() returns (LiquityContracts memory contracts) {
    contracts.WETH = new ERC20("Wrapped ETH", "WETH");

    // TODO: optimize deployment order & constructor args & connector functions

    // Deploy all contracts
    contracts.activePool = new ActivePool(address(contracts.WETH));
    contracts.borrowerOperations = new BorrowerOperations(address(contracts.WETH));
    contracts.collSurplusPool = new CollSurplusPool(address(contracts.WETH));
    contracts.defaultPool = new DefaultPool(address(contracts.WETH));
    contracts.gasPool = new GasPool();
    contracts.priceFeed = new PriceFeedTestnet();
    contracts.sortedTroves = new SortedTroves();
    contracts.stabilityPool = new StabilityPool(address(contracts.WETH));
    contracts.troveManager = new TroveManager();
    contracts.interestRouter = new MockInterestRouter();

    contracts.boldToken = new BoldToken(
        address(contracts.troveManager),
        address(contracts.stabilityPool),
        address(contracts.borrowerOperations),
        address(contracts.activePool)
    );

    // Connect contracts
    contracts.sortedTroves.setParams(
        type(uint256).max, address(contracts.troveManager), address(contracts.borrowerOperations)
    );

    // set contracts in the Trove Manager
    contracts.troveManager.setAddresses(
        address(contracts.borrowerOperations),
        address(contracts.activePool),
        address(contracts.defaultPool),
        address(contracts.stabilityPool),
        address(contracts.gasPool),
        address(contracts.collSurplusPool),
        address(contracts.priceFeed),
        address(contracts.boldToken),
        address(contracts.sortedTroves)
    );

    // set contracts in BorrowerOperations
    contracts.borrowerOperations.setAddresses(
        address(contracts.troveManager),
        address(contracts.activePool),
        address(contracts.defaultPool),
        address(contracts.stabilityPool),
        address(contracts.gasPool),
        address(contracts.collSurplusPool),
        address(contracts.priceFeed),
        address(contracts.sortedTroves),
        address(contracts.boldToken)
    );

    // set contracts in the Pools
    contracts.stabilityPool.setAddresses(
        address(contracts.borrowerOperations),
        address(contracts.troveManager),
        address(contracts.activePool),
        address(contracts.boldToken),
        address(contracts.sortedTroves),
        address(contracts.priceFeed)
    );

    contracts.activePool.setAddresses(
        address(contracts.borrowerOperations),
        address(contracts.troveManager),
        address(contracts.stabilityPool),
        address(contracts.defaultPool),
        address(contracts.boldToken),
        address(contracts.interestRouter)
    );

    contracts.defaultPool.setAddresses(address(contracts.troveManager), address(contracts.activePool));

    contracts.collSurplusPool.setAddresses(
        address(contracts.borrowerOperations), address(contracts.troveManager), address(contracts.activePool)
    );
}
