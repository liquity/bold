// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../Interfaces/ISortedTroves.sol";


// Used as both a wrapper for SortedTroves functions and a mock TroveManager.
contract SortedTrovesTester {
    ISortedTroves sortedTroves;

    // --- SortedTroves external wrapper functions --
    function setSortedTroves(address _sortedTrovesAddress) external {
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
    }

    function insert(address _id, uint256 _annualInterestRate, address _prevId, address _nextId) external {
        sortedTroves.insert(_id, _annualInterestRate, _prevId, _nextId);
    }

    function remove(address _id) external {
        sortedTroves.remove(_id);
    }

    function reInsert(address _id, uint256 _newAnnualInterestRate, address _prevId, address _nextId) external {
        sortedTroves.reInsert(_id, _newAnnualInterestRate, _prevId, _nextId);
    }

    // --- Mock TroveManager functions ---
    function getTroveAnnualInterestRate(address) external pure returns (uint) {
        return 1;
    }

    // function getCurrentICR(address, uint) external pure returns (uint) {
    //     return 1;
    // }
}
