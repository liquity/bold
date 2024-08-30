// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./TestContracts/Accounts.sol";
import "./TestContracts/ChainlinkOracleMock.sol";
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
    AggregatorV3Interface ethOracle;
    AggregatorV3Interface stethOracle;
    AggregatorV3Interface rethOracle;
    AggregatorV3Interface ethXOracle;
    AggregatorV3Interface osEthOracle;

    ChainlinkOracleMock mockOracle;

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
    ICollateralRegistry collateralRegistry;
    IBoldToken boldToken;

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

        uint256 numCollaterals = 5;
        TestDeployer.TroveManagerParams memory tmParams =
            TestDeployer.TroveManagerParams(150e16, 110e16, 110e16, 5e16, 10e16);
        TestDeployer.TroveManagerParams[] memory troveManagerParamsArray =
            new TestDeployer.TroveManagerParams[](numCollaterals);
        for (uint256 i = 0; i < troveManagerParamsArray.length; i++) {
            troveManagerParamsArray[i] = tmParams;
        }

        TestDeployer deployer = new TestDeployer();
        TestDeployer.DeploymentResultMainnet memory result =
            deployer.deployAndConnectContractsMainnet(troveManagerParamsArray);
        collateralRegistry = result.collateralRegistry;
        boldToken = result.boldToken;

        ethOracle = AggregatorV3Interface(result.externalAddresses.ETHOracle);
        rethOracle = AggregatorV3Interface(result.externalAddresses.RETHOracle);
        stethOracle = AggregatorV3Interface(result.externalAddresses.STETHOracle);
        ethXOracle = AggregatorV3Interface(result.externalAddresses.ETHXOracle);
        osEthOracle = AggregatorV3Interface(result.externalAddresses.OSETHOracle);

        mockOracle = new ChainlinkOracleMock();

        rETHToken = IRETHToken(result.externalAddresses.RETHToken);
        staderOracle = IStaderOracle(result.externalAddresses.StaderOracle);
        osTokenVaultController = IOsTokenVaultController(result.externalAddresses.OsTokenVaultController);

        wstETH = IWSTETH(result.externalAddresses.WSTETHToken);

        // Record contracts
        for (uint256 c = 0; c < numCollaterals; c++) {
            contractsArray.push(result.contractsArray[c]);
        }

        // Give all users all collaterals
        uint256 initialColl = 1000_000e18;
        for (uint256 i = 0; i < 6; i++) {
            for (uint256 j = 0; j < numCollaterals; j++) {
                deal(address(contractsArray[j].collToken), accountsList[i], initialColl);
                vm.startPrank(accountsList[i]);
                // Approve all Borrower Ops to use the user's WETH funds
                contractsArray[0].collToken.approve(address(contractsArray[j].borrowerOperations), type(uint256).max);
                // Approve Borrower Ops in LST branches to use the user's respective LST funds
                contractsArray[j].collToken.approve(address(contractsArray[j].borrowerOperations), type(uint256).max);
                vm.stopPrank();
            }

            vm.startPrank(accountsList[i]);
        }

        wethPriceFeed = IWETHPriceFeed(address(contractsArray[0].priceFeed));
        rethPriceFeed = ICompositePriceFeed(address(contractsArray[1].priceFeed));
        wstethPriceFeed = IWSTETHPriceFeed(address(contractsArray[2].priceFeed));
        ethXPriceFeed = ICompositePriceFeed(address(contractsArray[3].priceFeed));
        osEthPriceFeed = ICompositePriceFeed(address(contractsArray[4].priceFeed));

        // log some current blockchain state
        // console2.log(block.timestamp, "block.timestamp");
        // console2.log(block.number, "block.number");
        // console2.log(ethOracle.decimals(), "ETHUSD decimals");
        // console2.log(rethOracle.decimals(), "RETHETH decimals");
        // console2.log(ethXOracle.decimals(), "ETHXETH decimals");
        // console2.log(stethOracle.decimals(), "STETHETH decimals");
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
        (uint256 fetchedEthUsdPrice, ) = wethPriceFeed.fetchPrice();
        assertGt(fetchedEthUsdPrice, 0);

        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        assertEq(fetchedEthUsdPrice, latestAnswerEthUsd);
    }

    function testFetchPriceReturnsCorrectPriceRETH() public {
        (uint256 fetchedRethUsdPrice, ) = rethPriceFeed.fetchPrice();
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
        (uint256 fetchedEthXUsdPrice, ) = ethXPriceFeed.fetchPrice();
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
        (uint256 fetchedOsEthUsdPrice, ) = osEthPriceFeed.fetchPrice();
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
        (uint256 fetchedStethUsdPrice, ) = wstethPriceFeed.fetchPrice();
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

    // --- Oracle manipulation tests ---

    function testManipulatedChainlinkReturnsStalePrice() public {
        // Replace the ETH Oracle's code with the mock oracle's code that returns a stale price
        vm.etch(address(ethOracle), address(mockOracle).code);

        (,,,uint256 updatedAt,) = ethOracle.latestRoundData();

        console2.log(updatedAt);
        console2.log(block.timestamp);

        // Confirm it's stale
        assertEq(updatedAt, block.timestamp - 7 days);
    }

    function testManipulatedChainlinkReturns2kUsdPrice() public {
        // Replace the ETH Oracle's code with the mock oracle's code that returns a stale price
        vm.etch(address(ethOracle), address(mockOracle).code);

        uint256 price = _getLatestAnswerFromOracle(ethOracle);
        assertEq(price, 2000e18);
    }

    function testOpenTroveWETHWithStalePriceReverts() public {
        vm.etch(address(ethOracle), address(mockOracle).code);
        (,,,uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        assertFalse(contractsArray[0].borrowerOperations.hasBeenShutDown());

        uint256 price = _getLatestAnswerFromOracle(ethOracle);
 
        uint256 coll = 5 ether;
        uint256 debtRequest = coll * price / 2 / 1e18;

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.NewOracleFailureDetected.selector);
        contractsArray[0].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );
    }

    function testAdjustTroveWETHWithStalePriceReverts() public {
        uint256 price = _getLatestAnswerFromOracle(ethOracle);
 
        uint256 coll = 5 ether;
        uint256 debtRequest = coll * price / 2 / 1e18;

        vm.startPrank(A);
        uint256 troveId = contractsArray[0].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        // confirm Trove was opened
        uint256 trovesCount = contractsArray[0].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);

        // Replace oracle with a stale oracle
        vm.etch(address(ethOracle), address(mockOracle).code);
        (,,,uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Try to adjust Trove
        vm.expectRevert(BorrowerOperations.NewOracleFailureDetected.selector);
        contractsArray[0].borrowerOperations.adjustTrove(troveId, 0, false, 1 wei, true, 1e18);
    }

    function testOpenTroveWSTETHWithStalePriceReverts() public {
        vm.etch(address(stethOracle), address(mockOracle).code);
        (,,,uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        assertFalse(contractsArray[2].borrowerOperations.hasBeenShutDown());

        uint256 price = _getLatestAnswerFromOracle(stethOracle);
 
        uint256 coll = 5 ether;
        uint256 debtRequest = coll * price / 2 / 1e18;

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.NewOracleFailureDetected.selector);
        contractsArray[2].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );
    }

    function testAdjustTroveWSTETHWithStalePriceReverts() public {
        uint256 price = _getLatestAnswerFromOracle(stethOracle);
 
        uint256 coll = 5 ether;
        uint256 debtRequest = coll * price / 2 / 1e18;

        vm.startPrank(A);
        uint256 troveId = contractsArray[2].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        // confirm Trove was opened
        uint256 trovesCount = contractsArray[2].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);

        // Replace oracle with a stale oracle
        vm.etch(address(stethOracle), address(mockOracle).code);
        (,,,uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Try to adjust Trove
        vm.expectRevert(BorrowerOperations.NewOracleFailureDetected.selector);
        contractsArray[2].borrowerOperations.adjustTrove(troveId, 0, false, 1 wei, true, 1e18);
    }

    function testOpenTroveRETHWithStaleRETHPriceReverts() public {
        // Make only RETH oracle stale
        vm.etch(address(rethOracle), address(mockOracle).code);
        (,,,uint256 updatedAt,) = rethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        assertFalse(contractsArray[1].borrowerOperations.hasBeenShutDown());

        uint256 latestAnswerREthEth = _getLatestAnswerFromOracle(rethOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);
        uint256 calcdRethUsdPrice = latestAnswerREthEth * latestAnswerEthUsd / 1e18;
 
        uint256 coll = 5 ether;
        uint256 debtRequest = coll * calcdRethUsdPrice / 2 / 1e18;

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.NewOracleFailureDetected.selector);
        contractsArray[1].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );
    }

    function testAdjustTroveRETHWithStaleRETHPriceReverts() public {
        uint256 latestAnswerREthEth = _getLatestAnswerFromOracle(rethOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);
        uint256 calcdRethUsdPrice = latestAnswerREthEth * latestAnswerEthUsd / 1e18;
 
        uint256 coll = 5 ether;
        uint256 debtRequest = coll * calcdRethUsdPrice / 2 / 1e18;

        vm.startPrank(A);
        uint256 troveId = contractsArray[1].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        // confirm Trove was opened
        uint256 trovesCount = contractsArray[1].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);

        // Make only RETH oracle stale
        vm.etch(address(rethOracle), address(mockOracle).code);
        (,,,uint256 updatedAt,) = rethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Try to adjust Trove
        vm.expectRevert(BorrowerOperations.NewOracleFailureDetected.selector);
        contractsArray[1].borrowerOperations.adjustTrove(troveId, 0, false, 1 wei, true, 1e18);
    }

     function testOpenTroveRETHWithStaleETHPriceReverts() public {
        // Make only ETH oracle stale
        vm.etch(address(ethOracle), address(mockOracle).code);
        (,,,uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        assertFalse(contractsArray[1].borrowerOperations.hasBeenShutDown());

        uint256 latestAnswerREthEth = _getLatestAnswerFromOracle(rethOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);
        uint256 calcdRethUsdPrice = latestAnswerREthEth * latestAnswerEthUsd / 1e18;
 
        uint256 coll = 5 ether;
        uint256 debtRequest = coll * calcdRethUsdPrice / 2 / 1e18;

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.NewOracleFailureDetected.selector);
        contractsArray[1].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );
    }

    function testAdjustTroveRETHWithStaleETHPriceReverts() public {
        uint256 latestAnswerREthEth = _getLatestAnswerFromOracle(rethOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);
        uint256 calcdRethUsdPrice = latestAnswerREthEth * latestAnswerEthUsd / 1e18;
 
        uint256 coll = 5 ether;
        uint256 debtRequest = coll * calcdRethUsdPrice / 2 / 1e18;

        vm.startPrank(A);
        /* uint256 troveId =  */contractsArray[1].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        // confirm Trove was opened
        uint256 trovesCount = contractsArray[1].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);

       // Make only ETH oracle stale
        vm.etch(address(ethOracle), address(mockOracle).code);
        (,,,uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // // Try to adjust Trove
        // vm.expectRevert(BorrowerOperations.NewOracleFailureDetected.selector);
        // contractsArray[1].borrowerOperations.adjustTrove(troveId, 0, false, 1 wei, true, 1e18);
    }


    // TODO:
    // - More basic actions tests (adjust, close, etc)
    // - liq tests (manipulate aggregator stored price)
    // - conditional shutdown logic tests (manipulate aggregator stored price)
}
