// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface IDefaultPool {
    function setAddresses(address _troveManagerAddress, address _activePoolAddress) external;
    function troveManagerAddress() external view returns (address);
    function activePoolAddress() external view returns (address);
    // --- Functions ---
    function getETHBalance() external view returns (uint256);
    function getBoldDebt() external view returns (uint256);
    function sendETHToActivePool(uint256 _amount) external;
    function receiveETH(uint256 _amount) external;

    function increaseBoldDebt(uint256 _amount) external;
    function decreaseBoldDebt(uint256 _amount) external;
}
