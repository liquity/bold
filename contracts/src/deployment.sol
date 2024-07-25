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
import "./test/TestContracts/BorrowerOperationsTester.sol";
import "./test/TestContracts/TroveManagerTester.sol";
import "./CollateralRegistry.sol";
import "./MockInterestRouter.sol";
import "./test/TestContracts/PriceFeedTestnet.sol";
import {WETHTester} from "./test/TestContracts/WETHTester.sol";
import {ERC20Faucet} from "./test/TestContracts/ERC20Faucet.sol";

import "./PriceFeeds/WETHPriceFeed.sol";
import "./PriceFeeds/WSTETHPriceFeed.sol";
import "./PriceFeeds/RETHPriceFeed.sol";
import "./PriceFeeds/OSETHPriceFeed.sol";
import "./PriceFeeds/ETHXPriceFeed.sol";

// import "forge-std/console.sol";

struct LiquityContractsDev {
    IActivePool activePool;
    IBorrowerOperationsTester borrowerOperations; // Tester
    ICollSurplusPool collSurplusPool;
    IDefaultPool defaultPool;
    ISortedTroves sortedTroves;
    IStabilityPool stabilityPool;
    ITroveManagerTester troveManager; // Tester
    IPriceFeedTestnet priceFeed; // Tester
    GasPool gasPool;
    IInterestRouter interestRouter;
    IERC20 collToken;
}

struct LiquityContracts {
    IActivePool activePool;
    IBorrowerOperations borrowerOperations;
    ICollSurplusPool collSurplusPool;
    IDefaultPool defaultPool;
    ISortedTroves sortedTroves;
    IStabilityPool stabilityPool;
    ITroveManager troveManager;
    IPriceFeed priceFeed;
    GasPool gasPool;
    IInterestRouter interestRouter;
    IERC20 collToken;
}

struct TroveManagerParams {
    uint256 CCR;
    uint256 MCR;
    uint256 SCR;
    uint256 LIQUIDATION_PENALTY_SP;
    uint256 LIQUIDATION_PENALTY_REDISTRIBUTION;
}

struct DeploymentVars {
    uint256 numCollaterals;
    IERC20[] collaterals;
    ITroveManager[] troveManagers;
    LiquityContractsDev contracts;
}

struct ExternalAddresses {
    address ETHOracle;
    address STETHOracle;
    address RETHOracle;
    address ETHXOracle;
    address OSETHOracle;
    address WSTETHToken;
    address RETHToken;
    address StaderOracle; // "StaderOracle" is the ETHX contract that manages the canonical exchange rate. Not a market price oracle.
    address OsTokenVaultController;
}

struct OracleParams {
    uint256 ethUsdStalenessThreshold;
    uint256 stEthUsdStalenessThreshold;
    uint256 rEthEthStalenessThreshold;
    uint256 ethXEthStalenessThreshold;
    uint256 osEthEthStalenessThreshold;
}

// TODO: replace this with the real LST contracts
struct MockCollaterals {
    IWETH WETH;
    IERC20 RETH;
    IERC20 WSTETH;
    IERC20 ETHX;
    IERC20 OSETH;
}

function _deployAndConnectContracts()
    returns (
        LiquityContractsDev memory contracts,
        ICollateralRegistry collateralRegistry,
        IBoldToken boldToken,
        HintHelpers hintHelpers,
        MultiTroveGetter multiTroveGetter,
        IWETH WETH // for gas compensation
    )
{
    return _deployAndConnectContracts(TroveManagerParams(150e16, 110e16, 110e16, 5e16, 10e16));
}

function _deployAndConnectContracts(TroveManagerParams memory troveManagerParams)
    returns (
        LiquityContractsDev memory contracts,
        ICollateralRegistry collateralRegistry,
        IBoldToken boldToken,
        HintHelpers hintHelpers,
        MultiTroveGetter multiTroveGetter,
        IWETH WETH // for gas compensation
    )
{
    LiquityContractsDev[] memory contractsArray;
    TroveManagerParams[] memory troveManagerParamsArray = new TroveManagerParams[](1);

    troveManagerParamsArray[0] = troveManagerParams;

    (contractsArray, collateralRegistry, boldToken, hintHelpers, multiTroveGetter, WETH) =
        _deployAndConnectContractsMultiColl(troveManagerParamsArray);
    contracts = contractsArray[0];
}

function _deployAndConnectContractsMultiColl(TroveManagerParams[] memory troveManagerParamsArray)
    returns (
        LiquityContractsDev[] memory contractsArray,
        ICollateralRegistry collateralRegistry,
        IBoldToken boldToken,
        HintHelpers hintHelpers,
        MultiTroveGetter multiTroveGetter,
        IWETH WETH // for gas compensation
    )
{
    // used for gas compensation and as collateral of the first branch
    WETH = new WETHTester(
        100 ether, //     _tapAmount
        1 days //         _tapPeriod
    );
    (contractsArray, collateralRegistry, boldToken, hintHelpers, multiTroveGetter) =
        _deployAndConnectContracts(troveManagerParamsArray, WETH);
}

function _deployAndConnectContracts(TroveManagerParams[] memory troveManagerParamsArray, IWETH _WETH)
    returns (
        LiquityContractsDev[] memory contractsArray,
        ICollateralRegistry collateralRegistry,
        IBoldToken boldToken,
        HintHelpers hintHelpers,
        MultiTroveGetter multiTroveGetter
    )
{
    DeploymentVars memory vars;
    vars.numCollaterals = troveManagerParamsArray.length;
    boldToken = new BoldToken();

    contractsArray = new LiquityContractsDev[](vars.numCollaterals);
    vars.collaterals = new IERC20[](vars.numCollaterals);
    vars.troveManagers = new ITroveManager[](vars.numCollaterals);

    // Deploy the first branch with WETH collateral
    vars.contracts = _deployAndConnectCollateralContractsDev(_WETH, boldToken, _WETH, troveManagerParamsArray[0]);
    contractsArray[0] = vars.contracts;
    vars.collaterals[0] = vars.contracts.collToken;
    vars.troveManagers[0] = vars.contracts.troveManager;

    // Deploy the remaining branches with LST collateral
    for (uint256 i = 1; i < vars.numCollaterals; i++) {
        IERC20 stETH = new ERC20Faucet(
            string.concat("Staked ETH", string(abi.encode(i))), // _name
            string.concat("stETH", string(abi.encode(i))), // _symbol
            100 ether, //     _tapAmount
            1 days //         _tapPeriod
        );
        vars.contracts = _deployAndConnectCollateralContractsDev(stETH, boldToken, _WETH, troveManagerParamsArray[i]);
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
// Creates individual PriceFeed contracts based on oracle addresses.
// Still uses mock collaterals rather than real mainnet WETH and LST addresses.

function deployAndConnectContractsMainnet(
    ExternalAddresses memory externalAddresses,
    TroveManagerParams[] memory troveManagerParamsArray,
    OracleParams memory oracleParams
)
    returns (
        LiquityContracts[] memory contractsArray,
        MockCollaterals memory mockCollaterals,
        ICollateralRegistry collateralRegistry,
        IBoldToken boldToken
    )
{
    uint256 numCollaterals = 5;
    contractsArray = new LiquityContracts[](numCollaterals);
    ITroveManager[] memory troveManagers = new ITroveManager[](numCollaterals);
    IPriceFeed[] memory priceFeeds = new IPriceFeed[](numCollaterals);
    IERC20[] memory collaterals = new IERC20[](numCollaterals);

    priceFeeds[0] = new WETHPriceFeed(externalAddresses.ETHOracle, oracleParams.ethUsdStalenessThreshold);

    // RETH
    priceFeeds[1] = new RETHPriceFeed(
        externalAddresses.ETHOracle,
        externalAddresses.RETHOracle,
        externalAddresses.RETHToken,
        oracleParams.ethUsdStalenessThreshold,
        oracleParams.rEthEthStalenessThreshold
    );

    priceFeeds[2] = new WSTETHPriceFeed(
        externalAddresses.STETHOracle, oracleParams.stEthUsdStalenessThreshold, externalAddresses.WSTETHToken
    );

    priceFeeds[3] = new ETHXPriceFeed(
        externalAddresses.ETHOracle,
        externalAddresses.ETHXOracle,
        externalAddresses.StaderOracle,
        oracleParams.ethUsdStalenessThreshold,
        oracleParams.ethXEthStalenessThreshold
    );

    priceFeeds[4] = new OSETHPriceFeed(
        externalAddresses.ETHOracle,
        externalAddresses.OSETHOracle,
        externalAddresses.OsTokenVaultController,
        oracleParams.ethUsdStalenessThreshold,
        oracleParams.osEthEthStalenessThreshold
    );

    boldToken = new BoldToken();

    // TODO: replace mock collaterals with connections to the real tokens for later mainnet testing
    mockCollaterals.WETH = new WETHTester(
        100 ether, //     _tapAmount
        1 days //         _tapPeriod
    );
    collaterals[0] = mockCollaterals.WETH;

    mockCollaterals.RETH = new ERC20Faucet(
        "Mock rETH", // _name
        "mockRETH", // _symbol
        100 ether, //     _tapAmount
        1 days //         _tapPeriod
    );
    collaterals[1] = mockCollaterals.RETH;

    mockCollaterals.WSTETH = new ERC20Faucet(
        "Mock wstETH", // _name
        "mockWSTETH", // _symbol
        100 ether, //     _tapAmount
        1 days //         _tapPeriod
    );
    collaterals[2] = mockCollaterals.WSTETH;

    mockCollaterals.ETHX = new ERC20Faucet(
        "Mock ETHX", // _name
        "mockETHX", // _symbol
        100 ether, //     _tapAmount
        1 days //         _tapPeriod
    );
    collaterals[3] = mockCollaterals.ETHX;

    mockCollaterals.OSETH = new ERC20Faucet(
        "Mock OSETH", // _name
        "mockOSETH", // _symbol
        100 ether, //     _tapAmount
        1 days //         _tapPeriod
    );
    collaterals[4] = mockCollaterals.OSETH;

    // Deploy each set of core contracts
    for (uint256 i = 0; i < numCollaterals; i++) {
        contractsArray[i] = _deployAndConnectCollateralContractsMainnet(
            collaterals[i], boldToken, priceFeeds[i], troveManagerParamsArray[i], mockCollaterals.WETH
        );
        troveManagers[i] = contractsArray[i].troveManager;
    }

    // Deploy registry and register the TMs
    collateralRegistry = new CollateralRegistry(boldToken, collaterals, troveManagers);
    boldToken.setCollateralRegistry(address(collateralRegistry));

    // Set registry in TroveManagers, and each branch' BO in its price feed
    for (uint256 i = 0; i < numCollaterals; i++) {
        contractsArray[i].troveManager.setCollateralRegistry(address(collateralRegistry));
        priceFeeds[i].setAddresses(address(contractsArray[i].borrowerOperations));
    }
}

function _deployAndConnectCollateralContractsDev(
    IERC20 _collToken,
    IBoldToken _boldToken,
    IWETH _WETH,
    TroveManagerParams memory _troveManagerParams
) returns (LiquityContractsDev memory contracts) {
    // TODO: optimize deployment order & constructor args & connector functions

    contracts.collToken = _collToken;

    // Deploy all contracts, using testers for TM and PriceFeed
    contracts.activePool = new ActivePool(address(_collToken));
    contracts.troveManager = new TroveManagerTester( // Tester
        _troveManagerParams.CCR,
        _troveManagerParams.MCR,
        _troveManagerParams.SCR,
        _troveManagerParams.LIQUIDATION_PENALTY_SP,
        _troveManagerParams.LIQUIDATION_PENALTY_REDISTRIBUTION,
        _WETH
    );
    contracts.borrowerOperations = new BorrowerOperationsTester(_collToken, contracts.troveManager, _WETH);
    contracts.collSurplusPool = new CollSurplusPool(address(_collToken));
    contracts.defaultPool = new DefaultPool(address(_collToken));
    contracts.gasPool = new GasPool(_WETH, contracts.borrowerOperations, contracts.troveManager);
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

    // Pass the bare contract interfaces to the connector func
    connectContracts(_boldToken, _devToMainnet(contracts));
}

function _devToMainnet(LiquityContractsDev memory contractsDev) pure returns (LiquityContracts memory contracts) {
    contracts.activePool = contractsDev.activePool;
    contracts.borrowerOperations = IBorrowerOperations(contractsDev.borrowerOperations);
    contracts.collSurplusPool = contractsDev.collSurplusPool;
    contracts.defaultPool = contractsDev.defaultPool;
    contracts.sortedTroves = contractsDev.sortedTroves;
    contracts.stabilityPool = contractsDev.stabilityPool;
    contracts.troveManager = ITroveManager(contractsDev.troveManager);
    contracts.priceFeed = IPriceFeed(contractsDev.priceFeed);
    contracts.gasPool = contractsDev.gasPool;
    contracts.interestRouter = contractsDev.interestRouter;
    contracts.collToken = contractsDev.collToken;
}

function _deployAndConnectCollateralContractsMainnet(
    IERC20 _collateralToken,
    IBoldToken _boldToken,
    IPriceFeed _priceFeed,
    TroveManagerParams memory _troveManagerParams,
    IWETH _weth
) returns (LiquityContracts memory contracts) {
    contracts.activePool = new ActivePool(address(_collateralToken));
    contracts.troveManager = new TroveManager(
        _troveManagerParams.CCR,
        _troveManagerParams.MCR,
        _troveManagerParams.SCR,
        _troveManagerParams.LIQUIDATION_PENALTY_SP,
        _troveManagerParams.LIQUIDATION_PENALTY_REDISTRIBUTION,
        _weth
    );
    contracts.borrowerOperations = new BorrowerOperations(_collateralToken, contracts.troveManager, _weth);
    contracts.collSurplusPool = new CollSurplusPool(address(_collateralToken));
    contracts.defaultPool = new DefaultPool(address(_collateralToken));
    contracts.gasPool = new GasPool(_weth, contracts.borrowerOperations, contracts.troveManager);
    contracts.priceFeed = _priceFeed;
    contracts.sortedTroves = new SortedTroves();
    contracts.stabilityPool = new StabilityPool(address(_collateralToken));
    contracts.interestRouter = new MockInterestRouter();

    _boldToken.setBranchAddresses(
        address(contracts.troveManager),
        address(contracts.stabilityPool),
        address(contracts.borrowerOperations),
        address(contracts.activePool)
    );

    connectContracts(_boldToken, contracts);
}

function connectContracts(IBoldToken _boldToken, LiquityContracts memory contracts) {
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
