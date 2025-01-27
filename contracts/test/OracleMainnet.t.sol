// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "src/PriceFeeds/WSTETHPriceFeed.sol";
import "src/PriceFeeds/MainnetPriceFeedBase.sol";
import "src/PriceFeeds/RETHPriceFeed.sol";
import "src/PriceFeeds/WETHPriceFeed.sol";

import "./TestContracts/Accounts.sol";
import "./TestContracts/ChainlinkOracleMock.sol";
import "./TestContracts/GasGuzzlerOracle.sol";
import "./TestContracts/GasGuzzlerToken.sol";
import "./TestContracts/RETHTokenMock.sol";
import "./TestContracts/WSTETHTokenMock.sol";
import "./TestContracts/Deployment.t.sol";

import "src/Dependencies/AggregatorV3Interface.sol";
import "src/Interfaces/IRETHPriceFeed.sol";
import "src/Interfaces/IWSTETHPriceFeed.sol";

import "src/Interfaces/IRETHToken.sol";
import "src/Interfaces/IWSTETH.sol";

import "forge-std/Test.sol";
import "lib/forge-std/src/console2.sol";

contract OraclesMainnet is TestAccounts {
    AggregatorV3Interface ethOracle;
    AggregatorV3Interface stethOracle;
    AggregatorV3Interface rethOracle;

    ChainlinkOracleMock mockOracle;
    GasGuzzlerToken gasGuzzlerToken;
    GasGuzzlerOracle gasGuzzlerOracle;

    IMainnetPriceFeed wethPriceFeed;
    IRETHPriceFeed rethPriceFeed;
    IWSTETHPriceFeed wstethPriceFeed;

    IRETHToken rethToken;
    IWSTETH wstETH;

    RETHTokenMock mockRethToken;
    WSTETHTokenMock mockWstethToken;

    TestDeployer.LiquityContracts[] contractsArray;
    CollateralRegistryTester collateralRegistry;
    IBoldToken boldToken;

    struct StoredOracle {
        AggregatorV3Interface aggregator;
        uint256 stalenessThreshold;
        uint256 decimals;
    }

    struct Vars {
        uint256 numCollaterals;
        uint256 initialColl;
        uint256 price;
        uint256 coll;
        uint256 debtRequest;
    }

    function setUp() public {
        try vm.envString("MAINNET_RPC_URL") returns (string memory rpcUrl) {
            vm.createSelectFork(rpcUrl);
        } catch {
            vm.skip(true);
        }

        Vars memory vars;

        accounts = new Accounts();
        createAccounts();

        (A, B, C, D, E, F) =
            (accountsList[0], accountsList[1], accountsList[2], accountsList[3], accountsList[4], accountsList[5]);

        vars.numCollaterals = 3;
        TestDeployer.TroveManagerParams memory tmParams =
            TestDeployer.TroveManagerParams(150e16, 110e16, 110e16, 5e16, 10e16);
        TestDeployer.TroveManagerParams[] memory troveManagerParamsArray =
            new TestDeployer.TroveManagerParams[](vars.numCollaterals);
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

        mockOracle = new ChainlinkOracleMock();
        gasGuzzlerToken = new GasGuzzlerToken();
        gasGuzzlerOracle = new GasGuzzlerOracle();

        rethToken = IRETHToken(result.externalAddresses.RETHToken);

        wstETH = IWSTETH(result.externalAddresses.WSTETHToken);

        mockRethToken = new RETHTokenMock();
        mockWstethToken = new WSTETHTokenMock();

        // Record contracts
        for (uint256 c = 0; c < vars.numCollaterals; c++) {
            contractsArray.push(result.contractsArray[c]);
        }

        // Give all users all collaterals
        vars.initialColl = 1000_000e18;
        for (uint256 i = 0; i < 6; i++) {
            for (uint256 j = 0; j < vars.numCollaterals; j++) {
                deal(address(contractsArray[j].collToken), accountsList[i], vars.initialColl);
                vm.startPrank(accountsList[i]);
                // Approve all Borrower Ops to use the user's WETH funds
                contractsArray[0].collToken.approve(address(contractsArray[j].borrowerOperations), type(uint256).max);
                // Approve Borrower Ops in LST branches to use the user's respective LST funds
                contractsArray[j].collToken.approve(address(contractsArray[j].borrowerOperations), type(uint256).max);
                vm.stopPrank();
            }

            vm.startPrank(accountsList[i]);
        }

        wethPriceFeed = IMainnetPriceFeed(address(contractsArray[0].priceFeed));
        rethPriceFeed = IRETHPriceFeed(address(contractsArray[1].priceFeed));
        wstethPriceFeed = IWSTETHPriceFeed(address(contractsArray[2].priceFeed));

        // log some current blockchain state
        // console2.log(block.timestamp, "block.timestamp");
        // console2.log(block.number, "block.number");
        // console2.log(ethOracle.decimals(), "ETHUSD decimals");
        // console2.log(rethOracle.decimals(), "RETHETH decimals");
        // console2.log(stethOracle.decimals(), "STETHETH decimals");

        // Artificially decay the base rate so we start with a low redemption rate.
        // Normally, we would just wait for it to decay "naturally" (with `vm.warp`), but we can't do that here,
        // as it would result in all the oracles going stale.
        collateralRegistry.setBaseRate(0);
    }

    function _getLatestAnswerFromOracle(AggregatorV3Interface _oracle) internal view returns (uint256) {
        (, int256 answer,,,) = _oracle.latestRoundData();

        uint256 decimals = _oracle.decimals();
        assertLe(decimals, 18);
        // Convert to uint and scale up to 18 decimals
        return uint256(answer) * 10 ** (18 - decimals);
    }

    function redeem(address _from, uint256 _boldAmount) public {
        vm.startPrank(_from);
        collateralRegistry.redeemCollateral(_boldAmount, MAX_UINT256, 1e18);
        vm.stopPrank();
    }

    function etchStaleMockToEthOracle(bytes memory _mockOracleCode) internal {
        // Etch the mock code to the ETH-USD oracle address
        vm.etch(address(ethOracle), _mockOracleCode);
        ChainlinkOracleMock mock = ChainlinkOracleMock(address(ethOracle));
        mock.setDecimals(8);
        // Fake ETH-USD price of 2000 USD
        mock.setPrice(2000e8);
        // Make it stale
        mock.setUpdatedAt(block.timestamp - 7 days);
    }

    function etchStaleMockToRethOracle(bytes memory _mockOracleCode) internal {
        // Etch the mock code to the RETH-ETH oracle address
        vm.etch(address(rethOracle), _mockOracleCode);
        // Wrap so we can use the mock's setters
        ChainlinkOracleMock mock = ChainlinkOracleMock(address(rethOracle));
        mock.setDecimals(18);
        // Set 1 RETH = 1 ETH
        mock.setPrice(1e18);
        // Make it stale
        mock.setUpdatedAt(block.timestamp - 7 days);
    }

    function etchStaleMockToStethOracle(bytes memory _mockOracleCode) internal {
        // Etch the mock code to the STETH-USD oracle address
        vm.etch(address(stethOracle), _mockOracleCode);
        // Wrap so we can use the mock's setters
        ChainlinkOracleMock mock = ChainlinkOracleMock(address(stethOracle));
        mock.setDecimals(8);
        // Set 1 STETH =  2000 USD
        mock.setPrice(2000e8);
        // Make it stale
        mock.setUpdatedAt(block.timestamp - 7 days);
    }

    function etchGasGuzzlerToEthOracle(bytes memory _mockOracleCode) internal {
        // Etch the mock code to the ETH-USD oracle address
        vm.etch(address(ethOracle), _mockOracleCode);
        GasGuzzlerOracle mock = GasGuzzlerOracle(address(ethOracle));
        mock.setDecimals(8);
        // Fake ETH-USD price of 2000 USD
        mock.setPrice(2000e8);
        mock.setUpdatedAt(block.timestamp);
    }


    function etchGasGuzzlerToRethOracle(bytes memory _mockOracleCode) internal {
        // Etch the mock code to the RETH-ETH oracle address
        vm.etch(address(rethOracle), _mockOracleCode);
        // Wrap so we can use the mock's setters
        GasGuzzlerOracle mock = GasGuzzlerOracle(address(rethOracle));
        mock.setDecimals(18);
        // Set 1 RETH = 1.1 ETH
        mock.setPrice(11e17);
        mock.setUpdatedAt(block.timestamp);
    }

    function etchGasGuzzlerToStethOracle(bytes memory _mockOracleCode) internal {
        // Etch the mock code to the STETH-USD oracle address
        vm.etch(address(stethOracle), _mockOracleCode);
        // Wrap so we can use the mock's setters
        GasGuzzlerOracle mock = GasGuzzlerOracle(address(stethOracle));
        mock.setDecimals(8);
        // Set 1 STETH =  2000 USD
        mock.setPrice(2000e8);
        mock.setUpdatedAt(block.timestamp);
    }

    function etchGasGuzzlerMockToRethToken(bytes memory _mockTokenCode) internal {
        // Etch the mock code to the RETH token address
        vm.etch(address(rethToken), _mockTokenCode);
    }

    function etchGasGuzzlerMockToWstethToken(bytes memory _mockTokenCode) internal {
        // Etch the mock code to the RETH token address
        vm.etch(address(wstETH), _mockTokenCode);
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

        uint256 rate = rethToken.getExchangeRate();
        assertGt(rate, 1e18);

        uint256 expectedCanonicalPrice = rate * latestAnswerEthUsd / 1e18;

        uint256 expectedPrice = LiquityMath._min(expectedMarketPrice, expectedCanonicalPrice);

        assertEq(lastGoodPriceReth, expectedPrice);
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
        (uint256 fetchedEthUsdPrice,) = wethPriceFeed.fetchPrice();
        assertGt(fetchedEthUsdPrice, 0);

        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        assertEq(fetchedEthUsdPrice, latestAnswerEthUsd);
    }

    function testFetchPriceReturnsCorrectPriceRETH() public {
        (uint256 fetchedRethUsdPrice,) = rethPriceFeed.fetchPrice();
        assertGt(fetchedRethUsdPrice, 0);

        uint256 latestAnswerREthEth = _getLatestAnswerFromOracle(rethOracle);
        uint256 latestAnswerEthUsd = _getLatestAnswerFromOracle(ethOracle);

        uint256 expectedMarketPrice = latestAnswerREthEth * latestAnswerEthUsd / 1e18;

        uint256 rate = rethToken.getExchangeRate();
        assertGt(rate, 1e18);

        uint256 expectedCanonicalPrice = rate * latestAnswerEthUsd / 1e18;

        uint256 expectedPrice = LiquityMath._min(expectedMarketPrice, expectedCanonicalPrice);

        assertEq(fetchedRethUsdPrice, expectedPrice);
    }

    function testFetchPriceReturnsCorrectPriceWSTETH() public {
        (uint256 fetchedStethUsdPrice,) = wstethPriceFeed.fetchPrice();
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
        (, uint256 storedRethEthStaleness,) = rethPriceFeed.rEthEthOracle();
        assertEq(storedRethEthStaleness, _48_HOURS);
    }

    function testStethUsdStalenessThresholdSetWSTETH() public view {
        (, uint256 storedStEthUsdStaleness,) = wstethPriceFeed.stEthUsdOracle();
        assertEq(storedStEthUsdStaleness, _24_HOURS);
    }

    // --- LST exchange rates and market price oracle sanity checks ---

    function testRETHExchangeRateBetween1And2() public {
        uint256 rate = rethToken.getExchangeRate();
        assertGt(rate, 1e18);
        assertLt(rate, 2e18);
    }

    function testWSTETHExchangeRateBetween1And2() public {
        uint256 rate = wstETH.stEthPerToken();
        assertGt(rate, 1e18);
        assertLt(rate, 2e18);
    }

    function testRETHOracleAnswerBetween1And2() public {
        uint256 answer = _getLatestAnswerFromOracle(rethOracle);
        assertGt(answer, 1e18);
        assertLt(answer, 2e18);
    }

    function testSTETHOracleAnswerWithin1PctOfETHOracleAnswer() public {
        uint256 stethUsd = _getLatestAnswerFromOracle(stethOracle);
        uint256 ethUsd = _getLatestAnswerFromOracle(ethOracle);

        uint256 relativeDelta;

        if (stethUsd > ethUsd) {
            relativeDelta = (stethUsd - ethUsd) * 1e18 / ethUsd;
        } else {
            relativeDelta = (ethUsd - stethUsd) * 1e18 / stethUsd;
        }

        assertLt(relativeDelta, 1e16);
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

    function testOpenTroveWSTETH() public {
        uint256 latestAnswerStethUsd = _getLatestAnswerFromOracle(stethOracle);
        uint256 wstethStethExchangeRate = wstETH.stEthPerToken();

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
        etchStaleMockToEthOracle(address(mockOracle).code);

        (,,, uint256 updatedAt,) = ethOracle.latestRoundData();

        // Confirm it's stale
        assertEq(updatedAt, block.timestamp - 7 days);
    }

    function testManipulatedChainlinkReturns2kUsdPrice() public {
        // Replace the ETH Oracle's code with the mock oracle's code that returns a stale price
        etchStaleMockToEthOracle(address(mockOracle).code);

        uint256 price = _getLatestAnswerFromOracle(ethOracle);
        assertEq(price, 2000e18);
    }

    function testOpenTroveWETHWithStalePriceReverts() public {
        Vars memory vars;
        etchStaleMockToEthOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        assertFalse(contractsArray[0].borrowerOperations.hasBeenShutDown());

        vars.price = _getLatestAnswerFromOracle(ethOracle);
        vars.coll = 5 ether;
        vars.debtRequest = vars.coll * vars.price / 2 / 1e18;

        vm.startPrank(A);
        vm.expectRevert(BorrowerOperations.NewOracleFailureDetected.selector);
        contractsArray[0].borrowerOperations.openTrove(
            A, 0, vars.coll, vars.debtRequest, 0, 0, 5e16, vars.debtRequest, address(0), address(0), address(0)
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
        etchStaleMockToEthOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Try to adjust Trove
        vm.expectRevert(BorrowerOperations.NewOracleFailureDetected.selector);
        contractsArray[0].borrowerOperations.adjustTrove(troveId, 0, false, 1 wei, true, 1e18);
    }

    function testOpenTroveWSTETHWithStalePriceReverts() public {
        etchStaleMockToStethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = stethOracle.latestRoundData();
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
        etchStaleMockToStethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Try to adjust Trove
        vm.expectRevert(BorrowerOperations.NewOracleFailureDetected.selector);
        contractsArray[2].borrowerOperations.adjustTrove(troveId, 0, false, 1 wei, true, 1e18);
    }

    function testOpenTroveRETHWithStaleRETHPriceReverts() public {
        // Make only RETH oracle stale
        etchStaleMockToRethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = rethOracle.latestRoundData();
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
        etchStaleMockToRethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = rethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Try to adjust Trove
        vm.expectRevert(BorrowerOperations.NewOracleFailureDetected.selector);
        contractsArray[1].borrowerOperations.adjustTrove(troveId, 0, false, 1 wei, true, 1e18);
    }

    function testOpenTroveRETHWithStaleETHPriceReverts() public {
        // Make only ETH oracle stale
        etchStaleMockToEthOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = ethOracle.latestRoundData();
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
        uint256 troveId = contractsArray[1].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        // confirm Trove was opened
        uint256 trovesCount = contractsArray[1].troveManager.getTroveIdsCount();
        assertEq(trovesCount, 1);

        // Make only ETH oracle stale
        etchStaleMockToEthOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // // Try to adjust Trove
        vm.expectRevert(BorrowerOperations.NewOracleFailureDetected.selector);
        contractsArray[1].borrowerOperations.adjustTrove(troveId, 0, false, 1 wei, true, 1e18);
    }

    // --- WETH shutdown ---

    function testWETHPriceFeedShutsDownWhenETHUSDOracleFails() public {
        // Fetch price
        (uint256 price, bool ethUsdFailed) = wethPriceFeed.fetchPrice();
        assertGt(price, 0);

        // Check oracle call didn't fail
        assertFalse(ethUsdFailed);

        // Check branch is live, not shut down
        assertEq(contractsArray[0].troveManager.shutdownTime(), 0);

        // Make the ETH-USD oracle stale
        etchStaleMockToEthOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (, ethUsdFailed) = wethPriceFeed.fetchPrice();

        // Check oracle call failed this time
        assertTrue(ethUsdFailed);

        // Confirm the branch is now shutdown
        assertEq(contractsArray[0].troveManager.shutdownTime(), block.timestamp);
    }

    function testWETHPriceFeedReturnsLastGoodPriceWhenETHUSDOracleFails() public {
        // Fetch price
        wethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = wethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Make the ETH-USD oracle stale
        etchStaleMockToEthOracle(address(mockOracle).code);
        (, int256 mockPrice,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);
        assertGt(mockPrice, 0, "mockPrice 0");
        // Confirm the lastGoodPrice is not coincidentally equal to the mock oracle's price
        assertNotEq(lastGoodPrice1, uint256(mockPrice));

        // Fetch price again
        (uint256 price, bool ethUsdFailed) = wethPriceFeed.fetchPrice();

        // Check oracle call failed this time
        assertTrue(ethUsdFailed);

        // Confirm the PriceFeed's returned price equals the lastGoodPrice
        assertEq(price, lastGoodPrice1, "current price != lastGoodPrice");

        // Confirm the stored lastGoodPrice has not changed
        assertEq(wethPriceFeed.lastGoodPrice(), lastGoodPrice1, "lastGoodPrice not same");
    }

    // --- RETH shutdown ---

    function testRETHPriceFeedShutsDownWhenETHUSDOracleFails() public {
        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();
        assertGt(price, 0);

        // Check oracle call didn't fail
        assertFalse(oracleFailedWhileBranchLive);

        // Check branch is live, not shut down
        assertEq(contractsArray[1].troveManager.shutdownTime(), 0);

        // Make the ETH-USD oracle stale
        etchStaleMockToEthOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (, oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        // Check an oracle call failed this time
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm the branch is now shutdown
        assertEq(contractsArray[1].troveManager.shutdownTime(), block.timestamp);
    }

    function testRETHPriceFeedShutsDownWhenExchangeRateFails() public {
        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();
        assertGt(price, 0);

        // Check oracle call didn't fail
        assertFalse(oracleFailedWhileBranchLive);

        // Check branch is live, not shut down
        assertEq(contractsArray[1].troveManager.shutdownTime(), 0);

        // Make the exchange rate 0
        vm.etch(address(rethToken), address(mockRethToken).code);
        uint256 rate = rethToken.getExchangeRate();
        assertEq(rate, 0);

        // Fetch price again
        (, oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        // Check a call failed this time
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm the branch is now shutdown
        assertEq(contractsArray[1].troveManager.shutdownTime(), block.timestamp, "timestamps not equal");
    }

    function testRETHPriceFeedReturnsLastGoodPriceWhenETHUSDOracleFails() public {
        // Fetch price
        rethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = rethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Make the ETH-USD oracle stale
        etchStaleMockToEthOracle(address(mockOracle).code);
        (, int256 mockPrice,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);
        assertGt(mockPrice, 0, "mockPrice 0");

        // Fetch price again
        (uint256 price, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        // Check an oracle call failed this time
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm the PriceFeed's returned price equals the lastGoodPrice
        assertEq(price, lastGoodPrice1);

        // Confirm the stored lastGoodPrice has not changed
        assertEq(rethPriceFeed.lastGoodPrice(), lastGoodPrice1);
    }

    function testRETHPriceFeedReturnsLastGoodPriceWhenExchangeRateFails() public {
        // Fetch price
        rethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = rethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Make the exchange rate 0
        vm.etch(address(rethToken), address(mockRethToken).code);
        uint256 rate = rethToken.getExchangeRate();
        assertEq(rate, 0);

        // Fetch price again
        (uint256 price, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        // Check an oracle call failed this time
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm the PriceFeed's returned price equals the lastGoodPrice
        assertEq(price, lastGoodPrice1);

        // Confirm the stored lastGoodPrice has not changed
        assertEq(rethPriceFeed.lastGoodPrice(), lastGoodPrice1);
    }

    function testRETHPriceSourceIsLastGoodPriceWhenETHUSDFails() public {
        // Fetch price
        rethPriceFeed.fetchPrice();

        // Check using primary
        assertEq(uint8(rethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        // Make the ETH-USD oracle stale
        etchStaleMockToEthOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        assertTrue(oracleFailedWhileBranchLive);

        // Check using lastGoodPrice
        assertEq(uint8(rethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.lastGoodPrice));
    }

    function testRETHPriceFeedShutsDownWhenRETHETHOracleFails() public {
        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();
        assertGt(price, 0);

        // Check oracle call didn't fail
        assertFalse(oracleFailedWhileBranchLive);

        // Check branch is live, not shut down
        assertEq(contractsArray[1].troveManager.shutdownTime(), 0);

        // Make the RETH-ETH oracle stale
        etchStaleMockToRethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = rethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (, oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        // Check an oracle call failed this time
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm the branch is now shutdown
        assertEq(contractsArray[1].troveManager.shutdownTime(), block.timestamp);
    }

    function testFetchPriceReturnsMinETHUSDxCanonicalAndLastGoodPriceWhenRETHETHOracleFails() public {
        // Make the RETH-ETH oracle stale
        etchStaleMockToRethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = rethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();
        assertGt(price, 0);

        // Check that the primary calc oracle did fail
        assertTrue(oracleFailedWhileBranchLive);

        // Calc expected price i.e. ETH-USD x canonical
        uint256 ethUsdPrice = _getLatestAnswerFromOracle(ethOracle);
        uint256 exchangeRate = rethToken.getExchangeRate();
        assertGt(ethUsdPrice, 0);
        assertGt(exchangeRate, 0);

        uint256 expectedPrice = LiquityMath._min(rethPriceFeed.lastGoodPrice(), ethUsdPrice * exchangeRate / 1e18);

        assertEq(price, expectedPrice, "price not expected price");
    }

    function testRETHPriceSourceIsETHUSDxCanonicalWhenRETHETHFails() public {
        // Fetch price
        rethPriceFeed.fetchPrice();

        // Check using primary
        assertEq(uint8(rethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        // Make the RETH-ETH oracle stale
        etchStaleMockToRethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = rethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        assertTrue(oracleFailedWhileBranchLive);

        // Check using canonical
        assertEq(uint8(rethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.ETHUSDxCanonical));
    }

    function testRETHWhenUsingETHUSDxCanonicalSwitchesToLastGoodPriceWhenETHUSDOracleFails() public {
        // Make the RETH-USD oracle stale
        etchStaleMockToRethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = rethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Check using primary
        assertEq(uint8(rethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary), "not using primary");

        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        // Check that the primary calc oracle did fail
        assertTrue(oracleFailedWhileBranchLive, "primary oracle calc didnt fail");

        // Check using ETHUSDxCanonical
        assertEq(
            uint8(rethPriceFeed.priceSource()),
            uint8(IMainnetPriceFeed.PriceSource.ETHUSDxCanonical),
            "not using ethusdxcanonical"
        );

        uint256 lastGoodPrice = rethPriceFeed.lastGoodPrice();

        // Make the ETH-USD oracle stale too
        etchStaleMockToEthOracle(address(mockOracle).code);
        (,,, updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Calc expected price if didnt fail,  i.e. ETH-USD x canonical
        uint256 ethUsdPrice = _getLatestAnswerFromOracle(ethOracle);
        uint256 exchangeRate = rethToken.getExchangeRate();
        assertGt(ethUsdPrice, 0);
        assertGt(exchangeRate, 0);
        uint256 priceIfDidntFail = ethUsdPrice * exchangeRate / 1e18;

        // These should differ since the mock oracle's price should not equal the previous real price
        assertNotEq(priceIfDidntFail, lastGoodPrice, "price if didnt fail == lastGoodPrice");

        // Now fetch the price
        (price, oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        // This should be false, since the branch is already shutdown and not live
        assertFalse(oracleFailedWhileBranchLive);

        // Confirm the returned price is the last good price
        assertEq(price, lastGoodPrice, "fetched price != lastGoodPrice");
    }

    function testRETHWhenUsingETHUSDxCanonicalSwitchesToLastGoodPriceWhenExchangeRateFails() public {
        // Make the RETH-USD oracle stale
        etchStaleMockToRethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = rethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Check using primary
        assertEq(uint8(rethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary), "not using primary");

        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        // Check that the primary calc oracle did fail
        assertTrue(oracleFailedWhileBranchLive, "primary oracle calc didnt fail");

        // Check using ETHUSDxCanonical
        assertEq(
            uint8(rethPriceFeed.priceSource()),
            uint8(IMainnetPriceFeed.PriceSource.ETHUSDxCanonical),
            "not using ethusdxcanonical"
        );

        uint256 lastGoodPrice = rethPriceFeed.lastGoodPrice();

        // Calc expected price if didnt fail,  i.e. ETH-USD x canonical
        uint256 ethUsdPrice = _getLatestAnswerFromOracle(ethOracle);
        uint256 exchangeRate = rethToken.getExchangeRate();
        assertGt(ethUsdPrice, 0);
        assertGt(exchangeRate, 0);

        // Make the exchange rate return 0
        vm.etch(address(rethToken), address(mockRethToken).code);
        uint256 rate = rethToken.getExchangeRate();
        assertEq(rate, 0, "mock rate non-zero");

        // Now fetch the price
        (price, oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        // This should be false, since the branch is already shutdown and not live
        assertFalse(oracleFailedWhileBranchLive);

        // Confirm the returned price is the last good price
        assertEq(price, lastGoodPrice, "fetched price != lastGoodPrice");
        // Check we've switched to lastGoodPrice source
        assertEq(
            uint8(rethPriceFeed.priceSource()),
            uint8(IMainnetPriceFeed.PriceSource.lastGoodPrice),
            "not using lastGoodPrice"
        );
    }

    function testRETHWhenUsingETHUSDxCanonicalReturnsMinOfLastGoodPriceAndETHUSDxCanonical() public {
        // Make the RETH-ETH oracle stale
        etchStaleMockToRethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = rethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Check using primary
        assertEq(uint8(rethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        // Check that the primary calc oracle did fail
        assertTrue(oracleFailedWhileBranchLive);

        // Check using ETHUSDxCanonical
        assertEq(uint8(rethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.ETHUSDxCanonical));

        // Make lastGoodPrice tiny, and below ETHUSDxCanonical
        vm.store(
            address(rethPriceFeed),
            bytes32(uint256(1)), // 1st storage slot where lastGoodPrice is stored
            bytes32(uint256(1)) // make lastGoodPrice equal to 1 wei
        );
        assertEq(rethPriceFeed.lastGoodPrice(), 1);

        //  Fetch the price again
        (price,) = rethPriceFeed.fetchPrice();

        // Check price was lastGoodPrice
        assertEq(price, rethPriceFeed.lastGoodPrice());

        // Now make lastGoodPrice massive, and greater than ETHUSDxCanonical
        vm.store(
            address(rethPriceFeed),
            bytes32(uint256(1)), // 1st storage slot where lastGoodPrice is stored
            bytes32(uint256(1e27)) // make lastGoodPrice equal to 1e27 i.e. 1 billion (with 18 decimal digits)
        );
        assertEq(rethPriceFeed.lastGoodPrice(), 1e27);

        //  Fetch the price again
        (price,) = rethPriceFeed.fetchPrice();

        // Check price is expected ETH-USDxCanonical
        // Calc expected price if didnt fail,  i.e.
        uint256 ethUsdPrice = _getLatestAnswerFromOracle(ethOracle);
        uint256 exchangeRate = rethToken.getExchangeRate();
        assertGt(ethUsdPrice, 0);
        assertGt(exchangeRate, 0);
        uint256 priceIfDidntFail = ethUsdPrice * exchangeRate / 1e18;

        assertEq(price, priceIfDidntFail, "price not equal expected");
    }

    function testRETHPriceFeedShutsDownWhenBothOraclesFail() public {
        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();
        assertGt(price, 0);

        // Check oracle call didn't fail
        assertFalse(oracleFailedWhileBranchLive);

        // Check branch is live, not shut down
        assertEq(contractsArray[1].troveManager.shutdownTime(), 0);

        // Make the RETH-ETH oracle stale
        etchStaleMockToRethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = rethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Make the ETH-USD oracle stale too
        etchStaleMockToEthOracle(address(mockOracle).code);
        (,,, updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (, oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        // Check an oracle call failed this time
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm the branch is now shutdown
        assertEq(contractsArray[1].troveManager.shutdownTime(), block.timestamp);
    }

    function testRETHPriceFeedReturnsLastGoodPriceWhenBothOraclesFail() public {
        // Fetch price
        rethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = rethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Make the ETH-USD oracle stale
        etchStaleMockToEthOracle(address(mockOracle).code);
        (, int256 mockPrice,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Make the RETH-ETH oracle stale too
        etchStaleMockToRethOracle(address(mockOracle).code);
        (, mockPrice,, updatedAt,) = rethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (uint256 price, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();

        // Check an oracle call failed this time
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm the PriceFeed's returned price equals the lastGoodPrice
        assertEq(price, lastGoodPrice1);

        // Confirm the stored lastGoodPrice has not changed
        assertEq(rethPriceFeed.lastGoodPrice(), lastGoodPrice1);
    }

    function testRETHPriceSourceIsLastGoodPriceWhenBothOraclesFail() public {
        // Fetch price
        rethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = rethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Check using primary
        assertEq(uint8(rethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        // Make the ETH-USD oracle stale
        etchStaleMockToEthOracle(address(mockOracle).code);
        (, int256 mockPrice,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Make the RETH-ETH oracle stale too
        etchStaleMockToRethOracle(address(mockOracle).code);
        (, mockPrice,, updatedAt,) = rethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        rethPriceFeed.fetchPrice();

        // Check using lastGoodPrice
        assertEq(uint8(rethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.lastGoodPrice));
    }

    // --- WSTETH shutdown ---

    function testWSTETHPriceFeedShutsDownWhenExchangeRateFails() public {
        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();
        assertGt(price, 0);

        // Check oracle call didn't fail
        assertFalse(oracleFailedWhileBranchLive);

        // Check branch is live, not shut down
        assertEq(contractsArray[1].troveManager.shutdownTime(), 0);

        // Make the exchange rate 0
        vm.etch(address(wstETH), address(mockWstethToken).code);
        uint256 rate = wstETH.stEthPerToken();
        assertEq(rate, 0);

        // Fetch price again
        (, oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check a call failed this time
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm the branch is now shutdown
        assertEq(contractsArray[2].troveManager.shutdownTime(), block.timestamp, "timestamps not equal");
    }

    function testWSTETHPriceFeedReturnsLastGoodPriceWhenExchangeRateFails() public {
        // Fetch price
        wstethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = wstethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Make the exchange rate 0
        vm.etch(address(wstETH), address(mockWstethToken).code);
        uint256 rate = wstETH.stEthPerToken();
        assertEq(rate, 0);

        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check a call failed this time
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm the PriceFeed's returned price equals the lastGoodPrice
        assertEq(price, lastGoodPrice1);

        // Confirm the stored lastGoodPrice has not changed
        assertEq(wstethPriceFeed.lastGoodPrice(), lastGoodPrice1);
    }

    function testWSTETHPriceSourceIsLastGoodPricePriceWhenETHUSDOracleFails() public {
        // Fetch price
        (uint256 price1,) = wstethPriceFeed.fetchPrice();
        assertGt(price1, 0, "price is 0");

        // Check using primary
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        // Make the ETH-USD oracle stale
        etchStaleMockToEthOracle(address(mockOracle).code);
        (, int256 mockPrice,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);
        assertGt(mockPrice, 0, "mockPrice 0");

        // Fetch price again
        (, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check ncall failed
        assertTrue(oracleFailedWhileBranchLive);

        // Check using lastGoodPrice
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.lastGoodPrice));
    }

    function testWSTETHPriceFeedReturnsLastGoodPriceWhenETHUSDOracleFails() public {
        // Fetch price
        (uint256 price1,) = wstethPriceFeed.fetchPrice();
        assertGt(price1, 0, "price is 0");

        uint256 lastGoodPriceBeforeFail = wstethPriceFeed.lastGoodPrice();

        // Make the ETH-USD oracle stale
        etchStaleMockToEthOracle(address(mockOracle).code);
        (, int256 mockPrice,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);
        assertGt(mockPrice, 0, "mockPrice 0");

        // Fetch price again
        (uint256 price2, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check oracle failed in this call
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm the PriceFeed's returned price equals the stored lastGoodPrice
        assertEq(price2, lastGoodPriceBeforeFail);
        // Confirm the stored last good price didn't change
        assertEq(lastGoodPriceBeforeFail, wstethPriceFeed.lastGoodPrice());
    }

    function testWSTETHPriceDoesShutsDownWhenETHUSDOracleFails() public {
        // Fetch price
        (, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check no oracle failed in this call, since it uses only STETH-USD oracle in the primary calc
        assertFalse(oracleFailedWhileBranchLive);

        // Check branch is live, not shut down
        assertEq(contractsArray[2].troveManager.shutdownTime(), 0);

        // Make the ETH-USD oracle stale
        etchStaleMockToEthOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (, oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check that the primary calc did fail
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm branch is shut down
        assertEq(contractsArray[2].troveManager.shutdownTime(), block.timestamp);
    }

    function testWSTETHPriceShutdownWhenSTETHUSDOracleFails() public {
        // Fetch price
        (, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check no oracle failed in this call, since it uses only STETH-USD oracle in the primary calc
        assertFalse(oracleFailedWhileBranchLive);

        // Check branch is live, not shut down
        assertEq(contractsArray[2].troveManager.shutdownTime(), 0);

        // Make the STETH-USD oracle stale
        etchStaleMockToStethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (, oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check that this time the primary calc oracle did fail
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm branch is now shut down
        assertEq(contractsArray[2].troveManager.shutdownTime(), block.timestamp);
    }

    function testFetchPriceReturnsMinETHUSDxCanonicalAndLastGoodPriceWhenSTETHUSDOracleFails() public {
        // Make the STETH-USD oracle stale
        etchStaleMockToStethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check that the primary calc oracle did fail
        assertTrue(oracleFailedWhileBranchLive);

        // Calc expected price i.e. ETH-USD x canonical
        uint256 ethUsdPrice = _getLatestAnswerFromOracle(ethOracle);
        uint256 exchangeRate = wstETH.stEthPerToken();
        assertGt(ethUsdPrice, 0);
        assertGt(exchangeRate, 0);

        uint256 expectedPrice = LiquityMath._min(wstethPriceFeed.lastGoodPrice(), ethUsdPrice * exchangeRate / 1e18);

        assertEq(price, expectedPrice, "price not expected price");
    }

    function testSTETHPriceSourceIsETHUSDxCanonicalWhenSTETHUSDOracleFails() public {
        // Check using primary
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        // Make the STETH-USD oracle stale
        etchStaleMockToStethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price
        (, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check that the primary calc oracle did fail
        assertTrue(oracleFailedWhileBranchLive);

        // Check using ETHUSDxCanonical
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.ETHUSDxCanonical));
    }

    function testSTETHWhenUsingETHUSDxCanonicalSwitchesToLastGoodPriceWhenETHUSDOracleFails() public {
        // Make the STETH-USD oracle stale
        etchStaleMockToStethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Check using primary
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check that the primary calc oracle did fail
        assertTrue(oracleFailedWhileBranchLive);

        // Check using ETHUSDxCanonical
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.ETHUSDxCanonical));

        uint256 lastGoodPrice = wstethPriceFeed.lastGoodPrice();

        // Make the ETH-USD oracle stale too
        etchStaleMockToEthOracle(address(mockOracle).code);
        (,,, updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Calc expected price if didnt fail,  i.e. ETH-USD x canonical
        uint256 ethUsdPrice = _getLatestAnswerFromOracle(ethOracle);
        uint256 exchangeRate = wstETH.stEthPerToken();
        assertGt(ethUsdPrice, 0);
        assertGt(exchangeRate, 0);
        uint256 priceIfDidntFail = ethUsdPrice * exchangeRate / 1e18;

        // These should differ since the mock oracle's price should not equal the previous real price
        assertNotEq(priceIfDidntFail, lastGoodPrice, "price if didnt fail == lastGoodPrice");

        // Now fetch the price
        (price, oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check using lastGoodPrice
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.lastGoodPrice));

        // This should be false, since the branch is already shutdown and not live
        assertFalse(oracleFailedWhileBranchLive);

        // Confirm the returned price is the last good price
        assertEq(price, lastGoodPrice, "fetched price != lastGoodPrice");
    }

    function testSTETHWhenUsingETHUSDxCanonicalSwitchesToLastGoodPriceWhenExchangeRateFails() public {
        // Make the STETH-USD oracle stale
        etchStaleMockToStethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Check using primary
        assertEq(
            uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary), "not using primary"
        );

        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check that the primary calc oracle did fail
        assertTrue(oracleFailedWhileBranchLive, "primary oracle calc didnt fail");

        // Check using ETHUSDxCanonical
        assertEq(
            uint8(wstethPriceFeed.priceSource()),
            uint8(IMainnetPriceFeed.PriceSource.ETHUSDxCanonical),
            "not using ethusdxcanonical"
        );

        uint256 lastGoodPrice = wstethPriceFeed.lastGoodPrice();

        // Make the exchange rate return 0
        vm.etch(address(wstETH), address(mockWstethToken).code);
        uint256 rate = wstETH.stEthPerToken();
        assertEq(rate, 0, "mock rate non-zero");

        // Now fetch the price
        (price, oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // This should be false, since the branch is already shutdown and not live
        assertFalse(oracleFailedWhileBranchLive);

        // Confirm the returned price is the last good price
        assertEq(price, lastGoodPrice, "fetched price != lastGoodPrice");
        // Check we've switched to lastGoodPrice source
        assertEq(
            uint8(wstethPriceFeed.priceSource()),
            uint8(IMainnetPriceFeed.PriceSource.lastGoodPrice),
            "not using lastGoodPrice"
        );
    }

    function testSTETHWhenUsingETHUSDxCanonicalRemainsShutDownWhenETHUSDOracleFails() public {
        // Make the STETH-USD oracle stale
        etchStaleMockToStethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Check using primary
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        // Check branch is live, not shut down
        assertEq(contractsArray[2].troveManager.shutdownTime(), 0);

        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check that the primary calc oracle did fail
        assertTrue(oracleFailedWhileBranchLive);

        // Check using ETHUSDxCanonical
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.ETHUSDxCanonical));

        // Check branch is now shut down
        assertEq(contractsArray[2].troveManager.shutdownTime(), block.timestamp);

        // Make the ETH-USD oracle stale too
        etchStaleMockToEthOracle(address(mockOracle).code);
        (,,, updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Now fetch the price again
        (price, oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check using lastGoodPrice
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.lastGoodPrice));

        // Check branch is still down
        assertEq(contractsArray[2].troveManager.shutdownTime(), block.timestamp);
    }

    function testSTETHWhenUsingETHUSDxCanonicalReturnsMinOfLastGoodPriceAndETHUSDxCanonical() public {
        // Make the STETH-USD oracle stale
        etchStaleMockToStethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Check using primary
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        // Fetch price
        (uint256 price, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check that the primary calc oracle did fail
        assertTrue(oracleFailedWhileBranchLive);

        // Check using ETHUSDxCanonical
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.ETHUSDxCanonical));

        // Make lastGoodPrice tiny, and below ETHUSDxCanonical
        vm.store(
            address(wstethPriceFeed),
            bytes32(uint256(1)), // 1st storage slot where lastGoodPrice is stored
            bytes32(uint256(1)) // make lastGoodPrice equal to 1 wei
        );
        assertEq(wstethPriceFeed.lastGoodPrice(), 1);

        //  Fetch the price again
        (price,) = wstethPriceFeed.fetchPrice();

        // Check price was lastGoodPrice
        assertEq(price, wstethPriceFeed.lastGoodPrice());

        // Now make lastGoodPrice massive, and greater than ETHUSDxCanonical
        vm.store(
            address(wstethPriceFeed),
            bytes32(uint256(1)), // 1st storage slot where lastGoodPrice is stored
            bytes32(uint256(1e27)) // make lastGoodPrice equal to 1e27 i.e. 1 billion (with 18 decimal digits)
        );
        assertEq(wstethPriceFeed.lastGoodPrice(), 1e27);

        //  Fetch the price again
        (price,) = wstethPriceFeed.fetchPrice();

        // Check price is expected ETH-USDxCanonical
        // Calc expected price if didnt fail,  i.e.
        uint256 ethUsdPrice = _getLatestAnswerFromOracle(ethOracle);
        uint256 exchangeRate = wstETH.stEthPerToken();
        assertGt(ethUsdPrice, 0);
        assertGt(exchangeRate, 0);
        uint256 priceIfDidntFail = ethUsdPrice * exchangeRate / 1e18;

        assertEq(price, priceIfDidntFail);
    }

    function testWSTETHPriceShutdownWhenBothOraclesFail() public {
        // Fetch price
        (, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check no oracle failed in this call, since it uses only STETH-USD oracle in the primary calc
        assertFalse(oracleFailedWhileBranchLive);

        // Check branch is live, not shut down
        assertEq(contractsArray[2].troveManager.shutdownTime(), 0);

        // Make the STETH-USD oracle stale
        etchStaleMockToStethOracle(address(mockOracle).code);
        (, int256 mockPrice,, uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Make the ETH-USD oracle stale too
        etchStaleMockToEthOracle(address(mockOracle).code);
        (, mockPrice,, updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (, oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check that this time the primary calc oracle did fail
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm branch is now shut down
        assertEq(contractsArray[2].troveManager.shutdownTime(), block.timestamp);
    }

    function testWSTETHPriceFeedReturnsLastGoodPriceWhenBothOraclesFail() public {
        // Fetch price
        wstethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = wstethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Make the STETH-USD oracle stale
        etchStaleMockToStethOracle(address(mockOracle).code);
        (, int256 mockPrice,, uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Make the ETH-USD oracle stale too
        etchStaleMockToEthOracle(address(mockOracle).code);
        (, mockPrice,, updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (uint256 price, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();

        // Check an oracle call failed this time
        assertTrue(oracleFailedWhileBranchLive);

        // Confirm the PriceFeed's returned price equals the lastGoodPrice
        assertEq(price, lastGoodPrice1);

        // Confirm the stored lastGoodPrice has not changed
        assertEq(wstethPriceFeed.lastGoodPrice(), lastGoodPrice1);
    }

    function testWSTETHPriceSourceIsLastGoodPriceWhenBothOraclesFail() public {
        // Fetch price
        wstethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = wstethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Check using primary
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        // Make the STETH-USD oracle stale
        etchStaleMockToStethOracle(address(mockOracle).code);
        (, int256 mockPrice,, uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Make the ETH-USD oracle stale too
        etchStaleMockToEthOracle(address(mockOracle).code);
        (, mockPrice,, updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        wstethPriceFeed.fetchPrice();

        // Check using lastGoodPrice
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.lastGoodPrice));
    }

    // --- redemptions ---

    function testNormalWETHRedemptionDoesNotHitShutdownBranch() public {
        // Fetch price
        wethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = wethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Check using primary
        assertEq(uint8(wethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        uint256 coll = 100 ether;
        uint256 debtRequest = 3000e18;

        vm.startPrank(A);
        contractsArray[0].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        // Make the ETH-USD oracle stale
        etchStaleMockToEthOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = ethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (, bool oracleFailedWhileBranchLive) = wethPriceFeed.fetchPrice();
        assertTrue(oracleFailedWhileBranchLive);
        // Confirm branch shutdown
        assertEq(contractsArray[0].troveManager.shutdownTime(), block.timestamp);

        uint256 totalBoldRedeemAmount = 100e18;
        uint256 branch0DebtBefore = contractsArray[0].activePool.getBoldDebt();
        assertGt(branch0DebtBefore, 0);

        uint256 boldBalBefore_A = boldToken.balanceOf(A);

        // Redeem
        redeem(A, totalBoldRedeemAmount);

        // Confirm A lost no BOLD
        assertEq(boldToken.balanceOf(A), boldBalBefore_A);

        // Confirm WETH branch did not get redeemed from
        assertEq(contractsArray[0].activePool.getBoldDebt(), branch0DebtBefore);
    }

    function testNormalRETHRedemptionDoesNotHitShutdownBranch() public {
        // Fetch price
        rethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = rethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Check using primary
        assertEq(uint8(rethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        uint256 coll = 100 ether;
        uint256 debtRequest = 3000e18;

        vm.startPrank(A);
        contractsArray[1].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        // Make the RETH-ETH oracle stale
        etchStaleMockToRethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = rethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (, bool oracleFailedWhileBranchLive) = rethPriceFeed.fetchPrice();
        assertTrue(oracleFailedWhileBranchLive);
        // Confirm RETH branch shutdown
        assertEq(contractsArray[1].troveManager.shutdownTime(), block.timestamp);

        uint256 totalBoldRedeemAmount = 100e18;
        uint256 branch1DebtBefore = contractsArray[1].activePool.getBoldDebt();
        assertGt(branch1DebtBefore, 0);

        uint256 boldBalBefore_A = boldToken.balanceOf(A);

        // Redeem
        redeem(A, totalBoldRedeemAmount);

        // Confirm A lost no BOLD
        assertEq(boldToken.balanceOf(A), boldBalBefore_A);

        // Confirm RETH branch did not get redeemed from
        assertEq(contractsArray[1].activePool.getBoldDebt(), branch1DebtBefore);
    }

    function testNormalWSTETHRedemptionDoesNotHitShutdownBranch() public {
        // Fetch price
        wstethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = wstethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Check using primary
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        uint256 coll = 100 ether;
        uint256 debtRequest = 3000e18;

        vm.startPrank(A);
        contractsArray[2].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        // Make the STETH-USD oracle stale
        etchStaleMockToStethOracle(address(mockOracle).code);
        (,,, uint256 updatedAt,) = stethOracle.latestRoundData();
        assertEq(updatedAt, block.timestamp - 7 days);

        // Fetch price again
        (, bool oracleFailedWhileBranchLive) = wstethPriceFeed.fetchPrice();
        assertTrue(oracleFailedWhileBranchLive);
        // Confirm RETH branch shutdown
        assertEq(contractsArray[2].troveManager.shutdownTime(), block.timestamp);

        uint256 totalBoldRedeemAmount = 100e18;
        uint256 branch2DebtBefore = contractsArray[2].activePool.getBoldDebt();
        assertGt(branch2DebtBefore, 0);

        uint256 boldBalBefore_A = boldToken.balanceOf(A);

        // Redeem
        redeem(A, totalBoldRedeemAmount);

        // Confirm A lost no BOLD
        assertEq(boldToken.balanceOf(A), boldBalBefore_A);

        // Confirm RETH branch did not get redeemed from
        assertEq(contractsArray[2].activePool.getBoldDebt(), branch2DebtBefore);
    }

    function testRedemptionOfWETHUsesETHUSDMarketforPrimaryPrice() public {
        // Fetch price
        wethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = wethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Check using primary
        assertEq(uint8(wethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        uint256 coll = 100 ether;
        uint256 debtRequest = 3000e18;

        vm.startPrank(A);
        contractsArray[0].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        // Expected price used for primary calc: ETH-USD market price
        uint256 expectedPrice = _getLatestAnswerFromOracle(ethOracle);
        assertGt(expectedPrice, 0);

        // Calc expected fee based on price
        uint256 totalBoldRedeemAmount = 100e18;
        uint256 totalCorrespondingColl = totalBoldRedeemAmount * DECIMAL_PRECISION / expectedPrice;
        assertGt(totalCorrespondingColl, 0);

        uint256 redemptionFeePct = collateralRegistry.getEffectiveRedemptionFeeInBold(totalBoldRedeemAmount)
            * DECIMAL_PRECISION / totalBoldRedeemAmount;
        assertGt(redemptionFeePct, 0);

        uint256 totalCollFee = totalCorrespondingColl * redemptionFeePct / DECIMAL_PRECISION;

        uint256 expectedCollDelta = totalCorrespondingColl - totalCollFee;
        assertGt(expectedCollDelta, 0);

        uint256 branch0DebtBefore = contractsArray[0].activePool.getBoldDebt();
        assertGt(branch0DebtBefore, 0);
        uint256 A_collBefore = contractsArray[0].collToken.balanceOf(A);
        assertGt(A_collBefore, 0);
        // Redeem
        redeem(A, totalBoldRedeemAmount);

        // Confirm WETH branch got redeemed from
        assertEq(contractsArray[0].activePool.getBoldDebt(), branch0DebtBefore - totalBoldRedeemAmount);

        // Confirm the received amount coll is the expected amount (i.e. used the expected price)
        assertEq(contractsArray[0].collToken.balanceOf(A), A_collBefore + expectedCollDelta);
    }

    function testRedemptionOfWSTETHUsesMaxETHUSDMarketandWSTETHUSDMarketForPrimaryPriceWhenWithin1pct() public {
        // Fetch price
        wstethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = wstethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Check using primary
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        uint256 coll = 100 ether;
        uint256 debtRequest = 3000e18;

        vm.startPrank(A);
        contractsArray[2].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        // Expected price used for primary calc: ETH-USD market price
        uint256 ethUsdPrice = _getLatestAnswerFromOracle(ethOracle);
        uint256 stethUsdPrice = _getLatestAnswerFromOracle(stethOracle);
        assertNotEq(ethUsdPrice, stethUsdPrice, "raw prices equal");
        // Check STETH-USD is within 1ct of ETH-USD
        uint256 max = (1e18 + 1e16) * ethUsdPrice / 1e18;
        uint256 min = (1e18 - 1e16) * ethUsdPrice / 1e18;
        assertGe(stethUsdPrice, min);
        assertLe(stethUsdPrice, max);

        // USD_per_WSTETH = USD_per_STETH(or_per_ETH) * STETH_per_WSTETH
        uint256 expectedPrice = LiquityMath._max(ethUsdPrice, stethUsdPrice) * wstETH.stEthPerToken() / 1e18;
        assertGt(expectedPrice, 0, "expected price not 0");

        // Calc expected fee based on price
        uint256 totalBoldRedeemAmount = 100e18;
        uint256 totalCorrespondingColl = totalBoldRedeemAmount * DECIMAL_PRECISION / expectedPrice;
        assertGt(totalCorrespondingColl, 0, "coll not 0");

        uint256 redemptionFeePct = collateralRegistry.getEffectiveRedemptionFeeInBold(totalBoldRedeemAmount)
            * DECIMAL_PRECISION / totalBoldRedeemAmount;
        assertGt(redemptionFeePct, 0, "fee not 0");

        uint256 totalCollFee = totalCorrespondingColl * redemptionFeePct / DECIMAL_PRECISION;

        uint256 expectedCollDelta = totalCorrespondingColl - totalCollFee;
        assertGt(expectedCollDelta, 0, "delta not 0");

        uint256 branch2DebtBefore = contractsArray[2].activePool.getBoldDebt();
        assertGt(branch2DebtBefore, 0);
        uint256 A_collBefore = contractsArray[2].collToken.balanceOf(A);
        assertGt(A_collBefore, 0);

        // Redeem
        redeem(A, totalBoldRedeemAmount);

        // Confirm WSTETH branch got redeemed from
        assertEq(contractsArray[2].activePool.getBoldDebt(), branch2DebtBefore - totalBoldRedeemAmount);

        // Confirm the received amount coll is the expected amount (i.e. used the expected price)
        assertEq(contractsArray[2].collToken.balanceOf(A), A_collBefore + expectedCollDelta);
    }

    function testRedemptionOfWSTETHUsesMinETHUSDMarketandWSTETHUSDMarketForPrimaryPriceWhenNotWithin1pct() public {
        // Fetch price
        console.log("test::first wsteth pricefeed call");
        wstethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = wstethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Check using primary
        assertEq(uint8(wstethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        uint256 coll = 100 ether;
        uint256 debtRequest = 3000e18;

        vm.startPrank(A);
        contractsArray[2].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        // Get the raw ETH-USD price (at 8 decimals) for comparison
        (, int256 rawEthUsdPrice,,,) = ethOracle.latestRoundData();
        assertGt(rawEthUsdPrice, 0, "eth-usd price not 0");

        // Replace the STETH-USD Oracle's code with the mock oracle's code
        etchStaleMockToStethOracle(address(mockOracle).code);
        ChainlinkOracleMock mock = ChainlinkOracleMock(address(stethOracle));
        // Reduce STETH-USD price to 90% of ETH-USD price. Use 8 decimal precision on the oracle.
        mock.setPrice(int256(rawEthUsdPrice * 90e6 / 1e8));
        // Make it fresh
        mock.setUpdatedAt(block.timestamp);
        // STETH-USD price has 8 decimals
        mock.setDecimals(8);

        assertEq(contractsArray[2].troveManager.shutdownTime(), 0, "is shutdown");

        uint256 ethUsdPrice = _getLatestAnswerFromOracle(ethOracle);
        uint256 stethUsdPrice = _getLatestAnswerFromOracle(stethOracle);
        console.log(stethUsdPrice, "test stehUsdPrice after replacement");
        console.log(ethUsdPrice, "test ethUsdPrice after replacement");
        console.log(ethUsdPrice * 90e16 / 1e18, "test ethUsdPrice * 90e16 / 1e18");

        // Confirm that STETH-USD is lower than ETH-USD
        assertLt(stethUsdPrice, ethUsdPrice, "steth-usd not < eth-usd");

        // USD_per_STETH = USD_per_STETH * STETH_per_WSTETH
        // Use STETH-USD as expected price since it is out of range of ETH-USD
        uint256 expectedPrice = stethUsdPrice * wstETH.stEthPerToken() / 1e18;
        assertGt(expectedPrice, 0, "expected price not 0");

        // Calc expected fee based on price
        uint256 totalBoldRedeemAmount = 100e18;
        uint256 totalCorrespondingColl = totalBoldRedeemAmount * DECIMAL_PRECISION / expectedPrice;
        assertGt(totalCorrespondingColl, 0, "coll not 0");

        uint256 redemptionFeePct = collateralRegistry.getEffectiveRedemptionFeeInBold(totalBoldRedeemAmount)
            * DECIMAL_PRECISION / totalBoldRedeemAmount;
        assertGt(redemptionFeePct, 0, "fee not 0");

        uint256 totalCollFee = totalCorrespondingColl * redemptionFeePct / DECIMAL_PRECISION;

        uint256 expectedCollDelta = totalCorrespondingColl - totalCollFee;
        assertGt(expectedCollDelta, 0, "delta not 0");

        uint256 branch2DebtBefore = contractsArray[2].activePool.getBoldDebt();
        assertGt(branch2DebtBefore, 0);
        uint256 A_collBefore = contractsArray[2].collToken.balanceOf(A);
        assertGt(A_collBefore, 0);

        // Redeem
        redeem(A, totalBoldRedeemAmount);

        assertEq(contractsArray[2].troveManager.shutdownTime(), 0, "is shutdown");

        // Confirm WSTETH branch got redeemed from
        assertEq(
            contractsArray[2].activePool.getBoldDebt(),
            branch2DebtBefore - totalBoldRedeemAmount,
            "remaining branch debt wrong"
        );

        // Confirm the received amount coll is the expected amount (i.e. used the expected price)
        assertEq(
            contractsArray[2].collToken.balanceOf(A), A_collBefore + expectedCollDelta, "remaining branch coll wrong"
        );
    }

    function testRedemptionOfRETHUsesMaxCanonicalAndMarketforPrimaryPriceWhenWithin2pct() public {
        // Fetch price
        rethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = rethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Check using primary
        assertEq(uint8(rethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        uint256 coll = 100 ether;
        uint256 debtRequest = 3000e18;

        vm.startPrank(A);
        contractsArray[1].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );

        // Expected price used for primary calc: ETH-USD market price
        uint256 canonicalRethRate = rethToken.getExchangeRate();
        uint256 marketRethPrice = _getLatestAnswerFromOracle(rethOracle);
        uint256 ethUsdPrice = _getLatestAnswerFromOracle(ethOracle);
        assertNotEq(canonicalRethRate, marketRethPrice, "raw price and rate equal");

        // Check market is within 2pct of max;
        uint256 max = (1e18 + 2e16) * canonicalRethRate / 1e18;
        uint256 min = (1e18 - 2e16) * canonicalRethRate / 1e18;
        assertGe(marketRethPrice, min);
        assertLe(marketRethPrice, max);

        // USD_per_WSTETH = USD_per_STETH(or_per_ETH) * STETH_per_WSTETH
        uint256 expectedPrice = LiquityMath._max(canonicalRethRate, marketRethPrice) * ethUsdPrice / 1e18;
        assertGt(expectedPrice, 0, "expected price not 0");

        // Calc expected fee based on price
        uint256 totalBoldRedeemAmount = 100e18;
        uint256 totalCorrespondingColl = totalBoldRedeemAmount * DECIMAL_PRECISION / expectedPrice;
        assertGt(totalCorrespondingColl, 0, "coll not 0");

        uint256 redemptionFeePct = collateralRegistry.getEffectiveRedemptionFeeInBold(totalBoldRedeemAmount)
            * DECIMAL_PRECISION / totalBoldRedeemAmount;
        assertGt(redemptionFeePct, 0, "fee not 0");

        uint256 totalCollFee = totalCorrespondingColl * redemptionFeePct / DECIMAL_PRECISION;

        uint256 expectedCollDelta = totalCorrespondingColl - totalCollFee;
        assertGt(expectedCollDelta, 0, "delta not 0");

        uint256 branch1DebtBefore = contractsArray[1].activePool.getBoldDebt();
        assertGt(branch1DebtBefore, 0);
        uint256 A_collBefore = contractsArray[1].collToken.balanceOf(A);
        assertGt(A_collBefore, 0);

        // Redeem
        redeem(A, totalBoldRedeemAmount);

        // Confirm RETH branch got redeemed from
        assertEq(contractsArray[1].activePool.getBoldDebt(), branch1DebtBefore - totalBoldRedeemAmount);

        // Confirm the received amount coll is the expected amount (i.e. used the expected price)
        assertEq(contractsArray[1].collToken.balanceOf(A), A_collBefore + expectedCollDelta);
    }

    function testRedemptionOfRETHUsesMinCanonicalAndMarketforPrimaryPriceWhenDeviationGreaterThan2pct() public {
        // Fetch price
        rethPriceFeed.fetchPrice();
        uint256 lastGoodPrice1 = rethPriceFeed.lastGoodPrice();
        assertGt(lastGoodPrice1, 0, "lastGoodPrice 0");

        // Check using primary
        assertEq(uint8(rethPriceFeed.priceSource()), uint8(IMainnetPriceFeed.PriceSource.primary));

        uint256 coll = 100 ether;
        uint256 debtRequest = 3000e18;

        vm.startPrank(A);
        contractsArray[1].borrowerOperations.openTrove(
            A, 0, coll, debtRequest, 0, 0, 5e16, debtRequest, address(0), address(0), address(0)
        );
        vm.stopPrank();

        // Replace the RETH Oracle's code with the mock oracle's code
        etchStaleMockToRethOracle(address(mockOracle).code);
        ChainlinkOracleMock mock = ChainlinkOracleMock(address(rethOracle));
        // Set ETH_per_RETH market price to 0.95
        mock.setPrice(95e16);
        // Make it fresh
        mock.setUpdatedAt(block.timestamp);
        // RETH-ETH price has 18 decimals
        mock.setDecimals(18);

        (, int256 price,,,) = rethOracle.latestRoundData();
        // Confirm that RETH oracle now returns the artificial low price
        assertEq(price, 95e16, "reth-eth price not 0.95");

        // // Expected price used for primary calc: ETH-USD market price
        uint256 canonicalRethRate = rethToken.getExchangeRate();
        uint256 marketRethPrice = _getLatestAnswerFromOracle(rethOracle);
        uint256 ethUsdPrice = _getLatestAnswerFromOracle(ethOracle);
        assertNotEq(canonicalRethRate, marketRethPrice, "raw price and rate equal");

        // Check market is not within 2pct of canonical
        uint256 min = (1e18 - 2e16) * canonicalRethRate / 1e18;
        assertLe(marketRethPrice, min, "market reth-eth price not < min");

        // USD_per_WSTETH = USD_per_STETH(or_per_ETH) * STETH_per_WSTETH
        uint256 expectedPrice = LiquityMath._min(canonicalRethRate, marketRethPrice) * ethUsdPrice / 1e18;
        assertGt(expectedPrice, 0, "expected price not 0");

        // Calc expected fee based on price, i.e. the minimum
        uint256 totalBoldRedeemAmount = 100e18;
        uint256 totalCorrespondingColl = totalBoldRedeemAmount * DECIMAL_PRECISION / expectedPrice;
        assertGt(totalCorrespondingColl, 0, "coll not 0");

        uint256 redemptionFeePct = collateralRegistry.getEffectiveRedemptionFeeInBold(totalBoldRedeemAmount)
            * DECIMAL_PRECISION / totalBoldRedeemAmount;
        assertGt(redemptionFeePct, 0, "fee not 0");

        uint256 totalCollFee = totalCorrespondingColl * redemptionFeePct / DECIMAL_PRECISION;

        uint256 expectedCollDelta = totalCorrespondingColl - totalCollFee;
        assertGt(expectedCollDelta, 0, "delta not 0");

        uint256 branch1DebtBefore = contractsArray[1].activePool.getBoldDebt();
        assertGt(branch1DebtBefore, 0);
        uint256 A_collBefore = contractsArray[1].collToken.balanceOf(A);
        assertGt(A_collBefore, 0);

        // Redeem
        redeem(A, totalBoldRedeemAmount);

        // Confirm RETH branch got redeemed from
        assertEq(
            contractsArray[1].activePool.getBoldDebt(),
            branch1DebtBefore - totalBoldRedeemAmount,
            "active debt != branch - redeemed"
        );

        // Confirm the received amount coll is the expected amount (i.e. used the expected price)
        assertEq(contractsArray[1].collToken.balanceOf(A), A_collBefore + expectedCollDelta, "A's coll didn't change");
    }

    // --- Low gas market oracle reverts ---

    function testRevertLowGasSTETHOracle() public {
        // Confirm call to the real external contracts succeeds with sufficient gas i.e. 500k
        (bool success,) = address(wstethPriceFeed).call{gas: 500000}(abi.encodeWithSignature("fetchPrice()"));
        assertTrue(success);

        // Etch gas guzzler to the oracle
        etchGasGuzzlerToStethOracle(address(gasGuzzlerOracle).code);

        // After etching the gas guzzler to the oracle, confirm the same call with 500k gas now reverts due to OOG
        vm.expectRevert(MainnetPriceFeedBase.InsufficientGasForExternalCall.selector);
        (bool revertAsExpected,) = address(wstethPriceFeed).call{gas: 500000}(abi.encodeWithSignature("fetchPrice()"));
        assertTrue(revertAsExpected);
    }

    function testRevertLowGasRETHOracle() public {
        // Confirm call to the real external contracts succeeds with sufficient gas i.e. 500k
        (bool success,) = address(rethPriceFeed).call{gas: 500000}(abi.encodeWithSignature("fetchPrice()"));
        assertTrue(success);

        // Etch gas guzzler to the oracle
        etchGasGuzzlerToRethOracle(address(gasGuzzlerOracle).code);

        // After etching the gas guzzler to the oracle, confirm the same call with 500k gas now reverts due to OOG
        vm.expectRevert(MainnetPriceFeedBase.InsufficientGasForExternalCall.selector);
        (bool revertAsExpected,) = address(rethPriceFeed).call{gas: 500000}(abi.encodeWithSignature("fetchPrice()"));
        assertTrue(revertAsExpected);
    }

     function testRevertLowGasETHOracle() public {
        // Confirm call to the real external contracts succeeds with sufficient gas i.e. 500k
        (bool success,) = address(wethPriceFeed).call{gas: 500000}(abi.encodeWithSignature("fetchPrice()"));
        assertTrue(success);

        // Etch gas guzzler to the oracle
        etchGasGuzzlerToEthOracle(address(gasGuzzlerOracle).code);

        // After etching the gas guzzler to the oracle, confirm the same call with 500k gas now reverts due to OOG
        vm.expectRevert(MainnetPriceFeedBase.InsufficientGasForExternalCall.selector);
        (bool revertAsExpected,) = address(wethPriceFeed).call{gas: 500000}(abi.encodeWithSignature("fetchPrice()"));
        assertTrue(revertAsExpected);
    }

    // --- Test with a gas guzzler token, and confirm revert ---

    function testRevertLowGasWSTETHToken() public {
        // Confirm call to the real external contracts succeeds with sufficient gas i.e. 500k
        (bool success,) = address(wstethPriceFeed).call{gas: 500000}(abi.encodeWithSignature("fetchPrice()"));
        assertTrue(success);

        // Etch gas guzzler to the LST
        etchGasGuzzlerMockToWstethToken(address(gasGuzzlerToken).code);

        // After etching the gas guzzler to the LST, confirm the same call with 500k gas now reverts due to OOG
        vm.expectRevert(MainnetPriceFeedBase.InsufficientGasForExternalCall.selector);
        (bool revertsAsExpected,) = address(wstethPriceFeed).call{gas: 500000}(abi.encodeWithSignature("fetchPrice()"));
        assertTrue(revertsAsExpected);
    }

    function testRevertLowGasRETHToken() public {
        // Confirm call to the real external contracts succeeds with sufficient gas i.e. 500k
        (bool success,) = address(rethPriceFeed).call{gas: 500000}(abi.encodeWithSignature("fetchPrice()"));
        assertTrue(success);

        // Etch gas guzzler to the LST
        etchGasGuzzlerMockToRethToken(address(gasGuzzlerToken).code);

        // After etching the gas guzzler to the LST, confirm the same call with 500k gas now reverts due to OOG
        vm.expectRevert(MainnetPriceFeedBase.InsufficientGasForExternalCall.selector);
        (bool revertsAsExpected,) = address(rethPriceFeed).call{gas: 500000}(abi.encodeWithSignature("fetchPrice()"));
        assertTrue(revertsAsExpected);
    }

    // - More basic actions tests (adjust, close, etc)
    // - liq tests (manipulate aggregator stored price)
}
