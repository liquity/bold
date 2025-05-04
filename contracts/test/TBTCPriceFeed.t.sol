// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "forge-std/console2.sol";

import "../src/PriceFeeds/tBTCPriceFeed.sol";
import "./TestContracts/ChainlinkOracleMock.sol";

contract TBTCPriceFeedTest is Test {
    tBTCPriceFeed priceFeed;
    ChainlinkOracleMock tBTCOracle;
    ChainlinkOracleMock btcOracle;
    
    address owner = address(1);
    uint256 constant STALENESS_THRESHOLD = 3600; // 1 hour
    
    function setUp() public {
        // Deploy mock oracles
        tBTCOracle = new ChainlinkOracleMock();
        btcOracle = new ChainlinkOracleMock();
        
        // Configure the oracles
        tBTCOracle.setDecimals(8);
        btcOracle.setDecimals(8);
        
        // Set initial prices
        tBTCOracle.setPrice(30000e8); // $30,000 per tBTC
        btcOracle.setPrice(30000e8);  // $30,000 per BTC
        
        // Set update times
        tBTCOracle.setUpdatedAt(block.timestamp);
        btcOracle.setUpdatedAt(block.timestamp);
        
        // Deploy price feed
        priceFeed = new tBTCPriceFeed(
            owner,
            address(tBTCOracle),
            address(btcOracle),
            STALENESS_THRESHOLD,
            STALENESS_THRESHOLD
        );
    }
    
    function testFetchPrice() public {
        (uint256 price, bool failed) = priceFeed.fetchPrice();
        assertEq(price, 30000e18); // Price should be scaled to 18 decimals
        assertEq(failed, false);
    }
    
    function testFetchRedemptionPrice_NoDepeg() public {
        // When tBTC and BTC prices are the same, redemption price should be the same
        (uint256 price, bool failed) = priceFeed.fetchRedemptionPrice();
        assertEq(price, 30000e18);
        assertEq(failed, false);
    }
    
    function testFetchRedemptionPrice_BTCHigher() public {
        // BTC price higher but within 2%
        btcOracle.setPrice(30500e8);  // $30,500 per BTC (1.67% higher)
        
        (uint256 price, bool failed) = priceFeed.fetchRedemptionPrice();
        assertEq(price, 30500e18); // Should use the higher price
        assertEq(failed, false);
    }
    
    function testFetchRedemptionPrice_tBTCHigher() public {
        // tBTC price higher but within 2%
        tBTCOracle.setPrice(30500e8);  // $30,500 per tBTC (1.67% higher)
        
        (uint256 price, bool failed) = priceFeed.fetchRedemptionPrice();
        assertEq(price, 30500e18); // Should use the higher price
        assertEq(failed, false);
    }
    
    function testFetchRedemptionPrice_SignificantDepeg() public {
        // tBTC significantly lower (more than 2%)
        tBTCOracle.setPrice(29000e8);  // $29,000 per tBTC (3.33% lower)
        
        (uint256 price, bool failed) = priceFeed.fetchRedemptionPrice();
        assertEq(price, 29000e18); // Should use tBTC price due to significant depeg
        assertEq(failed, false);
    }
    
    function testFetchRedemptionPrice_tBTCOracleStale() public {
        // Make tBTC oracle stale
        tBTCOracle.setUpdatedAt(block.timestamp - STALENESS_THRESHOLD - 1);
        
        (uint256 price, bool failed) = priceFeed.fetchRedemptionPrice();
        assertEq(failed, true); // Should report failure
    }
    
    function testFetchRedemptionPrice_BTCOracleStale() public {
        // Make BTC oracle stale
        btcOracle.setUpdatedAt(block.timestamp - STALENESS_THRESHOLD - 1);
        
        (uint256 price, bool failed) = priceFeed.fetchRedemptionPrice();
        assertEq(failed, true); // Should report failure
    }
    
    function testSwitchToLastGoodPrice() public {
        // Set initial prices
        (uint256 initialPrice,) = priceFeed.fetchPrice();
        
        // Make tBTC oracle stale
        tBTCOracle.setUpdatedAt(block.timestamp - STALENESS_THRESHOLD - 1);
        
        // This should switch to last good price
        (uint256 price, bool failed) = priceFeed.fetchPrice();
        assertEq(failed, true);
        
        // Now price feed should be using last good price
        assertEq(uint256(priceFeed.priceSource()), 2); // PriceSource.lastGoodPrice = 2
        
        // Fetch price again, should not fail and return last good price
        (price, failed) = priceFeed.fetchPrice();
        assertEq(price, initialPrice);
        assertEq(failed, false);
    }
    
    function testWithinDeviationThreshold() public {
        // Test cases for different deviation scenarios
        
        // 1. Exact same price
        (uint256 price, bool failed) = priceFeed.fetchRedemptionPrice();
        assertEq(price, 30000e18);
        assertEq(failed, false);
        
        // 2. Just within threshold (1.9%)
        tBTCOracle.setPrice(29430e8);  // 1.9% lower
        (price, failed) = priceFeed.fetchRedemptionPrice();
        assertEq(price, 30000e18); // Should use BTC price
        assertEq(failed, false);
        
        // 3. Just outside threshold (2.1%)
        tBTCOracle.setPrice(29370e8);  // 2.1% lower
        (price, failed) = priceFeed.fetchRedemptionPrice();
        assertEq(price, 29370e18); // Should use tBTC price
        assertEq(failed, false);
    }
} 