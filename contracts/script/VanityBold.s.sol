// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {StringFormatting} from "test/Utils/StringFormatting.sol";
import "test/Utils/Logging.sol";

import "src/BoldToken.sol";

contract VanityBoldScript is Script, StdCheats, Logging {
    using Strings for *;
    using StringFormatting for *;

    uint256 constant SOUGHT_PATTERN = 0xb01d;
    uint256 ITERATIONS;

    bytes32 SALT;
    address deployer;
    address boldAddress;

    function run() external {
        string memory baseSaltStr = vm.envOr("SALT", block.timestamp.toString());
        uint256 startIndex = vm.envOr("START_INDEX", uint256(0));
        uint256 iterations = vm.envOr("ITERATIONS", uint256(100000));

        if (vm.envBytes("DEPLOYER").length == 20) {
            // address
            deployer = vm.envAddress("DEPLOYER");
            vm.startBroadcast(deployer);
        } else {
            // private key
            uint256 privateKey = vm.envUint("DEPLOYER");
            deployer = vm.addr(privateKey);
            vm.startBroadcast(privateKey);
        }

        _log("Deployer:               ", deployer.toHexString());
        _log("Deployer balance:       ", deployer.balance.decimal());

        bytes memory boldBytecode = bytes.concat(type(BoldToken).creationCode, abi.encode(deployer));
        for (uint256 i = startIndex; i < startIndex + iterations; i++) {
            //if (i % 10000 == 0) _log("iteration: ", i.toString());
            string memory saltStr = string.concat(baseSaltStr, i.toString());
            //_log(saltStr);
            SALT = keccak256(bytes(saltStr));
            boldAddress = vm.computeCreate2Address(SALT, keccak256(boldBytecode));
            if (uint256(uint160(boldAddress)) >> 144 == SOUGHT_PATTERN) {
                _log("CREATE2 salt:           ", 'keccak256(bytes("', saltStr, '")) = ', uint256(SALT).toHexString());
                _log("BOLD address:           ", boldAddress.toHexString());
                break;
            }
        }

        vm.writeFile("bold-address.json", string.concat('{"boldToken":"', boldAddress.toHexString(), '"}'));
        return;
    }
}
