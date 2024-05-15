// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./BaseMath.sol";
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
contract LiquityBase is BaseMath, ILiquityBase {
    // TODO: Pull all constants out into a separate base contract

    uint256 public constant _100pct = 1000000000000000000; // 1e18 == 100%

    // Critical system collateral ratio. If the system's total collateral ratio (TCR) falls below the CCR, some borrowing operation restrictions are applied
    uint256 public constant CCR = 1500000000000000000; // 150%

    // Amount of Bold to be locked in gas pool on opening troves
    uint256 public constant BOLD_GAS_COMPENSATION = 200e18;

    // Minimum amount of net Bold debt a trove must have
    uint256 public constant MIN_NET_DEBT = 1800e18;
    // uint constant public MIN_NET_DEBT = 0;

    uint256 public constant MAX_ANNUAL_INTEREST_RATE = 1e18; // 100%

    uint256 public constant PERCENT_DIVISOR = 200; // dividing by 200 yields 0.5%

    uint256 public constant BORROWING_FEE_FLOOR = DECIMAL_PRECISION / 1000 * 5; // 0.5%
    uint256 public constant REDEMPTION_FEE_FLOOR = DECIMAL_PRECISION / 1000 * 5; // 0.5%

    IActivePool public activePool;

    IDefaultPool public defaultPool;

    IPriceFeed public override priceFeed;

    // --- Gas compensation functions ---

    // Returns the composite debt (drawn debt + gas compensation) of a trove, for the purpose of ICR calculation
    function _getCompositeDebt(uint256 _debt) internal pure returns (uint256) {
        return _debt + BOLD_GAS_COMPENSATION;
    }

    function _getNetDebt(uint256 _debt) internal pure returns (uint256) {
        return _debt - BOLD_GAS_COMPENSATION;
    }

    // Return the amount of ETH to be drawn from a trove's collateral and sent as gas compensation.
    function _getCollGasCompensation(uint256 _entireColl) internal pure returns (uint256) {
        return _entireColl / PERCENT_DIVISOR;
    }

    function getEntireSystemColl() public view returns (uint256 entireSystemColl) {
        uint256 activeColl = activePool.getETHBalance();
        uint256 liquidatedColl = defaultPool.getETHBalance();

        return activeColl + liquidatedColl;
    }

    function getEntireSystemDebt() public view returns (uint256 entireSystemDebt) {
        uint256 activeDebt = activePool.getTotalActiveDebt();
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
}
