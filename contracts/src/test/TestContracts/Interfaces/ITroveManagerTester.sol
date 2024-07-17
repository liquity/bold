// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../../Interfaces/ITroveManager.sol";

interface ITroveManagerTester is ITroveManager {
    function get_MCR() external view returns (uint256);
    function get_SCR() external view returns (uint256);
    function get_LIQUIDATION_PENALTY_SP() external view returns (uint256);
    function get_LIQUIDATION_PENALTY_REDISTRIBUTION() external view returns (uint256);

    function computeICR(uint256 _coll, uint256 _debt, uint256 _price) external pure returns (uint256);
    function getCollGasCompensation(uint256 _coll) external pure returns (uint256);

    function getEffectiveRedemptionFeeInColl(uint256 _redeemAmount, uint256 _price) external view returns (uint256);

    function callInternalRemoveTroveId(uint256 _troveId) external;

    function ownerOf(uint256 _troveId) external view returns (address);
    function balanceOf(address _account) external view returns (uint256);

    // Trove and batch getters

    function getPendingCollReward(uint256 _troveId) external view returns (uint256);

    function getPendingBoldDebtReward(uint256 _troveId) external view returns (uint256);

    function getEntireDebtAndColl(uint256 _troveId)
        external
        view
        returns (
            uint256 entireDebt,
            uint256 entireColl,
            uint256 pendingBoldDebtReward,
            uint256 pendingCollReward,
            uint256 accruedTroveInterest
        );

    function getTroveEntireDebt(uint256 _troveId) external view returns (uint256);

    function getTroveEntireColl(uint256 _troveId) external view returns (uint256);

    function getTroveStatus(uint256 _troveId) external view returns (Status);

    function getTroveStake(uint256 _troveId) external view returns (uint256);

    function getTroveDebt(uint256 _troveId) external view returns (uint256);

    function getTroveWeightedRecordedDebt(uint256 _troveId) external returns (uint256);

    function getTroveColl(uint256 _troveId) external view returns (uint256);

    function getTroveLastDebtUpdateTime(uint256 _troveId) external view returns (uint256);

    function troveIsStale(uint256 _troveId) external view returns (bool);

    function getBatchAnnualInterestRate(address _batchAddress) external view returns (uint256);
    function getBatchLastDebtUpdateTime(address _batchAddress) external view returns (uint256);
}
