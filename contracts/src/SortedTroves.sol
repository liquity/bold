// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBorrowerOperations.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/CheckContract.sol";

/*
* A sorted doubly linked list with nodes sorted in descending order.
*
* Nodes map to active Troves in the system - the ID property is the address of a Trove owner.
* Nodes are ordered according to the borrower's chosen annual interest rate.
*
* The list optionally accepts insert position hints.
*
* The annual interest rate is stored on the Trove struct in TroveManager, not directly on the Node.
*
* A node need only be re-inserted when the borrower adjusts their interest rate. Interest rate order is preserved 
* under all other system operations.
*
* The list is a modification of the following audited SortedDoublyLinkedList:
* https://github.com/livepeer/protocol/blob/master/contracts/libraries/SortedDoublyLL.sol
*
* Changes made in the Bold implementation:
*
* - Keys have been removed from nodes
*
* - Ordering checks for insertion are performed by comparing an interest rate argument to the Trove's current interest rate.
*
* - Public functions with parameters have been made internal to save gas, and given an external wrapper function for external access
*/
contract SortedTroves is Ownable, CheckContract, ISortedTroves {
    string constant public NAME = "SortedTroves";

    event TroveManagerAddressChanged(address _troveManagerAddress);
    event BorrowerOperationsAddressChanged(address _borrowerOperationsAddress);
    event NodeAdded(uint256 _id, uint _annualInterestRate);
    event NodeRemoved(uint256 _id);

    address public borrowerOperationsAddress;

    ITroveManager public troveManager;

    // Information for a node in the list
    struct Node {
        bool exists;
        uint256 nextId;                  // Id of next node (smaller interest rate) in the list
        uint256 prevId;                  // Id of previous node (larger interest rate) in the list
    }

    // Information for the list
    struct Data {
        uint256 head;                        // Head of the list. Also the node in the list with the largest interest rate
        uint256 tail;                        // Tail of the list. Also the node in the list with the smallest interest rate
        uint256 maxSize;                     // Maximum size of the list
        uint256 size;                        // Current size of the list
        mapping (uint256 => Node) nodes;     // Track the corresponding ids for each node in the list
    }

    Data public data;

    // --- Dependency setters ---

    function setParams(uint256 _size, address _troveManagerAddress, address _borrowerOperationsAddress) external override onlyOwner {
        require(_size > 0, "SortedTroves: Size can't be zero");
        checkContract(_troveManagerAddress);
        checkContract(_borrowerOperationsAddress);

        data.maxSize = _size;

        troveManager = ITroveManager(_troveManagerAddress);
        borrowerOperationsAddress = _borrowerOperationsAddress;

        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);

        _renounceOwnership();
    }

    /*
     * @dev Add a node to the list
     * @param _id Node's id
     * @param _annualInterestRate Node's annual interest rate
     * @param _prevId Id of previous node for the insert position
     * @param _nextId Id of next node for the insert position
     */

    function insert (uint256 _id, uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) external override {
        ITroveManager troveManagerCached = troveManager;

        _requireCallerIsBOorTroveM(troveManagerCached);
        _insert(troveManagerCached, _id, _annualInterestRate, _prevId, _nextId);
    }

    function _insert(ITroveManager _troveManager, uint256 _id, uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) internal {
        // List must not be full
        require(!isFull(), "SortedTroves: List is full");
        // List must not already contain node
        require(!contains(_id), "SortedTroves: List already contains the node");
        // Node id must not be null
        require(_id != 0, "SortedTroves: Id cannot be zero");

        uint256 prevId = _prevId;
        uint256 nextId = _nextId;

        if (!_validInsertPosition(_troveManager, _annualInterestRate, prevId, nextId)) {
            // Sender's hint was not a valid insert position
            // Use sender's hint to find a valid insert position
            (prevId, nextId) = _findInsertPosition(_troveManager, _annualInterestRate, prevId, nextId);
        }

         data.nodes[_id].exists = true;

        if (prevId == 0 && nextId == 0) {
            // Insert as head and tail
            data.head = _id;
            data.tail = _id;
        } else if (prevId == 0) {
            // Insert before `prevId` as the head
            data.nodes[_id].nextId = data.head;
            data.nodes[data.head].prevId = _id;
            data.head = _id;
        } else if (nextId == 0) {
            // Insert after `nextId` as the tail
            data.nodes[_id].prevId = data.tail;
            data.nodes[data.tail].nextId = _id;
            data.tail = _id;
        } else {
            // Insert at insert position between `prevId` and `nextId`
            data.nodes[_id].nextId = nextId;
            data.nodes[_id].prevId = prevId;
            data.nodes[prevId].nextId = _id;
            data.nodes[nextId].prevId = _id;
        }

        data.size = data.size + 1;
        emit NodeAdded(_id, _annualInterestRate);
    }

    function remove(uint256 _id) external override {
        _requireCallerIsTroveManager();
        _remove(_id);
    }

    /*
     * @dev Remove a node from the list
     * @param _id Node's id
     */
    function _remove(uint256 _id) internal {
        // List must contain the node
        require(contains(_id), "SortedTroves: List does not contain the id");

        if (data.size > 1) {
            // List contains more than a single node
            if (_id == data.head) {
                // The removed node is the head
                // Set head to next node
                data.head = data.nodes[_id].nextId;
                // Set prev pointer of new head to null
                data.nodes[data.head].prevId = 0;
            } else if (_id == data.tail) {
                // The removed node is the tail
                // Set tail to previous node
                data.tail = data.nodes[_id].prevId;
                // Set next pointer of new tail to null
                data.nodes[data.tail].nextId = 0;
            } else {
                // The removed node is neither the head nor the tail
                // Set next pointer of previous node to the next node
                data.nodes[data.nodes[_id].prevId].nextId = data.nodes[_id].nextId;
                // Set prev pointer of next node to the previous node
                data.nodes[data.nodes[_id].nextId].prevId = data.nodes[_id].prevId;
            }
        } else {
            // List contains a single node
            // Set the head and tail to null
            data.head = 0;
            data.tail = 0;
        }

        delete data.nodes[_id];
        data.size = data.size - 1;
        emit NodeRemoved(_id);
    }

    /*
     * @dev Re-insert the node at a new position, based on its new annual interest rate
     * @param _id Node's id
     * @param _newAnnualInterestRate Node's new annual interest rate
     * @param _prevId Id of previous node for the new insert position
     * @param _nextId Id of next node for the new insert position
     */
    function reInsert(uint256 _id, uint256 _newAnnualInterestRate, uint256 _prevId, uint256 _nextId) external override {
        ITroveManager troveManagerCached = troveManager;

        _requireCallerIsBOorTroveM(troveManagerCached);
        // List must contain the node
        require(contains(_id), "SortedTroves: List does not contain the id");

        // Remove node from the list
        _remove(_id);

        _insert(troveManagerCached, _id, _newAnnualInterestRate, _prevId, _nextId);
    }

    /*
     * @dev Checks if the list contains a node
     */
    function contains(uint256 _id) public view override returns (bool) {
        return data.nodes[_id].exists;
    }

    /*
     * @dev Checks if the list is full
     */
    function isFull() public view override returns (bool) {
        return data.size == data.maxSize;
    }

    /*
     * @dev Checks if the list is empty
     */
    function isEmpty() public view override returns (bool) {
        return data.size == 0;
    }

    /*
     * @dev Returns the current size of the list
     */
    function getSize() external view override returns (uint256) {
        return data.size;
    }

    /*
     * @dev Returns the maximum size of the list
     */
    function getMaxSize() external view override returns (uint256) {
        return data.maxSize;
    }

    /*
     * @dev Returns the first node in the list (node with the largest annual interest rate)
     */
    function getFirst() external view override returns (uint256) {
        return data.head;
    }

    /*
     * @dev Returns the last node in the list (node with the smallest annual interest rate)
     */
    function getLast() external view override returns (uint256) {
        return data.tail;
    }

    /*
     * @dev Returns the next node (with a smaller interest rate) in the list for a given node
     * @param _id Node's id
     */
    function getNext(uint256 _id) external view override returns (uint256) {
        return data.nodes[_id].nextId;
    }

    /*
     * @dev Returns the previous node (with a larger interest rate) in the list for a given node
     * @param _id Node's id
     */
    function getPrev(uint256 _id) external view override returns (uint256) {
        return data.nodes[_id].prevId;
    }

    /*
     * @dev Check if a pair of nodes is a valid insertion point for a new node with the given interest rate
     * @param _annualInterestRate Node's annual interest rate
     * @param _prevId Id of previous node for the insert position
     * @param _nextId Id of next node for the insert position
     */
    function validInsertPosition(uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) external view override returns (bool) {
        return _validInsertPosition(troveManager, _annualInterestRate, _prevId, _nextId);
    }

    function _validInsertPosition(ITroveManager _troveManager, uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) internal view returns (bool) {
        if (_prevId == 0 && _nextId == 0) {
            // `(null, null)` is a valid insert position if the list is empty
            return isEmpty();
        } else if (_prevId == 0) {
            // `(null, _nextId)` is a valid insert position if `_nextId` is the head of the list
            return data.head == _nextId && _annualInterestRate >= _troveManager.getTroveAnnualInterestRate(_nextId);
        } else if (_nextId == 0) {
            // `(_prevId, null)` is a valid insert position if `_prevId` is the tail of the list
            return data.tail == _prevId && _annualInterestRate <= _troveManager.getTroveAnnualInterestRate(_prevId);
        } else {
            // `(_prevId, _nextId)` is a valid insert position if they are adjacent nodes and `_annualInterestRate` falls between the two nodes' interest rates
            return data.nodes[_prevId].nextId == _nextId &&
                   _troveManager.getTroveAnnualInterestRate(_prevId) >= _annualInterestRate &&
                   _annualInterestRate >= _troveManager.getTroveAnnualInterestRate(_nextId);
        }
    }

    /*
     * @dev Descend the list (larger interest rates to smaller interest rates) to find a valid insert position
     * @param _troveManager TroveManager contract, passed in as param to save SLOAD’s
     * @param _annualInterestRate Node's annual interest rate
     * @param _startId Id of node to start descending the list from
     */
    function _descendList(ITroveManager _troveManager, uint256 _annualInterestRate, uint256 _startId) internal view returns (uint256, uint256) {
        // If `_startId` is the head, check if the insert position is before the head
        if (data.head == _startId && _annualInterestRate >= _troveManager.getTroveAnnualInterestRate(_startId)) {
            return (0, _startId);
        }

        uint256 prevId = _startId;
        uint256 nextId = data.nodes[prevId].nextId;

        // Descend the list until we reach the end or until we find a valid insert position
        while (prevId != 0 && !_validInsertPosition(_troveManager, _annualInterestRate, prevId, nextId)) {
            prevId = data.nodes[prevId].nextId;
            nextId = data.nodes[prevId].nextId;
        }

        return (prevId, nextId);
    }

    /*
     * @dev Ascend the list (smaller interest rates to larger interest rates) to find a valid insert position
     * @param _troveManager TroveManager contract, passed in as param to save SLOAD’s
     * @param _annualInterestRate Node's annual interest rate
     * @param _startId Id of node to start ascending the list from
     */
    function _ascendList(ITroveManager _troveManager, uint256 _annualInterestRate, uint256 _startId) internal view returns (uint256, uint256) {
        // If `_startId` is the tail, check if the insert position is after the tail
        if (data.tail == _startId && _annualInterestRate <= _troveManager.getTroveAnnualInterestRate(_startId)) {
            return (_startId, 0);
        }

        uint256 nextId = _startId;
        uint256 prevId = data.nodes[nextId].prevId;

        // Ascend the list until we reach the end or until we find a valid insertion point
        while (nextId != 0 && !_validInsertPosition(_troveManager, _annualInterestRate, prevId, nextId)) {
            nextId = data.nodes[nextId].prevId;
            prevId = data.nodes[nextId].prevId;
        }

        return (prevId, nextId);
    }

    /*
     * @dev Find the insert position for a new node with the given interest rate
     * @param _annualInterestRate Node's annual interest rate
     * @param _prevId Id of previous node for the insert position
     * @param _nextId Id of next node for the insert position
     */
    function findInsertPosition(uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) external view override returns (uint256, uint256) {
        return _findInsertPosition(troveManager, _annualInterestRate, _prevId, _nextId);
    }

    function _findInsertPosition(ITroveManager _troveManager, uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) internal view returns (uint256, uint256) {
        uint256 prevId = _prevId;
        uint256 nextId = _nextId;

        if (prevId != 0) {
            if (!contains(prevId) || _annualInterestRate > _troveManager.getTroveAnnualInterestRate(prevId)) {
                // `prevId` does not exist anymore or now has a smaller interest rate than the given interest rate
                prevId = 0;
            }
        }

        if (nextId != 0) {
            if (!contains(nextId) || _annualInterestRate < _troveManager.getTroveAnnualInterestRate(nextId)) {
                // `nextId` does not exist anymore or now has a larger interest rate than the given interest rate
                nextId = 0;
            }
        }

        if (prevId == 0 && nextId == 0) {
            // No hint - descend list starting from head
            return _descendList(_troveManager, _annualInterestRate, data.head);
        } else if (prevId == 0) {
            // No `prevId` for hint - ascend list starting from `nextId`
            return _ascendList(_troveManager, _annualInterestRate, nextId);
        } else if (nextId == 0) {
            // No `nextId` for hint - descend list starting from `prevId`
            return _descendList(_troveManager, _annualInterestRate, prevId);
        } else {
            // Descend list starting from `prevId`
            return _descendList(_troveManager, _annualInterestRate, prevId);
        }
    }

    // --- 'require' functions ---

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == address(troveManager), "SortedTroves: Caller is not the TroveManager");
    }

    function _requireCallerIsBOorTroveM(ITroveManager _troveManager) internal view {
        require(msg.sender == borrowerOperationsAddress || msg.sender == address(_troveManager),
                "SortedTroves: Caller is neither BO nor TroveM");
    }
}
