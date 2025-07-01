// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import {AggregatorV3Interface} from "../../src/Dependencies/AggregatorV3Interface.sol";

import "./Base.sol";

contract OraclesTest is Base {

    address public constant OWNER = 0xce352181C0f0350F1687e1a44c45BC9D96ee738B;

    uint256 public constant DIFF = 1e15; // 0.1%
    uint256 public constant MIN_BTC_PRICE = 100_000 ether;

    function setUp() override public {
        super.setUp();
    }

    function testBoldOracle() public {
        DeploymentResult memory _deployment = deploy();
        LiquityContracts memory _contracts = _deployment.contractsArray[0];

        // Primary
        (uint256 _pricePrimary, bool _isOracleDownPrimary) = _contracts.priceFeed.fetchPrice();
        assertGt(_pricePrimary, 1 ether, "testBoldOracle: E0");
        assertFalse(_isOracleDownPrimary, "testBoldOracle: E1");
        console2.log(_pricePrimary, "st-yBOLD price primary");

        // Shutdown
        vm.warp(block.timestamp + 100 days);
        (,bool _isOracleDownShutdown) = _contracts.priceFeed.fetchPrice();
        assertFalse(_isOracleDownShutdown, "testBoldOracle: E3"); // NEVER SHUTDOWN
    }

    function testScrvUsdOracle() public {
        DeploymentResult memory _deployment = deploy();
        LiquityContracts memory _contracts = _deployment.contractsArray[1];

        // Primary
        (uint256 _pricePrimary, bool _isOracleDownPrimary) = _contracts.priceFeed.fetchPrice();
        assertGt(_pricePrimary, 1 ether, "testScrvUsdOracle: E0");
        assertFalse(_isOracleDownPrimary, "testScrvUsdOracle: E1");
        console2.log(_pricePrimary, "scrvUSD price primary");

        // Fallback
        vm.warp(block.timestamp + 2 days + 1 hours);
        (uint256 _priceFallback, bool _isOracleDownFallback) = _contracts.priceFeed.fetchPrice();
        assertGt(_priceFallback, 1 ether, "testScrvUsdOracle: E2");
        assertFalse(_isOracleDownFallback, "testScrvUsdOracle: E3");
        assertApproxEqRel(_priceFallback, _pricePrimary, DIFF, "testScrvUsdOracle: E4");
        console2.log(_priceFallback, "scrvUSD price fallback");

        // Shutdown fallback
        vm.prank(OWNER);
        scrvUsdFallbackOracle.disableFallback();
        (uint256 _priceShutdown, bool _isOracleDownShutdown) = _contracts.priceFeed.fetchPrice();
        assertEq(_priceShutdown, _priceFallback, "testScrvUsdOracle: E5");
        assertTrue(_isOracleDownShutdown, "testScrvUsdOracle: E6");
    }

    function test_shutdownAtHeartbeat_scrvUsdOracle() public {
        DeploymentResult memory _deployment = deploy();
        LiquityContracts memory _contracts = _deployment.contractsArray[1];

        uint256 _heartbeat = 2 days;
        AggregatorV3Interface _aggregator = AggregatorV3Interface(0xEEf0C605546958c1f899b6fB336C20671f9cD49F); // CL crvUSD/USD
        (,,,uint256 _updatedAt,) = _aggregator.latestRoundData();
        vm.warp(_updatedAt + _heartbeat);
        (,bool _isOracleDownFallback) = _contracts.priceFeed.fetchPrice();
        assertFalse(_isOracleDownFallback, "test_shutdownAtHeartbeat_scrvUsdOracle");
    }

    function testSusdsOracle() public {
        DeploymentResult memory _deployment = deploy();
        LiquityContracts memory _contracts = _deployment.contractsArray[2];

        // Primary
        (uint256 _pricePrimary, bool _isOracleDownPrimary) = _contracts.priceFeed.fetchPrice();
        assertGt(_pricePrimary, 1 ether, "testSusdsOracle: E0");
        assertFalse(_isOracleDownPrimary, "testSusdsOracle: E1");
        console2.log(_pricePrimary, "sUSDS price primary");

        // Shutdown
        vm.warp(block.timestamp + 25 hours);
        (uint256 _priceShutdown, bool _isOracleDownShutdown) = _contracts.priceFeed.fetchPrice();
        assertEq(_priceShutdown, _pricePrimary, "testSusdsOracle: E2");
        assertTrue(_isOracleDownShutdown, "testSusdsOracle: E3");
    }

    function testSfrxusdOracle() public {
        DeploymentResult memory _deployment = deploy();
        LiquityContracts memory _contracts = _deployment.contractsArray[3];

        // Primary
        (uint256 _pricePrimary, bool _isOracleDownPrimary) = _contracts.priceFeed.fetchPrice();
        assertGt(_pricePrimary, 1 ether, "testSfrxusdOracle: E0");
        assertFalse(_isOracleDownPrimary, "testSfrxusdOracle: E1");
        console2.log(_pricePrimary, "sfrxusd price primary");

        // Shutdown
        vm.warp(block.timestamp + 2 days + 1 hours);
        (uint256 _priceShutdown, bool _isOracleDownShutdown) = _contracts.priceFeed.fetchPrice();
        assertEq(_priceShutdown, _pricePrimary, "testSfrxusdOracle: E2");
        assertTrue(_isOracleDownShutdown, "testSfrxusdOracle: E3");
    }

    function testTbtcOracle() public {
        DeploymentResult memory _deployment = deploy();
        LiquityContracts memory _contracts = _deployment.contractsArray[4];

        // Primary
        (uint256 _pricePrimary, bool _isOracleDownPrimary) = _contracts.priceFeed.fetchPrice();
        assertGt(_pricePrimary, MIN_BTC_PRICE, "testTbtcOracle: E0");
        assertFalse(_isOracleDownPrimary, "testTbtcOracle: E1");
        console2.log(_pricePrimary, "tBTC price primary");

        // Fallback
        vm.warp(block.timestamp + 2 days + 1 hours);
        (uint256 _priceFallback, bool _isOracleDownFallback) = _contracts.priceFeed.fetchPrice();
        assertGt(_priceFallback, MIN_BTC_PRICE, "testTbtcOracle: E2");
        assertFalse(_isOracleDownFallback, "testTbtcOracle: E3");
        assertApproxEqRel(_priceFallback, _pricePrimary, 8 * DIFF, "testTbtcOracle: E4"); // 0.8%
        console2.log(_priceFallback, "tBTC price fallback");

        // Shutdown fallback
        vm.prank(OWNER);
        tbtcFallbackOracle.disableFallback();
        (uint256 _priceShutdown, bool _isOracleDownShutdown) = _contracts.priceFeed.fetchPrice();
        assertEq(_priceShutdown, _priceFallback, "testTbtcOracle: E5");
        assertTrue(_isOracleDownShutdown, "testTbtcOracle: E6");
    }

    function test_shutdownAtHeartbeat_tbtcOracle() public {
        DeploymentResult memory _deployment = deploy();
        LiquityContracts memory _contracts = _deployment.contractsArray[4];

        uint256 _heartbeat = 1 days;
        AggregatorV3Interface _aggregator = AggregatorV3Interface(0x8350b7De6a6a2C1368E7D4Bd968190e13E354297); // CL tBTC/USD
        (,,,uint256 _updatedAt,) = _aggregator.latestRoundData();
        vm.warp(_updatedAt + _heartbeat);
        (,bool _isOracleDownFallback) = _contracts.priceFeed.fetchPrice();
        assertFalse(_isOracleDownFallback, "test_shutdownAtHeartbeat_tbtcOracle");
    }

    function testWbtcOracle() public {
        DeploymentResult memory _deployment = deploy();
        LiquityContracts memory _contracts = _deployment.contractsArray[5];

        // Primary
        (uint256 _pricePrimary, bool _isOracleDownPrimary) = _contracts.priceFeed.fetchPrice();
        assertGt(_pricePrimary, MIN_BTC_PRICE, "testWbtcOracle: E0");
        assertFalse(_isOracleDownPrimary, "testWbtcOracle: E1");
        console2.log(_pricePrimary, "wBTC price primary");

        // Fallback
        vm.warp(block.timestamp + 25 hours);
        (uint256 _priceFallback, bool _isOracleDownFallback) = _contracts.priceFeed.fetchPrice();
        assertGt(_priceFallback, MIN_BTC_PRICE, "testWbtcOracle: E2");
        assertFalse(_isOracleDownFallback, "testWbtcOracle: E3");
        assertApproxEqRel(_priceFallback, _pricePrimary, 4 * DIFF, "testWbtcOracle: E4"); // 0.4%
        console2.log(_priceFallback, "wBTC price fallback");

        // Shutdown fallback
        vm.prank(OWNER);
        wbtcFallbackOracle.disableFallback();
        (uint256 _priceShutdown, bool _isOracleDownShutdown) = _contracts.priceFeed.fetchPrice();
        assertEq(_priceShutdown, _priceFallback, "testWbtcOracle: E5");
        assertTrue(_isOracleDownShutdown, "testWbtcOracle: E6");
    }
}