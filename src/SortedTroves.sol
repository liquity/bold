// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/IAddressesRegistry.sol";
import "./Interfaces/ITroveManager.sol";
import "./Interfaces/IBorrowerOperations.sol";

// ID of head & tail of the list. Callers should stop iterating with `getNext()` / `getPrev()`
// when encountering this node ID.
uint256 constant ROOT_NODE_ID = 0;

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
contract SortedTroves is ISortedTroves {
    string public constant NAME = "SortedTroves";

    // Constants used for documentation purposes
    uint256 constant UNINITIALIZED_ID = 0;
    uint256 constant BAD_HINT = 0;

    event TroveManagerAddressChanged(address _troveManagerAddress);
    event BorrowerOperationsAddressChanged(address _borrowerOperationsAddress);

    address public immutable borrowerOperationsAddress;
    ITroveManager public immutable troveManager;

    // Information for a node in the list
    struct Node {
        uint256 nextId; // Id of next node (smaller interest rate) in the list
        uint256 prevId; // Id of previous node (larger interest rate) in the list
        BatchId batchId; // Id of this node's batch manager, or zero in case of non-batched nodes
        bool exists;
    }

    struct Batch {
        uint256 head;
        uint256 tail;
    }

    struct Position {
        uint256 prevId;
        uint256 nextId;
    }

    // Current size of the list
    uint256 public size;

    // Stores the forward and reverse links of each node in the list.
    // nodes[ROOT_NODE_ID] holds the head and tail of the list. This avoids the need for special
    // handling when inserting into or removing from a terminal position (head or tail), inserting
    // into an empty list or removing the element of a singleton list.
    mapping(uint256 => Node) public nodes;

    // Lookup batches by the address of their manager
    mapping(BatchId => Batch) public batches;

    constructor(IAddressesRegistry _addressesRegistry) {
        // Technically, this is not needed as long as ROOT_NODE_ID is 0, but it doesn't hurt
        nodes[ROOT_NODE_ID].nextId = ROOT_NODE_ID;
        nodes[ROOT_NODE_ID].prevId = ROOT_NODE_ID;

        troveManager = ITroveManager(_addressesRegistry.troveManager());
        borrowerOperationsAddress = address(_addressesRegistry.borrowerOperations());

        emit TroveManagerAddressChanged(address(troveManager));
        emit BorrowerOperationsAddressChanged(borrowerOperationsAddress);
    }

    // Insert an entire list slice (such as a batch of Troves sharing the same interest rate)
    // between adjacent nodes `_prevId` and `_nextId`.
    // Can be used to insert a single node by passing its ID as both `_sliceHead` and `_sliceTail`.
    function _insertSliceIntoVerifiedPosition(uint256 _sliceHead, uint256 _sliceTail, uint256 _prevId, uint256 _nextId)
        internal
    {
        nodes[_prevId].nextId = _sliceHead;
        nodes[_sliceHead].prevId = _prevId;
        nodes[_sliceTail].nextId = _nextId;
        nodes[_nextId].prevId = _sliceTail;
    }

    function _insertSlice(
        ITroveManager _troveManager,
        uint256 _sliceHead,
        uint256 _sliceTail,
        uint256 _annualInterestRate,
        uint256 _prevId,
        uint256 _nextId
    ) internal {
        if (!_validInsertPosition(_troveManager, _annualInterestRate, _prevId, _nextId)) {
            // Sender's hint was not a valid insert position
            // Use sender's hint to find a valid insert position
            (_prevId, _nextId) = _findInsertPosition(_troveManager, _annualInterestRate, _prevId, _nextId);
        }

        _insertSliceIntoVerifiedPosition(_sliceHead, _sliceTail, _prevId, _nextId);
    }

    /*
     * @dev Add a Trove to the list
     * @param _id Trove's id
     * @param _annualInterestRate Trove's annual interest rate
     * @param _prevId Id of previous Trove for the insert position
     * @param _nextId Id of next Trove for the insert position
     */
    function insert(uint256 _id, uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) external override {
        _requireCallerIsBorrowerOperations();
        require(!contains(_id), "SortedTroves: List already contains the node");
        require(_id != ROOT_NODE_ID, "SortedTroves: _id cannot be the root node's ID");

        _insertSlice(troveManager, _id, _id, _annualInterestRate, _prevId, _nextId);
        nodes[_id].exists = true;
        ++size;
    }

    // Remove the entire slice between `_sliceHead` and `_sliceTail` from the list while keeping
    // the removed nodes connected to each other, such that they can be reinserted into a different
    // position with `_insertSlice()`.
    // Can be used to remove a single node by passing its ID as both `_sliceHead` and `_sliceTail`.
    function _removeSlice(uint256 _sliceHead, uint256 _sliceTail) internal {
        nodes[nodes[_sliceHead].prevId].nextId = nodes[_sliceTail].nextId;
        nodes[nodes[_sliceTail].nextId].prevId = nodes[_sliceHead].prevId;
    }

    /*
     * @dev Remove a non-batched Trove from the list
     * @param _id Trove's id
     */
    function remove(uint256 _id) external override {
        _requireCallerIsBOorTM();
        require(contains(_id), "SortedTroves: List does not contain the id");
        require(!isBatchedNode(_id), "SortedTroves: Must use removeFromBatch() to remove batched node");

        _removeSlice(_id, _id);
        delete nodes[_id];
        --size;
    }

    function _reInsertSlice(
        ITroveManager _troveManager,
        uint256 _sliceHead,
        uint256 _sliceTail,
        uint256 _annualInterestRate,
        uint256 _prevId,
        uint256 _nextId
    ) internal {
        if (!_validInsertPosition(_troveManager, _annualInterestRate, _prevId, _nextId)) {
            // Sender's hint was not a valid insert position
            // Use sender's hint to find a valid insert position
            (_prevId, _nextId) = _findInsertPosition(_troveManager, _annualInterestRate, _prevId, _nextId);
        }

        // Check that the new insert position isn't the same as the existing one
        if (_nextId != _sliceHead && _prevId != _sliceTail) {
            _removeSlice(_sliceHead, _sliceTail);
            _insertSliceIntoVerifiedPosition(_sliceHead, _sliceTail, _prevId, _nextId);
        }
    }

    /*
     * @dev Re-insert a non-batched Trove at a new position, based on its new annual interest rate
     * @param _id Trove's id
     * @param _newAnnualInterestRate Trove's new annual interest rate
     * @param _prevId Id of previous Trove for the new insert position
     * @param _nextId Id of next Trove for the new insert position
     */
    function reInsert(uint256 _id, uint256 _newAnnualInterestRate, uint256 _prevId, uint256 _nextId)
        external
        override
    {
        _requireCallerIsBorrowerOperations();
        require(contains(_id), "SortedTroves: List does not contain the id");
        require(!isBatchedNode(_id), "SortedTroves: Must not reInsert() batched node");

        _reInsertSlice(troveManager, _id, _id, _newAnnualInterestRate, _prevId, _nextId);
    }

    /*
     * @dev Add a Trove to a Batch within the list
     * @param _troveId Trove's id
     * @param _batchId Batch's id
     * @param _annualInterestRate Batch's annual interest rate
     * @param _prevId Id of previous Trove for the insert position, in case the Batch is empty
     * @param _nextId Id of next Trove for the insert position, in case the Batch is empty
     */
    function insertIntoBatch(
        uint256 _troveId,
        BatchId _batchId,
        uint256 _annualInterestRate,
        uint256 _prevId,
        uint256 _nextId
    ) external override {
        _requireCallerIsBorrowerOperations();
        require(!contains(_troveId), "SortedTroves: List already contains the node");
        require(_troveId != ROOT_NODE_ID, "SortedTroves: _troveId cannot be the root node's ID");
        require(_batchId.isNotZero(), "SortedTroves: _batchId cannot be zero");

        uint256 batchTail = batches[_batchId].tail;

        if (batchTail == UNINITIALIZED_ID) {
            _insertSlice(troveManager, _troveId, _troveId, _annualInterestRate, _prevId, _nextId);
            // Initialize the batch by setting both its head & tail to its singular node
            batches[_batchId].head = _troveId;
            // (Tail will be set outside the "if")
        } else {
            _insertSliceIntoVerifiedPosition(_troveId, _troveId, batchTail, nodes[batchTail].nextId);
        }

        batches[_batchId].tail = _troveId;
        nodes[_troveId].batchId = _batchId;
        nodes[_troveId].exists = true;
        ++size;
    }

    /*
     * @dev Remove a batched Trove from the list
     * @param _id Trove's id
     */
    function removeFromBatch(uint256 _id) external override {
        _requireCallerIsBOorTM();
        BatchId batchId = nodes[_id].batchId;
        // batchId.isNotZero() implies that the list contains the node
        require(batchId.isNotZero(), "SortedTroves: Must use remove() to remove non-batched node");

        Batch memory batch = batches[batchId];

        if (batch.head == _id && batch.tail == _id) {
            // Remove singleton batch
            delete batches[batchId];
        } else if (batch.head == _id) {
            batches[batchId].head = nodes[_id].nextId;
        } else if (batch.tail == _id) {
            batches[batchId].tail = nodes[_id].prevId;
        }

        _removeSlice(_id, _id);
        delete nodes[_id];
        --size;
    }

    /*
     * @dev Re-insert an entire Batch of Troves at a new position, based on their new annual interest rate
     * @param _id Batch's id
     * @param _newAnnualInterestRate Trove's new annual interest rate
     * @param _prevId Id of previous Trove for the new insert position
     * @param _nextId Id of next Trove for the new insert position
     */
    function reInsertBatch(BatchId _id, uint256 _newAnnualInterestRate, uint256 _prevId, uint256 _nextId)
        external
        override
    {
        Batch memory batch = batches[_id];

        _requireCallerIsBorrowerOperations();
        require(batch.head != UNINITIALIZED_ID, "SortedTroves: List does not contain the batch");

        _reInsertSlice(troveManager, batch.head, batch.tail, _newAnnualInterestRate, _prevId, _nextId);
    }

    /*
     * @dev Checks if the list contains a node
     */
    function contains(uint256 _id) public view override returns (bool) {
        return nodes[_id].exists;
    }

    /*
     * @dev Checks whether the node is part of a batch
     */
    function isBatchedNode(uint256 _id) public view override returns (bool) {
        return nodes[_id].batchId.isNotZero();
    }

    function isEmptyBatch(BatchId _id) external view override returns (bool) {
        return batches[_id].head == UNINITIALIZED_ID;
    }

    /*
     * @dev Checks if the list is empty
     */
    function isEmpty() external view override returns (bool) {
        return size == 0;
    }

    /*
     * @dev Returns the current size of the list
     */
    function getSize() external view override returns (uint256) {
        return size;
    }

    /*
     * @dev Returns the first node in the list (node with the largest annual interest rate)
     */
    function getFirst() external view override returns (uint256) {
        return nodes[ROOT_NODE_ID].nextId;
    }

    /*
     * @dev Returns the last node in the list (node with the smallest annual interest rate)
     */
    function getLast() external view override returns (uint256) {
        return nodes[ROOT_NODE_ID].prevId;
    }

    /*
     * @dev Returns the next node (with a smaller interest rate) in the list for a given node
     * @param _id Node's id
     */
    function getNext(uint256 _id) external view override returns (uint256) {
        return nodes[_id].nextId;
    }

    /*
     * @dev Returns the previous node (with a larger interest rate) in the list for a given node
     * @param _id Node's id
     */
    function getPrev(uint256 _id) external view override returns (uint256) {
        return nodes[_id].prevId;
    }

    /*
     * @dev Check if a pair of nodes is a valid insertion point for a new node with the given interest rate
     * @param _annualInterestRate Node's annual interest rate
     * @param _prevId Id of previous node for the insert position
     * @param _nextId Id of next node for the insert position
     */
    function validInsertPosition(uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId)
        external
        view
        override
        returns (bool)
    {
        return _validInsertPosition(troveManager, _annualInterestRate, _prevId, _nextId);
    }

    function _validInsertPosition(
        ITroveManager _troveManager,
        uint256 _annualInterestRate,
        uint256 _prevId,
        uint256 _nextId
    ) internal view returns (bool) {
        BatchId prevBatchId = nodes[_prevId].batchId;

        // `(_prevId, _nextId)` is a valid insert position if:
        return
        // they are adjacent nodes
        (
            nodes[_prevId].nextId == _nextId && nodes[_nextId].prevId == _prevId
            // they aren't part of the same batch
            && (prevBatchId != nodes[_nextId].batchId || prevBatchId.isZero())
            // `_annualInterestRate` falls between the two nodes' interest rates
            && (_prevId == ROOT_NODE_ID || _troveManager.getTroveAnnualInterestRate(_prevId) >= _annualInterestRate)
                && (_nextId == ROOT_NODE_ID || _annualInterestRate > _troveManager.getTroveAnnualInterestRate(_nextId))
        );
    }

    function _skipToBatchTail(uint256 _id) internal view returns (uint256) {
        BatchId batchId = nodes[_id].batchId;
        return batchId.isNotZero() ? batches[batchId].tail : _id;
    }

    function _skipToBatchHead(uint256 _id) internal view returns (uint256) {
        BatchId batchId = nodes[_id].batchId;
        return batchId.isNotZero() ? batches[batchId].head : _id;
    }

    function _descendOne(ITroveManager _troveManager, uint256 _annualInterestRate, Position memory _pos)
        internal
        view
        returns (bool found)
    {
        if (_pos.nextId == ROOT_NODE_ID || _annualInterestRate > _troveManager.getTroveAnnualInterestRate(_pos.nextId))
        {
            found = true;
        } else {
            _pos.prevId = _skipToBatchTail(_pos.nextId);
            _pos.nextId = nodes[_pos.prevId].nextId;
        }
    }

    function _ascendOne(ITroveManager _troveManager, uint256 _annualInterestRate, Position memory _pos)
        internal
        view
        returns (bool found)
    {
        if (_pos.prevId == ROOT_NODE_ID || _troveManager.getTroveAnnualInterestRate(_pos.prevId) >= _annualInterestRate)
        {
            found = true;
        } else {
            _pos.nextId = _skipToBatchHead(_pos.prevId);
            _pos.prevId = nodes[_pos.nextId].prevId;
        }
    }

    /*
     * @dev Descend the list (larger interest rates to smaller interest rates) to find a valid insert position
     * @param _troveManager TroveManager contract, passed in as param to save SLOAD’s
     * @param _annualInterestRate Node's annual interest rate
     * @param _startId Id of node to start descending the list from
     */
    function _descendList(ITroveManager _troveManager, uint256 _annualInterestRate, uint256 _startId)
        internal
        view
        returns (uint256, uint256)
    {
        Position memory pos = Position(_startId, nodes[_startId].nextId);

        while (!_descendOne(_troveManager, _annualInterestRate, pos)) {}
        return (pos.prevId, pos.nextId);
    }

    /*
     * @dev Ascend the list (smaller interest rates to larger interest rates) to find a valid insert position
     * @param _troveManager TroveManager contract, passed in as param to save SLOAD’s
     * @param _annualInterestRate Node's annual interest rate
     * @param _startId Id of node to start ascending the list from
     */
    function _ascendList(ITroveManager _troveManager, uint256 _annualInterestRate, uint256 _startId)
        internal
        view
        returns (uint256, uint256)
    {
        Position memory pos = Position(nodes[_startId].prevId, _startId);

        while (!_ascendOne(_troveManager, _annualInterestRate, pos)) {}
        return (pos.prevId, pos.nextId);
    }

    function _descendAndAscendList(
        ITroveManager _troveManager,
        uint256 _annualInterestRate,
        uint256 _descentStartId,
        uint256 _ascentStartId
    ) internal view returns (uint256 prevId, uint256 nextId) {
        Position memory descentPos = Position(_descentStartId, nodes[_descentStartId].nextId);
        Position memory ascentPos = Position(nodes[_ascentStartId].prevId, _ascentStartId);

        for (;;) {
            if (_descendOne(_troveManager, _annualInterestRate, descentPos)) {
                return (descentPos.prevId, descentPos.nextId);
            }

            if (_ascendOne(_troveManager, _annualInterestRate, ascentPos)) {
                return (ascentPos.prevId, ascentPos.nextId);
            }
        }

        assert(false); // Should not reach
    }

    /*
     * @dev Find the insert position for a new node with the given interest rate
     * @param _annualInterestRate Node's annual interest rate
     * @param _prevId Id of previous node for the insert position
     * @param _nextId Id of next node for the insert position
     */
    function findInsertPosition(uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId)
        external
        view
        override
        returns (uint256, uint256)
    {
        return _findInsertPosition(troveManager, _annualInterestRate, _prevId, _nextId);
    }

    // This function is optimized under the assumption that only one of the original neighbours has been (re)moved.
    // In other words, we assume that the correct position can be found close to one of the two.
    // Nevertheless, the function will always find the correct position, regardless of hints or interference.
    function _findInsertPosition(
        ITroveManager _troveManager,
        uint256 _annualInterestRate,
        uint256 _prevId,
        uint256 _nextId
    ) internal view returns (uint256, uint256) {
        if (_prevId == ROOT_NODE_ID) {
            // The original correct position was found before the head of the list.
            // Assuming minimal interference, the new correct position is still close to the head.
            return _descendList(_troveManager, _annualInterestRate, ROOT_NODE_ID);
        } else {
            if (!contains(_prevId) || _troveManager.getTroveAnnualInterestRate(_prevId) < _annualInterestRate) {
                // `prevId` does not exist anymore or now has a smaller interest rate than the given interest rate
                _prevId = BAD_HINT;
            }
        }

        if (_nextId == ROOT_NODE_ID) {
            // The original correct position was found after the tail of the list.
            // Assuming minimal interference, the new correct position is still close to the tail.
            return _ascendList(_troveManager, _annualInterestRate, ROOT_NODE_ID);
        } else {
            if (!contains(_nextId) || _annualInterestRate <= _troveManager.getTroveAnnualInterestRate(_nextId)) {
                // `nextId` does not exist anymore or now has a larger interest rate than the given interest rate
                _nextId = BAD_HINT;
            }
        }

        if (_prevId == BAD_HINT && _nextId == BAD_HINT) {
            // Both original neighbours have been moved or removed.
            // We default to descending the list, starting from the head.
            return _descendList(_troveManager, _annualInterestRate, ROOT_NODE_ID);
        } else if (_prevId == BAD_HINT) {
            // No `prevId` for hint - ascend list starting from `nextId`
            return _ascendList(_troveManager, _annualInterestRate, _skipToBatchHead(_nextId));
        } else if (_nextId == BAD_HINT) {
            // No `nextId` for hint - descend list starting from `prevId`
            return _descendList(_troveManager, _annualInterestRate, _skipToBatchTail(_prevId));
        } else {
            // The correct position is still somewhere between the 2 hints, so it's not obvious
            // which of the 2 has been moved (assuming only one of them has been).
            // We simultaneously descend & ascend in the hope that one of them is very close.
            return _descendAndAscendList(
                _troveManager, _annualInterestRate, _skipToBatchTail(_prevId), _skipToBatchHead(_nextId)
            );
        }
    }

    // --- 'require' functions ---

    function _requireCallerIsBOorTM() internal view {
        require(
            msg.sender == borrowerOperationsAddress || msg.sender == address(troveManager),
            "SortedTroves: Caller is not BorrowerOperations nor TroveManager"
        );
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(msg.sender == borrowerOperationsAddress, "SortedTroves: Caller is not BorrowerOperations");
    }
}
