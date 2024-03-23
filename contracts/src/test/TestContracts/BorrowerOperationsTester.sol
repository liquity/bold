// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../BorrowerOperations.sol";

/* Tester contract inherits from BorrowerOperations, and provides external functions 
for testing the parent's internal functions. */
contract BorrowerOperationsTester is BorrowerOperations {

    constructor(address _ETHAddress) BorrowerOperations(_ETHAddress) {}

    function getNewICRFromTroveChange
    (
        uint _coll, 
        uint _debt, 
        uint _collChange, 
        bool isCollIncrease, 
        uint _debtChange, 
        bool isDebtIncrease, 
        uint _price
    ) 
    external
    pure
    returns (uint)
    {
        return _getNewICRFromTroveChange(_coll, _debt, _collChange, isCollIncrease, _debtChange, isDebtIncrease, _price);
    }

    function getNewTCRFromTroveChange
    (
        uint _collChange, 
        bool isCollIncrease,  
        uint _debtChange, 
        bool isDebtIncrease, 
        uint _price
    ) 
    external 
    view
    returns (uint) 
    {
        return _getNewTCRFromTroveChange(_collChange, isCollIncrease, _debtChange, isDebtIncrease, _price);
    }

    function getUSDValue(uint _coll, uint _price) external pure returns (uint) {
        return _getUSDValue(_coll, _price);
    }

    function callInternalAdjustLoan
    (
        uint256 _troveId,
        uint _collWithdrawal, 
        uint _debtChange, 
        bool _isDebtIncrease
    )
        external 
    {
        // TODO: Add coll increase
        _adjustTrove(msg.sender, _troveId, _collWithdrawal, false, _debtChange, _isDebtIncrease, 0);
    }
}
