// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../BorrowerOperations.sol";

/* Tester contract inherits from BorrowerOperations, and provides external functions 
for testing the parent's internal functions. */
contract BorrowerOperationsTester is BorrowerOperations {
    constructor(address _ETHAddress) BorrowerOperations(_ETHAddress) {}

    function getNewICRFromTroveChange(
        uint256 _coll,
        uint256 _debt,
        uint256 _collChange,
        bool isCollIncrease,
        uint256 _debtChange,
        bool isDebtIncrease,
        uint256 _price
    ) external pure returns (uint256) {
        return _getNewICRFromTroveChange(_coll, _debt, _collChange, isCollIncrease, _debtChange, isDebtIncrease, _price);
    }

    function getNewTCRFromTroveChange(
        uint256 _collChange,
        bool isCollIncrease,
        uint256 _debtChange,
        bool isDebtIncrease,
        uint256 _price
    ) external view returns (uint256) {
        return _getNewTCRFromTroveChange(_collChange, isCollIncrease, _debtChange, isDebtIncrease, _price);
    }

    function getUSDValue(uint256 _coll, uint256 _price) external pure returns (uint256) {
        return _getUSDValue(_coll, _price);
    }

    function callInternalAdjustLoan(
        uint256 _troveId,
        uint256 _collWithdrawal,
        uint256 _debtChange,
        bool _isDebtIncrease
    ) external {
        // TODO: Add coll increase
        _adjustTrove(msg.sender, _troveId, _collWithdrawal, false, _debtChange, _isDebtIncrease, 0);
    }
}
