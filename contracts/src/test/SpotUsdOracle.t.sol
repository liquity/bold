// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import {SpotUsdOracle} from "../PriceFeeds/SpotUsdOracle.sol";

import "forge-std/Test.sol";
import "lib/forge-std/src/console2.sol";

contract SpotUsdOracleTest is Test {

    address public usdc = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // token0
    address public spot = 0xC1f33e0cf7e40a67375007104B929E49a581bafE; // token1
    address public usdcUsdOracle = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;
    address public univ3Factory = 0x1F98431c8aD98523631AE4a59f267346ea31F984;

    SpotUsdOracle public oracle;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("mainnet"));

        oracle = new SpotUsdOracle(
            usdcUsdOracle, // usdcUsdOracle
            univ3Factory, // factory
            usdc, // token0
            spot, // token1
            10000 // fee
        );
    }

    function testSpotOracleSanity() public view {
        (, int256 answer,, uint256 updatedAt,) = oracle.latestRoundData();
        assertTrue(answer > 0);
        assertEq(updatedAt, block.timestamp);
    }
}