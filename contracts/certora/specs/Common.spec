//-----------------------------------------------------------------------------
// Common
//-----------------------------------------------------------------------------
// This file contains helper functions that are shared across a few of the 
// spec files.


//-----------------------------------------------------------------------------
// Helper functions for accessing storage locations
//-----------------------------------------------------------------------------
// Same as TroveManager._getBatchManager
function getBatchManager(uint256 troveId) returns address {
    return troveManager.Troves[troveId].interestBatchManager;
}

function getTroveBatchDebtShares(uint256 troveId) returns uint256 {
    return troveManager.Troves[troveId].batchDebtShares;
}

function getBatchTotalShares(address batchAddress) returns uint256 {
    return troveManager.batches[batchAddress].totalDebtShares;
}
function getBatchDebt(address batchAddress) returns uint256 {
    return troveManager.batches[batchAddress].debt;
}

function getTroveLastDebtUpdateTime(uint256 troveId) returns uint256 {
    return troveManager.Troves[troveId].lastDebtUpdateTime;
}

//-----------------------------------------------------------------------------
// Helper functions for Assumptions
//-----------------------------------------------------------------------------
// This is used to assume that trove rewards is updated and is equivalent
// to TroveManager._updateTroveRewardSnapshots. _updateTroveRewardsSnapshots
// is called upon opening a trove.
function troveRewardsUpdated(uint256 _troveId) returns bool {
    return troveManager.rewardSnapshots[_troveId].coll == troveManager.L_coll &&
        troveManager.rewardSnapshots[_troveId].boldDebt == troveManager.L_boldDebt;
}

function batchDataDebtUpdated(TroveManager.LatestBatchData batchData, address batchAddress) returns bool {
    return troveManager.batches[batchAddress].debt == 
        batchData.entireDebtWithoutRedistribution;
}

// Assume batch is not shut down and the debt has already been updated.
// (Otherwise we will have a spurious counterexample where the update
// was not yet applied in the prestate but it gets applied during 
// addCollaterall and other similar functions)
function interestUpdatedAssumption(env e, TroveManager.LatestBatchData batchData) returns bool {
    return troveManager.shutdownTime == 0 &&
        e.block.timestamp == batchData.lastDebtUpdateTime;
}

// Used to assume that BorrowerOperations.interestBatchmanager[troveId] 
// is the same as troveManager.Troves[troveId].interestBatchManagerOf
function batch_manager_storage_locations_agree(uint256 troveId) returns bool {
    return troveManager.Troves[troveId].interestBatchManager ==
        currentContract.interestBatchManagerOf[troveId];
}

// Assumptions about the relationship between batch debts and shares
// which should be maintianed
function debt_and_shares_relationship(
    uint256 troveId,
    address batchAddress,
    TroveManager.LatestBatchData batchData, 
    TroveManager.LatestTroveData troveData) returns bool {
        bool zero_shares_zero_debt_batch = 
            getBatchTotalShares(batchAddress) == 0 <=>
            batchData.recordedDebt == 0;
        bool zero_shares_zero_debt_trove =
            getTroveBatchDebtShares(troveId) == 0 <=>
            troveData.recordedDebt == 0;
        bool total_shares = 
            getBatchTotalShares(batchAddress) >=
            getTroveBatchDebtShares(troveId);
        return zero_shares_zero_debt_batch &&
            zero_shares_zero_debt_trove &&
            total_shares;
}

// To assume two troves have equal and valid timestamps
function trove_trove_valid_eq_timestamp(env e, uint256 troveIdX, 
    uint256 troveIdY) returns bool {
    return troveManager.shutdownTime == 0 &&
        e.block.timestamp > 0 && e.block.timestamp <= max_uint64 &&
        troveManager.Troves[troveIdX].lastDebtUpdateTime <= e.block.timestamp &&
        troveManager.Troves[troveIdY].lastDebtUpdateTime <= e.block.timestamp &&
        troveManager.Troves[troveIdX].lastDebtUpdateTime == troveManager.Troves[troveIdY].lastDebtUpdateTime;
}

// To assume a trove and a batch have equal and valid timestamps
function trove_batch_valid_eq_timestamp(env e, uint256 troveId, 
    address batchAddress) returns bool {
    return e.block.timestamp > 0 && e.block.timestamp <= max_uint64 &&
        troveManager.Troves[troveId].lastDebtUpdateTime <= e.block.timestamp &&
        troveManager.batches[batchAddress].lastDebtUpdateTime <= e.block.timestamp &&
        troveManager.Troves[troveId].lastDebtUpdateTime == troveManager.batches[batchAddress].lastDebtUpdateTime;
}


function num_shares_num_debt_assumption(
    uint256 share_debt_scalar,
    TroveManager.LatestBatchData batchData,
    address batchAddress) returns bool {
    return getBatchTotalShares(batchAddress) == share_debt_scalar * batchData.recordedDebt;
}