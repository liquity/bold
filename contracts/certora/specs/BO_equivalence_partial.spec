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
    
    // depepnds on 2 state variables totalStakesSnapshot / totalCollateralSnapshot
    // function TroveManager._computeNewStake(uint _coll) internal returns (uint) => NONDET;

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
// https://vaas-stg.certora.com/output/11775/f2e2dc2a7caf4261bf07b0a012fb5d0f?anonymousKey=b037c668f873a9a2e50ace15ead6b45a12c8c2d5
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
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;
    require currentContract.interestBatchManagerOf[troveIdX] == 0;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    // assuming batch debt shares of a trove are less than total shares for of the batch
    require troveManager.Troves[troveIdY].batchDebtShares <= troveManager.batches[batchAddress].totalDebtShares;
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

// stake
// STATUS: VERIFIED
// https://prover.certora.com/output/11775/2816ed9a1f234fcab23c916ff1b7738a?anonymousKey=080c5257964d7136a661079504d57cd8a5a14dd2
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
// https://vaas-stg.certora.com/output/11775/d2f03e55d10141f1b924ed9ccc4b1f12?anonymousKey=4453fbefe80131b366498ab2650ef330aaffcc83
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
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;
    require currentContract.interestBatchManagerOf[troveIdX] == 0;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    // assuming batch debt shares of a trove are less than total shares for of the batch
    require troveManager.Troves[troveIdY].batchDebtShares <= troveManager.batches[batchAddress].totalDebtShares;
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
// https://vaas-stg.certora.com/output/40748/28e0c8aa514b41b497e9318c11312909?anonymousKey=4f1672843167e3f9c219d3ee87a3f83fdc7579c4
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
// https://prover.certora.com/output/11775/6cf00c6171344acebd1d3b3a97e7f4f6?anonymousKey=02e47532cd3e760c863823f50a39fe086066a714
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
// STATUS: VERIFIED
// https://vaas-stg.certora.com/output/11775/0ff12f388c9247fba86e5e328a8b90c7?anonymousKey=1b4367d940c12ca9c69e2226ae858cf49e1dd3e5
rule troveBatchTroveEquivalenceWithdrawBold_recordedDebt(){
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
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;
    require currentContract.interestBatchManagerOf[troveIdX] == 0;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    // assuming batch debt shares of a trove are less than total shares for of the batch
    require troveManager.Troves[troveIdY].batchDebtShares <= troveManager.batches[batchAddress].totalDebtShares;
    require troveManager.batches[batchAddress].totalDebtShares > 0;

    
    uint256 _batchDebtShares = troveManager.Troves[troveIdY].batchDebtShares;
    uint256 _totalDebtShares = troveManager.batches[batchAddress].totalDebtShares;
    
    // requiring this since redistBoldDebtGain gets added to batch debt and then pro rated to batch trove
    require troveDataX_before.redistBoldDebtGain == troveDataY_before.redistBoldDebtGain * _batchDebtShares / _totalDebtShares;

    require debt_and_shares_relationship(troveIdY, batchAddress, batchData_before, troveDataY_before);

    require num_shares_num_debt_assumption(batchData_before, batchAddress);

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
// https://vaas-stg.certora.com/output/11775/ddeb6832e10d4736ad3fa33b59997cf9?anonymousKey=4ebd5aee5eb785e9684b44c815cb5acf404ee9bc
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


// stake
// STATUS: VERIFIED
// https://prover.certora.com/output/11775/d318729e27964eb3b1fc4c7d25ec3971?anonymousKey=9659ac3bf1c0b26c4ee4de0834a10cfe60d1e674
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
// https://vaas-stg.certora.com/output/11775/26ec5349b7674587a53e55bc5cabbcb0?anonymousKey=0bc4f01f799c5e1b80b6a50fbf9f473f7bdfb1ba
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
    require currentContract.interestBatchManagerOf[troveIdY] == batchAddress;
    require currentContract.interestBatchManagerOf[troveIdX] == 0;

    // confirmed by the liquity team as one of the pre-conditions
    require troveDataX_before.annualInterestRate == troveManager.batches[batchAddress].annualInterestRate;

    // assuming batch debt shares of a trove are less than total shares for of the batch
    require troveManager.Troves[troveIdY].batchDebtShares <= troveManager.batches[batchAddress].totalDebtShares;
    require troveManager.batches[batchAddress].totalDebtShares > 0;

    uint256 _batchDebtShares = troveManager.Troves[troveIdY].batchDebtShares;
    uint256 _totalDebtShares = troveManager.batches[batchAddress].totalDebtShares;
    
    // requiring this since redistBoldDebtGain gets added to batch debt and then pro rated to batch trove
    require troveDataX_before.redistBoldDebtGain == troveDataY_before.redistBoldDebtGain * _batchDebtShares / _totalDebtShares;

    require debt_and_shares_relationship(troveIdY, batchAddress, batchData_before, troveDataY_before);

    require num_shares_num_debt_assumption(batchData_before, batchAddress);

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
// https://vaas-stg.certora.com/output/11775/65fe4818c79e421ca07030dd2bb14726?anonymousKey=2a37718f20265ebab9ea2d25d1d111e594435ecf
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


// stake
// STATUS: VERIFIED
// https://prover.certora.com/output/11775/88395440eff2411f90007bfc3ce8ac0d?anonymousKey=6521bcac25f5ecc590d0dfaf3702d18c3e288505
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
