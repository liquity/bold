// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ITroveManager.sol";
import {BatchId, BATCH_ID_ZERO} from "../Types/BatchId.sol";

interface ISortedTroves {
    // -- Mutating functions (permissioned) --
    function insert(uint256 _id, uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) external;
    function insertIntoBatch(
        uint256 _troveId,
        BatchId _batchId,
        uint256 _annualInterestRate,
        uint256 _prevId,
        uint256 _nextId
    ) external;

    function remove(uint256 _id) external;
    function removeFromBatch(uint256 _id) external;

    function reInsert(uint256 _id, uint256 _newAnnualInterestRate, uint256 _prevId, uint256 _nextId) external;
    function reInsertBatch(BatchId _id, uint256 _newAnnualInterestRate, uint256 _prevId, uint256 _nextId) external;

    // -- View functions --

    function contains(uint256 _id) external view returns (bool);
    function isBatchedNode(uint256 _id) external view returns (bool);
    function isEmptyBatch(BatchId _id) external view returns (bool);

    function isEmpty() external view returns (bool);
    function getSize() external view returns (uint256);

    function getFirst() external view returns (uint256);
    function getLast() external view returns (uint256);
    function getNext(uint256 _id) external view returns (uint256);
    function getPrev(uint256 _id) external view returns (uint256);

    function validInsertPosition(uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId)
        external
        view
        returns (bool);
    function findInsertPosition(uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId)
        external
        view
        returns (uint256, uint256);

    // Public state variable getters
    function borrowerOperationsAddress() external view returns (address);
    function troveManager() external view returns (ITroveManager);
    function size() external view returns (uint256);
    function nodes(uint256 _id) external view returns (uint256 nextId, uint256 prevId, BatchId batchId, bool exists);
    function batches(BatchId _id) external view returns (uint256 head, uint256 tail);
}
