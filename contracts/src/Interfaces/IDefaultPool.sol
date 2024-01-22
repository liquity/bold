// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./IPool.sol";


interface IDefaultPool is IPool {
    function troveManagerAddress() external view returns (address);
    function activePoolAddress() external view returns (address);
    // --- Functions ---
    function sendETHToActivePool(uint _amount) external;
    function setAddresses(address _troveManagerAddress, address _activePoolAddress) external;
}
