// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "src/Interfaces/IAddressesRegistry.sol";
import "src/Interfaces/ISystemParams.sol";
import "src/BorrowerOperations.sol";
import "./Interfaces/IBorrowerOperationsTester.sol";

/* Tester contract inherits from BorrowerOperations, and provides external functions
for testing the parent's internal functions. */
contract BorrowerOperationsTester is BorrowerOperations, IBorrowerOperationsTester {
    constructor(IAddressesRegistry _addressesRegistry, ISystemParams _systemParams) BorrowerOperations(_addressesRegistry, _systemParams) {}

    function get_CCR() external view returns (uint256) {
        return systemParams.CCR();
    }

    function getCollToken() external view returns (IERC20) {
        return collToken;
    }

    function getSortedTroves() external view returns (ISortedTroves) {
        return sortedTroves;
    }

    function getBoldToken() external view returns (IBoldToken) {
        return boldToken;
    }

    function applyPendingDebt(uint256 _troveId) external {
        applyPendingDebt(_troveId, 0, 0);
    }

    function getNewTCRFromTroveChange(
        uint256 _collChange,
        bool isCollIncrease,
        uint256 _debtChange,
        bool isDebtIncrease,
        uint256 _price
    ) external view returns (uint256) {
        TroveChange memory troveChange;
        _initTroveChange(troveChange, _collChange, isCollIncrease, _debtChange, isDebtIncrease);
        return _getNewTCRFromTroveChange(troveChange, _price);
    }
}
