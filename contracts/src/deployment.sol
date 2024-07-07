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
import "./test/TestContracts/TroveManagerTester.sol";
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
    TroveManagerTester troveManager;
    IPriceFeedTestnet priceFeed;
    GasPool gasPool;
    IInterestRouter interestRouter;
    IERC20 collToken;
}

struct TroveManagerParams {
    uint256 MCR;
    uint256 LIQUIDATION_PENALTY_SP;
    uint256 LIQUIDATION_PENALTY_REDISTRIBUTION;
}

struct DeploymentVars {
    uint256 numCollaterals;
    IERC20[] collaterals;
    ITroveManager[] troveManagers;
    LiquityContracts contracts;
}

function _deployAndConnectContracts()
    returns (
        LiquityContracts memory contracts,
        ICollateralRegistry collateralRegistry,
        IBoldToken boldToken,
        HintHelpers hintHelpers,
        MultiTroveGetter multiTroveGetter,
        IERC20 WETH // for gas compensation
    )
{
    return _deployAndConnectContracts(TroveManagerParams(110e16, 5e16, 10e16), 110e16);
}

function _deployAndConnectContracts(TroveManagerParams memory troveManagerParams, uint256 scr)
    returns (
        LiquityContracts memory contracts,
        ICollateralRegistry collateralRegistry,
        IBoldToken boldToken,
        HintHelpers hintHelpers,
        MultiTroveGetter multiTroveGetter,
        IERC20 WETH // for gas compensation
    )
{
    LiquityContracts[] memory contractsArray;
    TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](1);
    uint256[] memory scrs = new uint256[](1);

    troveManagerParamsArray[0] = troveManagerParams;
    scrs[0] = scr;
    (contractsArray, collateralRegistry, boldToken, hintHelpers, multiTroveGetter, WETH) =
        _deployAndConnectContracts(troveManagerParamsArray, scrs);
    contracts = contractsArray[0];
}

function _deployAndConnectContracts(TroveManagerParams[] memory troveManagerParamsArray, uint256[] memory scrs)
    returns (
        LiquityContracts[] memory contractsArray,
        ICollateralRegistry collateralRegistry,
        IBoldToken boldToken,
        HintHelpers hintHelpers,
        MultiTroveGetter multiTroveGetter,
        IERC20 WETH // for gas compensation
    )
{
    DeploymentVars memory vars;
    vars.numCollaterals = troveManagerParamsArray.length;
    boldToken = new BoldToken();

    // used for gas compensation and as collateral of the first branch
    WETH = new ERC20Faucet(
        "Wrapped ETH", // _name
        "WETH", //        _symbol
        100 ether, //     _tapAmount
        1 days //         _tapPeriod
    );

    contractsArray = new LiquityContracts[](vars.numCollaterals);
    vars.collaterals = new IERC20[](vars.numCollaterals);
    vars.troveManagers = new ITroveManager[](vars.numCollaterals);

    vars.contracts = _deployAndConnectCollateralContracts(WETH, boldToken, WETH, troveManagerParamsArray[0], scrs[0]);
    contractsArray[0] = vars.contracts;
    vars.collaterals[0] = vars.contracts.collToken;
    vars.troveManagers[0] = vars.contracts.troveManager;

    // Multicollateral registry
    for (uint256 i = 1; i < vars.numCollaterals; i++) {
        IERC20 stETH = new ERC20Faucet(
            string.concat("Staked ETH", string(abi.encode(i))), // _name
            string.concat("stETH", string(abi.encode(i))), // _symbol
            100 ether, //     _tapAmount
            1 days //         _tapPeriod
        );
        vars.contracts = _deployAndConnectCollateralContracts(stETH, boldToken, WETH, troveManagerParamsArray[i], scrs[i]);
        vars.collaterals[i] = vars.contracts.collToken;
        vars.troveManagers[i] = vars.contracts.troveManager;
        contractsArray[i] = vars.contracts;
    }

    collateralRegistry = new CollateralRegistry(boldToken, vars.collaterals, vars.troveManagers);
    hintHelpers = new HintHelpers(collateralRegistry);
    multiTroveGetter = new MultiTroveGetter(collateralRegistry);
    boldToken.setCollateralRegistry(address(collateralRegistry));

    // Set registry in TroveManagers
    for (uint256 i = 0; i < vars.numCollaterals; i++) {
        contractsArray[i].troveManager.setCollateralRegistry(address(collateralRegistry));
    }
}

function _deployAndConnectCollateralContracts(
    IERC20 _collToken,
    IBoldToken _boldToken,
    IERC20 _weth,
    TroveManagerParams memory troveManagerParams,
    uint256 scr
) returns (LiquityContracts memory contracts) {
    // TODO: optimize deployment order & constructor args & connector functions

    contracts.collToken = _collToken;

    // Deploy all contracts
    contracts.activePool = new ActivePool(address(_collToken));
    contracts.troveManager = new TroveManagerTester(
        troveManagerParams.MCR,
        troveManagerParams.LIQUIDATION_PENALTY_SP,
        troveManagerParams.LIQUIDATION_PENALTY_REDISTRIBUTION,
        _weth
    );
    contracts.borrowerOperations = new BorrowerOperations(_collToken, contracts.troveManager, _weth, scr);
    contracts.collSurplusPool = new CollSurplusPool(address(_collToken));
    contracts.defaultPool = new DefaultPool(address(_collToken));
    contracts.gasPool = new GasPool(_weth, contracts.borrowerOperations, contracts.troveManager);
    contracts.priceFeed = new PriceFeedTestnet();
    contracts.sortedTroves = new SortedTroves();
    contracts.stabilityPool = new StabilityPool(address(_collToken));
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
