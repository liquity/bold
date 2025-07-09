import { BigInt } from "@graphprotocol/graph-ts";
import {
  AllocateLQTY as AllocateLQTYEvent,
  Governance as GovernanceContract,
  RegisterInitiative as RegisterInitiativeEvent,
  UnregisterInitiative as UnregisterInitiativeEvent,
} from "../generated/Governance/Governance";
import { GovernanceAllocation, GovernanceInitiative } from "../generated/schema";

export function handleRegisterInitiative(event: RegisterInitiativeEvent): void {
  let initiative = new GovernanceInitiative(event.params.initiative.toHex());
  initiative.registered = true;
  initiative.save();
}

export function handleUnregisterInitiative(event: UnregisterInitiativeEvent): void {
  let initiative = GovernanceInitiative.load(event.params.initiative.toHex());
  if (initiative === null) {
    throw new Error("UnregisterInitiative event for non-existing initiative");
  }
  initiative.registered = false;
  initiative.save();
}

export function handleAllocateLQTY(event: AllocateLQTYEvent): void {
  let userId = event.params.user.toHex();
  let initiativeId = event.params.initiative.toHex();
  let totalAllocationId = initiativeId + ":" + event.params.atEpoch.toString();
  let userAllocationId = userId + ":" + totalAllocationId;
  let governance = GovernanceContract.bind(event.address);

  let userAllocation = GovernanceAllocation.load(userAllocationId);
  if (userAllocation === null) {
    userAllocation = new GovernanceAllocation(userAllocationId);
    userAllocation.user = userId;
    userAllocation.initiative = initiativeId;
    userAllocation.epoch = event.params.atEpoch;
  }

  let totalAllocation = GovernanceAllocation.load(totalAllocationId);
  if (totalAllocation === null) {
    totalAllocation = new GovernanceAllocation(totalAllocationId);
    totalAllocation.initiative = initiativeId;
    totalAllocation.epoch = event.params.atEpoch;
  }

  let userAllocationResult = governance.lqtyAllocatedByUserToInitiative(event.params.user, event.params.initiative);
  userAllocation.voteLQTY = userAllocationResult.getVoteLQTY();
  userAllocation.vetoLQTY = userAllocationResult.getVetoLQTY();
  userAllocation.voteOffset = userAllocationResult.getVoteOffset();
  userAllocation.vetoOffset = userAllocationResult.getVetoOffset();

  let totalAllocationResult = governance.initiativeStates(event.params.initiative);
  totalAllocation.voteLQTY = totalAllocationResult.getVoteLQTY();
  totalAllocation.vetoLQTY = totalAllocationResult.getVetoLQTY();
  totalAllocation.voteOffset = totalAllocationResult.getVoteOffset();
  totalAllocation.vetoOffset = totalAllocationResult.getVetoOffset();

  userAllocation.save();
  totalAllocation.save();
}
