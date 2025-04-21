// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import {ROOT_NODE_ID} from "../SortedTroves.sol";

type TroveId is uint256;

using {equals as ==, notEquals as !=, isEndOfList, isNotEndOfList} for TroveId global;

function equals(TroveId a, TroveId b) pure returns (bool) {
    return TroveId.unwrap(a) == TroveId.unwrap(b);
}

function notEquals(TroveId a, TroveId b) pure returns (bool) {
    return !(a == b);
}

function isEndOfList(TroveId x) pure returns (bool) {
    return x == TROVE_ID_END_OF_LIST;
}

function isNotEndOfList(TroveId x) pure returns (bool) {
    return !x.isEndOfList();
}

TroveId constant TROVE_ID_ZERO = TroveId.wrap(0);
TroveId constant TROVE_ID_END_OF_LIST = TroveId.wrap(ROOT_NODE_ID);
