/// Mock for trove[ID].annualInterestRate()
/// @WARNING - the function values are immutable!
/// Consider using a mapping instead that could be havoc'd if the scene allows those values to change.
ghost TroveAIR(uint256) returns uint256 {
    init_state axiom forall uint256 troveID. TroveAIR(troveID) == 0;
    /// VERIFY!
    axiom TroveAIR(ROOT_ID()) == 0;
}

definition ROOT_ID() returns uint256 = 0;

definition UNINITIALIZED_ID() returns uint256 = 0;

/*
STORAGE MIRROR OF nodes:
*/
ghost mapping(uint256 => uint256) nextNode {
    init_state axiom forall uint256 ID. nextNode[ID] == 0;
}

ghost mapping(uint256 => uint256) prevNode {
    init_state axiom forall uint256 ID. prevNode[ID] == 0;
}

ghost mapping(uint256 => bool) nodeExists {
    init_state axiom forall uint256 ID. nodeExists[ID] == false;
}

ghost mapping(uint256 => address) nodeBatchId {
    init_state axiom forall uint256 ID. nodeBatchId[ID] == 0;
}

/*
Track count of exisiting nodes:
*/
ghost mathint sumOfExistingNodes {init_state axiom sumOfExistingNodes == 0;}
ghost mathint sumOfExistingNodes_init {init_state axiom sumOfExistingNodes_init == 0;}

/// Linked list head and tail:
/// Definition: HEAD is the next node ID of the root. (= getFirst())
definition HEAD() returns uint256 = nextNode[ROOT_ID()];
/// Definition: TAIL is the previous node ID of the root. (= getLast())
definition TAIL() returns uint256 = prevNode[ROOT_ID()];

/*
STORAGE MIRROR OF bathces:
*/
ghost mapping(address => uint256) batchHead {
    init_state axiom forall address ID. batchHead[ID] == 0;
}

ghost mapping(address => uint256) batchTail {
    init_state axiom forall address ID. batchTail[ID] == 0;
}