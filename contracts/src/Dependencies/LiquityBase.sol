// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import "./Constants.sol";
import "./LiquityMath.sol";
import "./HasWhitelist.sol";
import "../Interfaces/IAddressesRegistry.sol";
import "../Interfaces/IActivePool.sol";
import "../Interfaces/IDefaultPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/ILiquityBase.sol";

/*
 * Base contract for TroveManager, BorrowerOperations and StabilityPool. Contains global system constants and
 * common functions.
 */
contract LiquityBase is HasWhitelist, ILiquityBase {
    IAddressesRegistry public addressesRegistry;
    IActivePool public activePool;
    IDefaultPool internal defaultPool;
    IPriceFeed internal priceFeed;

    event ActivePoolAddressChanged(address _newActivePoolAddress);
    event DefaultPoolAddressChanged(address _newDefaultPoolAddress);
    event PriceFeedAddressChanged(address _newPriceFeedAddress);

    error CallerNotAddressesRegistry();

    constructor(IAddressesRegistry _addressesRegistry) {
        addressesRegistry = _addressesRegistry;
        activePool = _addressesRegistry.activePool();
        defaultPool = _addressesRegistry.defaultPool();
        priceFeed = _addressesRegistry.priceFeed();
        whitelist = _addressesRegistry.whitelist();

        emit ActivePoolAddressChanged(address(activePool));
        emit DefaultPoolAddressChanged(address(defaultPool));
        emit PriceFeedAddressChanged(address(priceFeed));
    }
    // --- Gas compensation functions ---

    function getEntireBranchColl() public view returns (uint256 entireSystemColl) {
        uint256 activeColl = activePool.getCollBalance();
        uint256 liquidatedColl = defaultPool.getCollBalance();

        return activeColl + liquidatedColl;
    }

    function getEntireBranchDebt() public view returns (uint256 entireSystemDebt) {
        uint256 activeDebt = activePool.getBoldDebt();
        uint256 closedDebt = defaultPool.getBoldDebt();

        return activeDebt + closedDebt;
    }

    function _getTCR(uint256 _price) internal view returns (uint256 TCR) {
        uint256 entireSystemColl = getEntireBranchColl();
        uint256 entireSystemDebt = getEntireBranchDebt();

        TCR = LiquityMath._computeCR(entireSystemColl, entireSystemDebt, _price);

        return TCR;
    }

    function _checkBelowCriticalThreshold(uint256 _price, uint256 _CCR) internal view returns (bool) {
        uint256 TCR = _getTCR(_price);

        return TCR < _CCR;
    }

    function _calcInterest(uint256 _weightedDebt, uint256 _period) internal pure returns (uint256) {
        return (_weightedDebt * _period) / ONE_YEAR / DECIMAL_PRECISION;
    }

    // --- Whitelist functions ---
    function setWhitelist(IWhitelist _whitelist) external override(ILiquityBase) {
        _requireCallerIsAddressesRegistry();
        super._setWhitelist(_whitelist);
    }

    // --- AddressesRegistry functions ---

    function _requireCallerIsAddressesRegistry() internal view {
        if (msg.sender != address(addressesRegistry)) {
            revert CallerNotAddressesRegistry();
        }
    }
}
