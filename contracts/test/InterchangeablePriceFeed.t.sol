// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {WETHPriceFeed} from "../src/PriceFeeds/WETHPriceFeed.sol";
import {PushPriceFeed} from "../src/PriceFeeds/PushPriceFeed.sol";
import {InterchangeablePriceFeed, Ownable, IPriceFeed} from "../src/PriceFeeds/InterchangeablePriceFeed.sol";

contract MockBorrowerOperations {
    bool public isShutdown = false;

    constructor() {}

    function shutdownFromOracleFailure() external {
        isShutdown = true;
    }
}

contract MockPushPriceFeed is Ownable {
   uint256 public lastGoodPrice;
   bool public isFailed;

    constructor(address _owner) Ownable(_owner) {}

    function fetchPrice() external returns (uint256, bool) {
        return (lastGoodPrice, isFailed);
    }

    function setPrice(uint256 _price) external onlyOwner {
        lastGoodPrice = _price;
    }

    function setIsFailed(bool _isFailed) external onlyOwner {
        isFailed = _isFailed;
    }
}

contract InterchangeablePriceFeedTest is Test {
    address public owner = makeAddr("OWNER");
    address public eth_chainlink = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;

    WETHPriceFeed public eth_chainlink_price_feed;
    MockPushPriceFeed public eth_push_price_feed;
    InterchangeablePriceFeed public interchangeable_price_feed;
    MockBorrowerOperations public mock_borrower_operations;

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), 22522350);

        eth_chainlink_price_feed = new WETHPriceFeed(
            owner,
            eth_chainlink,
            0.02 ether
        );
        eth_push_price_feed = new MockPushPriceFeed(owner);
        interchangeable_price_feed = new InterchangeablePriceFeed(
            owner,
            IPriceFeed(address(eth_push_price_feed))
        );
        mock_borrower_operations = new MockBorrowerOperations();

        vm.prank(owner);
        eth_push_price_feed.setPrice(2500e18);
    }

    function test_change_price_feed() public {
        assertEq(
            address(interchangeable_price_feed.priceFeed()),
            address(eth_push_price_feed)
        );

        change_price_feed();

        assertEq(
            address(interchangeable_price_feed.priceFeed()),
            address(eth_chainlink_price_feed)
        );
    }

    function change_price_feed() internal {
        vm.prank(owner);
        interchangeable_price_feed.setPriceFeed(
            IPriceFeed(address(eth_chainlink_price_feed))
        );
    }

    function test_fetchPrice() public {
        interchangeable_price_feed.fetchPrice();
        assertEq(interchangeable_price_feed.lastGoodPrice(), 2500e18);

        change_price_feed();

        interchangeable_price_feed.fetchPrice();
        assertEq(interchangeable_price_feed.lastGoodPrice(), 2539e18);
    }

    function test_fetchRedemptionPrice() public {
       interchangeable_price_feed.fetchRedemptionPrice();
        assertEq(interchangeable_price_feed.lastGoodPrice(), 2500e18);

        change_price_feed();

        interchangeable_price_feed.fetchRedemptionPrice();
        assertEq(interchangeable_price_feed.lastGoodPrice(), 2539e18);
    }

    function test_setAddresses() public {
        vm.prank(owner);
        interchangeable_price_feed.setAddresses(address(mock_borrower_operations));

        assertEq(
            address(interchangeable_price_feed.borrowerOperations()),
            address(mock_borrower_operations)
        );
    }

    function test_shutdownFromOracleFailure() public {
        vm.startPrank(owner);
        interchangeable_price_feed.setAddresses(address(mock_borrower_operations));
        eth_push_price_feed.setIsFailed(true);

        interchangeable_price_feed.fetchPrice();

        assertTrue(mock_borrower_operations.isShutdown());
    }
}
