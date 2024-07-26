// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

using EnumerableSetMethods for EnumerableSet global;

struct EnumerableSet {
    mapping(uint256 => uint256) _indexOf;
    uint256[] _elements;
}

library EnumerableSetMethods {
    function has(EnumerableSet storage set, uint256 element) internal view returns (bool) {
        return set._indexOf[element] != 0;
    }

    function get(EnumerableSet storage set, uint256 i) internal view returns (uint256) {
        return set._elements[i + 1];
    }

    function size(EnumerableSet storage set) internal view returns (uint256) {
        return set._elements.length >= 1 ? set._elements.length - 1 : 0;
    }

    function add(EnumerableSet storage set, uint256 element) internal {
        if (set.has(element)) return;
        if (set._elements.length == 0) set._elements.push(); // skip first index to ensure positive _indexOf

        set._indexOf[element] = set._elements.length;
        set._elements.push(element);
    }

    function remove(EnumerableSet storage set, uint256 element) internal {
        if (!set.has(element)) return;

        set._elements[set._indexOf[element]] = set._elements[set._elements.length - 1];
        set._elements.pop();
    }
}
