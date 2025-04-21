//-----------------------------------------------------------------------------
// Functions defining relations for rules that check equivalences between
// - individual troves and batch troves
// - individual troves and batches
//-----------------------------------------------------------------------------


//-----------------------------------------------------------------------------
// For comparing individual troves and batches
//-----------------------------------------------------------------------------
// E: (recorded_coll_i, recorded_debt_i, accrued_interest_i) = (recorded_coll_B, recorded_debt_B, accrued_interest_B) 
function troveBatchEquivalent(env e, uint256 trove, address batch) returns bool {
    TroveManager.LatestTroveData troveData = troveManager.getLatestTroveData(e, trove);
    TroveManager.LatestBatchData batchData = troveManager.getLatestBatchData(e, batch);
    
    return (troveManager.Troves[trove].coll    == troveManager.batches[batch].coll &&
            troveData.accruedInterest          == batchData.accruedInterest  &&
            troveData.recordedDebt             == batchData.recordedDebt);
}

function troveBatchEquivalent_(
    uint256 coll_trove, uint256 coll_batch,
    TroveManager.LatestTroveData troveData,
    TroveManager.LatestBatchData batchData) returns bool {
    return (coll_trove == coll_batch &&
            troveData.accruedInterest == batchData.accruedInterest  &&
            troveData.recordedDebt    == batchData.recordedDebt);
}

//-----------------------------------------------------------------------------
// For comparing individual troves and batch troves
//-----------------------------------------------------------------------------
// E: (recorded_coll_i, recorded_debt_i, accrued_interest_i, stake_i, redistribution_debt_gain_i, redistribution_coll_gain_i) = (recorded_coll_j, recorded_debt_j, accrued_interest_j, stake_j, redistribution_debt_gain_j, redistribution_coll_gain_j) 
function troveBatchTroveEquivalent(env e, uint256 troveIdX, uint256 troveIdY) returns bool{
    TroveManager.LatestTroveData troveDataX = troveManager.getLatestTroveData(e, troveIdX);
    TroveManager.LatestTroveData troveDataY = troveManager.getLatestTroveData(e, troveIdY);

    return (troveManager.Troves[troveIdX].coll  == troveManager.Troves[troveIdY].coll   &&
            troveManager.Troves[troveIdX].stake == troveManager.Troves[troveIdY].stake  &&
            troveDataX.accruedInterest          == troveDataY.accruedInterest           &&
            troveDataX.recordedDebt             == troveDataY.recordedDebt              &&
            troveDataX.redistBoldDebtGain       == troveDataY.redistBoldDebtGain        &&
            troveDataX.redistCollGain           == troveDataY.redistCollGain);
}

function troveBatchTroveEquivalent_(uint256 troveIdX, uint256 troveIdY,
    TroveManager.LatestTroveData troveDataX,
    TroveManager.LatestTroveData troveDataY) returns bool{

    return (troveManager.Troves[troveIdX].coll  == troveManager.Troves[troveIdY].coll   &&
            troveManager.Troves[troveIdX].stake == troveManager.Troves[troveIdY].stake  &&
            troveDataX.accruedInterest          == troveDataY.accruedInterest           &&
            troveDataX.recordedDebt             == troveDataY.recordedDebt              &&
            troveDataX.redistBoldDebtGain       == troveDataY.redistBoldDebtGain        &&
            troveDataX.redistCollGain           == troveDataY.redistCollGain);
}

function troveBatchTroveEquivalent__(
    // separate out the stake and collateral as a workaround
    // for rather odd type error about the struct here
    uint256 collX, uint256 stakeX,
    uint256 collY, uint256 stakeY,
    TroveManager.LatestTroveData troveDataX,
    TroveManager.LatestTroveData troveDataY) returns bool{

    return (collX  == collY   &&
            stakeX == stakeY  &&
            troveDataX.accruedInterest    == troveDataY.accruedInterest           &&
            troveDataX.recordedDebt       == troveDataY.recordedDebt              &&
            troveDataX.redistBoldDebtGain == troveDataY.redistBoldDebtGain        &&
            troveDataX.redistCollGain     == troveDataY.redistCollGain);
}