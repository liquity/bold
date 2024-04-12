// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface ITellorCaller {
    function getTellorCurrentValue(uint256 _requestId) external view returns (bool, uint256, uint256);
}
