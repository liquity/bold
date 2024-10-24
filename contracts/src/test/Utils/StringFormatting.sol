// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";

library StringFormatting {
    using Strings for uint256;
    using StringFormatting for uint256;
    using StringFormatting for string;
    using StringFormatting for bytes;

    bytes1 constant GROUP_SEPARATOR = "_";
    string constant DECIMAL_SEPARATOR = ".";
    string constant DECIMAL_UNIT = " ether";

    uint256 constant GROUP_DIGITS = 3;
    uint256 constant DECIMALS = 18;
    uint256 constant ONE = 10 ** DECIMALS;

    function equals(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function toString(bytes memory str) internal pure returns (string memory) {
        return string(str);
    }

    function toString(bool b) internal pure returns (string memory) {
        return b ? "true" : "false";
    }

    function decimal(int256 n) internal pure returns (string memory) {
        if (n == type(int256).max) {
            return "type(int256).max";
        } else if (n == type(int256).min) {
            return "type(int256).min";
        } else if (n < 0) {
            return string.concat("-", uint256(-n).decimal());
        } else {
            return uint256(n).decimal();
        }
    }

    function decimal(uint256 n) internal pure returns (string memory) {
        if (n == type(uint256).max) {
            return "type(uint256).max";
        }

        uint256 integerPart = n / ONE;
        uint256 fractionalPart = n % ONE;

        if (fractionalPart == 0) {
            return string.concat(integerPart.groupRight(), DECIMAL_UNIT);
        } else {
            return string.concat(
                integerPart.groupRight(),
                DECIMAL_SEPARATOR,
                (ONE + fractionalPart).toString().slice(1).trimEnd("0"),
                DECIMAL_UNIT
            );
        }
    }

    function groupRight(uint256 n) internal pure returns (string memory) {
        return n.toString().groupRight();
    }

    function groupRight(string memory str) internal pure returns (string memory) {
        return bytes(str).groupRight().toString();
    }

    function groupRight(bytes memory str) internal pure returns (bytes memory ret) {
        uint256 length = str.length;
        if (length == 0) return "";

        uint256 retLength = length + (length - 1) / GROUP_DIGITS;
        ret = new bytes(retLength);

        uint256 j = 1;
        for (uint256 i = 1; i <= retLength; ++i) {
            if (i % (GROUP_DIGITS + 1) == 0) {
                ret[retLength - i] = GROUP_SEPARATOR;
            } else {
                ret[retLength - i] = str[length - j++];
            }
        }
    }

    function slice(string memory str, int256 start) internal pure returns (string memory) {
        return bytes(str).slice(start).toString();
    }

    function slice(string memory str, int256 start, int256 end) internal pure returns (string memory) {
        return bytes(str).slice(start, end).toString();
    }

    function slice(bytes memory str, int256 start) internal pure returns (bytes memory) {
        return str.slice(start, int256(str.length));
    }

    // Should only be used on ASCII strings
    function slice(bytes memory str, int256 start, int256 end) internal pure returns (bytes memory ret) {
        uint256 uStart = uint256(start < 0 ? int256(str.length) + start : start);
        uint256 uEnd = uint256(end < 0 ? int256(str.length) + end : end);
        assert(0 <= uStart && uStart <= uEnd && uEnd <= str.length);

        ret = new bytes(uEnd - uStart);

        for (uint256 i = uStart; i < uEnd; ++i) {
            ret[i - uStart] = str[i];
        }
    }

    function trimEnd(string memory str, bytes1 char) internal pure returns (string memory) {
        return bytes(str).trimEnd(char).toString();
    }

    function trimEnd(bytes memory str, bytes1 char) internal pure returns (bytes memory) {
        uint256 end;
        for (end = str.length; end > 0 && str[end - 1] == char; --end) {}
        return str.slice(0, int256(end));
    }

    function join(string[] memory strs, string memory sep) internal pure returns (string memory ret) {
        if (strs.length == 0) return "";

        ret = strs[0];
        for (uint256 i = 1; i < strs.length; ++i) {
            ret = string.concat(ret, sep, strs[i]);
        }
    }
}
