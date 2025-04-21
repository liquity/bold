import "./ERC20/erc20cvl.spec";
import "./ERC20/WETHcvl.spec";
import "Common.spec";
import "Equivalences.spec";

using TroveManager as troveManager;

// optimizing summaries
methods {
    function SafeERC20._callOptionalReturn(address token, bytes memory data) internal => NONDET;
    // contributes to non-linearity
    function _.fetchPrice() external => NONDET;
    
    // depepnds on 2 state variables totalStakesSnapshot / totalCollateralSnapshot
    function TroveManager._computeNewStake(uint _coll) internal returns (uint) => NONDET;

    // Dispatcher Sumamries are needed for Stability Pool
    // to avoid full contract havocs because of cacheing which
    // we will not link to automatically
    function _.offset(uint256 _debtToOffset, uint256 _collToAdd) external => DISPATCHER(true);
    function _.getTotalBoldDeposits() external => DISPATCHER(true);
    // Similarly the linking does not work for CollSurplusPool during
    // the call to liquidation.
    function _.accountSurplus(address _account, uint256 _amount) external => DISPATCHER(true);

    function SortedTroves.insertIntoBatch(
        uint256 _troveId,
        SortedTroves.BatchId _batchId,
        uint256 _annualInterestRate,
        uint256 _prevId,
        uint256 _nextId
    ) external => NONDET;

    function _.WETH() external => NONDET;
    function _.CCR() external  => NONDET;
    function _.SCR() external  => NONDET;
    function _.MCR() external  => NONDET;

    function _.receiveColl() external => NONDET;
}

//-----------------------------------------------------------------------------
// Trove and Batch Trove Equivalence
//-----------------------------------------------------------------------------
// For individual Trove i and batch Trove j in the same branch where i != j, 
// and i and j have equivalence E:
// E: (recorded_coll_i, recorded_debt_i, accrued_interest_i, stake_i, 
//          redistribution_debt_gain_i, redistribution_coll_gain_i) = 
// (recorded_coll_j, recorded_debt_j, accrued_interest_j, stake_j,
//          redistribution_debt_gain_j, redistribution_coll_gain_j) 
// Then, the following pairs of simultaneous actions maintain equivalence E:
// -Applying pending debt to Trove i and to Trove j's batch
// -Closing Trove i and closing batch Trove j
// -Liquidation of another Trove k in the same branch by redistribution (only when stake_i = stake_j)
// -Liquidation of another Trove k by SP offset

// - Closing Trove i and closing batch trove j
// PASSING: https://prover.certora.com/output/65266/2608fdd8d6044ccc90e1d9b3bbd6cfa6/?anonymousKey=290a3d24a79e35ff0db0de3b5baca95555d88ba9
rule trove_batch_trove_eq_closing {
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;
    require troveIdX != troveIdY;

    env e;

    TroveManager.LatestTroveData troveDataX_before = 
        troveManager.getLatestTroveData(e, troveIdX);
    TroveManager.LatestTroveData troveDataY_before= 
        troveManager.getLatestTroveData(e, troveIdY);

    uint256 collX_before = troveManager.Troves[troveIdX].coll;
    uint256 stakeX_before = troveManager.Troves[troveIdX].stake;
    uint256 collY_before = troveManager.Troves[troveIdY].coll;
    uint256 stakeY_before = troveManager.Troves[troveIdY].stake;

    // Various assumptions
    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);

    // require troves to be equivalent initially
    require troveBatchTroveEquivalent__(
        collX_before, stakeX_before,
        collY_before, stakeY_before,
        troveDataX_before, troveDataY_before);
    // save initial storage
    storage init = lastStorage;

    // close X at initial storage
    closeTrove(e, troveIdX) at init;
    // save trove data after
    TroveManager.LatestTroveData troveDataX_after = 
        troveManager.getLatestTroveData(e, troveIdX);
    uint256 collX_after= troveManager.Troves[troveIdX].coll;
    uint256 stakeX_after= troveManager.Troves[troveIdX].stake;

    // close Y at initial storage
    closeTrove(e, troveIdY) at init;
    // save trove data after
    TroveManager.LatestTroveData troveDataY_after = 
        troveManager.getLatestTroveData(e, troveIdY);
    uint256 collY_after= troveManager.Troves[troveIdY].coll;
    uint256 stakeY_after= troveManager.Troves[troveIdY].stake;

    assert troveBatchTroveEquivalent__(
        collX_after, stakeX_after,
        collY_after, stakeY_after,
        troveDataX_before, troveDataY_before); 
}

// -Liquidation of another Trove k in the same branch by redistribution (only when stake_i = stake_j)
// -Liquidation of another Trove k by SP offset"
// PASSING: https://prover.certora.com/output/65266/61f049c7c48a43248a3936cb1166c601/?anonymousKey=0d0660afefd05844ca4a16172935b1d97c4cd5ab
rule trove_batch_trove_eq_liquidate {
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;
    require troveIdX != troveIdY;

    uint256 troveIdZ;
    uint256[] troveArray;
    require troveArray.length == 1;
    require troveIdZ != troveIdX && troveIdZ != troveIdY;
    require troveArray[0] == troveIdZ;

    env e;

    TroveManager.LatestTroveData troveDataX_before = 
        troveManager.getLatestTroveData(e, troveIdX);
    TroveManager.LatestTroveData troveDataY_before= 
        troveManager.getLatestTroveData(e, troveIdY);

    // Various assumptions
    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);
    require troveRewardsUpdated(troveIdZ);

    // require troves to be equivalent
    require troveBatchTroveEquivalent_(troveIdX, troveIdY,
        troveDataX_before, troveDataY_before);

    // Liquidate troveIdZ which is distinct from X and Y
    troveManager.batchLiquidateTroves(e, troveArray);
    
    TroveManager.LatestTroveData troveDataX_after = 
        troveManager.getLatestTroveData(e, troveIdX);

    TroveManager.LatestTroveData troveDataY_after = 
        troveManager.getLatestTroveData(e, troveIdY);
    
    assert troveBatchTroveEquivalent_(troveIdX, troveIdY,
        troveDataX_before, troveDataY_before);
}

// -Applying pending debt to Trove i and to Trove j's batch
// PASSING: https://prover.certora.com/output/65266/17ae34273a28453eab2908dc2ce168b7/?anonymousKey=09a1a1b967af925ccdc189179b067ca2f94c55ee
rule trove_batch_trove_apply_pending_debt {
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;
    require troveIdX != troveIdY;

    env e;
    uint256 lower_hint;
    uint256 upper_hint;

    TroveManager.LatestTroveData troveDataX_before = 
        troveManager.getLatestTroveData(e, troveIdX);
    TroveManager.LatestTroveData troveDataY_before= 
        troveManager.getLatestTroveData(e, troveIdY);

    uint256 collX_before = troveManager.Troves[troveIdX].coll;
    uint256 stakeX_before = troveManager.Troves[troveIdX].stake;
    uint256 collY_before = troveManager.Troves[troveIdY].coll;
    uint256 stakeY_before = troveManager.Troves[troveIdY].stake;

    // Various assumptions
    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);

    // require troves to be equivalent initially
    require troveBatchTroveEquivalent__(
        collX_before, stakeX_before,
        collY_before, stakeY_before,
        troveDataX_before, troveDataY_before);
    // save initial storage
    storage init = lastStorage;

    applyPendingDebt(e, troveIdX, lower_hint, upper_hint) at init;
    // save trove data after
    TroveManager.LatestTroveData troveDataX_after = 
        troveManager.getLatestTroveData(e, troveIdX);
    uint256 collX_after= troveManager.Troves[troveIdX].coll;
    uint256 stakeX_after= troveManager.Troves[troveIdX].stake;

    applyPendingDebt(e, troveIdY, lower_hint, upper_hint) at init;
    // save trove data after
    TroveManager.LatestTroveData troveDataY_after = 
        troveManager.getLatestTroveData(e, troveIdY);
    uint256 collY_after= troveManager.Troves[troveIdY].coll;
    uint256 stakeY_after= troveManager.Troves[troveIdY].stake;

    assert troveBatchTroveEquivalent__(
        collX_after, stakeX_after,
        collY_after, stakeY_after,
        troveDataX_before, troveDataY_before); 
}

//-----------------------------------------------------------------------------
// Trove and Batch Equivalence
//-----------------------------------------------------------------------------
// "For Trove i and batch B in the same branch where i is not in B, and i and B have equivalence E:

// E: (recorded_coll_i, recorded_debt_i, accrued_interest_i) = (recorded_coll_B, recorded_debt_B, accrued_interest_B) 

// Then, the following pairs of simultaneous actions maintain equivalence E:
// -An adjustment of Trove i and an adjustment of a Trove in batch B that changes their recorded collateral by the same amount 
// -An adjustment of Trove i and an adjustment of a Trove in batch B that changes their recorded debt by the same amount 
// -Altering interest rate of Trove i and of batch B (with no upfront fees charged)
// -Altering interest rate of Trove i and of batch B prematurely (charging upfront fees)
// -Applying pending debt to Trove i and to a Trove in batch B
// -Closing Trove i and closing all Troves in batch B
// -Redemption from Trove i and from batch B of the same BOLD amount
// -Liquidation of another Trove k in the same branch by redistribution (only when stake_i = stake_j)
// -Liquidation of another Trove k by SP offset


// -Liquidation of another Trove k in the same branch by redistribution (only when stake_i = stake_j)
// -Liquidation of another Trove k by SP offset
// CEX: https://prover.certora.com/output/65266/34f8cb4c95704da5841dc696beb3fa88/?anonymousKey=9b8702f0a85d6f71b4a2654523ed982a1a50a390
rule trove_batch_eq_liquidation {
    uint256 trove_i;
    address batch;
    require getBatchManager(trove_i) != batch;

    uint256 trove_k;
    require trove_i != trove_k;
    uint256[] troveArray;
    require troveArray.length == 1;
    require troveArray[0] == trove_k;
    // the liquidated trove is also not a member of the batch
    require getBatchManager(trove_k) != batch;

    env e;

    TroveManager.LatestTroveData trove_data_before = 
        troveManager.getLatestTroveData(e, trove_i);
    TroveManager.LatestBatchData batch_data_before =
        troveManager.getLatestBatchData(e, batch);
    uint256 coll_trove_before = troveManager.Troves[trove_i].coll;
    uint256 coll_batch_before = troveManager.batches[batch].coll;

    require troveBatchEquivalent_(
        coll_trove_before,
        coll_batch_before,
        trove_data_before,
        batch_data_before
    );

    // Trove and batch should have same initial AIR
    require trove_data_before.annualInterestRate ==
        batch_data_before.annualInterestRate;

    // All relevant troves and the batch share the same last updated timestamp
    // and the timestamps are valid
    require trove_batch_valid_eq_timestamp(e, trove_i, batch);
    require trove_trove_valid_eq_timestamp(e, trove_i, trove_k);

    // accrued management fee should be 0 otherwise this
    // will cause the batch debt to differ from the individual trove
    // debt: 
    require trove_data_before.accruedBatchManagementFee == 0;
    require batch_data_before.accruedManagementFee == 0;

    require troveRewardsUpdated(trove_i);
    require troveRewardsUpdated(trove_k);


    // require the batch trove to have a fraction of the total shares
    // among other relationships between shares and total debt
    TroveManager.LatestTroveData trove_k_data_before = 
        troveManager.getLatestTroveData(e, trove_k); 
    require debt_and_shares_relationship(trove_k, batch,
        batch_data_before, trove_k_data_before);

    // Assume the 2 different storage locations for tacking
    // the batch manager of agree.
    require batch_manager_storage_locations_agree(trove_i);
    require batch_manager_storage_locations_agree(trove_k);

    troveManager.batchLiquidateTroves(e, troveArray);


    TroveManager.LatestTroveData trove_data_after = 
        troveManager.getLatestTroveData(e, trove_i);
    TroveManager.LatestBatchData batch_data_after =
        troveManager.getLatestBatchData(e, batch);
    uint256 coll_trove_after = troveManager.Troves[trove_i].coll;
    uint256 coll_batch_after = troveManager.batches[batch].coll;

    assert troveBatchEquivalent_(
        coll_trove_after,
        coll_batch_after,
        trove_data_after,
        batch_data_after
    );

}

// -Closing Trove i and closing all Troves in batch B
// CEX: https://prover.certora.com/output/65266/b803ea138ec14ac8bd4207b01a685a9d/?anonymousKey=8644b2b87c4f473fe6833dddc0cb9ffce992eada
rule trove_batch_eq_closing {
    uint256 trove_i;
    address batch;
    require getBatchManager(trove_i) != batch;

    // trove_b is the only trove in b
    // trove_b_ is used to establish that trove_b
    // is the only trove in b 
    uint256 trove_b;
    require getBatchManager(trove_b) == batch;
    uint256 trove_b_;
    require getBatchManager(trove_b_) == batch =>
        trove_b_ == trove_b;

    env e;

    TroveManager.LatestTroveData trove_data_before = 
        troveManager.getLatestTroveData(e, trove_i);
    TroveManager.LatestBatchData batch_data_before =
        troveManager.getLatestBatchData(e, batch);
    uint256 coll_trove_before = troveManager.Troves[trove_i].coll;
    uint256 coll_batch_before = troveManager.batches[batch].coll;

    require troveBatchEquivalent_(
        coll_trove_before,
        coll_batch_before,
        trove_data_before,
        batch_data_before
    );

    // Trove and batch should have same initial AIR
    require trove_data_before.annualInterestRate ==
        batch_data_before.annualInterestRate;
    // All relevant troves and the batch share the same last updated timestamp
    // and the timestamps are valid
    require trove_batch_valid_eq_timestamp(e, trove_i, batch);
    require trove_trove_valid_eq_timestamp(e, trove_i, trove_b);

    // trove_b has the entire collateral of the batch as it is
    // the only trove in the batch
    require troveManager.Troves[trove_b].coll == coll_batch_before;

    require trove_data_before.accruedBatchManagementFee == 0;
    require batch_data_before.accruedManagementFee == 0;

    require troveRewardsUpdated(trove_i);
    require troveRewardsUpdated(trove_b);

    // require the batch trove to have a fraction of the total shares
    // among other relationships between shares and total debt
    TroveManager.LatestTroveData trove_b_data_before = 
        troveManager.getLatestTroveData(e, trove_b); 
    require debt_and_shares_relationship(trove_b, batch,
        batch_data_before, trove_b_data_before);

    // Assume the 2 different storage locations for tacking
    // the batch manager of agree.
    require batch_manager_storage_locations_agree(trove_i);
    require batch_manager_storage_locations_agree(trove_b);

    // Close both troves
    closeTrove(e, trove_i);
    closeTrove(e, trove_b);

    TroveManager.LatestTroveData trove_data_after = 
        troveManager.getLatestTroveData(e, trove_i);
    TroveManager.LatestBatchData batch_data_after =
        troveManager.getLatestBatchData(e, batch);
    uint256 coll_trove_after = troveManager.Troves[trove_i].coll;
    uint256 coll_batch_after = troveManager.batches[batch].coll;

    assert troveBatchEquivalent_(
        coll_trove_after,
        coll_batch_after,
        trove_data_after,
        batch_data_after
    );

}

// -Applying pending debt to Trove i and to a Trove in batch B
// Timeout: https://prover.certora.com/output/65266/411e58c0a6084755937a0419c5a10abd/?anonymousKey=fa425a8887f722079e1e0cb7339f497b03c34edc
rule trove_batch_eq_pending {
    uint256 trove_i;
    address batch;
    require batch != 0;
    require getBatchManager(trove_i) != batch;

    // trove_b a trove in batch B
    uint256 trove_b;
    require getBatchManager(trove_b) == batch;

    env e;
    uint256 lower_hint;
    uint256 upper_hint;

    TroveManager.LatestTroveData trove_data_before = 
        troveManager.getLatestTroveData(e, trove_i);

    TroveManager.LatestBatchData batch_data_before =
        troveManager.getLatestBatchData(e, batch);
    uint256 coll_trove_before = troveManager.Troves[trove_i].coll;
    uint256 coll_batch_before = troveManager.batches[batch].coll;


    require troveBatchEquivalent_(
        coll_trove_before,
        coll_batch_before,
        trove_data_before,
        batch_data_before
    );

    // Trove and batch should have same initial AIR
    require trove_data_before.annualInterestRate ==
        batch_data_before.annualInterestRate;

    // All relevant troves and the batch share the same last updated timestamp
    // and the timestamps are valid
    require trove_batch_valid_eq_timestamp(e, trove_i, batch);
    require trove_trove_valid_eq_timestamp(e, trove_i, trove_b);

    // accrued management fee should be 0 otherwise this
    // will cause the batch debt to differ from the individual trove
    // debt: https://prover.certora.com/output/65266/a08e68f84ae64589855c518bce465ed9/?anonymousKey=94239bddcc7f50ccdf60e50e614ef03bbfdf016e
    require trove_data_before.accruedBatchManagementFee == 0;
    require batch_data_before.accruedManagementFee == 0;

    require troveRewardsUpdated(trove_i);
    require troveRewardsUpdated(trove_b);

    // require the batch trove to have a fraction of the total shares
    // among other relationships between shares and total debt
    TroveManager.LatestTroveData trove_b_data_before = 
        troveManager.getLatestTroveData(e, trove_b); 
    require debt_and_shares_relationship(trove_b, batch,
        batch_data_before, trove_b_data_before);

    // Assume the 2 different storage locations for tacking
    // the batch manager of agree.
    require batch_manager_storage_locations_agree(trove_i);
    require batch_manager_storage_locations_agree(trove_b);

    storage init = lastStorage;

    applyPendingDebt(e, trove_i, lower_hint, upper_hint) at init;

    TroveManager.LatestTroveData trove_data_after = 
        troveManager.getLatestTroveData(e, trove_i);
    uint256 coll_trove_after = troveManager.Troves[trove_i].coll;
    
    applyPendingDebt(e, trove_b, lower_hint, upper_hint) at init;
    
    TroveManager.LatestBatchData batch_data_after =
        troveManager.getLatestBatchData(e, batch);
    uint256 coll_batch_after = troveManager.batches[batch].coll;

    assert troveBatchEquivalent_(
        coll_trove_after,
        coll_batch_after,
        trove_data_after,
        batch_data_after
    );

}