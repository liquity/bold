// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "../Interfaces/IOracleAdapter.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/IBorrowerOperations.sol";

import {OwnableUpgradeable} from "openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
/**
 * @title FXPriceFeed
 * @author Mento Labs
 * @notice A contract that fetches the price of an FX rate from an OracleAdapter.
 *         Implements emergency shutdown functionality to handle oracle failures.
 */

contract FXPriceFeed is IPriceFeed, OwnableUpgradeable {
    /* ==================== State Variables ==================== */

    /// @notice The OracleAdapter contract that provides FX rate data
    IOracleAdapter public oracleAdapter;

    /// @notice The identifier address for the specific rate feed to query
    address public rateFeedID;

    /// @notice The watchdog contract address authorized to trigger emergency shutdown
    address public watchdogAddress;

    /// @notice The BorrowerOperations contract
    IBorrowerOperations public borrowerOperations;

    /// @notice The last valid price returned by the OracleAdapter
    uint256 public lastValidPrice;

    /// @notice Whether the contract has been shutdown due to an oracle failure
    bool public isShutdown;

    /// @notice Thrown when the attempting to shutdown the contract when it is already shutdown
    error IsShutDown();
    /// @notice Thrown when a non-watchdog address attempts to shutdown the contract
    error CallerNotWatchdog();
    /// @notice Thrown when a zero address is provided as a parameter
    error ZeroAddress();

    /// @notice Emitted when the rate feed ID is updated
    /// @param _oldRateFeedID The previous rate feed ID
    /// @param _newRateFeedID The new rate feed ID
    event RateFeedIDUpdated(address indexed _oldRateFeedID, address indexed _newRateFeedID);

    /// @notice Emitted when the watchdog address is updated
    /// @param _oldWatchdogAddress The previous watchdog address
    /// @param _newWatchdogAddress The new watchdog address
    event WatchdogAddressUpdated(address indexed _oldWatchdogAddress, address indexed _newWatchdogAddress);

    /// @notice Emitted when the contract is shutdown due to oracle failure
    event FXPriceFeedShutdown();

    /**
     * @notice Contract constructor
     * @param disableInitializers Boolean to disable initializers for implementation contract
     */
    constructor(bool disableInitializers) {
        if (disableInitializers) {
            _disableInitializers();
        }
    }

    /**
     * @notice Initializes the FXPriceFeed contract
     * @param _oracleAdapterAddress The address of the OracleAdapter contract
     * @param _rateFeedID The address of the rate feed ID
     * @param _borrowerOperationsAddress The address of the BorrowerOperations contract
     * @param _watchdogAddress The address of the watchdog contract
     * @param _initialOwner The address of the initial owner
     */
    function initialize(
        address _oracleAdapterAddress,
        address _rateFeedID,
        address _borrowerOperationsAddress,
        address _watchdogAddress,
        address _initialOwner
    ) external initializer {
        if (_oracleAdapterAddress == address(0)) revert ZeroAddress();
        if (_rateFeedID == address(0)) revert ZeroAddress();
        if (_borrowerOperationsAddress == address(0)) revert ZeroAddress();
        if (_watchdogAddress == address(0)) revert ZeroAddress();
        if (_initialOwner == address(0)) revert ZeroAddress();

        oracleAdapter = IOracleAdapter(_oracleAdapterAddress);
        rateFeedID = _rateFeedID;
        borrowerOperations = IBorrowerOperations(_borrowerOperationsAddress);
        watchdogAddress = _watchdogAddress;

        fetchPrice();

        _transferOwnership(_initialOwner);
    }

    function setRateFeedID(address _newRateFeedID) external onlyOwner {
        if (_newRateFeedID == address(0)) revert ZeroAddress();

        address oldRateFeedID = rateFeedID;
        rateFeedID = _newRateFeedID;

        emit RateFeedIDUpdated(oldRateFeedID, _newRateFeedID);
    }

    /**
     * @notice Sets the watchdog address
     * @param _newWatchdogAddress The address of the new watchdog contract
     */
    function setWatchdogAddress(address _newWatchdogAddress) external onlyOwner {
        if (_newWatchdogAddress == address(0)) revert ZeroAddress();

        address oldWatchdogAddress = watchdogAddress;
        watchdogAddress = _newWatchdogAddress;

        emit WatchdogAddressUpdated(oldWatchdogAddress, _newWatchdogAddress);
    }

    /**
     * @notice Fetches the price of the FX rate, if valid
     * @dev If the contract is shutdown due to oracle failure, the last valid price is returned
     * @return The price of the FX rate
     */
    function fetchPrice() public returns (uint256) {
        if (isShutdown) {
            return lastValidPrice;
        }

        // Denominator is always 1e18, so we only use the numerator as the price
        (uint256 price,) = oracleAdapter.getFXRateIfValid(rateFeedID);

        lastValidPrice = price;

        return price;
    }

    /**
     * @notice Shuts down the price feed contract due to oracle failure
     * @dev Can only be called by the authorized watchdog address.
     *      Once shutdown:
     *      - The contract will only return the last valid price
     *      - The BorrowerOperations and TroveManager contracts are notified to shut down the collateral branch
     *      - The shutdown state is permanent and cannot be reversed
     */
    function shutdown() external {
        if (isShutdown) revert IsShutDown();
        if (msg.sender != watchdogAddress) revert CallerNotWatchdog();

        isShutdown = true;
        borrowerOperations.shutdownFromOracleFailure();

        emit FXPriceFeedShutdown();
    }
}
