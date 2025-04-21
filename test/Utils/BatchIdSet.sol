// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {BatchId} from "src/Types/BatchId.sol";

using BatchIdSetMethods for BatchIdSet global;

struct BatchIdSet {
    mapping(BatchId => bool) _has;
    BatchId[] _batchIds;
}

library BatchIdSetMethods {
    function add(BatchIdSet storage set, BatchId batchId) internal {
        if (!set._has[batchId]) {
            set._has[batchId] = true;
            set._batchIds.push(batchId);
        }
    }

    function clear(BatchIdSet storage set) internal {
        for (uint256 i = 0; i < set._batchIds.length; ++i) {
            delete set._has[set._batchIds[i]];
        }
        delete set._batchIds;
    }

    function has(BatchIdSet storage set, BatchId batchId) internal view returns (bool) {
        return set._has[batchId];
    }
}
