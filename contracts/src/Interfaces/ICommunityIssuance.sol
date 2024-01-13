// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface ICommunityIssuance { 
    function setAddresses(address _lqtyTokenAddress, address _stabilityPoolAddress) external;

    function issueLQTY() external returns (uint);

    function sendLQTY(address _account, uint _LQTYamount) external;
}
