
// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseTargetFunctions} from "@chimera/BaseTargetFunctions.sol";
import {vm} from "@chimera/Hevm.sol";
import "forge-std/console2.sol";

import {Properties} from "../Properties.sol";

abstract contract ActivePoolTargets is BaseTargetFunctions, Properties  {
    // AP should prob never be called directly

    // function activePool_accountForReceivedColl(uint256 _amount) public {
    //     activePool.accountForReceivedColl(_amount);
    // }

    // function activePool_mintAggInterest() public {
    //     activePool.mintAggInterest();
    // }

    // function activePool_mintAggInterestAndAccountForTroveChange(TroveChange memory _troveChange, address _batchAddress) public {
    //     activePool.mintAggInterestAndAccountForTroveChange(_troveChange, _batchAddress);
    // }

    // function activePool_mintBatchManagementFeeAndAccountForChange(TroveChange memory _troveChange, address _batchAddress) public {
    //     activePool.mintBatchManagementFeeAndAccountForChange(_troveChange, _batchAddress);
    // }

    // function activePool_receiveColl(uint256 _amount) public {
    //     activePool.receiveColl(_amount);
    // }

    // function activePool_sendColl(address _account, uint256 _amount) public {
    //     activePool.sendColl(_account, _amount);
    // }

    // function activePool_sendCollToDefaultPool(uint256 _amount) public {
    //     activePool.sendCollToDefaultPool(_amount);
    // }

    // function activePool_setShutdownFlag() public {
    //     activePool.setShutdownFlag();
    // }
}