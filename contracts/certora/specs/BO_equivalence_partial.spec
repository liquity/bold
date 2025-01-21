import "./ERC20/erc20cvl.spec";
import "./ERC20/WETHcvl.spec";
import "./setup/builtin_assertions.spec";
import "./Common.spec";

using TroveManager as troveManager;

// optimizing summaries
methods {
    function SafeERC20._callOptionalReturn(address token, bytes memory data) internal => NONDET;
    // contributes to non-linearity
    function _.fetchPrice() external => NONDET;

    function SortedTroves.insert(uint256 _id, uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) external => NONDET;

    // Without this, sanity will timeout. https://certora.atlassian.net/browse/CERT-7097
    // With the 2 explicit summarizations above, sanity will fail. https://certora.atlassian.net/browse/CERT-7108
    function SortedTroves._ external => NONDET;
    
    function _.WETH() external => NONDET;
    function _.CCR() external  => NONDET;
    function _.SCR() external  => NONDET;
    function _.MCR() external  => NONDET;

    function _.receiveColl() external => NONDET;
    
    function _calcUpfrontFee(uint256 debt, uint256 interestRate) internal returns (uint256) => upFrontFee[debt][interestRate];
    function LiquityBase._calcInterest(uint256 _weightedDebt, uint256 _period) internal returns (uint256) => ALWAYS(0);
    function LiquityMath._computeCR(uint256 _coll, uint256 _debt, uint256 _price) internal returns (uint256) => NONDET;
    function ActivePool.calcPendingAggInterest() external returns (uint256) => ALWAYS(0);
    function ActivePool._mintAggInterest(address _boldToken, uint256 _upfrontFee) internal returns (uint256) => NONDET;
}

//////////////////// Ghosts ///////////////////////////////

ghost mapping(uint256 => mapping(uint256 => uint256)) upFrontFee;

/////////////////// CVL Functions /////////////////////////

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

function troveBatchTroveEquivalent_(env e, uint256 troveIdX, uint256 troveIdY,
                                    TroveManager.LatestTroveData troveDataX, 
                                    TroveManager.LatestTroveData troveDataY) returns bool{
    return (troveManager.Troves[troveIdX].coll  == troveManager.Troves[troveIdY].coll   &&
            troveManager.Troves[troveIdX].stake == troveManager.Troves[troveIdY].stake  &&
            troveDataX.accruedInterest          == troveDataY.accruedInterest           &&
            troveDataX.recordedDebt             == troveDataY.recordedDebt              &&
            troveDataX.redistBoldDebtGain       == troveDataY.redistBoldDebtGain        &&
            troveDataX.redistCollGain           == troveDataY.redistCollGain);
}

// `

/*-----------------------------------------------------------------------------------------------------------------
///////////////////////////////////// Trove - batch trove equivalance //////////////////////////////////////////////
----------------------------------------------------------------------------------------------------------------- */
// "For individual Trove i and batch Trove j in the same branch where i != j, and i and j have equivalence E:

// E: (recorded_coll_i, recorded_debt_i, accrued_interest_i, stake_i, redistribution_debt_gain_i, redistribution_coll_gain_i) = (recorded_coll_j, recorded_debt_j, accrued_interest_j, stake_j, redistribution_debt_gain_j, redistribution_coll_gain_j) 

// Then, the following pairs of simultaneous actions maintain equivalence E:




//////////////////////////////////////////// Collateral adjustment /////////////////////////////////////////////////

// -An adjustment of Trove i and an adjustment of batch Trove j that changes their recorded collateral by the same amount

//////////////// Adding Collateral /////////////////////


// recordedDebt
// STATUS: VERIFIED
// https://vaas-stg.certora.com/output/11775/5365ab00333f49d29a7bc89ce596075f?anonymousKey=d1123309af27b89dd7947096457605f446c73d3d
rule troveBatchTroveEquivalenceAddColl_recordedDebt(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    // adding this to avoid management fee that can cause deviation from a non-batch trove
    require troveManager.batches[batchAddress].annualManagementFee == 0;

    env e;
    
    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);
    
    TroveManager.LatestBatchData batchData_before= troveManager.getLatestBatchData(e, batchAddress);

    require troveBatchTroveEquivalent_(e, troveIdX, troveIdY, troveDataX_before, troveDataY_before);

    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    require batch_manager_storage_locations_agree(troveIdY);
    require batch_manager_storage_locations_agree(troveIdX);

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    // assuming total shares of the batch > 0
    require troveManager.batches[batchAddress].totalDebtShares > 0;

    
    uint256 _batchDebtShares = troveManager.Troves[troveIdY].batchDebtShares;
    uint256 _totalDebtShares = troveManager.batches[batchAddress].totalDebtShares;
    
    // requiring this since redistBoldDebtGain gets added to batch debt and then pro rated to batch trove
    require troveDataX_before.redistBoldDebtGain == troveDataY_before.redistBoldDebtGain * _batchDebtShares / _totalDebtShares;

    require debt_and_shares_relationship(troveIdY, batchAddress, batchData_before, troveDataY_before);

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
// https://vaas-stg.certora.com/output/11775/9fea33ae5343403dad8373284cbf03da?anonymousKey=1433e989df37699a4c8c81d317f894f9bcd2492d
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

// stake
// STATUS: VERIFIED
// https://vaas-stg.certora.com/output/11775/8fbcb6a01ec24ed0bad3a89ec12e77ba?anonymousKey=1c920b9cb828e0622850de308f8056b7f844fcc9
rule troveBatchTroveEquivalenceAddColl_stake(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;
    require troveBatchTroveEquivalent(e, troveIdX, troveIdY);

    storage init = lastStorage;
    uint256 collAmount;
    addColl(e, troveIdX, collAmount) at init;

    uint256 troveIdX_stake_after = troveManager.Troves[troveIdX].stake;
    
    addColl(e, troveIdY, collAmount) at init;
    
    uint256 troveIdY_stake_after = troveManager.Troves[troveIdY].stake;
    
    assert troveIdX_stake_after == troveIdY_stake_after,"stake should be the same";
}


//////////////// Decreasing Collateral /////////////////////

// recordedDebt
// STATUS: VERIFIED
// https://vaas-stg.certora.com/output/11775/9e7b201012e04f1780fe0fe2335ac0a3?anonymousKey=fa820c490755f8b5ee9c81068e71690e62f835cf
rule troveBatchTroveEquivalenceWithdrawColl_recordedDebt(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    // adding this to avoid management fee that can cause deviation from a non-batch trove
    require troveManager.batches[batchAddress].annualManagementFee == 0;

    env e;
    
    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);

    TroveManager.LatestBatchData batchData_before= troveManager.getLatestBatchData(e, batchAddress);
    
    require troveBatchTroveEquivalent_(e, troveIdX, troveIdY, troveDataX_before, troveDataY_before);
    
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);

    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    require batch_manager_storage_locations_agree(troveIdX);
    require batch_manager_storage_locations_agree(troveIdY);

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    // assuming total shares of the batch > 0
    require troveManager.batches[batchAddress].totalDebtShares > 0;

    uint256 _batchDebtShares = troveManager.Troves[troveIdY].batchDebtShares;
    uint256 _totalDebtShares = troveManager.batches[batchAddress].totalDebtShares;
    
    // requiring this since redistBoldDebtGain gets added to batch debt and then pro rated to batch trove
    require troveDataX_before.redistBoldDebtGain == troveDataY_before.redistBoldDebtGain * _batchDebtShares / _totalDebtShares;

    require debt_and_shares_relationship(troveIdY, batchAddress, batchData_before, troveDataY_before);

    storage init = lastStorage;
    uint256 collAmount;
    withdrawColl(e, troveIdX, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    
    withdrawColl(e, troveIdY, collAmount) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    
    assert troveDataX_after.recordedDebt == troveDataY_after.recordedDebt,"recordedDebt should be the same";
}

// redistribution debt/coll gains and  recorded collateral
// STATUS: VERIFIED
// https://vaas-stg.certora.com/output/11775/d9e9d6ea0521456e882c6dec67e9a81a?anonymousKey=19ad554e6d8a57df250cea8370a98025109c0635
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

// stake
// STATUS: VERIFIED
// https://vaas-stg.certora.com/output/11775/ad0f8923b3a849b381ba6f79fb958551?anonymousKey=2cc668b10691e138f47b6c5bf35b018eb3f29276
rule troveBatchTroveEquivalenceWithdrawColl_stake(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;
    require troveBatchTroveEquivalent(e, troveIdX, troveIdY);

    storage init = lastStorage;
    uint256 collAmount;
    withdrawColl(e, troveIdX, collAmount) at init;

    uint256 troveIdX_stake_after = troveManager.Troves[troveIdX].stake;
    
    withdrawColl(e, troveIdY, collAmount) at init;
    
    uint256 troveIdY_stake_after = troveManager.Troves[troveIdY].stake;
    
    assert troveIdX_stake_after == troveIdY_stake_after,"stake should be the same";
}



//////////////////////////////////////////// Debt adjustment /////////////////////////////////////////////////

// -An adjustment of Trove i and an adjustment of batch Trove j that changes their recorded debt by the same amount 

//////////////// Increasing Debt /////////////////////

// recordedDebt
// with shares to debt scalar multiplier of 1 and 1e9
// STATUS: VERIFIED
// https://vaas-stg.certora.com/output/11775/abbccfbca73143f28adb2fb36f0b2f12?anonymousKey=13c7b3527292b231499182a0528b6079dd28a55e
rule troveBatchTroveEquivalenceWithdrawBold_recordedDebt(){
    env e;
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;
    // adding this to avoid management fee that can cause deviation from a non-batch trove
    require troveManager.batches[batchAddress].annualManagementFee == 0;
    
    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);
    TroveManager.LatestBatchData batchData_before= troveManager.getLatestBatchData(e, batchAddress);
    
    require troveBatchTroveEquivalent_(e, troveIdX, troveIdY, troveDataX_before, troveDataY_before);
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);
    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    require batch_manager_storage_locations_agree(troveIdX);
    require batch_manager_storage_locations_agree(troveIdY);
    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;
    // assuming total shares of the batch > 0
    require troveManager.batches[batchAddress].totalDebtShares > 0;

    uint256 _batchDebtShares = troveManager.Troves[troveIdY].batchDebtShares;
    uint256 _totalDebtShares = troveManager.batches[batchAddress].totalDebtShares;
    
    // requiring this since redistBoldDebtGain gets added to batch debt and then pro rated to batch trove
    require troveDataX_before.redistBoldDebtGain == troveDataY_before.redistBoldDebtGain * _batchDebtShares / _totalDebtShares;

    require debt_and_shares_relationship(troveIdY, batchAddress, batchData_before, troveDataY_before);

    // requiring that the batch total shares are a scalar multiple of the batch recordedDebt
    uint256 share_debt_scalar;
    require share_debt_scalar == 1 || share_debt_scalar == 1000000000;
    require num_shares_num_debt_assumption(share_debt_scalar, batchData_before, batchAddress);

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
// STATUS: VERIFIED
// https://vaas-stg.certora.com/output/11775/355e4a71be3b499f821cfb4f8792a58e?anonymousKey=5598175e06e5988c8410316421a73a2c904539c3
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
    
    require troveBatchTroveEquivalent_(e, troveIdX, troveIdY, troveDataX_before, troveDataY_before);
    
    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    require batch_manager_storage_locations_agree(troveIdX);

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


// stake
// STATUS: VERIFIED
// https://vaas-stg.certora.com/output/11775/7c1705d5d6c24f9daf61b6a4cdd647fc?anonymousKey=98bb7c1cb2fa0ea0338fce9a4c199c50aea46d8e
rule troveBatchTroveEquivalenceWithdrawBold_stake(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;
    require troveBatchTroveEquivalent(e, troveIdX, troveIdY);

    storage init = lastStorage;
    uint256 boldAmount;
    uint256 maxUpfrontFeeX;
    withdrawBold(e, troveIdX, boldAmount, maxUpfrontFeeX) at init;

    uint256 troveIdX_stake_after = troveManager.Troves[troveIdX].stake;
    
    uint256 maxUpfrontFeeY;
    withdrawBold(e, troveIdY, boldAmount, maxUpfrontFeeY) at init;
    
    uint256 troveIdY_stake_after = troveManager.Troves[troveIdY].stake;
    
    assert troveIdX_stake_after == troveIdY_stake_after,"stake should be the same";
}

//////////////// Decreasing Debt /////////////////////

// recordedDebt
// STATUS: VERIFIED
// https://vaas-stg.certora.com/output/11775/95d5d66774c2445cbdbe5b6b3f2c952b?anonymousKey=49a47727edd049074274796d5462bc4f7901af4b
rule troveBatchTroveEquivalenceRepayBold_recordedDebt(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    // adding this to avoid management fee that can cause deviation from a non-batch trove
    require troveManager.batches[batchAddress].annualManagementFee == 0;
    
    env e;
    
    TroveManager.LatestTroveData troveDataX_before = troveManager.getLatestTroveData(e, troveIdX);
    
    TroveManager.LatestTroveData troveDataY_before  = troveManager.getLatestTroveData(e, troveIdY);

    TroveManager.LatestBatchData batchData_before= troveManager.getLatestBatchData(e, batchAddress);
    
    require troveBatchTroveEquivalent_(e, troveIdX, troveIdY, troveDataX_before, troveDataY_before);

    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    require batch_manager_storage_locations_agree(troveIdX);
    require batch_manager_storage_locations_agree(troveIdY);

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    // assuming total shares of the batch > 0
    require troveManager.batches[batchAddress].totalDebtShares > 0;

    uint256 _batchDebtShares = troveManager.Troves[troveIdY].batchDebtShares;
    uint256 _totalDebtShares = troveManager.batches[batchAddress].totalDebtShares;
    
    // requiring this since redistBoldDebtGain gets added to batch debt and then pro rated to batch trove
    require troveDataX_before.redistBoldDebtGain == troveDataY_before.redistBoldDebtGain * _batchDebtShares / _totalDebtShares;

    require debt_and_shares_relationship(troveIdY, batchAddress, batchData_before, troveDataY_before);
    
    // requiring that the batch total shares are a scalar multiple of the batch recordedDebt
    uint256 share_debt_scalar;
    require share_debt_scalar == 1 || share_debt_scalar == 1000000000 || share_debt_scalar == 10^9 - 5 || share_debt_scalar == 2;
    require num_shares_num_debt_assumption(share_debt_scalar, batchData_before, batchAddress);

    storage init = lastStorage;
    uint256 boldAmount;
    repayBold(e, troveIdX, boldAmount) at init;
    
    TroveManager.LatestTroveData troveDataX_after = troveManager.getLatestTroveData(e, troveIdX);
    
    repayBold(e, troveIdY, boldAmount) at init;
    
    TroveManager.LatestTroveData troveDataY_after = troveManager.getLatestTroveData(e, troveIdY);
    
    assert troveDataX_after.recordedDebt == troveDataY_after.recordedDebt,"recordedDebt should be the same";
}

// redistribution debt/coll gains and  recorded collateral
// STATUS: VERIFIED
// https://vaas-stg.certora.com/output/11775/47f52cb0cb9f47ef84f9a85db2efda98?anonymousKey=db65484e53ff3b0f1f05941d930429969fed048c
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
    
    require troveBatchTroveEquivalent_(e, troveIdX, troveIdY, troveDataX_before, troveDataY_before);

    // adding to get around the CEX where block timestamp is more than max uint64 and lastDebtUpdate gets 
    // stored as a smaller value than previous due to overflow causing a higher period to lead to higher accrued interest
    require trove_trove_valid_eq_timestamp(e, troveIdX, troveIdX);


    // adding this to get around the CEX where BorrowerOperations.interestBatchManagerOf is not the same as the batch manager
    require batch_manager_storage_locations_agree(troveIdY);

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


// stake
// STATUS: VERIFIED
// https://vaas-stg.certora.com/output/11775/f0a580b2edc24913846047098d65ca1c?anonymousKey=b2fd2de8de536cfee05625a21dd8f5cef49f3be4
rule troveBatchTroveEquivalenceRepayBold_stake(){
    uint256 troveIdX;
    uint256 troveIdY;
    address batchAddress;
    require batchAddress != 0;
    require getBatchManager(troveIdX) == 0;
    require getBatchManager(troveIdY) == batchAddress;

    env e;
    require troveBatchTroveEquivalent(e, troveIdX, troveIdY);

    storage init = lastStorage;
    uint256 boldAmount;

    repayBold(e, troveIdX, boldAmount) at init;

    uint256 troveIdX_stake_after = troveManager.Troves[troveIdX].stake;
    
    repayBold(e, troveIdY, boldAmount) at init;
    
    uint256 troveIdY_stake_after = troveManager.Troves[troveIdY].stake;
    
    assert troveIdX_stake_after == troveIdY_stake_after,"stake should be the same";
}
