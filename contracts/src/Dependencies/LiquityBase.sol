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
    
    uint constant public _100pct = 1000000000000000000; // 1e18 == 100%

    // Minimum collateral ratio for individual troves
    uint constant public MCR = 1100000000000000000; // 110%

    // Critical system collateral ratio. If the system's total collateral ratio (TCR) falls below the CCR, Recovery Mode is triggered.
    uint constant public CCR = 1500000000000000000; // 150%

    // Amount of Bold to be locked in gas pool on opening troves
    uint constant public BOLD_GAS_COMPENSATION = 200e18;

    // Minimum amount of net Bold debt a trove must have
    uint constant public MIN_NET_DEBT = 1800e18;
    // uint constant public MIN_NET_DEBT = 0; 

    uint256 constant public MAX_ANNUAL_INTEREST_RATE = 1e18; // 100%

    uint constant public PERCENT_DIVISOR = 200; // dividing by 200 yields 0.5%

    uint constant public BORROWING_FEE_FLOOR = DECIMAL_PRECISION / 1000 * 5; // 0.5%

    IActivePool public activePool;

    IDefaultPool public defaultPool;

    IPriceFeed public override priceFeed;

    // --- Gas compensation functions ---

    // Returns the composite debt (drawn debt + gas compensation) of a trove, for the purpose of ICR calculation
    function _getCompositeDebt(uint _debt) internal pure returns (uint) {
        return _debt + BOLD_GAS_COMPENSATION;
    }

    function _getNetDebt(uint _debt) internal pure returns (uint) {
        return _debt - BOLD_GAS_COMPENSATION;
    }

    // Return the amount of ETH to be drawn from a trove's collateral and sent as gas compensation.
    function _getCollGasCompensation(uint _entireColl) internal pure returns (uint) {
        return _entireColl / PERCENT_DIVISOR;
    }

    function getEntireSystemColl() public view returns (uint entireSystemColl) {
        uint activeColl = activePool.getETHBalance();
        uint liquidatedColl = defaultPool.getETHBalance();

        return activeColl + liquidatedColl;
    }

    function getEntireSystemDebt() public view returns (uint entireSystemDebt) {
        uint activeDebt = activePool.getTotalActiveDebt();
        uint closedDebt = defaultPool.getBoldDebt();
        // console2.log("SYS::activeDebt", activeDebt);
        // console2.log("SYS::closedDebt", closedDebt);
    
        return activeDebt + closedDebt;
    }

    function _getTCR(uint _price) internal view returns (uint TCR) {
        uint entireSystemColl = getEntireSystemColl();
        uint entireSystemDebt = getEntireSystemDebt();

        TCR = LiquityMath._computeCR(entireSystemColl, entireSystemDebt, _price);

        return TCR;
    }

    function _checkRecoveryMode(uint _price) internal view returns (bool) {
        uint TCR = _getTCR(_price);

        return TCR < CCR;
    }

    function _requireUserAcceptsFee(uint _fee, uint _amount, uint _maxFeePercentage) internal pure {
        uint feePercentage = _fee * DECIMAL_PRECISION / _amount;
        require(feePercentage <= _maxFeePercentage, "Fee exceeded provided maximum");
    }
}
