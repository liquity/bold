// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "src/Interfaces/IBorrowerOperations.sol";

interface IBorrowerOperationsTester is IBorrowerOperations {
    function getCollToken() external view returns (IERC20);
    function getSortedTroves() external view returns (ISortedTroves);
    function getBoldToken() external view returns (IBoldToken);

    function applyPendingDebt(uint256 _troveId) external;
    function getNewTCRFromTroveChange(
        uint256 _collChange,
        bool isCollIncrease,
        uint256 _debtChange,
        bool isDebtIncrease,
        uint256 _price
    ) external view returns (uint256);
}
