// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.18;

import "./Constants.sol";
import "./LiquityMath.sol";
import "../Interfaces/IActivePool.sol";
import "../Interfaces/IDefaultPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/ILiquityBase.sol";

// import "forge-std/console2.sol";

/*
* Base contract for TroveManager, BorrowerOperations and StabilityPool. Contains global system constants and
* common functions.
*/
contract LiquityBase is ILiquityBase {
    IActivePool public activePool;

    IDefaultPool internal defaultPool;

    IPriceFeed internal priceFeed;

    // --- Gas compensation functions ---

    function getEntireSystemColl() public view returns (uint256 entireSystemColl) {
        uint256 activeColl = activePool.getCollBalance();
        uint256 liquidatedColl = defaultPool.getCollBalance();

        return activeColl + liquidatedColl;
    }

    function getEntireSystemDebt() public view returns (uint256 entireSystemDebt) {
        uint256 activeDebt = activePool.getBoldDebt();
        uint256 closedDebt = defaultPool.getBoldDebt();

        return activeDebt + closedDebt;
    }

    function _getTCR(uint256 _price) internal view returns (uint256 TCR) {
        uint256 entireSystemColl = getEntireSystemColl();
        uint256 entireSystemDebt = getEntireSystemDebt();

        TCR = LiquityMath._computeCR(entireSystemColl, entireSystemDebt, _price);

        return TCR;
    }

    function _checkBelowCriticalThreshold(uint256 _price, uint256 _CCR) internal view returns (bool) {
        uint256 TCR = _getTCR(_price);

        return TCR < _CCR;
    }

    function _calcInterest(uint256 _weightedDebt, uint256 _period) internal pure returns (uint256) {
        return _weightedDebt * _period / ONE_YEAR / DECIMAL_PRECISION;
    }
}
