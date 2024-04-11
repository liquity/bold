// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

type BatchId is address;

using {
    // TODO: use as operators if we ever upgrade to ^0.8.19
    equals, // as ==
    notEquals, // as !=
    isZero,
    isNotZero
} for BatchId global;

function equals(BatchId a, BatchId b) pure returns (bool) {
    return BatchId.unwrap(a) == BatchId.unwrap(b);
}

function notEquals(BatchId a, BatchId b) pure returns (bool) {
    return !a.equals(b);
}

function isZero(BatchId x) pure returns (bool) {
    return x.equals(BATCH_ID_ZERO);
}

function isNotZero(BatchId x) pure returns (bool) {
    return !x.isZero();
}

BatchId constant BATCH_ID_ZERO = BatchId.wrap(address(0));
