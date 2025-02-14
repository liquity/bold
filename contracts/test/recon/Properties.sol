// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {Asserts} from "@chimera/Asserts.sol";
import {BeforeAfter} from "./BeforeAfter.sol";

import {MIN_DEBT} from "../../src/Dependencies/Constants.sol";
import {LatestBatchData} from "../../src/Types/LatestBatchData.sol";
import {BatchId} from "../../src/Types/BatchId.sol";
import {SortedTroves} from "../../src/SortedTroves.sol";
import {LatestTroveData} from "../../src/Types/LatestTroveData.sol";


abstract contract Properties is BeforeAfter, Asserts {

    /// === NOT IMPLEMENTED === ///

    function property_SR01(uint256 troveId) internal {
        (, uint256 tail) = sortedTroves.batches(BatchId.wrap(_getActor()));
        eq(tail, troveId, "SR-01: Troves should always be added to the end of a batch in SortedTroves");
    }


    function property_TR04(uint256 expectedDelta, uint256 debtAfter, uint256 debtBefore, uint256 fee) internal {
        // needs to take input value of the expected debt change
        eq(expectedDelta, (debtAfter - debtBefore) - fee, "TR-04: excluding update/open fee, trove debt delta is the debtIncrease - debtDecrease");
    }

    // NOTE: You should implement this
    function property_TR06(uint256 troveDebtBeforeLiquidation, uint256 beforeGhostDebtAccumulator, uint256 afterGhostDebtAccumulator) internal {
        // checking debt redistribution 
        // current setup only uses one _getActor() so can just sum over all troves in system for the _getActor()'s debt
        uint256 debtPercentageOfTotal = (beforeGhostDebtAccumulator / borrowerOperations.getEntireSystemDebt()) * 10_000;

        // check that increase in debt was proportional to their percentage of total
        // total system debt should increase by debtPercentageOfTotal * liqAmount
        uint256 debtDelta = afterGhostDebtAccumulator - beforeGhostDebtAccumulator;
        eq(debtPercentageOfTotal * debtDelta, debtPercentageOfTotal * troveDebtBeforeLiquidation, "TR-06: Contribution of user collateral should be equal to the percent offered in a liquidation");
    }


    // TODO: More basic liquity properties
    
    // User should never be able to self liquidate via one action

    // SP & Batch Manager stuff I'm not super sure of

    /// === Liqutiy Basic Properties === ///
    // All troves that are active must have debt above the MIN_DEBT  -> TODO GOOD PROPERTY   
    // GetDebt > MIN_DETB
    function property_active_troves_are_above_MIN_DEBT() public {
        uint256 trove = sortedTroves.getFirst(); /// NOTE: Troves in ST are active
        while(trove != 0) {
            uint256 debt = troveManager.getTroveEntireDebt(trove);
            gte(debt, MIN_DEBT, "Must have min debt");

            trove = sortedTroves.getNext(trove);
        }
    }

    function property_CS04() public {
        // check collateral balance dependent on the collateral of the activeBranch
        uint256 collSurplusPoolBalanceWeth = collToken.balanceOf(address(collSurplusPool));
        gte(collSurplusPoolBalanceWeth, collSurplusPool.getCollBalance(), "CS-04: collSurplusPool balance  > getCollBalance");
    }

    function property_CS05() public {
        // NOTE: for multi-_getActor() setup this would need to sum over all actors 
        uint256 accountBalances = collSurplusPool.getCollateral(_getActor());
        uint256 poolBalance = collSurplusPool.getCollBalance();
        eq(accountBalances, poolBalance, "CS-05: sum of _getActor() collaterals should equal pool collateral balance");
    }

    function property_TR03() public {
        // loop through all troves 
        uint256 troveArrayLength = troveManager.getTroveIdsCount();
        for(uint256 i; i < troveArrayLength; i++) {
            uint256 troveId = troveManager.getTroveFromTroveIdsArray(i);
            // check if trove has pending debt/coll redistribution
            (uint256 collateralForDistribution, uint256 boldDebtForDistribution) = troveManager.rewardSnapshots(troveId);
            if(boldDebtForDistribution > 0 || collateralForDistribution > 0) {
                // store current values for trove debt/coll
                (uint256 debt, uint256 coll,,,,,,,,) = troveManager.Troves(troveId);
                // call getLatestTroveData to update
                LatestTroveData memory troveData = troveManager.getLatestTroveData(troveId);
                
                // check if debt/coll increased
                if(boldDebtForDistribution > 0) {
                    gte(troveData.entireDebt, debt, "TR-03: getLatestTroveData always returns up-to-date, post-accrual debt value");
                } else if(collateralForDistribution > 0) {
                    gte(troveData.entireColl, coll, "TR-03: getLatestTroveData always returns up-to-date, post-accrual collateral value");
                } else {
                    gte(troveData.entireDebt, debt, "TR-03: getLatestTroveData always returns up-to-date, post-accrual debt value");
                    gte(troveData.entireColl, coll, "TR-03: getLatestTroveData always returns up-to-date, post-accrual collateral value");
                }
            }
        }
    }


    // If there's a batch maanger
    // And they have 0 shares, then they have 0 debt
    // if they have 0 debt then they have 0 shares
    // NOTE: Can be massively expanded
    function property_BT01() public {
        // NOTE: Could be extended to check on unclamped
        (uint256 debt, uint256 shares) = troveManager.getbatchDebtAndShares(clampedBatchManager);

        if(debt == 0) {
            eq(shares, 0, "Must have 0 shares on 0 debt");
        }
        if(shares == 0) {
            eq(debt, 0, "Must have 0 debt on 0 shares");
        }
    }

    function property_SR02() public {
        // get first node of the linked-list 
        uint256 firstNode = sortedTroves.getFirst();
        uint256 listSize = sortedTroves.getSize();

        if(listSize < 2) {
            return; // It will loop around and mess things up
        }

        uint256 currentNodeId = firstNode; // start search from the first node

        uint256 previousNodeId;
        for(uint256 i; i < listSize + 1; i++) {
            (uint256 nextId, uint256 prevId,,) = sortedTroves.nodes(currentNodeId);

            if(nextId == firstNode) {
                // if the nextId is same as the firstNode, the list has looped around
                break;
            }
            
            // descend down the list and verify that the debt of each subsequent node is smaller than the previous
            if(previousNodeId != 0) {
                uint256 currentAnnualInterestRate = troveManager.getTroveInterestRate(currentNodeId);
                uint256 nextAnnualInterestRate  = troveManager.getTroveInterestRate(nextId);
                gte(currentAnnualInterestRate, nextAnnualInterestRate, "SR-02: Troves are sorted by interest rate in descending order");
            } 

            // update current/previous node
            previousNodeId = currentNodeId;
            currentNodeId = nextId;
        }
    }

    /// === Ghost variables === ///
    function property_BA01() public {
        eq(_after.ghostWeightedRecordedDebtAccumulator, _after.weightedRecordedDebtAccumulator, "BA-01: For all operations, weightedRecordedDebt is equal to the sum of trove debt * rate");
    }
    function property_weighted_sum() public {

    }

    function property_CP01() public {
        if(_after.entireSystemDebt > _after.ghostDebtAccumulator + 1e18) {
            t(false, "CP-01: Total debt == SUM(userDebt) - With precision");
        }

        if(_after.entireSystemDebt < _after.ghostDebtAccumulator - 1e18) {
            t(false, "CP-01: Total debt == SUM(userDebt) - With precision");
        }
        // NOTE: Changed from exact to have bounds
        // eq(_after.entireSystemDebt, _after.ghostDebtAccumulator, "CP-01: Total debt == SUM(userDebt)");
    }


    function property_CS01() public {
       t(_before.collSurplusBalance >= _after.collSurplusBalance, "CS-01: Collateral surplus balances can increase only after a liquidation");
    }

    function property_BT02() public {        
        
        if(_before.batches[_getActor()].totalDebtShares == 0 && _after.batches[_getActor()].totalDebtShares == 0) return; 

        uint256 ppfsBefore;
        uint256 ppfsAfter;

        if(_before.batches[_getActor()].totalDebtShares != 0) ppfsBefore = _before.batches[_getActor()].debt / _before.batches[_getActor()].totalDebtShares;
        else ppfsBefore = 0;

        if(_after.batches[_getActor()].totalDebtShares != 0) ppfsAfter = _after.batches[_getActor()].debt / _after.batches[_getActor()].totalDebtShares;
        else ppfsAfter = 0;

        if(_after.batches[_getActor()].debt != 0) {
            gte(ppfsAfter, ppfsBefore, "BT-02: Batch share PPFS always increases, unless the total debt in the batch is reset to 0");
        }
    }

    function property_BT05() public {
        if(_before.batches[_getActor()].totalDebtShares == 0 && _after.batches[_getActor()].totalDebtShares == 0) return;

        // PPFS = Debt / Shares for a batch
        // current setup permits only one batch because have one _getActor(), so can query it from TM directly 
        uint256 ppfsBefore;
        uint256 ppfsAfter;

        if(_before.batches[_getActor()].totalDebtShares != 0) ppfsBefore = _before.batches[_getActor()].debt / _before.batches[_getActor()].totalDebtShares;
        else ppfsBefore = 0;

        if(_after.batches[_getActor()].totalDebtShares != 0) ppfsAfter = _after.batches[_getActor()].debt / _after.batches[_getActor()].totalDebtShares;
        else ppfsAfter = 0;
        
        // Assert that the Debt / Shares should never double (should never go to 2 times Debt / Shares)
        t(ppfsAfter != ppfsBefore * 2, "BT-05: PPFS (debt /shares) should never double");
    }

    function property_AP01() public {
        eq(_after.ghostWeightedRecordedDebtAccumulator, activePool.aggWeightedDebtSum(), "AP-01: newAggWeightedDebtSum == aggRecordedDebt if all troves have been synced in this block");
    }

    function property_sum_of_batches_debt_and_shares() public {
        if(clampedBatchManager == address(0)) {
            return;
        }
        // total debt
        (uint256 batchDebt, uint256 batchShares) = troveManager.getbatchDebtAndShares(clampedBatchManager);

        (uint256 sumBatchDebt, uint256 sumbBatchShares) = _sumBatchSharesAndDebt(clampedBatchManager);

        eq(batchShares, sumbBatchShares, "Sum of batch shares matches");
        eq(batchDebt, sumBatchDebt, "Sum of batch debt matches");
    }

    function _sumBatchSharesAndDebt(address batchManager) internal returns (uint256 sumBatchDebt, uint256 sumbBatchShares) {

        uint256 trove = sortedTroves.getFirst(); /// NOTE: Troves in ST are active
        while(trove != 0) {
            
            if(borrowerOperations.interestBatchManagerOf(trove) == clampedBatchManager) {
                sumBatchDebt += troveManager.getTroveEntireDebt(trove);
                sumbBatchShares += troveManager.getTroveBatchDebtShares(trove); 
            }

            trove = sortedTroves.getNext(trove);
        }

        // Add lastZombieTroveId if necessary
        uint256 lastZombieTroveId = troveManager.lastZombieTroveId();
        if(borrowerOperations.interestBatchManagerOf(lastZombieTroveId) == clampedBatchManager) {
            sumBatchDebt += troveManager.getTroveEntireDebt(lastZombieTroveId);
            sumbBatchShares += troveManager.getTroveBatchDebtShares(lastZombieTroveId);
        }
    }


    // Optimization of loss on debt and inaccuracies  | AP_01

    // Optimization on SP math for both Debt and Coll (See if we can repro stuff)

    // TODO: Missing Debt Caps Properties
    // Missing Griefability of Debt Caps and Governance
    // TODO: Missing handlers for Superfluid Token
}
