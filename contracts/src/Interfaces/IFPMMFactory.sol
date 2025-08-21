// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.24;

interface IFPMMFactory {
    /* ========================================== */
    /* ================= Events ================= */
    /* ========================================== */

    /**
     * @notice Emitted when a new FPMM is deployed.
     * @param token0 The address of the first token
     * @param token1 The address of the second token
     * @param fpmmProxy The address of the deployed FPMM proxy
     * @param fpmmImplementation The address of the deployed FPMM implementation
     */
    event FPMMDeployed(address indexed token0, address indexed token1, address fpmmProxy, address fpmmImplementation);

    /**
     * @notice Emitted when a new FPMM implementation is registered.
     * @param implementation The address of the registered implementation
     */
    event FPMMImplementationRegistered(address indexed implementation);

    /**
     * @notice Emitted when a new FPMM implementation is unregistered.
     * @param implementation The address of the unregistered implementation
     */
    event FPMMImplementationUnregistered(address indexed implementation);

    /**
     * @notice Emitted when the proxy admin is set.
     * @param proxyAdmin The address of the new proxy admin
     */
    event ProxyAdminSet(address indexed proxyAdmin);

    /**
     * @notice Emitted when the sorted oracles address is set.
     * @param sortedOracles The address of the new sorted oracles contract
     */
    event SortedOraclesSet(address indexed sortedOracles);

    /**
     * @notice Emitted when the breaker box address is set.
     * @param breakerBox The address of the new breaker box contract
     */
    event BreakerBoxSet(address indexed breakerBox);

    /**
     * @notice Emitted when the governance address is set.
     * @param governance The address of the new governance contract
     */
    event GovernanceSet(address indexed governance);

    /* ======================================================== */
    /* ==================== View Functions ==================== */
    /* ======================================================== */

    /**
     * @notice Gets the address of the sorted oracles contract.
     * @return The address of the sorted oracles contract
     */
    function sortedOracles() external view returns (address);

    /**
     * @notice Gets the address of the proxy admin contract.
     * @return The address of the proxy admin contract
     */
    function proxyAdmin() external view returns (address);

    /**
     * @notice Gets the address of the breaker box contract.
     * @return The address of the breaker box contract
     */
    function breakerBox() external view returns (address);

    /**
     * @notice Gets the address of the governance contract.
     * @return The address of the governance contract
     */
    function governance() external view returns (address);

    /**
     * @notice Gets the address of the deployed FPMM for a token pair.
     * @param token0 The address of the first token
     * @param token1 The address of the second token
     * @return The address of the deployed FPMM for the token pair
     */
    function deployedFPMMs(address token0, address token1) external view returns (address);

    /**
     * @notice Gets the list of deployed FPMM addresses.
     * @return The list of deployed FPMM addresses
     */
    function deployedFPMMAddresses() external view returns (address[] memory);

    /**
     * @notice Checks if a FPMM implementation is registered.
     * @param fpmmImplementation The address of the FPMM implementation
     * @return True if the FPMM implementation is registered, false otherwise
     */
    function isRegisteredImplementation(address fpmmImplementation) external view returns (bool);

    /**
     * @notice Gets the list of registered FPMM implementations.
     * @return The list of registered FPMM implementations
     */
    function registeredImplementations() external view returns (address[] memory);

    /**
     * @notice Gets the precomputed or current proxy address for a token pair.
     * @param token0 The address of the first token
     * @param token1 The address of the second token
     * @return The address of the FPMM proxy for the token pair
     */
    function getOrPrecomputeProxyAddress(address token0, address token1) external view returns (address);

    /* ============================================================ */
    /* ==================== Mutative Functions ==================== */
    /* ============================================================ */

    /**
     * @notice Initializes the factory with required addresses.
     * @param _sortedOracles The address of the sorted oracles contract
     * @param _proxyAdmin The address of the proxy admin contract
     * @param _breakerBox The address of the breaker box contract
     * @param _governance The address of the governance contract
     * @param _fpmmImplementation The address of the FPMM implementation
     */
    function initialize(
        address _sortedOracles,
        address _proxyAdmin,
        address _breakerBox,
        address _governance,
        address _fpmmImplementation
    ) external;

    /**
     * @notice Sets the address of the sorted oracles contract.
     * @param _sortedOracles The new address of the sorted oracles contract
     */
    function setSortedOracles(address _sortedOracles) external;

    /**
     * @notice Sets the address of the proxy admin contract.
     * @param _proxyAdmin The new address of the proxy admin contract
     */
    function setProxyAdmin(address _proxyAdmin) external;

    /**
     * @notice Sets the address of the breaker box contract.
     * @param _breakerBox The new address of the breaker box contract
     */
    function setBreakerBox(address _breakerBox) external;

    /**
     * @notice Sets the address of the governance contract.
     * @param _governance The new address of the governance contract
     */
    function setGovernance(address _governance) external;

    /**
     * @notice Registers a new FPMM implementation address.
     * @param fpmmImplementation The FPMM implementation address to register
     */
    function registerFPMMImplementation(address fpmmImplementation) external;

    /**
     * @notice Unregisters a FPMM implementation address.
     * @param fpmmImplementation The FPMM implementation address to unregister
     * @param index The index of the FPMM implementation to unregister
     */
    function unregisterFPMMImplementation(address fpmmImplementation, uint256 index) external;

    /**
     * @notice Deploys a new FPMM for a token pair using the default parameters.
     * @param fpmmImplementation The address of the FPMM implementation
     * @param token0 The address of the first token
     * @param token1 The address of the second token
     * @param referenceRateFeedID The address of the reference rate feed
     * @return proxy The address of the deployed FPMM proxy
     */
    function deployFPMM(address fpmmImplementation, address token0, address token1, address referenceRateFeedID)
        external
        returns (address proxy);

    /**
     * @notice Deploys a new FPMM for a token pair using custom parameters.
     * @param fpmmImplementation The address of the FPMM implementation
     * @param customSortedOracles The address of the custom sorted oracles contract
     * @param customProxyAdmin The address of the custom proxy admin contract
     * @param customBreakerBox The address of the custom breaker box contract
     * @param customGovernance The address of the custom governance contract
     * @param token0 The address of the first token
     * @param token1 The address of the second token
     * @param referenceRateFeedID The address of the reference rate feed
     * @return proxy The address of the deployed FPMM proxy
     */
    function deployFPMM(
        address fpmmImplementation,
        address customSortedOracles,
        address customProxyAdmin,
        address customBreakerBox,
        address customGovernance,
        address token0,
        address token1,
        address referenceRateFeedID
    ) external returns (address proxy);
}
