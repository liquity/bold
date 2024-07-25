// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../../Interfaces/ITroveManager.sol";

interface ITroveManagerTester is ITroveManager {
    function computeICR(uint256 _coll, uint256 _debt, uint256 _price) external pure returns (uint256);
    function getCollGasCompensation(uint256 _coll) external pure returns (uint256);

    function getEffectiveRedemptionFeeInColl(uint256 _redeemAmount, uint256 _price) external view returns (uint256);

    function callInternalRemoveTroveId(uint256 _troveId) external;

    function troveIsStale(uint256 _troveId) external view returns (bool);
}
