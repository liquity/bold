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

    // This is safe because it is a view function.
    function SortedTroves._findInsertPosition(
        address _troveManager,
        uint256 _annualInterestRate,
        uint256 _prevId,
        uint256 _nextId
    ) internal returns (uint256, uint256) => NONDET;
    
    function _.WETH() external => NONDET;
    function _.CCR() external  => NONDET;
    function _.SCR() external  => NONDET;
    function _.MCR() external  => NONDET;

    function _.receiveColl() external => NONDET;
    
    function _calcUpfrontFee(uint256 debt, uint256 interestRate) internal returns (uint256) => upFrontFee[debt][interestRate];
}

//////////////////// Ghosts ///////////////////////////////

ghost mapping(uint256 => mapping(uint256 => uint256)) upFrontFee;


//////////////////////////////////////////// Collateral adjustment /////////////////////////////////////////////////

// -An adjustment of Trove i and an adjustment of batch Trove j that changes their recorded collateral by the same amount

//////////////// Adding Collateral /////////////////////

// accruedInterest
// STATUS: TIMEOUT
// https://prover.certora.com/output/11775/860ad83dcec64e4c9e810e7365678fa8?anonymousKey=bb2cbba6025a93645e951fbd275fe0eb5cd72eb0
rule troveBatchTroveEquivalenceAddColl_accruedInterest(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;

    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);
    
    require troveBatchTroveEquivalent_(troveIdX, troveIdY, troveDataX_before, troveDataY_before);

    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);
    
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    // TODO: need to prove this
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    storage init = lastStorage;
    uint256 collAmount;
    addColl(e, troveIdX, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    
    addColl(e, troveIdY, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    
    assert troveDataX_after.accruedInterest == troveDataY_after.accruedInterest,"interest should be the same";
}

// recordedDebt
// STATUS: TIMEOUT
// https://prover.certora.com/output/11775/911d32a8819e462ba0a0e7596bc3bda9?anonymousKey=2fba4509fb993d9416c211499ba30ba0cbd4c91d
rule troveBatchTroveEquivalenceAddColl_recordedDebt(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;
    
    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);
    
    require troveBatchTroveEquivalent_(troveIdX, troveIdY, troveDataX_before, troveDataY_before);

    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);
    
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    // TODO: need to prove this
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    storage init = lastStorage;
    uint256 collAmount;
    addColl(e, troveIdX, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    
    addColl(e, troveIdY, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    
    assert troveDataX_after.recordedDebt == troveDataY_after.recordedDebt,"recordedDebt should be the same";
}

// redistribution debt/coll gains and  recorded collateral
// STATUS: VERIFIED
// https://prover.certora.com/output/11775/719c45e717cc44d48f96efa7f5b18243?anonymousKey=2e13104362c896777711d318b16d4b44162dd05b
rule troveBatchTroveEquivalenceAddColl_gainsColl(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;

    // requrie troves to be equivalent
    require troveBatchTroveEquivalent(e, troveIdX, troveIdY);
    // storage snapshot to call addColl from for each trove
    storage init = lastStorage;
    uint256 collAmount;
    
    addColl(e, troveIdX, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    uint256 troveIdX_coll_after                   = troveManager.Troves[troveIdX].coll;
    
    addColl(e, troveIdY, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    uint256 troveIdY_coll_after                   = troveManager.Troves[troveIdY].coll;
    
    assert troveIdX_coll_after                       == troveIdY_coll_after,"coll should be the same";
    assert troveDataX_after.redistBoldDebtGain       == troveDataY_after.redistBoldDebtGain,"debt gain should be the same";
    assert troveDataX_after.redistCollGain           == troveDataY_after.redistCollGain,"coll gain should be the same";
}


//////////////// Decreasing Collateral /////////////////////

// accruedInterest
// STATUS: IN-FLIGHT
// https://prover.certora.com/output/11775/f215919acf31423e8eb25103b78f9071?anonymousKey=2bd085da1f74a7df8af7be63ccbd3eb4ac61bb99
rule troveBatchTroveEquivalenceWithdrawColl_accruedInterest(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;

    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);
    
    require troveBatchTroveEquivalent_(troveIdX, troveIdY, troveDataX_before, troveDataY_before);

    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);
    
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    // TODO: need to prove this
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    storage init = lastStorage;
    uint256 collAmount;
    withdrawColl(e, troveIdX, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    
    withdrawColl(e, troveIdY, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    
    assert troveDataX_after.accruedInterest == troveDataY_after.accruedInterest,"interest should be the same";
}

// recordedDebt
// STATUS: IN-FLIGHT
// https://prover.certora.com/output/11775/1b83ecd8aafa4677892cb35ca2c43c77?anonymousKey=81fe15bd0c0c5c53040869087d34f520641a7aee
rule troveBatchTroveEquivalenceWithdrawColl_recordedDebt(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;
    
    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);
    
    require troveBatchTroveEquivalent_(troveIdX, troveIdY, troveDataX_before, troveDataY_before);

    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);
    
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    // TODO: need to prove this
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    storage init = lastStorage;
    uint256 collAmount;
    withdrawColl(e, troveIdX, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    
    withdrawColl(e, troveIdY, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    
    assert troveDataX_after.recordedDebt == troveDataY_after.recordedDebt,"recordedDebt should be the same";
}

// redistribution debt/coll gains and  recorded collateral
// STATUS: IN-FLIGHT
// https://prover.certora.com/output/11775/5f54a65d71834167998e97d446c10dfa?anonymousKey=df03165354b4cb2d17497b7220d434dfc0b429f6
rule troveBatchTroveEquivalenceWithdrawColl_gainsColl(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;

    // requrie troves to be equivalent
    require troveBatchTroveEquivalent(e, troveIdX, troveIdY);
    // storage snapshot to call addColl from for each trove
    storage init = lastStorage;
    uint256 collAmount;
    
    withdrawColl(e, troveIdX, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    uint256 troveIdX_coll_after                   = troveManager.Troves[troveIdX].coll;
    
    withdrawColl(e, troveIdY, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    uint256 troveIdY_coll_after                   = troveManager.Troves[troveIdY].coll;
    
    assert troveIdX_coll_after                       == troveIdY_coll_after,"coll should be the same";
    assert troveDataX_after.redistBoldDebtGain       == troveDataY_after.redistBoldDebtGain,"debt gain should be the same";
    assert troveDataX_after.redistCollGain           == troveDataY_after.redistCollGain,"coll gain should be the same";
}





//////////////////////////////////////////// Debt adjustment /////////////////////////////////////////////////

// -An adjustment of Trove i and an adjustment of batch Trove j that changes their recorded debt by the same amount 

//////////////// Increasing Debt /////////////////////
// accruedInterest
// STATUS: TIMEOUT
// https://prover.certora.com/output/11775/708fbf3a973b47c686ac594cf20d1446?anonymousKey=bebbf87215aded38930ed6282027446c91ed75dc
rule troveBatchTroveEquivalenceWithdrawBold_accruedInterest(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;

    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);
    
    require troveBatchTroveEquivalent_(troveIdX, troveIdY, troveDataX_before, troveDataY_before);

    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);
    
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    // TODO: need to prove this
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;
    
    storage init = lastStorage;
    uint256 boldAmount;
    uint256 maxUpfrontFeeX;
    withdrawBold(e, troveIdX, boldAmount, maxUpfrontFeeX) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    
    uint256 maxUpfrontFeeY;
    withdrawBold(e, troveIdY, boldAmount, maxUpfrontFeeY) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    
    assert troveDataX_after.accruedInterest == troveDataY_after.accruedInterest,"interest should be the same";
}

// recordedDebt
// STATUS: TIMEOUT
// https://prover.certora.com/output/11775/c495e5a91e2c4e70957ada2e65d329fa?anonymousKey=945a5494c6fe9ceebd9c0a4987b8054f9d8ac013
rule troveBatchTroveEquivalenceWithdrawBold_recordedDebt(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;
    
    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);
    
    require troveBatchTroveEquivalent_(troveIdX, troveIdY, troveDataX_before, troveDataY_before);

    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);
    
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    // TODO: need to prove this
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    storage init = lastStorage;
    uint256 boldAmount;
    uint256 maxUpfrontFeeX;
    withdrawBold(e, troveIdX, boldAmount, maxUpfrontFeeX) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    
    uint256 maxUpfrontFeeY;
    withdrawBold(e, troveIdY, boldAmount, maxUpfrontFeeY) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    
    assert troveDataX_after.recordedDebt == troveDataY_after.recordedDebt,"recordedDebt should be the same";
}

// redistribution debt/coll gains and  recorded collateral
// STATUS: TIMEOUT
// https://prover.certora.com/output/11775/5492b6fafa4949a6baa4f3b5c0469121?anonymousKey=2a2552e32ed5aed50161c2bfcfbe667e86dd8ebe
rule troveBatchTroveEquivalenceWithdrawBold_gainsColl(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;

    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);
    
    require troveBatchTroveEquivalent_(troveIdX, troveIdY, troveDataX_before, troveDataY_before);

    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);
    
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    // TODO: need to prove this
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    storage init = lastStorage;
    uint256 boldAmount;
    uint256 maxUpfrontFeeX;
    withdrawBold(e, troveIdX, boldAmount, maxUpfrontFeeX) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    uint256 troveIdX_coll_after                   = troveManager.Troves[troveIdX].coll;
    
    uint256 maxUpfrontFeeY;
    withdrawBold(e, troveIdY, boldAmount, maxUpfrontFeeY) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    uint256 troveIdY_coll_after                   = troveManager.Troves[troveIdY].coll;
    
    assert troveIdX_coll_after                       == troveIdY_coll_after,"coll should be the same";
    assert troveDataX_after.redistBoldDebtGain       == troveDataY_after.redistBoldDebtGain,"debt gain should be the same";
    assert troveDataX_after.redistCollGain           == troveDataY_after.redistCollGain,"coll gain should be the same";
}

//////////////// Decreasing Debt /////////////////////

// accruedInterest
// STATUS: IN-FLIGHT
// https://prover.certora.com/output/11775/b2e51aa16c5d482dbcab41642a9cf0ad?anonymousKey=bfa721df574d80bc737a26d285fb89efee0a6c52
rule troveBatchTroveEquivalenceRepayBold_accruedInterest(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;

    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);
    
    require troveBatchTroveEquivalent_(troveIdX, troveIdY, troveDataX_before, troveDataY_before);

    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);
    
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    // TODO: need to prove this
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;
    
    storage init = lastStorage;
    uint256 boldAmount;
    repayBold(e, troveIdX, boldAmount) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    
    repayBold(e, troveIdY, boldAmount) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    
    assert troveDataX_after.accruedInterest == troveDataY_after.accruedInterest,"interest should be the same";
}

// recordedDebt
// STATUS: IN-FLIGHT
// https://prover.certora.com/output/11775/6dfc9dac03e842f3ac035b62601f5a2a?anonymousKey=a1ab313fe21417015f773056788b79db4cc373a0
rule troveBatchTroveEquivalenceRepayBold_recordedDebt(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;
    
    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);
    
    require troveBatchTroveEquivalent_(troveIdX, troveIdY, troveDataX_before, troveDataY_before);

    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);
    
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    // TODO: need to prove this
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    storage init = lastStorage;
    uint256 boldAmount;
    repayBold(e, troveIdX, boldAmount) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    
    repayBold(e, troveIdY, boldAmount) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    
    assert troveDataX_after.recordedDebt == troveDataY_after.recordedDebt,"recordedDebt should be the same";
}

// redistribution debt/coll gains and  recorded collateral
// STATUS: IN-FLIGHT
// https://prover.certora.com/output/11775/f307269c58854ceba18a4e314cdd92c7?anonymousKey=5d8e417dbcda394043c35afc86bd42e57b964e77
rule troveBatchTroveEquivalenceRepayBold_gainsColl(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;

    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);
    
    require troveBatchTroveEquivalent_(troveIdX, troveIdY, troveDataX_before, troveDataY_before);

    require troveRewardsUpdated(troveIdX);
    require troveRewardsUpdated(troveIdY);
    
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    storage init = lastStorage;
    uint256 boldAmount;
    repayBold(e, troveIdX, boldAmount) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    uint256 troveIdX_coll_after                   = troveManager.Troves[troveIdX].coll;
    
    repayBold(e, troveIdY, boldAmount) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    uint256 troveIdY_coll_after                   = troveManager.Troves[troveIdY].coll;
    
    assert troveIdX_coll_after                       == troveIdY_coll_after,"coll should be the same";
    assert troveDataX_after.redistBoldDebtGain       == troveDataY_after.redistBoldDebtGain,"debt gain should be the same";
    assert troveDataX_after.redistCollGain           == troveDataY_after.redistCollGain,"coll gain should be the same";
}


//////////////////////////////// Additional helper invariants ///////////////////////////////////////////////

// Troves[troveId].lastDebtUpdateTime <= currentTime
// STATUS: PASSING
// https://prover.certora.com/output/11775/4161f4281f384522806db36bd10ff4bc?anonymousKey=304b53c59ccdf0f61f5cb4c3a136bc641b295587
invariant troveLastUpdatedTimeLECurrentTime(env e, uint256 troveId)
    troveManager.Troves[troveId].lastDebtUpdateTime <= e.block.timestamp

    {
        preserved with (env e1) {
            require e1.block.timestamp <= e.block.timestamp;
        }
    }