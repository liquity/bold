// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "./Utils/E2EHelpers.sol";
import "forge-std/console2.sol";

address constant INITIATIVE_ADDRESS = 0xa58FBe38AAB33b9fadEf1B5Aaff4D7bC27C43aD4;
address constant GOVERNANCE_WHALE = 0xF30da4E4e7e20Dbf5fBE9adCD8699075D62C60A4;

// Start an anvil node or set up a proper RPC URL
// FOUNDRY_PROFILE=e2e E2E_RPC_URL="http://localhost:8545" forge test --mc InitiativeSmarDEX -vvv

contract InitiativeSmarDEX is E2EHelpers {
    address public NEW_LQTY_WHALE = 0xF977814e90dA44bFA03b6295A0616a897441aceC;

    function setUp() public override {
        super.setUp();
        vm.label(NEW_LQTY_WHALE, "LQTY_WHALE");
        providerOf[LQTY] = NEW_LQTY_WHALE;
    }

    function testInitiativeRegistrationAndClaim() external {
        address borrower = makeAddr("borrower");
        address registrant = GOVERNANCE_WHALE;

        // Open trove and transfer BOLD to registrant
        uint256 donationAmount = 10_000 ether;
        _openTrove(0, borrower, 0, Math.max(REGISTRATION_FEE, MIN_DEBT) + donationAmount);
        vm.startPrank(borrower);
        boldToken.transfer(registrant, REGISTRATION_FEE);
        vm.stopPrank();

        // Stake LQTY and accumulate voting power
        address staker = makeAddr("staker");
        uint256 lqtyStake = 3_000_000 ether;
        _depositLQTY(staker, lqtyStake);

        skip(30 days);

        assertEq(governance.registeredInitiatives(INITIATIVE_ADDRESS), 0, "Initiative should not be registered");

        // Register initiative
        vm.startPrank(registrant);
        boldToken.approve(address(governance), REGISTRATION_FEE);
        governance.registerInitiative(INITIATIVE_ADDRESS);
        vm.stopPrank();

        assertGt(governance.registeredInitiatives(INITIATIVE_ADDRESS), 0, "Initiative should be registered");

        skip(7 days);

        // Allocate to initiative
        _allocateLQTY_begin(staker);
        _allocateLQTY_vote(INITIATIVE_ADDRESS, int256(lqtyStake)); // TODO
        _allocateLQTY_end();

        // Donate
        vm.startPrank(borrower);
        boldToken.transfer(address(governance), donationAmount);
        vm.stopPrank();

        skip(7 days);

        /*
        console2.log(boldToken.balanceOf(address(governance)), "boldToken.balanceOf(address(governance))");
        console2.log(governance.getLatestVotingThreshold(), "voting threshold");
        (Governance.VoteSnapshot memory voteSnapshot, Governance.InitiativeVoteSnapshot memory initiativeVoteSnapshot) =
            governance.snapshotVotesForInitiative(INITIATIVE_ADDRESS);
        console2.log(initiativeVoteSnapshot.votes, "initiative Votes");
        (Governance.InitiativeStatus status, uint256 lastEpochClaim, uint256 claimableAmount) =
            governance.getInitiativeState(INITIATIVE_ADDRESS);
        console2.log(uint256(status), "uint(status)");
        console2.log(lastEpochClaim, "lastEpochClaim");
        console2.log(claimableAmount, "claimableAmount");
        */
        // Claim for initiative
        governance.claimForInitiative(INITIATIVE_ADDRESS);
        //console2.log(boldToken.balanceOf(INITIATIVE_ADDRESS), "boldToken.balanceOf(INITIATIVE_ADDRESS)");
        assertGt(boldToken.balanceOf(INITIATIVE_ADDRESS), 0, "Initiative should have received incentives");
    }
}
