// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface IDefaultPool {
    function troveManagerAddress() external view returns (address);
    function activePoolAddress() external view returns (address);
    // --- Functions ---
    function getETH() external view returns (uint256);
    function getBoldDebt() external view returns (uint256);
    function sendETHToActivePool(uint _amount) external;
    function setAddresses(address _troveManagerAddress, address _activePoolAddress) external;

    function increaseBoldDebt(uint _amount) external;
    function decreaseBoldDebt(uint _amount) external;

  
}
