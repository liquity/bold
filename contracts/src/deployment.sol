// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

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
import "./CollateralRegistry.sol";
import "./MockInterestRouter.sol";
import "./test/TestContracts/PriceFeedTestnet.sol";
import {ERC20Faucet} from "./test/TestContracts/ERC20Faucet.sol";

// import "forge-std/console.sol";

struct LiquityContracts {
    IActivePool activePool;
    IBorrowerOperations borrowerOperations;
    ICollSurplusPool collSurplusPool;
    IDefaultPool defaultPool;
    ISortedTroves sortedTroves;
    IStabilityPool stabilityPool;
    ITroveManager troveManager;
    IPriceFeedTestnet priceFeed;
    GasPool gasPool;
    IInterestRouter interestRouter;
    IERC20 WETH;
}

struct TroveManagerParams {
    uint256 MCR;
    uint256 LIQUIDATION_PENALTY_SP;
    uint256 LIQUIDATION_PENALTY_REDISTRIBUTION;
}

function _deployAndConnectContracts()
    returns (LiquityContracts memory contracts, ICollateralRegistry collateralRegistry, IBoldToken boldToken)
{
    return _deployAndConnectContracts(TroveManagerParams(110e16, 5e16, 10e16));
}

function _deployAndConnectContracts(TroveManagerParams memory troveManagerParams)
    returns (LiquityContracts memory contracts, ICollateralRegistry collateralRegistry, IBoldToken boldToken)
{
    LiquityContracts[] memory contractsArray;
    TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](1);

    troveManagerParamsArray[0] = troveManagerParams;
    (contractsArray, collateralRegistry, boldToken) = _deployAndConnectContracts(troveManagerParamsArray);
    contracts = contractsArray[0];
}

function _deployAndConnectContracts(TroveManagerParams[] memory troveManagerParamsArray)
    returns (LiquityContracts[] memory contractsArray, ICollateralRegistry collateralRegistry, IBoldToken boldToken)
{
    uint256 numCollaterals = troveManagerParamsArray.length;
    boldToken = new BoldToken();

    contractsArray = new LiquityContracts[](numCollaterals);
    IERC20[] memory collaterals = new IERC20[](numCollaterals);
    ITroveManager[] memory troveManagers = new ITroveManager[](numCollaterals);

    LiquityContracts memory contracts;
    IERC20 WETH = new ERC20Faucet(
        "Wrapped ETH", // _name
        "WETH", //        _symbol
        100 ether, //     _tapAmount
        1 days //         _tapPeriod
    );
    contracts = _deployAndConnectCollateralContracts(WETH, boldToken, troveManagerParamsArray[0]);
    contractsArray[0] = contracts;
    collaterals[0] = contracts.WETH;
    troveManagers[0] = contracts.troveManager;

    // Multicollateral registry
    for (uint256 i = 1; i < numCollaterals; i++) {
        IERC20 stETH = new ERC20Faucet(
            string.concat("Staked ETH", string(abi.encode(i))), // _name
            string.concat("stETH", string(abi.encode(i))), // _symbol
            100 ether, //     _tapAmount
            1 days //         _tapPeriod
        );
        contracts = _deployAndConnectCollateralContracts(stETH, boldToken, troveManagerParamsArray[i]);
        collaterals[i] = contracts.WETH;
        troveManagers[i] = contracts.troveManager;
        contractsArray[i] = contracts;
    }

    collateralRegistry = new CollateralRegistry(boldToken, collaterals, troveManagers);
    boldToken.setCollateralRegistry(address(collateralRegistry));
    // Set registry in TroveManagers
    for (uint256 i = 0; i < numCollaterals; i++) {
        contractsArray[i].troveManager.setCollateralRegistry(address(collateralRegistry));
    }
}

function _deployAndConnectCollateralContracts(
    IERC20 _collateralToken,
    IBoldToken _boldToken,
    TroveManagerParams memory troveManagerParams
) returns (LiquityContracts memory contracts) {
    // TODO: optimize deployment order & constructor args & connector functions

    contracts.WETH = _collateralToken;

    // Deploy all contracts
    contracts.activePool = new ActivePool(address(_collateralToken));
    contracts.troveManager = new TroveManager(
        troveManagerParams.MCR,
        troveManagerParams.LIQUIDATION_PENALTY_SP,
        troveManagerParams.LIQUIDATION_PENALTY_REDISTRIBUTION
    );
    contracts.borrowerOperations = new BorrowerOperations(_collateralToken, contracts.troveManager);
    contracts.collSurplusPool = new CollSurplusPool(address(_collateralToken));
    contracts.defaultPool = new DefaultPool(address(_collateralToken));
    contracts.gasPool = new GasPool();
    contracts.priceFeed = new PriceFeedTestnet();
    contracts.sortedTroves = new SortedTroves();
    contracts.stabilityPool = new StabilityPool(address(_collateralToken));
    contracts.interestRouter = new MockInterestRouter();

    _boldToken.setBranchAddresses(
        address(contracts.troveManager),
        address(contracts.stabilityPool),
        address(contracts.borrowerOperations),
        address(contracts.activePool)
    );

    // Connect contracts
    contracts.sortedTroves.setAddresses(address(contracts.troveManager), address(contracts.borrowerOperations));

    // set contracts in the Trove Manager
    contracts.troveManager.setAddresses(
        address(contracts.borrowerOperations),
        address(contracts.activePool),
        address(contracts.defaultPool),
        address(contracts.stabilityPool),
        address(contracts.gasPool),
        address(contracts.collSurplusPool),
        address(contracts.priceFeed),
        address(_boldToken),
        address(contracts.sortedTroves)
    );

    // set contracts in BorrowerOperations
    contracts.borrowerOperations.setAddresses(
        address(contracts.activePool),
        address(contracts.defaultPool),
        address(contracts.gasPool),
        address(contracts.collSurplusPool),
        address(contracts.priceFeed),
        address(contracts.sortedTroves),
        address(_boldToken)
    );

    // set contracts in the Pools
    contracts.stabilityPool.setAddresses(
        address(contracts.borrowerOperations),
        address(contracts.troveManager),
        address(contracts.activePool),
        address(_boldToken),
        address(contracts.sortedTroves),
        address(contracts.priceFeed)
    );

    contracts.activePool.setAddresses(
        address(contracts.borrowerOperations),
        address(contracts.troveManager),
        address(contracts.stabilityPool),
        address(contracts.defaultPool),
        address(_boldToken),
        address(contracts.interestRouter)
    );

    contracts.defaultPool.setAddresses(address(contracts.troveManager), address(contracts.activePool));

    contracts.collSurplusPool.setAddresses(
        address(contracts.borrowerOperations), address(contracts.troveManager), address(contracts.activePool)
    );
}
