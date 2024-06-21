// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./Constants.sol";
import "./LiquityMath.sol";
import "../Interfaces/IActivePool.sol";
import "../Interfaces/IDefaultPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/ILiquityBase.sol";

//import "forge-std/console2.sol";

/*
* Base contract for TroveManager, BorrowerOperations and StabilityPool. Contains global system constants and
* common functions.
*/
contract LiquityBase is ILiquityBase {
    IActivePool public activePool;

    IDefaultPool public defaultPool;

    IPriceFeed public override priceFeed;

    // --- Gas compensation functions ---

    // Return the amount of ETH to be drawn from a trove's collateral and sent as gas compensation.
    function _getCollGasCompensation(uint256 _entireColl) internal pure returns (uint256) {
        return _entireColl / COLL_GAS_COMPENSATION_DIVISOR;
    }

    function getEntireSystemColl() public view returns (uint256 entireSystemColl) {
        uint256 activeColl = activePool.getETHBalance();
        uint256 liquidatedColl = defaultPool.getETHBalance();

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

    function _checkBelowCriticalThreshold(uint256 _price) internal view returns (bool) {
        uint256 TCR = _getTCR(_price);

        return TCR < CCR;
    }

    function _calcInterest(uint256 _weightedDebt, uint256 _period) internal pure returns (uint256) {
        return _weightedDebt * _period / ONE_YEAR / DECIMAL_PRECISION;
    }

    function _calcUpfrontFee(uint256 _debt, uint256 _avgInterestRate) internal pure returns (uint256) {
        return _calcInterest(_debt * _avgInterestRate, UPFRONT_INTEREST_PERIOD);
    }
}
