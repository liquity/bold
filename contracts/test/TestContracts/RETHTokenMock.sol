// SPDX-License-Identifier: MIT

pragma solidity 0.8.23;

import "lib/forge-std/src/console2.sol";

contract RETHTokenMock {
    uint256 ethPerReth;

    function getExchangeRate() external view returns (uint256) {
        return ethPerReth;
    }

    function setExchangeRate(uint256 _ethPerReth) external {
        ethPerReth = _ethPerReth;
    }
}
