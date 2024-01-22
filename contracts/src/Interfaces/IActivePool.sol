// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./IPool.sol";


interface IActivePool is IPool {
    function stabilityPoolAddress() external view returns (address);
    function defaultPoolAddress() external view returns (address);
    function borrowerOperationsAddress() external view returns (address);
    function troveManagerAddress() external view returns (address);
    function sendETH(address _account, uint _amount) external;
    function setAddresses(
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _stabilityPoolAddress,
        address _defaultPoolAddress
    ) external;
}
