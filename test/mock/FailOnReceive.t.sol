// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

contract FailOnReceive {
  error OnReceiveFailed();

  receive() external payable {
    revert OnReceiveFailed();
  }
}
