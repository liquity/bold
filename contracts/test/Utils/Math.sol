// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {DECIMAL_PRECISION} from "src/Dependencies/Constants.sol";

function roundedMul(uint256 x, uint256 y) pure returns (uint256) {
    return (x * y + DECIMAL_PRECISION / 2) / DECIMAL_PRECISION;
}

// XXX don't use in production!
// This will overflow for large exponents if base is >1
function pow(uint256 decimalBase, uint256 intExponent) pure returns (uint256) {
    if (intExponent == 0) return DECIMAL_PRECISION;
    if (intExponent == 1) return decimalBase;

    uint256 x = decimalBase;
    uint256 y = DECIMAL_PRECISION;

    for (; intExponent > 1; intExponent >>= 1) {
        if (intExponent & 1 == 1) y = roundedMul(x, y);
        x = roundedMul(x, x);
    }

    return roundedMul(x, y);
}

function mulDivCeil(uint256 x, uint256 multiplier, uint256 divider) pure returns (uint256) {
    assert(divider != 0);
    return x == 0 ? 0 : (x * multiplier + divider - 1) / divider;
}
