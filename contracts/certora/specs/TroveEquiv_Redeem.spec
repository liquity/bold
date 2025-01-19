import "./ERC20/erc20cvl.spec";
import "./ERC20/WETHcvl.spec";
import "Common.spec";
import "Equivalences.spec";

using TroveManagerHarness as troveManager;
using DefaultPool as defaultPool;


// optimizing summaries
methods {
    function SafeERC20._callOptionalReturn(address token, bytes memory data) internal => NONDET;
    // contributes to non-linearity
    function _.fetchPrice() external => NONDET;
    
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
// -Redemption from Trove i and from batch Trove j of the same BOLD amount
// STATUS: VERIFIED
// https://prover.certora.com/output/11775/b047717540624e23848a67652a64b1bb?anonymousKey=2c3c63e6331616fa132b1035132237d27b20d709
rule trove_batch_trove_eq_redeem {
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;
    require troveIdX != troveIdY;

    env e;
    uint256 maxBoldAmount;
    uint256 price;
    uint256 redemptionRate;

    TroveManager.LatestTroveData troveDataX_before = 
        troveManager.getLatestTroveData(e, troveIdX);
    TroveManager.LatestTroveData troveDataY_before= 
        troveManager.getLatestTroveData(e, troveIdY);

    uint256 collX_before = troveManager.Troves[troveIdX].coll;
    uint256 stakeX_before = troveManager.Troves[troveIdX].stake;
    uint256 collY_before = troveManager.Troves[troveIdY].coll;
    uint256 stakeY_before = troveManager.Troves[troveIdY].stake;

    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);
    
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);

    require troveManager.Troves[troveIdX].lastDebtUpdateTime == troveManager.batches[batchAddress].lastDebtUpdateTime;

    require troveManager.batches[batchAddress].lastDebtUpdateTime <= e.block.timestamp;

    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    // require troves to be equivalent initially
    require troveBatchTroveEquivalent__(
        collX_before, stakeX_before,
        collY_before, stakeY_before,
        troveDataX_before, troveDataY_before);
    // save initial storage
    storage init = lastStorage;

    // Redeem on trove X
    TroveManager.SingleRedemptionValues singleRedemptionX;
    require singleRedemptionX.troveId == troveIdX;
    require singleRedemptionX.batchAddress == 0;
    require singleRedemptionX.trove == troveDataX_before;
    uint256 boldX = troveManager.redeemCollateralFromTroveHarnessed(e,
        defaultPool,
        singleRedemptionX,
        maxBoldAmount,
        price,
        redemptionRate
    ) at init;
    // save trove data after
    TroveManager.LatestTroveData troveDataX_after = 
        troveManager.getLatestTroveData(e, troveIdX);
    uint256 collX_after= troveManager.Troves[troveIdX].coll;
    uint256 stakeX_after= troveManager.Troves[troveIdX].stake;

    // Redeem on trove Y (beginning from same initial state)
    TroveManager.SingleRedemptionValues singleRedemptionY;
    require singleRedemptionY.troveId == troveIdY;
    require singleRedemptionY.batchAddress == batchAddress;
    require singleRedemptionY.trove == troveDataY_before;
    uint256 boldY = troveManager.redeemCollateralFromTroveHarnessed(e,
        defaultPool,
        singleRedemptionY,
        maxBoldAmount,
        price,
        redemptionRate
    ) at init;
    // save trove data after
    TroveManager.LatestTroveData troveDataY_after = 
        troveManager.getLatestTroveData(e, troveIdY);
    uint256 collY_after= troveManager.Troves[troveIdY].coll;
    uint256 stakeY_after= troveManager.Troves[troveIdY].stake;

    // ensure the same amount of bold is redeemed in both cases
    require boldX == boldY;

    assert troveBatchTroveEquivalent__(
        collX_after, stakeX_after,
        collY_after, stakeY_after,
        troveDataX_before, troveDataY_before); 
}