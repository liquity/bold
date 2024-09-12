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

// TODO invariant that the individual shares of
// a trove in a batch sum to the total shares of the batch.

// Sum of a given batch’s individual Trove entire debts sans redistributions 
// (recorded debts + accrued interest) equals the batch’s recorded debt plus 
// its accrued interest
// NOTE: This restricts us to the case where a batch has exactly 2 troves in it
// Ideally we would generalize this by using hooks on the trove / batch data
// structures if that is possible.
// Another improvement would be to make even this rule an invariant.
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
    // Sum of batch shares should be less or equal total shares
    require require_uint256(troveXBatchShares + troveYBatchShares)
        <= totalBatchShares;

    TroveManager.LatestBatchData batchData = troveManager.getLatestBatchData(e, batchAddress);
    TroveManager.LatestTroveData troveDataX = troveManager.getLatestTroveData(e, troveIdX);
    TroveManager.LatestTroveData troveDataY = troveManager.getLatestTroveData(e, troveIdY);

    uint256 batch_debt = require_uint256(batchData.recordedDebt 
        + batchData.accruedInterest);
    uint256 sum_trove_debt = require_uint256(
        troveDataX.recordedDebt + troveDataX.accruedInterest +
        troveDataY.recordedDebt + troveDataY.accruedInterest);
    assert batch_debt == sum_trove_debt;
}

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