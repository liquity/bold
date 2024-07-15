// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../BorrowerOperations.sol";

/* Tester contract inherits from BorrowerOperations, and provides external functions
for testing the parent's internal functions. */
contract BorrowerOperationsTester is BorrowerOperations {
    constructor(uint256 _mcr, uint256 _scr, IERC20 _collToken, ITroveNFT _troveNFT, IERC20 _weth)
        BorrowerOperations(_mcr, _scr, _collToken, _troveNFT, _weth)
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
