// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StdAssertions} from "forge-std/StdAssertions.sol";

contract Assertions is StdAssertions {
    function assertApproxEq(uint256 a, uint256 b, uint256 maxPercentDelta) internal pure {
        if (b < 1e18) {
            assertApproxEqAbsDecimal(a, b, maxPercentDelta, 18);
        } else {
            assertApproxEqRelDecimal(a, b, maxPercentDelta, 18);
        }
    }

    function assertApproxEq(uint256 a, uint256 b, uint256 maxPercentDelta, string memory err) internal pure {
        if (b < 1e18) {
            assertApproxEqAbsDecimal(a, b, maxPercentDelta, 18, err);
        } else {
            assertApproxEqRelDecimal(a, b, maxPercentDelta, 18, err);
        }
    }

    function assertApproxEq36(uint256 a, uint256 b, uint256 maxPercentDelta) internal pure {
        if (b < 1e36) {
            assertApproxEqAbsDecimal(a, b, maxPercentDelta * 1e18, 36);
        } else {
            assertApproxEqRelDecimal(a, b, maxPercentDelta, 36);
        }
    }

    function assertApproxEq36(uint256 a, uint256 b, uint256 maxPercentDelta, string memory err) internal pure {
        if (b < 1e36) {
            assertApproxEqAbsDecimal(a, b, maxPercentDelta * 1e18, 36, err);
        } else {
            assertApproxEqRelDecimal(a, b, maxPercentDelta, 36, err);
        }
    }
}
