// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "src/Interfaces/ISortedTroves.sol";

// Used as both a wrapper for SortedTroves functions and a mock TroveManager.
contract SortedTrovesTester {
    ISortedTroves sortedTroves;

    // --- SortedTroves external wrapper functions --
    function setSortedTroves(address _sortedTrovesAddress) external {
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
    }

    function insert(uint256 _id, uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) external {
        sortedTroves.insert(_id, _annualInterestRate, _prevId, _nextId);
    }

    function remove(uint256 _id) external {
        sortedTroves.remove(_id);
    }

    function reInsert(uint256 _id, uint256 _newAnnualInterestRate, uint256 _prevId, uint256 _nextId) external {
        sortedTroves.reInsert(_id, _newAnnualInterestRate, _prevId, _nextId);
    }

    // --- Mock TroveManager functions ---
    function getTroveAnnualInterestRate(uint256) external pure returns (uint256) {
        return 1;
    }

    // function getCurrentICR(uint256, uint) external pure returns (uint) {
    //     return 1;
    // }
}
