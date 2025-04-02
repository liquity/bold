// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StdAssertions} from "forge-std/StdAssertions.sol";
import {stdMath} from "forge-std/StdMath.sol";

contract Assertions is StdAssertions {
    function assertApproxEqAbsRelDecimal(
        uint256 a,
        uint256 b,
        uint256 maxAbs,
        uint256 maxRel,
        uint256 decimals,
        string memory err
    ) internal pure {
        if (b == 0) {
            assertApproxEqAbsDecimal(a, b, maxAbs, decimals, err);
            return;
        }

        uint256 abs = stdMath.delta(a, b);
        uint256 rel = stdMath.percentDelta(a, b);

        if (abs > maxAbs && rel > maxRel) {
            assertApproxEqRelDecimal(a, b, maxRel, decimals, err);
            revert("Assertion should have failed");
        }
    }

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
