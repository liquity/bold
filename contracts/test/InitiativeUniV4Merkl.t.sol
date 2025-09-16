// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {UniV4MerklRewards, IDistributionCreator} from "V2-gov/src/UniV4MerklRewards.sol";
import "./Utils/E2EHelpers.sol";
import "forge-std/console2.sol";

// Start an anvil node or set up a proper RPC URL
// FOUNDRY_PROFILE=e2e E2E_RPC_URL="http://localhost:8545" forge test --mc InitiativeUniV4Merkl -vvv

contract InitiativeUniV4Merkl is E2EHelpers {
    address constant GOVERNANCE_WHALE = 0xF30da4E4e7e20Dbf5fBE9adCD8699075D62C60A4;
    address constant NEW_LQTY_WHALE = 0xF977814e90dA44bFA03b6295A0616a897441aceC;
    UniV4MerklRewards constant uniV4MerklRewardsInitiative = UniV4MerklRewards(0xB42448852A1BFc99d66ed53C65e2B49cF954f615);
    IDistributionCreator constant merklDistributionCreator =
        IDistributionCreator(0x8BB4C975Ff3c250e0ceEA271728547f3802B36Fd);

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

        skip(28 days);

        assertEq(governance.registeredInitiatives(address(uniV4MerklRewardsInitiative)), 0, "Initiative should not be registered");

        // Register initiative
        vm.startPrank(registrant);
        boldToken.approve(address(governance), REGISTRATION_FEE);
        governance.registerInitiative(address(uniV4MerklRewardsInitiative));
        vm.stopPrank();

        assertGt(governance.registeredInitiatives(address(uniV4MerklRewardsInitiative)), 0, "Initiative should be registered");

        skip(7 days);

        // Allocate to initiative
        _allocateLQTY_begin(staker);
        _allocateLQTY_vote(address(uniV4MerklRewardsInitiative), int256(lqtyStake));
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
            governance.snapshotVotesForInitiative(address(uniV4MerklRewardsInitiative));
        console2.log(initiativeVoteSnapshot.votes, "initiative Votes");
        (Governance.InitiativeStatus status, uint256 lastEpochClaim, uint256 claimableAmount) =
            governance.getInitiativeState(address(uniV4MerklRewardsInitiative));
        console2.log(uint256(status), "uint(status)");
        console2.log(lastEpochClaim, "lastEpochClaim");
        console2.log(claimableAmount, "claimableAmount");
        */

        // Claim for initiative
        uint256 initialMerklDistributorBoldBalance = boldToken.balanceOf(address(merklDistributionCreator.distributor()));
        (,, uint256 claimableAmount) = governance.getInitiativeState(address(uniV4MerklRewardsInitiative));
        // Creating a campaign is expensive, and uses more than the allowed by Gorvernace contract, so we need a wrapper
        // governance.claimForInitiative(address(uniV4MerklRewardsInitiative));
        uniV4MerklRewardsInitiative.claimForInitiative();
        //console2.log(boldToken.balanceOf(address(uniV4MerklRewardsInitiative)), "boldToken.balanceOf(address(uniV4MerklRewardsInitiative))");
        assertEq(boldToken.balanceOf(address(uniV4MerklRewardsInitiative)), 0, "Initiative should have sent incentives to campaign");
        // Check campaign
        uint256 epochEnd = EPOCH_START + (governance.epoch() - 1) * EPOCH_DURATION;
        IDistributionCreator.CampaignParameters memory params = IDistributionCreator.CampaignParameters({
            campaignId: bytes32(0),
            creator: address(uniV4MerklRewardsInitiative),
            rewardToken: address(boldToken),
            amount: claimableAmount,
            campaignType: uniV4MerklRewardsInitiative.CAMPAIGN_TYPE(),
            startTimestamp: uint32(epochEnd),
            duration: uint32(EPOCH_DURATION),
            campaignData: uniV4MerklRewardsInitiative.getCampaignData()
        });
        bytes32 campaignId = merklDistributionCreator.campaignId(params);
        uint256 campaignAmount = params.amount * 97 / 100;
        IDistributionCreator.CampaignParameters memory campaign = merklDistributionCreator.campaign(campaignId);
        assertEq(campaign.creator, params.creator, "creator");
        assertEq(campaign.rewardToken, params.rewardToken, "rewardToken");
        assertEq(campaign.amount, campaignAmount, "amount minus fees");
        assertEq(campaign.campaignType, params.campaignType, "campaignType");
        assertEq(campaign.startTimestamp, params.startTimestamp, "startTimestamp");
        assertEq(campaign.duration, params.duration, "duration");
        assertEq(campaign.campaignData, params.campaignData, "campaignData");

        assertEq(
            boldToken.balanceOf(address(merklDistributionCreator.distributor())) - initialMerklDistributorBoldBalance,
            campaignAmount,
            "Merkl Distributor should have campaign amount BOLD"
        );

    }
}
