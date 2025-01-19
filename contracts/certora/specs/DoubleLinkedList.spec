import "SortedTrovesStorage.spec";

/// Latest run link:
/// https://prover.certora.com/output/41958/009427beee184e47840c5aa6fbaa516a/?anonymousKey=fbf0cb14dffccc7b43ef6673ccd9a97442e3b9f2

methods {
    function SortedTroves.size() external returns (uint256) envfree;
    function _.getTroveAnnualInterestRate(uint256 _troveId) external => TroveAIR(_troveId) expect uint256;
    /// Constant addresses for the addressesRegistry - required to handle constructor.
    function _.troveManager() external => troveManagerGhost() expect address;
    function _.borrowerOperations() external => borrowerOperationsGhost() expect address;
}

persistent ghost troveManagerGhost() returns address;
persistent ghost borrowerOperationsGhost() returns address;

/*
Track count of exisiting nodes:
*/
ghost mapping(uint256 => bool) didAccessNode;

/// Require at the header of every rule / invariant preserved block in order to take effect.
function SumTrackingSetup() {
    require sumOfExistingNodes == sumOfExistingNodes_init;
    require forall uint256 ID. !didAccessNode[ID];
}

/*
BEGINNING OF Sload HOOKS
*/

hook Sload uint256 value SortedTroves.nodes[KEY uint256 ID].nextId {
    require nextNode[ID] == value;
}

hook Sload uint256 value SortedTroves.nodes[KEY uint256 ID].prevId {
    require prevNode[ID] == value;
}

hook Sload bool Exists SortedTroves.nodes[KEY uint256 ID].exists {
    require nodeExists[ID] == Exists;
    /// Retroactively constrain initial sum
    if(!didAccessNode[ID]) {
        didAccessNode[ID] = true;
        /// Only counts if exists!
        sumOfExistingNodes_init = Exists ? (sumOfExistingNodes_init - 1) : sumOfExistingNodes_init;
        require sumOfExistingNodes_init >= 0;
    }
}

hook Sload SortedTroves.BatchId value SortedTroves.nodes[KEY uint256 ID].batchId {
    require nodeBatchId[ID] == value;
}

hook Sload uint256 value SortedTroves.batches[KEY SortedTroves.BatchId batchID].head {
    require batchHead[batchID] == value;
}

hook Sload uint256 value SortedTroves.batches[KEY SortedTroves.BatchId batchID].tail {
    require batchTail[batchID] == value;
}
/*
END OF Sload HOOKS
*/

/*
BEGINNING OF Sstore HOOKS
*/

hook Sstore SortedTroves.nodes[KEY uint256 ID].nextId uint256 value (uint256 value_old) {
    require nextNode[ID] == value_old;
    nextNode[ID] = value;
}

hook Sstore SortedTroves.nodes[KEY uint256 ID].prevId uint256 value (uint256 value_old) {
    require prevNode[ID] == value_old;
    prevNode[ID] = value;
}

hook Sstore SortedTroves.nodes[KEY uint256 ID].exists bool Exists (bool Exists_old) {
    require nodeExists[ID] == Exists_old;
    nodeExists[ID] = Exists;
    /// Retroactively constrain initial sum
    if(!didAccessNode[ID]) {
        didAccessNode[ID] = true;
        /// Only counts if exists!
        sumOfExistingNodes_init = Exists_old ? (sumOfExistingNodes_init - 1) : sumOfExistingNodes_init;
        require sumOfExistingNodes_init >= 0;
    }

    /// Track change of condition 'exists' (true <-> false)
    if(Exists && !Exists_old) {
        sumOfExistingNodes = sumOfExistingNodes + 1;
    } else if(!Exists && Exists_old) {
        sumOfExistingNodes = sumOfExistingNodes - 1;
    }
}

hook Sstore SortedTroves.nodes[KEY uint256 ID].batchId SortedTroves.BatchId value (SortedTroves.BatchId value_old) {
    require nodeBatchId[ID] == value_old;
    nodeBatchId[ID] = value;
}

hook Sstore SortedTroves.batches[KEY SortedTroves.BatchId batchID].head uint256 value (uint256 value_old) {
    require batchHead[batchID] == value_old;
    batchHead[batchID] = value;
}

hook Sstore SortedTroves.batches[KEY SortedTroves.BatchId batchID].tail uint256 value (uint256 value_old) {
    require batchTail[batchID] == value_old;
    batchTail[batchID] = value;
}

/*
END OF Sstore HOOKS
*/

definition nodeBatchTail(uint256 ID) returns uint256 = nodeBatchId[ID] !=0 ? batchTail[nodeBatchId[ID]] : ID;

definition nodeBatchHead(uint256 ID) returns uint256 = nodeBatchId[ID] !=0 ? batchHead[nodeBatchId[ID]] : ID;

definition batchExists(address batchID) returns bool = batchHead[batchID] != 0 && batchID !=0;

definition nodeInBatch(address batchID, uint256 ID) returns bool = nodeBatchId[ID] == batchID && nodeExists[ID];

definition innerBatchNode(address batchID, uint256 ID) returns bool = ID != batchHead[batchID] && ID != batchTail[batchID];

definition headTailInBatch(address batchID) returns bool = nodeInBatch(batchID, batchHead[batchID]) && nodeInBatch(batchID, batchTail[batchID]);

definition neighborsInBatch(address batchID, uint256 ID) returns bool = 
    nodeInBatch(batchID, ID) => (
        (ID == batchHead[batchID] && !nodeInBatch(batchID, prevNode[ID]))
        ||
        (ID == batchTail[batchID] && !nodeInBatch(batchID, nextNode[ID]))
        ||
        (innerBatchNode(batchID, ID) && nodeInBatch(batchID, nextNode[ID]) && nodeInBatch(batchID, prevNode[ID]))
    );

definition neighborsNotInBatch(address batchID, uint256 ID) returns bool = 
    !nodeInBatch(batchID, ID) => (
        (!nodeInBatch(batchID, prevNode[ID]) && nextNode[ID] == batchHead[batchID])
        ||
        (!nodeInBatch(batchID, nextNode[ID]) && prevNode[ID] == batchTail[batchID])
        ||
        (!nodeInBatch(batchID, nextNode[ID]) && !nodeInBatch(batchID, prevNode[ID]))
    );

definition batchClosure(address batchID, uint256 ID) returns bool = 
    (batchExists(batchID) =>
        (
            headTailInBatch(batchID) 
            &&
            neighborsInBatch(batchID, ID) 
            && 
            neighborsNotInBatch(batchID, ID)
        )
    ) && 
    (!batchExists(batchID) =>
        (
            !headTailInBatch(batchID) 
            &&
            neighborsNotInBatch(batchID, ID)
        )
    );

/// @title If every neighbor points back to the origin (in the reverse direction), then there are no non-zero duplicate pointers.
// PASSING
rule trivial_chain_rule(uint256 ID1, uint256 ID2) {
    require forall uint256 ID.
    (nextNode[ID] == 0 || prevNode[nextNode[ID]] == ID);
    require forall uint256 ID.
    (prevNode[ID] == 0 || nextNode[prevNode[ID]] == ID);

    assert (nextNode[ID1] == nextNode[ID2] => (ID1 == ID2 || nextNode[ID1] == 0));
    assert (prevNode[ID1] == prevNode[ID2] => (ID1 == ID2 || prevNode[ID1] == 0));
}

/// rule version of the chainIntegrity invariant for better diagnosability. 
rule chainIntegrity_rule(uint256 ID, method f) filtered{f -> !f.isView}
{
    /// Preserved block
    requireInvariant BatchIntegrity();
    requireInvariant ChainIntegrity();
    requireInvariant HeadTailInvariant();
    require forall uint256 id_. ListIsAIRSorted(id_);

    /// See trivial_chain_rule
    require forall uint256 ID1.
        (nextNode[ID1] == nextNode[ID] => (ID1 == ID || nextNode[ID1] == 0)) 
        &&
        (prevNode[ID1] == prevNode[ID] => (ID1 == ID || prevNode[ID1] == 0));

    /// We directly assume that there are no neighboring nodes outside the batch with the same batch ID.
    require nodeBatchId[prevNode[nodeBatchHead(ID)]] != nodeBatchId[ID];
    require nodeBatchId[nextNode[nodeBatchTail(ID)]] != nodeBatchId[ID];
    require nodeBatchId[prevNode[prevNode[nodeBatchHead(ID)]]] != nodeBatchId[ID];
    require nodeBatchId[nextNode[nextNode[nodeBatchTail(ID)]]] != nodeBatchId[ID];

    env e;
    calldataarg args;
    f(e,args);

    assert chainIntegrity(ID);
}

/// @title Batch troves closure in list
invariant BatchClosure(address batchID) forall uint256 ID.
    batchClosure(batchID, ID)
    {
        preserved with (env e) {
            requireInvariant ChainIntegrity();
            requireInvariant BatchIntegrity();
            requireInvariant HeadTailInvariant();
        }
    }

/// @title For any batch, the batch head and tail are unique.
// PASSING, though the required invariants are not proved
invariant BatchHeadTailsAreUnique()
    forall address batchID1. forall address batchID2.
        batchHead[batchID1] == batchHead[batchID2] =>
            batchID1 == batchID2 || batchHead[batchID1] == 0
        &&
        batchTail[batchID1] == batchTail[batchID2] =>
            batchID1 == batchID2 || batchTail[batchID1] == 0
    {
        preserved with (env e) {
            requireInvariant ChainIntegrity();
            requireInvariant BatchIntegrity();
            requireInvariant HeadTailInvariant();
        }
    }

/// @title: Integrity of the linked list
invariant ChainIntegrity() forall uint256 ID. 
    chainIntegrity(ID)
    {
        preserved with (env e) {
            /// Assumption: the linked list is already sorted by descending order of AIR.
            require forall uint256 id_. ListIsAIRSorted(id_);
            requireInvariant BatchIntegrity();
            requireInvariant HeadTailInvariant();
            require forall uint256 ID. batchClosure(nodeBatchId[ID], ID);
        }
    }

/// @title Correctness of head and tail state
// PASSING, though the required invariants are not proved
invariant HeadTailInvariant() headTailInvariant()
    {
        preserved with (env e) {
            requireInvariant BatchIntegrity();
            // This assumption not proved:
            requireInvariant ChainIntegrity();
        }
    }

/// @title Batch correctness invariant
invariant BatchIntegrity() forall address batchID. 
    batchIntegrity(batchID)
    {
        preserved with (env e) {
            requireInvariant HeadTailInvariant();
            require forall address batchID. batchClosure(batchID, batchTail[batchID]);
            require forall address batchID. batchClosure(batchID, batchHead[batchID]);
            requireInvariant ChainIntegrity();
        }
    }

/// sub-invariant of the correct states of the head and tail of the list.
definition headTailInvariant() returns bool = 
/// HEAD() next points to non-zero and previous to zero.
    (HEAD() != TAIL() => prevNode[HEAD()] == 0 && nextNode[HEAD()] != 0) &&
/// TAIL() previous points to non-zero and next to zero.
    (HEAD() != TAIL() => prevNode[TAIL()] != 0 && nextNode[TAIL()] == 0) &&
/// For a single node list - both HEAD() and TAIL() are linked to zero.
    (HEAD() == TAIL() => nextNode[HEAD()] == 0 && prevNode[TAIL()] == 0) &&
/// TAIL() and HEAD() exist.
    (TAIL() !=0 <=> nodeExists[TAIL()]) && 
    (HEAD() !=0 <=> nodeExists[HEAD()]) &&
/// TAIL() and HEAD() must be defined at the same time.
    (HEAD() == 0 <=> TAIL() == 0) &&
/// Zero node and zero batch connectivity.
    (batchHead[0] == 0 && batchTail[0] == 0 && nodeBatchId[0] == 0 && !nodeExists[0]);

/// sub-invariant of the correct state of any individual node.
definition chainIntegrity(uint256 ID) returns bool =
/// previous of next points back, or next points to zero.
    (nextNode[ID] == 0 || prevNode[nextNode[ID]] == ID) &&
/// next of previous points back, or previous points to zero.
    (prevNode[ID] == 0 || nextNode[prevNode[ID]] == ID) &&
/// For an inner node, its previous node points to 0 iff its next node points to zero.
    ( (HEAD() != ID && ID != TAIL()) => (prevNode[ID] == 0 <=> nextNode[ID] == 0)) &&
/// If a node doesn't exist, then it's either the zero node or both neighbors are zero.
    (!nodeExists[ID] && ID !=0 => nextNode[ID] == 0 && prevNode[ID] == 0) &&
/// If a node exists, then at least one of its neighbors must be nonzero.
    (nodeExists[ID] => (nextNode[ID] != 0 || prevNode[ID] != 0));
/// (HEAD() == TAIL() && ID !=0 => nextNode[ID] == 0 <=> prevNode[ID] == 0);

/// sub-invariant of the correct state of any batch.
definition batchIntegrity(address batchID) returns bool = 
    batchID !=0 =>
/// Batch head exists iff batch tail exists
    (batchHead[batchID] !=0 <=> batchTail[batchID] !=0) &&
/// Batch head exists if the node exists
    (batchHead[batchID] !=0 <=> nodeExists[batchHead[batchID]]) &&
/// Batch tail exists if the node exists
    (batchTail[batchID] !=0 <=> nodeExists[batchTail[batchID]]) &&
/// If the node exists then the batch id of the head points to itself
    (nodeExists[batchHead[batchID]] => nodeBatchId[batchHead[batchID]] == batchID) &&
/// If the node exists then the batch id of the tail points to itself
    (nodeExists[batchTail[batchID]] => nodeBatchId[batchTail[batchID]] == batchID);

/// Any two nodes who belong to the same batch have the same AIR value.
definition BatchIsoAIR(uint256 ID1, uint256 ID2) returns bool = 
    (nodeBatchId[ID1] == nodeBatchId[ID2]) => 
        (TroveAIR(ID1) == TroveAIR(ID2) || nodeBatchId[ID1] == 0);

/// For any node in a batch, its AIR must equal to the AIR of the head and the tail.
definition batchEqualAIR(address batchID, uint256 ID) returns bool = 
    nodeInBatch(batchID, ID) =>
        TroveAIR(ID) == TroveAIR(batchHead[batchID]) && TroveAIR(ID) == TroveAIR(batchTail[batchID]);

/// For any node which belongs to a batch, its neighboring nodes must also have the same AIR value.
definition EqualAIRBatchNeighbors(uint256 ID) returns bool = 
    ID !=0 => BatchIsoAIR(ID, nextNode[ID]) && BatchIsoAIR(ID, prevNode[ID]);

/// The head and tail of any batch have the same AIR value.
definition BatchHeadTailAIR(address batchID) returns bool = 
    TroveAIR(batchHead[batchID]) == TroveAIR(batchTail[batchID]);

/// The node list is sorted based on decreasing AIR value.
definition ListIsAIRSorted(uint256 ID) returns bool = 
    (ID != ROOT_ID() && nextNode[ID] != ROOT_ID()) => TroveAIR(ID) >= TroveAIR(nextNode[ID]) &&
    (ID != ROOT_ID() && prevNode[ID] != ROOT_ID()) => TroveAIR(ID) <= TroveAIR(prevNode[ID]) &&
    nodeExists[ID] => TroveAIR(ID) !=0;