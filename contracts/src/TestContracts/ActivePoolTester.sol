// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../ActivePool.sol";

contract ActivePoolTester is ActivePool {
    
    function unprotectedIncreaseBoldDebt(uint _amount) external {
        recordedDebtSum  = recordedDebtSum + _amount;
    }

    function unprotectedPayable() external payable {
        ETH = ETH + msg.value;
    }
}
