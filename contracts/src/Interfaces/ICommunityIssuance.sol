// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ICommunityIssuance {
    function setAddresses(address _lqtyTokenAddress, address _stabilityPoolAddress) external;

    function issueLQTY() external returns (uint256);

    function sendLQTY(address _account, uint256 _LQTYamount) external;
}
