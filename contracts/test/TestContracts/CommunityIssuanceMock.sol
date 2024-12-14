// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

contract CommunityIssuanceMock {
    function setAddresses(address _lqtyTokenAddress, address _stabilityPoolAddress) external {}

    function issueLQTY() external returns (uint256) {}

    function sendLQTY(address _account, uint256 _LQTYamount) external {}
}
