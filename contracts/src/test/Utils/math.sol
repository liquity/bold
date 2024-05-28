// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

function mulDivCeil(uint256 x, uint256 multiplier, uint256 divider) pure returns (uint256) {
    assert(divider != 0);
    return x == 0 ? 0 : (x * multiplier + divider - 1) / divider;
}
