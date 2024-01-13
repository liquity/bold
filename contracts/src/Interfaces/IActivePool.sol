// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./IPool.sol";


interface IActivePool is IPool {
    function sendETH(address _account, uint _amount) external;
}
