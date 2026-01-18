// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./TestContracts/DevTestSetup.sol";
import "../src/PriceFeeds/FXPriceFeed.sol";

import { Test } from "forge-std/Test.sol";

contract MockBorrowerOperations {
    bool public _isShutdown;

    function shutdownFromOracleFailure() external {
        _isShutdown = true;
    }

    function shutdownCalled() external view returns (bool) {
        return _isShutdown;
    }
}

contract MockOracleAdapter {
    uint256 numerator;
    uint256 denominator;
    bool public sequencerUp = true;

    function setFXRate(uint256 _numerator, uint256 _denominator) external {
        numerator = _numerator;
        denominator = _denominator;
    }

    function getFXRateIfValid(address) external view returns (uint256, uint256) {
        return (numerator, denominator);
    }

    function setIsL2SequencerUp(bool _isUp) external {
        sequencerUp = _isUp;
    }

    function isL2SequencerUp(uint256) external view returns (bool) {
        return sequencerUp;
    }
}


contract FXPriceFeedTest is Test {

    event WatchdogAddressUpdated(address indexed _oldWatchdogAddress, address indexed _newWatchdogAddress);
    event InvertRateFeedUpdated(bool _oldInvertRateFeed, bool _newInvertRateFeed);
    event FXPriceFeedShutdown();
    event OracleAdapterUpdated(address indexed _oldOracleAdapterAddress, address indexed _newOracleAdapterAddress);
    event L2SequencerGracePeriodUpdated(uint256 indexed _oldL2SequencerGracePeriod, uint256 indexed _newL2SequencerGracePeriod);

    FXPriceFeed public fxPriceFeed;
    MockOracleAdapter public mockOracleAdapter;
    MockBorrowerOperations public mockBorrowerOperations;
    MockFXPriceFeed public mockFXPriceFeed;

    uint256 public l2SequencerGracePeriod = 6 hours;
    address public rateFeedID = makeAddr("rateFeedID");
    address public watchdog = makeAddr("watchdog");
    address public owner = makeAddr("owner");

    uint256 constant mockRateNumerator = 1200 * 1e18; // 1.2 USD per unit
    uint256 constant mockRateDenominator = 1e18;

    modifier initialized() {
        vm.startPrank(owner);
        fxPriceFeed.initialize(
            address(mockOracleAdapter),
            rateFeedID,
            false,
            l2SequencerGracePeriod,
            address(mockBorrowerOperations),
            watchdog,
            owner
        );
        vm.stopPrank();
        _;
    }

    function setUp() public {
        mockOracleAdapter = new MockOracleAdapter();
        mockOracleAdapter.setFXRate(mockRateNumerator, mockRateDenominator);
        mockOracleAdapter.setIsL2SequencerUp(true);

        mockBorrowerOperations = new MockBorrowerOperations();

        fxPriceFeed = new FXPriceFeed(false);
    }

    function test_constructor_whenDisableInitializersTrue_shouldDisableInitialization() public {
        FXPriceFeed newFeed = new FXPriceFeed(true);

        vm.expectRevert();
        newFeed.initialize(
            address(mockOracleAdapter),
            rateFeedID,
            false,
            l2SequencerGracePeriod,
            address(mockBorrowerOperations),
            watchdog,
            owner
        );
    }

    function test_initialize_whenOracleAdapterAddressIsZero_shouldRevert() public {
        FXPriceFeed newFeed = new FXPriceFeed(false);

        vm.expectRevert(FXPriceFeed.ZeroAddress.selector);
        newFeed.initialize(
            address(0),
            rateFeedID,
            false,
            l2SequencerGracePeriod,
            address(mockBorrowerOperations),
            watchdog,
            owner
        );
    }

    function test_initialize_whenRateFeedIDIsZero_shouldRevert() public {
        FXPriceFeed newFeed = new FXPriceFeed(false);

        vm.expectRevert(FXPriceFeed.ZeroAddress.selector);
        newFeed.initialize(
            address(mockOracleAdapter),
            address(0),
            false,
            l2SequencerGracePeriod,
            address(mockBorrowerOperations),
            watchdog,
            owner
        );
    }

    function test_initialize_whenBorrowerOperationsAddressIsZero_shouldRevert() public {
        FXPriceFeed newFeed = new FXPriceFeed(false);

        vm.expectRevert(FXPriceFeed.ZeroAddress.selector);
        newFeed.initialize(
            address(mockOracleAdapter),
            rateFeedID,
            false,
            l2SequencerGracePeriod,
            address(0),
            watchdog,
            owner
        );
    }

    function test_initialize_whenWatchdogAddressIsZero_shouldRevert() public {
        FXPriceFeed newFeed = new FXPriceFeed(false);

        vm.expectRevert(FXPriceFeed.ZeroAddress.selector);
        newFeed.initialize(
            address(mockOracleAdapter),
            rateFeedID,
            false,
            l2SequencerGracePeriod,
            address(mockBorrowerOperations),
            address(0),
            owner
        );
    }

    function test_initialize_whenInitialOwnerIsZero_shouldRevert() public {
        FXPriceFeed newFeed = new FXPriceFeed(false);

        vm.expectRevert(FXPriceFeed.ZeroAddress.selector);
        newFeed.initialize(
            address(mockOracleAdapter),
            rateFeedID,
            false,
            l2SequencerGracePeriod,
            address(mockBorrowerOperations),
            watchdog,
            address(0)
        );
    }

    function test_initialize_whenAllParametersValid_shouldSucceed() public {
        FXPriceFeed newFeed = new FXPriceFeed(false);

        mockOracleAdapter.setFXRate(5e18, 1e18);

        newFeed.initialize(
            address(mockOracleAdapter),
            rateFeedID,
            false,
            l2SequencerGracePeriod,
            address(mockBorrowerOperations),
            watchdog,
            owner
        );

        assertEq(address(newFeed.oracleAdapter()), address(mockOracleAdapter));
        assertEq(newFeed.rateFeedID(), rateFeedID);
        assertEq(newFeed.l2SequencerGracePeriod(), l2SequencerGracePeriod);
        assertEq(address(newFeed.borrowerOperations()), address(mockBorrowerOperations));
        assertEq(newFeed.watchdogAddress(), watchdog);
        assertEq(newFeed.owner(), owner);
        assertEq(newFeed.lastValidPrice(), 5e18);
    }

    function test_initialize_whenCalledTwice_shouldRevert() public {
        FXPriceFeed newFeed = new FXPriceFeed(false);

        newFeed.initialize(
            address(mockOracleAdapter),
            rateFeedID,
            false,
            l2SequencerGracePeriod,
            address(mockBorrowerOperations),
            watchdog,
            owner
        );

        vm.expectRevert("Initializable: contract is already initialized");
        newFeed.initialize(
            address(mockOracleAdapter),
            rateFeedID,
            false,
            l2SequencerGracePeriod,
            address(mockBorrowerOperations),
            watchdog,
            owner
        );
    }

    function test_setRateFeedID_whenCalledByNonOwner_shouldRevert() initialized public {
        address notOwner = makeAddr("notOwner");
        address newRateFeedID = makeAddr("newRateFeedID");

        vm.prank(notOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        fxPriceFeed.setRateFeedID(newRateFeedID);
        vm.stopPrank();
    }

    function test_setRateFeedID_whenNewAddressIsZero_shouldRevert() initialized public {
        vm.prank(owner);
        vm.expectRevert(FXPriceFeed.ZeroAddress.selector);
        fxPriceFeed.setRateFeedID(address(0));
        vm.stopPrank();
    }

    function test_setRateFeedID_whenCalledByOwner_shouldSucceed() initialized public {
        address newRateFeedID = makeAddr("newRateFeedID");

        vm.prank(owner);
        fxPriceFeed.setRateFeedID(newRateFeedID);
        vm.stopPrank();

        assertEq(fxPriceFeed.rateFeedID(), newRateFeedID);
    }

    function test_setInvertRateFeed_whenCalledByNonOwner_shouldRevert() initialized public {
        address notOwner = makeAddr("notOwner");
        bool newInvertRateFeed = true;

        vm.prank(notOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        fxPriceFeed.setInvertRateFeed(newInvertRateFeed);
        vm.stopPrank();
    }

    function test_setInvertRateFeed_whenCalledByOwner_shouldSucceed() initialized public {
        vm.startPrank(owner);
        vm.expectEmit();
        emit InvertRateFeedUpdated(false, true);
        fxPriceFeed.setInvertRateFeed(true);
        vm.stopPrank();

        assertEq(fxPriceFeed.invertRateFeed(), true);

        vm.startPrank(owner);
        vm.expectEmit();
        emit InvertRateFeedUpdated(true, false);
        fxPriceFeed.setInvertRateFeed(false);
        vm.stopPrank();

        assertEq(fxPriceFeed.invertRateFeed(), false);
    }

    function test_setWatchdogAddress_whenCalledByNonOwner_shouldRevert() initialized public {
        address notOwner = makeAddr("notOwner");
        address newWatchdog = makeAddr("newWatchdog");

        vm.prank(notOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        fxPriceFeed.setWatchdogAddress(newWatchdog);
        vm.stopPrank();
    }

    function test_setWatchdogAddress_whenNewAddressIsZero_shouldRevert() initialized public {
        vm.prank(owner);
        vm.expectRevert(FXPriceFeed.ZeroAddress.selector);
        fxPriceFeed.setWatchdogAddress(address(0));
        vm.stopPrank();
    }

    function test_setWatchdogAddress_whenCalledByOwner_shouldSucceed() initialized public {
        address newWatchdog = makeAddr("newWatchdog");

        vm.prank(owner);
        vm.expectEmit();
        emit WatchdogAddressUpdated(watchdog, newWatchdog);
        fxPriceFeed.setWatchdogAddress(newWatchdog);
        vm.stopPrank();

        assertEq(fxPriceFeed.watchdogAddress(), newWatchdog);
    }

    function test_fetchPrice_whenNotShutdown_shouldReturnOraclePrice() initialized public {
        uint256 price = fxPriceFeed.fetchPrice();

        assertEq(price, mockRateNumerator);
        assertEq(fxPriceFeed.lastValidPrice(), mockRateNumerator);
    }

    function test_fetchPrice_whenShutdown_shouldReturnLastValidPrice() initialized public {
        uint256 initialPrice = fxPriceFeed.fetchPrice();
        assertEq(initialPrice, mockRateNumerator);

        vm.prank(watchdog);
        fxPriceFeed.shutdown();
        vm.stopPrank();

        mockOracleAdapter.setFXRate(2 * mockRateNumerator, 2 * mockRateDenominator);

        uint256 priceAfterShutdown = fxPriceFeed.fetchPrice();

        assertEq(priceAfterShutdown, initialPrice);
        assertEq(fxPriceFeed.lastValidPrice(), initialPrice);
    }

    function test_fetchPrice_whenInvertRateFeedIsTrue_shouldReturnInvertedPrice() initialized public {
        vm.startPrank(owner);
        fxPriceFeed.setInvertRateFeed(true);
        vm.stopPrank();

        uint256 price = fxPriceFeed.fetchPrice();

        assertEq(price, (mockRateDenominator * 1e18) / mockRateNumerator);
        assertEq(fxPriceFeed.lastValidPrice(), (mockRateDenominator * 1e18) / mockRateNumerator);

        uint256 XOFUSDRateNumerator = 1771165426850867; // 0.001771 USD = ~1 XOF
        mockOracleAdapter.setFXRate(XOFUSDRateNumerator, 1e18);

        assertEq(fxPriceFeed.fetchPrice(), 564600000000000277670); // 1 USD = ~564 XOF
        assertEq(fxPriceFeed.lastValidPrice(), 564600000000000277670);
    }

    function test_shutdown_whenCalledByNonWatchdog_shouldRevert() initialized public {
        address notWatchdog = makeAddr("notWatchdog");

        vm.prank(notWatchdog);
        vm.expectRevert(FXPriceFeed.OnlyWatchdog.selector);
        fxPriceFeed.shutdown();
        vm.stopPrank();
    }

    function test_shutdown_whenCalledByWatchdog_shouldShutdown() initialized public {
        assertEq(fxPriceFeed.isShutdown(), false);
        assertEq(mockBorrowerOperations.shutdownCalled(), false);

        vm.prank(watchdog);
        vm.expectEmit();
        emit FXPriceFeedShutdown();
        fxPriceFeed.shutdown();
        vm.stopPrank();

        assertTrue(fxPriceFeed.isShutdown());
        assertTrue(mockBorrowerOperations.shutdownCalled());
    }

    function test_shutdown_whenAlreadyShutdown_shouldRevert() initialized public {
        vm.prank(watchdog);
        fxPriceFeed.shutdown();
        vm.expectRevert(FXPriceFeed.AlreadyShutdown.selector);
        fxPriceFeed.shutdown();
        vm.stopPrank();
    }

    function test_setOracleAdapter_whenCalledByNonOwner_shouldRevert() initialized public {
        address notOwner = makeAddr("notOwner");

        vm.prank(notOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        fxPriceFeed.setOracleAdapter(makeAddr("newOracleAdapter"));
        vm.stopPrank();
    }

    function test_setOracleAdapter_whenNewAddressIsZero_shouldRevert() initialized public {
        vm.prank(owner);
        vm.expectRevert(FXPriceFeed.ZeroAddress.selector);
        fxPriceFeed.setOracleAdapter(address(0));
        vm.stopPrank();
    }

    function test_setOracleAdapter_whenCalledByOwner_shouldSucceed() initialized public {
        address newOracleAdapter = makeAddr("newOracleAdapter");

        vm.prank(owner);
        vm.expectEmit();
        emit OracleAdapterUpdated(address(mockOracleAdapter), newOracleAdapter);
        fxPriceFeed.setOracleAdapter(newOracleAdapter);
        vm.stopPrank();

        assertEq(address(fxPriceFeed.oracleAdapter()), newOracleAdapter);
    }

    function test_setL2SequencerGracePeriod_whenCalledByNonOwner_shouldRevert() initialized public {
        address notOwner = makeAddr("notOwner");

        vm.prank(notOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        fxPriceFeed.setL2SequencerGracePeriod(12 hours);
        vm.stopPrank();
    }

    function test_setL2SequencerGracePeriod_whenNewPeriodIsZero_shouldRevert() initialized public {
        vm.prank(owner);
        vm.expectRevert(FXPriceFeed.InvalidL2SequencerGracePeriod.selector);
        fxPriceFeed.setL2SequencerGracePeriod(0);
        vm.stopPrank();
    }

    function test_setL2SequencerGracePeriod_whenCalledByOwner_shouldSucceed() initialized public {
        uint256 oldGracePeriod = fxPriceFeed.l2SequencerGracePeriod();
        uint256 newGracePeriod = 12 hours;

        vm.prank(owner);
        vm.expectEmit();
        emit L2SequencerGracePeriodUpdated(oldGracePeriod, newGracePeriod);
        fxPriceFeed.setL2SequencerGracePeriod(newGracePeriod);
        vm.stopPrank();

        assertEq(fxPriceFeed.l2SequencerGracePeriod(), newGracePeriod);
    }

    function test_isL2SequencerUp_whenSequencerIsUp_shouldReturnTrue() initialized public {
        mockOracleAdapter.setIsL2SequencerUp(true);

        bool result = fxPriceFeed.isL2SequencerUp();
        assertTrue(result);
    }

    function test_isL2SequencerUp_whenSequencerIsDown_shouldReturnFalse() initialized public {
        mockOracleAdapter.setIsL2SequencerUp(false);

        bool result = fxPriceFeed.isL2SequencerUp();
        assertFalse(result);
    }
}
