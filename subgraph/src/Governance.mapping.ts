import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  AllocateLQTY as AllocateLQTYEvent,
  ClaimForInitiative as ClaimForInitiativeEvent,
  DepositLQTY as DepositLQTYEvent,
  RegisterInitiative as RegisterInitiativeEvent,
  SnapshotVotesForInitiative as SnapshotVotesForInitiativeEvent,
  UnregisterInitiative as UnregisterInitiativeEvent,
  WithdrawLQTY as WithdrawLQTYEvent,
} from "../generated/Governance/Governance";
import { GovernanceAllocation, GovernanceInitiative, GovernanceStats, GovernanceUser } from "../generated/schema";

function initializeStats(): GovernanceStats {
  // Create initial stats
  let stats = new GovernanceStats("stats");
  stats.totalLQTYStaked = BigInt.fromI32(0);
  stats.totalOffset = BigInt.fromI32(0);
  stats.totalInitiatives = 0;
  stats.save();

  return stats;
}

export function handleRegisterInitiative(event: RegisterInitiativeEvent): void {
  let initiative = new GovernanceInitiative(event.params.initiative.toHex());
  initiative.registeredAt = event.block.timestamp;
  initiative.registeredAtEpoch = event.params.atEpoch;
  initiative.registrant = event.params.registrant;
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
    user.allocated = [];
    user.allocatedLQTY = BigInt.fromI32(0);
    user.stakedLQTY = BigInt.fromI32(0);
    user.stakedOffset = BigInt.fromI32(0);
  }

  let offsetIncrease = event.params.lqtyAmount.times(event.block.timestamp);
  user.stakedOffset = user.stakedOffset.plus(offsetIncrease);
  user.stakedLQTY = user.stakedLQTY.plus(event.params.lqtyAmount);
  user.save();

  let stats = getStats();
  stats.totalOffset = stats.totalOffset.plus(offsetIncrease);
  stats.totalLQTYStaked = stats.totalLQTYStaked.plus(event.params.lqtyAmount);
  stats.save();
}

export function handleWithdrawLQTY(event: WithdrawLQTYEvent): void {
  let user = GovernanceUser.load(event.params.user.toHex());
  if (user === null) {
    return;
  }

  let stats = getStats();

  if (event.params.lqtyReceived < user.stakedLQTY) {
    let offsetDecrease = user.stakedOffset.times(event.params.lqtyReceived).div(user.stakedLQTY);
    stats.totalOffset = stats.totalOffset.minus(offsetDecrease);
    user.stakedOffset = user.stakedOffset.minus(offsetDecrease);
  } else {
    stats.totalOffset = stats.totalOffset.minus(user.stakedOffset);
    user.stakedOffset = BigInt.fromI32(0);
  }

  user.stakedLQTY = user.stakedLQTY.minus(event.params.lqtyReceived);
  user.save();

  stats.totalLQTYStaked = stats.totalLQTYStaked.minus(event.params.lqtyReceived);
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

  let wasAllocated = allocation.voteLQTY.gt(BigInt.fromI32(0)) || allocation.vetoLQTY.gt(BigInt.fromI32(0));

  // votes
  allocation.voteLQTY = allocation.voteLQTY.plus(event.params.deltaVoteLQTY);
  user.allocatedLQTY = user.allocatedLQTY.plus(event.params.deltaVoteLQTY);

  // vetos
  allocation.vetoLQTY = allocation.vetoLQTY.plus(event.params.deltaVetoLQTY);
  user.allocatedLQTY = user.allocatedLQTY.plus(event.params.deltaVetoLQTY);

  allocation.atEpoch = event.params.atEpoch;

  let isAllocated = allocation.voteLQTY.gt(BigInt.fromI32(0)) || allocation.vetoLQTY.gt(BigInt.fromI32(0));

  let allocated = user.allocated;
  let initiativeAddress = Bytes.fromHexString(initiativeId);
  if (!wasAllocated && isAllocated && !allocated.includes(initiativeAddress)) {
    allocated.push(Bytes.fromHexString(initiativeId));
    user.allocated = allocated;
  } else if (wasAllocated && !isAllocated && allocated.includes(initiativeAddress)) {
    let index = allocated.indexOf(initiativeAddress);
    allocated.splice(index, 1);
    user.allocated = allocated;
  }

  allocation.save();
  user.save();
  initiative.save();
}

function getStats(): GovernanceStats {
  let stats = GovernanceStats.load("stats");
  if (stats === null) {
    return initializeStats();
  }
  return stats;
}

export function handleClaimForInitiative(event: ClaimForInitiativeEvent): void {
  let initiative = GovernanceInitiative.load(event.params.initiative.toHex());
  if (initiative) {
    initiative.lastClaimEpoch = event.params.forEpoch;
    initiative.save();
  }
}
