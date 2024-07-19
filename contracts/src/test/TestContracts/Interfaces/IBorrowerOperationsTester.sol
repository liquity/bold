// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../../Interfaces/IBorrowerOperations.sol";

interface IBorrowerOperationsTester is IBorrowerOperations {
    function applyTroveInterestPermissionless(uint256 _troveId) external;
    function getNewTCRFromTroveChange(
        uint256 _collChange,
        bool isCollIncrease,
        uint256 _debtChange,
        bool isDebtIncrease,
        uint256 _price
    ) external view returns (uint256);
}
