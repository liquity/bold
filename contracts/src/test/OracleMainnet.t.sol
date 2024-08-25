// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./TestContracts/Accounts.sol";
import "./TestContracts/Deployment.t.sol";

import "../Dependencies/AggregatorV3Interface.sol";
import "../Interfaces/IWSTETH.sol";
import "../Interfaces/ICompositePriceFeed.sol";
import "../Interfaces/IWETHPriceFeed.sol";

import "../Dependencies/IRETHToken.sol";
import "../Dependencies/IOsTokenVaultController.sol";
import "../Dependencies/IStaderOracle.sol";

import "forge-std/Test.sol";
import "forge-std/console2.sol";

contract OraclesMainnet is TestAccounts {
    uint256 public constant _24_HOURS = 86400;
    uint256 public constant _48_HOURS = 172800;

    AggregatorV3Interface ethOracle;
    AggregatorV3Interface stethOracle;
    AggregatorV3Interface rethOracle;
    AggregatorV3Interface ethXOracle;
    AggregatorV3Interface osEthOracle;

    IWSTETH wstETH;

    IWETHPriceFeed wethPriceFeed;
    ICompositePriceFeed rethPriceFeed;
    IWSTETHPriceFeed wstethPriceFeed;
    ICompositePriceFeed ethXPriceFeed;
    ICompositePriceFeed osEthPriceFeed;

    IRETHToken rETHToken;
    IOsTokenVaultController osTokenVaultController;
    IStaderOracle staderOracle;

    TestDeployer.LiquityContracts[] contractsArray;
    TestDeployer.MockCollaterals mockCollaterals;
    ICollateralRegistry collateralRegistry;
    IBoldToken boldToken;

    /*
    struct DeploymentParamsMainnet {
        ExternalAddresses externalAddresses;
        TestDeployer.TroveManagerParams[] troveManagerParamsArray;
        OracleParams oracleParams;
    }
    */

    struct StoredOracle {
        AggregatorV3Interface aggregator;
        uint256 stalenessThreshold;
        uint256 decimals;
    }

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("mainnet"));

        accounts = new Accounts();
        createAccounts();

        (A, B, C, D, E, F) =
            (accountsList[0], accountsList[1], accountsList[2], accountsList[3], accountsList[4], accountsList[5]);

        TestDeployer.DeploymentParamsMainnet memory deploymentParams;

        uint256 numCollaterals = 5;
        TestDeployer.TroveManagerParams memory tmParams =
            TestDeployer.TroveManagerParams(150e16, 110e16, 110e16, 5e16, 10e16);
        deploymentParams.troveManagerParamsArray = new TestDeployer.TroveManagerParams[](numCollaterals);
        for (uint256 i = 0; i < deploymentParams.troveManagerParamsArray.length; i++) {
            deploymentParams.troveManagerParamsArray[i] = tmParams;
        }

        deploymentParams.externalAddresses.ETHOracle = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
        deploymentParams.externalAddresses.RETHOracle = 0x536218f9E9Eb48863970252233c8F271f554C2d0;
        deploymentParams.externalAddresses.STETHOracle = 0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8;
        deploymentParams.externalAddresses.ETHXOracle = 0xC5f8c4aB091Be1A899214c0C3636ca33DcA0C547;
        deploymentParams.externalAddresses.WSTETHToken = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
        // Redstone Oracle with CL interface
        // TODO: obtain the Chainlink market price feed and use that, when it's ready
        deploymentParams.externalAddresses.OSETHOracle = 0x66ac817f997Efd114EDFcccdce99F3268557B32C;

        deploymentParams.externalAddresses.RETHToken = 0xae78736Cd615f374D3085123A210448E74Fc6393;
        deploymentParams.externalAddresses.StaderOracle = 0xF64bAe65f6f2a5277571143A24FaaFDFC0C2a737;
        deploymentParams.externalAddresses.OsTokenVaultController = 0x2A261e60FB14586B474C208b1B7AC6D0f5000306;

        ethOracle = AggregatorV3Interface(deploymentParams.externalAddresses.ETHOracle);
        rethOracle = AggregatorV3Interface(deploymentParams.externalAddresses.RETHOracle);
        stethOracle = AggregatorV3Interface(deploymentParams.externalAddresses.STETHOracle);
        ethXOracle = AggregatorV3Interface(deploymentParams.externalAddresses.ETHXOracle);
        osEthOracle = AggregatorV3Interface(deploymentParams.externalAddresses.OSETHOracle);

        rETHToken = IRETHToken(deploymentParams.externalAddresses.RETHToken);
        staderOracle = IStaderOracle(deploymentParams.externalAddresses.StaderOracle);
        osTokenVaultController = IOsTokenVaultController(deploymentParams.externalAddresses.OsTokenVaultController);

        wstETH = IWSTETH(deploymentParams.externalAddresses.WSTETHToken);

        deploymentParams.oracleParams.ethUsdStalenessThreshold = _24_HOURS;
        deploymentParams.oracleParams.stEthUsdStalenessThreshold = _24_HOURS;
        deploymentParams.oracleParams.rEthEthStalenessThreshold = _48_HOURS;
        deploymentParams.oracleParams.ethXEthStalenessThreshold = _48_HOURS;
        deploymentParams.oracleParams.osEthEthStalenessThreshold = _48_HOURS;

        TestDeployer deployer = new TestDeployer();
        TestDeployer.DeploymentResultMainnet memory result = deployer.deployAndConnectContractsMainnet(deploymentParams);
        collateralRegistry = result.collateralRegistry;
        boldToken = result.boldToken;

        // Record contracts
        for (uint256 c = 0; c < numCollaterals; c++) {
            contractsArray.push(result.contractsArray[c]);
        }

        // Give all users all collaterals
        uint256 initialColl = 1000_000e18;
        for (uint256 i = 0; i < 6; i++) {
            deal(address(result.mockCollaterals.WETH), accountsList[i], initialColl);
            deal(address(result.mockCollaterals.RETH), accountsList[i], initialColl);
            deal(address(result.mockCollaterals.WSTETH), accountsList[i], initialColl);
            deal(address(result.mockCollaterals.ETHX), accountsList[i], initialColl);
            deal(address(result.mockCollaterals.OSETH), accountsList[i], initialColl);

            vm.startPrank(accountsList[i]);
            // Approve all Borrower Ops to use the user's WETH funds
            result.mockCollaterals.WETH.approve(address(contractsArray[0].borrowerOperations), initialColl);
            result.mockCollaterals.WETH.approve(address(contractsArray[1].borrowerOperations), initialColl);
            result.mockCollaterals.WETH.approve(address(contractsArray[2].borrowerOperations), initialColl);
            result.mockCollaterals.WETH.approve(address(contractsArray[3].borrowerOperations), initialColl);
            result.mockCollaterals.WETH.approve(address(contractsArray[4].borrowerOperations), initialColl);

            // Approve Borrower Ops in LST branches to use the user's respective LST funds
            result.mockCollaterals.RETH.approve(address(contractsArray[1].borrowerOperations), initialColl);
            result.mockCollaterals.WSTETH.approve(address(contractsArray[2].borrowerOperations), initialColl);
            result.mockCollaterals.ETHX.approve(address(contractsArray[3].borrowerOperations), initialColl);
            result.mockCollaterals.OSETH.approve(address(contractsArray[4].borrowerOperations), initialColl);
            vm.stopPrank();
        }

        wethPriceFeed = IWETHPriceFeed(address(contractsArray[0].priceFeed));
        rethPriceFeed = ICompositePriceFeed(address(contractsArray[1].priceFeed));
        wstethPriceFeed = IWSTETHPriceFeed(address(contractsArray[2].priceFeed));
        ethXPriceFeed = ICompositePriceFeed(address(contractsArray[3].priceFeed));
        osEthPriceFeed = ICompositePriceFeed(address(contractsArray[4].priceFeed));

        // log some current blockchain state
        console.log(block.timestamp, "block.timestamp");
        console.log(block.number, "block.number");
        console.log(ethOracle.decimals(), "ETHUSD decimals");
        console.log(rethOracle.decimals(), "RETHETH decimals");
        console.log(ethXOracle.decimals(), "ETHXETH decimals");
        console.log(stethOracle.decimals(), "STETHETH decimals");
    }

    function _getLatestAnswerFromOracle(AggregatorV3Interface _oracle) internal view returns (uint256) {
        (, int256 answer,,,) = _oracle.latestRoundData();
        uint256 decimals = _oracle.decimals();
        assertLe(decimals, 18);
        // Convert to uint and scale up to 18 decimals
        return uint256(answer) * 10 ** (18 - decimals);
    }

    // --- lastGoodPrice set on deployment ---

    function testSetLastGoodPriceOnDeploymentWETH() public view {
        uint256 lastGoodPriceWeth = wethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPriceWeth, 0);

        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        assertEq(lastGoodPriceWeth, latestAnswerEthUsd);
    }

    function testSetLastGoodPriceOnDeploymentRETH() public view {
        uint256 lastGoodPriceReth = rethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPriceReth, 0);

        uint256 latestAnswerREthEth = _getLatestAnswerFromOracle(rethOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        uint256 expectedMarketPrice = latestAnswerREthEth * latestAnswerEthUsd / 1e18;

        uint256 rate = rETHToken.getExchangeRate();
        assertGt(rate, 1e18);

        uint256 expectedCanonicalPrice = rate * latestAnswerEthUsd / 1e18;

        uint256 expectedPrice = LiquityMath._min(expectedMarketPrice, expectedCanonicalPrice);

        assertEq(lastGoodPriceReth, expectedPrice);
    }

    function testSetLastGoodPriceOnDeploymentETHX() public view {
        uint256 lastGoodPriceEthX = ethXPriceFeed.lastGoodPrice();
        assertGt(lastGoodPriceEthX, 0);

        uint256 latestAnswerEthXEth = _getLatestAnswerFromOracle(ethXOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        uint256 expectedMarketPrice = latestAnswerEthXEth * latestAnswerEthUsd / 1e18;

        (, uint256 ethBalance, uint256 ethXSupply) = staderOracle.exchangeRate();
        uint256 rate = ethBalance * 1e18 / ethXSupply;
        assertGt(rate, 1e18);

        uint256 expectedCanonicalPrice = rate * latestAnswerEthUsd / 1e18;

        uint256 expectedPrice = LiquityMath._min(expectedMarketPrice, expectedCanonicalPrice);

        assertEq(lastGoodPriceEthX, expectedPrice);
    }

    function testSetLastGoodPriceOnDeploymentOSETH() public view {
        uint256 lastGoodPriceOsUsd = osEthPriceFeed.lastGoodPrice();
        assertGt(lastGoodPriceOsUsd, 0);

        uint256 latestAnswerOsEthEth = _getLatestAnswerFromOracle(osEthOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        uint256 expectedMarketPrice = latestAnswerOsEthEth * latestAnswerEthUsd / 1e18;

        uint256 rate = osTokenVaultController.convertToAssets(1e18);
        assertGt(rate, 1e18);

        uint256 expectedCanonicalPrice = rate * latestAnswerEthUsd / 1e18;

        uint256 expectedPrice = LiquityMath._min(expectedMarketPrice, expectedCanonicalPrice);

        assertEq(lastGoodPriceOsUsd, expectedPrice);
    }

    function testSetLastGoodPriceOnDeploymentWSTETH() public view {
        uint256 lastGoodPriceWsteth = wstethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPriceWsteth, 0);

        uint256 latestAnswerStethUsd = _getLatestAnswerFromOracle(stethOracle);
        uint256 stethWstethExchangeRate = wstETH.stEthPerToken();

        uint256 expectedStoredPrice = latestAnswerStethUsd * stethWstethExchangeRate / 1e18;

        assertEq(lastGoodPriceWsteth, expectedStoredPrice);
    }

    // --- fetchPrice ---

    function testFetchPriceReturnsCorrectPriceWETH() public {
        uint256 fetchedEthUsdPrice = wethPriceFeed.fetchPrice();
        assertGt(fetchedEthUsdPrice, 0);

        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        assertEq(fetchedEthUsdPrice, latestAnswerEthUsd);
    }

    function testFetchPriceReturnsCorrectPriceRETH() public {
        uint256 fetchedRethUsdPrice = rethPriceFeed.fetchPrice();
        assertGt(fetchedRethUsdPrice, 0);

        uint256 latestAnswerREthEth = _getLatestAnswerFromOracle(rethOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        uint256 expectedMarketPrice = latestAnswerREthEth * latestAnswerEthUsd / 1e18;

        uint256 rate = rETHToken.getExchangeRate();
        assertGt(rate, 1e18);

        uint256 expectedCanonicalPrice = rate * latestAnswerEthUsd / 1e18;

        uint256 expectedPrice = LiquityMath._min(expectedMarketPrice, expectedCanonicalPrice);

        assertEq(fetchedRethUsdPrice, expectedPrice);
    }

    function testFetchPriceReturnsCorrectPriceETHX() public {
        uint256 fetchedEthXUsdPrice = ethXPriceFeed.fetchPrice();
        assertGt(fetchedEthXUsdPrice, 0);

        uint256 latestAnswerEthXEth = _getLatestAnswerFromOracle(ethXOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        uint256 expectedMarketPrice = latestAnswerEthXEth * latestAnswerEthUsd / 1e18;

        (, uint256 ethBalance, uint256 ethXSupply) = staderOracle.exchangeRate();
        uint256 rate = ethBalance * 1e18 / ethXSupply;
        assertGt(rate, 1e18);

        uint256 expectedCanonicalPrice = rate * latestAnswerEthUsd / 1e18;

        uint256 expectedPrice = LiquityMath._min(expectedMarketPrice, expectedCanonicalPrice);

        assertEq(fetchedEthXUsdPrice, expectedPrice);
    }

    function testFetchPriceReturnsCorrectPriceOSETH() public {
        uint256 fetchedOsEthUsdPrice = osEthPriceFeed.fetchPrice();
        assertGt(fetchedOsEthUsdPrice, 0);

        uint256 latestAnswerOsEthEth = _getLatestAnswerFromOracle(osEthOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        uint256 expectedMarketPrice = latestAnswerOsEthEth * latestAnswerEthUsd / 1e18;

        uint256 rate = osTokenVaultController.convertToAssets(1e18);
        assertGt(rate, 1e18);

        uint256 expectedCanonicalPrice = rate * latestAnswerEthUsd / 1e18;

        uint256 expectedPrice = LiquityMath._min(expectedMarketPrice, expectedCanonicalPrice);

        assertEq(fetchedOsEthUsdPrice, expectedPrice);
    }

    function testFetchPriceReturnsCorrectPriceWSTETH() public {
        uint256 fetchedStethUsdPrice = wstethPriceFeed.fetchPrice();
        assertGt(fetchedStethUsdPrice, 0);

        uint256 latestAnswerStethUsd = _getLatestAnswerFromOracle(stethOracle);
        uint256 stethWstethExchangeRate = wstETH.stEthPerToken();

        uint256 expectedFetchedPrice = latestAnswerStethUsd * stethWstethExchangeRate / 1e18;

        assertEq(fetchedStethUsdPrice, expectedFetchedPrice);
    }

    // --- Thresholds set at deployment ---

    function testEthUsdStalenessThresholdSetWETH() public view {
        (, uint256 storedEthUsdStaleness,) = wethPriceFeed.ethUsdOracle();
        assertEq(storedEthUsdStaleness, _24_HOURS);
    }

    function testEthUsdStalenessThresholdSetRETH() public view {
        (, uint256 storedEthUsdStaleness,) = rethPriceFeed.ethUsdOracle();
        assertEq(storedEthUsdStaleness, _24_HOURS);
    }

    function testRethEthStalenessThresholdSetRETH() public view {
        (, uint256 storedRethEthStaleness,) = rethPriceFeed.lstEthOracle();
        assertEq(storedRethEthStaleness, _48_HOURS);
    }

    function testEthUsdStalenessThresholdSetETHX() public view {
        (, uint256 storedEthUsdStaleness,) = ethXPriceFeed.ethUsdOracle();
        assertEq(storedEthUsdStaleness, _24_HOURS);
    }

    function testEthXEthStalenessThresholdSetETHX() public view {
        (, uint256 storedEthXEthStaleness,) = ethXPriceFeed.lstEthOracle();
        assertEq(storedEthXEthStaleness, _48_HOURS);
    }

    function testEthUsdStalenessThresholdSetOSETH() public view {
        (, uint256 storedEthUsdStaleness,) = osEthPriceFeed.ethUsdOracle();
        assertEq(storedEthUsdStaleness, _24_HOURS);
    }

    function testOsEthEthStalenessThresholdSetOSETH() public view {
        (, uint256 storedOsEthStaleness,) = osEthPriceFeed.lstEthOracle();
        assertEq(storedOsEthStaleness, _48_HOURS);
    }

    function testStethUsdStalenessThresholdSetWSTETH() public view {
        (, uint256 storedStEthUsdStaleness,) = wstethPriceFeed.stEthUsdOracle();
        assertEq(storedStEthUsdStaleness, _24_HOURS);
    }

    // // --- Basic actions ---

    function testOpenTroveWETH() public {
        uint256 price = _getLatestAnswerFromOracle(ethOracle);

        uint256 coll = 5 ether;
        uint256 debtRequest = coll * price / 2 / 1e18;

        uint256 trovesCount = contractsArray[0].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        vm.startPrank(A);
        contractsArray[0].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        trovesCount = contractsArray[0].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    function testOpenTroveRETH() public {
        uint256 latestAnswerREthEth = _getLatestAnswerFromOracle(rethOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        uint256 calcdRethUsdPrice = latestAnswerREthEth * latestAnswerEthUsd / 1e18;

        uint256 coll = 5 ether;
        uint256 debtRequest = coll * calcdRethUsdPrice / 2 / 1e18;

        uint256 trovesCount = contractsArray[1].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        vm.startPrank(A);
        contractsArray[1].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        trovesCount = contractsArray[1].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    function testOpenTroveETHX() public {
        uint256 latestAnswerEthXEth = _getLatestAnswerFromOracle(ethXOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        uint256 calcdEthXUsdPrice = latestAnswerEthXEth * latestAnswerEthUsd / 1e18;

        uint256 coll = 5 ether;
        uint256 debtRequest = coll * calcdEthXUsdPrice / 2 / 1e18;

        uint256 trovesCount = contractsArray[3].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        vm.startPrank(A);
        contractsArray[3].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        trovesCount = contractsArray[3].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    function testOpenTroveOSETH() public {
        uint256 latestAnswerOsEthEth = _getLatestAnswerFromOracle(osEthOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        uint256 calcdOsEthUsdPrice = latestAnswerOsEthEth * latestAnswerEthUsd / 1e18;

        uint256 coll = 5 ether;
        uint256 debtRequest = coll * calcdOsEthUsdPrice / 2 / 1e18;

        uint256 trovesCount = contractsArray[4].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        vm.startPrank(A);
        contractsArray[4].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        trovesCount = contractsArray[4].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    function testOpenTroveWSTETH() public {
        uint256 latestAnswerStethUsd = _getLatestAnswerFromOracle(stethOracle);
        uint256 wstethStethExchangeRate = wstETH.tokensPerStEth();

        uint256 calcdWstethUsdPrice = latestAnswerStethUsd * wstethStethExchangeRate / 1e18;

        uint256 coll = 5 ether;
        uint256 debtRequest = coll * calcdWstethUsdPrice / 2 / 1e18;

        uint256 trovesCount = contractsArray[2].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 0);

        vm.startPrank(A);
        contractsArray[2].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        trovesCount = contractsArray[2].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);
    }

    // TODO:
    // - More basic actions tests (adjust, close, etc)
    // - liq tests (manipulate aggregator stored price)
    // - conditional shutdown logic tests (manipulate aggregator stored price)
}
