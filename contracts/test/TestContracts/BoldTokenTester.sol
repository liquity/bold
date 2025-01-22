// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "src/BoldToken.sol";

contract BoldTokenTester is BoldToken {
    constructor(address _owner) BoldToken(_owner) {}

    function unprotectedMint(address _account, uint256 _amount) external {
         ISuperToken(address(this)).selfMint(_account, _amount, "");(_account, _amount);
    }
}
