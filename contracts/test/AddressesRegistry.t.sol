pragma solidity 0.8.24;

import "./TestContracts/WhitelistTestSetup.sol";
import {AddressesRegistry} from "src/AddressesRegistry.sol";
import {LiquityBase} from "src/Dependencies/LiquityBase.sol";

contract AddressesRegistryWhitelist is WhitelistTestSetup {
    address[3] whitelistedUsers;
    address notWhitelistedUser;

    function setUp() public override {
        super.setUp();

        // set internal owner
        _setOwner(address(deployer));
    }

    function test_initializeWhitelist() public {
        _deployAndSetWhitelist(addressesRegistry);

        assertEq(address(addressesRegistry.whitelist()), address(whitelist));
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

    function test_collateralValuesUpdate_onlyOwner() public {
        uint256 newCCR = 150e16;
        uint256 newMCR = 110e16;
        uint256 newSCR = 110e16;
        uint256 newBCR = 20e16;

        // only owner can propose new CR values
        vm.expectRevert("Owned/not-owner");
        addressesRegistry.proposeNewCollateralValues(newCCR, newSCR, newMCR, newBCR);

        vm.prank(owner);
        addressesRegistry.proposeNewCollateralValues(newCCR, newSCR, newMCR, newBCR);

        AddressesRegistry addressesContract = AddressesRegistry(address(addressesRegistry));

        (uint256 proposedCCR, uint256 proposedMCR, uint256 proposedSCR, uint256 proposedBCR, uint256 time) =
            addressesContract.proposedCR();
        assertEq(time, block.timestamp);
        assertEq(proposedCCR, newCCR);
        assertEq(proposedMCR, newMCR);
        assertEq(proposedSCR, newSCR);
        assertEq(proposedBCR, newBCR);

        // cannot accept before 3 days
        vm.prank(owner);
        vm.expectRevert("Invalid");
        addressesRegistry.acceptNewCollateralValues();

        // only owner can accept after 3 days
        vm.warp(block.timestamp + 3 days);

        vm.expectRevert("Owned/not-owner");
        addressesRegistry.acceptNewCollateralValues();

        vm.prank(owner);
        addressesRegistry.acceptNewCollateralValues();

        // proposal is deleted
        (proposedCCR, proposedMCR, proposedSCR, proposedBCR, time) = addressesContract.proposedCR();
        assertEq(time, 0);
        assertEq(proposedCCR, 0);
        assertEq(proposedMCR, 0);
        assertEq(proposedSCR, 0);
        assertEq(proposedBCR, 0);

        // values are updated
        assertEq(addressesRegistry.CCR(), newCCR);
        assertEq(addressesRegistry.MCR(), newMCR);
        assertEq(addressesRegistry.SCR(), newSCR);
        assertEq(addressesRegistry.BCR(), newBCR);

        // values are updated in trove manager
        TroveManager managerContract = TroveManager(address(troveManager));
        assertEq(managerContract.CCR(), newCCR);
        assertEq(managerContract.MCR(), newMCR);
        assertEq(managerContract.SCR(), newSCR);

        // values are updated in borrower operation
        BorrowerOperations borrowerContract = BorrowerOperations(address(borrowerOperations));
        assertEq(borrowerContract.CCR(), newCCR);
        assertEq(borrowerContract.MCR(), newMCR);
        assertEq(borrowerContract.SCR(), newSCR);
        assertEq(borrowerContract.BCR(), newBCR);
    }

    function test_liquidationValuesUpdate_onlyOwner() public {
        uint256 newLiquidationPenaltySP = 10e16;
        uint256 newLiquidationPenaltyRedistribution = 15e16;

        // only owner can propose new CR values
        vm.expectRevert("Owned/not-owner");
        addressesRegistry.proposeNewLiquidationValues(newLiquidationPenaltySP, newLiquidationPenaltyRedistribution);

        vm.prank(owner);
        addressesRegistry.proposeNewLiquidationValues(newLiquidationPenaltySP, newLiquidationPenaltyRedistribution);

        AddressesRegistry addressesContract = AddressesRegistry(address(addressesRegistry));

        (uint256 liquidationPenaltySP, uint256 liquidationPenaltyRedistribution, uint256 time) =
            addressesContract.proposedLiquidationValues();
        assertEq(time, block.timestamp);
        assertEq(liquidationPenaltySP, newLiquidationPenaltySP);
        assertEq(liquidationPenaltyRedistribution, newLiquidationPenaltyRedistribution);

        // cannot accept before 3 days
        vm.prank(owner);
        vm.expectRevert("Invalid");
        addressesRegistry.acceptNewLiquidationValues();

        // only owner can accept after 3 days
        vm.warp(block.timestamp + 3 days);

        vm.expectRevert("Owned/not-owner");
        addressesRegistry.acceptNewLiquidationValues();

        vm.prank(owner);
        addressesRegistry.acceptNewLiquidationValues();

        // proposal is deleted
        (liquidationPenaltySP, liquidationPenaltyRedistribution, time) = addressesContract.proposedLiquidationValues();
        assertEq(time, 0);
        assertEq(liquidationPenaltySP, 0);
        assertEq(liquidationPenaltyRedistribution, 0);

        // values are updated
        assertEq(addressesRegistry.LIQUIDATION_PENALTY_SP(), newLiquidationPenaltySP);
        assertEq(addressesRegistry.LIQUIDATION_PENALTY_REDISTRIBUTION(), newLiquidationPenaltyRedistribution);

        // values are updated in trove manager
        TroveManager managerContract = TroveManager(address(troveManager));
        assertEq(managerContract.LIQUIDATION_PENALTY_SP(), newLiquidationPenaltySP);
        assertEq(managerContract.LIQUIDATION_PENALTY_REDISTRIBUTION(), newLiquidationPenaltyRedistribution);
    }

    function test_liquidationValuesUpdate_invalidValues() public {
        vm.prank(owner);
        vm.expectRevert(AddressesRegistry.SPPenaltyTooLow.selector);
        addressesRegistry.proposeNewLiquidationValues(4e16, 10e16);

        vm.prank(owner);
        vm.expectRevert(AddressesRegistry.SPPenaltyTooLow.selector);
        addressesRegistry.proposeNewLiquidationValues(4e16, 10e16);

        vm.prank(owner);
        vm.expectRevert(AddressesRegistry.RedistPenaltyTooHigh.selector);
        addressesRegistry.proposeNewLiquidationValues(11e16, 25e16);
    }

    // only addressesRegistry can trigger CR, Liquidation and Whitelist values update in trove manager
    function test_troveManagerUpdate_onlyAddressesRegistry() public {
        vm.expectRevert(LiquityBase.CallerNotAddressesRegistry.selector);
        troveManager.updateCRs(100e16, 100e16, 100e16);

        vm.expectRevert(LiquityBase.CallerNotAddressesRegistry.selector);
        troveManager.updateLiquidationValues(10e16, 10e16);
    }
}
