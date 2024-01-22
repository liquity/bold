// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../ActivePool.sol";

contract ActivePoolTester is ActivePool {
    
    function unprotectedIncreaseBoldDebt(uint _amount) external {
        boldDebt  = boldDebt + _amount;
    }

    function unprotectedPayable() external payable {
        ETH = ETH + msg.value;
    }
}
