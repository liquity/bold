// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

type TroveId is uint256;

using {
    // TODO: use as operators if we ever upgrade to ^0.8.19
    equals, // as ==
    notEquals, // as !=
    isZero,
    isNotZero
} for TroveId global;

function equals(TroveId a, TroveId b) pure returns (bool) {
    return TroveId.unwrap(a) == TroveId.unwrap(b);
}

function notEquals(TroveId a, TroveId b) pure returns (bool) {
    return !a.equals(b);
}

function isZero(TroveId x) pure returns (bool) {
    return x.equals(TROVE_ID_ZERO);
}

function isNotZero(TroveId x) pure returns (bool) {
    return !x.isZero();
}

TroveId constant TROVE_ID_ZERO = TroveId.wrap(0);
