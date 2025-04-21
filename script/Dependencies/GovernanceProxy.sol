// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin/contracts/interfaces/IERC20.sol";
import {IGovernance} from "V2-gov/src/interfaces/IGovernance.sol";
import {ILQTYStaking} from "V2-gov/src/interfaces/ILQTYStaking.sol";
import {IMultiDelegateCall} from "V2-gov/src/interfaces/IMultiDelegateCall.sol";
import {IUserProxyFactory} from "V2-gov/src/interfaces/IUserProxyFactory.sol";
import {PermitParams} from "V2-gov/src/utils/Types.sol";
import {Governance} from "V2-gov/src/Governance.sol";

contract GovernanceProxy is IGovernance, IUserProxyFactory, IMultiDelegateCall {
    Governance public immutable governance;
    IERC20 public immutable lqty;
    IERC20 public immutable bold;

    constructor(Governance _governance) {
        governance = _governance;
        lqty = _governance.lqty();
        bold = _governance.bold();

        address userProxy = _governance.deriveUserProxyAddress(address(this));
        lqty.approve(userProxy, type(uint256).max);
        bold.approve(address(_governance), type(uint256).max);
    }

    function registerInitialInitiatives(address[] memory) external pure override {
        revert("GovernanceProxy: not-implemented");
    }

    function stakingV1() external view override returns (ILQTYStaking) {
        return governance.stakingV1();
    }

    function EPOCH_START() external view override returns (uint256) {
        return governance.EPOCH_START();
    }

    function EPOCH_DURATION() external view override returns (uint256) {
        return governance.EPOCH_DURATION();
    }

    function EPOCH_VOTING_CUTOFF() external view override returns (uint256) {
        return governance.EPOCH_VOTING_CUTOFF();
    }

    function MIN_CLAIM() external view override returns (uint256) {
        return governance.MIN_CLAIM();
    }

    function MIN_ACCRUAL() external view override returns (uint256) {
        return governance.MIN_ACCRUAL();
    }

    function REGISTRATION_FEE() external view override returns (uint256) {
        return governance.REGISTRATION_FEE();
    }

    function REGISTRATION_THRESHOLD_FACTOR() external view override returns (uint256) {
        return governance.REGISTRATION_THRESHOLD_FACTOR();
    }

    function UNREGISTRATION_THRESHOLD_FACTOR() external view override returns (uint256) {
        return governance.UNREGISTRATION_THRESHOLD_FACTOR();
    }

    function UNREGISTRATION_AFTER_EPOCHS() external view override returns (uint256) {
        return governance.UNREGISTRATION_AFTER_EPOCHS();
    }

    function VOTING_THRESHOLD_FACTOR() external view override returns (uint256) {
        return governance.VOTING_THRESHOLD_FACTOR();
    }

    function boldAccrued() external view override returns (uint256) {
        return governance.boldAccrued();
    }

    function votesSnapshot() external view override returns (uint256 votes, uint256 forEpoch) {
        return governance.votesSnapshot();
    }

    function votesForInitiativeSnapshot(address _initiative)
        external
        view
        override
        returns (uint256 votes, uint256 forEpoch, uint256 lastCountedEpoch, uint256 vetos)
    {
        return governance.votesForInitiativeSnapshot(_initiative);
    }

    function userStates(address _user)
        external
        view
        override
        returns (uint256 unallocatedLQTY, uint256 unallocatedOffset, uint256 allocatedLQTY, uint256 allocatedOffset)
    {
        return governance.userStates(_user);
    }

    function initiativeStates(address _initiative)
        external
        view
        override
        returns (uint256 voteLQTY, uint256 voteOffset, uint256 vetoLQTY, uint256 vetoOffset, uint256 lastEpochClaim)
    {
        return governance.initiativeStates(_initiative);
    }

    function globalState() external view override returns (uint256 countedVoteLQTY, uint256 countedVoteOffset) {
        return governance.globalState();
    }

    function lqtyAllocatedByUserToInitiative(address _user, address _initiative)
        external
        view
        override
        returns (uint256 voteLQTY, uint256 voteOffset, uint256 vetoLQTY, uint256 vetoOffset, uint256 atEpoch)
    {
        return governance.lqtyAllocatedByUserToInitiative(_user, _initiative);
    }

    function registeredInitiatives(address _initiative) external view override returns (uint256 atEpoch) {
        return governance.registeredInitiatives(_initiative);
    }

    function depositLQTY(uint256 _lqtyAmount) external override {
        governance.depositLQTY(_lqtyAmount);
    }

    function depositLQTY(uint256 _lqtyAmount, bool _doSendRewards, address _recipient) external override {
        governance.depositLQTY(_lqtyAmount, _doSendRewards, _recipient);
    }

    function depositLQTYViaPermit(uint256, PermitParams calldata) external pure override {
        revert("GovernanceProxy: not-implemented");
    }

    function depositLQTYViaPermit(uint256, PermitParams calldata, bool, address) external pure override {
        revert("GovernanceProxy: not-implemented");
    }

    function withdrawLQTY(uint256 _lqtyAmount) external override {
        governance.withdrawLQTY(_lqtyAmount);
    }

    function withdrawLQTY(uint256 _lqtyAmount, bool _doSendRewards, address _recipient) external override {
        governance.withdrawLQTY(_lqtyAmount, _doSendRewards, _recipient);
    }

    function claimFromStakingV1(address _rewardRecipient)
        external
        override
        returns (uint256 lusdSent, uint256 ethSent)
    {
        return governance.claimFromStakingV1(_rewardRecipient);
    }

    function epoch() external view override returns (uint256) {
        return governance.epoch();
    }

    function epochStart() external view override returns (uint256) {
        return governance.epochStart();
    }

    function secondsWithinEpoch() external view override returns (uint256) {
        return governance.secondsWithinEpoch();
    }

    function lqtyToVotes(uint256 _lqtyAmount, uint256 _timestamp, uint256 _offset)
        external
        pure
        override
        returns (uint256)
    {
        uint256 prod = _lqtyAmount * _timestamp;
        return prod > _offset ? prod - _offset : 0;
    }

    function calculateVotingThreshold() external override returns (uint256) {
        return governance.calculateVotingThreshold();
    }

    function calculateVotingThreshold(uint256 _votes) external view override returns (uint256) {
        return governance.calculateVotingThreshold(_votes);
    }

    function getTotalVotesAndState()
        external
        view
        override
        returns (VoteSnapshot memory snapshot, GlobalState memory state, bool shouldUpdate)
    {
        return governance.getTotalVotesAndState();
    }

    function getInitiativeSnapshotAndState(address _initiative)
        external
        view
        override
        returns (
            InitiativeVoteSnapshot memory initiativeSnapshot,
            InitiativeState memory initiativeState,
            bool shouldUpdate
        )
    {
        return governance.getInitiativeSnapshotAndState(_initiative);
    }

    function getLatestVotingThreshold() external view override returns (uint256) {
        return governance.getLatestVotingThreshold();
    }

    function snapshotVotesForInitiative(address _initiative)
        external
        override
        returns (VoteSnapshot memory voteSnapshot, InitiativeVoteSnapshot memory initiativeVoteSnapshot)
    {
        return governance.snapshotVotesForInitiative(_initiative);
    }

    function getInitiativeState(address _initiative)
        external
        override
        returns (InitiativeStatus status, uint256 lastEpochClaim, uint256 claimableAmount)
    {
        return governance.getInitiativeState(_initiative);
    }

    function getInitiativeState(
        address _initiative,
        VoteSnapshot memory _votesSnapshot,
        InitiativeVoteSnapshot memory _votesForInitiativeSnapshot,
        InitiativeState memory _initiativeState
    ) external view override returns (InitiativeStatus status, uint256 lastEpochClaim, uint256 claimableAmount) {
        return governance.getInitiativeState(_initiative, _votesSnapshot, _votesForInitiativeSnapshot, _initiativeState);
    }

    function registerInitiative(address _initiative) external override {
        governance.registerInitiative(_initiative);
    }

    function unregisterInitiative(address _initiative) external override {
        governance.unregisterInitiative(_initiative);
    }

    function allocateLQTY(
        address[] calldata _resetInitiatives,
        address[] memory _initiatives,
        int256[] memory _absoluteLQTYVotes,
        int256[] memory absoluteLQTYVetos
    ) external override {
        governance.allocateLQTY(_resetInitiatives, _initiatives, _absoluteLQTYVotes, absoluteLQTYVetos);
    }

    function resetAllocations(address[] calldata _initiativesToReset, bool _checkAll) external {
        governance.resetAllocations(_initiativesToReset, _checkAll);
    }

    function claimForInitiative(address _initiative) external override returns (uint256 claimed) {
        return governance.claimForInitiative(_initiative);
    }

    function userProxyImplementation() external view override returns (address) {
        return governance.userProxyImplementation();
    }

    function deriveUserProxyAddress(address _user) external view override returns (address) {
        return governance.deriveUserProxyAddress(_user);
    }

    function deployUserProxy() external override returns (address userProxyAddress) {
        return governance.deployUserProxy();
    }

    function multiDelegateCall(bytes[] calldata inputs) external override returns (bytes[] memory returnValues) {
        return governance.multiDelegateCall(inputs);
    }
}
