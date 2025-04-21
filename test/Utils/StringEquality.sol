// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

library StringEquality {
    function eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function notEq(string memory a, string memory b) internal pure returns (bool) {
        return !eq(a, b);
    }
}
