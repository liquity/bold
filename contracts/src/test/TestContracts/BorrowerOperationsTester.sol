// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../BorrowerOperations.sol";

/* Tester contract inherits from BorrowerOperations, and provides external functions 
for testing the parent's internal functions. */
contract BorrowerOperationsTester is BorrowerOperations {
    constructor(IERC20 _ETH, ITroveManager _troveManager) BorrowerOperations(_ETH, _troveManager) {}

    function getNewTCRFromTroveChange(
        uint256 _collChange,
        bool isCollIncrease,
        uint256 _debtChange,
        bool isDebtIncrease,
        uint256 _price
    ) external view returns (uint256) {
        return _getNewTCRFromTroveChange(
            isCollIncrease ? _collChange : 0, // _collIncrease
            isCollIncrease ? 0 : _collChange, // _collDecrease
            isDebtIncrease ? _debtChange : 0, // _debtIncrease
            isDebtIncrease ? 0 : _debtChange, // _debtDecrease
            _price
        );
    }

    function getUSDValue(uint256 _coll, uint256 _price) external pure returns (uint256) {
        return _getUSDValue(_coll, _price);
    }
}
