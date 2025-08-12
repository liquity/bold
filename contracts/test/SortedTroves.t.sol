// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "src/SortedTroves.sol";
import "src/AddressesRegistry.sol";
import "src/Types/TroveId.sol";

uint256 constant FUZZ_INPUT_LENGTH = 9;

struct Hints {
    TroveId prev;
    TroveId next;
}

contract MockTroveManager {
    struct Trove {
        uint256 arrayIndex;
        uint256 annualInterestRate;
        BatchId batchId;
    }

    struct Batch {
        uint256 annualInterestRate;
    }

    mapping(TroveId => Trove) private _troves;
    mapping(BatchId => Batch) private _batches;

    TroveId[] private _troveIds;
    BatchId[] private _batchIds;

    uint256 public _nextTroveId = 1;
    uint160 public _nextBatchId = 1;

    SortedTroves private _sortedTroves;

    constructor(SortedTroves sortedTroves) {
        _sortedTroves = sortedTroves;
    }

    ///
    /// Partial implementation of TroveManager interface
    /// Just the parts needed by SortedTroves
    ///

    function getTroveCount() external view returns (uint256) {
        return _troveIds.length;
    }

    function getTroveId(uint256 i) external view returns (TroveId) {
        return _troveIds[i];
    }

    function getTroveAnnualInterestRate(TroveId troveId) public view returns (uint256) {
        return _troves[troveId].batchId.isZero()
            ? _troves[troveId].annualInterestRate
            : _batches[_troves[troveId].batchId].annualInterestRate;
    }

    ///
    /// Mock-only functions
    ///

    function _allocateTroveId() internal returns (TroveId id) {
        _troveIds.push(id = TroveId.wrap(_nextTroveId++));
    }

    function _allocateBatchId() internal returns (BatchId id) {
        _batchIds.push(id = BatchId.wrap(address(_nextBatchId++)));
    }

    function _addIndividualTrove(uint256 annualInterestRate) external returns (TroveId id) {
        _troves[id = _allocateTroveId()] = Trove(_troveIds.length, annualInterestRate, BATCH_ID_ZERO);
    }

    function _addBatchedTrove(BatchId batchId) external returns (TroveId id) {
        _troves[id = _allocateTroveId()] = Trove(_troveIds.length, 0, batchId);
    }

    function _addBatch(uint256 annualInterestRate) external returns (BatchId id) {
        _batches[id = _allocateBatchId()] = Batch(annualInterestRate);
    }

    function _setTroveInterestRate(TroveId id, uint256 newAnnualInterestRate) external {
        _troves[id].annualInterestRate = newAnnualInterestRate;
    }

    function _setBatchInterestRate(BatchId id, uint256 newAnnualInterestRate) external {
        _batches[id].annualInterestRate = newAnnualInterestRate;
    }

    function _removeTrove(TroveId id) external {
        TroveId poppedId = _troveIds[_troveIds.length - 1];
        _troveIds.pop();

        if (poppedId != id) {
            uint256 removedTroveArrayIndex = _troves[id].arrayIndex;
            _troveIds[removedTroveArrayIndex] = poppedId;
            _troves[poppedId].arrayIndex = removedTroveArrayIndex;
        }

        delete _troves[id];
    }

    function _getBatchCount() external view returns (uint256) {
        return _batchIds.length;
    }

    function _getBatchId(uint256 i) external view returns (BatchId) {
        return _batchIds[i];
    }

    function _getBatchOf(TroveId id) external view returns (BatchId batchId) {
        return _troves[id].batchId;
    }

    ///
    /// Wrappers around SortedTroves
    /// Needed because only TroveManager has permissions to perform every operation
    ///

    function _sortedTroves_getFirst() external view returns (TroveId) {
        return TroveId.wrap(_sortedTroves.getFirst());
    }

    function _sortedTroves_getLast() external view returns (TroveId) {
        return TroveId.wrap(_sortedTroves.getLast());
    }

    function _sortedTroves_getNext(TroveId id) external view returns (TroveId) {
        return TroveId.wrap(_sortedTroves.getNext(TroveId.unwrap(id)));
    }

    function _sortedTroves_getPrev(TroveId id) external view returns (TroveId) {
        return TroveId.wrap(_sortedTroves.getPrev(TroveId.unwrap(id)));
    }

    function _sortedTroves_getBatchHead(BatchId id) external view returns (TroveId) {
        (uint256 head,) = _sortedTroves.batches(id);
        return TroveId.wrap(head);
    }

    function _sortedTroves_getBatchTail(BatchId id) external view returns (TroveId) {
        (, uint256 tail) = _sortedTroves.batches(id);
        return TroveId.wrap(tail);
    }

    function _sortedTroves_getSize() external view returns (uint256) {
        return _sortedTroves.getSize();
    }

    function _sortedTroves_insert(TroveId id, uint256 annualInterestRate, Hints memory hints) external {
        // console.log();
        // console.log("Insertion");
        // console.log("  id                ", TroveId.unwrap(id));
        // console.log("  annualInterestRate", annualInterestRate);
        // console.log("  prevId            ", TroveId.unwrap(hints.prev));
        // console.log("  nextId            ", TroveId.unwrap(hints.next));

        _sortedTroves.insert(
            TroveId.unwrap(id), annualInterestRate, TroveId.unwrap(hints.prev), TroveId.unwrap(hints.next)
        );
    }

    function _sortedTroves_reInsert(TroveId id, uint256 newAnnualInterestRate, Hints memory hints) external {
        // console.log();
        // console.log("Re-insertion");
        // console.log("  id                ", TroveId.unwrap(id));
        // console.log("  annualInterestRate", newAnnualInterestRate);
        // console.log("  prevId            ", TroveId.unwrap(hints.prev));
        // console.log("  nextId            ", TroveId.unwrap(hints.next));

        _sortedTroves.reInsert(
            TroveId.unwrap(id), newAnnualInterestRate, TroveId.unwrap(hints.prev), TroveId.unwrap(hints.next)
        );
    }

    function _sortedTroves_remove(TroveId id) external {
        _sortedTroves.remove(TroveId.unwrap(id));
    }

    function _sortedTroves_insertIntoBatch(
        TroveId troveId,
        BatchId batchId,
        uint256 annualInterestRate,
        Hints memory hints
    ) external {
        _sortedTroves.insertIntoBatch(
            TroveId.unwrap(troveId), batchId, annualInterestRate, TroveId.unwrap(hints.prev), TroveId.unwrap(hints.next)
        );
    }

    function _sortedTroves_reInsertBatch(BatchId batchId, uint256 newAnnualInterestRate, Hints memory hints) external {
        _sortedTroves.reInsertBatch(
            batchId, newAnnualInterestRate, TroveId.unwrap(hints.prev), TroveId.unwrap(hints.next)
        );
    }

    function _sortedTroves_removeFromBatch(TroveId id) external {
        _sortedTroves.removeFromBatch(TroveId.unwrap(id));
    }

    function _sortedTroves_findInsertPosition(uint256 annualInterestRate, Hints memory hints)
        external
        view
        returns (Hints memory)
    {
        (uint256 prev, uint256 next) =
            _sortedTroves.findInsertPosition(annualInterestRate, TroveId.unwrap(hints.prev), TroveId.unwrap(hints.next));

        return Hints(TroveId.wrap(prev), TroveId.wrap(next));
    }

    function _sortedTroves_validInsertPosition(uint256 annualInterestRate, Hints memory hints)
        external
        view
        returns (bool)
    {
        return _sortedTroves.validInsertPosition(
            annualInterestRate, TroveId.unwrap(hints.prev), TroveId.unwrap(hints.next)
        );
    }
}

contract BatchIdSet {
    mapping(BatchId => bool) public has;

    function add(BatchId id) external {
        has[id] = true;
    }
}

contract SortedTrovesTest is Test {
    enum ArbRole {
        Individual,
        BatchStarter,
        BatchJoiner
    }

    struct ArbHints {
        uint256 prev;
        uint256 next;
    }

    struct ArbIndividualTroveCreation {
        uint256 annualInterestRate;
        ArbHints hints;
    }

    struct ArbBatchedTroveCreation {
        uint256 annualInterestRate;
        ArbHints hints;
        uint256 role;
        uint256 batch;
    }

    struct ArbReInsertion {
        uint256 trove;
        uint256 newAnnualInterestRate;
        ArbHints hints;
    }

    MockTroveManager tm;

    ///
    /// Bounding fuzzy inputs
    ///

    function _pickHint(uint256 troveCount, uint256 i) internal view returns (TroveId) {
        i = bound(i, 0, troveCount * 2 + 1);

        if (i == 0) {
            return TROVE_ID_ZERO;
        } else if (i <= troveCount) {
            return tm.getTroveId(i - 1);
        } else if (i <= troveCount * 2) {
            return TroveId.wrap(tm._nextTroveId() + i - 1 - troveCount); // cheekily generate invalid IDs
        } else {
            return TROVE_ID_END_OF_LIST; // head or tail can be a valid position, too
        }
    }

    function _pickHints(ArbHints calldata hints) internal view returns (Hints memory) {
        uint256 troveCount = tm.getTroveCount();
        return Hints(_pickHint(troveCount, hints.prev), _pickHint(troveCount, hints.next));
    }

    function _pickTrove(uint256 trove) internal view returns (TroveId) {
        return tm.getTroveId(bound(trove, 0, tm.getTroveCount() - 1));
    }

    function _pickBatch(uint256 batch) internal view returns (BatchId) {
        return tm._getBatchId(bound(batch, 0, tm._getBatchCount() - 1));
    }

    function _pickRole(uint256 role) internal pure returns (ArbRole) {
        return ArbRole(bound(role, uint256(type(ArbRole).min), uint256(type(ArbRole).max)));
    }

    ///
    /// Custom assertions
    ///

    function assertEq(TroveId a, TroveId b, string memory err) internal pure {
        assertEq(TroveId.unwrap(a), TroveId.unwrap(b), err);
    }

    function assertNe(TroveId a, TroveId b, string memory err) internal pure {
        assertTrue(a != b, err);
    }

    ///
    /// Invariant checks
    ///

    function _checkOrdering() internal view {
        uint256 i = 0;
        uint256 troveCount = tm.getTroveCount();
        TroveId[] memory troveIds = new TroveId[](troveCount);
        TroveId curr = tm._sortedTroves_getFirst();

        if (curr.isEndOfList()) {
            assertEq(tm.getTroveCount(), 0, "SortedTroves forward node count doesn't match TroveManager");

            assertEq(
                tm._sortedTroves_getLast(),
                TROVE_ID_END_OF_LIST,
                "SortedTroves reverse node count doesn't match TroveManager"
            );

            // empty list is ordered by definition
            return;
        }

        troveIds[i++] = curr;
        uint256 prevAnnualInterestRate = tm.getTroveAnnualInterestRate(curr);
        console.log();
        console.log("Forward list:");
        console.log("  Trove", TroveId.unwrap(curr), "annualInterestRate", prevAnnualInterestRate);
        curr = tm._sortedTroves_getNext(curr);

        while (curr.isNotEndOfList()) {
            uint256 currAnnualInterestRate = tm.getTroveAnnualInterestRate(curr);
            console.log("  Trove", TroveId.unwrap(curr), "annualInterestRate", currAnnualInterestRate);
            assertLe(currAnnualInterestRate, prevAnnualInterestRate, "SortedTroves ordering is broken");

            troveIds[i++] = curr;
            prevAnnualInterestRate = currAnnualInterestRate;
            curr = tm._sortedTroves_getNext(curr);
        }

        assertEq(i, tm.getTroveCount(), "SortedTroves forward node count doesn't match TroveManager");

        // Verify reverse ordering
        console.log();
        console.log("Reverse list:");
        curr = tm._sortedTroves_getLast();

        while (i > 0) {
            console.log("  Trove", TroveId.unwrap(curr));
            assertNe(curr, TROVE_ID_END_OF_LIST, "SortedTroves reverse node count doesn't match TroveManager");
            assertEq(curr, troveIds[--i], "SortedTroves reverse ordering is broken");
            curr = tm._sortedTroves_getPrev(curr);
        }

        console.log();
        assertEq(curr, TROVE_ID_END_OF_LIST, "SortedTroves reverse node count doesn't match TroveManager");
    }

    function _checkBatchContiguity() internal {
        BatchIdSet seenBatches = new BatchIdSet();
        TroveId prev = tm._sortedTroves_getFirst();

        if (prev.isEndOfList()) {
            return;
        }

        BatchId prevBatch = tm._getBatchOf(prev);
        console.log("Batch IDs:");
        console.log("  ", BatchId.unwrap(prevBatch));

        if (prevBatch.isNotZero()) {
            assertEq(prev, tm._sortedTroves_getBatchHead(prevBatch), "Wrong batch head");
        }

        TroveId curr = tm._sortedTroves_getNext(prev);
        BatchId currBatch = tm._getBatchOf(curr);

        while (curr.isNotEndOfList()) {
            console.log("  ", BatchId.unwrap(currBatch));

            if (currBatch != prevBatch) {
                if (prevBatch.isNotZero()) {
                    assertFalse(seenBatches.has(prevBatch), "Batch already seen");
                    seenBatches.add(prevBatch);
                    assertEq(prev, tm._sortedTroves_getBatchTail(prevBatch), "Wrong batch tail");
                }

                if (currBatch.isNotZero()) {
                    assertEq(curr, tm._sortedTroves_getBatchHead(currBatch), "Wrong batch head");
                }
            }

            prev = curr;
            prevBatch = currBatch;

            curr = tm._sortedTroves_getNext(prev);
            currBatch = tm._getBatchOf(curr);
        }

        if (prevBatch.isNotZero()) {
            assertFalse(seenBatches.has(prevBatch), "Batch already seen");
            assertEq(prev, tm._sortedTroves_getBatchTail(prevBatch), "Wrong batch tail");
        }

        console.log();
    }

    ///
    /// Helpers for test case setup
    ///

    function _buildList(ArbIndividualTroveCreation[FUZZ_INPUT_LENGTH] calldata troves) internal {
        for (uint256 i = 0; i < troves.length; ++i) {
            tm._sortedTroves_insert(
                tm._addIndividualTrove(troves[i].annualInterestRate),
                troves[i].annualInterestRate,
                _pickHints(troves[i].hints)
            );
        }
    }

    function _buildBatchedList(ArbBatchedTroveCreation[FUZZ_INPUT_LENGTH] calldata troves) internal {
        for (uint256 i = 0; i < troves.length; ++i) {
            ArbRole role = _pickRole(troves[i].role);

            if (role == ArbRole.BatchJoiner && tm._getBatchCount() == 0) {
                // No batches to join yet; promote to batch starter
                role = ArbRole.BatchStarter;
            }

            if (role == ArbRole.Individual) {
                tm._sortedTroves_insert(
                    tm._addIndividualTrove(troves[i].annualInterestRate),
                    troves[i].annualInterestRate,
                    _pickHints(troves[i].hints)
                );
            } else if (role == ArbRole.BatchStarter) {
                BatchId batchId = tm._addBatch(troves[i].annualInterestRate);
                tm._sortedTroves_insertIntoBatch(
                    tm._addBatchedTrove(batchId), batchId, troves[i].annualInterestRate, _pickHints(troves[i].hints)
                );
            } else if (role == ArbRole.BatchJoiner) {
                BatchId batchId = _pickBatch(troves[i].batch);
                TroveId troveId = tm._addBatchedTrove(batchId);
                tm._sortedTroves_insertIntoBatch(
                    troveId, batchId, tm.getTroveAnnualInterestRate(troveId), _pickHints(troves[i].hints)
                );
            } else {
                revert("Role not considered");
            }
        }
    }

    ////////////////
    // Test cases //
    ////////////////

    function setUp() public {
        bytes32 SALT = keccak256("LiquityV2");
        AddressesRegistry addressesRegistry =
            new AddressesRegistry(address(this), 150e16, 110e16, 10e16, 110e16, 10_000_000e18, 5e16, 10e16);
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                SALT,
                keccak256(abi.encodePacked(type(SortedTroves).creationCode, abi.encode(address(addressesRegistry))))
            )
        );

        address sortedTrovesAddress = address(uint160(uint256(hash)));
        tm = new MockTroveManager(SortedTroves(sortedTrovesAddress));
        // We're cheating here and using MockTroveManager as BorrowerOperations too,
        // to grant us access to those functions that only BO can call
        IAddressesRegistry.AddressVars memory addressVars;
        addressVars.borrowerOperations = IBorrowerOperations(address(tm));
        addressVars.troveManager = ITroveManager(address(tm));
        addressesRegistry.setAddresses(addressVars);
        new SortedTroves{salt: SALT}(addressesRegistry);
    }

    function test_SortsIndividualTrovesByAnnualInterestRate(
        ArbIndividualTroveCreation[FUZZ_INPUT_LENGTH] calldata troves
    ) public {
        _buildList(troves);
        _checkOrdering();
    }

    function test_SortsBatchedTrovesByAnnualInterestRate(ArbBatchedTroveCreation[FUZZ_INPUT_LENGTH] calldata troves)
        public
    {
        _buildBatchedList(troves);
        _checkOrdering();
        _checkBatchContiguity();
    }

    function test_FindsValidInsertPosition(
        ArbBatchedTroveCreation[FUZZ_INPUT_LENGTH] calldata troves,
        ArbIndividualTroveCreation calldata inserted
    ) public {
        _buildBatchedList(troves);

        assertTrue(
            tm._sortedTroves_validInsertPosition(
                inserted.annualInterestRate,
                tm._sortedTroves_findInsertPosition(inserted.annualInterestRate, _pickHints(inserted.hints))
            ),
            "Invalid insert position found"
        );
    }

    function test_CanRemoveIndividualTroves(
        ArbIndividualTroveCreation[FUZZ_INPUT_LENGTH] calldata troves,
        uint256[FUZZ_INPUT_LENGTH] calldata removedTroves,
        uint256 numTrovesToRemove
    ) public {
        numTrovesToRemove = bound(numTrovesToRemove, 1, troves.length);

        _buildList(troves);
        assertEq(tm._sortedTroves_getSize(), troves.length);

        for (uint256 i = 0; i < numTrovesToRemove; ++i) {
            TroveId id = _pickTrove(removedTroves[i]);
            tm._removeTrove(id);
            tm._sortedTroves_remove(id);
        }

        assertEq(tm._sortedTroves_getSize(), troves.length - numTrovesToRemove);
        _checkOrdering();
    }

    function test_CanRemoveBatchedTroves(
        ArbBatchedTroveCreation[FUZZ_INPUT_LENGTH] calldata troves,
        uint256[FUZZ_INPUT_LENGTH] calldata removedTroves,
        uint256 numTrovesToRemove
    ) public {
        numTrovesToRemove = bound(numTrovesToRemove, 1, troves.length);

        _buildBatchedList(troves);
        assertEq(tm._sortedTroves_getSize(), troves.length);

        for (uint256 i = 0; i < numTrovesToRemove; ++i) {
            TroveId id = _pickTrove(removedTroves[i]);
            bool batchedTrove = tm._getBatchOf(id).isNotZero();
            tm._removeTrove(id);

            if (batchedTrove) {
                tm._sortedTroves_removeFromBatch(id);
            } else {
                tm._sortedTroves_remove(id);
            }
        }

        assertEq(tm._sortedTroves_getSize(), troves.length - numTrovesToRemove);
        _checkOrdering();
        _checkBatchContiguity();
    }

    function test_CanReInsert(
        ArbBatchedTroveCreation[FUZZ_INPUT_LENGTH] calldata troves,
        ArbReInsertion[FUZZ_INPUT_LENGTH] calldata reInsertions
    ) public {
        _buildBatchedList(troves);

        for (uint256 i = 0; i < reInsertions.length; ++i) {
            TroveId troveId = _pickTrove(reInsertions[i].trove);
            BatchId batchId = tm._getBatchOf(troveId);

            if (batchId.isNotZero()) {
                tm._sortedTroves_reInsertBatch(
                    batchId, reInsertions[i].newAnnualInterestRate, _pickHints(reInsertions[i].hints)
                );
                tm._setBatchInterestRate(batchId, reInsertions[i].newAnnualInterestRate);
            } else {
                tm._sortedTroves_reInsert(
                    troveId, reInsertions[i].newAnnualInterestRate, _pickHints(reInsertions[i].hints)
                );
                tm._setTroveInterestRate(troveId, reInsertions[i].newAnnualInterestRate);
            }
        }

        _checkOrdering();
        _checkBatchContiguity();
    }
}
