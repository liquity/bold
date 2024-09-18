import "./ERC20/erc20cvl.spec";
import "./ERC20/WETHcvl.spec";
import "./setup/builtin_assertions.spec";
import "./generic.spec";

using TroveManager as troveManager;
methods {
    function SafeERC20._callOptionalReturn(address token, bytes memory data) internal => NONDET;
    // contributes to non-linearity
    function _.fetchPrice() external => NONDET;
    
    // depepnds on 2 state variables totalStakesSnapshot / totalCollateralSnapshot
    function TroveManager._computeNewStake(uint _coll) internal returns (uint) => NONDET;

    // This is used to avoid a sanity failure. This is safe because
    // it is a view function.
    function SortedTroves._findInsertPosition(
        address _troveManager,
        uint256 _annualInterestRate,
        uint256 _prevId,
        uint256 _nextId
    ) internal returns (uint256, uint256) => NONDET;
    
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

// Used to assume that BorrowerOperations.interestBatchmanager[troveId] 
// is the same as troveManager.Troves[troveId].interestBatchManagerOf
function batch_manager_storage_locations_agree(uint256 troveId) returns bool {
    return troveManager.Troves[troveId].interestBatchManager ==
        currentContract.interestBatchManagerOf[troveId];
}

// Sum of a given batch’s individual Trove entire debts sans redistributions 
// (recorded debts + accrued interest) equals the batch’s recorded debt plus 
// its accrued interest plus management fees.
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
        + batchData.accruedInterest + batchData.accruedManagementFee);
    uint256 sum_trove_debt = require_uint256(
        troveDataX.entireDebt - troveDataX.redistBoldDebtGain
        + troveDataY.entireDebt - troveDataY.redistBoldDebtGain);
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
    return troveManager.shutdownTime != 0 &&
        e.block.timestamp == batchData.lastDebtUpdateTime;
}



// This is a helper method so that we can parameterize the rule
// for just the two calls related to collateral changes
function callCollateralAdjustFunction(env e, method f, uint256 troveId, uint256 collAmount) {
    if(f.selector == sig:addColl(uint256,uint256).selector) {
        addColl(e, troveId, collAmount);
    }
    if(f.selector == sig:withdrawColl(uint256,uint256).selector) {
        withdrawColl(e, troveId, collAmount);
    }
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
// Passing: https://prover.certora.com/output/65266/2d1baa02b9eb48b2a900c7ac803dcab2/?anonymousKey=e5acfc5adc9d5f327e799505f16e36de4f884b4b
rule collateral_adjust_effects (method f) filtered {
    f -> f.selector == sig:addColl(uint256,uint256).selector
    || f.selector == sig:withdrawColl(uint256,uint256).selector 
}{
    env e;
    uint256 troveId;
    uint256 collAmount;

    // the trove belongs to a batch
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveId) == batchAddress;
    // assume the two locations where batch managers are stored aggree
    require batch_manager_storage_locations_agree(troveId);

    // Assume rewardSnapshots is updated (this will always happen on opening a 
    // Trove, for example). TroveManager._updateTroveRewardSnapshots is called 
    // as part of addCol, so without this assumption the prover will choose 
    // executions where the rewardSnapshots are not updated, this will affect 
    // troveDataBefore, then addColl will do the update 
    /// spuriously changing the debt calculation for the troveDataAfter
    require troveRewardsUpdated(troveId);
    
    TroveManager.LatestBatchData batchDataBefore =
        troveManager.getLatestBatchData(e, batchAddress);

    // During any the debt/coll channging functions
    // which eventually call _adjustTrove,
    // troveManager.batches[batchAddress].debt will get updated
    // to <...>.entireDebtWithoutRedistribution.
    // So here we assume troveManager.batches was updated
    // in the prestate as we will otherwise get a spurious
    // counterexample due to this update happening during the
    // function under test.
    require batchDataDebtUpdated(batchDataBefore, batchAddress);

    // Assume interest has been updated (according to timestamps)
    require interestUpdatedAssumption(e, batchDataBefore);

    TroveManager.LatestTroveData troveDataBefore = 
        troveManager.getLatestTroveData(e, troveId);

    // trove increases its collateral by collAmount.
    // addColl(e, troveId, collAmount);
    callCollateralAdjustFunction(e, f, troveId, collAmount);

    TroveManager.LatestBatchData batchDataAfter=
        troveManager.getLatestBatchData(e, batchAddress);
    TroveManager.LatestTroveData troveDataAfter = 
        troveManager.getLatestTroveData(e, troveId);

    // The batch's recorded debt should increase from
    // the old recorded debt by at least each of these values.
    // It is >= this sum rather than == because the batch
    // may also be charged an upfront fee
    assert batchDataAfter.recordedDebt >= 
        batchDataBefore.recordedDebt +
        // -All of the batch’s accrued management fee is applied to the batch’s recorded debt
        batchDataBefore.accruedManagementFee +
        // -All of the batch’s accrued interest is applied to the batch’s recorded debt
        batchDataBefore.accruedInterest +
        // -Trove i’s pending redistribution debt gain is applied to the batch’s recorded debt
        troveDataBefore.redistBoldDebtGain;

    // Trove i’s pending redistribution coll gain is applied to the batch’s recorded coll

    // -Trove i’s entire coll changes only by x
    assert (troveDataAfter.entireColl == 
        // addColl
        troveDataBefore.entireColl + collAmount) ||
        (troveDataAfter.entireColl ==
        // withdrawColl
        troveDataBefore.entireColl - collAmount);
    // -Trove i’s entire debt does not change
    assert troveDataAfter.entireDebt == troveDataBefore.entireDebt;
}

// This is a helper method so that we can parameterize the rule
// for just the two calls related to collateral changes
function callDebtAdjustFunction(env e, method f, uint256 troveId, uint256 boldAmount, uint256 maxUpfrontFee) {
    if(f.selector == sig:withdrawBold(uint256,uint256,uint256).selector) {
        withdrawBold(e, troveId, boldAmount, maxUpfrontFee);
    }
    if(f.selector == sig:repayBold(uint256,uint256).selector) {
        repayBold(e, troveId, boldAmount);
    }
}

/*
When any borrower with a batch Trove i adjusts its debt by x:
    -All of the batch’s accrued interest is applied to the batch’s recorded debt
    -All of the batch’s accrued management fee is applied to the batch’s recorded debt
    -Trove i’s pending redistribution debt gain is applied to the batch’s recorded debt
    -Trove i’s pending redistribution coll gain is applied to the batch’s recorded coll
    -Trove i’s debt change x is applied to the batch’s recorded debt
    -Trove i’s entire debt changes only by x
    -Trove i’s entire coll does not change
*/
// Related functions: withdrawBold, repayBold
rule debt_adjust_effects (method f) filtered {
    f -> f.selector == sig:withdrawBold(uint256,uint256,uint256).selector
    || f.selector == sig:repayBold(uint256,uint256).selector 
}{
    env e;
    uint256 troveId;
    uint256 boldAmount;
    // Note: this is only used for withdrawBold
    uint256 maxUpfrontFee;

    // the trove belongs to a batch
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveId) == batchAddress;
    // assume the two locations where batch managers are stored aggree
    require batch_manager_storage_locations_agree(troveId);

    // The batch has a nonzero amount of total shares
    // and the trove has a nonzero number of these shares
    // which is leq the total.
    uint256 troveBatchShares = getTroveBatchDebtShares(troveId);
    uint256 totalBatchShares = getBatchTotalShares(batchAddress);
    require troveBatchShares > 0 && totalBatchShares >= troveBatchShares;

    // Assume rewardSnapshots is updated (this will always happen on opening a 
    // Trove, for example). TroveManager._updateTroveRewardSnapshots is called 
    // as part of addCol, so without this assumption the prover will choose 
    // executions where the rewardSnapshots are not updated, this will affect 
    // troveDataBefore, then addColl will do the update 
    /// spuriously changing the debt calculation for the troveDataAfter
    require troveRewardsUpdated(troveId);
    
    TroveManager.LatestBatchData batchDataBefore =
        troveManager.getLatestBatchData(e, batchAddress);

    // During any the debt/coll channging functions
    // which eventually call _adjustTrove,
    // troveManager.batches[batchAddress].debt will get updated
    // to <...>.entireDebtWithoutRedistribution.
    // So here we assume troveManager.batches was updated
    // in the prestate as we will otherwise get a spurious
    // counterexample due to this update happening during the
    // function under test.
    require batchDataDebtUpdated(batchDataBefore, batchAddress);

    // Assume interest has been updated (according to timestamps)
    require interestUpdatedAssumption(e, batchDataBefore);

    TroveManager.LatestTroveData troveDataBefore = 
        troveManager.getLatestTroveData(e, troveId);

    // withdrawBold(e, troveId, boldAmount, maxUpfrontFee); 
    callDebtAdjustFunction(e, f, troveId, boldAmount, maxUpfrontFee);

    TroveManager.LatestBatchData batchDataAfter=
        troveManager.getLatestBatchData(e, batchAddress);
    TroveManager.LatestTroveData troveDataAfter = 
        troveManager.getLatestTroveData(e, troveId);

    if(f.selector == sig:withdrawBold(uint256,uint256,uint256).selector) {
        assert batchDataAfter.recordedDebt >= 
            // The debt is increased by each of these other debts after
            // adding the amount of bold withdrawn
            batchDataBefore.recordedDebt +
            boldAmount +
            // -All of the batch’s accrued management fee is applied to the batch’s recorded debt
            batchDataBefore.accruedManagementFee +
            // -All of the batch’s accrued interest is applied to the batch’s recorded debt
            batchDataBefore.accruedInterest +
            // -Trove i’s pending redistribution debt gain is applied to the batch’s recorded debt
            troveDataBefore.redistBoldDebtGain;

        // - Trove i's entire debt changes only by x
        // CEX due to rounding of the number of troveBatchDebtShares
        // granted to the trove: https://prover.certora.com/output/65266/6f90a8cfb11444768355d23976cf1aea?anonymousKey=9a4c33d6685dde33f50eecc9a48709ca94a540f6
        // Doc with more detailed explanation: https://docs.google.com/document/d/1IVU5H1KEq_mZ6tE0vr244WFQxom-Y7K1YAnWtLv3HJA/edit
        assert troveDataAfter.entireDebt == troveDataBefore.entireDebt + boldAmount;
    }
    if(f.selector == sig:repayBold(uint256,uint256).selector) {
        assert batchDataAfter.recordedDebt >= 
            // The debt is increased by each of these other debts after
            // subtrating by the amount repayed
            batchDataBefore.recordedDebt  -
            boldAmount +
            // -All of the batch’s accrued management fee is applied to the batch’s recorded debt
            batchDataBefore.accruedManagementFee +
            // -All of the batch’s accrued interest is applied to the batch’s recorded debt
            batchDataBefore.accruedInterest +
            // -Trove i’s pending redistribution debt gain is applied to the batch’s recorded debt
            troveDataBefore.redistBoldDebtGain;

        // - Trove i's entire debt changes only by x
        assert troveDataAfter.entireDebt == troveDataBefore.entireDebt - boldAmount;
    }

    // -Trove i’s entire coll does not change
    assert troveDataAfter.entireColl == troveDataBefore.entireColl;
 
}