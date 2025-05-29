// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
import { BoldToken, IBoldToken } from "../src/BoldToken.sol";
import {console} from "forge-std/console.sol";

import {Test} from "forge-std/Test.sol";
import {ISuperTokenFactory} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {SuperfluidFrameworkDeployer} from
    "@superfluid-finance/ethereum-contracts/contracts/utils/SuperfluidFrameworkDeployer.t.sol";
import {ERC1820RegistryCompiled} from
    "@superfluid-finance/ethereum-contracts/contracts/libs/ERC1820RegistryCompiled.sol";
import { SuperTokenV1Library } from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperTokenV1Library.sol";

using SuperTokenV1Library for IBoldToken;

contract SFBold is Test {
    string internal constant _NAME = "TestToken";
    address internal constant _OWNER = address(0x1);
    uint256 internal constant _PERMIT_SIGNER_PK = 0xA11CE;
    address internal constant _ALICE = address(0x4242);
    address internal constant _BOB = address(0x4243);
    address internal _permitSigner;
    IBoldToken internal _boldToken;
    SuperfluidFrameworkDeployer.Framework internal _sf;

    function setUp() public {
        vm.etch(ERC1820RegistryCompiled.at, ERC1820RegistryCompiled.bin);
        SuperfluidFrameworkDeployer sfDeployer = new SuperfluidFrameworkDeployer();
        sfDeployer.deployTestFramework();
        _sf = sfDeployer.getFramework();

        BoldToken superTokenPermitProxy = new BoldToken(_OWNER, _sf.superTokenFactory);
        console.log("Deploying super token permit proxy in Setup for SF Bold. superTokenPermitProxy", address(superTokenPermitProxy));
        superTokenPermitProxy.initialize();
        _boldToken = IBoldToken(address(superTokenPermitProxy));

        // Generate signer address from private key
        _permitSigner = vm.addr(_PERMIT_SIGNER_PK);

        // Fund the signer with some tokens
        vm.startPrank(_OWNER);
        _boldToken.setBranchAddresses(_OWNER, _OWNER, _OWNER, _OWNER);
        _boldToken.mint(_permitSigner, 500 ether);
        _boldToken.mint(_ALICE, 500 ether);
        vm.stopPrank();
    }

    function testPermit() public {
        // Test parameters
        address spender = address(0x2);
        uint256 value = 100;
        uint256 deadline = block.timestamp + 1 hours;

        // Get the current nonce for signer
        uint256 nonce = _boldToken.nonces(_permitSigner);

        assertEq(_boldToken.allowance(_permitSigner, spender), 0, "Allowance should be 0");

        // Create permit digest
        bytes32 digest = _createPermitDigest(_permitSigner, spender, value, nonce, deadline);

        // Create signature
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(_PERMIT_SIGNER_PK, digest);

        // Execute permit as a different address
        vm.startPrank(address(0x3));

        // expect revert if spender doesn't match
        vm.expectRevert();
        _boldToken.permit(_permitSigner, address(0xfefe), value, deadline, v, r, s);

        // expect revert if value doesn't match
        vm.expectRevert();
        _boldToken.permit(_permitSigner, spender, value + 1, deadline, v, r, s);

        // expect revert if signature is invalid
        vm.expectRevert();
        _boldToken.permit(_permitSigner, spender, value, deadline, v + 1, r, s);

        uint256 prevBlockTS = block.timestamp;
        vm.warp(block.timestamp + deadline + 1);
        // expect revert if deadline is in the past
        vm.expectRevert();
        _boldToken.permit(_permitSigner, spender, value, deadline, v, r, s);

        vm.warp(prevBlockTS);

        // Now test with correct parameters - should succeed
        _boldToken.permit(_permitSigner, spender, value, deadline, v, r, s);

        vm.stopPrank();

        // Verify results
        assertEq(_boldToken.nonces(_permitSigner), 1, "Nonce should be incremented");
        assertEq(_boldToken.allowance(_permitSigner, spender), value, "Allowance should be set");
    }

    function testFlow() public {
        int96 flowRate = 1e12;
        uint256 duration = 3600;

        uint256 aliceInitialBalance = _boldToken.balanceOf(_ALICE);
        assertEq(_boldToken.balanceOf(_BOB), 0, "Bob should start with balance 0");

        vm.startPrank(_ALICE);
        _boldToken.createFlow(_BOB, flowRate);
        vm.stopPrank();

        vm.warp(block.timestamp + duration);

        uint256 flowAmount = uint96(flowRate) * duration;
        assertEq(_boldToken.balanceOf(_BOB), flowAmount, "Bob unexpected balance");

        vm.startPrank(_ALICE);
        _boldToken.deleteFlow(_ALICE, _BOB);
        vm.stopPrank();

        assertEq(_boldToken.balanceOf(_BOB), flowAmount, "Bob unexpected balance");
        assertEq(_boldToken.balanceOf(_ALICE), aliceInitialBalance - flowAmount, "Alice unexpected balance");
    }

    function testStorageLayout() public {
        SFBoldStorageLayoutTest testContract = new SFBoldStorageLayoutTest(_OWNER, _sf.superTokenFactory);
        testContract.validateStorageLayout();
    }

    // ============================ Internal Functions ============================

    function _createPermitDigest(address owner, address spender, uint256 value, uint256 nonce, uint256 deadline)
        internal
        view
        returns (bytes32)
    {
        bytes32 PERMIT_TYPEHASH =
            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonce, deadline));

        bytes32 DOMAIN_SEPARATOR = _boldToken.DOMAIN_SEPARATOR();

        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }
}

/// Validation of the storage layout
contract SFBoldStorageLayoutTest is BoldToken {

    constructor(address _owner, ISuperTokenFactory _sf) BoldToken(_owner, _sf) {}
    error STORAGE_LOCATION_CHANGED(string _name);

    function validateStorageLayout() public pure {
        uint256 slot;
        uint256 offset;

        // storage slots 0-31 are reserved for SuperToken logic via CustomSuperTokenBase
        // storage slot 32: Ownable | address _owner

        assembly { slot := collateralRegistryAddress.slot offset := collateralRegistryAddress.offset }
        if (slot != 33 || offset != 0) revert STORAGE_LOCATION_CHANGED("collateralRegistryAddress");

        assembly { slot := troveManagerAddresses.slot offset := troveManagerAddresses.offset }
        if (slot != 34 || offset != 0) revert STORAGE_LOCATION_CHANGED("troveManagerAddresses");

        assembly { slot := stabilityPoolAddresses.slot offset := stabilityPoolAddresses.offset }
        if (slot != 35 || offset != 0) revert STORAGE_LOCATION_CHANGED("stabilityPoolAddresses");

        assembly { slot := borrowerOperationsAddresses.slot offset := borrowerOperationsAddresses.offset }
        if (slot != 36 || offset != 0) revert STORAGE_LOCATION_CHANGED("borrowerOperationsAddresses");

        assembly { slot := activePoolAddresses.slot offset := activePoolAddresses.offset }
        if (slot != 37 || offset != 0) revert STORAGE_LOCATION_CHANGED("activePoolAddresses");
    }
}