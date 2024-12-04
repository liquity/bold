import "./ERC20/erc20cvl.spec";
import "./ERC20/WETHcvl.spec";
import "Common.spec";

using TroveManager as troveManager;
methods {
    function SafeERC20._callOptionalReturn(address token, bytes memory data) internal => NONDET;

    function BorrowerOperations._calcUpfrontFee(uint256 _debt, 
        uint256 _avgInterestRate ) internal returns (uint256) => 
        CVLCalcUpfrontFee(_debt, _avgInterestRate);

    // This is safe because it is a view function.
    function SortedTroves._findInsertPosition(
        address _troveManager,
        uint256 _annualInterestRate,
        uint256 _prevId,
        uint256 _nextId
    ) internal returns (uint256, uint256) => NONDET;
    
    // Not marked as view but it is almost one Updates a single state field lastBoldLossError_Offset which is not relevant to these rules.
    function StabilityPool._computeCollRewardsPerUnitStaked(
        uint _collToAdd,
        uint _debtToOffset,
        uint _totalBoldDeposits
    ) internal returns (uint, uint) => NONDET;

    // We ignore gas compensation as it is not related to these rules.
    function TroveManager._sendGasCompensation(address _activePool, address _liquidator, uint _bold, uint _ETH) internal => NONDET;

    // These summaries are for performance optimization.
    function _.safeTransfer(address a, uint256 x) internal with (env e) => transferCVL(calledContract, e.msg.sender, a, x) expect bool;
    function _.safeTransferFrom(address a, address b, uint256 x) internal with (env e) => transferFromCVL(calledContract, e.msg.sender, a, b, x) expect bool;
    // Performance optimization. This contributes to non-linearity
    function _.fetchPrice() external => NONDET;
    // Depepnds on 2 state variables totalStakesSnapshot / totalCollateralSnapshot
    function TroveManager._computeNewStake(uint _coll) internal returns (uint) => NONDET;

    function LiquityBase._calcInterest(uint256 _weightedDebt, uint256 _period) internal returns (uint256) => AssumeZeroInterest();
}

//-----------------------------------------------------------------------------
// CVL Summaries
//-----------------------------------------------------------------------------

// This is a workaround for a getter for the upfront fee
// which goes into the debt calculation. Essentially this assumes
// an arbitrary but constant value. This is relevant to the debt
// adjustment effect rules
ghost uint256 upfrontFee;
function CVLCalcUpfrontFee(uint256 debt, uint256 avgInterestRate) returns uint256 {
    return upfrontFee;
}

function AssumeZeroInterest() returns uint256 {
    return 0;
}

//-----------------------------------------------------------------------------
// Helper functions for calling functions in parameterized rules
//-----------------------------------------------------------------------------

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

//-----------------------------------------------------------------------------
// Rules
//-----------------------------------------------------------------------------
// Sum of a given batch’s individual Trove entire debts sans redistributions 
// (recorded debts + accrued interest) equals the batch’s recorded debt plus 
// its accrued interest plus management fees.
// Note this restricts us to the case where a batch has exactly 2 troves in it.
// PASSING: https://prover.certora.com/output/65266/95ee72fb04b04d0d988afe2837b6f55a?anonymousKey=ffb75907ce6d7d24cc52f0cca17f1841c73a3c5b
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

    
    require interestUpdatedAssumption(e, batchData);
    require batchData.lastDebtUpdateTime == getTroveLastDebtUpdateTime(troveIdX) 
                && batchData.lastDebtUpdateTime == getTroveLastDebtUpdateTime(troveIdY);
    require batchData.annualInterestRate == troveDataX.annualInterestRate 
                && batchData.annualInterestRate == troveDataY.annualInterestRate;


    uint256 batch_debt = require_uint256(batchData.recordedDebt + batchData.accruedInterest);

    uint256 sum_trove_debt = require_uint256(
        troveDataX.entireDebt - troveDataX.redistBoldDebtGain
        + troveDataY.entireDebt - troveDataY.redistBoldDebtGain);

    assert batch_debt == sum_trove_debt;
}


// simple rule to check that all the troves in a batch have the same interest rate
// STATUS: PASSING
// https://prover.certora.com/output/65266/0c1e6565d8524f568302eb35f45e77ff/?anonymousKey=8f9f47eb773e45384e98117ea9d5f0bab4ac8c71
rule sameInterestRateForBatchTroves(env e, uint256 troveId1, uint256 troveId2){
    
    address batchManager1 = troveManager.Troves[troveId1].interestBatchManager;
    address batchManager2 = troveManager.Troves[troveId2].interestBatchManager;

    require batchManager1 == batchManager2 && batchManager1 != 0;

    uint256 interestRate1 = troveManager.getLatestTroveData(e, troveId1).annualInterestRate;
    uint256 interestRate2 = troveManager.getLatestTroveData(e, troveId2).annualInterestRate;

    assert interestRate1 == interestRate2,"troves in the same batch should have the same interest rate";
}

// Troves in a given batch always accrue interest at the same rate
// STATUS: PASSING
// https://prover.certora.com/output/65266/0c1e6565d8524f568302eb35f45e77ff/?anonymousKey=8f9f47eb773e45384e98117ea9d5f0bab4ac8c71
rule troves_in_batch_accrue_interest_at_same_rate {
    env e;

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
    // require require_uint256(troveXBatchShares + troveYBatchShares)
    //     <= totalBatchShares;


    TroveManager.LatestTroveData troveDataX = troveManager.getLatestTroveData(e, troveIdX);
    TroveManager.LatestTroveData troveDataY = troveManager.getLatestTroveData(e, troveIdY);


    // these unscaled debts are the trove's individual debt
    // with the scaling due to its individual batch debt shares removed
    uint256 unscaled_interest_x = require_uint256(troveDataX.accruedInterest / troveXBatchShares);
    uint256 unscaled_interest_y = require_uint256(troveDataY.accruedInterest / troveYBatchShares);
    assert unscaled_interest_x == unscaled_interest_y;
}

// When a trove is a member of a batch its recorded debt is calculated 
// as the batch debt normalized by its fraction of the total shares.
// PASSING: https://prover.certora.com/output/65266/c0e1a7786ace429caf6e6eedd922d5a2/?anonymousKey=960711ced6445e0deb29fe76e11ea835ad32bfb3
rule troves_in_batch_use_batch_structure {
    env e;
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    // troveIdX and troveIdY belong to the same batch. But we
    // do not constrain their individual debts at all so they may differ
    require getBatchManager(troveIdX) == batchAddress;
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
// PASSING: https://prover.certora.com/output/17512/60354eb235f74b91a64c62d953a33e97/?anonymousKey=2e684f40438900acdf9215143556681e0320e86d
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
    // This is an inequality for performance reasons and we will
    // get timeouts without this. The idea is that because
    // the rule is symmetric with x and y, we would get a counterexample
    // if there is a case where either x or y is lower, so it is
    // essentially the same as equality.
    assert unscaled_debt_x <= unscaled_debt_y;
}

// Troves in a given batch are charged the same management fee (as percentage 
// of their debt)
// PASSING: https://prover.certora.com/output/65266/df7a72e887c04bf2b22755db10e51750/?anonymousKey=65f67b65a18ddd5063fa723489231ae5cfc7ce3c
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
// PASSING: https://prover.certora.com/output/65266/3edac4f9134b484bb112a585fa8268d6/?anonymousKey=041d059c08e8d9a08608bda2bd9411b75134ad10
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


/*
When any borrower with a batch Trove i adjusts its debt by x:
    -All of the batch’s accrued interest is applied to the batch’s recorded debt
    -All of the batch’s accrued management fee is applied to the batch’s recorded debt
    -Trove i’s pending redistribution debt gain is applied to the batch’s recorded debt
    -Trove i’s pending redistribution coll gain is applied to the batch’s recorded coll
    -Trove i’s debt change x is applied to the batch’s recorded debt
    -Trove i’s entire coll does not change
NOTE: For performance reasons, we have a separate rule to show:
    -Trove i’s entire debt changes only by x
*/
// Related functions: withdrawBold, repayBold
// PASSING: https://prover.certora.com/output/65266/3edac4f9134b484bb112a585fa8268d6/?anonymousKey=041d059c08e8d9a08608bda2bd9411b75134ad10
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

    require debt_and_shares_relationship(troveId, batchAddress,
        batchDataBefore, troveDataBefore);

    callDebtAdjustFunction(e, f, troveId, boldAmount, maxUpfrontFee);

    TroveManager.LatestBatchData batchDataAfter=
        troveManager.getLatestBatchData(e, batchAddress);
    TroveManager.LatestTroveData troveDataAfter = 
        troveManager.getLatestTroveData(e, troveId);


    // Assume also interest does not accrue between the time
    // the  debt is adjust and the values are read back out
    require interestUpdatedAssumption(e, batchDataAfter);

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
    }

    // -Trove i’s entire coll does not change
    assert troveDataAfter.entireColl == troveDataBefore.entireColl;
}

// An alternative to ignoring the rounding errors during debt adjustment
// in case the divideNoRemainder causes performance problems that are too
// severe. Here we assume the number of total 
ghost uint256 share_debt_scalar;
function num_shares_num_debt_assumption_(
    TroveManager.LatestBatchData batchData,
    address batchAddress) returns bool {
    return (share_debt_scalar == 1 ||
        share_debt_scalar == 2 ||
        share_debt_scalar == 3 ||
        share_debt_scalar == 4 ||
        share_debt_scalar == 5 ||
        share_debt_scalar ==  (1000000000 - 5) ||
        share_debt_scalar  == 1000000000) &&
        getBatchTotalShares(batchAddress) ==
        share_debt_scalar * batchData.recordedDebt;
}

/*
When any borrower with a batch Trove i adjusts its debt by withdrawing x:
    -Trove i’s entire debt changes only by x
*/
// Status: PASSING
// run link: https://prover.certora.com/output/65266/90a05757dfcb43e09f32db04833ae19a/?anonymousKey=1b5a3af2ee928908a2659c242c03fc983d58bc7b
rule withdraw_debt_change {
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

    require debt_and_shares_relationship(troveId, batchAddress,
        batchDataBefore, troveDataBefore);

    // Overly conservative but to avoid performance issues
    require num_shares_num_debt_assumption_(batchDataBefore,
        batchAddress);

    withdrawBold(e, troveId, boldAmount, maxUpfrontFee);

    TroveManager.LatestBatchData batchDataAfter=
        troveManager.getLatestBatchData(e, batchAddress);
    TroveManager.LatestTroveData troveDataAfter = 
        troveManager.getLatestTroveData(e, troveId);


    // Assume also interest does not accrue between the time
    // the  debt is adjust and the values are read back out
    require interestUpdatedAssumption(e, batchDataAfter);

    assert troveDataAfter.entireDebt == troveDataBefore.entireDebt
        + upfrontFee
        + boldAmount;
}

/*
When any borrower with a batch Trove i adjusts its debt by repaying x:
    -Trove i’s entire debt changes only by x
*/
// Status: PASSING
// run link: https://prover.certora.com/output/65266/26d50b7a4283490e895ddca2eba40153/?anonymousKey=2236aebaa6e15a7b70c5062a3644b2cc1034ba22
rule repay_debt_change {
    env e;
    uint256 troveId;
    uint256 boldAmount;

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

    require debt_and_shares_relationship(troveId, batchAddress,
        batchDataBefore, troveDataBefore);


    // Overly conservative but to avoid performance issues
    require num_shares_num_debt_assumption_(batchDataBefore,
        batchAddress);

    repayBold(e, troveId, boldAmount);

    TroveManager.LatestBatchData batchDataAfter=
        troveManager.getLatestBatchData(e, batchAddress);
    TroveManager.LatestTroveData troveDataAfter = 
        troveManager.getLatestTroveData(e, troveId);


    // Assume also interest does not accrue between the time
    // the  debt is adjust and the values are read back out
    require interestUpdatedAssumption(e, batchDataAfter);

    //  the amount deducted is actually adjusted to be above 
    // the MIN_DEBT in _adjustTrove. CEX without this assumption:
    // https://prover.certora.com/output/65266/3a3adac163764998a5414508d53abf10/?anonymousKey=b4ca5fce00fc0c8a8c11808400e52fa749faf804
    require troveDataBefore.entireDebt - boldAmount >
        /* MIN_DEBT */
        2000000000000000000000;
    assert troveDataAfter.entireDebt == troveDataBefore.entireDebt
        - boldAmount;
}
