// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IBoldRewardsReceiver {
    function triggerBoldRewards(uint256 _boldYield) external;
}
