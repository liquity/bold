// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBorrowerOperationsV1 {
    function openTrove(uint256 _maxFeePercentage, uint256 _LUSDAmount, address _upperHint, address _lowerHint)
        external
        payable;
}
