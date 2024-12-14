// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "src/Interfaces/IRETHToken.sol";

contract RETHTokenMock is IRETHToken {
    function getExchangeRate() external pure returns (uint256) {
        return 0;
    }
}
