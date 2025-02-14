

// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.0;

import {BaseTargetFunctions} from "@chimera/BaseTargetFunctions.sol";
import {Asserts} from "@chimera/Asserts.sol";
import {vm} from "@chimera/Hevm.sol";

abstract contract RevertHelper is Asserts {
    function assertRevertReasonNotEqual(bytes memory returnData, string memory reason) internal {
        bool isEqual = _isRevertReasonEqual(returnData, reason);
        t(!isEqual, reason);
    }
    
    function assertRevertReasonEqual(bytes memory returnData, string memory reason) internal {
        bool isEqual = _isRevertReasonEqual(returnData, reason);
        t(isEqual, reason);
    }

    function _getRevertMsg(bytes memory returnData) internal pure returns (string memory) {
        // Check that the data has the right size: 4 bytes for signature + 32 bytes for panic code
        if (returnData.length == 4 + 32) {
            // Check that the data starts with the Panic signature
            bytes4 panicSignature = bytes4(keccak256(bytes("Panic(uint256)")));
            for (uint i = 0; i < 4; i++) {
                if (returnData[i] != panicSignature[i]) return "Undefined signature";
            }

            uint256 panicCode;
            for (uint i = 4; i < 36; i++) {
                panicCode = panicCode << 8;
                panicCode |= uint8(returnData[i]);
            }

            // Now convert the panic code into its string representation
            if (panicCode == 17) {
                return "Panic(17)";
            }
            if (panicCode == 18) {
                return "Panic(18)";
            } 

            // Add other panic codes as needed or return a generic "Unknown panic"
            return "Undefined panic code";
        }

        // If the returnData length is less than 68, then the transaction failed silently (without a revert message)
        if (returnData.length < 68) return "Transaction reverted silently";

        assembly {
            // Slice the sighash.
            returnData := add(returnData, 0x04)
        }
        return abi.decode(returnData, (string)); // All that remains is the revert string
    }

    function _getStringAsSig(string memory reason) internal pure returns (bytes4 expectedSig) {
        // return the bytes4 representation of the string
        expectedSig = bytes4(keccak256(bytes(reason)));
    }

    function _isRevertReasonEqual(
        bytes memory returnData,
        string memory reason
    ) internal pure returns (bool) {
        bytes4 sig = bytes4(returnData);
        bytes4 expectedSig = _getStringAsSig(reason);
        return (sig == expectedSig);
    }
}