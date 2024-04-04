// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./ITroveManager.sol";

// TODO
//type Id is uint256;
//type Value is uint256;


// Common interface for the SortedTroves Doubly Linked List.
interface ISortedTroves {
    function borrowerOperationsAddress() external view returns (address);
    function troveManager() external view returns (ITroveManager);

    function setParams(uint256 _size, address _TroveManagerAddress, address _borrowerOperationsAddress) external;

    function insert(uint256 _id, uint256 _value, uint256 _prevId, uint256 _nextId) external;

    function remove(uint256 _id) external;

    function reInsert(uint256 _id, uint256 _newValue, uint256 _prevId, uint256 _nextId) external;

    function contains(uint256 _id) external view returns (bool);

    function isFull() external view returns (bool);

    function isEmpty() external view returns (bool);

    function getSize() external view returns (uint256);

    function getMaxSize() external view returns (uint256);

    function getFirst() external view returns (uint256);

    function getLast() external view returns (uint256);

    function getNext(uint256 _id) external view returns (uint256);

    function getPrev(uint256 _id) external view returns (uint256);

    function validInsertPosition(uint256 _value, uint256 _prevId, uint256 _nextId) external view returns (bool);

    function findInsertPosition(uint256 _value, uint256 _prevId, uint256 _nextId) external view returns (uint256, uint256);
}
