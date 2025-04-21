// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

type BatchId is address;

using {equals as ==, notEquals as !=, isZero, isNotZero} for BatchId global;

function equals(BatchId a, BatchId b) pure returns (bool) {
    return BatchId.unwrap(a) == BatchId.unwrap(b);
}

function notEquals(BatchId a, BatchId b) pure returns (bool) {
    return !(a == b);
}

function isZero(BatchId x) pure returns (bool) {
    return x == BATCH_ID_ZERO;
}

function isNotZero(BatchId x) pure returns (bool) {
    return !x.isZero();
}

BatchId constant BATCH_ID_ZERO = BatchId.wrap(address(0));
