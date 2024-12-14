// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import "src/Dependencies/LiquityMath.sol";

/* Tester contract for math functions in Math.sol library. */

contract LiquityMathTester {
    event AvoidWarning(uint256 a);

    function callMax(uint256 _a, uint256 _b) external pure returns (uint256) {
        return LiquityMath._max(_a, _b);
    }

    // Non-view wrapper for gas test
    function callDecPowTx(uint256 _base, uint256 _n) external returns (uint256) {
        emit AvoidWarning(0);
        return LiquityMath._decPow(_base, _n);
    }

    // External wrapper
    function callDecPow(uint256 _base, uint256 _n) external pure returns (uint256) {
        return LiquityMath._decPow(_base, _n);
    }
}
