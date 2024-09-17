// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../../Interfaces/IRETHToken.sol";

contract RETHTokenMock is IRETHToken {

    function getExchangeRate() external view returns (uint256) {
        return 0;
    }
}