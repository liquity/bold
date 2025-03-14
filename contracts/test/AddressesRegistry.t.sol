
pragma solidity 0.8.24;

import "./TestContracts/WhitelistTestSetup.sol";
import {AddressesRegistry} from "src/AddressesRegistry.sol";

contract AddressesRegistryWhitelist is WhitelistTestSetup {
    address[3] whitelistedUsers;
    address notWhitelistedUser;

    function setUp() public override {
        super.setUp();
        
        // set internal owner
        _setOwner(address(deployer));
    }

    // the addresses registry owner can directly set the whitelist only once
    // and afterwards have the 3 days delay
    function test_initializeWhitelist() public {
        _deployAndSetWhitelist(addressesRegistry);
        
        assertEq(address(addressesRegistry.whitelist()), address(whitelist));

        // cannot set again
        vm.expectRevert(AddressesRegistry.AlreadyInitialized.selector);
        vm.prank(owner);
        addressesRegistry.initializeWhitelist(address(1234));
    }

    function test_propose_update_whitelist() public {
        // cannot be "accepted" before initialization
        vm.expectRevert("Invalid");
        _acceptNewWhitelist(addressesRegistry);

        _deployAndSetWhitelist(addressesRegistry);
        assertEq(address(addressesRegistry.whitelist()), address(whitelist));

        // propose update
        address newWhitelist = address(new Whitelist(owner));
        uint256 timestamp = block.timestamp;
        _proposeNewWhitelist(addressesRegistry, newWhitelist);
        
        AddressesRegistry addressesContract = AddressesRegistry(address(addressesRegistry));
        (address proposedWhitelist, uint256 proposedTimestamp) = addressesContract.proposedWhitelist();

        assertEq(proposedTimestamp, block.timestamp);
        assertEq(proposedWhitelist, newWhitelist);

        // cannot accept before 3 days 
        vm.expectRevert("Invalid");
        _acceptNewWhitelist(addressesRegistry);

        // roll 3 days and accept
        vm.warp(block.timestamp + 3 days);

        _acceptNewWhitelist(addressesRegistry);
        
        assertEq(address(addressesRegistry.whitelist()), newWhitelist);
        
        // proposal reset
        (proposedWhitelist, proposedTimestamp) = addressesContract.proposedWhitelist();
        assertEq(proposedTimestamp, 0);
        assertEq(proposedWhitelist, address(0));
    }


    function test_whitelistInitialization_onlyOwner() public {
        // only owner can initialise the whitelist on a branch
        whitelist = IWhitelist(address(new Whitelist(owner)));
        
        vm.prank(address(1234));
        vm.expectRevert("Owned/not-owner");
        addressesRegistry.initializeWhitelist(address(whitelist));
    }


    function test_whitelistUpdate_onlyOwner() public {
        // only owner can propose
        _deployAndSetWhitelist(addressesRegistry);
        
        address newWhitelist = address(new Whitelist(owner));
        vm.prank(address(1234));
        vm.expectRevert("Owned/not-owner");
        addressesRegistry.proposeNewWhitelist(newWhitelist);

        // only owner can accept proposal after 3 days
        _proposeNewWhitelist(addressesRegistry, newWhitelist);

        vm.warp(block.timestamp + 3 days);
        vm.prank(address(1234));
        vm.expectRevert("Owned/not-owner");
        addressesRegistry.acceptNewWhitelist();
    }
}