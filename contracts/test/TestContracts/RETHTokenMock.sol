// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "src/Interfaces/IRETHToken.sol";
import "lib/forge-std/src/console2.sol";

contract RETHTokenMock is IRETHToken {
    uint256 ethPerReth;

    function getExchangeRate() external view returns (uint256) {
        return ethPerReth;
    }

    function setExchangeRate(uint256 _ethPerReth) external {
        ethPerReth = _ethPerReth;
    }
}
