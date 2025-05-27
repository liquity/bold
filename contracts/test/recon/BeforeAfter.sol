// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {Setup} from "./Setup.sol";

import {LatestTroveData} from "../../src/Types/LatestTroveData.sol";
import {LiquityMath} from "../../src/Dependencies/LiquityMath.sol";
import {TroveManager} from "../../src/TroveManager.sol";
import {MIN_DEBT} from "../../src/Dependencies/Constants.sol";

// ghost variables for tracking state variable values before and after function calls
abstract contract BeforeAfter is Setup {
   struct Vars {
        mapping(uint256 => LatestTroveData troveData) dataForTroves; //maps troveId to its given data
        mapping(address => TroveManager.Batch) batches;
        uint256 collSurplusBalance;
        uint256 ghostDebtAccumulator;
        uint256 entireSystemDebt;
        uint256 ghostWeightedRecordedDebtAccumulator;
        uint256 weightedRecordedDebtAccumulator;
        uint256 price;
    }

    Vars internal _before;
    Vars internal _after;

    modifier updateGhosts {
        __before();
        _;
        __after();
    }

    function __before() internal {
        _before.collSurplusBalance = collSurplusPool.getCollateral(_getActor());
        // always zero accumulators at start for clean summation
        _before.ghostDebtAccumulator = 0; 
        _before.ghostWeightedRecordedDebtAccumulator = 0;
        _before.weightedRecordedDebtAccumulator = 0;
        _before.price = priceFeed.getPrice();

        uint256 troveArrayLength = troveManager.getTroveIdsCount();
        for(uint256 i; i < troveArrayLength; i++) {
            uint256 troveId = troveManager.getTroveFromTroveIdsArray(i);
            borrowerOperations.applyPendingDebt(troveId, 0, 1); // NOTE: passing in static hints for simplicity because shouldn't have to worry about gas

            (uint256 debt, uint256 coll, uint64 arrayIndex, uint64 lastDebtUpdateTime, uint64 lastInterestRateAdjTime, uint256 annualInterestRate, uint256 annualManagementFee, uint256 totalDebtShares) = troveManager.getBatch(_getActor());
            
            _before.batches[_getActor()] = TroveManager.Batch(
                debt, 
                coll, 
                arrayIndex, 
                lastDebtUpdateTime, 
                lastInterestRateAdjTime, 
                annualInterestRate, 
                annualManagementFee, 
                totalDebtShares
            );
            _before.dataForTroves[troveId] = troveManager.getLatestTroveData(troveId);
            _before.ghostDebtAccumulator += _before.dataForTroves[troveId].entireDebt;
            _before.entireSystemDebt = borrowerOperations.getEntireBranchDebt();
            _before.ghostWeightedRecordedDebtAccumulator += (_before.dataForTroves[troveId].entireDebt * troveManager.getTroveInterestRate(troveId));
            _before.weightedRecordedDebtAccumulator += _before.dataForTroves[troveId].weightedRecordedDebt;
        } 
    }

    function __after() internal {
        _after.collSurplusBalance = collSurplusPool.getCollateral(_getActor());
        // always zero accumulators at start for clean summation
        _after.ghostDebtAccumulator = 0; 
        _after.ghostWeightedRecordedDebtAccumulator = 0;
        _after.weightedRecordedDebtAccumulator = 0;
        _after.price = priceFeed.getPrice();

        uint256 troveArrayLength = troveManager.getTroveIdsCount();
        for(uint256 i; i < troveArrayLength; i++) {
            uint256 troveId = troveManager.getTroveFromTroveIdsArray(i);
            borrowerOperations.applyPendingDebt(troveId, 0, 1); // NOTE: passing in static hints for simplicity because shouldn't have to worry about gas


            (uint256 debt, uint256 coll, uint64 arrayIndex, uint64 lastDebtUpdateTime, uint64 lastInterestRateAdjTime, uint256 annualInterestRate, uint256 annualManagementFee, uint256 totalDebtShares) = troveManager.getBatch(_getActor());
            
            _after.batches[_getActor()] = TroveManager.Batch(
                debt, 
                coll, 
                arrayIndex, 
                lastDebtUpdateTime, 
                lastInterestRateAdjTime, 
                annualInterestRate, 
                annualManagementFee, 
                totalDebtShares
            );
            _after.dataForTroves[troveId] = troveManager.getLatestTroveData(troveId);
            _after.ghostDebtAccumulator += _after.dataForTroves[troveId].entireDebt;
            _after.entireSystemDebt = borrowerOperations.getEntireBranchDebt();
            _after.ghostWeightedRecordedDebtAccumulator += (_after.dataForTroves[troveId].entireDebt * troveManager.getTroveInterestRate(troveId));
            _after.weightedRecordedDebtAccumulator += _after.dataForTroves[troveId].weightedRecordedDebt;

            // TODO: Missing Zombie Trove | lastZombieTrove  (NOTE: Technically a suite long enough will have more than one)
        }
    }
}
