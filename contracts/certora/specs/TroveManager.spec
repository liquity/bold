import "./ERC20/erc20cvl.spec";
import "./ERC20/WETHcvl.spec";
import "./setup/builtin_assertions.spec";
import "./generic.spec";

// optimizing summaries
methods {
    function SafeERC20._callOptionalReturn(address token, bytes memory data) internal => NONDET;
    // contributes to non-linearity
    function _.fetchPrice() external => NONDET;
    
    // depepnds on 2 state variables totalStakesSnapshot / totalCollateralSnapshot
    function TroveManager._computeNewStake(uint _coll) internal returns (uint) => NONDET;

    // not marked as view but it is almost one... updates a single state field lastBoldLossError_Offset
    function StabilityPool._computeCollRewardsPerUnitStaked(
        uint _collToAdd,
        uint _debtToOffset,
        uint _totalBoldDeposits
    ) internal returns (uint, uint) => NONDET;

    // I think it's okay to ignore gas compensations in the first step
    function TroveManager._sendGasCompensation(address _activePool, address _liquidator, uint _bold, uint _ETH) internal => NONDET;
}

// use builtin rule sanity filtered { f -> f.contract == currentContract }
// 
// use rule check_builtin_assertions filtered { f -> f.contract == currentContract }
// 
// use builtin rule hasDelegateCalls filtered { f -> f.contract == currentContract }
// use builtin rule msgValueInLoopRule;
// use builtin rule viewReentrancy;
// use rule privilegedOperation filtered { f -> f.contract == currentContract }
// use rule timeoutChecker filtered { f -> f.contract == currentContract }
// use rule simpleFrontRunning filtered { f -> f.contract == currentContract }
// use rule noRevert filtered { f -> f.contract == currentContract }
// use rule alwaysRevert filtered { f -> f.contract == currentContract }

ghost mapping(uint256 => address) batch_by_trove_id {
    init_state axiom forall uint256 x. batch_by_trove_id[x] == 0;
}
hook Sstore Troves[KEY uint256 troveId].interestBatchManager address batch {
    batch_by_trove_id[troveId] = batch;
}
hook Sload address batch Troves[KEY uint256 troveId].interestBatchManager {
    require batch_by_trove_id[troveId] == batch;
}

invariant batch_by_trove_valid (uint256 troveId)
    currentContract.Troves[troveId].interestBatchManager == batch_by_trove_id[troveId];


ghost mapping(address=>uint256) total_trove_debt_by_batch {
    init_state axiom forall address x. total_trove_debt_by_batch[x] == 0;
}
hook Sstore Troves[KEY uint256 troveId].debt uint256 new_debt (uint256 old_debt) {
    address batch = batch_by_trove_id[troveId];
    if(batch != 0) {
        total_trove_debt_by_batch[batch] = require_uint256(total_trove_debt_by_batch[batch] 
            + new_debt - old_debt);
    }
}
rule sum_of_trove_debts_is_batch_debt (method f){
    env e;
    calldataarg args;
    // Need to make batch_by_trove quantified or
    // make this use troveId
    uint256 troveId;
    requireInvariant batch_by_trove_valid(troveId);
    // Should be similar to requiring this invariant for all troveId
    require forall uint256 x.
        currentContract.Troves[x].interestBatchManager == batch_by_trove_id[x]; 
    address batchManager;
    require currentContract.batches[batchManager].debt == 
        total_trove_debt_by_batch[batchManager];
    f(e, args);
    assert currentContract.batches[batchManager].debt ==
        total_trove_debt_by_batch[batchManager];
}