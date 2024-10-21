// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

using EnumerableSetMethods for EnumerableSet global;
using EnumerableAddressSetMethods for EnumerableAddressSet global;

struct EnumerableSet {
    mapping(uint256 element => uint256) _indexOf;
    uint256[] _elements;
}

struct EnumerableAddressSet {
    EnumerableSet _base;
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

    function add(EnumerableSet storage set, uint256[] memory elements) internal {
        for (uint256 i = 0; i < elements.length; ++i) {
            set.add(elements[i]);
        }
    }

    function add(EnumerableSet storage set, EnumerableSet storage otherSet) internal {
        for (uint256 i = 1; i < otherSet._elements.length; ++i) {
            set.add(otherSet._elements[i]);
        }
    }

    function remove(EnumerableSet storage set, uint256 element) internal {
        if (!set.has(element)) return;

        uint256 lastElement = set._elements[set._elements.length - 1];
        uint256 indexOfRemovedElement = set._indexOf[element];

        set._indexOf[lastElement] = indexOfRemovedElement;
        set._elements[indexOfRemovedElement] = lastElement;

        set._elements.pop();
        delete set._indexOf[element];
    }

    function remove(EnumerableSet storage set, uint256[] memory elements) internal {
        for (uint256 i = 0; i < elements.length; ++i) {
            set.remove(elements[i]);
        }
    }

    function remove(EnumerableSet storage set, EnumerableSet storage otherSet) internal {
        for (uint256 i = 1; i < otherSet._elements.length; ++i) {
            set.remove(otherSet._elements[i]);
        }
    }

    function reset(EnumerableSet storage set) internal {
        for (uint256 i = 1; i < set._elements.length; ++i) {
            delete set._indexOf[set._elements[i]];
        }
        delete set._elements;
    }
}

library EnumerableAddressSetMethods {
    function has(EnumerableAddressSet storage set, address element) internal view returns (bool) {
        return set._base.has(uint256(uint160(element)));
    }

    function get(EnumerableAddressSet storage set, uint256 i) internal view returns (address) {
        return address(uint160(set._base.get(i)));
    }

    function size(EnumerableAddressSet storage set) internal view returns (uint256) {
        return set._base.size();
    }

    function add(EnumerableAddressSet storage set, address element) internal {
        set._base.add(uint256(uint160(element)));
    }

    function add(EnumerableAddressSet storage set, address[] memory elements) internal {
        for (uint256 i = 0; i < elements.length; ++i) {
            set.add(elements[i]);
        }
    }

    function add(EnumerableAddressSet storage set, EnumerableAddressSet storage otherSet) internal {
        set._base.add(otherSet._base);
    }

    function remove(EnumerableAddressSet storage set, address element) internal {
        set._base.remove(uint256(uint160(element)));
    }

    function remove(EnumerableAddressSet storage set, address[] memory elements) internal {
        for (uint256 i = 0; i < elements.length; ++i) {
            set.remove(elements[i]);
        }
    }

    function remove(EnumerableAddressSet storage set, EnumerableAddressSet storage otherSet) internal {
        set._base.remove(otherSet._base);
    }

    function reset(EnumerableAddressSet storage set) internal {
        set._base.reset();
    }
}
