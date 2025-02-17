
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseTargetFunctions} from "@chimera/BaseTargetFunctions.sol";
import {vm} from "@chimera/Hevm.sol";
import "forge-std/console2.sol";

import {Properties} from "../Properties.sol";

abstract contract TroveManagerTargets is BaseTargetFunctions, Properties  {

    function troveManager_batchLiquidateTroves(uint256[] memory _troveArray) public asActor {
        troveManager.batchLiquidateTroves(_troveArray);
    }


    function troveManager_liquidate(uint256 _troveId) public asActor {
        troveManager.liquidate(_troveId);
        hasDoneLiquidation = true;
    }

    function troveManager_liquidate_clamped() public {
        troveManager_liquidate(clampedTroveId);
    }

    function troveManager_liquidate_with_oracle_clamped() public {
        uint256 prevPrice = priceFeed.getPrice();
        priceFeed.setPrice(1); // Set to insanely low price
        
        troveManager_liquidate(clampedTroveId); // Liquidate

        priceFeed.setPrice(prevPrice); //Bring back prev price
    }


    function troveManager_urgentRedemption(uint256 _boldAmount, uint256[] memory _troveIds, uint256 _minCollateral) public asActor {
        troveManager.urgentRedemption(_boldAmount, _troveIds, _minCollateral);
    }

    
    function troveManager_urgentRedemption_clamped(uint256 _boldAmount) public {
        uint256[] memory ids = new uint256[](1);
        ids[0] = clampedTroveId;

        _boldAmount = _boldAmount % troveManager.getTroveDebt(clampedTroveId) + 1;
        troveManager_urgentRedemption(_boldAmount, ids, 0);
    }
    

    // function troveManager_callInternalRemoveTroveId(uint256 _troveId) public asActor {
    //     troveManager.callInternalRemoveTroveId(_troveId);
    // }

    // function troveManager_getUnbackedPortionPriceAndRedeemability() public asActor {
    //     troveManager.getUnbackedPortionPriceAndRedeemability();
    // }


    // function troveManager_onAdjustTrove(uint256 _troveId, uint256 _newColl, uint256 _newDebt, TroveChange memory _troveChange) public asActor {
    //     troveManager.onAdjustTrove(_troveId, _newColl, _newDebt, _troveChange);
    // }

    // function troveManager_onAdjustTroveInsideBatch(uint256 _troveId, uint256 _newTroveColl, uint256 _newTroveDebt, TroveChange memory _troveChange, address _batchAddress, uint256 _newBatchColl, uint256 _newBatchDebt) public asActor {
    //     troveManager.onAdjustTroveInsideBatch(_troveId, _newTroveColl, _newTroveDebt, _troveChange, _batchAddress, _newBatchColl, _newBatchDebt);
    // }

    // function troveManager_onAdjustTroveInterestRate(uint256 _troveId, uint256 _newColl, uint256 _newDebt, uint256 _newAnnualInterestRate, TroveChange memory _troveChange) public asActor {
    //     troveManager.onAdjustTroveInterestRate(_troveId, _newColl, _newDebt, _newAnnualInterestRate, _troveChange);
    // }

    // function troveManager_onApplyTroveInterest(uint256 _troveId, uint256 _newTroveColl, uint256 _newTroveDebt, address _batchAddress, uint256 _newBatchColl, uint256 _newBatchDebt, TroveChange memory _troveChange) public asActor {
    //     troveManager.onApplyTroveInterest(_troveId, _newTroveColl, _newTroveDebt, _batchAddress, _newBatchColl, _newBatchDebt, _troveChange);
    // }

    // function troveManager_onCloseTrove(uint256 _troveId, TroveChange memory _troveChange, address _batchAddress, uint256 _newBatchColl, uint256 _newBatchDebt) public asActor {
    //     troveManager.onCloseTrove(_troveId, _troveChange, _batchAddress, _newBatchColl, _newBatchDebt);
    // }

    // function troveManager_onLowerBatchManagerAnnualFee(address _batchAddress, uint256 _newColl, uint256 _newDebt, uint256 _newAnnualManagementFee) public asActor {
    //     troveManager.onLowerBatchManagerAnnualFee(_batchAddress, _newColl, _newDebt, _newAnnualManagementFee);
    // }

    // function troveManager_onOpenTrove(address _owner, uint256 _troveId, TroveChange memory _troveChange, uint256 _annualInterestRate) public asActor {
    //     troveManager.onOpenTrove(_owner, _troveId, _troveChange, _annualInterestRate);
    // }

    // function troveManager_onOpenTroveAndJoinBatch(address _owner, uint256 _troveId, TroveChange memory _troveChange, address _batchAddress, uint256 _batchColl, uint256 _batchDebt) public asActor {
    //     troveManager.onOpenTroveAndJoinBatch(_owner, _troveId, _troveChange, _batchAddress, _batchColl, _batchDebt);
    // }

    // function troveManager_onRegisterBatchManager(address _account, uint256 _annualInterestRate, uint256 _annualManagementFee) public asActor {
    //     troveManager.onRegisterBatchManager(_account, _annualInterestRate, _annualManagementFee);
    // }

    // function troveManager_onRemoveFromBatch(uint256 _troveId, uint256 _newTroveColl, uint256 _newTroveDebt, TroveChange memory _troveChange, address _batchAddress, uint256 _newBatchColl, uint256 _newBatchDebt, uint256 _newAnnualInterestRate) public asActor {
    //     troveManager.onRemoveFromBatch(_troveId, _newTroveColl, _newTroveDebt, _troveChange, _batchAddress, _newBatchColl, _newBatchDebt, _newAnnualInterestRate);
    // }

    // function troveManager_onSetBatchManagerAnnualInterestRate(address _batchAddress, uint256 _newColl, uint256 _newDebt, uint256 _newAnnualInterestRate, uint256 _upfrontFee) public asActor {
    //     troveManager.onSetBatchManagerAnnualInterestRate(_batchAddress, _newColl, _newDebt, _newAnnualInterestRate, _upfrontFee);
    // }

    // function troveManager_onSetInterestBatchManager(ITroveManager.OnSetInterestBatchManagerParams memory _params) public asActor {
    //     troveManager.onSetInterestBatchManager(_params);
    // }

    // function troveManager_redeemCollateral(address _redeemer, uint256 _boldamount, uint256 _price, uint256 _redemptionRate, uint256 _maxIterations) public asActor {
    //     troveManager.redeemCollateral(_redeemer, _boldamount, _price, _redemptionRate, _maxIterations);
    // }

    // function troveManager_setTroveStatusToActive(uint256 _troveId) public asActor {
    //     troveManager.setTroveStatusToActive(_troveId);
    // }

    // function troveManager_shutdown() public asActor {
    //     troveManager.shutdown();
    // }


}