// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../BoldToken.sol";

contract BoldTokenTester is BoldToken {
    constructor(address _owner) BoldToken(_owner) {}

    function unprotectedMint(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }
}
