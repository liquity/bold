// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Logging} from "../Utils/Logging.sol";

contract BaseHandler is Logging, Test {
    function _logCaller() internal view {
        _log("vm.prank(", vm.getLabel(msg.sender), ");");
    }

    function _callPrefix() internal view returns (string memory) {
        return string.concat(vm.getLabel(address(this)), ".");
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
