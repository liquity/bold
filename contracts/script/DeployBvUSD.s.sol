
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;


import "test/Utils/Logging.sol";
import "test/Utils/StringEquality.sol";
import "test/TestContracts/MetadataDeployment.sol";
import "src/BoldToken.sol";
import "src/CollateralRegistry.sol";
import "src/HintHelpers.sol";
import "src/MultiTroveGetter.sol";

import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {StringFormatting} from "test/Utils/StringFormatting.sol";

contract DeployBaseProtocol is Logging, MetadataDeployment {
    using Strings for *;
    using StringFormatting for *;
    using StringEquality for string;

    bytes32 SALT;
    address deployer;

    bool deployEmptyCollateralRegistry;

    struct GlobalContracts {
        BoldToken bvUSD;
        CollateralRegistry collateralRegistry;
        IWETH gasToken;
        HintHelpers hintHelpers;
        MultiTroveGetter multiTroveGetter;
    }

    function run() external virtual {
        string memory saltStr = vm.envOr("SALT", block.timestamp.toString());
        SALT = keccak256(bytes(saltStr));

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
        _log("CREATE2 salt:           ", 'keccak256(bytes("', saltStr, '")) = ', uint256(SALT).toHexString());

        // deploy base protocol
        GlobalContracts memory protocolContracts;
        protocolContracts.bvUSD = deployBvUSD();

        _log("bvUSD:               ", address(protocolContracts.bvUSD).toHexString());
        _log("Collateral Registry:               ", address(protocolContracts.collateralRegistry).toHexString());
        _log("Hint Helpers:               ", address(protocolContracts.hintHelpers).toHexString());
        _log("MultiTrove getter:               ", address(protocolContracts.multiTroveGetter).toHexString());
        // TODO save in json?
    }

    // deploy bvUSD
    function deployBvUSD() public returns (BoldToken bvUSDToken) {
        // Deploy Bold token
        bytes memory boldBytecode = bytes.concat(type(BoldToken).creationCode, abi.encode(deployer));
        address bvUSDAddress = vm.computeCreate2Address(SALT, keccak256(boldBytecode));
        bvUSDToken = new BoldToken{salt: SALT}(deployer);
        assert(address(bvUSDToken) == bvUSDAddress);

        vm.writeFile("deployment-manifest.json", string.concat('{"bvUSD Token":"', bvUSDAddress.toHexString(), '"}'));
    }

    // deploy coll registry and set connections
    function deployAndConnectCollateralRegistry(
        BoldToken bvUSDToken, 
        IERC20Metadata[] memory collaterals,
        ITroveManager[] memory troveManagers,
        address owner
    ) public returns (CollateralRegistry collRegistry, HintHelpers helpers, MultiTroveGetter multiTroveGetter) {
        collRegistry = new CollateralRegistry(bvUSDToken, collaterals, troveManagers, deployer);

        // set collateral registry in token
        bvUSDToken.setCollateralRegistry(address(collRegistry));

        helpers = deployHintHelpers(collRegistry);

        multiTroveGetter = deployMultiTroveGetter(collRegistry);
    }

    // deploy hint helper
    function deployHintHelpers(CollateralRegistry collRegistry) public returns (HintHelpers hintHelpers) {
        hintHelpers = new HintHelpers(collRegistry);
    }

    // deploy trove getter
    function deployMultiTroveGetter(CollateralRegistry collRegistry) public returns (MultiTroveGetter multiTroveGetter) {
        multiTroveGetter = new MultiTroveGetter(collRegistry);
    }
}



