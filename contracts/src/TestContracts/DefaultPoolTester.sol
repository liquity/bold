// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../DefaultPool.sol";

contract DefaultPoolTester is DefaultPool {
    
    function unprotectedIncreaseBoldDebt(uint _amount) external {
        BoldDebt  = BoldDebt + _amount;
    }

    function unprotectedPayable() external payable {
        ETH = ETH + msg.value;
    }
}
