
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseTargetFunctions} from "@chimera/BaseTargetFunctions.sol";
import {vm} from "@chimera/Hevm.sol";
import "forge-std/console2.sol";

import {Properties} from "../Properties.sol";

abstract contract OptimizationTargets is BaseTargetFunctions, Properties  {

    // == property_CP01 Optimization == //
    function optimize_max_delta_debt_overstated() public  returns (int256) {
        if(_after.entireSystemDebt > _after.ghostDebtAccumulator) {
            uint256 delta = _after.entireSystemDebt - _after.ghostDebtAccumulator;
            if(delta > uint256(type(int256).max)) {
                return type(int256).max;
            }

            return int256(delta);
        }
    }
    
    function optimize_max_delta_debt_understated() public  returns (int256) {
        if(_after.ghostDebtAccumulator > _after.entireSystemDebt) {
            uint256 delta = _after.ghostDebtAccumulator - _after.entireSystemDebt;
            if(delta > uint256(type(int256).max)) {
                return type(int256).max;
            }

            return int256(delta);
        }
    }

    // == property_AP01 Optimization == //
    function optimize_ap01_over() public  returns (int256) {
        if(_after.ghostWeightedRecordedDebtAccumulator > activePool.aggWeightedDebtSum()) {
            uint256 delta = _after.ghostWeightedRecordedDebtAccumulator - activePool.aggWeightedDebtSum();
            if(delta > uint256(type(int256).max)) {
                return type(int256).max;
            }

            return int256(delta);
        }
    }

    function optimize_ap01_under() public  returns (int256) {
        if(activePool.aggWeightedDebtSum() > _after.ghostWeightedRecordedDebtAccumulator) {
            uint256 delta = activePool.aggWeightedDebtSum() - _after.ghostWeightedRecordedDebtAccumulator;
            if(delta > uint256(type(int256).max)) {
                return type(int256).max;
            }

            return int256(delta);
        }
    }


    // == property_sum_of_batches_debt == //
    function optimize_property_sum_of_batches_debt_over() public  returns (int256) {
        if(clampedBatchManager == address(0)) {
            return 0;
        }
        
        (uint256 batchDebt, ) = troveManager.getbatchDebtAndShares(clampedBatchManager);
        (uint256 sumBatchDebt, ) = _sumBatchSharesAndDebt(clampedBatchManager);

        if(sumBatchDebt > batchDebt) {
            uint256 delta = sumBatchDebt - batchDebt;
            if(delta > uint256(type(int256).max)) {
                return type(int256).max;
            }

            return int256(delta);
        }
    }

    function optimize_property_sum_of_batches_debt_under() public  returns (int256) {
        (uint256 batchDebt, ) = troveManager.getbatchDebtAndShares(clampedBatchManager);
        (uint256 sumBatchDebt, ) = _sumBatchSharesAndDebt(clampedBatchManager);

        if(batchDebt > sumBatchDebt) {
            uint256 delta = batchDebt - sumBatchDebt;
            if(delta > uint256(type(int256).max)) {
                return type(int256).max;
            }

            return int256(delta);
        }
    }

    // == property_sum_of_batches_shares == //
    function optimize_property_sum_of_batches_shares_over() public  returns (int256) {
        (, uint256 batchShares) = troveManager.getbatchDebtAndShares(clampedBatchManager);
        (, uint256 sumbBatchShares) = _sumBatchSharesAndDebt(clampedBatchManager);

        if(sumbBatchShares > batchShares) {
            uint256 delta = sumbBatchShares - batchShares;
            if(delta > uint256(type(int256).max)) {
                return type(int256).max;
            }

            return int256(delta);
        }
    }
    
    // == property_sum_of_batches_shares == //
    function optimize_property_sum_of_batches_shares_under() public  returns (int256) {
        (, uint256 batchShares) = troveManager.getbatchDebtAndShares(clampedBatchManager);
        (, uint256 sumbBatchShares) = _sumBatchSharesAndDebt(clampedBatchManager);

        if(batchShares > sumbBatchShares) {
            uint256 delta = batchShares - sumbBatchShares;
            if(delta > uint256(type(int256).max)) {
                return type(int256).max;
            }

            return int256(delta);
        }
    }


    /// @dev Helper function to standardize return values for optimization tests
    function _optimizationHelper(uint256 left, uint256 right, bool swap) internal returns (int256) {
        if(left > right) {
            uint256 delta = left - right;
            if(delta > uint256(type(int256).max)) {
                return type(int256).max;
            }

            return int256(delta);
        }
    }
}