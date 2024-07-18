// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {Test} from "forge-std/Test.sol";
import {console2 as console} from "forge-std/console2.sol";

contract BaseHandler is Test {
    function _callPrefix() internal view returns (string memory) {
        return string.concat(vm.getLabel(address(this)), ".");
    }

    function _log() internal pure {
        console.log();
    }

    function _log(string memory a) internal pure {
        console.log(a);
    }

    function _log(string memory a, string memory b) internal pure {
        console.log(string.concat(a, b));
    }

    function _log(string memory a, string memory b, string memory c) internal pure {
        console.log(string.concat(a, b, c));
    }

    function _log(string memory a, string memory b, string memory c, string memory d) internal pure {
        console.log(string.concat(a, b, c, d));
    }

    function _log(string memory a, string memory b, string memory c, string memory d, string memory e) internal pure {
        console.log(string.concat(a, b, c, d, e));
    }

    function _log(string memory a, string memory b, string memory c, string memory d, string memory e, string memory f)
        internal
        pure
    {
        console.log(string.concat(a, b, c, d, e, f));
    }

    function _log(
        string memory a,
        string memory b,
        string memory c,
        string memory d,
        string memory e,
        string memory f,
        string memory g
    ) internal pure {
        console.log(string.concat(a, b, c, d, e, f, g));
    }

    function _log(
        string memory a,
        string memory b,
        string memory c,
        string memory d,
        string memory e,
        string memory f,
        string memory g,
        string memory h
    ) internal pure {
        console.log(string.concat(a, b, c, d, e, f, g, h));
    }

    function _log(
        string memory a,
        string memory b,
        string memory c,
        string memory d,
        string memory e,
        string memory f,
        string memory g,
        string memory h,
        string memory i
    ) internal pure {
        console.log(string.concat(a, b, c, d, e, f, g, h, i));
    }

    function _log(
        string memory a,
        string memory b,
        string memory c,
        string memory d,
        string memory e,
        string memory f,
        string memory g,
        string memory h,
        string memory i,
        string memory j
    ) internal pure {
        console.log(string.concat(a, b, c, d, e, f, g, h, i, j));
    }

    function _log(
        string memory a,
        string memory b,
        string memory c,
        string memory d,
        string memory e,
        string memory f,
        string memory g,
        string memory h,
        string memory i,
        string memory j,
        string memory k
    ) internal pure {
        console.log(string.concat(a, b, c, d, e, f, g, h, i, j, k));
    }

    function info(string memory a) internal pure {
        _log("// ", a);
    }

    function info(string memory a, string memory b) internal pure {
        _log("// ", a, b);
    }

    function info(string memory a, string memory b, string memory c) internal pure {
        _log("// ", a, b, c);
    }

    function info(string memory a, string memory b, string memory c, string memory d) internal pure {
        _log("// ", a, b, c, d);
    }

    function info(string memory a, string memory b, string memory c, string memory d, string memory e) internal pure {
        _log("// ", a, b, c, d, e);
    }

    function _csv(string[2] memory strs) internal pure returns (string memory) {
        return string.concat(strs[0], ", ", strs[1]);
    }

    function _csv(string[3] memory strs) internal pure returns (string memory) {
        return string.concat(strs[0], ", ", strs[1], ", ", strs[2]);
    }

    function _csv(string[4] memory strs) internal pure returns (string memory) {
        return string.concat(strs[0], ", ", strs[1], ", ", strs[2], ", ", strs[3]);
    }

    function _csv(string[5] memory strs) internal pure returns (string memory) {
        return string.concat(strs[0], ", ", strs[1], ", ", strs[2], ", ", strs[3], ", ", strs[4]);
    }

    function _csv(string[6] memory strs) internal pure returns (string memory) {
        return string.concat(strs[0], ", ", strs[1], ", ", strs[2], ", ", strs[3], ", ", strs[4], ", ", strs[5]);
    }

    function _csv(string[7] memory strs) internal pure returns (string memory) {
        return string.concat(
            strs[0], ", ", strs[1], ", ", strs[2], ", ", strs[3], ", ", strs[4], ", ", strs[5], ", ", strs[6]
        );
    }

    function _csv(string[8] memory strs) internal pure returns (string memory) {
        return string.concat(
            strs[0],
            ", ",
            strs[1],
            ", ",
            strs[2],
            ", ",
            strs[3],
            ", ",
            strs[4],
            ", ",
            strs[5],
            ", ",
            strs[6],
            ", ",
            strs[7]
        );
    }

    function _csv(string[9] memory strs) internal pure returns (string memory) {
        return string.concat(
            strs[0],
            ", ",
            strs[1],
            ", ",
            strs[2],
            ", ",
            strs[3],
            ", ",
            strs[4],
            ", ",
            strs[5],
            ", ",
            strs[6],
            ", ",
            strs[7],
            ", ",
            strs[8]
        );
    }

    function _logCaller() internal view {
        _log("vm.prank(", vm.getLabel(msg.sender), ");");
    }

    function logCall(string memory functionName) internal view {
        _logCaller();
        _log(_callPrefix(), functionName, "();");
        _log();
    }

    function logCall(string memory functionName, string memory a) internal view {
        _logCaller();
        _log(_callPrefix(), functionName, "(", a, ");");
        _log();
    }

    function logCall(string memory functionName, string memory a, string memory b) internal view {
        _logCaller();
        _log(_callPrefix(), functionName, "(", _csv([a, b]), ");");
        _log();
    }

    function logCall(string memory functionName, string memory a, string memory b, string memory c) internal view {
        _logCaller();
        _log(_callPrefix(), functionName, "(", _csv([a, b, c]), ");");
        _log();
    }

    function logCall(string memory functionName, string memory a, string memory b, string memory c, string memory d)
        internal
        view
    {
        _logCaller();
        _log(_callPrefix(), functionName, "(", _csv([a, b, c, d]), ");");
        _log();
    }

    function logCall(
        string memory functionName,
        string memory a,
        string memory b,
        string memory c,
        string memory d,
        string memory e
    ) internal view {
        _logCaller();
        _log(_callPrefix(), functionName, "(", _csv([a, b, c, d, e]), ");");
        _log();
    }

    function logCall(
        string memory functionName,
        string memory a,
        string memory b,
        string memory c,
        string memory d,
        string memory e,
        string memory f
    ) internal view {
        _logCaller();
        _log(_callPrefix(), functionName, "(", _csv([a, b, c, d, e, f]), ");");
        _log();
    }

    function logCall(
        string memory functionName,
        string memory a,
        string memory b,
        string memory c,
        string memory d,
        string memory e,
        string memory f,
        string memory g
    ) internal view {
        _logCaller();
        _log(_callPrefix(), functionName, "(", _csv([a, b, c, d, e, f, g]), ");");
        _log();
    }

    function logCall(
        string memory functionName,
        string memory a,
        string memory b,
        string memory c,
        string memory d,
        string memory e,
        string memory f,
        string memory g,
        string memory h
    ) internal view {
        _logCaller();
        _log(_callPrefix(), functionName, "(", _csv([a, b, c, d, e, f, g, h]), ");");
        _log();
    }

    function logCall(
        string memory functionName,
        string memory a,
        string memory b,
        string memory c,
        string memory d,
        string memory e,
        string memory f,
        string memory g,
        string memory h,
        string memory i
    ) internal view {
        _logCaller();
        _log(_callPrefix(), functionName, "(", _csv([a, b, c, d, e, f, g, h, i]), ");");
        _log();
    }
}
