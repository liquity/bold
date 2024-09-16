import "./ERC20/erc20cvl.spec";
import "./ERC20/WETHcvl.spec";
import "./setup/builtin_assertions.spec";
import "./generic.spec";

using TroveManager as troveManager;
// optimizing summaries
methods {
    function SafeERC20._callOptionalReturn(address token, bytes memory data) internal => NONDET;
    // contributes to non-linearity
    function _.fetchPrice() external => NONDET;
    
    // depepnds on 2 state variables totalStakesSnapshot / totalCollateralSnapshot
    function TroveManager._computeNewStake(uint _coll) internal returns (uint) => NONDET;

    // function SortedTroves.insertIntoBatch(gt
    //     uint256 _troveId,
    //     SortedTroves.BatchId _batchId,
    //     uint256 _annualInterestRate,
    //     uint256 _prevId,
    //     uint256 _nextId
    // ) external => NONDET;

    // We need to write summaries for this.
    function SortedTroves.insert(uint256 _id, uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) external => NONDET;

    // This is not safe. Pending solution to this
    function SortedTroves._ external => NONDET;
    
    // not marked as view but it is almost one... updates a single state field lastBoldLossError_Offset
    function StabilityPool._computeCollRewardsPerUnitStaked(
        uint _collToAdd,
        uint _debtToOffset,
        uint _totalBoldDeposits
    ) internal returns (uint, uint) => NONDET;

    // I think it's okay to ignore gas compensations in the first step
    function TroveManager._sendGasCompensation(address _activePool, address _liquidator, uint _bold, uint _ETH) internal => NONDET;

    // safeTransfer* leads to some overhead
    function _.safeTransfer(address a, uint256 x) internal with (env e) => transferCVL(calledContract, e.msg.sender, a, x) expect bool;
    function _.safeTransferFrom(address a, address b, uint256 x) internal with (env e) => transferFromCVL(calledContract, e.msg.sender, a, b, x) expect bool;
}

// Note: most of the time trove/batch data is just obtained 
// from getLatestTroveData (when the system is in steady
// state and values can be calculated). The data structures are changed in
// the various "on..." calls. Most of these rules could be improved
// by making them invariants or making an arbitrary call to one
// of the functions that can change the state.

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

// TODO invariant that the individual shares of
// a trove in a batch sum to the total shares of the batch.
// This is an assumption I think we need to make

// Sum of a given batch’s individual Trove entire debts sans redistributions 
// (recorded debts + accrued interest) equals the batch’s recorded debt plus 
// its accrued interest
// NOTE: This restricts us to the case where a batch has exactly 2 troves in it.
// Ideally we would generalize this by using hooks on the trove / batch data
// structures if that is possible.
// Another improvement would be to make even this rule an invariant.
// Current status: CEX
// https://prover.certora.com/output/65266/45f3210f8517415a8b4193b659e3b9f3/?anonymousKey=8d1919287fcf809e2fa914020950b63765c868d5
rule sum_of_trove_debts {
    env e;
    calldataarg args;
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    // Assume troveIdX and troveIdY belong to the same batch
    // and that these are the only two members of the batch
    require getBatchManager(troveIdX) == batchAddress;
    require getBatchManager(troveIdY) == batchAddress;
    // There is no third trove s.t. it is not one of x or y
    // and still a member of the batch
    uint256 troveIdZ;
    require getBatchManager(troveIdZ) == batchAddress =>
        (troveIdZ == troveIdX || troveIdZ == troveIdY);

    // Require both troves have nonzero debt shares
    // and the sum of both trove shares is LEQ the totalBatchShares
    uint256 troveXBatchShares = getTroveBatchDebtShares(troveIdX);
    uint256 troveYBatchShares = getTroveBatchDebtShares(troveIdY);
    uint256 totalBatchShares = getBatchTotalShares(batchAddress);

    require troveXBatchShares > 0;
    require troveYBatchShares > 0;
    // Sum of batch shares should be equal to total shares
    // (note in an invariant we should be able to relax this to leq)
    require require_uint256(troveXBatchShares + troveYBatchShares)
        == totalBatchShares;

    TroveManager.LatestBatchData batchData = troveManager.getLatestBatchData(e, batchAddress);
    TroveManager.LatestTroveData troveDataX = troveManager.getLatestTroveData(e, troveIdX);
    TroveManager.LatestTroveData troveDataY = troveManager.getLatestTroveData(e, troveIdY);

    uint256 batch_debt = require_uint256(batchData.recordedDebt 
        + batchData.accruedInterest);
    // trove.recordedDebt is first calculated from the batch in the 
    // function call in _getLatestTroveDataFromBatch using the value
    // from the batch data it gets with _getLatestBatchData.
    // then in line 907 of _getLatestTroveData it is overwritten with the data 
    // from the trove data structure.
    uint256 sum_trove_debt = require_uint256(
        troveDataX.recordedDebt + troveDataX.accruedInterest +
        troveDataY.recordedDebt + troveDataY.accruedInterest);
    assert batch_debt == sum_trove_debt;
}

// Note: this is not a requested property. This was used for debugging
// Show that when a trove belongs to a batch, the batch data is used
// rather than the individual trove data. 
rule troves_in_batch_use_batch_structure {
    env e;
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    // troveIdX and troveIdY belong to the same batch. But we
    // do not constrain their individual debts at all so they may differ
    require getBatchManager(troveIdX) == batchAddress;
    // require getBatchManager(troveIdY) == batchAddress;
    // Show that despite the fact the trove individual debts may differ,
    // the batch data is the same (and thus the shared batch data is used for
    // any trove belonging to a batch)
    TroveManager.LatestTroveData troveDataX;
    // LatestTroveData troveDataY;
    troveDataX = troveManager.getLatestTroveData(e, troveIdX);
    // troveDataY = getLatestTroveData(e, troveIdY);
    // likely need to refine this
    // _latestTroveData.recordedDebt = _latestBatchData.recordedDebt * batchDebtShares / totalDebtShares;
    require getTroveBatchDebtShares(troveIdX) > 0;
    require getBatchTotalShares(batchAddress) > 0;
    assert troveDataX.recordedDebt == getBatchDebt(batchAddress) *
        getTroveBatchDebtShares(troveIdX) / getBatchTotalShares(batchAddress);
}

// For a given average system interest rate, Troves in a given batch always pay 
// the same upfront fee (as percentage of their debt) upon premature interest 
// rate adjustments by the manager
rule troves_in_batch_share_upfront_fee {
    env e;

    // we constrain two troves to belong to the same batch, but
    // crucially we do not constrain their individual debts
    // (which should not affect their debt recalculation from
    // getLatestTroveData) or their 
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == batchAddress;
    require getBatchManager(troveIdY) == batchAddress;

    // Require both troves have nonzero debt shares
    // and the sum of both trove shares is LEQ the totalBatchShares
    uint256 troveXBatchShares = getTroveBatchDebtShares(troveIdX);
    uint256 troveYBatchShares = getTroveBatchDebtShares(troveIdY);
    uint256 totalBatchShares = getBatchTotalShares(batchAddress);

    require troveXBatchShares > 0;
    require troveYBatchShares > 0;
    require require_uint256(troveXBatchShares + troveYBatchShares)
        <= totalBatchShares;

    // cause a premature update to the interest rate, which will charge an upfront fee.
    uint128 newAnnualInterestRate;
    uint256 upperHint;
    uint256 lowerHint;
    uint256 maxUpfrontFee;
    setBatchManagerAnnualInterestRate(e, newAnnualInterestRate, upperHint, lowerHint, maxUpfrontFee);

    TroveManager.LatestTroveData troveDataX = troveManager.getLatestTroveData(e, troveIdX);
    TroveManager.LatestTroveData troveDataY = troveManager.getLatestTroveData(e, troveIdY);


    // these unscaled debts are the trove's individual debt
    // with the scaling due to its individual batch debt shares removed
    uint256 unscaled_debt_x = require_uint256(troveDataX.recordedDebt / troveXBatchShares);
    uint256 unscaled_debt_y = require_uint256(troveDataY.recordedDebt / troveYBatchShares);
    assert unscaled_debt_x == unscaled_debt_y;
}

// Troves in a given batch are charged the same management fee (as percentage 
// of their debt)
rule troves_in_batch_share_management_fee {
    env e;

    // we constrain two troves to belong to the same batch, but
    // crucially we do not constrain their individual debts
    // (which should not affect their debt recalculation from
    // getLatestTroveData) or their 
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == batchAddress;
    require getBatchManager(troveIdY) == batchAddress;

    // Require both troves have nonzero debt shares
    // and the sum of both trove shares is LEQ the totalBatchShares
    uint256 troveXBatchShares = getTroveBatchDebtShares(troveIdX);
    uint256 troveYBatchShares = getTroveBatchDebtShares(troveIdY);
    uint256 totalBatchShares = getBatchTotalShares(batchAddress);

    require troveXBatchShares > 0;
    require troveYBatchShares > 0;
    // Sum of batch shares should be less or equal total shares
    require require_uint256(troveXBatchShares + troveYBatchShares)
        <= totalBatchShares;

    TroveManager.LatestTroveData troveDataX = troveManager.getLatestTroveData(e, troveIdX);
    TroveManager.LatestTroveData troveDataY = troveManager.getLatestTroveData(e, troveIdY);

    uint256 unscaled_management_fee_x = require_uint256(
        troveDataX.accruedBatchManagementFee / troveXBatchShares);
    uint256 unscaled_management_fee_y = require_uint256(
        troveDataY.accruedBatchManagementFee / troveYBatchShares);
    assert unscaled_management_fee_x == unscaled_management_fee_y;
}

/*
When any borrower with a batch Trove i adjusts its coll by x:
-All of the batch’s accrued interest is applied to the batch’s recorded debt
-All of the batch’s accrued management fee is applied to the batch’s recorded debt
-Trove i’s pending redistribution debt gain is applied to the batch’s recorded debt
-Trove i’s pending redistribution coll gain is applied to the batch’s recorded coll
-Trove i’s entire coll changes only by x
-Trove i’s entire debt does not change
*/

// Should be similar for withdrawColl and the effects on debt changes
rule collateral_adjust_effect_addColl {
    env e;
    calldataarg args;
    uint256 troveId;
    uint256 collAmount;

    // the trove belongs to a batch
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveId) == batchAddress;

    TroveManager.LatestTroveData troveDataBefore = 
        troveManager.getLatestTroveData(e, troveId);

    // it adjusts its collateral by collAmount.
    addColl(e, troveId, collAmount);
    TroveManager.LatestTroveData troveDataAfter = 
        troveManager.getLatestTroveData(e, troveId);

    // Trove i's entire coll changes only by x:
    // PASSES
    assert troveDataAfter.entireColl == troveDataBefore.entireColl + collAmount;
    // Trove i's entire debt does not change:
    // FAILS, maybe missing something that sets up the relationship between the 
    // batch / troves data structures. Maybe try calling 
    //         OpenTroveAndJoinBatchManager to set this up.
    /// assert troveDataAfter.entireDebt == troveDataBefore.entireDebt;
}


// This also has a CEX so it may not be true.
rule collateral_adjust_effect_addColl_join {
    env e;

    // Join the troveManager initially to setup any preconditions
    IBorrowerOperations.OpenTroveAndJoinInterestBatchManagerParams openBatchParams;
    require openBatchParams.interestBatchManager != 0;
    uint256 troveId = openTroveAndJoinInterestBatchManager(e, openBatchParams);


    TroveManager.LatestTroveData troveDataBefore = 
        troveManager.getLatestTroveData(e, troveId);

    // TODO: Ideally we would also call any other function here
    uint256 collAmount;
    // it adjusts its collateral by collAmount.
    addColl(e, troveId, collAmount);
    TroveManager.LatestTroveData troveDataAfter = 
        troveManager.getLatestTroveData(e, troveId);

    assert troveDataAfter.entireDebt == troveDataBefore.entireDebt;
}

// Notes:
// The two ways to adjust collateral are: addColl/WithdrawColl
// Both of those functions result in a call to _adjustTrove
// When the trove is in a batch it eventually calls TroveManager.onAdjustTroveInsideBatch
// Inside TroveManager.onAdjustTroveInsideBatch:
// - batches[_batchAddress].debt is changed by applying 
//   `debtIncrease/debtDecrease` via TroveManager.updateBatchShares
//      -  where is the managementFee, accrued interest figured 
//         into debtIncrease?
// - Troves[_troveId].coll is updated

// Batch debt change notes:
//     uint256 debtIncrease =
// _troveChange.debtIncrease + _troveChange.upfrontFee + _troveChange.appliedRedistBoldDebtGain;

// Much earlier than this in the same call path I see
// BorrowerOperations._adjustTrove setting a few values in
// _troveChange that seem related to these:
// *

// NOTE: not correct but keeping this in case it helps inspire a better way later
// ghost mapping(address=>uint256) total_trove_debt_by_batch {
//     init_state axiom forall address x. total_trove_debt_by_batch[x] == 0;
// }
// hook Sstore troveManager.Troves[KEY uint256 troveId].debt uint256 new_debt (uint256 old_debt) {
//     address batch = batch_by_trove_id[troveId];
//     if(batch != 0) {
//         total_trove_debt_by_batch[batch] = require_uint256(total_trove_debt_by_batch[batch] 
//             + new_debt - old_debt);
//     }
// }