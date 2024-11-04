import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { governanceDeploymentBlock, governanceDeploymentInitiatives } from "../addresses";
import {
  AllocateLQTY as AllocateLQTYEvent,
  ClaimForInitiative as ClaimForInitiativeEvent,
  DepositLQTY as DepositLQTYEvent,
  Governance as GovernanceContract,
  RegisterInitiative as RegisterInitiativeEvent,
  SnapshotVotesForInitiative as SnapshotVotesForInitiativeEvent,
  UnregisterInitiative as UnregisterInitiativeEvent,
  WithdrawLQTY as WithdrawLQTYEvent,
} from "../generated/Governance/Governance";
import { GovernanceAllocation, GovernanceInitiative, GovernanceStats, GovernanceUser } from "../generated/schema";

export function handleBlock(block: ethereum.Block): void {
  // Initial governance initiatives passed to the constructor (no event emitted)
  if (block.number.equals(BigInt.fromI32(governanceDeploymentBlock))) {
    for (let i = 0; i < governanceDeploymentInitiatives.length; i++) {
      let initiative = new GovernanceInitiative(governanceDeploymentInitiatives[i]);
      initiative.registrant = Address.zero();
      initiative.registeredAt = block.timestamp;
      initiative.registeredAtEpoch = 1;
      initiative.totalVotes = BigInt.fromI32(0);
      initiative.totalVetos = BigInt.fromI32(0);
      initiative.totalBoldClaimed = BigInt.fromI32(0);
      initiative.save();
    }
  }
}

export function handleRegisterInitiative(event: RegisterInitiativeEvent): void {
  let initiative = new GovernanceInitiative(event.params.initiative.toHex());
  initiative.registrant = event.params.registrant;
  initiative.registeredAt = event.block.timestamp;
  initiative.registeredAtEpoch = event.params.atEpoch;
  initiative.totalVotes = BigInt.fromI32(0);
  initiative.totalVetos = BigInt.fromI32(0);
  initiative.save();
}

export function handleUnregisterInitiative(event: UnregisterInitiativeEvent): void {
  let initiative = GovernanceInitiative.load(event.params.initiative.toHex());
  if (initiative) {
    initiative.unregisteredAt = event.block.timestamp;
    initiative.unregisteredAtEpoch = event.params.atEpoch;
    initiative.save();
  }
}

export function handleSnapshotVotesForInitiative(event: SnapshotVotesForInitiativeEvent): void {
  let initiative = GovernanceInitiative.load(event.params.initiative.toHex());
  if (initiative) {
    initiative.lastVoteSnapshotEpoch = event.params.forEpoch;
    initiative.lastVoteSnapshotVotes = event.params.votes;
    initiative.save();
  }
}

export function handleDepositLQTY(event: DepositLQTYEvent): void {
  let user = GovernanceUser.load(event.params.user.toHex());
  if (user === null) {
    user = new GovernanceUser(event.params.user.toHex());
  }

  let governance = GovernanceContract.bind(event.address);
  let userState = governance.userStates(event.params.user);

  user.allocatedLQTY = userState.getAllocatedLQTY();
  user.averageStakingTimestamp = userState.getAverageStakingTimestamp();
  user.save();

  let stats = getOrCreateStats();
  stats.totalLQTYStaked = stats.totalLQTYStaked.plus(event.params.depositedLQTY);
  stats.save();
}

export function handleWithdrawLQTY(event: WithdrawLQTYEvent): void {
  let user = GovernanceUser.load(event.params.user.toHex());
  if (user === null) {
    return;
  }

  let governance = GovernanceContract.bind(event.address);
  let userState = governance.userStates(event.params.user);

  user.allocatedLQTY = userState.getAllocatedLQTY();
  user.averageStakingTimestamp = userState.getAverageStakingTimestamp();
  user.save();

  let stats = getOrCreateStats();
  stats.totalLQTYStaked = stats.totalLQTYStaked.minus(event.params.withdrawnLQTY);
  stats.save();
}

export function handleAllocateLQTY(event: AllocateLQTYEvent): void {
  let userId = event.params.user.toHex();
  let initiativeId = event.params.initiative.toHex();
  let allocationId = initiativeId + ":" + userId;

  let user = GovernanceUser.load(userId);
  let initiative = GovernanceInitiative.load(initiativeId);

  if (!user || !initiative) {
    return;
  }

  let allocation = GovernanceAllocation.load(allocationId);
  if (allocation === null) {
    allocation = new GovernanceAllocation(allocationId);
    allocation.user = user.id;
    allocation.initiative = initiative.id;
    allocation.voteLQTY = BigInt.fromI32(0);
    allocation.vetoLQTY = BigInt.fromI32(0);
  }

  // votes
  allocation.voteLQTY = allocation.voteLQTY.plus(event.params.deltaVoteLQTY);
  user.allocatedLQTY = user.allocatedLQTY.plus(event.params.deltaVoteLQTY);
  initiative.totalVotes = initiative.totalVotes.plus(event.params.deltaVoteLQTY);

  // vetos
  allocation.vetoLQTY = allocation.vetoLQTY.plus(event.params.deltaVetoLQTY);
  user.allocatedLQTY = user.allocatedLQTY.plus(event.params.deltaVetoLQTY);
  initiative.totalVetos = initiative.totalVetos.plus(event.params.deltaVetoLQTY);

  allocation.atEpoch = event.params.atEpoch;

  allocation.save();
  user.save();
  initiative.save();
}

function getOrCreateStats(): GovernanceStats {
  let state = GovernanceStats.load("global");
  if (state === null) {
    state = new GovernanceStats("global");
    state.totalLQTYStaked = BigInt.fromI32(0);
    state.totalInitiatives = 0;
    state.save();
  }
  return state;
}

export function handleClaimForInitiative(event: ClaimForInitiativeEvent): void {
  let initiative = GovernanceInitiative.load(event.params.initiative.toHex());
  if (initiative) {
    initiative.totalBoldClaimed = initiative.totalBoldClaimed.plus(event.params.bold);
    initiative.lastClaimEpoch = event.params.forEpoch.toI32();
    initiative.save();
  }
}
