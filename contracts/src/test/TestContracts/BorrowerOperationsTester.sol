// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../BorrowerOperations.sol";

/* Tester contract inherits from BorrowerOperations, and provides external functions 
for testing the parent's internal functions. */
contract BorrowerOperationsTester is BorrowerOperations {
    constructor(IERC20 _collToken, ITroveManager _troveManager, IERC20 _weth)
        BorrowerOperations(_collToken, _troveManager, _weth)
    {}

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
